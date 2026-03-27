import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Eye,
  Trash2,
  History,
  Mail,
  ChevronDown,
  ChevronRight,
  Loader2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { formsApi } from '../../api/forms.api';
import type { ModuleForm, EntityFormSubmission } from '../../api/forms.api';
import { FormFillModal } from './FormFillModal';
import { FormEmailModal } from './FormEmailModal';
import { formatDistanceToNow } from 'date-fns';

interface EntityFormsPanelProps {
  entityType: string;
  entityId: string;
  entityData: Record<string, any>;
}

export function EntityFormsPanel({ entityType, entityId, entityData }: EntityFormsPanelProps) {
  const [forms, setForms] = useState<ModuleForm[]>([]);
  const [submissions, setSubmissions] = useState<EntityFormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal states
  const [fillForm, setFillForm] = useState<ModuleForm | null>(null);
  const [viewSubmission, setViewSubmission] = useState<EntityFormSubmission | null>(null);
  const [emailForm, setEmailForm] = useState<ModuleForm | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [formsData, subsData] = await Promise.all([
        formsApi.getFormsForModule(entityType),
        formsApi.getEntitySubmissions(entityType, entityId),
      ]);
      setForms(formsData);
      setSubmissions(subsData);
    } catch (err) {
      console.error('Failed to load forms data', err);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (entityId) loadData();
  }, [entityId, loadData]);

  const toggleExpanded = (formId: string) => {
    setExpandedForms((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId);
      else next.add(formId);
      return next;
    });
  };

  const handleDelete = async (submissionId: string) => {
    setDeleting(true);
    try {
      await formsApi.deleteSubmission(submissionId);
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete submission', err);
    } finally {
      setDeleting(false);
    }
  };

  // Group submissions by formId
  const submissionsByForm = submissions.reduce<Record<string, EntityFormSubmission[]>>((acc, sub) => {
    if (!acc[sub.formId]) acc[sub.formId] = [];
    acc[sub.formId].push(sub);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
          <span className="ml-2 text-sm text-gray-500 dark:text-slate-400">Loading forms...</span>
        </div>
      </div>
    );
  }

  if (forms.length === 0) {
    return null; // Don't render panel if no forms available for this module
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Forms</h3>
            <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
              {forms.length}
            </span>
          </div>
        </div>

        {/* Form cards */}
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {forms.map((form) => {
            const formSubs = submissionsByForm[form.id] || [];
            const latestSub = formSubs[0]; // Already sorted by created_at DESC from API
            const isExpanded = expandedForms.has(form.id);

            return (
              <div key={form.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">{form.name}</h4>
                    </div>
                    {formSubs.length > 0 ? (
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 ml-6">
                        Submitted {formSubs.length} time{formSubs.length !== 1 ? 's' : ''}
                        {latestSub && (
                          <>
                            {' '}&middot; Last: {formatDistanceToNow(new Date(latestSub.createdAt), { addSuffix: true })}
                            {latestSub.submitterName && ` by ${latestSub.submitterName}`}
                            {!latestSub.submitterName && latestSub.filledByEmail && ` by ${latestSub.filledByEmail}`}
                          </>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 ml-6">Not filled yet</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                    {latestSub && (
                      <button
                        onClick={() => setViewSubmission(latestSub)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="View latest submission"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Latest
                      </button>
                    )}
                    {(form.allowMultipleSubmissions || formSubs.length === 0) && (
                      <button
                        onClick={() => setFillForm(form)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors"
                        title={formSubs.length > 0 ? 'Fill again' : 'Fill now'}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {formSubs.length > 0 ? 'Fill Again' : 'Fill Now'}
                      </button>
                    )}
                    <button
                      onClick={() => setEmailForm(form)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Send via email"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* History toggle */}
                {formSubs.length > 1 && (
                  <div className="mt-2 ml-6">
                    <button
                      onClick={() => toggleExpanded(form.id)}
                      className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <History className="w-3.5 h-3.5" />
                      History ({formSubs.length} submissions)
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 border-l-2 border-gray-200 dark:border-slate-600 pl-3">
                        {formSubs.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-400 py-1"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="flex-shrink-0">
                                {new Date(sub.createdAt).toLocaleDateString()}
                              </span>
                              <span className="text-gray-400 dark:text-slate-500">&mdash;</span>
                              <span className="truncate">
                                {sub.submitterName || sub.filledByEmail || 'Unknown'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  sub.status === 'submitted'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : sub.status === 'pending'
                                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
                                }`}
                              >
                                {sub.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                              <button
                                onClick={() => setViewSubmission(sub)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                                title="View"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {deleteConfirmId === sub.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(sub.id)}
                                    disabled={deleting}
                                    className="px-2 py-0.5 text-[10px] bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                                  >
                                    {deleting ? '...' : 'Confirm'}
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-2 py-0.5 text-[10px] bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(sub.id)}
                                  className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Single submission — show delete inline */}
                {formSubs.length === 1 && (
                  <div className="mt-1 ml-6">
                    {deleteConfirmId === formSubs[0].id ? (
                      <div className="flex items-center gap-2 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-red-600 dark:text-red-400">Delete this submission?</span>
                        <button
                          onClick={() => handleDelete(formSubs[0].id)}
                          disabled={deleting}
                          className="px-2 py-0.5 text-[10px] bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                        >
                          {deleting ? '...' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-0.5 text-[10px] bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(formSubs[0].id)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fill Form Modal */}
      {fillForm && (
        <FormFillModal
          form={fillForm}
          entityType={entityType}
          entityId={entityId}
          onClose={() => setFillForm(null)}
          onSubmitted={() => {
            setFillForm(null);
            loadData();
          }}
        />
      )}

      {/* View Submission Modal (read-only) */}
      {viewSubmission && (
        <FormFillModal
          form={{
            id: viewSubmission.formId,
            name: viewSubmission.formName,
            fields: viewSubmission.formFields || [],
          }}
          entityType={entityType}
          entityId={entityId}
          existingData={viewSubmission.data}
          readOnly
          onClose={() => setViewSubmission(null)}
          onSubmitted={() => {}}
        />
      )}

      {/* Email Modal */}
      {emailForm && (
        <FormEmailModal
          form={emailForm}
          entityType={entityType}
          entityId={entityId}
          entityData={entityData}
          onClose={() => setEmailForm(null)}
          onSent={() => {
            setEmailForm(null);
            loadData();
          }}
        />
      )}
    </>
  );
}
