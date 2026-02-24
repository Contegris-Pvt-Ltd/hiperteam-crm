// ============================================================
// FILE: apps/web/src/api/calendar-sync.api.ts
// ============================================================

import { api } from './contacts.api';

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
  source: 'crm' | 'google';
  htmlLink: string | null;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionStatus {
  connected: boolean;
  connection: CalendarConnection | null;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
}

// ============================================================
// API
// ============================================================

export const calendarSyncApi = {
  /**
   * Get OAuth URL to connect Google Calendar
   * Returns { url: string } — frontend should redirect browser to this URL
   */
  getGoogleAuthUrl: async (): Promise<{ url: string }> => {
    const { data } = await api.get('/calendar-sync/google/auth');
    return data;
  },

  /**
   * Get current connection status
   */
  getConnection: async (): Promise<ConnectionStatus> => {
    const { data } = await api.get('/calendar-sync/connection');
    return data;
  },

  /**
   * Disconnect Google Calendar
   */
  disconnect: async (): Promise<{ message: string }> => {
    const { data } = await api.delete('/calendar-sync/disconnect');
    return data;
  },

  /**
   * Trigger manual sync
   */
  syncNow: async (): Promise<SyncResult> => {
    const { data } = await api.post('/calendar-sync/sync');
    return data;
  },

  /**
   * Get Google Calendar events for a date range
   */
  getEvents: async (from: string, to: string): Promise<CalendarEvent[]> => {
    const params = new URLSearchParams({ from, to });
    const { data } = await api.get(`/calendar-sync/events?${params.toString()}`);
    return data;
  },
};