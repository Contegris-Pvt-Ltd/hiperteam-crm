import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, CheckCircle, FileCheck, Trophy, Tag, ClipboardCheck,
  ChevronLeft, ChevronRight, X, AlertTriangle, Eye, DollarSign,
  Calendar, FileText,
} from 'lucide-react';
import { approvalsApi } from '../../api/approvals.api';
import type { ApprovalRequest } from '../../api/approvals.api';
import { proposalsApi } from '../../api/proposals.api';
import type { Proposal } from '../../api/proposals.api';

// ============================================================
// LABELS & ICONS
// ============================================================

const ENTITY_LABELS: Record<string, string> = {
  proposals: 'Proposal',
  opportunities: 'Opportunity',
  deals: 'Deal',
  leads: 'Lead',
};

const TRIGGER_LABELS: Record<string, string> = {
  publish: 'Publish',
  close_won: 'Close Won',
  discount_threshold: 'Discount Approval',
  manual: 'Manual Approval',
};

const TRIGGER_ICONS: Record<string, typeof FileCheck> = {
  publish: FileCheck,
  close_won: Trophy,
  discount_threshold: Tag,
  manual: ClipboardCheck,
};

const TRIGGER_COLORS: Record<string, string> = {
  publish: 'border-l-blue-500',
  close_won: 'border-l-green-500',
  discount_threshold: 'border-l-amber-500',
  manual: 'border-l-purple-500',
};

const ENTITY_ROUTES: Record<string, string> = {
  proposals: '/opportunities',
  opportunities: '/opportunities',
  leads: '/leads',
};

