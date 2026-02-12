import { api } from './contacts.api';

// ============================================================
// TYPES
// ============================================================

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  performedBy: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogQueryParams {
  entityType?: string;
  entityId?: string;
  action?: string;
  performedBy?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortOrder?: 'ASC' | 'DESC';
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ============================================================
// API CALLS
// ============================================================

/** Global audit log query (admin endpoint) */
export const getAuditLogs = async (params: AuditLogQueryParams): Promise<AuditLogResponse> => {
  const { data } = await api.get('/admin/audit-logs', { params });
  return data;
};

/** Get audit history for a specific entity */
export const getEntityAuditHistory = async (
  entityType: string,
  entityId: string,
  limit = 50,
): Promise<AuditLogEntry[]> => {
  const { data } = await api.get(`/admin/audit-logs/${entityType}/${entityId}`, {
    params: { limit },
  });
  return data;
};