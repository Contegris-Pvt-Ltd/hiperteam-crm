import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

// Account fields available for mapping
export const ACCOUNT_FIELDS = [
  { value: 'name', label: 'Account Name', required: true },
  { value: 'type', label: 'Type' },
  { value: 'industry', label: 'Industry' },
  { value: 'website', label: 'Website' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'addressLine1', label: 'Address Line 1' },
  { value: 'addressLine2', label: 'Address Line 2' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'postalCode', label: 'Postal Code' },
  { value: 'country', label: 'Country' },
  { value: 'owner', label: 'Owner (Name or Email)' },
  { value: 'team', label: 'Team Name' },
  { value: 'tags', label: 'Tags' },
  { value: 'annualRevenue', label: 'Annual Revenue' },
  { value: 'employeeCount', label: 'Employee Count' },
  { value: 'description', label: 'Description' },
  { value: 'source', label: 'Source' },
  { value: '__skip__', label: 'Skip (Do not import)' },
];

// Contact fields available for mapping
export const CONTACT_FIELDS = [
  { value: 'accountName', label: 'Account Name', required: true },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'jobTitle', label: 'Job Title' },
  { value: 'department', label: 'Department' },
  { value: 'role', label: 'Role' },
  { value: '__skip__', label: 'Skip (Do not import)' },
];

// Subscription fields available for mapping
export const SUBSCRIPTION_FIELDS = [
  { value: 'accountName', label: 'Account Name', required: true },
  { value: 'productName', label: 'Product Name', required: true },
  { value: 'status', label: 'Status' },
  { value: 'billingFrequency', label: 'Billing Frequency' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'unitPrice', label: 'Unit Price' },
  { value: 'discount', label: 'Discount %' },
  { value: 'startDate', label: 'Start Date' },
  { value: 'endDate', label: 'End Date' },
  { value: 'renewalDate', label: 'Renewal Date' },
  { value: 'autoRenew', label: 'Auto Renew' },
  { value: 'notes', label: 'Notes' },
  { value: '__skip__', label: 'Skip (Do not import)' },
];

// Fuzzy matching keywords for auto-suggest — accounts sheet
const ACCOUNT_KEYWORDS: Record<string, string[]> = {
  name: ['name', 'account', 'account_name', 'accountname', 'company', 'organization', 'organisation', 'business_name', 'businessname'],
  type: ['type', 'account_type', 'accounttype', 'b2b', 'b2c'],
  industry: ['industry', 'sector', 'vertical', 'business_type', 'businesstype'],
  website: ['website', 'web', 'url', 'site', 'homepage'],
  phone: ['phone', 'telephone', 'tel', 'phone_number', 'phonenumber', 'landline'],
  email: ['email', 'e-mail', 'mail', 'email_address', 'emailaddress'],
  addressLine1: ['address', 'street', 'address1', 'address_line_1', 'address line 1'],
  addressLine2: ['address2', 'suite', 'apt', 'address_line_2', 'address line 2'],
  city: ['city', 'town', 'municipality'],
  state: ['state', 'province', 'region'],
  postalCode: ['zip', 'postal', 'postcode', 'zip_code', 'zipcode', 'postal_code', 'postalcode'],
  country: ['country', 'nation'],
  owner: ['owner', 'assigned', 'assignee', 'rep', 'representative', 'account_owner', 'accountowner'],
  team: ['team', 'group', 'department', 'dept'],
  tags: ['tags', 'labels', 'categories'],
  annualRevenue: ['revenue', 'annual_revenue', 'annualrevenue', 'annual revenue', 'yearly_revenue'],
  employeeCount: ['employees', 'employee_count', 'employeecount', 'headcount', 'staff', 'company_size', 'companysize'],
  description: ['description', 'desc', 'notes', 'about'],
  source: ['source', 'lead_source', 'leadsource', 'channel', 'origin'],
};

