// ============================================================
// FILE: apps/api/src/modules/calendar-sync/calendar-sync.service.ts
// ============================================================

import { Injectable, Logger, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

// ============================================================
// TYPES
// ============================================================

export interface CalendarConnection {
  id: string;
  userId: string;
  provider: string;
  email: string;
  calendarId: string;
  syncToken: string | null;
  lastSyncedAt: string | null;
  isActive: boolean;
  syncDirection: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  connectionId: string;
  providerEventId: string;
  taskId: string | null;
  title: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  location: string | null;
  status: string;
  source: string; // 'crm' | 'google'
  htmlLink: string | null;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  status?: string;
  htmlLink?: string;
  updated?: string;
}

interface GoogleEventsListResponse {
  items: GoogleCalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  private readonly GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
  private readonly GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ');

  constructor(
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {}

  // ============================================================
  // GOOGLE CONFIG HELPERS
  // ============================================================

  private getClientId(): string {
    return this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
  }

  private getClientSecret(): string {
    return this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
  }

  private getRedirectUri(): string {
    const apiUrl = this.configService.get<string>('APP_URL') || this.configService.get<string>('app.backendUrl') || 'http://localhost:3000';
    return `${apiUrl}/api/calendar-sync/google/callback`;
  }

  // ============================================================
  // OAUTH FLOW
  // ============================================================

  /**
   * Generate the Google OAuth consent URL
   */
  getGoogleAuthUrl(userId: string, tenantSchema: string): string {
    const clientId = this.getClientId();
    if (!clientId) throw new BadRequestException('Google Calendar integration is not configured');

    // Encode state with userId + schema for the callback
    const state = Buffer.from(JSON.stringify({ userId, tenantSchema })).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      scope: this.SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `${this.GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens and store the connection
   */
  async handleGoogleCallback(code: string, state: string): Promise<{ tenantSchema: string; userId: string }> {
    // Decode state
    let stateData: { userId: string; tenantSchema: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }

    const { userId, tenantSchema } = stateData;

    // Exchange code for tokens
    const tokens = await this.exchangeCode(code);

    // Get the user's Google email
    const googleEmail = await this.fetchGoogleEmail(tokens.access_token);

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert connection
    await this.dataSource.query(
      `INSERT INTO "${tenantSchema}".calendar_connections
        (user_id, provider, email, access_token, refresh_token, token_expires_at, calendar_id, is_active, sync_direction)
       VALUES ($1, 'google', $2, $3, $4, $5, 'primary', true, 'two_way')
       ON CONFLICT (user_id, provider) DO UPDATE SET
         email = $2, access_token = $3,
         refresh_token = COALESCE($4, "${tenantSchema}".calendar_connections.refresh_token),
         token_expires_at = $5,
         is_active = true,
         updated_at = NOW()`,
      [userId, googleEmail, tokens.access_token, tokens.refresh_token || null, tokenExpiresAt],
    );

    this.logger.log(`Google Calendar connected for user ${userId} (${googleEmail})`);

    // Trigger initial sync in background
    this.initialSync(tenantSchema, userId).catch(err =>
      this.logger.error(`Initial sync failed for ${userId}: ${err.message}`),
    );

    return { tenantSchema, userId };
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const body = new URLSearchParams({
      code,
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      redirect_uri: this.getRedirectUri(),
      grant_type: 'authorization_code',
    });

    const res = await fetch(this.GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Google token exchange failed: ${err}`);
      throw new BadRequestException('Failed to connect Google account');
    }

    return res.json();
  }

  /**
   * Refresh an expired access token
   */
  private async refreshAccessToken(schemaName: string, connectionId: string, refreshToken: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.getClientId(),
      client_secret: this.getClientSecret(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(this.GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      this.logger.error(`Token refresh failed for connection ${connectionId}`);
      // Mark connection as inactive
      await this.dataSource.query(
        `UPDATE "${schemaName}".calendar_connections SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [connectionId],
      );
      throw new UnauthorizedException('Google connection expired — please reconnect');
    }

    const data: GoogleTokenResponse = await res.json();
    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await this.dataSource.query(
      `UPDATE "${schemaName}".calendar_connections SET access_token = $1, token_expires_at = $2, updated_at = NOW() WHERE id = $3`,
      [data.access_token, tokenExpiresAt, connectionId],
    );

    return data.access_token;
  }

  /**
   * Get a valid access token (refresh if expired)
   */
  private async getValidToken(schemaName: string, connection: any): Promise<string> {
    const expiresAt = new Date(connection.token_expires_at);
    const buffer = 5 * 60 * 1000; // 5 min buffer

    if (expiresAt.getTime() - buffer > Date.now()) {
      return connection.access_token;
    }

    if (!connection.refresh_token) {
      throw new UnauthorizedException('No refresh token — please reconnect Google Calendar');
    }

    return this.refreshAccessToken(schemaName, connection.id, connection.refresh_token);
  }

  /**
   * Fetch the connected Google user's email
   */
  private async fetchGoogleEmail(accessToken: string): Promise<string> {
    const res = await fetch(this.GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return 'unknown@google.com';
    const data = await res.json();
    return data.email || 'unknown@google.com';
  }

  // ============================================================
  // CONNECTION MANAGEMENT
  // ============================================================

  async getConnection(schemaName: string, userId: string): Promise<CalendarConnection | null> {
    const [conn] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".calendar_connections WHERE user_id = $1 AND provider = 'google'`,
      [userId],
    );
    if (!conn) return null;
    return this.formatConnection(conn);
  }

  async disconnect(schemaName: string, userId: string): Promise<{ message: string }> {
    // Delete synced events
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".calendar_events
       WHERE connection_id IN (
         SELECT id FROM "${schemaName}".calendar_connections WHERE user_id = $1 AND provider = 'google'
       )`,
      [userId],
    );

    // Delete connection
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".calendar_connections WHERE user_id = $1 AND provider = 'google'`,
      [userId],
    );

    return { message: 'Google Calendar disconnected' };
  }

  // ============================================================
  // TWO-WAY SYNC
  // ============================================================

  /**
   * Initial full sync after connecting
   */
  private async initialSync(schemaName: string, userId: string): Promise<void> {
    const conn = await this.getRawConnection(schemaName, userId);
    if (!conn) return;

    // Push existing CRM tasks with due dates to Google
    await this.pushAllTasksToGoogle(schemaName, userId, conn);

    // Pull Google events into CRM
    await this.pullGoogleEvents(schemaName, userId, conn);
  }

  /**
   * Manual sync trigger
   */
  async syncNow(schemaName: string, userId: string): Promise<{ pushed: number; pulled: number }> {
    const conn = await this.getRawConnection(schemaName, userId);
    if (!conn) throw new NotFoundException('No Google Calendar connection found');
    if (!conn.is_active) throw new BadRequestException('Google Calendar connection is inactive — please reconnect');

    const pushed = await this.pushPendingTasksToGoogle(schemaName, userId, conn);
    const pulled = await this.pullGoogleEvents(schemaName, userId, conn);

    // Only update last_synced_at if something actually changed, or at least every hour
    const lastSynced = conn.last_synced_at ? new Date(conn.last_synced_at).getTime() : 0;
    const hourAgo = Date.now() - 60 * 60 * 1000;
    if (pushed > 0 || pulled > 0 || lastSynced < hourAgo) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".calendar_connections SET last_synced_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [conn.id],
      );
    }

    return { pushed, pulled };
  }

  // ============================================================
  // CRM → GOOGLE (Push tasks as calendar events)
  // ============================================================

  /**
   * Push all tasks with due dates to Google Calendar (initial sync)
   */
  private async pushAllTasksToGoogle(schemaName: string, userId: string, conn: any): Promise<number> {
    const accessToken = await this.getValidToken(schemaName, conn);

    const tasks = await this.dataSource.query(
      `SELECT t.*, ts.name as status_name, tp.name as priority_name
       FROM "${schemaName}".tasks t
       LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
       LEFT JOIN "${schemaName}".task_priorities tp ON t.priority_id = tp.id
       WHERE (t.assigned_to = $1 OR t.owner_id = $1)
         AND t.due_date IS NOT NULL
         AND t.deleted_at IS NULL
         AND t.completed_at IS NULL`,
      [userId],
    );

    let count = 0;
    for (const task of tasks) {
      try {
        await this.pushTaskToGoogle(schemaName, conn.id, accessToken, task, conn.calendar_id);
        count++;
      } catch (err: any) {
        this.logger.error(`Failed to push task ${task.id}: ${err.message}`);
      }
    }

    return count;
  }

  /**
   * Push tasks that don't have a calendar_events entry yet
   */
  private async pushPendingTasksToGoogle(schemaName: string, userId: string, conn: any): Promise<number> {
    const accessToken = await this.getValidToken(schemaName, conn);

    const tasks = await this.dataSource.query(
      `SELECT t.*, ts.name as status_name, tp.name as priority_name
       FROM "${schemaName}".tasks t
       LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
       LEFT JOIN "${schemaName}".task_priorities tp ON t.priority_id = tp.id
       WHERE (t.assigned_to = $1 OR t.owner_id = $1)
         AND t.due_date IS NOT NULL
         AND t.deleted_at IS NULL
         AND t.completed_at IS NULL
         AND t.id NOT IN (
           SELECT task_id FROM "${schemaName}".calendar_events
           WHERE connection_id = $2 AND task_id IS NOT NULL
         )`,
      [userId, conn.id],
    );

    let count = 0;
    for (const task of tasks) {
      try {
        await this.pushTaskToGoogle(schemaName, conn.id, accessToken, task, conn.calendar_id);
        count++;
      } catch (err: any) {
        this.logger.error(`Failed to push task ${task.id}: ${err.message}`);
      }
    }

    // Also update tasks that changed since last sync
    const updatedMapped = await this.dataSource.query(
      `SELECT ce.id as event_id, ce.provider_event_id, t.*, ts.name as status_name, tp.name as priority_name
       FROM "${schemaName}".calendar_events ce
       JOIN "${schemaName}".tasks t ON ce.task_id = t.id
       LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
       LEFT JOIN "${schemaName}".task_priorities tp ON t.priority_id = tp.id
       WHERE ce.connection_id = $1 AND ce.source = 'crm' AND ce.task_id IS NOT NULL
         AND t.updated_at > ce.last_synced_at AND t.deleted_at IS NULL`,
      [conn.id],
    );

    for (const row of updatedMapped) {
      try {
        await this.updateGoogleEvent(schemaName, conn.id, accessToken, row, conn.calendar_id);
        count++;
      } catch (err: any) {
        this.logger.error(`Failed to update Google event for task ${row.id}: ${err.message}`);
      }
    }

    return count;
  }

  /**
   * Push a single CRM task to Google Calendar
   */
  private async pushTaskToGoogle(
    schemaName: string, connectionId: string,
    accessToken: string, task: any, calendarId: string,
  ): Promise<void> {
    const event = this.taskToGoogleEvent(task);

    const res = await fetch(
      `${this.GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google API error: ${err}`);
    }

    const created: GoogleCalendarEvent = await res.json();

    // Store mapping
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".calendar_events
        (user_id, connection_id, provider_event_id, task_id, title, description,
         start_time, end_time, all_day, status, source, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'crm', $11)
       ON CONFLICT (connection_id, provider_event_id) DO UPDATE SET
         title = $5, description = $6, start_time = $7, end_time = $8,
         all_day = $9, status = $10, raw_data = $11, last_synced_at = NOW(), updated_at = NOW()`,
      [
        task.assigned_to || task.owner_id,
        connectionId,
        created.id,
        task.id,
        task.title,
        task.description || null,
        task.due_date,
        task.due_date, // end = start + estimated_minutes or same day
        !this.hasTime(task.due_date),
        task.completed_at ? 'cancelled' : 'confirmed',
        JSON.stringify(created),
      ],
    );
  }

  /**
   * Update an existing Google Calendar event from a CRM task
   */
  private async updateGoogleEvent(
    schemaName: string, connectionId: string,
    accessToken: string, row: any, calendarId: string,
  ): Promise<void> {
    const event = this.taskToGoogleEvent(row);

    const res = await fetch(
      `${this.GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${row.provider_event_id}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google API update error: ${err}`);
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".calendar_events SET
        title = $1, start_time = $2, end_time = $3, last_synced_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [row.title, row.due_date, row.due_date, row.event_id],
    );
  }

  /**
   * Push a single task change to Google (called from tasks.service hooks)
   */
  async onTaskChanged(schemaName: string, userId: string, taskId: string, action: 'create' | 'update' | 'delete'): Promise<void> {
    const conn = await this.getRawConnection(schemaName, userId);
    if (!conn || !conn.is_active) return;

    try {
      const accessToken = await this.getValidToken(schemaName, conn);

      if (action === 'delete') {
        // Delete from Google
        const [event] = await this.dataSource.query(
          `SELECT * FROM "${schemaName}".calendar_events WHERE task_id = $1 AND connection_id = $2`,
          [taskId, conn.id],
        );
        if (event) {
          await fetch(
            `${this.GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(conn.calendar_id)}/events/${event.provider_event_id}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
          ).catch(() => {});
          await this.dataSource.query(`DELETE FROM "${schemaName}".calendar_events WHERE id = $1`, [event.id]);
        }
        return;
      }

      // Get updated task
      const [task] = await this.dataSource.query(
        `SELECT t.*, ts.name as status_name, tp.name as priority_name
         FROM "${schemaName}".tasks t
         LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
         LEFT JOIN "${schemaName}".task_priorities tp ON t.priority_id = tp.id
         WHERE t.id = $1`,
        [taskId],
      );
      if (!task || !task.due_date) return;

      // Check if mapping exists
      const [existing] = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".calendar_events WHERE task_id = $1 AND connection_id = $2`,
        [taskId, conn.id],
      );

      if (existing) {
        await this.updateGoogleEvent(schemaName, conn.id, accessToken, {
          ...task, event_id: existing.id, provider_event_id: existing.provider_event_id,
        }, conn.calendar_id);
      } else {
        await this.pushTaskToGoogle(schemaName, conn.id, accessToken, task, conn.calendar_id);
      }
    } catch (err: any) {
      this.logger.error(`Calendar sync failed for task ${taskId}: ${err.message}`);
    }
  }

  // ============================================================
  // GOOGLE → CRM (Pull external events)
  // ============================================================

  /**
   * Pull events from Google Calendar into CRM
   */
  private async pullGoogleEvents(schemaName: string, userId: string, conn: any): Promise<number> {
    const accessToken = await this.getValidToken(schemaName, conn);

    // Build request — use syncToken if available for incremental sync
    const params = new URLSearchParams({
      maxResults: '250',
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (conn.sync_token) {
      params.set('syncToken', conn.sync_token);
    } else {
      // First sync: get events from 30 days ago to 90 days ahead
      const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      params.set('timeMin', timeMin);
      params.set('timeMax', timeMax);
    }

    let count = 0;
    let pageToken: string | undefined;

    do {
      if (pageToken) params.set('pageToken', pageToken);

      const url = `${this.GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(conn.calendar_id)}/events?${params.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.status === 410) {
        // Sync token invalidated — do full sync
        await this.dataSource.query(
          `UPDATE "${schemaName}".calendar_connections SET sync_token = NULL WHERE id = $1`,
          [conn.id],
        );
        conn.sync_token = null;
        return this.pullGoogleEvents(schemaName, userId, conn);
      }

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`Google events list failed: ${err}`);
        break;
      }

      const data: GoogleEventsListResponse = await res.json();

      for (const gEvent of (data.items || [])) {
        if (!gEvent.id) continue;

        // Skip events that were pushed from CRM (avoid duplicates)
        const [existingCrm] = await this.dataSource.query(
          `SELECT id FROM "${schemaName}".calendar_events
           WHERE connection_id = $1 AND provider_event_id = $2 AND source = 'crm'`,
          [conn.id, gEvent.id],
        );
        if (existingCrm) continue;

        const startTime = gEvent.start?.dateTime || gEvent.start?.date || null;
        const endTime = gEvent.end?.dateTime || gEvent.end?.date || null;
        const allDay = !gEvent.start?.dateTime;

        // Upsert external event
        await this.dataSource.query(
          `INSERT INTO "${schemaName}".calendar_events
            (user_id, connection_id, provider_event_id, task_id, title, description,
             start_time, end_time, all_day, location, status, source, raw_data)
           VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, 'google', $11)
           ON CONFLICT (connection_id, provider_event_id) DO UPDATE SET
             title = $4, description = $5, start_time = $6, end_time = $7,
             all_day = $8, location = $9, status = $10, raw_data = $11,
             last_synced_at = NOW(), updated_at = NOW()`,
          [
            userId, conn.id, gEvent.id,
            gEvent.summary || '(No title)',
            gEvent.description || null,
            startTime, endTime, allDay,
            gEvent.location || null,
            gEvent.status || 'confirmed',
            JSON.stringify(gEvent),
          ],
        );
        count++;
      }

      // Store sync token for incremental future syncs
      if (data.nextSyncToken) {
        await this.dataSource.query(
          `UPDATE "${schemaName}".calendar_connections SET sync_token = $1, updated_at = NOW() WHERE id = $2`,
          [data.nextSyncToken, conn.id],
        );
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    return count;
  }

  // ============================================================
  // GET EVENTS (for calendar view)
  // ============================================================

  /**
   * Get synced Google events for the calendar view
   */
  async getGoogleEvents(
    schemaName: string, userId: string,
    from: string, to: string,
  ): Promise<CalendarEvent[]> {
    const events = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".calendar_events
       WHERE user_id = $1 AND source = 'google'
         AND start_time >= $2 AND start_time <= $3
         AND status != 'cancelled'
       ORDER BY start_time ASC`,
      [userId, from, to],
    );

    return events.map((e: any) => this.formatEvent(e));
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async getRawConnection(schemaName: string, userId: string): Promise<any | null> {
    const [conn] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".calendar_connections WHERE user_id = $1 AND provider = 'google'`,
      [userId],
    );
    return conn || null;
  }

  private taskToGoogleEvent(task: any): GoogleCalendarEvent {
    const dueDate = new Date(task.due_date);
    const hasTime = this.hasTime(task.due_date);

    // Calculate end time from estimated_minutes or default 30 min
    const duration = task.estimated_minutes || 30;
    const endDate = new Date(dueDate.getTime() + duration * 60 * 1000);

    const event: GoogleCalendarEvent = {
      summary: `[CRM] ${task.title}`,
      description: [
        task.description || '',
        '',
        task.priority_name ? `Priority: ${task.priority_name}` : '',
        task.status_name ? `Status: ${task.status_name}` : '',
        `CRM Task ID: ${task.id}`,
      ].filter(Boolean).join('\n'),
      start: hasTime
        ? { dateTime: dueDate.toISOString() }
        : { date: dueDate.toISOString().split('T')[0] },
      end: hasTime
        ? { dateTime: endDate.toISOString() }
        : { date: dueDate.toISOString().split('T')[0] },
    };

    return event;
  }

  private hasTime(dateStr: string): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getHours() !== 0 || d.getMinutes() !== 0;
  }

  private formatConnection(c: any): CalendarConnection {
    return {
      id: c.id,
      userId: c.user_id,
      provider: c.provider,
      email: c.email,
      calendarId: c.calendar_id,
      syncToken: c.sync_token,
      lastSyncedAt: c.last_synced_at,
      isActive: c.is_active,
      syncDirection: c.sync_direction,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }

  // ============================================================
  // CREATE BOOKING EVENT (called from SchedulingService)
  // Creates a Google Calendar event with Google Meet link.
  // Returns { meetLink, googleEventId } or null if user has no connection.
  // ============================================================
  async createBookingEvent(
    schemaName: string,
    hostUserId: string,
    dto: {
      title: string;
      description: string;
      startTime: string;   // ISO string
      endTime: string;     // ISO string
      timezone: string;
      inviteeEmail: string;
      inviteeName: string;
      location?: string;
    },
  ): Promise<{ meetLink: string | null; googleEventId: string | null }> {
    const conn = await this.getRawConnection(schemaName, hostUserId);
    if (!conn || !conn.is_active) {
      return { meetLink: null, googleEventId: null };
    }

    try {
      const accessToken = await this.getValidToken(schemaName, conn);

      const event = {
        summary: dto.title,
        description: dto.description,
        start: { dateTime: dto.startTime, timeZone: dto.timezone },
        end: { dateTime: dto.endTime, timeZone: dto.timezone },
        attendees: [{ email: dto.inviteeEmail, displayName: dto.inviteeName }],
        location: dto.location || undefined,
        conferenceData: {
          createRequest: {
            requestId: `booking-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      };

      const url = `${this.GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(conn.calendar_id)}/events?conferenceDataVersion=1&sendUpdates=all`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.warn(`Google Calendar booking event creation failed: ${errText}`);
        return { meetLink: null, googleEventId: null };
      }

      const created = await res.json();

      const meetLink: string | null =
        created.conferenceData?.entryPoints?.find(
          (e: any) => e.entryPointType === 'video',
        )?.uri || created.hangoutLink || null;

      const googleEventId: string | null = created.id || null;

      this.logger.log(
        `Booking calendar event created for ${hostUserId}: ${googleEventId}, Meet: ${meetLink}`,
      );

      return { meetLink, googleEventId };
    } catch (err: any) {
      this.logger.warn(
        `createBookingEvent failed for user ${hostUserId}: ${err.message}`,
      );
      return { meetLink: null, googleEventId: null };
    }
  }

  private formatEvent(e: any): CalendarEvent {
    // Extract htmlLink from stored raw Google response
    let htmlLink: string | null = null;
    try {
      const raw = typeof e.raw_data === 'string' ? JSON.parse(e.raw_data) : e.raw_data;
      htmlLink = raw?.htmlLink || null;
    } catch {}

    return {
      id: e.id,
      userId: e.user_id,
      connectionId: e.connection_id,
      providerEventId: e.provider_event_id,
      taskId: e.task_id,
      title: e.title,
      description: e.description,
      startTime: e.start_time,
      endTime: e.end_time,
      allDay: e.all_day,
      location: e.location,
      status: e.status,
      source: e.source,
      htmlLink,
      lastSyncedAt: e.last_synced_at,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    };
  }
}