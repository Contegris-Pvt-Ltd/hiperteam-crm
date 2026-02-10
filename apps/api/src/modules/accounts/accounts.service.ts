import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateAccountDto, UpdateAccountDto, QueryAccountsDto } from './dto';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { ProfileCompletionService } from '../admin/profile-completion.service';
import { CustomFieldsService } from '../admin/custom-fields.service';

@Injectable()
export class AccountsService {
  private readonly trackedFields = [
    'name', 'logoUrl', 'website', 'industry', 'companySize', 'annualRevenue',
    'description', 'emails', 'phones', 'addresses', 'socialProfiles',
    'parentAccountId', 'accountType', 'status', 'tags', 'customFields', 'ownerId',
  ];

  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
    private activityService: ActivityService,
    private profileCompletionService: ProfileCompletionService,
    private customFieldsService: CustomFieldsService,
  ) {}

  async create(schemaName: string, userId: string, dto: CreateAccountDto) {
    const [account] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".accounts 
       (name, logo_url, website, industry, company_size, annual_revenue, description,
        emails, phones, addresses, social_profiles, parent_account_id, account_type,
        tags, custom_fields, source, owner_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        dto.name,
        dto.logoUrl || null,
        dto.website || null,
        dto.industry || null,
        dto.companySize || null,
        dto.annualRevenue || null,
        dto.description || null,
        JSON.stringify(dto.emails || []),
        JSON.stringify(dto.phones || []),
        JSON.stringify(dto.addresses || []),
        dto.socialProfiles || {},
        dto.parentAccountId || null,
        dto.accountType || 'prospect',
        dto.tags || [],
        dto.customFields || {},
        dto.source || null,
        dto.ownerId || userId,
        userId,
      ],
    );

    const formatted = this.formatAccount(account);

    // Log activity
    await this.activityService.create(schemaName, {
      entityType: 'accounts',
      entityId: account.id,
      activityType: 'created',
      title: 'Account created',
      description: `Account "${dto.name}" was created`,
      performedBy: userId,
    });

    // Audit log
    await this.auditService.log(schemaName, {
      entityType: 'accounts',
      entityId: account.id,
      action: 'create',
      changes: {},
      newValues: formatted,
      performedBy: userId,
    });

    return formatted;
  }

  async findAll(schemaName: string, query: QueryAccountsDto) {
    const {
      search, status, accountType, industry, tag, ownerId, parentAccountId,
      page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC'
    } = query;
    const offset = (page - 1) * limit;

    let whereClause = 'a.deleted_at IS NULL';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (a.name ILIKE $${paramIndex} OR a.website ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (accountType) {
      whereClause += ` AND a.account_type = $${paramIndex}`;
      params.push(accountType);
      paramIndex++;
    }

    if (industry) {
      whereClause += ` AND a.industry = $${paramIndex}`;
      params.push(industry);
      paramIndex++;
    }

    if (tag) {
      whereClause += ` AND $${paramIndex} = ANY(a.tags)`;
      params.push(tag);
      paramIndex++;
    }

    if (ownerId) {
      whereClause += ` AND a.owner_id = $${paramIndex}`;
      params.push(ownerId);
      paramIndex++;
    }

    if (parentAccountId) {
      whereClause += ` AND a.parent_account_id = $${paramIndex}`;
      params.push(parentAccountId);
      paramIndex++;
    }

    const allowedSortFields = ['created_at', 'updated_at', 'name', 'industry', 'account_type'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const countQuery = `SELECT COUNT(*) FROM "${schemaName}".accounts a WHERE ${whereClause}`;
    const [{ count }] = await this.dataSource.query(countQuery, params);

    const dataQuery = `
      SELECT a.*, 
             u.first_name as owner_first_name, 
             u.last_name as owner_last_name,
             pa.name as parent_account_name,
             (SELECT COUNT(*) FROM "${schemaName}".contact_accounts ca WHERE ca.account_id = a.id) as contacts_count
      FROM "${schemaName}".accounts a
      LEFT JOIN "${schemaName}".users u ON a.owner_id = u.id
      LEFT JOIN "${schemaName}".accounts pa ON a.parent_account_id = pa.id
      WHERE ${whereClause}
      ORDER BY a.${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const accounts = await this.dataSource.query(dataQuery, params);

    return {
      data: accounts.map((a: Record<string, unknown>) => this.formatAccount(a)),
      meta: {
        total: parseInt(count),
        page,
        limit,
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  }

  private async findOneRaw(schemaName: string, id: string): Promise<Record<string, unknown>> {
    const [account] = await this.dataSource.query(
        `SELECT a.*, 
                u.first_name as owner_first_name, 
                u.last_name as owner_last_name,
                pa.name as parent_account_name,
                pa.logo_url as parent_account_logo_url,
                pa.industry as parent_account_industry,
                (SELECT COUNT(*) FROM "${schemaName}".contact_accounts ca WHERE ca.account_id = a.id) as contacts_count
        FROM "${schemaName}".accounts a
        LEFT JOIN "${schemaName}".users u ON a.owner_id = u.id
        LEFT JOIN "${schemaName}".accounts pa ON a.parent_account_id = pa.id
        WHERE a.id = $1 AND a.deleted_at IS NULL`,
        [id],
    );

    if (!account) {
        throw new NotFoundException('Account not found');
    }

    return this.formatAccount(account);
    }

  async findOne(schemaName: string, id: string) {
    const formatted = await this.findOneRaw(schemaName, id);

    // Calculate profile completion
    const config = await this.profileCompletionService.getConfig(schemaName, 'accounts');
    let profileCompletion = null;

    if (config?.isEnabled) {
        const customFields = await this.customFieldsService.findByModule(schemaName, 'accounts');
        profileCompletion = this.profileCompletionService.calculateCompletion(
        formatted,
        config.fieldWeights,
        customFields
            .filter(f => f.includeInCompletion)
            .map(f => ({
            fieldKey: f.fieldKey,
            completionWeight: f.completionWeight,
            fieldLabel: f.fieldLabel,
            })),
        );
    }

    return {
        ...formatted,
        profileCompletion,
    };
    }
  async update(schemaName: string, id: string, userId: string, dto: UpdateAccountDto) {
    const existing = await this.findOneRaw(schemaName, id);

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      name: 'name',
      logoUrl: 'logo_url',
      website: 'website',
      industry: 'industry',
      companySize: 'company_size',
      annualRevenue: 'annual_revenue',
      description: 'description',
      emails: 'emails',
      phones: 'phones',
      addresses: 'addresses',
      socialProfiles: 'social_profiles',
      parentAccountId: 'parent_account_id',
      accountType: 'account_type',
      status: 'status',
      tags: 'tags',
      customFields: 'custom_fields',
      source: 'source',
      ownerId: 'owner_id',
    };

    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && fieldMap[key]) {
        updates.push(`${fieldMap[key]} = $${paramIndex}`);
        if (['emails', 'phones', 'addresses'].includes(key)) {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const [account] = await this.dataSource.query(
      `UPDATE "${schemaName}".accounts 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      params,
    );

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const formatted = this.formatAccount(account);

    // Calculate changes
    const changes = this.auditService.calculateChanges(existing, formatted, this.trackedFields);

    if (Object.keys(changes).length > 0) {
      await this.activityService.create(schemaName, {
        entityType: 'accounts',
        entityId: id,
        activityType: 'updated',
        title: 'Account updated',
        description: `Updated: ${Object.keys(changes).join(', ')}`,
        metadata: { changedFields: Object.keys(changes) },
        performedBy: userId,
      });

      await this.auditService.log(schemaName, {
        entityType: 'accounts',
        entityId: id,
        action: 'update',
        changes,
        previousValues: existing,
        newValues: formatted,
        performedBy: userId,
      });
    }

    return formatted;
  }

  async remove(schemaName: string, id: string, userId: string) {
    const existing = await this.findOneRaw(schemaName, id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".accounts SET deleted_at = NOW() WHERE id = $1`,
      [id],
    );

    await this.activityService.create(schemaName, {
      entityType: 'accounts',
      entityId: id,
      activityType: 'deleted',
      title: 'Account deleted',
      description: `Account "${existing.name}" was deleted`,
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'accounts',
      entityId: id,
      action: 'delete',
      changes: {},
      previousValues: existing,
      performedBy: userId,
    });

    return { message: 'Account deleted successfully' };
  }

  async getContacts(schemaName: string, accountId: string) {
    const contacts = await this.dataSource.query(
      `SELECT c.*, ca.role, ca.is_primary
       FROM "${schemaName}".contacts c
       INNER JOIN "${schemaName}".contact_accounts ca ON c.id = ca.contact_id
       WHERE ca.account_id = $1 AND c.deleted_at IS NULL
       ORDER BY ca.is_primary DESC, c.first_name ASC`,
      [accountId],
    );

    return contacts.map((c: Record<string, unknown>) => ({
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone,
      jobTitle: c.job_title,
      avatarUrl: c.avatar_url,
      role: c.role,
      isPrimary: c.is_primary,
    }));
  }

  async linkContact(
    schemaName: string,
    accountId: string,
    contactId: string,
    role: string,
    isPrimary: boolean,
    userId: string,
  ) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".contact_accounts (account_id, contact_id, role, is_primary)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (contact_id, account_id) 
       DO UPDATE SET role = $3, is_primary = $4`,
      [accountId, contactId, role || null, isPrimary || false],
    );

    await this.activityService.create(schemaName, {
      entityType: 'accounts',
      entityId: accountId,
      activityType: 'contact_linked',
      title: 'Contact linked',
      relatedType: 'contacts',
      relatedId: contactId,
      performedBy: userId,
    });

    return { message: 'Contact linked successfully' };
  }

  async unlinkContact(schemaName: string, accountId: string, contactId: string, userId: string) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".contact_accounts WHERE account_id = $1 AND contact_id = $2`,
      [accountId, contactId],
    );

    await this.activityService.create(schemaName, {
      entityType: 'accounts',
      entityId: accountId,
      activityType: 'contact_unlinked',
      title: 'Contact unlinked',
      relatedType: 'contacts',
      relatedId: contactId,
      performedBy: userId,
    });

    return { message: 'Contact unlinked successfully' };
  }

  async getChildAccounts(schemaName: string, parentId: string) {
    const accounts = await this.dataSource.query(
      `SELECT id, name, logo_url, website, industry, account_type, status
       FROM "${schemaName}".accounts
       WHERE parent_account_id = $1 AND deleted_at IS NULL
       ORDER BY name ASC`,
      [parentId],
    );

    return accounts.map((a: Record<string, unknown>) => ({
      id: a.id,
      name: a.name,
      logoUrl: a.logo_url,
      website: a.website,
      industry: a.industry,
      accountType: a.account_type,
      status: a.status,
    }));
  }

  private formatAccount(account: Record<string, unknown>): Record<string, unknown> {
    return {
      id: account.id,
      name: account.name,
      logoUrl: account.logo_url,
      website: account.website,
      industry: account.industry,
      companySize: account.company_size,
      annualRevenue: account.annual_revenue,
      description: account.description,
      emails: typeof account.emails === 'string' ? JSON.parse(account.emails) : account.emails,
      phones: typeof account.phones === 'string' ? JSON.parse(account.phones) : account.phones,
      addresses: typeof account.addresses === 'string' ? JSON.parse(account.addresses) : account.addresses,
      socialProfiles: account.social_profiles,
      parentAccountId: account.parent_account_id,
      parentAccount: account.parent_account_name
        ? { 
            id: account.parent_account_id, 
            name: account.parent_account_name,
            logoUrl: account.parent_account_logo_url,
            industry: account.parent_account_industry,
            }
        : null,
      accountType: account.account_type,
      status: account.status,
      tags: account.tags,
      customFields: account.custom_fields,
      source: account.source,
      ownerId: account.owner_id,
      owner: account.owner_first_name
        ? { id: account.owner_id, firstName: account.owner_first_name, lastName: account.owner_last_name }
        : null,
      contactsCount: parseInt(account.contacts_count as string) || 0,
      createdBy: account.created_by,
      lastActivityAt: account.last_activity_at,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    };
  }
}