// ============================================================
// RELATIVE TIME HELPER
// ============================================================

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function ApprovalsQueuePage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actioning, setActioning] = useState<string | null>(null);
  const [commentModal, setCommentModal] = useState<{
    requestId: string;
    action: 'approve' | 'reject';
  } | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Proposal preview state
  const [previewProposal, setPreviewProposal] = useState<Proposal | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRequest, setPreviewRequest] = useState<ApprovalRequest | null>(null);

  // ── Load data ────────────────────────────────────────────────
  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await approvalsApi.getPending(page, 20);
      setRequests(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load pending approvals:', err);
      setError('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  // ── Actions ──────────────────────────────────────────────────
  const openModal = (requestId: string, action: 'approve' | 'reject') => {
    setCommentModal({ requestId, action });
    setComment('');
  };

  const closeModal = () => {
    setCommentModal(null);
    setComment('');
  };

  const handleConfirm = async () => {
    if (!commentModal) return;
    const { requestId, action } = commentModal;

    // Comment is required for reject
    if (action === 'reject' && !comment.trim()) return;

    setActioning(requestId);
    try {
      if (action === 'approve') {
        await approvalsApi.approve(requestId, comment.trim() || undefined);
      } else {
        await approvalsApi.reject(requestId, comment.trim());
      }
      closeModal();
      setPreviewProposal(null);
      setPreviewRequest(null);
      await loadData();
    } catch (err: any) {
      console.error(`Failed to ${action}:`, err);
      setError(err?.response?.data?.message || `Failed to ${action} request`);
    } finally {
      setActioning(null);
    }
  };

  const navigateToEntity = (req: ApprovalRequest) => {
    if (req.entityType === 'proposals' && req.parentEntityId) {
      navigate(`/opportunities/${req.parentEntityId}`);
      return;
    }
    const route = ENTITY_ROUTES[req.entityType];
    if (route) {
      navigate(`${route}/${req.entityId}`);
    }
  };

  // ── Proposal preview ────────────────────────────────────────
  const openPreview = async (req: ApprovalRequest) => {
    if (req.entityType !== 'proposals' || !req.parentEntityId) return;
    setPreviewLoading(true);
    setPreviewRequest(req);
    try {
      const proposal = await proposalsApi.getOne(req.parentEntityId, req.entityId);
      setPreviewProposal(proposal);
    } catch {
      setError('Failed to load proposal details');
      setPreviewRequest(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewProposal(null);
    setPreviewRequest(null);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Approval Queue</h1>
              <p className="text-gray-600 dark:text-slate-400">
                {total > 0 ? `${total} pending` : 'Review and action pending approvals'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={loadData} className="ml-auto text-red-600 dark:text-red-400 underline text-xs">
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : requests.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16">
          <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            You're all caught up!
          </h3>
          <p className="text-gray-500 dark:text-slate-400">
            No pending approvals at the moment.
          </p>
        </div>
      ) : (
        <>
          {/* Request Cards */}
          <div className="space-y-3">
            {requests.map((req) => {
              const TriggerIcon = TRIGGER_ICONS[req.triggerEvent] || ClipboardCheck;
              const borderColor = TRIGGER_COLORS[req.triggerEvent] || 'border-l-gray-400';
              const totalSteps = req.steps?.length || 0;

              return (
                <div
                  key={req.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 border-l-4 ${borderColor} p-4`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Badges Row */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 rounded text-xs font-medium">
                          {ENTITY_LABELS[req.entityType] || req.entityType}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 rounded text-xs font-medium">
                          <TriggerIcon className="w-3 h-3" />
                          {TRIGGER_LABELS[req.triggerEvent] || req.triggerEvent}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">
                          Step {req.currentStep} of {totalSteps}
                        </span>
                      </div>

                      {/* Entity Name / Link */}
                      <button
                        onClick={() => navigateToEntity(req)}
                        className="text-sm font-medium text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-left"
                      >
                        {req.entityName
                          ? `${ENTITY_LABELS[req.entityType] || req.entityType}: ${req.entityName}`
                          : `${ENTITY_LABELS[req.entityType] || req.entityType} \u00b7 ${req.entityId.slice(0, 8)}...`
                        }
                      </button>

                      {/* Requested by + time */}
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        Requested by {req.requestedByName || 'Unknown'} &middot; {relativeTime(req.createdAt)}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* View button for proposals */}
                      {req.entityType === 'proposals' && req.parentEntityId && (
                        <button
                          onClick={() => openPreview(req)}
                          disabled={previewLoading && previewRequest?.id === req.id}
                          className="px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {previewLoading && previewRequest?.id === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <span className="flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                              View
                            </span>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => openModal(req.id, 'reject')}
                        disabled={actioning === req.id}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => openModal(req.id, 'approve')}
                        disabled={actioning === req.id}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actioning === req.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Approve'
                        )}
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
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Comment Modal */}
      {commentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {commentModal.action === 'approve' ? 'Approve Request' : 'Reject Request'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Comment {commentModal.action === 'reject' ? '(required)' : '(optional)'}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={
                  commentModal.action === 'reject'
                    ? 'Please provide a reason for rejection...'
                    : 'Add an optional comment...'
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={
                  actioning !== null ||
                  (commentModal.action === 'reject' && !comment.trim())
                }
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                  commentModal.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {commentModal.action === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Preview Modal */}
      {(previewProposal || (previewLoading && previewRequest)) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Proposal Details
              </h3>
              <button
                onClick={closePreview}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {previewLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
              ) : previewProposal ? (
                <>
                  {/* Title + Status */}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {previewProposal.title}
                    </h2>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-slate-400">
                      {previewProposal.validUntil && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          Valid until {new Date(previewProposal.validUntil).toLocaleDateString('en-US', {
                            month: 'long', day: 'numeric', year: 'numeric',
                          })}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4" />
                        Total: {previewProposal.currency} {previewProposal.totalAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Cover Message */}
                  {previewProposal.coverMessage && (
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Cover Message</h4>
                      <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-wrap">
                        {previewProposal.coverMessage}
                      </p>
                    </div>
                  )}

                  {/* Line Items */}
                  {previewProposal.lineItems && previewProposal.lineItems.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        Line Items
                      </h4>
                      <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-slate-700/50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Description</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Qty</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Unit Price</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Discount</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {previewProposal.lineItems.map((item, i) => (
                              <tr key={item.id || i}>
                                <td className="px-4 py-2.5 text-gray-900 dark:text-white">{item.description}</td>
                                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-slate-400">{item.quantity}</td>
                                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-slate-400">
                                  {previewProposal.currency} {item.unitPrice.toLocaleString()}
                                </td>
                                <td className="px-4 py-2.5 text-right text-gray-600 dark:text-slate-400">
                                  {item.discount
                                    ? item.discountType === 'fixed'
                                      ? `${previewProposal.currency} ${item.discount}`
                                      : `${item.discount}%`
                                    : '\u2014'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">
                                  {previewProposal.currency} {(item.total ?? 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 dark:bg-slate-700/50 border-t-2 border-gray-200 dark:border-slate-600">
                            <tr>
                              <td colSpan={4} className="px-4 py-2.5 text-right font-semibold text-gray-700 dark:text-slate-300">Total</td>
                              <td className="px-4 py-2.5 text-right font-bold text-gray-900 dark:text-white">
                                {previewProposal.currency} {previewProposal.totalAmount.toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Terms */}
                  {previewProposal.terms && (
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Terms & Conditions</h4>
                      <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-wrap">
                        {previewProposal.terms}
                      </p>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer — Approve / Reject from preview */}
            {previewProposal && previewRequest && (
              <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    closePreview();
                    openModal(previewRequest.id, 'reject');
                  }}
                  className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => {
                    closePreview();
                    openModal(previewRequest.id, 'approve');
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
