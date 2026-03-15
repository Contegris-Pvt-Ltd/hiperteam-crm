import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Download, ChevronDown, ChevronRight,
  CheckCircle, XCircle, BarChart2, List, Users, Calendar, TrendingUp,
  Filter, RefreshCw,
} from 'lucide-react';
import { formsApi } from '../../api/forms.api';
import type { FormRecord, FormSubmission } from '../../api/forms.api';

// ── Palette for charts ──────────────────────────────────────────
const CHART_COLORS = [
  '#7c3aed', '#2563eb', '#16a34a', '#d97706', '#dc2626',
  '#0891b2', '#db2777', '#65a30d', '#9333ea', '#ea580c',
];

// ── Donut chart (SVG) ───────────────────────────────────────────
function DonutChart({ data, total }: { data: { label: string; count: number }[]; total: number }) {
  const r = 56;
  const cx = 72;
  const cy = 72;
  let angle = -90;

  const slices = data.map((d, i) => {
    const pct = total > 0 ? d.count / total : 0;
    const sweep = pct * 360;
    const startAngle = angle;
    angle += sweep;
    const endAngle = angle;
    const toRad = (a: number) => (a * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const large = sweep > 180 ? 1 : 0;
    return {
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width="144" height="144" viewBox="0 0 144 144" className="flex-shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} opacity={0.85} />
        ))}
        <circle cx={cx} cy={cy} r={32} fill="white" className="dark:fill-slate-800" />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#374151">{total}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize="9" fill="#9ca3af">responses</text>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm min-w-0">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{d.label || '(empty)'}</span>
            <span className="text-gray-900 dark:text-white font-medium flex-shrink-0">{d.count}</span>
            <span className="text-gray-400 text-xs w-9 text-right flex-shrink-0">
              {total > 0 ? `${Math.round((d.count / total) * 100)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal bar chart ────────────────────────────────────────
function HBarChart({ data, total }: { data: { label: string; count: number }[]; total: number }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[55%]">{d.label || '(empty)'}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
              {d.count} · {total > 0 ? `${Math.round((d.count / total) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="h-5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(d.count / max) * 100}%`,
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                opacity: 0.85,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 30-day trend bar chart ──────────────────────────────────────
function TrendChart({ dailyTrend }: { dailyTrend: { date: string; count: number }[] }) {
  // Fill all 30 days
  const days: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = dailyTrend?.find((r) => r.date?.slice(0, 10) === key);
    days.push({ date: key, count: found ? Number(found.count) : 0 });
  }

  const max = Math.max(...days.map((d) => d.count), 1);

  return (
    <div>
      <div className="flex items-end gap-0.5 h-24">
        {days.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end group relative">
            <div
              className="w-full rounded-sm transition-colors cursor-default"
              style={{
                height: `${Math.max((d.count / max) * 88, d.count > 0 ? 4 : 1)}px`,
                backgroundColor: d.count > 0 ? '#7c3aed' : '#e5e7eb',
                opacity: d.count > 0 ? 0.85 : 0.4,
              }}
            />
            {d.count > 0 && (
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-gray-800 dark:bg-gray-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 shadow-lg">
                {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: {d.count}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1.5">
        <span>{new Date(days[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

// ── Field stat card ─────────────────────────────────────────────
function FieldCard({ field, total }: { field: any; total: number }) {
  const pct = total > 0 ? Math.round((field.responseCount / total) * 100) : 0;
  const isChoice = ['select', 'radio', 'checkbox'].includes(field.type);
  const isNumber = field.type === 'number';
  const isText = ['text', 'email', 'phone', 'textarea', 'date'].includes(field.type);
  const distribution: { label: string; count: number }[] = isChoice
    ? (field.distribution ?? []).map((d: any) => ({ label: d.value || '(empty)', count: d.count }))
    : [];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
      <div className="flex items-start justify-between mb-0.5">
        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{field.label}</p>
        <span className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full capitalize ml-2 flex-shrink-0">
          {field.type}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {field.responseCount} response{field.responseCount !== 1 ? 's' : ''} · {pct}% response rate
      </p>

      {isChoice && distribution.length > 0 && (
        field.type === 'checkbox'
          ? <HBarChart data={distribution} total={field.responseCount} />
          : <DonutChart data={distribution} total={field.responseCount} />
      )}

      {isChoice && distribution.length === 0 && (
        <p className="text-sm text-gray-400 italic">No responses yet</p>
      )}

      {isNumber && field.stats && (
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Average', val: field.stats.avg },
            { label: 'Min', val: field.stats.min },
            { label: 'Max', val: field.stats.max },
          ].map(({ label, val }) => (
            <div key={label} className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
              <p className="text-xl font-bold text-purple-600">{val ?? '—'}</p>
            </div>
          ))}
        </div>
      )}

      {isNumber && !field.stats && (
        <p className="text-sm text-gray-400 italic">No responses yet</p>
      )}

      {isText && (
        <div className="space-y-2">
          {(field.samples ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 italic">No responses yet</p>
          ) : (
            (field.samples as string[]).map((s, i) => (
              <div key={i} className="bg-gray-50 dark:bg-slate-900 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 break-words">
                {s}
              </div>
            ))
          )}
          {field.responseCount > 5 && (
            <p className="text-xs text-gray-400 mt-1">+{field.responseCount - 5} more responses (export CSV to see all)</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────
export function FormSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormRecord | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [tab, setTab] = useState<'summary' | 'responses'>('summary');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionStatusFilter, setActionStatusFilter] = useState<'' | 'success' | 'error'>('');
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      formsApi.getById(id),
      formsApi.getSubmissions(id),
      formsApi.getAnalytics(id),
    ]).then(([f, subs, stats]) => {
      setForm(f);
      setSubmissions(subs.data);
      setMeta(subs.meta);
      setAnalytics(stats);
    }).catch(() => navigate('/forms')).finally(() => setLoading(false));
  }, [id]);

  const loadPage = async (page: number) => {
    if (!id) return;
    setLoading(true);
    try {
      const subs = await formsApi.getSubmissions(id, {
        page,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        actionStatus: actionStatusFilter || undefined,
      });
      setSubmissions(subs.data);
      setMeta(subs.meta);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!form || submissions.length === 0) return;
    const fieldNames = form.fields.filter((f) => !['heading', 'paragraph', 'divider'].includes(f.type)).map((f) => f.name);
    const headers = ['Submitted At', ...fieldNames].join(',');
    const rows = submissions.map((s) => {
      const vals = fieldNames.map((n) => {
        const v = s.data[n];
        return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v ?? '';
      });
      return [new Date(s.createdAt).toLocaleString(), ...vals].join(',');
    });
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.name}-submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !form) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const successActions = analytics?.actionBreakdown?.filter((a: any) => a.status === 'success').reduce((s: number, a: any) => s + Number(a.count), 0) ?? 0;
  const totalActions = analytics?.actionBreakdown?.reduce((s: number, a: any) => s + Number(a.count), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/forms')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{form?.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{meta.total} total submissions</p>
          </div>
        </div>
        <button
          onClick={exportCsv}
          disabled={submissions.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 w-fit">
        {([
          { key: 'summary', label: 'Summary', icon: BarChart2 },
          { key: 'responses', label: 'Responses', icon: List },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── SUMMARY TAB ── */}
      {tab === 'summary' && (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { icon: Users, label: 'Total Responses', value: analytics?.total ?? 0, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
              { icon: Calendar, label: 'Last 7 Days', value: analytics?.last7Days ?? 0, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { icon: TrendingUp, label: 'Last 30 Days', value: analytics?.last30Days ?? 0, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
              {
                icon: CheckCircle,
                label: 'Action Success Rate',
                value: totalActions > 0 ? `${Math.round((successActions / totalActions) * 100)}%` : '—',
                color: 'text-amber-600',
                bg: 'bg-amber-50 dark:bg-amber-900/20',
              },
            ] as const).map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Daily trend */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Responses — last 30 days</p>
            <TrendChart dailyTrend={analytics?.dailyTrend ?? []} />
          </div>

          {/* Per-field breakdown */}
          {(analytics?.fieldStats?.length ?? 0) > 0 ? (
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Question breakdown</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analytics.fieldStats.map((field: any) => (
                  <FieldCard key={field.name} field={field} total={analytics.total} />
                ))}
              </div>
            </div>
          ) : analytics?.total === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
              <BarChart2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No submissions yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Analytics will appear once people start submitting</p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── RESPONSES TAB ── */}
      {tab === 'responses' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Filters:</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300"
            />
            <span className="text-gray-400 text-sm">&rarr;</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300"
            />
            <select
              value={actionStatusFilter}
              onChange={(e) => setActionStatusFilter(e.target.value as '' | 'success' | 'error')}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300"
            >
              <option value="">All statuses</option>
              <option value="success">Actions succeeded</option>
              <option value="error">Has errors</option>
            </select>
            <button
              onClick={() => loadPage(1)}
              className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              Apply
            </button>
            {(startDate || endDate || actionStatusFilter) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); setActionStatusFilter(''); setTimeout(() => loadPage(1), 0); }}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Clear
              </button>
            )}
          </div>

          {submissions.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
              <p className="text-gray-500 dark:text-gray-400">No submissions yet</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
              {submissions.map((sub) => (
                <div key={sub.id}>
                  <button
                    onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {expandedId === sub.id ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {sub.data.email || sub.data.first_name || sub.data.name || `Submission #${sub.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(sub.createdAt).toLocaleString()}
                          {sub.ipAddress && <span className="ml-2">IP: {sub.ipAddress}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sub.actionResults.map((ar, i) => (
                        <span key={i} title={`${ar.type}: ${ar.status}`}>
                          {ar.status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </span>
                      ))}
                    </div>
                  </button>
                  {expandedId === sub.id && (
                    <div className="px-12 pb-4 space-y-3">
                      <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Form Data</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(sub.data).map(([key, val]) => (
                            <div key={key}>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{key}: </span>
                              <span className="text-sm text-gray-900 dark:text-white">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {sub.actionResults.length > 0 && (
                        <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-4">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Action Results</p>
                          {sub.actionResults.map((ar, i) => {
                            const retryKey = `${sub.id}-${i}`;
                            return (
                              <div key={i} className="flex items-start justify-between gap-2 text-sm py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                                <div className="flex items-start gap-2">
                                  {ar.status === 'success'
                                    ? <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                    : <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                                  <div>
                                    <p className="font-medium text-gray-700 dark:text-gray-300 capitalize">{ar.type.replace(/_/g, ' ')}</p>
                                    {ar.status === 'error' && ar.error && (
                                      <p className="text-xs text-red-500 mt-0.5">{ar.error}</p>
                                    )}
                                    {ar.type === 'webhook' && ar.result && (
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        HTTP {ar.result.statusCode}
                                        {ar.result.durationMs ? ` \u00b7 ${ar.result.durationMs}ms` : ''}
                                        {ar.result.url ? ` \u00b7 ${ar.result.url}` : ''}
                                      </p>
                                    )}
                                    {ar.retriedAt && (
                                      <p className="text-xs text-amber-500 mt-0.5">Retried: {new Date(ar.retriedAt).toLocaleString()}</p>
                                    )}
                                  </div>
                                </div>
                                {ar.type === 'webhook' && (
                                  <button
                                    disabled={retrying === retryKey}
                                    onClick={async () => {
                                      if (!id) return;
                                      setRetrying(retryKey);
                                      try {
                                        const updated = await formsApi.retryWebhook(id, sub.id, i);
                                        setSubmissions(prev => prev.map(s => s.id === sub.id ? updated : s));
                                      } catch { /* ignore */ }
                                      finally { setRetrying(null); }
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 disabled:opacity-50 flex-shrink-0"
                                  >
                                    {retrying === retryKey
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : <RefreshCw className="w-3 h-3" />}
                                    Retry
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => loadPage(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    p === meta.page
                      ? 'bg-purple-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
