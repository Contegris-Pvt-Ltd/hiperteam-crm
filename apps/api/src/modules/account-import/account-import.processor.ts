import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import { NotificationService } from '../notifications/notification.service';
import { NotificationGateway } from '../notifications/notification.gateway';

interface ImportJobData {
  jobId: string;
  schemaName: string;
  userId: string;
}

interface FailedRow {
  sheet: string;
  row: number;
  data: Record<string, any>;
  errors: string[];
}

const BATCH_SIZE = 50;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Processor('account-import')
export class AccountImportProcessor {
  private readonly logger = new Logger(AccountImportProcessor.name);

  constructor(
    private dataSource: DataSource,
    private notificationService: NotificationService,
    private gateway: NotificationGateway,
  ) {}

  @Process('import')
  async handleImport(bullJob: Job<ImportJobData>) {
    const { jobId, schemaName, userId } = bullJob.data;
    this.logger.log(`Starting account import job ${jobId} for schema ${schemaName}`);

    let importJob: any;

    try {
      // 1. Load job details from DB
      [importJob] = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".import_jobs WHERE id = $1`,
        [jobId],
      );

      if (!importJob) {
        this.logger.error(`Account import job ${jobId} not found`);
        return;
      }

      if (importJob.status === 'cancelled') {
        this.logger.log(`Account import job ${jobId} was cancelled before processing`);
        return;
      }

      // 2. Update status to processing
      await this.updateJobStatus(schemaName, jobId, 'processing', { started_at: 'NOW()' });

      // 3. Parse the file
      const filePath = importJob.file_path;
      if (!fs.existsSync(filePath)) {
        throw new Error(`Import file not found at: ${filePath}`);
      }

      const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
      const rawMapping = importJob.column_mapping || {};
      const settings = importJob.settings || {};

      // Detect mapping format: flat { accounts: { "Col": "field" } } vs structured { accounts: { sheetName, columnMapping } }
      let sheetMappings: Record<string, { sheetName: string; columnMapping: Record<string, string> }>;
      if (rawMapping.accounts && !rawMapping.accounts.sheetName) {
        // Flat format from frontend — need to detect sheet names from workbook
        const detectSheet = (type: string): string | null => {
          for (const wsName of workbook.SheetNames) {
            const n = wsName.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (type === 'accounts' && (n.includes('account') || n.includes('company'))) return wsName;
            if (type === 'contacts' && (n.includes('contact') || n.includes('people'))) return wsName;
            if (type === 'subscriptions' && (n.includes('subscription') || n.includes('product') || n.includes('license'))) return wsName;
          }
          // Fallback: if only one sheet and type is accounts, use it
          if (type === 'accounts' && workbook.SheetNames.length >= 1) return workbook.SheetNames[0];
          if (type === 'contacts' && workbook.SheetNames.length >= 2) return workbook.SheetNames[1];
          if (type === 'subscriptions' && workbook.SheetNames.length >= 3) return workbook.SheetNames[2];
          return null;
        };
        sheetMappings = {};
        for (const type of ['accounts', 'contacts', 'subscriptions'] as const) {
          if (rawMapping[type] && Object.keys(rawMapping[type]).length > 0) {
            const wsName = detectSheet(type);
            if (wsName) {
              sheetMappings[type] = { sheetName: wsName, columnMapping: rawMapping[type] };
            }
          }
        }
      } else {
        sheetMappings = rawMapping;
      }

      // 4. Pre-load lookup maps
      // Users: email → id, "first last" → id
      const userEmailMap = new Map<string, string>();
      const userNameMap = new Map<string, string>();
      const userRows = await this.dataSource.query(
        `SELECT id, lower(email) as email, lower(first_name || ' ' || last_name) as full_name
         FROM "${schemaName}".users WHERE status = 'active' AND deleted_at IS NULL`,
      );
      for (const u of userRows) {
        if (u.email) userEmailMap.set(u.email, u.id);
        userNameMap.set(u.full_name, u.id);
      }

      // Teams: name → { id, teamLeadId }
      const teamIdMap = new Map<string, string>();
      const teamUserMap = new Map<string, string>();
      const teamRows = await this.dataSource.query(
        `SELECT t.id, lower(t.name) as name, t.team_lead_id
         FROM "${schemaName}".teams t WHERE t.is_active = true`,
      );
      for (const t of teamRows) {
        teamIdMap.set(t.name, t.id);
        if (t.team_lead_id) {
          teamUserMap.set(t.name, t.team_lead_id);
        } else {
          const [member] = await this.dataSource.query(
            `SELECT ut.user_id FROM "${schemaName}".user_teams ut
             JOIN "${schemaName}".users u ON u.id = ut.user_id
             WHERE ut.team_id = $1 AND u.status = 'active' AND u.deleted_at IS NULL
             LIMIT 1`,
            [t.id],
          );
          if (member) teamUserMap.set(t.name, member.user_id);
        }
      }

      // Products: name → { id, unitPrice }
      const productMap = new Map<string, { id: string; unitPrice: number }>();
      const productRows = await this.dataSource.query(
        `SELECT id, lower(name) as name, base_price FROM "${schemaName}".products WHERE status = 'active' AND deleted_at IS NULL`,
      );
      for (const p of productRows) {
        productMap.set(p.name, { id: p.id, unitPrice: parseFloat(p.base_price) || 0 });
      }

      // Existing accounts: name (lowercased) → id (for duplicate detection)
      const existingAccountMap = new Map<string, string>();
      if (settings.duplicateStrategy !== 'import') {
        const existingAccounts = await this.dataSource.query(
          `SELECT id, lower(name) as name FROM "${schemaName}".accounts WHERE deleted_at IS NULL`,
        );
        for (const a of existingAccounts) {
          existingAccountMap.set(a.name, a.id);
        }
      }

      // Track counters
      const failedRows: FailedRow[] = [];
      let processedCount = 0;
      let importedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let duplicateCount = 0;

      // accountName → accountId map for linking contacts & subscriptions
      const accountNameToId = new Map<string, string>();

      // Pre-populate with existing accounts
      for (const [name, id] of existingAccountMap) {
        accountNameToId.set(name, id);
      }

      const totalRecords = importJob.total_records || 0;

      // ======================================================
      // 5. Process Accounts sheet first
      // ======================================================
      if (sheetMappings.accounts) {
        const { sheetName, columnMapping } = sheetMappings.accounts;
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          const headers: string[] = allRows[0].map((h: any) => String(h).trim());
          const dataRows = allRows.slice(1);

          for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
            // Check for cancellation
            const [currentJob] = await this.dataSource.query(
              `SELECT status FROM "${schemaName}".import_jobs WHERE id = $1`,
              [jobId],
            );
            if (currentJob?.status === 'cancelled') {
              this.logger.log(`Account import job ${jobId} cancelled at accounts batch ${batchStart}`);
              break;
            }

            const batch = dataRows.slice(batchStart, batchStart + BATCH_SIZE);

            for (let i = 0; i < batch.length; i++) {
              const rowIndex = batchStart + i + 2;
              const row = batch[i];
              const errors: string[] = [];

              // Map columns
              const rawData: Record<string, any> = {};
              const originalData: Record<string, any> = {};

              headers.forEach((header, colIdx) => {
                const field = columnMapping[header];
                originalData[header] = row[colIdx] !== undefined ? String(row[colIdx]) : '';
                if (field && field !== '__skip__') {
                  const value = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
                  if (!rawData[field]) rawData[field] = value;
                }
              });

              // Validate required: name
              const accountName = rawData.name?.trim();
              if (!accountName) {
                errors.push('Account Name is required');
              }

              // Validate email if provided
              const email = rawData.email ? rawData.email.toLowerCase().trim() : null;
              if (email && !EMAIL_REGEX.test(email)) {
                errors.push(`Invalid email format: ${email}`);
              }

              if (errors.length > 0) {
                failedRows.push({ sheet: 'Accounts', row: rowIndex, data: originalData, errors });
                failedCount++;
                processedCount++;
                continue;
              }

              // Duplicate check
              const nameKey = accountName.toLowerCase();
              if (settings.duplicateStrategy === 'skip' && (existingAccountMap.has(nameKey) || accountNameToId.has(nameKey))) {
                failedRows.push({ sheet: 'Accounts', row: rowIndex, data: originalData, errors: [`Duplicate account: ${accountName}`] });
                duplicateCount++;
                skippedCount++;
                processedCount++;
                continue;
              }

              // If update strategy and account exists, update it
              if (settings.duplicateStrategy === 'update' && (existingAccountMap.has(nameKey) || accountNameToId.has(nameKey))) {
                const existingId = existingAccountMap.get(nameKey) || accountNameToId.get(nameKey);
                if (existingId) {
                  try {
                    await this.updateExistingAccount(schemaName, existingId, rawData, userId);
                    accountNameToId.set(nameKey, existingId);
                    duplicateCount++;
                    importedCount++;
                    processedCount++;
                    continue;
                  } catch (err: any) {
                    failedRows.push({ sheet: 'Accounts', row: rowIndex, data: originalData, errors: [`Update failed: ${err.message}`] });
                    failedCount++;
                    processedCount++;
                    continue;
                  }
                }
              }

              // Resolve owner
              const ownerId = this.resolveOwner(
                rawData.owner,
                rawData.team,
                userEmailMap,
                userNameMap,
                teamUserMap,
                settings,
                userId,
              );

              // Resolve team
              let teamId: string | null = null;
              if (rawData.team) {
                teamId = teamIdMap.get(rawData.team.toLowerCase().trim()) || null;
              }

              // Parse tags
              const tags = rawData.tags
                ? rawData.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
                : [];
              const allTags = [...new Set([...tags, ...(settings.tags || [])])];

              // Build addresses JSON
              const addresses: any[] = [];
              if (rawData.addressLine1 || rawData.city || rawData.country) {
                addresses.push({
                  type: 'billing',
                  line1: rawData.addressLine1 || '',
                  line2: rawData.addressLine2 || '',
                  city: rawData.city || '',
                  state: rawData.state || '',
                  postalCode: rawData.postalCode || '',
                  country: rawData.country || '',
                });
              }

              // Build phones/emails JSON — supports comma-separated, normalize to E.164
              const countryCode = settings.countryCode || 'US';
              const parseMultiVal = (val: string): string[] =>
                val ? val.split(/[,;]+/).map(v => v.trim()).filter(Boolean) : [];

              const phones: any[] = [];
              for (const p of parseMultiVal(rawData.phone || '')) {
                const normalized = this.normalizePhone(p, countryCode);
                phones.push({ type: 'work', number: normalized || p });
              }

              const emails: any[] = [];
              const allAccountEmails = parseMultiVal(rawData.email || email || '');
              for (const e of allAccountEmails) {
                emails.push({ type: 'work', email: e });
              }

              try {
                const [inserted] = await this.dataSource.query(
                  `INSERT INTO "${schemaName}".accounts
                   (name, account_type, industry, website, description,
                    emails, phones, addresses, annual_revenue, company_size,
                    source, tags, owner_id, created_by)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                   RETURNING id`,
                  [
                    accountName,
                    rawData.type || settings.defaultAccountType || 'B2B',
                    rawData.industry || null,
                    rawData.website || null,
                    rawData.description || null,
                    JSON.stringify(emails),
                    JSON.stringify(phones),
                    JSON.stringify(addresses),
                    rawData.annualRevenue ? parseFloat(rawData.annualRevenue) || null : null,
                    rawData.employeeCount || null,
                    rawData.source || null,
                    allTags,
                    ownerId,
                    userId,
                  ],
                );

                accountNameToId.set(nameKey, inserted.id);
                existingAccountMap.set(nameKey, inserted.id);
                importedCount++;
              } catch (insertErr: any) {
                failedRows.push({ sheet: 'Accounts', row: rowIndex, data: originalData, errors: [`Insert failed: ${insertErr.message}`] });
                failedCount++;
              }

              processedCount++;
            }

            // Update progress
            await this.updateProgress(schemaName, jobId, userId, totalRecords, processedCount, importedCount, skippedCount, failedCount, duplicateCount);
          }
        }
      }

      // ======================================================
      // 6. Process Contacts sheet
      // ======================================================
      if (sheetMappings.contacts) {
        const { sheetName, columnMapping } = sheetMappings.contacts;
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          const headers: string[] = allRows[0].map((h: any) => String(h).trim());
          const dataRows = allRows.slice(1);

          // Pre-load existing contact emails for duplicate check
          const existingContactEmails = new Set<string>();
          if (settings.duplicateStrategy !== 'import') {
            const contactEmails = await this.dataSource.query(
              `SELECT lower(email) as email FROM "${schemaName}".contacts WHERE email IS NOT NULL AND deleted_at IS NULL`,
            );
            for (const c of contactEmails) existingContactEmails.add(c.email);
          }

          for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
            // Check for cancellation
            const [currentJob] = await this.dataSource.query(
              `SELECT status FROM "${schemaName}".import_jobs WHERE id = $1`,
              [jobId],
            );
            if (currentJob?.status === 'cancelled') {
              this.logger.log(`Account import job ${jobId} cancelled at contacts batch ${batchStart}`);
              break;
            }

            const batch = dataRows.slice(batchStart, batchStart + BATCH_SIZE);

            for (let i = 0; i < batch.length; i++) {
              const rowIndex = batchStart + i + 2;
              const row = batch[i];
              const errors: string[] = [];

              // Map columns
              const rawData: Record<string, any> = {};
              const originalData: Record<string, any> = {};

              headers.forEach((header, colIdx) => {
                const field = columnMapping[header];
                originalData[header] = row[colIdx] !== undefined ? String(row[colIdx]) : '';
                if (field && field !== '__skip__') {
                  const value = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
                  if (!rawData[field]) rawData[field] = value;
                }
              });

              // Validate required: accountName
              const accountNameRaw = rawData.accountName?.trim();
              if (!accountNameRaw) {
                errors.push('Account Name is required to link the contact');
              }

              // Resolve accountId
              const accountId = accountNameRaw
                ? accountNameToId.get(accountNameRaw.toLowerCase()) || null
                : null;

              if (accountNameRaw && !accountId) {
                errors.push(`Account not found: ${accountNameRaw}`);
              }

              // Validate email
              const contactEmail = rawData.email ? rawData.email.toLowerCase().trim() : null;
              if (contactEmail && !EMAIL_REGEX.test(contactEmail)) {
                errors.push(`Invalid email format: ${contactEmail}`);
              }

              if (errors.length > 0) {
                failedRows.push({ sheet: 'Contacts', row: rowIndex, data: originalData, errors });
                failedCount++;
                processedCount++;
                continue;
              }

              // Duplicate check by email
              if (settings.duplicateStrategy === 'skip' && contactEmail && existingContactEmails.has(contactEmail)) {
                failedRows.push({ sheet: 'Contacts', row: rowIndex, data: originalData, errors: [`Duplicate contact email: ${contactEmail}`] });
                duplicateCount++;
                skippedCount++;
                processedCount++;
                continue;
              }

              // Derive last_name fallback (contacts table requires it)
              const lastName = rawData.lastName || rawData.firstName || rawData.email || '-';
              const cc = settings.countryCode || 'US';

              // Parse comma-separated phones, mobiles, emails
              const parseMultiple = (val: string): string[] =>
                val ? val.split(/[,;]+/).map(v => v.trim()).filter(Boolean) : [];

              const allPhones = parseMultiple(rawData.phone || '');
              const allMobiles = parseMultiple(rawData.mobile || '');
              const allEmails = parseMultiple(rawData.email || '');

              // Primary values (first in list)
              const primaryPhone = allPhones[0] ? this.normalizePhone(allPhones[0], cc) || allPhones[0] : null;
              const primaryMobile = allMobiles[0] ? this.normalizePhone(allMobiles[0], cc) || allMobiles[0] : null;
              const primaryEmail = allEmails[0] || contactEmail;

              // Additional phones → JSONB phones array
              const phonesJson: any[] = [];
              for (const p of allPhones) {
                const normalized = this.normalizePhone(p, cc) || p;
                phonesJson.push({ type: 'work', number: normalized });
              }
              for (const m of allMobiles) {
                const normalized = this.normalizePhone(m, cc) || m;
                phonesJson.push({ type: 'mobile', number: normalized });
              }

              // Additional emails → JSONB emails array
              const emailsJson: any[] = allEmails.map((e, i) => ({
                type: i === 0 ? 'work' : 'other',
                email: e,
              }));

              try {
                const [inserted] = await this.dataSource.query(
                  `INSERT INTO "${schemaName}".contacts
                   (first_name, last_name, email, phone, mobile,
                    emails, phones,
                    job_title, account_id, owner_id, created_by)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                   RETURNING id`,
                  [
                    rawData.firstName || null,
                    lastName,
                    primaryEmail,
                    primaryPhone,
                    primaryMobile,
                    JSON.stringify(emailsJson),
                    JSON.stringify(phonesJson),
                    rawData.jobTitle || null,
                    accountId,
                    userId,
                    userId,
                  ],
                );

                // Also link contact to account via contact_accounts
                if (accountId && inserted.id) {
                  await this.dataSource.query(
                    `INSERT INTO "${schemaName}".contact_accounts (account_id, contact_id, role, is_primary)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (contact_id, account_id) DO NOTHING`,
                    [accountId, inserted.id, rawData.role || null, true],
                  ).catch(() => {}); // non-critical
                }

                if (contactEmail) existingContactEmails.add(contactEmail);
                importedCount++;
              } catch (insertErr: any) {
                failedRows.push({ sheet: 'Contacts', row: rowIndex, data: originalData, errors: [`Insert failed: ${insertErr.message}`] });
                failedCount++;
              }

              processedCount++;
            }

            // Update progress
            await this.updateProgress(schemaName, jobId, userId, totalRecords, processedCount, importedCount, skippedCount, failedCount, duplicateCount);
          }
        }
      }

      // ======================================================
      // 7. Process Subscriptions sheet
      // ======================================================
      if (sheetMappings.subscriptions) {
        const { sheetName, columnMapping } = sheetMappings.subscriptions;
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          const headers: string[] = allRows[0].map((h: any) => String(h).trim());
          const dataRows = allRows.slice(1);

          for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
            // Check for cancellation
            const [currentJob] = await this.dataSource.query(
              `SELECT status FROM "${schemaName}".import_jobs WHERE id = $1`,
              [jobId],
            );
            if (currentJob?.status === 'cancelled') {
              this.logger.log(`Account import job ${jobId} cancelled at subscriptions batch ${batchStart}`);
              break;
            }

            const batch = dataRows.slice(batchStart, batchStart + BATCH_SIZE);

            for (let i = 0; i < batch.length; i++) {
              const rowIndex = batchStart + i + 2;
              const row = batch[i];
              const errors: string[] = [];

              // Map columns
              const rawData: Record<string, any> = {};
              const originalData: Record<string, any> = {};

              headers.forEach((header, colIdx) => {
                const field = columnMapping[header];
                originalData[header] = row[colIdx] !== undefined ? String(row[colIdx]) : '';
                if (field && field !== '__skip__') {
                  const value = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
                  if (!rawData[field]) rawData[field] = value;
                }
              });

              // Validate required fields
              const accountNameRaw = rawData.accountName?.trim();
              if (!accountNameRaw) {
                errors.push('Account Name is required');
              }

              const productName = rawData.productName?.trim();
              if (!productName) {
                errors.push('Product Name is required');
              }

              // Resolve accountId
              const accountId = accountNameRaw
                ? accountNameToId.get(accountNameRaw.toLowerCase()) || null
                : null;

              if (accountNameRaw && !accountId) {
                errors.push(`Account not found: ${accountNameRaw}`);
              }

              if (errors.length > 0) {
                failedRows.push({ sheet: 'Subscriptions', row: rowIndex, data: originalData, errors });
                failedCount++;
                processedCount++;
                continue;
              }

              // Resolve product — auto-create if not found
              const unitPrice = rawData.unitPrice ? parseFloat(rawData.unitPrice) || 0 : 0;
              let productInfo = productMap.get(productName.toLowerCase().trim());
              if (!productInfo) {
                try {
                  const [newProduct] = await this.dataSource.query(
                    `INSERT INTO "${schemaName}".products (name, base_price, status, created_by)
                     VALUES ($1, $2, 'active', $3) RETURNING id`,
                    [productName, unitPrice, userId],
                  );
                  productInfo = { id: newProduct.id, unitPrice };
                  productMap.set(productName.toLowerCase().trim(), productInfo);
                } catch (productErr: any) {
                  failedRows.push({ sheet: 'Subscriptions', row: rowIndex, data: originalData, errors: [`Failed to create product: ${productErr.message}`] });
                  failedCount++;
                  processedCount++;
                  continue;
                }
              }

              // Parse numeric values
              const quantity = rawData.quantity ? parseFloat(rawData.quantity) || 1 : 1;
              const resolvedUnitPrice = unitPrice || productInfo.unitPrice || 0;
              const discount = rawData.discount ? parseFloat(rawData.discount) || 0 : 0;

              // Calculate MRR
              const mrr = resolvedUnitPrice * quantity * (1 - discount / 100);

              // Parse dates
              const startDate = this.parseDate(rawData.startDate);
              const endDate = this.parseDate(rawData.endDate);
              const renewalDate = this.parseDate(rawData.renewalDate);

              // Parse auto-renew
              const autoRenewRaw = (rawData.autoRenew || '').toLowerCase().trim();
              const autoRenew = ['yes', 'true', '1', 'y'].includes(autoRenewRaw);

              // Parse status
              const status = this.normalizeStatus(rawData.status);

              // Parse billing frequency
              const billingFrequency = this.normalizeBillingFrequency(rawData.billingFrequency);

              try {
                await this.dataSource.query(
                  `INSERT INTO "${schemaName}".account_subscriptions
                   (account_id, product_id, status, billing_frequency, quantity,
                    unit_price, discount_percent, mrr, start_date, end_date,
                    renewal_date, auto_renew, notes, created_by)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                  [
                    accountId,
                    productInfo.id,
                    status,
                    billingFrequency,
                    quantity,
                    resolvedUnitPrice,
                    discount,
                    mrr,
                    startDate,
                    endDate,
                    renewalDate,
                    autoRenew,
                    rawData.notes || null,
                    userId,
                  ],
                );

                importedCount++;
              } catch (insertErr: any) {
                failedRows.push({ sheet: 'Subscriptions', row: rowIndex, data: originalData, errors: [`Insert failed: ${insertErr.message}`] });
                failedCount++;
              }

              processedCount++;
            }

            // Update progress
            await this.updateProgress(schemaName, jobId, userId, totalRecords, processedCount, importedCount, skippedCount, failedCount, duplicateCount);
          }
        }
      }

      // ======================================================
      // 8. Finalize
      // ======================================================
      const finalStatus = failedCount === totalRecords ? 'failed' : 'completed';

      await this.dataSource.query(
        `UPDATE "${schemaName}".import_jobs SET
          status = $1, processed_records = $2, imported_records = $3,
          skipped_records = $4, failed_records = $5, duplicate_records = $6,
          failed_rows = $7, completed_at = NOW(), updated_at = NOW()
         WHERE id = $8`,
        [
          finalStatus, processedCount, importedCount, skippedCount,
          failedCount, duplicateCount, JSON.stringify(failedRows), jobId,
        ],
      );

      // 9. Emit WebSocket completion
      this.gateway.server.to(`user:${userId}`).emit('account_import_complete', {
        jobId,
        status: finalStatus,
        totalRecords,
        importedRecords: importedCount,
        failedRecords: failedCount,
        skippedRecords: skippedCount,
        duplicateRecords: duplicateCount,
        percentComplete: 100,
      });

      // 10. Send notification
      const hasFailures = failedCount > 0;
      await this.notificationService.notify(schemaName, {
        userId,
        eventType: 'account_import_complete',
        title: finalStatus === 'completed' ? 'Account Import Complete' : 'Account Import Failed',
        body: `Imported ${importedCount} of ${totalRecords} records.${failedCount ? ` ${failedCount} failed.` : ''}${skippedCount ? ` ${skippedCount} skipped.` : ''}${hasFailures ? ' Download failed rows from Batch Jobs.' : ''}`,
        icon: finalStatus === 'completed' ? 'check-circle' : 'alert-circle',
        actionUrl: hasFailures ? `/admin/batch-jobs?highlight=${jobId}` : `/admin/batch-jobs`,
        entityType: 'import_job',
        entityId: jobId,
      });

      // 11. Log bulk activity
      if (importedCount > 0) {
        await this.dataSource.query(
          `INSERT INTO "${schemaName}".activities (
            entity_type, entity_id, activity_type, title, description, performed_by
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            'accounts',
            jobId,
            'bulk_import',
            'Accounts bulk imported',
            `${importedCount} records imported from file "${importJob.file_name}" (accounts, contacts, subscriptions)`,
            userId,
          ],
        );
      }

      this.logger.log(`Account import job ${jobId} completed: ${importedCount} imported, ${failedCount} failed, ${skippedCount} skipped`);

    } catch (error: any) {
      this.logger.error(`Account import job ${jobId} failed with error: ${error.message}`, error.stack);

      // Mark job as failed
      await this.dataSource.query(
        `UPDATE "${schemaName}".import_jobs SET
          status = 'failed', error_message = $1, completed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [error.message, jobId],
      ).catch(() => {});

      // Notify user of failure
      this.gateway.server.to(`user:${userId}`).emit('account_import_complete', {
        jobId,
        status: 'failed',
        errorMessage: error.message,
      });

      await this.notificationService.notify(schemaName, {
        userId,
        eventType: 'account_import_failed',
        title: 'Account Import Failed',
        body: `Import failed: ${error.message}`,
        icon: 'alert-circle',
        actionUrl: `/admin/batch-jobs`,
        entityType: 'import_job',
        entityId: jobId,
      }).catch(() => {});
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private resolveOwner(
    rawOwner: string | undefined,
    rawTeam: string | undefined,
    userEmailMap: Map<string, string>,
    userNameMap: Map<string, string>,
    teamUserMap: Map<string, string>,
    settings: any,
    userId: string,
  ): string {
    if (rawOwner) {
      const trimmed = rawOwner.toLowerCase().trim();

      // 1. Try email match
      const byEmail = userEmailMap.get(trimmed);
      if (byEmail) return byEmail;

      // 2. Try full name match
      const byName = userNameMap.get(trimmed);
      if (byName) return byName;
    }

    // 3. Team lead fallback
    if (rawTeam) {
      const teamName = rawTeam.toLowerCase().trim();
      const teamUser = teamUserMap.get(teamName);
      if (teamUser) return teamUser;
    }

    // 4. Settings fallback
    if (settings.assignmentStrategy === 'specific_user' && settings.ownerId) {
      return settings.ownerId;
    }

    // 5. Importing user
    return userId;
  }

  private async updateExistingAccount(
    schemaName: string,
    accountId: string,
    data: Record<string, any>,
    userId: string,
  ) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const fieldMap: Record<string, string> = {
      industry: 'industry',
      website: 'website',
      description: 'description',
      source: 'source',
    };

    for (const [dtoField, dbField] of Object.entries(fieldMap)) {
      if (data[dtoField] !== undefined && data[dtoField] !== '') {
        updates.push(`${dbField} = $${paramIdx++}`);
        values.push(data[dtoField]);
      }
    }

    if (data.type) {
      updates.push(`account_type = $${paramIdx++}`);
      values.push(data.type);
    }

    if (data.annualRevenue) {
      const revenue = parseFloat(data.annualRevenue);
      if (!isNaN(revenue)) {
        updates.push(`annual_revenue = $${paramIdx++}`);
        values.push(revenue);
      }
    }

    if (data.employeeCount) {
      updates.push(`company_size = $${paramIdx++}`);
      values.push(data.employeeCount);
    }

    if (data.tags) {
      const tags = data.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        updates.push(`tags = $${paramIdx++}`);
        values.push(tags);
      }
    }

    if (updates.length === 0) return;

    updates.push(`updated_at = NOW()`);

    values.push(accountId);
    await this.dataSource.query(
      `UPDATE "${schemaName}".accounts SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      values,
    );
  }

  private async updateProgress(
    schemaName: string,
    jobId: string,
    userId: string,
    totalRecords: number,
    processedCount: number,
    importedCount: number,
    skippedCount: number,
    failedCount: number,
    duplicateCount: number,
  ) {
    await this.dataSource.query(
      `UPDATE "${schemaName}".import_jobs SET
        processed_records = $1, imported_records = $2, skipped_records = $3,
        failed_records = $4, duplicate_records = $5, updated_at = NOW()
       WHERE id = $6`,
      [processedCount, importedCount, skippedCount, failedCount, duplicateCount, jobId],
    );

    const percentComplete = totalRecords > 0
      ? Math.round((processedCount / totalRecords) * 100)
      : 0;

    this.gateway.server.to(`user:${userId}`).emit('account_import_progress', {
      jobId,
      status: 'processing',
      totalRecords,
      processedRecords: processedCount,
      importedRecords: importedCount,
      failedRecords: failedCount,
      skippedRecords: skippedCount,
      duplicateRecords: duplicateCount,
      percentComplete,
    });
  }

  private parseDate(value: string | undefined): string | null {
    if (!value || !value.trim()) return null;

    const trimmed = value.trim();

    // Try ISO format first
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    // Try common formats: MM/DD/YYYY, DD/MM/YYYY
    const parts = trimmed.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const [a, b, c] = parts.map(p => parseInt(p, 10));
      // If first part > 12, assume DD/MM/YYYY
      if (a > 12 && b <= 12) {
        const d = new Date(c, b - 1, a);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      }
      // Otherwise assume MM/DD/YYYY
      if (a <= 12) {
        const d = new Date(c, a - 1, b);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      }
    }

    return null;
  }

  private normalizePhone(phone: string, countryCode: string): string | null {
    if (!phone) return null;
    try {
      const cleaned = String(phone).replace(/[^\d+]/g, '');
      if (!cleaned) return null;
      if (isValidPhoneNumber(cleaned, countryCode as any)) {
        return parsePhoneNumber(cleaned, countryCode as any).format('E.164');
      }
      const parsed = parsePhoneNumber(cleaned, countryCode as any);
      if (parsed && parsed.isValid()) {
        return parsed.format('E.164');
      }
      return String(phone).trim(); // Return original if can't normalize
    } catch {
      return String(phone).trim(); // Return original on error
    }
  }

  private normalizeStatus(value: string | undefined): string {
    if (!value) return 'active';
    const v = value.toLowerCase().trim();
    if (['active', 'trial', 'expired', 'cancelled', 'suspended'].includes(v)) return v;
    return 'active';
  }

  private normalizeBillingFrequency(value: string | undefined): string {
    if (!value) return 'monthly';
    const v = value.toLowerCase().trim();
    if (['monthly', 'quarterly', 'annually', 'yearly', 'weekly'].includes(v)) {
      return v === 'yearly' ? 'annually' : v;
    }
    return 'monthly';
  }

  private async updateJobStatus(
    schemaName: string,
    jobId: string,
    status: string,
    extra: Record<string, string> = {},
  ) {
    const sets = [`status = '${status}'`, `updated_at = NOW()`];
    for (const [key, value] of Object.entries(extra)) {
      sets.push(`${key} = ${value}`);
    }
    await this.dataSource.query(
      `UPDATE "${schemaName}".import_jobs SET ${sets.join(', ')} WHERE id = $1`,
      [jobId],
    );
  }
}
