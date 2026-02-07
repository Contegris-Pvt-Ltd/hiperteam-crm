import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateContactDto, UpdateContactDto, QueryContactsDto } from './dto';
import { formatPhoneE164 } from '../../common/utils/phone.util';
import { calculateProfileCompletion } from '../../common/utils/profile-completion.util';

@Injectable()
export class ContactsService {
  constructor(private dataSource: DataSource) {}

  async create(schemaName: string, userId: string, dto: CreateContactDto) {
    const country = dto.country || 'PK';
    
    // Calculate profile completion before insert
    const profileData = this.buildProfileDataFromDto(dto);
    const { percentage } = calculateProfileCompletion(profileData);

    const [contact] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".contacts 
       (first_name, last_name, email, phone, mobile, company, job_title, website,
        address_line1, address_line2, city, state, postal_code, country,
        source, lead_source_details, tags, notes, custom_fields, social_profiles,
        do_not_contact, do_not_email, do_not_call, account_id, owner_id, created_by, profile_completion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
       RETURNING *`,
      [
        dto.firstName,
        dto.lastName,
        dto.email?.toLowerCase() || null,
        dto.phone ? formatPhoneE164(dto.phone, country) : null,
        dto.mobile ? formatPhoneE164(dto.mobile, country) : null,
        dto.company || null,
        dto.jobTitle || null,
        dto.website || null,
        dto.addressLine1 || null,
        dto.addressLine2 || null,
        dto.city || null,
        dto.state || null,
        dto.postalCode || null,
        dto.country || null,
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
        percentage,
      ],
    );

    return this.formatContact(contact);
  }

  async findAll(schemaName: string, query: QueryContactsDto) {
    const { search, status, company, tag, ownerId, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC' } = query;
    const offset = (page - 1) * limit;

    let whereClause = 'c.deleted_at IS NULL';
    const params: unknown[] = [];
    let paramIndex = 1;

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

    const allowedSortFields = ['created_at', 'updated_at', 'first_name', 'last_name', 'email', 'company', 'profile_completion'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const countQuery = `SELECT COUNT(*) FROM "${schemaName}".contacts c WHERE ${whereClause}`;
    const [{ count }] = await this.dataSource.query(countQuery, params);

    const dataQuery = `
      SELECT c.*, 
             u.first_name as owner_first_name, 
             u.last_name as owner_last_name
      FROM "${schemaName}".contacts c
      LEFT JOIN "${schemaName}".users u ON c.owner_id = u.id
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

  async findOne(schemaName: string, id: string) {
    const [contact] = await this.dataSource.query(
      `SELECT c.*, 
              u.first_name as owner_first_name, 
              u.last_name as owner_last_name
       FROM "${schemaName}".contacts c
       LEFT JOIN "${schemaName}".users u ON c.owner_id = u.id
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id],
    );

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return this.formatContact(contact, true);
  }

  async update(schemaName: string, id: string, dto: UpdateContactDto) {
    // First get the existing contact
    const existing = await this.findOne(schemaName, id);
    const country = dto.country || (existing.country as string) || 'PK';

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

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
        } else {
          params.push(value);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return existing;
    }

    // Recalculate profile completion with merged data
    const mergedData = { ...existing, ...dto };
    const profileData = this.buildProfileDataFromRecord(mergedData);
    const { percentage } = calculateProfileCompletion(profileData);

    updates.push(`profile_completion = $${paramIndex}`);
    params.push(percentage);
    paramIndex++;

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

    return this.formatContact(contact, true);
  }

  async remove(schemaName: string, id: string) {
    const [contact] = await this.dataSource.query(
      `UPDATE "${schemaName}".contacts 
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id],
    );

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return { message: 'Contact deleted successfully' };
  }

  async getProfileCompletionDetails(schemaName: string, id: string) {
    const contact = await this.findOne(schemaName, id);
    const profileData = this.buildProfileDataFromRecord(contact);
    return calculateProfileCompletion(profileData);
  }

  private buildProfileDataFromDto(dto: CreateContactDto): Record<string, unknown> {
    return {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      mobile: dto.mobile,
      company: dto.company,
      jobTitle: dto.jobTitle,
      website: dto.website,
      addressLine1: dto.addressLine1,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      postalCode: dto.postalCode,
      source: dto.source,
      socialProfiles: dto.socialProfiles || {},
    };
  }

  private buildProfileDataFromRecord(data: Record<string, unknown>): Record<string, unknown> {
    return {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      mobile: data.mobile,
      company: data.company,
      jobTitle: data.jobTitle,
      website: data.website,
      addressLine1: data.addressLine1,
      city: data.city,
      state: data.state,
      country: data.country,
      postalCode: data.postalCode,
      source: data.source,
      socialProfiles: data.socialProfiles || {},
    };
  }

  private formatContact(contact: Record<string, unknown>, includeCompletionDetails = false): Record<string, unknown> {
    const formatted: Record<string, unknown> = {
      id: contact.id,
      firstName: contact.first_name,
      lastName: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      mobile: contact.mobile,
      company: contact.company,
      jobTitle: contact.job_title,
      website: contact.website,
      addressLine1: contact.address_line1,
      addressLine2: contact.address_line2,
      city: contact.city,
      state: contact.state,
      postalCode: contact.postal_code,
      country: contact.country,
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
      profileCompletion: contact.profile_completion,
      accountId: contact.account_id,
      ownerId: contact.owner_id,
      owner: contact.owner_first_name
        ? { firstName: contact.owner_first_name, lastName: contact.owner_last_name }
        : null,
      createdBy: contact.created_by,
      lastActivityAt: contact.last_activity_at,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    };

    if (includeCompletionDetails) {
      const profileData = this.buildProfileDataFromRecord(formatted);
      const completionDetails = calculateProfileCompletion(profileData);
      formatted.profileCompletionDetails = completionDetails;
    }

    return formatted;
  }
}