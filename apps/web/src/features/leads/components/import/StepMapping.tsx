import { useState } from 'react';
import { Save, FileDown, AlertCircle, CheckCircle2, ArrowRight, Trash2, Pencil, Check, X } from 'lucide-react';
import { leadImportApi } from '../../../../api/lead-import.api';
import type { LeadFieldOption, MappingTemplate, SaveTemplateData } from '../../../../api/lead-import.api';

interface StepMappingProps {
  headers: string[];
  mapping: Record<string, string>;
  leadFieldOptions: LeadFieldOption[];
  matchingTemplates: MappingTemplate[];
  onMappingChange: (mapping: Record<string, string>) => void;
}

export default function StepMapping({
  headers,
  mapping,
  leadFieldOptions,
  matchingTemplates,
  onMappingChange,
}: StepMappingProps) {
  const [templates, setTemplates] = useState<MappingTemplate[]>(matchingTemplates);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [_loadingTemplates, setLoadingTemplates] = useState(false);
  const [allTemplates, setAllTemplates] = useState<MappingTemplate[] | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState('');
  const [editingUpdateMapping, setEditingUpdateMapping] = useState(false);
  const [updatingTemplateId, setUpdatingTemplateId] = useState<string | null>(null);

  const handleFieldChange = (header: string, value: string) => {
    onMappingChange({ ...mapping, [header]: value });
  };

  const loadAllTemplates = async () => {
    if (allTemplates) return;
    setLoadingTemplates(true);
    try {
      const result = await leadImportApi.getTemplates();
      setAllTemplates(result);
    } catch {
      // ignore
    }
    setLoadingTemplates(false);
  };

  const deleteTemplate = async (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    setDeletingTemplateId(templateId);
    try {
      await leadImportApi.deleteTemplate(templateId);
      setAllTemplates(prev => prev ? prev.filter(t => t.id !== templateId) : null);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch {
      // ignore
    }
    setDeletingTemplateId(null);
  };

  const startEditTemplate = (e: React.MouseEvent, t: MappingTemplate) => {
    e.stopPropagation();
    setEditingTemplateId(t.id);
    setEditingTemplateName(t.name);
    setEditingUpdateMapping(false);
  };

  const confirmEditTemplate = async (e: React.MouseEvent, t: MappingTemplate) => {
    e.stopPropagation();
    if (!editingTemplateName.trim()) return;
    setUpdatingTemplateId(t.id);
    try {
      await leadImportApi.updateTemplate(t.id, {
        name: editingTemplateName.trim(),
        columnMapping: editingUpdateMapping ? mapping : t.columnMapping,
        fileHeaders: editingUpdateMapping ? headers : (t.fileHeaders || []),
      });
      const updated = { ...t, name: editingTemplateName.trim() };
      setAllTemplates(prev => prev ? prev.map(x => x.id === t.id ? updated : x) : null);
      setTemplates(prev => prev.map(x => x.id === t.id ? updated : x));
    } catch {
      // ignore
    }
    setUpdatingTemplateId(null);
    setEditingTemplateId(null);
  };

  const applyTemplate = (template: MappingTemplate) => {
    const newMapping = { ...mapping };
    for (const header of headers) {
      if (template.columnMapping[header]) {
        newMapping[header] = template.columnMapping[header];
      }
    }
    onMappingChange(newMapping);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      const data: SaveTemplateData = {
        name: templateName.trim(),
        columnMapping: mapping,
        fileHeaders: headers,
      };
      const saved = await leadImportApi.saveTemplate(data);
      setTemplates([...templates, saved]);
      setShowSaveTemplate(false);
      setTemplateName('');
    } catch {
      // ignore
    }
    setSaving(false);
  };

  // Determine which fields are mapped
  const mappedFields = new Set(Object.values(mapping).filter(v => v && v !== '__skip__'));
  const hasRequiredField = mappedFields.has('lastName') || mappedFields.has('email') || mappedFields.has('phone');

  // Track field assignment counts and per-header priority (for multi-column fallback)
  const fieldCounts: Record<string, number> = {};
  const fieldPriority: Record<string, number> = {}; // header → priority (1st, 2nd, 3rd)
  const fieldSeenOrder: Record<string, string[]> = {}; // field → headers in order
  for (const header of headers) {
    const val = mapping[header];
    if (val && val !== '__skip__') {
      if (!fieldSeenOrder[val]) fieldSeenOrder[val] = [];
      fieldSeenOrder[val].push(header);
      fieldCounts[val] = (fieldCounts[val] || 0) + 1;
      fieldPriority[header] = fieldCounts[val];
    }
  }
  // Fields with >3 columns are over the limit
  const overLimitFields = Object.entries(fieldCounts).filter(([, c]) => c > 3).map(([f]) => f);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Map Columns</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Match your file columns to lead fields. You can map up to 3 columns to the same field — the first non-empty value will be used.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Load Template */}
          <div className="relative">
            <button
              onClick={loadAllTemplates}
              className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <FileDown size={14} />
              Load Template
            </button>
            {allTemplates && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                <div className="p-2">
                  {allTemplates.length === 0 ? (
                    <p className="text-xs text-gray-500 p-2">No saved templates</p>
                  ) : (
                    allTemplates.map(t => (
                      <div key={t.id} className="group">
                        {editingTemplateId === t.id ? (
                          <div className="px-2 py-2 space-y-1.5" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              type="text"
                              value={editingTemplateName}
                              onChange={e => setEditingTemplateName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') confirmEditTemplate(e as any, t); if (e.key === 'Escape') setEditingTemplateId(null); }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                            />
                            <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingUpdateMapping}
                                onChange={e => setEditingUpdateMapping(e.target.checked)}
                                className="rounded"
                              />
                              Update mapping to current
                            </label>
                            <div className="flex gap-1">
                              <button
                                onClick={e => confirmEditTemplate(e, t)}
                                disabled={updatingTemplateId === t.id || !editingTemplateName.trim()}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                              >
                                <Check size={11} />
                                {updatingTemplateId === t.id ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setEditingTemplateId(null); }}
                                className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400"
                              >
                                <X size={11} />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <button
                              onClick={() => { applyTemplate(t); setAllTemplates(null); }}
                              className="flex-1 text-left px-3 py-2 text-sm rounded-l hover:bg-gray-100 dark:hover:bg-slate-800"
                            >
                              {t.name}
                            </button>
                            <button
                              onClick={e => startEditTemplate(e, t)}
                              className="px-2 py-2 text-gray-400 hover:text-purple-500 hover:bg-gray-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Edit template"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={e => deleteTemplate(e, t.id)}
                              disabled={deletingTemplateId === t.id}
                              className="px-2 py-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-r opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                              title="Delete template"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t dark:border-gray-700 p-2">
                  <button
                    onClick={() => setAllTemplates(null)}
                    className="w-full text-center text-xs text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Save Template */}
          <button
            onClick={() => setShowSaveTemplate(!showSaveTemplate)}
            className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
          >
            <Save size={14} />
            Save Template
          </button>
        </div>
      </div>

      {/* Matching template suggestions */}
      {templates.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
            Matching templates found:
          </p>
          <div className="flex gap-2 flex-wrap">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save template form */}
      {showSaveTemplate && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <input
            type="text"
            placeholder="Template name (e.g., Facebook Leads)"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          />
          <button
            onClick={saveTemplate}
            disabled={saving || !templateName.trim()}
            className="text-sm px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setShowSaveTemplate(false)}
            className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Validation messages */}
      {!hasRequiredField && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            You must map at least one of: Last Name, Email, or Phone
          </p>
        </div>
      )}

      {overLimitFields.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            Maximum 3 columns per field exceeded: {overLimitFields.map(f => leadFieldOptions.find(o => o.value === f)?.label || f).join(', ')}
          </p>
        </div>
      )}

      {/* Column mapping table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800">
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-1/3">File Column</th>
              <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-3 w-10"></th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-1/3">Lead Field</th>
              <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-10">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {headers.map((header, idx) => {
              const selectedField = mapping[header] || '__skip__';
              const isSkipped = selectedField === '__skip__';
              const priority = fieldPriority[header] || 0;
              const isMultiColumn = !isSkipped && fieldCounts[selectedField] > 1;
              const isOverLimit = !isSkipped && fieldCounts[selectedField] > 3;
              const priorityLabels = ['', '1st', '2nd', '3rd'];

              return (
                <tr key={idx} className={isSkipped ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{header}</span>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <ArrowRight size={14} className="text-gray-400 mx-auto" />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={selectedField}
                      onChange={e => handleFieldChange(header, e.target.value)}
                      className={`w-full text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500 ${
                        isOverLimit
                          ? 'border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                          : 'border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white'
                      }`}
                    >
                      {leadFieldOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSkipped ? (
                      <span className="text-xs text-gray-400">Skipped</span>
                    ) : isOverLimit ? (
                      <AlertCircle size={16} className="text-red-500 mx-auto" />
                    ) : isMultiColumn ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                        {priorityLabels[priority] || `#${priority}`}
                      </span>
                    ) : (
                      <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
