import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Download, ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { formsApi } from '../../api/forms.api';
import type { FormRecord, FormSubmission } from '../../api/forms.api';

export function FormSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormRecord | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      formsApi.getById(id),
      formsApi.getSubmissions(id),
    ]).then(([f, subs]) => {
      setForm(f);
      setSubmissions(subs.data);
      setMeta(subs.meta);
    }).catch(() => navigate('/forms')).finally(() => setLoading(false));
  }, [id]);

  const loadPage = async (page: number) => {
    if (!id) return;
    setLoading(true);
    try {
      const subs = await formsApi.getSubmissions(id, { page });
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/forms')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{form?.name} — Submissions</h1>
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

      {/* Submissions List */}
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
                      {sub.actionResults.map((ar, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {ar.status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-gray-700 dark:text-gray-300 capitalize">{ar.type.replace(/_/g, ' ')}</span>
                          {ar.error && <span className="text-xs text-red-500">— {ar.error}</span>}
                        </div>
                      ))}
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
  );
}