// Fuzzy matching keywords for auto-suggest — contacts sheet
const CONTACT_KEYWORDS: Record<string, string[]> = {
  accountName: ['account', 'account_name', 'accountname', 'company', 'organization'],
  firstName: ['first', 'fname', 'given', 'first_name', 'firstname', 'first name'],
  lastName: ['last', 'lname', 'surname', 'family', 'last_name', 'lastname', 'last name'],
  email: ['email', 'e-mail', 'mail', 'email_address', 'emailaddress'],
  phone: ['phone', 'telephone', 'tel', 'phone_number', 'phonenumber', 'landline'],
  mobile: ['mobile', 'cell', 'cellular', 'mobile_number', 'mobilenumber', 'cellphone'],
  jobTitle: ['title', 'job', 'position', 'designation', 'job_title', 'jobtitle'],
  department: ['department', 'dept', 'division'],
  role: ['role', 'contact_role', 'contactrole'],
};

// Fuzzy matching keywords for auto-suggest — subscriptions sheet
const SUBSCRIPTION_KEYWORDS: Record<string, string[]> = {
  accountName: ['account', 'account_name', 'accountname', 'company', 'organization'],
  productName: ['product', 'product_name', 'productname', 'service', 'item', 'subscription'],
  status: ['status', 'state', 'subscription_status'],
  billingFrequency: ['billing', 'frequency', 'billing_frequency', 'billingfrequency', 'cycle', 'period', 'interval'],
  quantity: ['quantity', 'qty', 'licenses', 'seats', 'units'],
  unitPrice: ['price', 'unit_price', 'unitprice', 'amount', 'rate', 'cost'],
  discount: ['discount', 'discount_percent', 'discountpercent'],
  startDate: ['start', 'start_date', 'startdate', 'begin', 'effective_date'],
  endDate: ['end', 'end_date', 'enddate', 'expiry', 'expiration', 'expire'],
  renewalDate: ['renewal', 'renewal_date', 'renewaldate', 'renew_date'],
  autoRenew: ['auto_renew', 'autorenew', 'auto renewal', 'autorenewal'],
  notes: ['notes', 'comments', 'remarks', 'description'],
};

export interface SheetPreview {
  sheetName: string;
  headers: string[];
  totalRows: number;
  previewRows: Record<string, any>[];
  suggestedMapping: Record<string, string>;
}

@Injectable()
export class AccountImportService {
  private readonly logger = new Logger(AccountImportService.name);
  private readonly uploadDir: string;

  constructor(
    private dataSource: DataSource,
    @InjectQueue('account-import') private importQueue: Queue,
  ) {
    this.uploadDir = path.resolve(process.cwd(), 'uploads', 'imports');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // ============================================================
  // UPLOAD & PARSE
  // ============================================================
  async uploadAndParse(file: Express.Multer.File, schemaName: string, userId: string) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.xlsx', '.xls'].includes(ext)) {
      throw new BadRequestException('Account import requires a multi-sheet .xlsx or .xls file');
    }

    // Save file to uploads/imports with unique name
    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const savedFileName = `${fileId}${ext}`;
    const savedFilePath = path.join(this.uploadDir, savedFileName);

