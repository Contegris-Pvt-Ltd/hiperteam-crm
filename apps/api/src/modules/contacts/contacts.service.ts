import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateContactDto, UpdateContactDto, QueryContactsDto } from './dto';
import { formatPhoneE164 } from '../../common/utils/phone.util';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { DataAccessService } from '../shared/data-access.service';
import { ProfileCompletionService } from '../admin/profile-completion.service';
import { CustomFieldsService } from '../admin/custom-fields.service';
import { FieldValidationService } from '../shared/field-validation.service';

@Injectable()
export class ContactsService {
  private readonly trackedFields = [
    'firstName', 'lastName', 'email', 'phone', 'mobile', 'avatarUrl',
    'company', 'jobTitle', 'website', 'emails', 'phones', 'addresses',
    'socialProfiles', 'status', 'tags', 'customFields', 'ownerId',
    'doNotContact', 'doNotEmail', 'doNotCall',
  ];

  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
    private activityService: ActivityService,
    private dataAccessService: DataAccessService,
    private profileCompletionService: ProfileCompletionService,
    private customFieldsService: CustomFieldsService,
    private fieldValidationService: FieldValidationService,
  ) {}

  async create(schemaName: string, userId: string, dto: CreateContactDto) {
    // ── Field validation (tenant-configurable rules) ──
    await this.fieldValidationService.validate(schemaName, 'contacts', {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      mobile: dto.mobile,
      company: dto.company,
      jobTitle: dto.jobTitle,
      website: dto.website,
    }, dto.customFields as Record<string, any>);

    const country = dto.country || 'PK';

    // Format phones in the phones array
    const formattedPhones = dto.phones?.map(p => ({
      ...p,
      number: formatPhoneE164(p.number, country) || p.number,
    })) || [];

    const [contact] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".contacts 
       (first_name, last_name, email, phone, mobile, avatar_url,
        company, job_title, website,
        address_line1, address_line2, city, state, postal_code, country,
        emails, phones, addresses,
        source, lead_source_details, tags, notes, custom_fields, social_profiles,
        do_not_contact, do_not_email, do_not_call, account_id, owner_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
       RETURNING *`,
      [
        dto.firstName,
        dto.lastName,
        dto.email?.toLowerCase() || null,
        dto.phone ? formatPhoneE164(dto.phone, country) : null,
        dto.mobile ? formatPhoneE164(dto.mobile, country) : null,
        dto.avatarUrl || null,
        dto.company || null,
        dto.jobTitle || null,
        dto.website || null,
        dto.addressLine1 || null,
        dto.addressLine2 || null,
        dto.city || null,
        dto.state || null,
        dto.postalCode || null,
        dto.country || null,
        JSON.stringify(dto.emails || []),
        JSON.stringify(formattedPhones),
        JSON.stringify(dto.addresses || []),
        dto.source || null,
        dto.leadSourceDetails || {},
        dto.tags || [],
        dto.notes || null,
        dto.customFields || {},
        dto.socialProfiles || {},
        dto.doNotContact || false,
        dto.doNotEmail || false,
        dto.doNotCall || false,
        dto.accountId || null,
        dto.ownerId || userId,
        userId,
      ],
    );

    const formatted = this.formatContact(contact);

    // Log activity
    await this.activityService.create(schemaName, {
      entityType: 'contacts',
      entityId: contact.id,
      activityType: 'created',
      title: 'Contact created',
      description: `Contact "${dto.firstName} ${dto.lastName}" was created`,
      performedBy: userId,
    });

    // Audit log
    await this.auditService.log(schemaName, {
      entityType: 'contacts',
      entityId: contact.id,
      action: 'create',
      changes: {},
      newValues: formatted,
      performedBy: userId,
    });

    return formatted;
  }

  async findAll(schemaName: string, query: QueryContactsDto, userId?: string) {
    const { search, status, company, tag, ownerId, accountId, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = query;
    const offset = (page - 1) * limit;

    let whereClause = 'c.deleted_at IS NULL';
    const params: unknown[] = [];
    let paramIndex = 1;

    // ── Record-level access filtering ──
    if (userId) {
      const accessLevel = await this.dataAccessService.getAccessLevel(schemaName, userId, 'contacts');
      if (accessLevel !== 'all') {
        const filter = await this.dataAccessService.buildAccessFilter(
          { userId, tenantSchema: schemaName, module: 'contacts', accessLevel },
          'c.owner_id',
          paramIndex,
        );
        whereClause += ` AND ${filter.whereClause}`;
        params.push(...filter.params);
        paramIndex += filter.params.length;
      }
    }

    if (search) {
      whereClause += ` AND (c.first_name ILIKE $${paramIndex} OR c.last_name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.company ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (company) {
      whereClause += ` AND c.company ILIKE $${paramIndex}`;
      params.push(`%${company}%`);
      paramIndex++;
    }

    if (tag) {
      whereClause += ` AND $${paramIndex} = ANY(c.tags)`;
      params.push(tag);
      paramIndex++;
    }

    if (ownerId) {
      whereClause += ` AND c.owner_id = $${paramIndex}`;
      params.push(ownerId);
      paramIndex++;
    }

    if (accountId) {
      whereClause += ` AND c.account_id = $${paramIndex}`;
      params.push(accountId);
      paramIndex++;
    }

    const allowedSortFields = ['created_at', 'updated_at', 'first_name', 'last_name', 'email', 'company'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const countQuery = `SELECT COUNT(*) FROM "${schemaName}".contacts c WHERE ${whereClause}`;
    const [{ count }] = await this.dataSource.query(countQuery, params);

    const dataQuery = `
      SELECT c.*, 
             u.first_name as owner_first_name, 
             u.last_name as owner_last_name,
             a.name as account_name
      FROM "${schemaName}".contacts c
      LEFT JOIN "${schemaName}".users u ON c.owner_id = u.id
      LEFT JOIN "${schemaName}".accounts a ON c.account_id = a.id
      WHERE ${whereClause}
      ORDER BY c.${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const contacts = await this.dataSource.query(dataQuery, params);

    return {
      data: contacts.map((c: Record<string, unknown>) => this.formatContact(c)),
      meta: {
        total: parseInt(count),
        page,
        limit,
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  }

  private async findOneRaw(schemaName: string, id: string): Promise<Record<string, unknown>> {
    const [contact] = await this.dataSource.query(
      `SELECT c.*, 
              u.first_name as owner_first_name, 
              u.last_name as owner_last_name,
              a.name as account_name,
              a.logo_url as account_logo_url,
              a.industry as account_industry
      FROM "${schemaName}".contacts c
      LEFT JOIN "${schemaName}".users u ON c.owner_id = u.id
      LEFT JOIN "${schemaName}".accounts a ON c.account_id = a.id
      WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id],
    );

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return this.formatContact(contact);
  }

  async findOne(schemaName: string, id: string) {
    const formatted = await this.findOneRaw(schemaName, id);

    // Calculate profile completion
    const config = await this.profileCompletionService.getConfig(schemaName, 'contacts');
    let profileCompletion = null;

    if (config?.isEnabled) {
      const customFields = await this.customFieldsService.findByModule(schemaName, 'contacts');
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

  async update(schemaName: string, id: string, userId: string, dto: UpdateContactDto) {
    const existing = await this.findOneRaw(schemaName, id);
    const country = dto.country || (existing.country as string) || 'PK';

    // Format phones in the phones array if provided
    if (dto.phones) {
      dto.phones = dto.phones.map(p => ({
        ...p,
        number: formatPhoneE164(p.number, country) || p.number,
      }));
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      mobile: 'mobile',
      avatarUrl: 'avatar_url',
      company: 'company',
      jobTitle: 'job_title',
      website: 'website',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      city: 'city',
      state: 'state',
      postalCode: 'postal_code',
      country: 'country',
      emails: 'emails',
      phones: 'phones',
      addresses: 'addresses',
      source: 'source',
      leadSourceDetails: 'lead_source_details',
      status: 'status',
      tags: 'tags',
      notes: 'notes',
      customFields: 'custom_fields',
      socialProfiles: 'social_profiles',
      doNotContact: 'do_not_contact',
      doNotEmail: 'do_not_email',
      doNotCall: 'do_not_call',
      accountId: 'account_id',
      ownerId: 'owner_id',
    };

    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && fieldMap[key]) {
        updates.push(`${fieldMap[key]} = $${paramIndex}`);

        if (key === 'phone' || key === 'mobile') {
          params.push(formatPhoneE164(value as string, country));
        } else if (key === 'email') {
          params.push((value as string).toLowerCase());
        } else if (['emails', 'phones', 'addresses'].includes(key)) {
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

    const [contact] = await this.dataSource.query(
      `UPDATE "${schemaName}".contacts 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      params,
    );

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const formatted = this.formatContact(contact);

    // Calculate changes for audit
    const changes = this.auditService.calculateChanges(existing, formatted, this.trackedFields);

    if (Object.keys(changes).length > 0) {
      await this.activityService.create(schemaName, {
        entityType: 'contacts',
        entityId: id,
        activityType: 'updated',
        title: 'Contact updated',
        description: `Updated: ${Object.keys(changes).join(', ')}`,
        metadata: { changedFields: Object.keys(changes) },
        performedBy: userId,
      });

      await this.auditService.log(schemaName, {
        entityType: 'contacts',
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
      `UPDATE "${schemaName}".contacts SET deleted_at = NOW() WHERE id = $1`,
      [id],
    );

    await this.activityService.create(schemaName, {
      entityType: 'contacts',
      entityId: id,
      activityType: 'deleted',
      title: 'Contact deleted',
      description: `Contact "${existing.firstName} ${existing.lastName}" was deleted`,
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'contacts',
      entityId: id,
      action: 'delete',
      changes: {},
      previousValues: existing,
      performedBy: userId,
    });

    return { message: 'Contact deleted successfully' };
  }

  async getAccounts(schemaName: string, contactId: string) {
    const accounts = await this.dataSource.query(
      `SELECT a.id, a.name, a.logo_url, a.website, a.industry, ca.role, ca.is_primary
       FROM "${schemaName}".accounts a
       INNER JOIN "${schemaName}".contact_accounts ca ON a.id = ca.account_id
       WHERE ca.contact_id = $1 AND a.deleted_at IS NULL
       ORDER BY ca.is_primary DESC, a.name ASC`,
      [contactId],
    );

    return accounts.map((a: Record<string, unknown>) => ({
      id: a.id,
      name: a.name,
      logoUrl: a.logo_url,
      website: a.website,
      industry: a.industry,
      role: a.role,
      isPrimary: a.is_primary,
    }));
  }

  async linkAccount(
    schemaName: string,
    contactId: string,
    accountId: string,
    role: string,
    isPrimary: boolean,
    userId: string,
  ) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".contact_accounts (contact_id, account_id, role, is_primary)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (contact_id, account_id) 
       DO UPDATE SET role = $3, is_primary = $4`,
      [contactId, accountId, role || null, isPrimary || false],
    );

    await this.activityService.create(schemaName, {
      entityType: 'contacts',
      entityId: contactId,
      activityType: 'account_linked',
      title: 'Account linked',
      relatedType: 'accounts',
      relatedId: accountId,
      performedBy: userId,
    });

    return { message: 'Account linked successfully' };
  }

  async unlinkAccount(schemaName: string, contactId: string, accountId: string, userId: string) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".contact_accounts WHERE contact_id = $1 AND account_id = $2`,
      [contactId, accountId],
    );

    await this.activityService.create(schemaName, {
      entityType: 'contacts',
      entityId: contactId,
      activityType: 'account_unlinked',
      title: 'Account unlinked',
      relatedType: 'accounts',
      relatedId: accountId,
      performedBy: userId,
    });

    return { message: 'Account unlinked successfully' };
  }

  private formatContact(contact: Record<string, unknown>): Record<string, unknown> {
    return {
      id: contact.id,
      firstName: contact.first_name,
      lastName: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      mobile: contact.mobile,
      avatarUrl: contact.avatar_url,
      company: contact.company,
      jobTitle: contact.job_title,
      website: contact.website,
      addressLine1: contact.address_line1,
      addressLine2: contact.address_line2,
      city: contact.city,
      state: contact.state,
      postalCode: contact.postal_code,
      country: contact.country,
      emails: typeof contact.emails === 'string' ? JSON.parse(contact.emails) : (contact.emails || []),
      phones: typeof contact.phones === 'string' ? JSON.parse(contact.phones) : (contact.phones || []),
      addresses: typeof contact.addresses === 'string' ? JSON.parse(contact.addresses) : (contact.addresses || []),
      source: contact.source,
      leadSourceDetails: contact.lead_source_details,
      status: contact.status,
      tags: contact.tags,
      notes: contact.notes,
      customFields: contact.custom_fields,
      socialProfiles: contact.social_profiles,
      doNotContact: contact.do_not_contact,
      doNotEmail: contact.do_not_email,
      doNotCall: contact.do_not_call,
      accountId: contact.account_id,
      account: contact.account_name
        ? { 
            id: contact.account_id, 
            name: contact.account_name,
            logoUrl: contact.account_logo_url,
            industry: contact.account_industry,
          }
        : null,
      ownerId: contact.owner_id,
      owner: contact.owner_first_name
        ? { id: contact.owner_id, firstName: contact.owner_first_name, lastName: contact.owner_last_name }
        : null,
      createdBy: contact.created_by,
      lastActivityAt: contact.last_activity_at,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    };
  }
}