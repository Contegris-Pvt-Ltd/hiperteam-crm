// ============================================================
// FILE: apps/web/src/api/scheduling.api.ts
// ============================================================
import { api } from './contacts.api';

export interface BookingAvailabilityWindow {
  dayOfWeek: number;   // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  startTime: string;   // 'HH:MM'
  endTime: string;     // 'HH:MM'
  isActive: boolean;
}

export interface MeetingConfig {
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
  maxDaysAhead: number;
  minNoticeHours: number;
  locationType: 'video' | 'phone' | 'in_person' | 'custom';
  locationValue?: string;
  confirmationMessage?: string;
  redirectUrl?: string;
  crmAction: 'create_lead' | 'create_contact' | 'none';
  timezone: string;
}

export const DEFAULT_MEETING_CONFIG: MeetingConfig = {
  durationMinutes: 30,
  bufferBefore: 0,
  bufferAfter: 0,
  maxDaysAhead: 60,
  minNoticeHours: 1,
  locationType: 'video',
  locationValue: '',
  confirmationMessage: '',
  redirectUrl: '',
  crmAction: 'create_lead',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

export const DEFAULT_AVAILABILITY: BookingAvailabilityWindow[] = [
  { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
  { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
  { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true },
  { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true },
  { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isActive: true },
  { dayOfWeek: 6, startTime: '09:00', endTime: '17:00', isActive: false },
  { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isActive: false },
];

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface FormBooking {
  id: string;
  formId: string;
  formName?: string;
  hostUserId: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteePhone?: string;
  inviteeNotes?: string;
  answers?: Record<string, any>;
  startTime: string;
  endTime: string;
  timezone: string;
  status: 'confirmed' | 'cancelled' | 'rescheduled' | 'no_show';
  locationType?: string;
  locationValue?: string;
  cancelToken?: string;
  crmLeadId?: string;
  crmContactId?: string;
  crmTaskId?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
}

export interface BookingFormSummary {
  id: string;
  name: string;
  description?: string;
  status: string;
  token: string;
  tenantSlug: string;
  meetingConfig: MeetingConfig;
  confirmedCount: number;
  createdAt: string;
  updatedAt: string;
}

export const schedulingApi = {
  // ── Authenticated ──────────────────────────────────────────

  listBookingForms: async (): Promise<BookingFormSummary[]> => {
    const { data } = await api.get('/scheduling/forms');
    return data;
  },

  listBookings: async (params?: {
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: FormBooking[]; meta: { total: number; page: number; limit: number; totalPages: number } }> => {
    const { data } = await api.get('/scheduling/bookings', { params });
    return data;
  },

  getSlots: async (
    formId: string,
    date: string,
  ): Promise<{ date: string; slots: string[] }> => {
    const { data } = await api.get(`/scheduling/forms/${formId}/slots`, {
      params: { date },
    });
    return data;
  },

  getAvailableDates: async (
    formId: string,
    year: number,
    month: number,
  ): Promise<{ year: number; month: number; availableDates: string[] }> => {
    const { data } = await api.get(`/scheduling/forms/${formId}/available-dates`, {
      params: { year, month },
    });
    return data;
  },

  saveAvailability: async (
    formId: string,
    windows: BookingAvailabilityWindow[],
  ): Promise<{ saved: boolean }> => {
    const { data } = await api.put(`/scheduling/forms/${formId}/availability`, {
      windows,
    });
    return data;
  },

  // ── Personal availability ─────────────────────────────────
  getMyAvailability: async (): Promise<BookingAvailabilityWindow[]> => {
    const { data } = await api.get('/scheduling/my-availability');
    return data;
  },

  saveMyAvailability: async (
    windows: BookingAvailabilityWindow[],
  ): Promise<{ saved: boolean }> => {
    const { data } = await api.put('/scheduling/my-availability', { windows });
    return data;
  },

  getUserAvailability: async (userId: string): Promise<BookingAvailabilityWindow[]> => {
    const { data } = await api.get(`/scheduling/users/${userId}/availability`);
    return data;
  },

  // ── Public (no auth) ──────────────────────────────────────

  getPublicForm: async (tenantSlug: string, token: string) => {
    const { data } = await api.get(`/scheduling/public/${tenantSlug}/${token}`);
    return data;
  },

  getPublicDates: async (
    tenantSlug: string,
    token: string,
    year: number,
    month: number,
  ): Promise<{ year: number; month: number; availableDates: string[] }> => {
    const { data } = await api.get(
      `/scheduling/public/${tenantSlug}/${token}/dates`,
      { params: { year, month } },
    );
    return data;
  },

  getPublicSlots: async (
    tenantSlug: string,
    token: string,
    date: string,
  ): Promise<{ date: string; slots: string[] }> => {
    const { data } = await api.get(
      `/scheduling/public/${tenantSlug}/${token}/slots`,
      { params: { date } },
    );
    return data;
  },

  createPublicBooking: async (
    tenantSlug: string,
    token: string,
    dto: {
      startTime: string;
      timezone: string;
      inviteeName: string;
      inviteeEmail: string;
      inviteePhone?: string;
      inviteeNotes?: string;
      answers?: Record<string, any>;
    },
  ): Promise<FormBooking> => {
    const { data } = await api.post(
      `/scheduling/public/${tenantSlug}/${token}/book`,
      dto,
    );
    return data;
  },

  cancelBooking: async (
    cancelToken: string,
    tenantSlug: string,
    reason?: string,
  ): Promise<{ cancelled: boolean; bookingId: string }> => {
    const { data } = await api.post(
      `/scheduling/public/cancel/${cancelToken}`,
      { tenantSlug, reason },
    );
    return data;
  },
};
