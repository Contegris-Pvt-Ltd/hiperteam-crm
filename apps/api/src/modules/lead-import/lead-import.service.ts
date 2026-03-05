import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { StartImportDto } from './dto/start-import.dto';
import { SaveTemplateDto } from './dto/save-template.dto';

// Lead fields available for mapping
export const LEAD_FIELD_OPTIONS = [
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'company', label: 'Company' },
  { value: 'jobTitle', label: 'Job Title' },
  { value: 'website', label: 'Website' },
  { value: 'addressLine1', label: 'Address Line 1' },
  { value: 'addressLine2', label: 'Address Line 2' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'postalCode', label: 'Postal Code' },
  { value: 'country', label: 'Country' },
  { value: 'tags', label: 'Tags' },
  { value: 'source', label: 'Source' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'stage', label: 'Stage' },
  { value: 'priority', label: 'Priority' },
  { value: 'owner', label: 'Owner' },
  { value: 'team', label: 'Team' },
  { value: 'product', label: 'Product' },
  { value: 'teamMembers', label: 'Record Team Members' },
  { value: '__skip__', label: 'Skip (Do not import)' },
];

// Fuzzy matching keywords for auto-suggest
const FIELD_KEYWORDS: Record<string, string[]> = {
  firstName: ['first', 'fname', 'given', 'first_name', 'first name', 'firstname'],
  lastName: ['last', 'lname', 'surname', 'family', 'last_name', 'last name', 'lastname'],
  email: ['email', 'e-mail', 'mail', 'email_address', 'emailaddress'],
  phone: ['phone', 'telephone', 'tel', 'phone_number', 'phonenumber', 'landline'],
  mobile: ['mobile', 'cell', 'cellular', 'mobile_number', 'mobilenumber', 'cellphone'],
  company: ['company', 'organization', 'org', 'business', 'company_name', 'companyname', 'organisation'],
  jobTitle: ['title', 'job', 'position', 'designation', 'role', 'job_title', 'jobtitle'],
  website: ['website', 'web', 'url', 'site', 'homepage'],
  addressLine1: ['address', 'street', 'address1', 'address_line_1', 'address line 1'],
  addressLine2: ['address2', 'suite', 'apt', 'address_line_2', 'address line 2'],
  city: ['city', 'town', 'municipality'],
  state: ['state', 'province', 'region'],
  postalCode: ['zip', 'postal', 'postcode', 'zip_code', 'zipcode', 'postal_code', 'postalcode'],
  country: ['country', 'nation'],
  tags: ['tags', 'labels', 'categories'],
  source: ['source', 'lead_source', 'leadsource', 'channel', 'origin'],
  pipeline: ['pipeline', 'pipe', 'funnel', 'workflow'],
  stage: ['stage', 'status', 'step', 'phase', 'pipeline_stage', 'pipelinestage'],
  priority: ['priority', 'urgency', 'importance', 'prio'],
  owner: ['owner', 'assigned', 'assignee', 'agent', 'rep', 'representative', 'salesperson', 'assigned_to', 'assignedto'],
  team: ['team', 'group', 'department', 'dept'],
  product: ['product', 'item', 'service', 'offering', 'product_name', 'productname'],
  teamMembers: ['team_members', 'teammembers', 'team members', 'record_team', 'recordteam', 'members', 'collaborators'],
};

@Injectable()
export class LeadImportService {
  private readonly logger = new Logger(LeadImportService.name);
  private readonly uploadDir: string;

  constructor(
    private dataSource: DataSource,
    @InjectQueue('lead-import') private importQueue: Queue,
  ) {
    this.uploadDir = path.resolve(process.cwd(), 'uploads', 'imports');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // ============================================================
  // UPLOAD & PARSE
  // ============================================================
  async uploadAndParse(file: Express.Multer.File, schemaName: string, _userId: string) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      throw new BadRequestException('Unsupported file format. Please upload .xlsx, .xls, or .csv');
    }

    // Save file to uploads/imports with unique name
    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const savedFileName = `${fileId}${ext}`;
    const savedFilePath = path.join(this.uploadDir, savedFileName);

    fs.writeFileSync(savedFilePath, file.buffer);

    try {
      // Parse the file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new BadRequestException('File contains no sheets');
      }

      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (jsonData.length < 2) {
        throw new BadRequestException('File must contain at least a header row and one data row');
      }

      const headers: string[] = jsonData[0].map((h: any) => String(h).trim());
      const totalRows = jsonData.length - 1; // exclude header

