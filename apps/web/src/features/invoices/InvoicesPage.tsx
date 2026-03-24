import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Receipt, Search, Download, Loader2,
  ChevronLeft, ChevronRight,
  Building2, AlertCircle, CheckCircle,
  Clock, XCircle, DollarSign, RefreshCw,
  Eye, Mail, X, Send,
} from 'lucide-react';
import { invoicesApi } from '../../api/invoices.api';
import type { Invoice } from '../../api/invoices.api';

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  draft:          { label: 'Draft',          badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',       icon: <Clock className="w-3 h-3" /> },
  sent:           { label: 'Sent',           badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',     icon: <CheckCircle className="w-3 h-3" /> },
  partially_paid: { label: 'Partially Paid', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <DollarSign className="w-3 h-3" /> },
  paid:           { label: 'Paid',           badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="w-3 h-3" /> },
  overdue:        { label: 'Overdue',        badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',         icon: <AlertCircle className="w-3 h-3" /> },
  cancelled:      { label: 'Cancelled',      badge: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',       icon: <XCircle className="w-3 h-3" /> },
  void:           { label: 'Void',           badge: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',       icon: <XCircle className="w-3 h-3" /> },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'void', label: 'Void' },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  credit_card: 'Credit Card',
  cash: 'Cash',
  cheque: 'Cheque',
  paypal: 'PayPal',
  stripe: 'Stripe',
  other: 'Other',
};

function fmt(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isPastDue(inv: Invoice) {
  return inv.dueDate && inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'void'
    && new Date(inv.dueDate) < new Date();
}

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloading, setDownloading] = useState<string | null>(null);

  // Detail panel
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Email modal
  const [sendEmailInvoice, setSendEmailInvoice] = useState<Invoice | null>(null);

  // Xero push
  const [pushingXero, setPushingXero] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoicesApi.getAll({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        limit,
      });
      setInvoices(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch {
      console.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const handleDownload = async (invoice: Invoice) => {
    setDownloading(invoice.id);
    try {
      const blob = await invoicesApi.downloadPdf(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      console.error('Failed to download');
    } finally {
      setDownloading(null);
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDetailLoading(true);
    try {
      const full = await invoicesApi.getOne(invoice.id);
      setSelectedInvoice(full);
    } catch {
      console.error('Failed to load invoice detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePushXero = async (invoiceId: string) => {
    setPushingXero(invoiceId);
    try {
      await invoicesApi.pushToXero(invoiceId);
      await loadInvoices();
    } catch {
      console.error('Failed to push to Xero');
    } finally {
      setPushingXero(null);
    }
  };

  const filtered = invoices.filter(inv =>
    !search ||
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    inv.title.toLowerCase().includes(search.toLowerCase()) ||
    inv.accountName?.toLowerCase().includes(search.toLowerCase()) ||
    inv.contactName?.toLowerCase().includes(search.toLowerCase())
  );

  // Summary stats from loaded data
  const totalValue = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalDue = invoices.reduce((s, i) => s + i.amountDue, 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  const startIdx = (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full">
                {total}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400">Invoices are created from Opportunities</p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total Invoices</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Total Value</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{fmt(totalValue)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Amount Due</p>
          <p className={`text-xl sm:text-2xl font-bold ${totalDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {fmt(totalDue)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Overdue</p>
          <p className={`text-xl sm:text-2xl font-bold ${overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
            {overdueCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={loadInvoices}
          className="p-2 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 dark:border-slate-700 last:border-0 animate-pulse">
              <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <Receipt className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No invoices found</h3>
          <p className="text-gray-500 dark:text-slate-400">
            {search || statusFilter !== 'all'
              ? 'Try changing your filters'
              : 'Invoices are created from Opportunities'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Invoice #</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Title</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Client</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Amount Due</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Due Date</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filtered.map(inv => {
                  const sc = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                  const pastDue = isPastDue(inv);
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          {inv.opportunityId ? (
                            <Link
                              to={`/opportunities/${inv.opportunityId}`}
                              className="font-mono text-sm text-purple-600 dark:text-purple-400 hover:underline"
                            >
                              {inv.invoiceNumber}
                            </Link>
                          ) : (
                            <span className="font-mono text-sm text-gray-900 dark:text-white">{inv.invoiceNumber}</span>
                          )}
                          {inv.xeroInvoiceId && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                              Xero
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm text-gray-900 dark:text-white truncate block max-w-[200px]">{inv.title}</span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          {inv.accountId ? (
                            <Link
                              to={`/accounts/${inv.accountId}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium truncate max-w-[150px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {inv.accountName || 'Account'}
                            </Link>
                          ) : inv.contactId ? (
                            <Link
                              to={`/contacts/${inv.contactId}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium truncate max-w-[150px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {inv.contactName || 'Contact'}
                            </Link>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${sc.badge}`}>
                          {sc.icon} {sc.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {fmt(inv.totalAmount, inv.currency)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className={`text-sm font-medium ${
                          inv.amountDue === 0
                            ? 'text-green-600 dark:text-green-400'
                            : pastDue
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-900 dark:text-white'
                        }`}>
                          {fmt(inv.amountDue, inv.currency)}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-sm ${pastDue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-slate-300'}`}>
                          {fmtDate(inv.dueDate)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewInvoice(inv); }}
                            className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {/* PDF */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(inv); }}
                            disabled={downloading === inv.id}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors disabled:opacity-50"
                            title="Download PDF"
                          >
                            {downloading === inv.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Download className="w-4 h-4" />}
                          </button>
                          {/* Email */}
                          {['sent', 'partially_paid', 'overdue', 'paid'].includes(inv.status) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSendEmailInvoice(inv); }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                              title="Send Email"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          )}
                          {/* Xero */}
                          {!inv.xeroInvoiceId && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePushXero(inv.id); }}
                              disabled={pushingXero === inv.id}
                              className="px-1.5 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50"
                              title="Push to Xero"
                            >
                              {pushingXero === inv.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : 'Xero'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(inv => {
              const sc = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
              const pastDue = isPastDue(inv);
              return (
                <div
                  key={inv.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 cursor-pointer"
                  onClick={() => handleViewInvoice(inv)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {inv.opportunityId ? (
                          <Link
                            to={`/opportunities/${inv.opportunityId}`}
                            className="font-mono text-sm text-purple-600 dark:text-purple-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {inv.invoiceNumber}
                          </Link>
                        ) : (
                          <span className="font-mono text-sm text-gray-900 dark:text-white">{inv.invoiceNumber}</span>
                        )}
                        {inv.xeroInvoiceId && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                            Xero
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{inv.title}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${sc.badge}`}>
                      {sc.icon} {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                    {inv.accountName || inv.contactName || '—'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{fmt(inv.totalAmount, inv.currency)}</p>
                      {inv.amountDue > 0 && (
                        <p className={`text-xs ${pastDue ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
                          Due: {fmt(inv.amountDue, inv.currency)}
                          {inv.dueDate && ` by ${fmtDate(inv.dueDate)}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(inv); }}
                        disabled={downloading === inv.id}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg border border-gray-200 dark:border-slate-600 disabled:opacity-50"
                        title="Download PDF"
                      >
                        {downloading === inv.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Download className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Showing {startIdx}–{endIdx} of {total} invoices
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Slide-over */}
      {selectedInvoice && (
        <InvoiceDetailPanel
          invoice={selectedInvoice}
          loading={detailLoading}
          onClose={() => setSelectedInvoice(null)}
          onRefresh={loadInvoices}
          onDownload={handleDownload}
          onSendEmail={setSendEmailInvoice}
          onPushXero={handlePushXero}
          pushingXero={pushingXero}
          downloading={downloading}
        />
      )}

      {/* Send Email Modal */}
      {sendEmailInvoice && (
        <SendInvoiceEmailModal
          invoice={sendEmailInvoice}
          onClose={() => setSendEmailInvoice(null)}
          onSent={() => { setSendEmailInvoice(null); loadInvoices(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Invoice Detail Slide-over Panel
// ============================================================

interface InvoiceDetailPanelProps {
  invoice: Invoice;
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onDownload: (inv: Invoice) => void;
  onSendEmail: (inv: Invoice) => void;
  onPushXero: (invoiceId: string) => void;
  pushingXero: string | null;
  downloading: string | null;
}

function InvoiceDetailPanel({
  invoice, loading, onClose, onRefresh: _onRefresh, onDownload, onSendEmail, onPushXero, pushingXero, downloading,
}: InvoiceDetailPanelProps) {
  const sc = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-[480px] max-w-full bg-white dark:bg-slate-800 shadow-2xl flex flex-col animate-slideInRight overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-lg font-bold text-gray-900 dark:text-white">{invoice.invoiceNumber}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${sc.badge}`}>
                {sc.icon} {sc.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{invoice.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
            </div>
          ) : (
            <>
              {/* Section 1 — Summary */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-slate-400">Title</span>
                    <span className="text-gray-900 dark:text-white font-medium text-right max-w-[250px] truncate">{invoice.title}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-slate-400">Client</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {invoice.accountName || invoice.contactName || '—'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5">
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">Issue Date</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{fmtDate(invoice.issueDate)}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5">
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">Due Date</p>
                      <p className={`text-sm font-medium ${isPastDue(invoice) ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {fmtDate(invoice.dueDate)}
                      </p>
                    </div>
                  </div>
                  {invoice.createdByName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-slate-400">Created by</span>
                      <span className="text-gray-900 dark:text-white">{invoice.createdByName}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-slate-400">Created at</span>
                    <span className="text-gray-900 dark:text-white">{fmtDate(invoice.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Section 2 — Amounts */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Amounts</h3>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-slate-400 text-xs">Subtotal</p>
                      <p className="font-medium text-gray-900 dark:text-white">{fmt(invoice.subtotal, invoice.currency)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-slate-400 text-xs">Discount</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {invoice.discountAmount > 0 ? `-${fmt(invoice.discountAmount, invoice.currency)}` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-slate-400 text-xs">Tax</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {invoice.taxAmount > 0 ? fmt(invoice.taxAmount, invoice.currency) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-slate-400 text-xs">Total</p>
                      <p className="font-bold text-gray-900 dark:text-white">{fmt(invoice.totalAmount, invoice.currency)}</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 dark:border-slate-600 pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-slate-400">Amount Paid</span>
                      <span className={`font-medium ${invoice.amountPaid > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                        {fmt(invoice.amountPaid, invoice.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-slate-400">Amount Due</span>
                      <span className={`font-bold ${invoice.amountDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {fmt(invoice.amountDue, invoice.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3 — Line Items */}
              {invoice.lineItems && invoice.lineItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Line Items ({invoice.lineItems.length})
                  </h3>
                  <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                          <th className="text-left px-3 py-2 text-gray-500 dark:text-slate-400 font-medium">Description</th>
                          <th className="text-right px-3 py-2 text-gray-500 dark:text-slate-400 font-medium">Qty</th>
                          <th className="text-right px-3 py-2 text-gray-500 dark:text-slate-400 font-medium">Price</th>
                          <th className="text-right px-3 py-2 text-gray-500 dark:text-slate-400 font-medium">Disc</th>
                          <th className="text-right px-3 py-2 text-gray-500 dark:text-slate-400 font-medium">Tax</th>
                          <th className="text-right px-3 py-2 text-gray-500 dark:text-slate-400 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {invoice.lineItems.map((li, idx) => (
                          <tr key={li.id || idx}>
                            <td className="px-3 py-2 text-gray-900 dark:text-white max-w-[160px] truncate">{li.description}</td>
                            <td className="px-3 py-2 text-right text-gray-600 dark:text-slate-300">{li.quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-600 dark:text-slate-300">{fmt(li.unitPrice, invoice.currency)}</td>
                            <td className="px-3 py-2 text-right text-gray-600 dark:text-slate-300">
                              {li.discount ? (li.discountType === 'percentage' ? `${li.discount}%` : fmt(li.discount, invoice.currency)) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600 dark:text-slate-300">
                              {li.taxRate ? `${li.taxRate}%` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                              {li.total != null ? fmt(li.total, invoice.currency) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section 4 — Payments */}
              {invoice.payments && invoice.payments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Payment History ({invoice.payments.length})
                  </h3>
                  <div className="space-y-2">
                    {invoice.payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                            {PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}
                          </span>
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            {fmt(p.amount, p.currency)}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-slate-400">{fmtDate(p.paidAt)}</p>
                          {p.reference && (
                            <p className="text-[10px] text-gray-400 truncate max-w-[120px]">Ref: {p.reference}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 5 — Xero */}
              {invoice.xeroInvoiceId && (
                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full">
                    Xero
                  </span>
                  <span className="text-xs text-blue-700 dark:text-blue-400">
                    Synced — {invoice.xeroInvoiceId.slice(0, 8)}...
                  </span>
                </div>
              )}

              {/* Notes / Terms */}
              {(invoice.notes || invoice.terms) && (
                <div className="space-y-3">
                  {invoice.notes && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Notes</h3>
                      <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{invoice.notes}</p>
                    </div>
                  )}
                  {invoice.terms && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Terms</h3>
                      <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{invoice.terms}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 px-6 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <button
            onClick={() => onDownload(invoice)}
            disabled={downloading === invoice.id}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {downloading === invoice.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download PDF
          </button>
          <button
            onClick={() => onSendEmail(invoice)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            <Mail className="w-3.5 h-3.5" /> Send Email
          </button>
          {!invoice.xeroInvoiceId && (
            <button
              onClick={() => onPushXero(invoice.id)}
              disabled={pushingXero === invoice.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
            >
              {pushingXero === invoice.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Push to Xero
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Send Invoice Email Modal
// ============================================================

interface SendInvoiceEmailModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSent: () => void;
}

function SendInvoiceEmailModal({ invoice, onClose, onSent }: SendInvoiceEmailModalProps) {
  const [toInput, setToInput] = useState(invoice.contactEmail || '');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [subject, setSubject] = useState(`Invoice ${invoice.invoiceNumber}`);
  const [sending, setSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);

  const parseEmails = (input: string): string[] =>
    input.split(',').map(e => e.trim()).filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  const handleSend = async () => {
    const to = parseEmails(toInput);
    if (to.length === 0) return;
    setSending(true);
    try {
      const cc = parseEmails(ccInput);
      const bcc = parseEmails(bccInput);
      await invoicesApi.sendByEmail(invoice.id, {
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject: subject.trim() || undefined,
      });
      onSent();
    } catch (err) {
      console.error('Failed to send invoice email:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-purple-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Send Invoice</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {invoice.invoiceNumber} — {fmt(invoice.amountDue, invoice.currency)} due
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* To */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">To *</label>
              {!showCcBcc && (
                <button onClick={() => setShowCcBcc(true)} className="text-xs text-purple-600 hover:underline">
                  CC / BCC
                </button>
              )}
            </div>
            <input
              value={toInput}
              onChange={e => setToInput(e.target.value)}
              placeholder="email@example.com, ..."
              className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* CC */}
          {showCcBcc && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">CC</label>
              <input
                value={ccInput}
                onChange={e => setCcInput(e.target.value)}
                placeholder="email@example.com, ..."
                className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* BCC */}
          {showCcBcc && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">BCC</label>
              <input
                value={bccInput}
                onChange={e => setBccInput(e.target.value)}
                placeholder="email@example.com, ..."
                className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Info */}
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <p><strong>Invoice:</strong> {invoice.invoiceNumber} — {invoice.title}</p>
            <p><strong>Amount:</strong> {invoice.currency} {invoice.totalAmount.toFixed(2)}</p>
            {invoice.dueDate && <p><strong>Due:</strong> {new Date(invoice.dueDate).toLocaleDateString()}</p>}
            <p className="text-[10px] text-gray-400">PDF will be attached automatically</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !toInput.trim()}
            className="px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Send Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
