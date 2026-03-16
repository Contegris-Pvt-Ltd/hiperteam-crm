// ============================================================
// FILE: apps/api/src/modules/scheduling/scheduling.service.ts
// ============================================================
import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { EmailService } from '../email/email.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly calendarSyncService: CalendarSyncService,
  ) {}

  // ── List meeting booking forms owned by a user ─────────────
  async listBookingForms(schemaName: string, userId: string) {
    const rows = await this.dataSource.query(
      `SELECT f.*,
              COUNT(fb.id) FILTER (WHERE fb.status = 'confirmed') AS confirmed_count
       FROM "${schemaName}".forms f
       LEFT JOIN "${schemaName}".form_bookings fb ON fb.form_id = f.id
       WHERE f.type = 'meeting_booking'
         AND f.created_by = $1
         AND f.deleted_at IS NULL
       GROUP BY f.id
       ORDER BY f.created_at DESC`,
      [userId],
    );
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      token: r.token,
      tenantSlug: r.tenant_slug,
      meetingConfig: typeof r.meeting_config === 'string'
        ? JSON.parse(r.meeting_config) : (r.meeting_config || {}),
      confirmedCount: parseInt(r.confirmed_count || '0', 10),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  // ── Get availability windows for a form ────────────────────
  async getAvailability(schemaName: string, formId: string) {
    return this.dataSource.query(
      `SELECT * FROM "${schemaName}".form_booking_availability
       WHERE form_id = $1 AND is_active = true
       ORDER BY day_of_week ASC, start_time ASC`,
      [formId],
    );
  }

  // ── Save availability (full replace) ──────────────────────
  async saveAvailability(
    schemaName: string,
    formId: string,
    windows: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean }>,
  ) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".form_booking_availability WHERE form_id = $1`,
      [formId],
    );
    for (const w of windows) {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".form_booking_availability
           (form_id, day_of_week, start_time, end_time, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        [formId, w.dayOfWeek, w.startTime, w.endTime, w.isActive ?? true],
      );
    }
    return { saved: true };
  }

  // ── Available dates for a calendar month ──────────────────
  async getAvailableDates(
    schemaName: string,
    formId: string,
    year: number,
    month: number,
  ) {
    const [form] = await this.dataSource.query(
      `SELECT meeting_config FROM "${schemaName}".forms
       WHERE id = $1 AND type = 'meeting_booking' AND deleted_at IS NULL`,
      [formId],
    );
    if (!form) throw new NotFoundException('Booking form not found');

    const cfg = typeof form.meeting_config === 'string'
      ? JSON.parse(form.meeting_config) : (form.meeting_config || {});
    const maxDaysAhead: number = cfg.maxDaysAhead ?? 60;

    const availability = await this.dataSource.query(
      `SELECT DISTINCT day_of_week FROM "${schemaName}".form_booking_availability
       WHERE form_id = $1 AND is_active = true`,
      [formId],
    );
    const activeDays = new Set(availability.map((a: any) => Number(a.day_of_week)));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today.getTime() + maxDaysAhead * 86400000);

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const cursor = new Date(firstDay);
    const availableDates: string[] = [];

    while (cursor <= lastDay) {
      if (cursor >= today && cursor <= maxDate && activeDays.has(cursor.getDay())) {
        availableDates.push(cursor.toISOString().split('T')[0]);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return { year, month, availableDates };
  }

  // ── Available time slots for a specific date ───────────────
  async getAvailableSlots(schemaName: string, formId: string, dateStr: string) {
    const [form] = await this.dataSource.query(
      `SELECT meeting_config, created_by FROM "${schemaName}".forms
       WHERE id = $1 AND type = 'meeting_booking' AND deleted_at IS NULL`,
      [formId],
    );
    if (!form) throw new NotFoundException('Booking form not found');

    const cfg = typeof form.meeting_config === 'string'
      ? JSON.parse(form.meeting_config) : (form.meeting_config || {});

    const durationMins: number = cfg.durationMinutes ?? 30;
    const bufferBefore: number = cfg.bufferBefore ?? 0;
    const bufferAfter: number = cfg.bufferAfter ?? 0;
    const minNoticeMs: number = (cfg.minNoticeHours ?? 1) * 3600000;
    const availabilityMode: string = cfg.availabilityMode ?? 'custom';

    const requestedDate = new Date(`${dateStr}T00:00:00`);
    const dayOfWeek = requestedDate.getDay();
    const now = Date.now();

    if (availabilityMode === 'custom') {
      // Original logic — use form_booking_availability
      const windows = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".form_booking_availability
         WHERE form_id = $1 AND day_of_week = $2 AND is_active = true`,
        [formId, dayOfWeek],
      );
      if (!windows.length) return { date: dateStr, slots: [] };

      const existingBookings = await this.dataSource.query(
        `SELECT start_time, end_time FROM "${schemaName}".form_bookings
         WHERE form_id = $1 AND status = 'confirmed'
           AND start_time::date = $2::date`,
        [formId, dateStr],
      );

      return {
        date: dateStr,
        slots: this.computeSlots(
          windows, existingBookings, requestedDate,
          durationMins, bufferBefore, bufferAfter, minNoticeMs, now, null,
        ),
      };
    }

    // 'user' or 'team' mode — use user_availability
    const userIds: string[] = availabilityMode === 'team'
      ? (cfg.assignedUserIds || [form.created_by]).filter(Boolean)
      : [form.created_by];

    if (!userIds.length) return { date: dateStr, slots: [] };

    // Build a map: slotISO → userId[] (all users free at that slot)
    const slotHostMap = new Map<string, string[]>();

    for (const userId of userIds) {
      const windows = await this.dataSource.query(
        `SELECT start_time, end_time FROM "${schemaName}".user_availability
         WHERE user_id = $1 AND day_of_week = $2 AND is_active = true`,
        [userId, dayOfWeek],
      );
      if (!windows.length) continue;

      const existingBookings = await this.dataSource.query(
        `SELECT start_time, end_time FROM "${schemaName}".form_bookings
         WHERE host_user_id = $1 AND status = 'confirmed'
           AND start_time::date = $2::date`,
        [userId, dateStr],
      );

      const freeSlots = this.computeSlots(
        windows, existingBookings, requestedDate,
        durationMins, bufferBefore, bufferAfter, minNoticeMs, now, null,
      );

      for (const slot of freeSlots) {
        const key = typeof slot === 'string' ? slot : (slot as any).time;
        const arr = slotHostMap.get(key) || [];
        arr.push(userId);
        slotHostMap.set(key, arr);
      }
    }

    // Load booking counts this month per user for load balancing
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const bookingCounts = new Map<string, number>();
    if (userIds.length > 1) {
      const rows = await this.dataSource.query(
        `SELECT host_user_id, COUNT(*)::int AS cnt
         FROM "${schemaName}".form_bookings
         WHERE host_user_id = ANY($1)
           AND status = 'confirmed'
           AND start_time >= $2
         GROUP BY host_user_id`,
        [userIds, monthStart.toISOString()],
      );
      for (const r of rows) bookingCounts.set(r.host_user_id, r.cnt);
    }

    // Build final slot list with assigned host (lowest count among available)
    const slots = Array.from(slotHostMap.entries()).map(([time, availableUsers]) => {
      let assignedUser = availableUsers[0];
      if (availableUsers.length > 1) {
        assignedUser = availableUsers.reduce((best, uid) =>
          (bookingCounts.get(uid) || 0) < (bookingCounts.get(best) || 0) ? uid : best,
        );
      }
      return { time, assignedUserId: assignedUser };
    });

    slots.sort((a, b) => a.time.localeCompare(b.time));

    return { date: dateStr, slots };
  }

  private computeSlots(
    windows: any[],
    existingBookings: any[],
    requestedDate: Date,
    durationMins: number,
    bufferBefore: number,
    bufferAfter: number,
    minNoticeMs: number,
    now: number,
    _hostUserId: string | null,
  ): string[] {
    const slots: string[] = [];

    for (const w of windows) {
      const [sh, sm] = (w.start_time as string).split(':').map(Number);
      const [eh, em] = (w.end_time as string).split(':').map(Number);

      const cursor = new Date(requestedDate.getTime());
      cursor.setHours(sh, sm, 0, 0);
      const windowEnd = new Date(requestedDate.getTime());
      windowEnd.setHours(eh, em, 0, 0);

      while (true) {
        const slotStart = new Date(cursor.getTime());
        const slotEnd = new Date(cursor.getTime() + durationMins * 60000);
        if (slotEnd > windowEnd) break;

        if (slotStart.getTime() - now < minNoticeMs) {
          cursor.setTime(cursor.getTime() + durationMins * 60000);
          continue;
        }

        const buffStart = new Date(slotStart.getTime() - bufferBefore * 60000);
        const buffEnd = new Date(slotEnd.getTime() + bufferAfter * 60000);

        const conflict = existingBookings.some((b: any) => {
          const bS = new Date(b.start_time);
          const bE = new Date(b.end_time);
          return buffStart < bE && buffEnd > bS;
        });

        if (!conflict) slots.push(slotStart.toISOString());
        cursor.setTime(cursor.getTime() + durationMins * 60000);
      }
    }

    return slots;
  }

  // ── Create booking (public) ────────────────────────────────
  async createBooking(
    schemaName: string,
    formId: string,
    dto: {
      startTime: string;
      timezone: string;
      inviteeName: string;
      inviteeEmail: string;
      inviteePhone?: string;
      inviteeNotes?: string;
      answers?: Record<string, any>;
      preferredUserId?: string; // for invitee_choice mode
    },
  ) {
    const [form] = await this.dataSource.query(
      `SELECT f.*, f.tenant_slug,
              u.id AS owner_id, u.email AS owner_email,
              u.first_name || ' ' || u.last_name AS host_name
       FROM "${schemaName}".forms f
       LEFT JOIN "${schemaName}".users u ON u.id = f.created_by
       WHERE f.id = $1 AND f.type = 'meeting_booking'
         AND f.status = 'active' AND f.deleted_at IS NULL`,
      [formId],
    );
    if (!form) throw new NotFoundException('Booking form not found or inactive');

    const cfg = typeof form.meeting_config === 'string'
      ? JSON.parse(form.meeting_config) : (form.meeting_config || {});

    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + (cfg.durationMinutes ?? 30) * 60000);

    // ── Determine host user ──────────────────────────────────
    let hostUserId: string = form.owner_id;

    const availabilityMode: string = cfg.availabilityMode ?? 'custom';

    if (availabilityMode === 'team' && cfg.assignedUserIds?.length) {
      // Re-run load-balance check at booking time
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Find which assigned users are still free for this slot
      const dayOfWeek = startTime.getDay();
      const dateStr = startTime.toISOString().split('T')[0];
      const freeUsers: string[] = [];

      for (const uid of cfg.assignedUserIds as string[]) {
        const windows = await this.dataSource.query(
          `SELECT start_time, end_time FROM "${schemaName}".user_availability
           WHERE user_id = $1 AND day_of_week = $2 AND is_active = true`,
          [uid, dayOfWeek],
        );

        const existingBookings = await this.dataSource.query(
          `SELECT start_time, end_time FROM "${schemaName}".form_bookings
           WHERE host_user_id = $1 AND status = 'confirmed'
             AND start_time::date = $2::date`,
          [uid, dateStr],
        );

        const bufferBefore = cfg.bufferBefore ?? 0;
        const bufferAfter = cfg.bufferAfter ?? 0;
        const buffStart = new Date(startTime.getTime() - bufferBefore * 60000);
        const buffEnd = new Date(endTime.getTime() + bufferAfter * 60000);

        const inWindow = windows.some((w: any) => {
          const [sh, sm] = (w.start_time as string).split(':').map(Number);
          const [eh, em] = (w.end_time as string).split(':').map(Number);
          const wStart = new Date(startTime); wStart.setHours(sh, sm, 0, 0);
          const wEnd = new Date(startTime); wEnd.setHours(eh, em, 0, 0);
          return startTime >= wStart && endTime <= wEnd;
        });

        if (!inWindow) continue;

        const conflict = existingBookings.some((b: any) => {
          const bS = new Date(b.start_time);
          const bE = new Date(b.end_time);
          return buffStart < bE && buffEnd > bS;
        });

        if (!conflict) freeUsers.push(uid);
      }

      if (!freeUsers.length) {
        throw new BadRequestException('This time slot is no longer available');
      }

      // Load balance: pick user with fewest bookings this month
      const rows = await this.dataSource.query(
        `SELECT host_user_id, COUNT(*)::int AS cnt
         FROM "${schemaName}".form_bookings
         WHERE host_user_id = ANY($1) AND status = 'confirmed' AND start_time >= $2
         GROUP BY host_user_id`,
        [freeUsers, monthStart.toISOString()],
      );
      const countMap = new Map(rows.map((r: any) => [r.host_user_id, r.cnt]));
      hostUserId = freeUsers.reduce((best, uid) =>
        (countMap.get(uid) || 0) < (countMap.get(best) || 0) ? uid : best,
      );
    } else if (availabilityMode === 'user') {
      hostUserId = dto.preferredUserId || form.owner_id;
    }

    // ── Conflict check for chosen host ───────────────────────
    const conflict = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".form_bookings
       WHERE host_user_id = $1 AND status = 'confirmed'
         AND start_time < $2 AND end_time > $3`,
      [hostUserId, endTime.toISOString(), startTime.toISOString()],
    );
    if (conflict.length) {
      throw new BadRequestException('This time slot is no longer available');
    }

    // ── Get actual host details ───────────────────────────────
    const [hostUser] = await this.dataSource.query(
      `SELECT first_name || ' ' || last_name AS host_name, email AS host_email
       FROM "${schemaName}".users WHERE id = $1`,
      [hostUserId],
    );

    const cancelToken = randomBytes(24).toString('hex');
    const rescheduleToken = randomBytes(24).toString('hex');

    const [booking] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".form_bookings
         (form_id, host_user_id, invitee_name, invitee_email, invitee_phone,
          invitee_notes, answers, start_time, end_time, timezone,
          location_type, location_value, cancel_token, reschedule_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        formId, hostUserId,
        dto.inviteeName, dto.inviteeEmail,
        dto.inviteePhone || null, dto.inviteeNotes || null,
        JSON.stringify(dto.answers || {}),
        startTime.toISOString(), endTime.toISOString(), dto.timezone,
        cfg.locationType || null, cfg.locationValue || null,
        cancelToken, rescheduleToken,
      ],
    );

    // ── Google Calendar event + Meet link ─────────────────────
    let meetLink: string | null = null;
    let googleCalendarEventId: string | null = null;

    try {
      const calResult = await this.calendarSyncService.createBookingEvent(
        schemaName,
        hostUserId,
        {
          title: `${form.name} — ${dto.inviteeName}`,
          description: [
            `Meeting booked via "${form.name}"`,
            dto.inviteeNotes ? `Notes: ${dto.inviteeNotes}` : '',
          ].filter(Boolean).join('\n'),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          timezone: dto.timezone,
          inviteeEmail: dto.inviteeEmail,
          inviteeName: dto.inviteeName,
          location: cfg.locationValue || undefined,
        },
      );
      meetLink = calResult.meetLink;
      googleCalendarEventId = calResult.googleEventId;

      if (meetLink || googleCalendarEventId) {
        await this.dataSource.query(
          `UPDATE "${schemaName}".form_bookings
           SET meet_link = $2, google_calendar_event_id = $3
           WHERE id = $1`,
          [booking.id, meetLink, googleCalendarEventId],
        );
      }
    } catch (err: any) {
      this.logger.warn(`Google Calendar/Meet creation failed for booking ${booking.id}: ${err.message}`);
    }

    // ── CRM actions ──────────────────────────────────────────
    let crmLeadId: string | null = null;
    let crmContactId: string | null = null;
    let crmTaskId: string | null = null;

    try {
      const nameParts = dto.inviteeName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      if (cfg.crmAction === 'create_lead') {
        const [lead] = await this.dataSource.query(
          `INSERT INTO "${schemaName}".leads
             (first_name, last_name, email, phone, source, status)
           VALUES ($1,$2,$3,$4,'meeting_booking','new')
           RETURNING id`,
          [firstName, lastName, dto.inviteeEmail, dto.inviteePhone || null],
        );
        crmLeadId = lead?.id || null;
      } else if (cfg.crmAction === 'create_contact') {
        const [contact] = await this.dataSource.query(
          `INSERT INTO "${schemaName}".contacts
             (first_name, last_name, email, phone)
           VALUES ($1,$2,$3,$4)
           RETURNING id`,
          [firstName, lastName, dto.inviteeEmail, dto.inviteePhone || null],
        );
        crmContactId = contact?.id || null;
      }

      const [task] = await this.dataSource.query(
        `INSERT INTO "${schemaName}".tasks
           (title, description, due_date, start_date,
            assigned_to, owner_id,
            related_entity_type, related_entity_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$5)
         RETURNING id`,
        [
          `Meeting: ${dto.inviteeName}`,
          `Booked via "${form.name}".\nNotes: ${dto.inviteeNotes || 'None'}${meetLink ? `\nMeet: ${meetLink}` : ''}`,
          endTime.toISOString(), startTime.toISOString(),
          hostUserId,
          crmLeadId ? 'leads' : (crmContactId ? 'contacts' : null),
          crmLeadId || crmContactId || null,
        ],
      );
      crmTaskId = task?.id || null;

      await this.dataSource.query(
        `UPDATE "${schemaName}".form_bookings
         SET crm_lead_id=$2, crm_contact_id=$3, crm_task_id=$4
         WHERE id=$1`,
        [booking.id, crmLeadId, crmContactId, crmTaskId],
      );
    } catch (err: any) {
      this.logger.warn(`CRM actions failed for booking ${booking.id}: ${err.message}`);
    }

    // ── Confirmation emails ──────────────────────────────────
    const enrichedForm = {
      ...form,
      owner_id: hostUserId,
      owner_email: hostUser?.host_email || form.owner_email,
      host_name: hostUser?.host_name || form.host_name,
    };

    try {
      await this.sendInviteeConfirmation(
        enrichedForm,
        { ...booking, meet_link: meetLink },
        cfg,
        cancelToken,
      );
      await this.sendHostNotification(enrichedForm, { ...booking, meet_link: meetLink });
    } catch (err: any) {
      this.logger.warn(`Emails failed for booking ${booking.id}: ${err.message}`);
    }

    return this.formatBooking({
      ...booking,
      meet_link: meetLink,
      google_calendar_event_id: googleCalendarEventId,
      crm_lead_id: crmLeadId,
      crm_contact_id: crmContactId,
      crm_task_id: crmTaskId,
    });
  }

  // ── Cancel booking via token (public) ─────────────────────
  async cancelBookingByToken(
    schemaName: string,
    cancelToken: string,
    reason?: string,
  ) {
    const [booking] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".form_bookings
       WHERE cancel_token = $1 AND status = 'confirmed'`,
      [cancelToken],
    );
    if (!booking) throw new NotFoundException('Booking not found or already cancelled');

    await this.dataSource.query(
      `UPDATE "${schemaName}".form_bookings
       SET status='cancelled', cancelled_at=NOW(),
           cancelled_by='invitee', cancel_reason=$2
       WHERE id=$1`,
      [booking.id, reason || null],
    );

    if (booking.crm_task_id) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".tasks SET deleted_at=NOW() WHERE id=$1`,
        [booking.crm_task_id],
      ).catch(() => {});
    }

    return { cancelled: true, bookingId: booking.id };
  }

  // ── List bookings for a user ───────────────────────────────
  async listBookings(
    schemaName: string,
    userId: string,
    query: {
      status?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const conditions = [`fb.host_user_id = $1`];
    const params: any[] = [userId];
    let idx = 2;

    if (query.status) { conditions.push(`fb.status = $${idx++}`); params.push(query.status); }
    if (query.from) { conditions.push(`fb.start_time >= $${idx++}`); params.push(query.from); }
    if (query.to) { conditions.push(`fb.start_time <= $${idx++}`); params.push(query.to); }

    const where = conditions.join(' AND ');
    const limit = query.limit || 25;
    const offset = ((query.page || 1) - 1) * limit;

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM "${schemaName}".form_bookings fb WHERE ${where}`,
      params,
    );

    const rows = await this.dataSource.query(
      `SELECT fb.*, f.name AS form_name
       FROM "${schemaName}".form_bookings fb
       JOIN "${schemaName}".forms f ON f.id = fb.form_id
       WHERE ${where}
       ORDER BY fb.start_time DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    return {
      data: rows.map((r: any) => this.formatBooking(r)),
      meta: {
        total: parseInt(count, 10),
        page: query.page || 1,
        limit,
        totalPages: Math.ceil(parseInt(count, 10) / limit),
      },
    };
  }

  // ── Resolve public booking form by tenantSlug + token ─────
  async resolvePublicBookingForm(tenantSlug: string, token: string) {
    const [tenant] = await this.dataSource.query(
      `SELECT schema_name FROM master.tenants WHERE slug = $1 LIMIT 1`,
      [tenantSlug],
    );
    if (!tenant) throw new NotFoundException('Not found');

    const schemaName = tenant.schema_name;

    const [form] = await this.dataSource.query(
      `SELECT f.*,
              u.first_name || ' ' || u.last_name AS host_name,
              u.email AS host_email,
              u.avatar_url AS host_avatar
       FROM "${schemaName}".forms f
       LEFT JOIN "${schemaName}".users u ON u.id = f.created_by
       WHERE f.token = $1
         AND f.type = 'meeting_booking'
         AND f.status = 'active'
         AND f.deleted_at IS NULL`,
      [token],
    );
    if (!form) throw new NotFoundException('Booking form not found or inactive');

    const availability = await this.getAvailability(schemaName, form.id);
    const cfg = typeof form.meeting_config === 'string'
      ? JSON.parse(form.meeting_config) : (form.meeting_config || {});

    return {
      schemaName,
      form: {
        id: form.id,
        name: form.name,
        description: form.description,
        fields: typeof form.fields === 'string' ? JSON.parse(form.fields) : (form.fields || []),
        branding: typeof form.branding === 'string' ? JSON.parse(form.branding) : (form.branding || {}),
        meetingConfig: cfg,
        availability,
        hostName: form.host_name,
        hostEmail: form.host_email,
        hostAvatar: form.host_avatar,
      },
    };
  }

  // ── Private helpers ────────────────────────────────────────

  private async sendInviteeConfirmation(
    form: any,
    booking: any,
    cfg: any,
    cancelToken: string,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.intellicon.io';
    const cancelUrl = `${frontendUrl}/book/cancel/${cancelToken}?tenant=${form.tenant_slug}`;
    const startStr = new Date(booking.start_time).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const meetSection = booking.meet_link
      ? `<p style="font-family:sans-serif"><strong>Join:</strong> <a href="${booking.meet_link}" style="color:#7c3aed">${booking.meet_link}</a></p>`
      : '';

    await this.emailService.sendEmail({
      to: booking.invitee_email,
      subject: `Confirmed: ${form.name} with ${form.host_name}`,
      html: `
        <h2 style="color:#1e293b;font-family:sans-serif">Your meeting is confirmed!</h2>
        <p style="font-family:sans-serif"><strong>Event:</strong> ${form.name}</p>
        <p style="font-family:sans-serif"><strong>With:</strong> ${form.host_name}</p>
        <p style="font-family:sans-serif"><strong>When:</strong> ${startStr} (${booking.timezone})</p>
        ${meetSection}
        ${cfg.locationValue && !booking.meet_link
          ? `<p style="font-family:sans-serif"><strong>Where:</strong> ${cfg.locationValue}</p>`
          : ''}
        ${cfg.confirmationMessage
          ? `<p style="font-family:sans-serif">${cfg.confirmationMessage}</p>`
          : ''}
        <p style="margin-top:24px;font-family:sans-serif">
          <a href="${cancelUrl}" style="color:#ef4444;font-size:13px">Cancel this meeting</a>
        </p>
      `,
    });
  }

  private async sendHostNotification(form: any, booking: any) {
    if (!form.owner_email) return;
    const startStr = new Date(booking.start_time).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const meetSection = booking.meet_link
      ? `<p style="font-family:sans-serif"><strong>Meet link:</strong> <a href="${booking.meet_link}">${booking.meet_link}</a></p>`
      : '';

    await this.emailService.sendEmail({
      to: form.owner_email,
      subject: `New booking: ${booking.invitee_name} — ${form.name}`,
      html: `
        <h2 style="color:#1e293b;font-family:sans-serif">New meeting booked</h2>
        <p style="font-family:sans-serif">
          <strong>Who:</strong> ${booking.invitee_name} (${booking.invitee_email})
        </p>
        <p style="font-family:sans-serif"><strong>When:</strong> ${startStr}</p>
        ${meetSection}
        ${booking.invitee_phone
          ? `<p style="font-family:sans-serif"><strong>Phone:</strong> ${booking.invitee_phone}</p>`
          : ''}
        ${booking.invitee_notes
          ? `<p style="font-family:sans-serif"><strong>Notes:</strong> ${booking.invitee_notes}</p>`
          : ''}
      `,
    });
  }

  // ── Get user's personal availability ──────────────────────
  async getUserAvailability(schemaName: string, userId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".user_availability
       WHERE user_id = $1 ORDER BY day_of_week ASC`,
      [userId],
    );

    // Return all 7 days, seeding defaults if missing
    const map = new Map<number, any>(rows.map((r: any) => [r.day_of_week, r]));
    return Array.from({ length: 7 }, (_, i) => {
      const row = map.get(i);
      return {
        dayOfWeek: i,
        startTime: row?.start_time || '09:00',
        endTime: row?.end_time || '17:00',
        isActive: row ? row.is_active : (i >= 1 && i <= 5),
      };
    });
  }

  // ── Save user's personal availability (upsert) ────────────
  async saveUserAvailability(
    schemaName: string,
    userId: string,
    windows: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>,
  ) {
    for (const w of windows) {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".user_availability
           (user_id, day_of_week, start_time, end_time, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, day_of_week) DO UPDATE SET
           start_time = $3, end_time = $4, is_active = $5`,
        [userId, w.dayOfWeek, w.startTime, w.endTime, w.isActive],
      );
    }
    return this.getUserAvailability(schemaName, userId);
  }

  private formatBooking(r: any) {
    return {
      id: r.id,
      formId: r.form_id,
      formName: r.form_name || null,
      hostUserId: r.host_user_id,
      inviteeName: r.invitee_name,
      inviteeEmail: r.invitee_email,
      inviteePhone: r.invitee_phone,
      inviteeNotes: r.invitee_notes,
      answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {}),
      startTime: r.start_time,
      endTime: r.end_time,
      timezone: r.timezone,
      status: r.status,
      locationType: r.location_type,
      locationValue: r.location_value,
      cancelToken: r.cancel_token,
      meetLink: r.meet_link || null,
      googleCalendarEventId: r.google_calendar_event_id || null,
      crmLeadId: r.crm_lead_id,
      crmContactId: r.crm_contact_id,
      crmTaskId: r.crm_task_id,
      cancelledAt: r.cancelled_at,
      cancelReason: r.cancel_reason,
      createdAt: r.created_at,
    };
  }
}