      // Preview first 5 data rows
      const previewRows = jsonData.slice(1, 6).map((row: any[]) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx] !== undefined ? String(row[idx]) : '';
        });
        return obj;
      });

      // Fetch tenant custom fields for leads
      const customFields = await this.getCustomFields(schemaName);
      // Fetch qualification fields from the default/active framework
      const qualificationFields = await this.getQualificationFields(schemaName);
      const allFieldOptions = [
        ...LEAD_FIELD_OPTIONS.filter(o => o.value !== '__skip__'),
        ...qualificationFields.map((qf: any) => ({
          value: `qualification:${qf.field_key}`,
          label: `${qf.field_label} (Qualification)`,
        })),
        ...customFields.map((cf: any) => ({
          value: `customField:${cf.field_key}`,
          label: `${cf.field_label} (Custom)`,
        })),
        { value: '__skip__', label: 'Skip (Do not import)' },
      ];

      // Build extended keywords map including custom fields and qualification fields
      const extendedKeywords = { ...FIELD_KEYWORDS };
      for (const qf of qualificationFields) {
        const key = `qualification:${qf.field_key}`;
        const keywords = [
          qf.field_key.toLowerCase(),
          qf.field_label.toLowerCase(),
          qf.field_key.toLowerCase().replace(/_/g, ''),
          qf.field_label.toLowerCase().replace(/[^a-z0-9]/g, ''),
        ];
        extendedKeywords[key] = keywords;
      }
      for (const cf of customFields) {
        const key = `customField:${cf.field_key}`;
        const keywords = [
          cf.field_key.toLowerCase(),
          cf.field_label.toLowerCase(),
          cf.field_key.toLowerCase().replace(/_/g, ''),
          cf.field_label.toLowerCase().replace(/[^a-z0-9]/g, ''),
        ];
        extendedKeywords[key] = keywords;
      }

      // Auto-suggest mappings
      const suggestedMapping = this.autoSuggestMapping(headers, extendedKeywords);

      // Check for matching templates
      const matchingTemplates = await this.findMatchingTemplates(schemaName, headers);

      return {
        fileId,
        fileName: file.originalname,
        filePath: savedFilePath,
        fileSize: file.size,
        headers,
        totalRows,
        previewRows,
        suggestedMapping,
        matchingTemplates,
        leadFieldOptions: allFieldOptions,
      };
    } catch (err: any) {
      // Clean up file on parse error
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
  async startImport(dto: StartImportDto, schemaName: string, userId: string) {
    // Verify file exists
    const files = fs.readdirSync(this.uploadDir);
    const matchingFile = files.find(f => f.startsWith(dto.fileId));
    if (!matchingFile) {
      throw new BadRequestException('Upload file not found. Please re-upload the file.');
    }

    const filePath = path.join(this.uploadDir, matchingFile);

    // Parse to get total rows
    const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const totalRows = jsonData.length - 1;

    // Create import job record
    const settings = {
      duplicateStrategy: dto.duplicateStrategy,
      assignmentStrategy: dto.assignmentStrategy,
      ownerId: dto.ownerId || null,
      countryCode: dto.countryCode,
      pipelineId: dto.pipelineId || null,
      stageId: dto.stageId || null,
      source: dto.source || null,
      priorityId: dto.priorityId || null,
      teamId: dto.teamId || null,
      tags: dto.tags || [],
    };

    const [job] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".import_jobs (
        type, status, file_name, file_path, file_size,
        total_records, column_mapping, settings, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        'leads',
        'pending',
        matchingFile,
        filePath,
        fs.statSync(filePath).size,
        totalRows,
        JSON.stringify(dto.columnMapping),
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
  async getJobs(schemaName: string, userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const jobs = await this.dataSource.query(
      `SELECT j.*, u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM "${schemaName}".import_jobs j
       LEFT JOIN "${schemaName}".users u ON u.id = j.created_by
       ORDER BY j.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".import_jobs`,
    );

    return {
      data: jobs.map((j: any) => this.formatJob(j)),
      meta: { total: parseInt(count, 10), page, limit },
    };
  }

  async getJobDetail(schemaName: string, jobId: string) {
    const [job] = await this.dataSource.query(
      `SELECT j.*, u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM "${schemaName}".import_jobs j
       LEFT JOIN "${schemaName}".users u ON u.id = j.created_by
       WHERE j.id = $1`,
      [jobId],
    );

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    return this.formatJob(job);
  }

  async cancelJob(schemaName: string, jobId: string) {
    const [job] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".import_jobs WHERE id = $1`,
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
      `SELECT * FROM "${schemaName}".import_jobs WHERE id = $1`,
      [jobId],
    );

    if (!job) {
      throw new NotFoundException('Import job not found');
    }

    const failedRows = job.failed_rows || [];
    if (failedRows.length === 0) {
      throw new BadRequestException('No failed records to download');
    }

    // Build Excel from failed rows
    const columnMapping = job.column_mapping || {};
    const fileHeaders = Object.keys(columnMapping);

    const wsData: any[][] = [];
    // Header row: original columns + Import Error
    wsData.push([...fileHeaders, 'Import Error']);

    for (const fr of failedRows) {
      const row: any[] = fileHeaders.map(h => fr.data?.[h] ?? '');
      row.push((fr.errors || []).join('; '));
      wsData.push(row);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Failed Records');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName: `failed-records-${jobId.substring(0, 8)}.xlsx`,
    };
  }

  // ============================================================
  // TEMPLATE MANAGEMENT
  // ============================================================
  async getTemplates(schemaName: string, type = 'leads') {
    const templates = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".import_mapping_templates
       WHERE type = $1
       ORDER BY is_default DESC, name ASC`,
      [type],
    );

    return templates.map((t: any) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      columnMapping: t.column_mapping,
      fileHeaders: t.file_headers,
      settings: t.settings,
      isDefault: t.is_default,
      createdBy: t.created_by,
      createdAt: t.created_at,
    }));
  }

  async saveTemplate(dto: SaveTemplateDto, schemaName: string, userId: string) {
    const [template] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".import_mapping_templates (
        name, type, column_mapping, file_headers, settings, is_default, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        dto.name,
        'leads',
        JSON.stringify(dto.columnMapping),
        dto.fileHeaders || [],
        JSON.stringify(dto.settings || {}),
        dto.isDefault || false,
        userId,
      ],
    );

    return {
      id: template.id,
      name: template.name,
      type: template.type,
      columnMapping: template.column_mapping,
      fileHeaders: template.file_headers,
      settings: template.settings,
      isDefault: template.is_default,
    };
  }

  async updateTemplate(schemaName: string, templateId: string, dto: SaveTemplateDto) {
    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".import_mapping_templates WHERE id = $1`,
      [templateId],
    );

    if (!existing) {
      throw new NotFoundException('Template not found');
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".import_mapping_templates SET
        name = $1, column_mapping = $2, file_headers = $3, settings = $4, is_default = $5, updated_at = NOW()
       WHERE id = $6`,
      [
        dto.name,
        JSON.stringify(dto.columnMapping),
        dto.fileHeaders || [],
        JSON.stringify(dto.settings || {}),
        dto.isDefault || false,
        templateId,
      ],
    );

    return { message: 'Template updated' };
  }

  async deleteTemplate(schemaName: string, templateId: string) {
    const result = await this.dataSource.query(
      `DELETE FROM "${schemaName}".import_mapping_templates WHERE id = $1 RETURNING id`,
      [templateId],
    );

    if (!result.length) {
      throw new NotFoundException('Template not found');
    }

    return { message: 'Template deleted' };
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private autoSuggestMapping(
    headers: string[],
    keywordsMap: Record<string, string[]> = FIELD_KEYWORDS,
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

  private async getQualificationFields(schemaName: string): Promise<any[]> {
    try {
      return await this.dataSource.query(
        `SELECT qf.field_key, qf.field_label, qf.field_type, qf.field_options
         FROM "${schemaName}".lead_qualification_fields qf
         JOIN "${schemaName}".lead_qualification_frameworks f ON f.id = qf.framework_id
         WHERE f.is_active = true
         ORDER BY f.sort_order ASC, qf.sort_order ASC`,
      );
    } catch {
      return [];
    }
  }

  private async getCustomFields(schemaName: string): Promise<any[]> {
    try {
      return await this.dataSource.query(
        `SELECT field_key, field_label, field_type, is_required
         FROM "${schemaName}".custom_field_definitions
         WHERE module = 'leads' AND is_active = true
         ORDER BY display_order ASC`,
      );
    } catch {
      return [];
    }
  }

  private async findMatchingTemplates(schemaName: string, headers: string[]) {
    const templates = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".import_mapping_templates WHERE type = 'leads'`,
    );

    return templates
      .filter((t: any) => {
        const savedHeaders: string[] = t.file_headers || [];
        if (savedHeaders.length === 0) return false;
        // Match if 80%+ of headers overlap
        const overlap = savedHeaders.filter((h: string) => headers.includes(h));
        return overlap.length >= savedHeaders.length * 0.8;
      })
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        columnMapping: t.column_mapping,
        settings: t.settings,
      }));
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
