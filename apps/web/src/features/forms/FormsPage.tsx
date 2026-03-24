import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  FileText,
  Copy,
  Trash2,
  ExternalLink,
  BarChart3,
  Loader2,
  MoreVertical,
  Eye,
  Code2,
} from 'lucide-react';
import { formsApi } from '../../api/forms.api';
import type { FormRecord } from '../../api/forms.api';
import { EmbedModal } from './EmbedModal';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  inactive: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  archived: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function FormsPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [embedForm, setEmbedForm] = useState<FormRecord | null>(null);

  const loadForms = async (page = 1) => {
    setLoading(true);
    try {
      const res = await formsApi.getAll({ search: search || undefined, status: statusFilter || undefined, page });
      setForms(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to load forms', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, [search, statusFilter]);

  const handleCreate = async (type: 'standard' | 'meeting_booking' = 'standard') => {
    try {
      const form = await formsApi.create({
        name: type === 'meeting_booking' ? 'New Booking Page' : 'Untitled Form',
        status: 'draft',
        type,
      });
      navigate(`/forms/${form.id}/builder`);
    } catch (err) {
      console.error('Failed to create form', err);
    }
  };

  const handleDuplicate = async (id: string) => {
    setMenuOpen(null);
    try {
      await formsApi.duplicate(id);
      loadForms(meta.page);
    } catch (err) {
      console.error('Failed to duplicate form', err);
    }
  };

  const handleDelete = async (id: string) => {
    setMenuOpen(null);
    if (!confirm('Delete this form? This cannot be undone.')) return;
    try {
      await formsApi.delete(id);
      loadForms(meta.page);
    } catch (err) {
      console.error('Failed to delete form', err);
    }
  };

  const getPublicUrl = (form: FormRecord) => {
    return `${window.location.origin}/f/${form.tenantSlug}/${form.token}`;
  };

  const copyLink = (form: FormRecord) => {
    setMenuOpen(null);
    navigator.clipboard.writeText(getPublicUrl(form));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Forms</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create and manage web forms for lead capture and data collection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCreate('standard')}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Form
          </button>
          <button
            onClick={() => handleCreate('meeting_booking')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Booking Page
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search forms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Forms Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : forms.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No forms yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create your first form to start collecting data</p>
          <button
            onClick={() => handleCreate()}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Create Form
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
            <div
              key={form.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold text-gray-900 dark:text-white truncate cursor-pointer hover:text-purple-600"
                    onClick={() => navigate(`/forms/${form.id}/builder`)}
                  >
                    {form.name}
                  </h3>
                  {form.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{form.description}</p>
                  )}
                </div>
                <div className="relative ml-2">
                  <button
                    onClick={() => setMenuOpen(menuOpen === form.id ? null : form.id)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen === form.id && (
                    <div className="absolute right-0 top-8 z-20 w-44 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg py-1">
                      <button
                        onClick={() => { setMenuOpen(null); navigate(`/forms/${form.id}/builder`); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                      >
                        <FileText className="w-4 h-4" /> Edit
                      </button>
                      <button
                        onClick={() => { setMenuOpen(null); navigate(`/forms/${form.id}/submissions`); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                      >
                        <BarChart3 className="w-4 h-4" /> Submissions
                      </button>
                      {form.status === 'active' && (
                        <>
                          <button
                            onClick={() => window.open(getPublicUrl(form), '_blank')}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                          >
                            <Eye className="w-4 h-4" /> Preview
                          </button>
                          <button
                            onClick={() => copyLink(form)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                          >
                            <ExternalLink className="w-4 h-4" /> Copy Link
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDuplicate(form.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                      >
                        <Copy className="w-4 h-4" /> Duplicate
                      </button>
                      <hr className="my-1 border-gray-200 dark:border-slate-700" />
                      <button
                        onClick={() => handleDelete(form.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className={`px-2 py-0.5 rounded-full font-medium ${statusColors[form.status] || ''}`}>
                  {form.status}
                </span>
                {form.type === 'meeting_booking' && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-medium">
                    Booking
                  </span>
                )}
                <span>{form.fields?.length || 0} fields</span>
                <span>{form.submissionCount} submissions</span>
              </div>

              {form.status === 'active' && (
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(getPublicUrl(form), '_blank'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyLink(form); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Copy Link
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEmbedForm(form); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5" /> Embed
                  </button>
                </div>
              )}

              {form.createdByName && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  by {form.createdByName} · {new Date(form.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {embedForm && (
        <EmbedModal form={embedForm} onClose={() => setEmbedForm(null)} />
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => loadForms(p)}
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
