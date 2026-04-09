import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { DataSource } from 'typeorm';
import { XLSX } from '../../common/utils/xlsx-compat';
import * as fs from 'fs';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import { NotificationService } from '../notifications/notification.service';
import { NotificationGateway } from '../notifications/notification.gateway';
import { FieldValidationService, ValidationRule } from '../shared/field-validation.service';

interface ImportJobData {
  jobId: string;
  schemaName: string;
  userId: string;
}

interface FailedRow {
  row: number;
  data: Record<string, any>;
  errors: string[];
}

const BATCH_SIZE = 50;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Processor('lead-import')
export class LeadImportProcessor {
  private readonly logger = new Logger(LeadImportProcessor.name);

  constructor(
    private dataSource: DataSource,
    private notificationService: NotificationService,
    private gateway: NotificationGateway,
    private fieldValidationService: FieldValidationService,
  ) {}

  @Process('import')
  async handleImport(bullJob: Job<ImportJobData>) {
    const { jobId, schemaName, userId } = bullJob.data;
    this.logger.log(`Starting import job ${jobId} for schema ${schemaName}`);

    let importJob: any;

    try {
      // 1. Load job details from DB
      [importJob] = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".import_jobs WHERE id = $1`,
        [jobId],
      );

      if (!importJob) {
        this.logger.error(`Import job ${jobId} not found`);
        return;
      }

      if (importJob.status === 'cancelled') {
        this.logger.log(`Import job ${jobId} was cancelled before processing`);
        return;
      }

      // 2. Update status to processing
      await this.updateJobStatus(schemaName, jobId, 'processing', { started_at: 'NOW()' });

      // 3. Parse the file
      const filePath = importJob.file_path;
      if (!fs.existsSync(filePath)) {
        throw new Error(`Import file not found at: ${filePath}`);
      }

      const workbook = await XLSX.readAsync(fs.readFileSync(filePath));
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      const headers: string[] = allRows[0].map((h: any) => String(h).trim());
      const dataRows = allRows.slice(1);

      const columnMapping: Record<string, string> = importJob.column_mapping || {};
      const settings = importJob.settings || {};
      const countryCode = settings.countryCode || 'PK';

      // 4. Pre-load existing emails and phones for fast duplicate detection (open leads only)
      let existingEmails = new Set<string>();
      let existingPhones = new Set<string>();

      if (settings.duplicateStrategy !== 'import') {
        const openLeadFilter = `deleted_at IS NULL AND converted_at IS NULL AND disqualified_at IS NULL`;

        const emails = await this.dataSource.query(
          `SELECT lower(email) as email FROM "${schemaName}".leads WHERE email IS NOT NULL AND ${openLeadFilter}`,
        );
        existingEmails = new Set(emails.map((e: any) => e.email));

        const phones = await this.dataSource.query(
          `SELECT phone FROM "${schemaName}".leads WHERE phone IS NOT NULL AND ${openLeadFilter}`,
        );
        existingPhones = new Set(phones.map((p: any) => p.phone));
      }

      // 5. Resolve defaults
      // Resolve default pipeline for leads
      let defaultPipelineId = settings.pipelineId || null;
      if (!defaultPipelineId) {
        const [defaultPl] = await this.dataSource.query(
          `SELECT id FROM "${schemaName}".pipelines
           WHERE is_default = true AND is_active = true LIMIT 1`,
        );
        defaultPipelineId = defaultPl?.id || null;
      }
      // Fallback: if still no pipeline, pick any pipeline that has leads stages
      if (!defaultPipelineId) {
        const [anyPl] = await this.dataSource.query(
          `SELECT DISTINCT pipeline_id as id FROM "${schemaName}".pipeline_stages
           WHERE module = 'leads' AND is_active = true LIMIT 1`,
        );
        defaultPipelineId = anyPl?.id || null;
      }
      this.logger.log(`Import job ${jobId}: defaultPipelineId=${defaultPipelineId}`);

      let defaultStageId = settings.stageId;
      if (!defaultStageId && defaultPipelineId) {
        const [stage] = await this.dataSource.query(
          `SELECT id FROM "${schemaName}".pipeline_stages
           WHERE pipeline_id = $1 AND module = 'leads'
             AND is_active = true AND is_won = false AND is_lost = false
           ORDER BY sort_order ASC LIMIT 1`,
          [defaultPipelineId],
        );
        defaultStageId = stage?.id;
      }
      this.logger.log(`Import job ${jobId}: defaultStageId=${defaultStageId}`);

      let defaultPriorityId = settings.priorityId;
      if (!defaultPriorityId) {
        const [priority] = await this.dataSource.query(
          `SELECT id FROM "${schemaName}".lead_priorities
           WHERE is_default = true AND is_active = true LIMIT 1`,
        );
        defaultPriorityId = priority?.id;
      }

      // 5b. Load field validation rules from module_settings
      const validationConfig = await this.fieldValidationService.getRules(schemaName, 'leads');
      const activeRules = (validationConfig.rules || []).filter((r: ValidationRule) => r.isActive);

      // 5c. Pre-load name→ID lookup maps for pipeline, stage, priority
      const pipelineMap = new Map<string, string>();
      const pipelineRows = await this.dataSource.query(
        `SELECT DISTINCT p.id, lower(p.name) as name FROM "${schemaName}".pipelines p
         INNER JOIN "${schemaName}".pipeline_stages ps ON ps.pipeline_id = p.id AND ps.module = 'leads' AND ps.is_active = true
         WHERE p.is_active = true`,
      );
      for (const p of pipelineRows) pipelineMap.set(p.name, p.id);

      // stageMap: pipelineId → Map<lowercased name, stageId>
      const stageMap = new Map<string, Map<string, string>>();
      const stageRows = await this.dataSource.query(
        `SELECT id, pipeline_id, lower(name) as name FROM "${schemaName}".pipeline_stages
         WHERE is_active = true AND module = 'leads'`,
      );
      for (const s of stageRows) {
        if (!stageMap.has(s.pipeline_id)) stageMap.set(s.pipeline_id, new Map());
        stageMap.get(s.pipeline_id)!.set(s.name, s.id);
      }

      const priorityMap = new Map<string, string>();
      const priorityRows = await this.dataSource.query(
        `SELECT id, lower(name) as name FROM "${schemaName}".lead_priorities WHERE is_active = true`,
      );
      for (const p of priorityRows) priorityMap.set(p.name, p.id);

      // 5c. Pre-load user, team, product lookup maps
      const userMap = new Map<string, string>(); // lowercased "first last" → userId
      const userRows = await this.dataSource.query(
        `SELECT id, lower(first_name || ' ' || last_name) as full_name
         FROM "${schemaName}".users WHERE status = 'active' AND deleted_at IS NULL`,
      );
      for (const u of userRows) userMap.set(u.full_name, u.id);

      // teamMap: lowercased name → team lead userId (or first member), and team ID
      const teamUserMap = new Map<string, string>(); // lowercased team name → userId to assign
      const teamIdMap = new Map<string, string>(); // lowercased team name → team ID
      const teamRows = await this.dataSource.query(
        `SELECT t.id, lower(t.name) as name, t.team_lead_id
         FROM "${schemaName}".teams t WHERE t.is_active = true`,
      );
      for (const t of teamRows) {
        teamIdMap.set(t.name, t.id);
        if (t.team_lead_id) {
          teamUserMap.set(t.name, t.team_lead_id);
        } else {
          // Fallback: pick first active member
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

      const productMap = new Map<string, string>(); // lowercased name → productId
      const productRows = await this.dataSource.query(
        `SELECT id, lower(name) as name FROM "${schemaName}".products WHERE status = 'active' AND deleted_at IS NULL`,
      );
      for (const p of productRows) productMap.set(p.name, p.id);

      // Accounts: lowercased name → id
      const accountMap = new Map<string, string>();
      const accountRows = await this.dataSource.query(
        `SELECT id, lower(name) as name FROM "${schemaName}".accounts WHERE deleted_at IS NULL`,
      );
      for (const a of accountRows) accountMap.set(a.name, a.id);

      // 6. Process in batches
      const failedRows: FailedRow[] = [];
      let processedCount = 0;
      let importedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let duplicateCount = 0;

      for (let batchStart = 0; batchStart < dataRows.length; batchStart += BATCH_SIZE) {
        // Check for cancellation before each batch
        const [currentJob] = await this.dataSource.query(
          `SELECT status FROM "${schemaName}".import_jobs WHERE id = $1`,
          [jobId],
        );
        if (currentJob?.status === 'cancelled') {
          this.logger.log(`Import job ${jobId} cancelled — stopping at row ${batchStart}`);
          break;
        }

        const batch = dataRows.slice(batchStart, batchStart + BATCH_SIZE);
        const batchInserts: any[][] = [];
        const batchProductIds: (string | null)[] = [];
        const batchTeamMemberIds: string[][] = [];

        for (let i = 0; i < batch.length; i++) {
          const rowIndex = batchStart + i + 2; // +2 for 1-indexed + header row
          const row = batch[i];
          const errors: string[] = [];

          // Map columns to lead fields
          const rawData: Record<string, any> = {};
          const originalData: Record<string, any> = {};
          const customFieldValues: Record<string, any> = {};
          const qualificationValues: Record<string, any> = {};

          headers.forEach((header, colIdx) => {
            const leadField = columnMapping[header];
            originalData[header] = row[colIdx] !== undefined ? String(row[colIdx]) : '';
            if (leadField && leadField !== '__skip__') {
              const value = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
              // Multi-column fallback: first non-empty value wins when multiple columns map to the same field
              if (leadField.startsWith('customField:')) {
                const fieldKey = leadField.replace('customField:', '');
                if (!customFieldValues[fieldKey]) customFieldValues[fieldKey] = value;
              } else if (leadField.startsWith('qualification:')) {
                const fieldKey = leadField.replace('qualification:', '');
                if (!qualificationValues[fieldKey]) qualificationValues[fieldKey] = value;
              } else {
                if (!rawData[leadField]) rawData[leadField] = value;
              }
            }
          });

          // --- Validation (dynamic, from module_settings) ---
          const firstName = rawData.firstName || null;
          const lastName = rawData.lastName || null;
          let email = rawData.email ? rawData.email.toLowerCase().trim() : null;
          let phone = rawData.phone ? String(rawData.phone).trim() : null;
          let mobile = rawData.mobile ? String(rawData.mobile).trim() : null;

          // Apply field validation rules from module_settings
          const validationData: Record<string, any> = { ...rawData, email, phone, mobile };
          for (const rule of activeRules) {
            const values = rule.fields.map(f => validationData[f]);
            const isEmpty = (v: any) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
            const msg = rule.message || `${rule.label || rule.fields.join(', ')} is required`;
            switch (rule.type) {
              case 'required':
                if (isEmpty(values[0])) errors.push(msg);
                break;
              case 'any_one':
                if (!values.some(v => !isEmpty(v))) errors.push(msg);
                break;
              case 'all':
                if (values.some(v => isEmpty(v))) errors.push(msg);
                break;
            }
          }

          // Validate email
          if (email) {
            if (!EMAIL_REGEX.test(email)) {
              errors.push(`Invalid email format: ${email}`);
              email = null;
            }
          }

          // Normalize & validate phone
          if (phone) {
            phone = this.normalizePhone(phone, countryCode);
            if (!phone) {
              errors.push(`Invalid phone number: ${rawData.phone}`);
            }
          }

          if (mobile) {
            mobile = this.normalizePhone(mobile, countryCode);
            if (!mobile) {
              errors.push(`Invalid mobile number: ${rawData.mobile}`);
            }
          }

          // If there are validation errors, add to failed list
          if (errors.length > 0) {
            failedRows.push({ row: rowIndex, data: originalData, errors });
            failedCount++;
            processedCount++;
            continue;
          }

          // --- Resolve pipeline, stage, priority, owner, team, product, tags per row ---
          const source = rawData.source || settings.source || null;

          const excelTags = rawData.tags
            ? rawData.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
            : [];
          const settingsTags: string[] = settings.tags || [];
          const tags = [...new Set([...excelTags, ...settingsTags])];

          let resolvedPipelineId = defaultPipelineId;
          if (rawData.pipeline) {
            const matched = pipelineMap.get(rawData.pipeline.toLowerCase().trim());
            if (matched) resolvedPipelineId = matched;
          }

          let resolvedStageId = defaultStageId;
          if (rawData.stage && resolvedPipelineId) {
            const pipelineStages = stageMap.get(resolvedPipelineId);
            if (pipelineStages) {
              const matched = pipelineStages.get(rawData.stage.toLowerCase().trim());
              if (matched) resolvedStageId = matched;
            }
          }

          let resolvedPriorityId = defaultPriorityId;
          if (rawData.priority) {
            const matched = priorityMap.get(rawData.priority.toLowerCase().trim());
            if (matched) resolvedPriorityId = matched;
          }

          // Resolve owner by name, fallback to team lead, then to settings
          let resolvedOwnerId: string | null = null;
          if (rawData.owner) {
            const matched = userMap.get(rawData.owner.toLowerCase().trim());
            if (matched) resolvedOwnerId = matched;
          }
          if (!resolvedOwnerId && rawData.team) {
            const matched = teamUserMap.get(rawData.team.toLowerCase().trim());
            if (matched) resolvedOwnerId = matched;
          }

          // Resolve team_id by name, fallback to settings
          let resolvedTeamId: string | null = settings.teamId || null;
          if (rawData.team) {
            const matched = teamIdMap.get(rawData.team.toLowerCase().trim());
            if (matched) resolvedTeamId = matched;
          }

          // Resolve product by name
          let resolvedProductId: string | null = null;
          if (rawData.product) {
            const matched = productMap.get(rawData.product.toLowerCase().trim());
            if (matched) resolvedProductId = matched;
          }

          // Resolve account by name
          let resolvedAccountId: string | null = null;
          if (rawData.account) {
            const accountName = rawData.account.toLowerCase().trim();
            resolvedAccountId = accountMap.get(accountName) || null;
          }

          // Resolve contact by email + account match
          let resolvedContactId: string | null = null;
          if (resolvedAccountId && email) {
            try {
              const [contact] = await this.dataSource.query(
                `SELECT id FROM "${schemaName}".contacts WHERE email = $1 AND account_id = $2 AND deleted_at IS NULL LIMIT 1`,
                [email, resolvedAccountId],
              );
              if (contact) resolvedContactId = contact.id;
            } catch {
              // non-critical, skip contact lookup errors
            }
          }

          // --- Duplicate check ---
          if (settings.duplicateStrategy === 'skip') {
            let isDuplicate = false;
            const dupReasons: string[] = [];

            if (email && existingEmails.has(email)) {
              isDuplicate = true;
              dupReasons.push(`Duplicate email: ${email}`);
            }
            if (phone && existingPhones.has(phone)) {
              isDuplicate = true;
              dupReasons.push(`Duplicate phone: ${phone}`);
            }

            if (isDuplicate) {
              failedRows.push({ row: rowIndex, data: originalData, errors: dupReasons });
              duplicateCount++;
              skippedCount++;
              processedCount++;
              continue;
            }
          } else if (settings.duplicateStrategy === 'update') {
            // Try to find existing lead and update
            let existingLeadId: string | null = null;

            if (email && existingEmails.has(email)) {
              const [existing] = await this.dataSource.query(
                `SELECT id FROM "${schemaName}".leads WHERE lower(email) = $1 AND deleted_at IS NULL AND converted_at IS NULL AND disqualified_at IS NULL LIMIT 1`,
                [email],
              );
              if (existing) existingLeadId = existing.id;
            }

            if (!existingLeadId && phone && existingPhones.has(phone)) {
              const [existing] = await this.dataSource.query(
                `SELECT id FROM "${schemaName}".leads WHERE phone = $1 AND deleted_at IS NULL AND converted_at IS NULL AND disqualified_at IS NULL LIMIT 1`,
                [phone],
              );
              if (existing) existingLeadId = existing.id;
            }

            if (existingLeadId) {
              try {
                await this.updateExistingLead(
                  schemaName, existingLeadId, rawData, customFieldValues, qualificationValues,
                  { pipelineId: resolvedPipelineId, stageId: resolvedStageId, priorityId: resolvedPriorityId, tags, ownerId: resolvedOwnerId, teamId: resolvedTeamId, productId: resolvedProductId, accountId: resolvedAccountId, contactId: resolvedContactId },
                  userId,
                );
                duplicateCount++;
                importedCount++;
                processedCount++;
                continue;
              } catch (updateErr: any) {
                failedRows.push({ row: rowIndex, data: originalData, errors: [`Update failed: ${updateErr.message}`] });
                failedCount++;
                processedCount++;
                continue;
              }
            }
          }

          // DB-safe: last_name is NOT NULL in DB — derive a fallback if empty
          const safeLastName = lastName || firstName || rawData.company || email || phone || mobile || '-';

          // --- Prepare insert ---
          const defaultOwnerId = settings.assignmentStrategy === 'specific_user' && settings.ownerId
            ? settings.ownerId
            : userId;
          const ownerId = resolvedOwnerId || defaultOwnerId;

          // Resolve record team members from comma-separated user names (skip if same as owner)
          const resolvedTeamMemberIds: string[] = [];
          if (rawData.teamMembers) {
            const names = rawData.teamMembers.split(',').map((n: string) => n.trim().toLowerCase()).filter(Boolean);
            for (const name of names) {
              const memberId = userMap.get(name);
              if (memberId && memberId !== ownerId) resolvedTeamMemberIds.push(memberId);
            }
          }

          batchInserts.push([
            firstName,                              // 0
            safeLastName,                           // 1
            email,                                  // 2
            phone,                                  // 3
            mobile,                                 // 4
            rawData.company || null,                // 5
            rawData.jobTitle || null,               // 6
            rawData.website || null,                // 7
            rawData.addressLine1 || null,           // 8
            rawData.addressLine2 || null,           // 9
            rawData.city || null,                   // 10
            rawData.state || null,                  // 11
            rawData.postalCode || null,             // 12
            rawData.country || null,                // 13
            source,                                 // 14
            resolvedPipelineId || null,             // 15
            resolvedStageId || null,                // 16
            resolvedPriorityId || null,             // 17
            tags,                                   // 18
            JSON.stringify(customFieldValues),       // 19 custom_fields
            JSON.stringify(qualificationValues),     // 20 qualification
            ownerId,                                // 21
            resolvedTeamId,                         // 22
            userId,                                 // 23
            rawData.industry || null,               // 24
            resolvedAccountId,                      // 25
            resolvedContactId,                      // 26
          ]);
          batchProductIds.push(resolvedProductId);
          batchTeamMemberIds.push(resolvedTeamMemberIds);

          // Track for duplicate detection within the same import
          if (email) existingEmails.add(email);
          if (phone) existingPhones.add(phone);

          processedCount++;
        }

        // Batch INSERT
        if (batchInserts.length > 0) {
          let insertedLeadIds: string[] = [];
          try {
            insertedLeadIds = await this.batchInsertLeads(schemaName, batchInserts);
            importedCount += insertedLeadIds.length;
          } catch (insertErr: any) {
            this.logger.error(`Batch insert failed for job ${jobId}: ${insertErr.message}`);
            // Fall back to individual inserts
            for (let k = 0; k < batchInserts.length; k++) {
              try {
                const leadId = await this.insertSingleLead(schemaName, batchInserts[k]);
                importedCount++;
                if (leadId) insertedLeadIds.push(leadId);
              } catch (singleErr: any) {
                const rowIdx = batchStart + k + 2;
                const originalRow: Record<string, any> = {};
                headers.forEach((h, ci) => {
                  originalRow[h] = dataRows[batchStart + k]?.[ci] ?? '';
                });
                failedRows.push({ row: rowIdx, data: originalRow, errors: [`Insert failed: ${singleErr.message}`] });
                failedCount++;
                insertedLeadIds.push(''); // placeholder to keep index alignment
              }
            }
          }

          // Link products to inserted leads
          for (let k = 0; k < insertedLeadIds.length; k++) {
            const leadId = insertedLeadIds[k];
            const productId = batchProductIds[k];
            if (leadId && productId) {
              try {
                await this.dataSource.query(
                  `INSERT INTO "${schemaName}".lead_products (lead_id, product_id, created_by)
                   VALUES ($1, $2, $3) ON CONFLICT (lead_id, product_id) DO NOTHING`,
                  [leadId, productId, userId],
                );
              } catch {
                // non-critical, skip product linking errors
              }
            }
          }

          // Link record team members to inserted leads
          for (let k = 0; k < insertedLeadIds.length; k++) {
            const leadId = insertedLeadIds[k];
            const memberIds = batchTeamMemberIds[k];
            if (leadId && memberIds && memberIds.length > 0) {
              for (const memberId of memberIds) {
                try {
                  await this.dataSource.query(
                    `INSERT INTO "${schemaName}".record_team_members
                       (entity_type, entity_id, user_id, access_level, added_by)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (entity_type, entity_id, user_id) DO NOTHING`,
                    ['leads', leadId, memberId, 'read', userId],
                  );
                } catch {
                  // non-critical, skip team member linking errors
                }
              }
            }
          }
        }

        // Recount processed for rows that went through batchInserts path
        processedCount = Math.min(batchStart + batch.length, dataRows.length);

        // Update progress in DB
        await this.dataSource.query(
          `UPDATE "${schemaName}".import_jobs SET
            processed_records = $1, imported_records = $2, skipped_records = $3,
            failed_records = $4, duplicate_records = $5, updated_at = NOW()
           WHERE id = $6`,
          [processedCount, importedCount, skippedCount, failedCount, duplicateCount, jobId],
        );

        // Emit progress via WebSocket
        const percentComplete = Math.round((processedCount / dataRows.length) * 100);
        this.gateway.server.to(`user:${userId}`).emit('import_progress', {
          jobId,
          status: 'processing',
          totalRecords: dataRows.length,
          processedRecords: processedCount,
          importedRecords: importedCount,
          failedRecords: failedCount,
          skippedRecords: skippedCount,
          duplicateRecords: duplicateCount,
          percentComplete,
        });
      }

      // 7. Finalize — store failed rows and mark complete
      const finalStatus = failedCount === dataRows.length ? 'failed' : 'completed';

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

      // 8. Emit completion event
      this.gateway.server.to(`user:${userId}`).emit('import_complete', {
        jobId,
        status: finalStatus,
        totalRecords: dataRows.length,
        importedRecords: importedCount,
        failedRecords: failedCount,
        skippedRecords: skippedCount,
        duplicateRecords: duplicateCount,
        percentComplete: 100,
      });

      // 9. Send notification
      const hasFailures = failedCount > 0;
      await this.notificationService.notify(schemaName, {
        userId,
        eventType: 'lead_import_complete',
        title: finalStatus === 'completed' ? 'Lead Import Complete' : 'Lead Import Failed',
        body: `Imported ${importedCount} of ${dataRows.length} leads.${failedCount ? ` ${failedCount} failed.` : ''}${skippedCount ? ` ${skippedCount} skipped.` : ''}${hasFailures ? ' Download failed rows from Batch Jobs.' : ''}`,
        icon: finalStatus === 'completed' ? 'check-circle' : 'alert-circle',
        actionUrl: hasFailures ? `/admin/batch-jobs?highlight=${jobId}` : `/admin/batch-jobs`,
        entityType: 'import_job',
        entityId: jobId,
      });

      // 10. Log bulk activity
      if (importedCount > 0) {
        await this.dataSource.query(
          `INSERT INTO "${schemaName}".activities (
            entity_type, entity_id, activity_type, title, description, performed_by
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            'leads',
            jobId,
            'bulk_import',
            'Leads bulk imported',
            `${importedCount} leads imported from file "${importJob.file_name}"`,
            userId,
          ],
        );
      }

      this.logger.log(`Import job ${jobId} completed: ${importedCount} imported, ${failedCount} failed, ${skippedCount} skipped`);

    } catch (error: any) {
      this.logger.error(`Import job ${jobId} failed with error: ${error.message}`, error.stack);

      // Mark job as failed
      await this.dataSource.query(
        `UPDATE "${schemaName}".import_jobs SET
          status = 'failed', error_message = $1, completed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [error.message, jobId],
      ).catch(() => {});

      // Notify user of failure
      this.gateway.server.to(`user:${userId}`).emit('import_complete', {
        jobId,
        status: 'failed',
        errorMessage: error.message,
      });

      await this.notificationService.notify(schemaName, {
        userId,
        eventType: 'lead_import_failed',
        title: 'Lead Import Failed',
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
  private normalizePhone(phone: string, countryCode: string): string | null {
    if (!phone) return null;

    try {
      const cleaned = phone.replace(/[^\d+]/g, '');
      if (!cleaned) return null;

      if (isValidPhoneNumber(cleaned, countryCode as any)) {
        const parsed = parsePhoneNumber(cleaned, countryCode as any);
        return parsed.format('E.164');
      }

      // Try parsing anyway
      const parsed = parsePhoneNumber(cleaned, countryCode as any);
      if (parsed && parsed.isValid()) {
        return parsed.format('E.164');
      }

      return null; // Invalid phone
    } catch {
      return null;
    }
  }

  private async batchInsertLeads(schemaName: string, rows: any[][]): Promise<string[]> {
    if (rows.length === 0) return [];

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIdx = 1;

    for (const row of rows) {
      const rowPlaceholders: string[] = [];
      for (const val of row) {
        rowPlaceholders.push(`$${paramIdx++}`);
        values.push(val);
      }
      // Add stage_history and stage_entered_at
      rowPlaceholders.push('NOW()'); // stage_entered_at
      rowPlaceholders.push(`$${paramIdx++}`); // stage_history
      values.push(JSON.stringify([{ stageId: row[16], enteredAt: new Date().toISOString(), enteredBy: row[23] }]));

      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const sql = `
      INSERT INTO "${schemaName}".leads (
        first_name, last_name, email, phone, mobile,
        company, job_title, website,
        address_line1, address_line2, city, state, postal_code, country,
        source, pipeline_id, stage_id, priority_id,
        tags, custom_fields, qualification,
        owner_id, team_id, created_by,
        industry,
        account_id, contact_id,
        stage_entered_at, stage_history
      ) VALUES ${placeholders.join(', ')}
      RETURNING id
    `;

    const result = await this.dataSource.query(sql, values);
    return result.map((r: any) => r.id);
  }

  private async insertSingleLead(schemaName: string, row: any[]): Promise<string> {
    const [result] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".leads (
        first_name, last_name, email, phone, mobile,
        company, job_title, website,
        address_line1, address_line2, city, state, postal_code, country,
        source, pipeline_id, stage_id, priority_id,
        tags, custom_fields, qualification,
        owner_id, team_id, created_by,
        industry,
        account_id, contact_id,
        stage_entered_at, stage_history
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, NOW(), $28
      ) RETURNING id`,
      [
        ...row,
        JSON.stringify([{ stageId: row[16], enteredAt: new Date().toISOString(), enteredBy: row[23] }]),
      ],
    );
    return result.id;
  }

  private async updateExistingLead(
    schemaName: string,
    leadId: string,
    data: Record<string, any>,
    customFieldValues: Record<string, any>,
    qualificationValues: Record<string, any>,
    resolved: {
      pipelineId: string | null; stageId: string | null; priorityId: string | null;
      tags: string[]; ownerId: string | null; teamId: string | null; productId: string | null;
      accountId: string | null; contactId: string | null;
    },
    userId: string,
  ) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const fieldMap: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      mobile: 'mobile',
      company: 'company',
      jobTitle: 'job_title',
      website: 'website',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      city: 'city',
      state: 'state',
      postalCode: 'postal_code',
      country: 'country',
      industry: 'industry',
    };

    for (const [dtoField, dbField] of Object.entries(fieldMap)) {
      if (data[dtoField] !== undefined && data[dtoField] !== '') {
        updates.push(`${dbField} = $${paramIdx++}`);
        values.push(data[dtoField]);
      }
    }

    // Update pipeline, stage, priority, owner if resolved from row data
    if (resolved.pipelineId) {
      updates.push(`pipeline_id = $${paramIdx++}`);
      values.push(resolved.pipelineId);
    }
    if (resolved.stageId) {
      updates.push(`stage_id = $${paramIdx++}`);
      values.push(resolved.stageId);
    }
    if (resolved.priorityId) {
      updates.push(`priority_id = $${paramIdx++}`);
      values.push(resolved.priorityId);
    }
    if (resolved.ownerId) {
      updates.push(`owner_id = $${paramIdx++}`);
      values.push(resolved.ownerId);
    }
    if (resolved.teamId) {
      updates.push(`team_id = $${paramIdx++}`);
      values.push(resolved.teamId);
    }
    if (resolved.accountId) {
      updates.push(`account_id = $${paramIdx++}`);
      values.push(resolved.accountId);
    }
    if (resolved.contactId) {
      updates.push(`contact_id = $${paramIdx++}`);
      values.push(resolved.contactId);
    }
    if (resolved.tags.length > 0) {
      updates.push(`tags = $${paramIdx++}`);
      values.push(resolved.tags);
    }

    // Merge custom fields into existing custom_fields JSONB
    if (Object.keys(customFieldValues).length > 0) {
      updates.push(`custom_fields = COALESCE(custom_fields, '{}'::jsonb) || $${paramIdx++}::jsonb`);
      values.push(JSON.stringify(customFieldValues));
    }

    // Merge qualification fields into existing qualification JSONB
    if (Object.keys(qualificationValues).length > 0) {
      updates.push(`qualification = COALESCE(qualification, '{}'::jsonb) || $${paramIdx++}::jsonb`);
      values.push(JSON.stringify(qualificationValues));
    }

    if (updates.length === 0 && !resolved.productId) return;

    if (updates.length > 0) {
      updates.push(`updated_by = $${paramIdx++}`);
      values.push(userId);
      updates.push(`updated_at = NOW()`);

      values.push(leadId);
      await this.dataSource.query(
        `UPDATE "${schemaName}".leads SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
        values,
      );
    }

    // Link product if resolved
    if (resolved.productId) {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".lead_products (lead_id, product_id, created_by)
         VALUES ($1, $2, $3) ON CONFLICT (lead_id, product_id) DO NOTHING`,
        [leadId, resolved.productId, userId],
      ).catch(() => {}); // non-critical
    }
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