    fs.writeFileSync(savedFilePath, file.buffer);

    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });

      if (workbook.SheetNames.length < 1) {
        throw new BadRequestException('File contains no sheets');
      }

      // Detect sheets: look for accounts, contacts, subscriptions sheets
      const sheets: SheetPreview[] = [];
      const sheetTypes: Record<string, string> = {}; // sheetName → 'accounts' | 'contacts' | 'subscriptions'

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (jsonData.length < 2) continue; // skip empty sheets

        const headers: string[] = jsonData[0].map((h: any) => String(h).trim());
        const totalRows = jsonData.length - 1;

        // Preview first 5 data rows
        const previewRows = jsonData.slice(1, 6).map((row: any[]) => {
          const obj: Record<string, any> = {};
          headers.forEach((header, idx) => {
            obj[header] = row[idx] !== undefined ? String(row[idx]) : '';
          });
          return obj;
        });

        // Detect sheet type based on name or content
        const normalizedName = sheetName.toLowerCase().replace(/[^a-z0-9]/g, '');
        let detectedType = 'unknown';
        let keywordsMap: Record<string, string[]> = {};

        if (normalizedName.includes('account') || normalizedName.includes('company') || normalizedName.includes('organization')) {
          detectedType = 'accounts';
          keywordsMap = ACCOUNT_KEYWORDS;
        } else if (normalizedName.includes('contact') || normalizedName.includes('people') || normalizedName.includes('person')) {
          detectedType = 'contacts';
          keywordsMap = CONTACT_KEYWORDS;
        } else if (normalizedName.includes('subscription') || normalizedName.includes('product') || normalizedName.includes('license')) {
          detectedType = 'subscriptions';
          keywordsMap = SUBSCRIPTION_KEYWORDS;
        } else {
          // Fallback: detect by column headers
          const headerStr = headers.join(' ').toLowerCase();
          if (headerStr.includes('billing') || headerStr.includes('subscription') || headerStr.includes('unit price')) {
            detectedType = 'subscriptions';
            keywordsMap = SUBSCRIPTION_KEYWORDS;
          } else if (headerStr.includes('first name') || headerStr.includes('last name') || headerStr.includes('job title')) {
            detectedType = 'contacts';
            keywordsMap = CONTACT_KEYWORDS;
          } else {
            detectedType = 'accounts';
            keywordsMap = ACCOUNT_KEYWORDS;
          }
        }

        sheetTypes[sheetName] = detectedType;

        // Add custom fields to keywords map for auto-suggest
        if (detectedType === 'accounts' || detectedType === 'contacts') {
          const customFields = await this.getCustomFields(schemaName, detectedType === 'accounts' ? 'accounts' : 'contacts');
          for (const cf of customFields) {
            const fieldKey = cf.value; // e.g. customField:my_field
            const label = cf.label.replace(' (Custom)', '').toLowerCase();
            keywordsMap[fieldKey] = [label, label.replace(/\s+/g, '_'), label.replace(/\s+/g, '')];
          }
        }

        const suggestedMapping = this.autoSuggestMapping(headers, keywordsMap);

        sheets.push({
          sheetName,
          headers,
          totalRows,
          previewRows,
          suggestedMapping,
        });
      }

      if (sheets.length === 0) {
        throw new BadRequestException('No valid data sheets found in the file');
      }

      return {
        fileId,
        fileName: file.originalname,
        filePath: savedFilePath,
        fileSize: file.size,
        sheetCount: sheets.length,
        sheets,
        sheetTypes,
        accountFieldOptions: [...ACCOUNT_FIELDS, ...await this.getCustomFields(schemaName, 'accounts')],
        contactFieldOptions: [...CONTACT_FIELDS, ...await this.getCustomFields(schemaName, 'contacts')],
        subscriptionFieldOptions: SUBSCRIPTION_FIELDS,
      };
    } catch (err: any) {
      if (fs.existsSync(savedFilePath)) {
        fs.unlinkSync(savedFilePath);
      }
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Failed to parse file: ${err.message}`);
    }
  }

  // ============================================================
  // START IMPORT
  // ============================================================
  async startImport(schemaName: string, userId: string, dto: {
    fileId: string;
    accountMapping?: Record<string, string>;
    contactMapping?: Record<string, string>;
    subscriptionMapping?: Record<string, string>;
    sheetMappings?: Record<string, { sheetName: string; columnMapping: Record<string, string> }>;
    duplicateStrategy?: 'skip' | 'update' | 'import';
    assignmentStrategy?: 'specific_user' | 'unassigned';
    ownerId?: string;
    countryCode?: string;
    tags?: string[];
  }) {
    // Verify file exists
    const files = fs.readdirSync(this.uploadDir);
    const matchingFile = files.find(f => f.startsWith(dto.fileId));
    if (!matchingFile) {
      throw new BadRequestException('Upload file not found. Please re-upload the file.');
    }

    const filePath = path.join(this.uploadDir, matchingFile);

    // Parse to get total rows across all sheets
    const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
    let totalRows = 0;
    for (const wsName of workbook.SheetNames) {
      const sheet = workbook.Sheets[wsName];
      if (sheet) {
        const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        totalRows += Math.max(0, jsonData.length - 1);
      }
    }

    const settings = {
      duplicateStrategy: dto.duplicateStrategy || 'skip',
      assignmentStrategy: dto.assignmentStrategy || 'unassigned',
      ownerId: dto.ownerId || null,
      countryCode: dto.countryCode || 'US',
      tags: dto.tags || [],
    };

    // Build column mapping — support both flat format and sheetMappings format
    const columnMapping = dto.sheetMappings || {
      accounts: dto.accountMapping || {},
      contacts: dto.contactMapping || {},
      subscriptions: dto.subscriptionMapping || {},
    };

    const [job] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".import_jobs (
        type, status, file_name, file_path, file_size,
        total_records, column_mapping, settings, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        'account_import',
        'pending',
        matchingFile,
        filePath,
        fs.statSync(filePath).size,
        totalRows,
        JSON.stringify(columnMapping),
        JSON.stringify(settings),
        userId,
      ],
    );

    // Queue the Bull job
    await this.importQueue.add('import', {
      jobId: job.id,
      schemaName,
      userId,
    }, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });

    return this.formatJob(job);
  }

  // ============================================================
  // JOB MANAGEMENT
  // ============================================================
  async getJobs(schemaName: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const jobs = await this.dataSource.query(
      `SELECT j.*, u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM "${schemaName}".import_jobs j
       LEFT JOIN "${schemaName}".users u ON u.id = j.created_by
       WHERE j.type = 'account_import'
       ORDER BY j.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".import_jobs WHERE type = 'account_import'`,
    );

    return {
      data: jobs.map((j: any) => this.formatJob(j)),
      meta: {
        total: parseInt(count, 10),
        page,
        limit,
        totalPages: Math.ceil(parseInt(count, 10) / limit),
      },
    };
  }

  async getJobDetail(schemaName: string, jobId: string) {
    const [job] = await this.dataSource.query(
      `SELECT j.*, u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM "${schemaName}".import_jobs j
       LEFT JOIN "${schemaName}".users u ON u.id = j.created_by
       WHERE j.id = $1 AND j.type = 'account_import'`,
      [jobId],
    );

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    return this.formatJob(job);
  }

  async cancelJob(schemaName: string, jobId: string, userId: string) {
    const [job] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".import_jobs WHERE id = $1 AND type = 'account_import'`,
      [jobId],
    );

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    if (!['pending', 'processing'].includes(job.status)) {
      throw new BadRequestException('Only pending or processing jobs can be cancelled');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".import_jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [jobId],
    );

    // Try to remove from Bull queue if still pending
    const bullJobs = await this.importQueue.getJobs(['waiting', 'active', 'delayed']);
    for (const bj of bullJobs) {
      if (bj.data?.jobId === jobId) {
        await bj.remove();
        break;
      }
    }

    return { message: 'Job cancelled' };
  }

  async generateFailedFile(schemaName: string, jobId: string) {
    const [job] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".import_jobs WHERE id = $1 AND type = 'account_import'`,
      [jobId],
    );

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    const failedRows = job.failed_rows || [];
    if (failedRows.length === 0) {
      throw new BadRequestException('No failed records to download');
    }

    const wb = XLSX.utils.book_new();

    // Group failed rows by sheet
    const bySheet: Record<string, any[]> = {};
    for (const fr of failedRows) {
      const sheet = fr.sheet || 'Unknown';
      if (!bySheet[sheet]) bySheet[sheet] = [];
      bySheet[sheet].push(fr);
    }

    for (const [sheetName, rows] of Object.entries(bySheet)) {
      if (rows.length === 0) continue;

      // Collect all data keys from failed rows
      const allKeys = new Set<string>();
      for (const r of rows) {
        if (r.data) {
          Object.keys(r.data).forEach(k => allKeys.add(k));
        }
      }
      const dataHeaders = Array.from(allKeys);

      const wsData: any[][] = [];
      wsData.push([...dataHeaders, 'Row Number', 'Import Error']);

      for (const fr of rows) {
        const row: any[] = dataHeaders.map(h => fr.data?.[h] ?? '');
        row.push(fr.row || '');
        row.push((fr.errors || []).join('; '));
        wsData.push(row);
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, `Failed - ${sheetName}`.substring(0, 31));
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName: `failed-account-import-${jobId.substring(0, 8)}.xlsx`,
    };
  }

  // ============================================================
  // TEMPLATE DOWNLOAD
  // ============================================================
  async downloadTemplate() {
    const wb = XLSX.utils.book_new();

    // Accounts sheet
    const accountHeaders = ACCOUNT_FIELDS
      .filter(f => f.value !== '__skip__')
      .map(f => f.label);
    const accountSample = [
      'Acme Corp', 'B2B', 'Technology', 'https://acme.com', '+1-555-0100',
      'info@acme.com', '123 Main St', 'Suite 200', 'San Francisco', 'CA',
      '94105', 'USA', 'John Smith', 'Sales Team', 'enterprise,tech',
      '5000000', '250', 'Leading technology provider', 'Referral',
    ];
    const accountNotes = [
      'Required', 'B2B or B2C', '', '', '', '', '', '', '', '', '', '',
      'User full name or email', 'Team name', 'Comma-separated', 'Number',
      'Number', '', '',
    ];
    const accountWsData = [accountHeaders, accountSample, accountNotes];
    const accountWs = XLSX.utils.aoa_to_sheet(accountWsData);
    XLSX.utils.book_append_sheet(wb, accountWs, 'Accounts');

    // Contacts sheet
    const contactHeaders = CONTACT_FIELDS
      .filter(f => f.value !== '__skip__')
      .map(f => f.label);
    const contactSample = [
      'Acme Corp', 'Jane', 'Doe', 'jane@acme.com', '+1-555-0101',
      '+1-555-0102', 'VP Engineering', 'Engineering', 'Decision Maker',
    ];
    const contactNotes = [
      'Must match Account Name', '', '', '', '', '', '', '', '',
    ];
    const contactWsData = [contactHeaders, contactSample, contactNotes];
    const contactWs = XLSX.utils.aoa_to_sheet(contactWsData);
    XLSX.utils.book_append_sheet(wb, contactWs, 'Contacts');

    // Subscriptions sheet
    const subHeaders = SUBSCRIPTION_FIELDS
      .filter(f => f.value !== '__skip__')
      .map(f => f.label);
    const subSample = [
      'Acme Corp', 'Enterprise Plan', 'active', 'monthly', '10',
      '99.99', '10', '2024-01-01', '2024-12-31', '2024-12-01',
      'yes', 'Annual enterprise subscription',
    ];
    const subNotes = [
      'Must match Account Name', 'Required - auto-creates if not found',
      'active/trial/expired', 'monthly/quarterly/annually', 'Number',
      'Number', 'Percentage 0-100', 'YYYY-MM-DD', 'YYYY-MM-DD', 'YYYY-MM-DD',
      'yes/no/true/false', '',
    ];
    const subWsData = [subHeaders, subSample, subNotes];
    const subWs = XLSX.utils.aoa_to_sheet(subWsData);
    XLSX.utils.book_append_sheet(wb, subWs, 'Subscriptions');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName: 'account-import-template.xlsx',
    };
  }

  // ============================================================
  // FIELD OPTIONS
  // ============================================================
  async getFieldOptions(schemaName: string) {
    const accountCustomFields = await this.getCustomFields(schemaName, 'accounts');
    const contactCustomFields = await this.getCustomFields(schemaName, 'contacts');
    return {
      accounts: [...ACCOUNT_FIELDS, ...accountCustomFields],
      contacts: [...CONTACT_FIELDS, ...contactCustomFields],
      subscriptions: SUBSCRIPTION_FIELDS,
    };
  }

  // ============================================================
  // MAPPING TEMPLATES
  // ============================================================
  async getTemplates(schemaName: string) {
    const rows = await this.dataSource.query(
      `SELECT id, name, column_mapping, file_headers, settings, is_default, created_at
       FROM "${schemaName}".import_mapping_templates
       WHERE type = 'account_import'
       ORDER BY is_default DESC, created_at DESC`,
    );
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      columnMapping: r.column_mapping,
      fileHeaders: r.file_headers,
      settings: r.settings,
      isDefault: r.is_default,
      createdAt: r.created_at,
    }));
  }

  async saveTemplate(schemaName: string, userId: string, dto: { name: string; columnMapping: any; fileHeaders?: string[]; settings?: any }) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".import_mapping_templates (name, type, column_mapping, file_headers, settings, created_by)
       VALUES ($1, 'account_import', $2::jsonb, $3, $4::jsonb, $5)
       RETURNING id, name, created_at`,
      [dto.name, JSON.stringify(dto.columnMapping), dto.fileHeaders || [], JSON.stringify(dto.settings || {}), userId],
    );
    return { id: row.id, name: row.name, createdAt: row.created_at };
  }

  async updateTemplate(schemaName: string, templateId: string, dto: { name?: string; columnMapping?: any; settings?: any }) {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (dto.name) { sets.push(`name = $${idx++}`); params.push(dto.name); }
    if (dto.columnMapping) { sets.push(`column_mapping = $${idx++}::jsonb`); params.push(JSON.stringify(dto.columnMapping)); }
    if (dto.settings) { sets.push(`settings = $${idx++}::jsonb`); params.push(JSON.stringify(dto.settings)); }
    sets.push(`updated_at = NOW()`);
    params.push(templateId);

    await this.dataSource.query(
      `UPDATE "${schemaName}".import_mapping_templates SET ${sets.join(', ')} WHERE id = $${idx} AND type = 'account_import'`,
      params,
    );
    return { success: true };
  }

  async deleteTemplate(schemaName: string, templateId: string) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".import_mapping_templates WHERE id = $1 AND type = 'account_import'`,
      [templateId],
    );
    return { success: true };
  }

  private async getCustomFields(schemaName: string, module: string): Promise<any[]> {
    try {
      const rows = await this.dataSource.query(
        `SELECT field_key, field_label, field_type, is_required
         FROM "${schemaName}".custom_field_definitions
         WHERE module = $1 AND is_active = true
         ORDER BY display_order ASC`,
        [module],
      );
      return rows.map((cf: any) => ({
        value: `customField:${cf.field_key}`,
        label: `${cf.field_label} (Custom)`,
        required: cf.is_required,
      }));
    } catch {
      return [];
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private autoSuggestMapping(
    headers: string[],
    keywordsMap: Record<string, string[]>,
  ): Record<string, string> {
    const mapping: Record<string, string> = {};

    for (const header of headers) {
      const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      let bestMatch = '__skip__';

      for (const [field, keywords] of Object.entries(keywordsMap)) {
        for (const keyword of keywords) {
          const normalizedKeyword = keyword.replace(/[^a-z0-9]/g, '');
          if (normalized === normalizedKeyword || normalized.includes(normalizedKeyword)) {
            bestMatch = field;
            break;
          }
        }
        if (bestMatch !== '__skip__') break;
      }

      mapping[header] = bestMatch;
    }

    return mapping;
  }

  private formatJob(job: any) {
    const percentComplete = job.total_records > 0
      ? Math.round((job.processed_records / job.total_records) * 100)
      : 0;

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      fileName: job.file_name,
      fileSize: job.file_size,
      totalRecords: job.total_records,
      processedRecords: job.processed_records,
      importedRecords: job.imported_records,
      skippedRecords: job.skipped_records,
      failedRecords: job.failed_records,
      duplicateRecords: job.duplicate_records,
      columnMapping: job.column_mapping,
      settings: job.settings,
      failedRowCount: (job.failed_rows || []).length,
      errorMessage: job.error_message,
      percentComplete,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      createdBy: job.created_by,
      creatorName: job.creator_first_name
        ? `${job.creator_first_name} ${job.creator_last_name}`
        : undefined,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    };
  }
}
