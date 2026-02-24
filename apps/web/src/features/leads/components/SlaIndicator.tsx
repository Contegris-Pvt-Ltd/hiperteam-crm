// ============================================================
// FILE: apps/web/src/features/leads/components/SlaIndicator.tsx
//
// Reusable SLA badge/indicator used in:
//   - LeadDetailPage (full card mode)
//   - LeadsPage list rows (compact badge mode)
//   - Kanban cards (compact badge mode)
// ============================================================

import {
  Clock, CheckCircle2, AlertTriangle, XCircle, ArrowUpCircle,
  Timer, Loader2,
} from 'lucide-react';
import type { LeadSlaStatus, SlaStatus } from '../../../api/leads.api';

// ============================================================
// STATUS CONFIG
// ============================================================

const STATUS_CONFIG: Record<SlaStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Clock;
  pulse?: boolean;
}> = {
  no_sla: {
    label: 'No SLA',
    color: 'text-gray-400 dark:text-slate-500',
    bgColor: 'bg-gray-50 dark:bg-slate-800/50',
    borderColor: 'border-gray-200 dark:border-slate-700',
    icon: Clock,
  },
  on_track: {
    label: 'On Track',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    icon: Timer,
  },
  at_risk: {
    label: 'At Risk',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
    pulse: true,
  },
  breached: {
    label: 'Breached',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: XCircle,
    pulse: true,
  },
  escalated: {
    label: 'Escalated',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-300 dark:border-red-700',
    icon: ArrowUpCircle,
    pulse: true,
  },
  met: {
    label: 'Met',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle2,
  },
  met_late: {
    label: 'Met (Late)',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: CheckCircle2,
  },
};

// ============================================================
// HELPERS
// ============================================================

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  const abs = Math.abs(minutes);
  const sign = minutes < 0 ? '-' : '';
  if (abs < 60) return `${sign}${abs}m`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h < 24) return m > 0 ? `${sign}${h}h ${m}m` : `${sign}${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${sign}${d}d ${rh}h` : `${sign}${d}d`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true,
  });
}

// ============================================================
// COMPACT BADGE (for list rows & kanban cards)
// ============================================================

interface CompactProps {
  status: SlaStatus;
  remainingMinutes?: number | null;
  responseMinutes?: number | null;
}

export function SlaBadge({ status, remainingMinutes, responseMinutes }: CompactProps) {
  const cfg = STATUS_CONFIG[status];
  if (status === 'no_sla') return null;

  const Icon = cfg.icon;
  const timeLabel = status === 'met' || status === 'met_late'
    ? formatDuration(responseMinutes ?? null)
    : formatDuration(remainingMinutes ?? null);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
        ${cfg.bgColor} ${cfg.color} ${cfg.pulse ? 'animate-pulse' : ''}`}
      title={`SLA: ${cfg.label}${timeLabel !== '—' ? ` (${timeLabel})` : ''}`}
    >
      <Icon className="w-3 h-3" />
      <span>{cfg.label}</span>
      {timeLabel !== '—' && (
        <span className="opacity-70">{timeLabel}</span>
      )}
    </span>
  );
}

// ============================================================
// INLINE BADGE (for lead list — derives from lead object fields)
// ============================================================

interface InlineProps {
  lead: {
    slaFirstContactDueAt?: string | null;
    slaFirstContactMetAt?: string | null;
    slaBreached?: boolean;
    slaEscalated?: boolean;
    createdAt?: string;
  };
}

export function SlaInlineBadge({ lead }: InlineProps) {
  if (!lead.slaFirstContactDueAt) return null;

  // Derive status from lead fields without API call
  const now = new Date();
  const dueAt = new Date(lead.slaFirstContactDueAt);
  const metAt = lead.slaFirstContactMetAt ? new Date(lead.slaFirstContactMetAt) : null;
  const createdAt = lead.createdAt ? new Date(lead.createdAt) : now;

  let status: SlaStatus;
  let remainingMinutes: number | null = null;
  let responseMinutes: number | null = null;

  if (metAt) {
    responseMinutes = Math.round((metAt.getTime() - createdAt.getTime()) / 60000);
    status = lead.slaBreached ? 'met_late' : 'met';
  } else if (lead.slaEscalated) {
    status = 'escalated';
    remainingMinutes = Math.round((dueAt.getTime() - now.getTime()) / 60000);
  } else if (lead.slaBreached) {
    status = 'breached';
    remainingMinutes = Math.round((dueAt.getTime() - now.getTime()) / 60000);
  } else {
    remainingMinutes = Math.round((dueAt.getTime() - now.getTime()) / 60000);
    const totalMinutes = Math.round((dueAt.getTime() - createdAt.getTime()) / 60000);
    const threshold = totalMinutes * 0.25;
    status = remainingMinutes <= 0 ? 'breached' : remainingMinutes <= threshold ? 'at_risk' : 'on_track';
  }

  return <SlaBadge status={status} remainingMinutes={remainingMinutes} responseMinutes={responseMinutes} />;
}

// ============================================================
// FULL SLA CARD (for LeadDetailPage)
// ============================================================

interface CardProps {
  leadId: string;
  slaData?: LeadSlaStatus | null;
  loading?: boolean;
}

export function SlaCard({ slaData, loading }: CardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading SLA...
        </div>
      </div>
    );
  }

  if (!slaData || !slaData.hasSla) return null;

  const cfg = STATUS_CONFIG[slaData.status];
  const Icon = cfg.icon;

  return (
    <div className={`border rounded-xl p-4 ${cfg.borderColor} ${cfg.bgColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${cfg.color}`} />
          <h3 className={`text-sm font-semibold ${cfg.color}`}>
            First Contact SLA — {cfg.label}
          </h3>
        </div>
        {cfg.pulse && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400">Due By</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatDateTime(slaData.dueAt)}
          </p>
        </div>

        {slaData.metAt ? (
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">Responded At</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDateTime(slaData.metAt)}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {slaData.remainingMinutes !== null && slaData.remainingMinutes > 0
                ? 'Time Remaining'
                : 'Overdue By'}
            </p>
            <p className={`text-sm font-semibold ${cfg.color}`}>
              {formatDuration(slaData.remainingMinutes)}
            </p>
          </div>
        )}

        {slaData.responseMinutes !== null && (
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">Response Time</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDuration(slaData.responseMinutes)}
            </p>
          </div>
        )}

        {slaData.breached && (
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">Breached At</p>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              {formatDateTime(slaData.breachedAt)}
            </p>
          </div>
        )}

        {slaData.escalated && (
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">Escalated At</p>
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {formatDateTime(slaData.escalatedAt)}
            </p>
          </div>
        )}
      </div>

      {/* Progress bar (only for active SLAs) */}
      {!slaData.metAt && slaData.remainingMinutes !== null && (
        <div className="mt-3">
          <SlaProgressBar
            remainingMinutes={slaData.remainingMinutes}
            dueAt={slaData.dueAt!}
            status={slaData.status}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// PROGRESS BAR
// ============================================================

function SlaProgressBar({
  remainingMinutes,
  dueAt,
  status,
}: {
  remainingMinutes: number;
  dueAt: string;
  status: SlaStatus;
}) {
  // Calculate percentage elapsed
  // We approximate total SLA window from remaining + elapsed
  const now = new Date();
  const due = new Date(dueAt);
  const totalMs = due.getTime() - now.getTime() + remainingMinutes * 60000;
  const elapsedMs = totalMs - remainingMinutes * 60000;
  const pct = totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 100;

  const barColor =
    status === 'breached' || status === 'escalated'
      ? 'bg-red-500'
      : status === 'at_risk'
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default SlaCard;