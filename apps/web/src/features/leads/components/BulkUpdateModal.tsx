import { useState, useEffect } from 'react';
import { X, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { leadsApi, leadSettingsApi } from '../../../api/leads.api';
import type { LeadsQuery, LeadStage, LeadPriority, Pipeline, QualificationField } from '../../../api/leads.api';
import type { TeamLookupItem } from '../../../api/teams.api';
import type { CustomField } from '../../../api/admin.api';
import { adminApi } from '../../../api/admin.api';
import { api } from '../../../api/contacts.api';

interface BulkUpdateModalProps {
  selectedIds: string[];
  selectAllMode: boolean;
  filters?: LeadsQuery;
  totalCount: number;
  stages: LeadStage[];
  priorities: LeadPriority[];
  sources: { id: string; name: string }[];
  pipelines: Pipeline[];
  teams: TeamLookupItem[];
  onClose: () => void;
  onComplete: () => void;
}

interface FieldState {
  enabled: boolean;
  value: any;
}

type SectionKey = 'lead' | 'basic' | 'address' | 'qualification' | 'custom' | 'communication';

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh','Belgium',
  'Brazil','Canada','China','Colombia','Denmark','Egypt','Finland','France','Germany','Ghana',
  'Greece','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan',
  'Kenya','Kuwait','Lebanon','Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria',
  'Norway','Oman','Pakistan','Peru','Philippines','Poland','Portugal','Qatar','Romania',
  'Russia','Saudi Arabia','Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden',
  'Switzerland','Thailand','Turkey','UAE','UK','USA','Ukraine','Vietnam',
];

export default function BulkUpdateModal({
  selectedIds, selectAllMode, filters, totalCount,
  stages, priorities, sources, pipelines, teams,
  onClose, onComplete,
}: BulkUpdateModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [qualificationFields, setQualificationFields] = useState<QualificationField[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  // Collapsed sections
  const [collapsedSections, setCollapsedSections] = useState<Set<SectionKey>>(
    new Set(['basic', 'address', 'qualification', 'custom', 'communication'])
  );

  // Each field has an enable toggle + value
  const [fields, setFields] = useState<Record<string, FieldState>>({
    // Lead details
    ownerId: { enabled: false, value: '' },
    teamId: { enabled: false, value: '' },
    pipelineId: { enabled: false, value: '' },
    stageId: { enabled: false, value: '' },
    priorityId: { enabled: false, value: '' },
    source: { enabled: false, value: '' },
    tags: { enabled: false, value: '' },
    tagMode: { enabled: false, value: 'add' },
    // Basic info
    company: { enabled: false, value: '' },
    jobTitle: { enabled: false, value: '' },
    website: { enabled: false, value: '' },
    // Address
    addressLine1: { enabled: false, value: '' },
    addressLine2: { enabled: false, value: '' },
    city: { enabled: false, value: '' },
    state: { enabled: false, value: '' },
    postalCode: { enabled: false, value: '' },
    country: { enabled: false, value: '' },
    // Communication
    doNotContact: { enabled: false, value: false },
    doNotEmail: { enabled: false, value: false },
    doNotCall: { enabled: false, value: false },
  });

  // Qualification fields values (dynamic)
  const [qualificationValues, setQualificationValues] = useState<Record<string, any>>({});
  const [qualificationEnabled, setQualificationEnabled] = useState<Record<string, boolean>>({});

  // Custom field values (dynamic)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [customFieldEnabled, setCustomFieldEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const [usersRes, frameworks, cfData] = await Promise.all([
          api.get('/users?limit=200&status=active'),
          leadSettingsApi.getQualificationFrameworks(),
          adminApi.getCustomFields('leads'),
        ]);
        setUsers((usersRes.data.data || usersRes.data || []).map((u: any) => ({
          id: u.id, firstName: u.firstName || u.first_name, lastName: u.lastName || u.last_name,
        })));
        const activeFw = frameworks.find((f: any) => f.isActive);
        if (activeFw?.fields) {
          setQualificationFields(activeFw.fields);
        }
        setCustomFields((cfData || []).filter((f: CustomField) => f.isActive));
      } catch { /* ignore */ }
      setLoadingLookups(false);
    })();
  }, []);

  const toggleSection = (key: SectionKey) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleField = (key: string) => {
    setFields(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  };

  const setFieldValue = (key: string, value: any) => {
    setFields(prev => ({ ...prev, [key]: { ...prev[key], value } }));
  };

  const toggleQualification = (fieldKey: string) => {
    setQualificationEnabled(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const setQualificationValue = (fieldKey: string, value: any) => {
    setQualificationValues(prev => ({ ...prev, [fieldKey]: value }));
  };

  const toggleCustomField = (fieldKey: string) => {
    setCustomFieldEnabled(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const setCustomFieldValue = (fieldKey: string, value: any) => {
    setCustomFieldValues(prev => ({ ...prev, [fieldKey]: value }));
  };

  // Count enabled fields
  const standardEnabled = Object.entries(fields)
    .filter(([key, f]) => f.enabled && key !== 'tagMode')
    .length;
  const qualEnabled = Object.values(qualificationEnabled).filter(Boolean).length;
  const customEnabled = Object.values(customFieldEnabled).filter(Boolean).length;
  const effectiveEnabled = standardEnabled + qualEnabled + customEnabled;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const updates: Record<string, any> = {};

    // Standard fields
    const stringFields = ['ownerId', 'teamId', 'pipelineId', 'stageId', 'priorityId', 'source',
      'company', 'jobTitle', 'website', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country'];
    for (const key of stringFields) {
      if (fields[key]?.enabled) updates[key] = fields[key].value || '';
    }

    // Tags
    if (fields.tags.enabled && fields.tags.value) {
      updates.tags = fields.tags.value.split(',').map((t: string) => t.trim()).filter(Boolean);
      updates.tagMode = fields.tagMode.value || 'add';
    }

    // Booleans
    if (fields.doNotContact.enabled) updates.doNotContact = fields.doNotContact.value;
    if (fields.doNotEmail.enabled) updates.doNotEmail = fields.doNotEmail.value;
    if (fields.doNotCall.enabled) updates.doNotCall = fields.doNotCall.value;

    // Qualification
    const qualUpdates: Record<string, any> = {};
    for (const [key, enabled] of Object.entries(qualificationEnabled)) {
      if (enabled) qualUpdates[key] = qualificationValues[key] ?? '';
    }
    if (Object.keys(qualUpdates).length > 0) {
      updates.qualification = qualUpdates;
    }

    // Custom fields
    const cfUpdates: Record<string, any> = {};
    for (const [key, enabled] of Object.entries(customFieldEnabled)) {
      if (enabled) cfUpdates[key] = customFieldValues[key] ?? '';
    }
    if (Object.keys(cfUpdates).length > 0) {
      updates.customFields = cfUpdates;
    }

    if (Object.keys(updates).length === 0) {
      setError('Select at least one field to update');
      setSubmitting(false);
      return;
    }

    try {
      const payload: any = { updates };
      if (selectAllMode && filters) {
        payload.selectAll = true;
        // Strip pagination/sort fields — backend DTO only accepts filter fields
        const { page, limit, view, sortBy, sortOrder, ...filterOnly } = filters;
        payload.filters = filterOnly;
      } else {
        payload.leadIds = selectedIds;
      }
      await leadsApi.bulkUpdate(payload);
      onComplete();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update leads');
    }
    setSubmitting(false);
  };

  // Filter stages by selected pipeline
  const filteredStages = fields.pipelineId.enabled && fields.pipelineId.value
    ? stages.filter(s => s.pipelineId === fields.pipelineId.value)
    : stages;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Update</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Update {totalCount.toLocaleString()} lead{totalCount !== 1 ? 's' : ''}
              {effectiveEnabled > 0 && <span className="text-blue-600 dark:text-blue-400 ml-1">({effectiveEnabled} field{effectiveEnabled !== 1 ? 's' : ''} selected)</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {loadingLookups ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-gray-500">Loading fields...</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Enable the fields you want to update. Only enabled fields will be changed.
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400 mb-3">
                  {error}
                </div>
              )}

              {/* ── Lead Details Section ── */}
              <SectionHeader
                label="Lead Details"
                collapsed={collapsedSections.has('lead')}
                onToggle={() => toggleSection('lead')}
              />
              {!collapsedSections.has('lead') && (
                <div className="space-y-2 mb-3">
                  <FieldRow label="Owner" enabled={fields.ownerId.enabled} onToggle={() => toggleField('ownerId')}>
                    <select value={fields.ownerId.value} onChange={e => setFieldValue('ownerId', e.target.value)} className="field-input">
                      <option value="">Select user...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                    </select>
                  </FieldRow>

                  <FieldRow label="Team" enabled={fields.teamId.enabled} onToggle={() => toggleField('teamId')}>
                    <select value={fields.teamId.value} onChange={e => setFieldValue('teamId', e.target.value)} className="field-input">
                      <option value="">Select team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </FieldRow>

                  {pipelines.length > 1 && (
                    <FieldRow label="Pipeline" enabled={fields.pipelineId.enabled} onToggle={() => toggleField('pipelineId')}>
                      <select value={fields.pipelineId.value} onChange={e => { setFieldValue('pipelineId', e.target.value); setFieldValue('stageId', ''); }} className="field-input">
                        <option value="">Select pipeline...</option>
                        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FieldRow>
                  )}

                  <FieldRow label="Stage" enabled={fields.stageId.enabled} onToggle={() => toggleField('stageId')}>
                    <select value={fields.stageId.value} onChange={e => setFieldValue('stageId', e.target.value)} className="field-input">
                      <option value="">Select stage...</option>
                      {filteredStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </FieldRow>

                  <FieldRow label="Priority" enabled={fields.priorityId.enabled} onToggle={() => toggleField('priorityId')}>
                    <select value={fields.priorityId.value} onChange={e => setFieldValue('priorityId', e.target.value)} className="field-input">
                      <option value="">Select priority...</option>
                      {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </FieldRow>

                  <FieldRow label="Source" enabled={fields.source.enabled} onToggle={() => toggleField('source')}>
                    <select value={fields.source.value} onChange={e => setFieldValue('source', e.target.value)} className="field-input">
                      <option value="">Select source...</option>
                      {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </FieldRow>

                  <FieldRow label="Tags" enabled={fields.tags.enabled} onToggle={() => { toggleField('tags'); if (!fields.tagMode.enabled) toggleField('tagMode'); }}>
                    <div className="space-y-2 w-full">
                      <input
                        type="text"
                        value={fields.tags.value}
                        onChange={e => setFieldValue('tags', e.target.value)}
                        placeholder="tag1, tag2, tag3"
                        className="field-input"
                      />
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="tagMode" checked={fields.tagMode.value === 'add'} onChange={() => setFieldValue('tagMode', 'add')} className="text-blue-600" />
                          <span className="text-gray-600 dark:text-gray-400">Add to existing</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="tagMode" checked={fields.tagMode.value === 'replace'} onChange={() => setFieldValue('tagMode', 'replace')} className="text-blue-600" />
                          <span className="text-gray-600 dark:text-gray-400">Replace all</span>
                        </label>
                      </div>
                    </div>
                  </FieldRow>
                </div>
              )}

              {/* ── Basic Info Section ── */}
              <SectionHeader
                label="Basic Info"
                collapsed={collapsedSections.has('basic')}
                onToggle={() => toggleSection('basic')}
              />
              {!collapsedSections.has('basic') && (
                <div className="space-y-2 mb-3">
                  <FieldRow label="Company" enabled={fields.company.enabled} onToggle={() => toggleField('company')}>
                    <input type="text" value={fields.company.value} onChange={e => setFieldValue('company', e.target.value)} placeholder="Company name" className="field-input" />
                  </FieldRow>
                  <FieldRow label="Job Title" enabled={fields.jobTitle.enabled} onToggle={() => toggleField('jobTitle')}>
                    <input type="text" value={fields.jobTitle.value} onChange={e => setFieldValue('jobTitle', e.target.value)} placeholder="Job title" className="field-input" />
                  </FieldRow>
                  <FieldRow label="Website" enabled={fields.website.enabled} onToggle={() => toggleField('website')}>
                    <input type="url" value={fields.website.value} onChange={e => setFieldValue('website', e.target.value)} placeholder="https://example.com" className="field-input" />
                  </FieldRow>
                </div>
              )}

              {/* ── Address Section ── */}
              <SectionHeader
                label="Address"
                collapsed={collapsedSections.has('address')}
                onToggle={() => toggleSection('address')}
              />
              {!collapsedSections.has('address') && (
                <div className="space-y-2 mb-3">
                  <FieldRow label="Address Line 1" enabled={fields.addressLine1.enabled} onToggle={() => toggleField('addressLine1')}>
                    <input type="text" value={fields.addressLine1.value} onChange={e => setFieldValue('addressLine1', e.target.value)} placeholder="Street address" className="field-input" />
                  </FieldRow>
                  <FieldRow label="Address Line 2" enabled={fields.addressLine2.enabled} onToggle={() => toggleField('addressLine2')}>
                    <input type="text" value={fields.addressLine2.value} onChange={e => setFieldValue('addressLine2', e.target.value)} placeholder="Apt, suite, etc." className="field-input" />
                  </FieldRow>
                  <FieldRow label="City" enabled={fields.city.enabled} onToggle={() => toggleField('city')}>
                    <input type="text" value={fields.city.value} onChange={e => setFieldValue('city', e.target.value)} placeholder="City" className="field-input" />
                  </FieldRow>
                  <FieldRow label="State / Province" enabled={fields.state.enabled} onToggle={() => toggleField('state')}>
                    <input type="text" value={fields.state.value} onChange={e => setFieldValue('state', e.target.value)} placeholder="State" className="field-input" />
                  </FieldRow>
                  <FieldRow label="Postal Code" enabled={fields.postalCode.enabled} onToggle={() => toggleField('postalCode')}>
                    <input type="text" value={fields.postalCode.value} onChange={e => setFieldValue('postalCode', e.target.value)} placeholder="Postal code" className="field-input" />
                  </FieldRow>
                  <FieldRow label="Country" enabled={fields.country.enabled} onToggle={() => toggleField('country')}>
                    <select value={fields.country.value} onChange={e => setFieldValue('country', e.target.value)} className="field-input">
                      <option value="">Select country...</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FieldRow>
                </div>
              )}

              {/* ── Qualification Section ── */}
              {qualificationFields.length > 0 && (
                <>
                  <SectionHeader
                    label="Qualification"
                    collapsed={collapsedSections.has('qualification')}
                    onToggle={() => toggleSection('qualification')}
                  />
                  {!collapsedSections.has('qualification') && (
                    <div className="space-y-2 mb-3">
                      {qualificationFields.sort((a, b) => a.sortOrder - b.sortOrder).map(qf => (
                        <FieldRow
                          key={qf.fieldKey}
                          label={qf.fieldLabel}
                          enabled={!!qualificationEnabled[qf.fieldKey]}
                          onToggle={() => toggleQualification(qf.fieldKey)}
                        >
                          {qf.fieldType === 'select' && qf.fieldOptions?.length > 0 ? (
                            <select
                              value={qualificationValues[qf.fieldKey] || ''}
                              onChange={e => setQualificationValue(qf.fieldKey, e.target.value)}
                              className="field-input"
                            >
                              <option value="">Select {qf.fieldLabel.toLowerCase()}...</option>
                              {qf.fieldOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : qf.fieldType === 'number' ? (
                            <input
                              type="number"
                              value={qualificationValues[qf.fieldKey] || ''}
                              onChange={e => setQualificationValue(qf.fieldKey, e.target.value)}
                              placeholder={`Enter ${qf.fieldLabel.toLowerCase()}`}
                              className="field-input"
                            />
                          ) : qf.fieldType === 'date' ? (
                            <input
                              type="date"
                              value={qualificationValues[qf.fieldKey] || ''}
                              onChange={e => setQualificationValue(qf.fieldKey, e.target.value)}
                              className="field-input"
                            />
                          ) : qf.fieldType === 'checkbox' || qf.fieldType === 'boolean' ? (
                            <ToggleSwitch
                              checked={!!qualificationValues[qf.fieldKey]}
                              onChange={v => setQualificationValue(qf.fieldKey, v)}
                            />
                          ) : (
                            <input
                              type="text"
                              value={qualificationValues[qf.fieldKey] || ''}
                              onChange={e => setQualificationValue(qf.fieldKey, e.target.value)}
                              placeholder={`Enter ${qf.fieldLabel.toLowerCase()}`}
                              className="field-input"
                            />
                          )}
                        </FieldRow>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── Custom Fields Section ── */}
              {customFields.length > 0 && (
                <>
                  <SectionHeader
                    label="Custom Fields"
                    collapsed={collapsedSections.has('custom')}
                    onToggle={() => toggleSection('custom')}
                  />
                  {!collapsedSections.has('custom') && (
                    <div className="space-y-2 mb-3">
                      {customFields
                        .sort((a, b) => a.displayOrder - b.displayOrder)
                        .filter(cf => cf.fieldType !== 'file') // skip file fields for bulk
                        .map(cf => (
                        <FieldRow
                          key={cf.id}
                          label={cf.fieldLabel}
                          enabled={!!customFieldEnabled[cf.fieldKey]}
                          onToggle={() => toggleCustomField(cf.fieldKey)}
                        >
                          {renderCustomFieldInput(cf, customFieldValues[cf.fieldKey], (v) => setCustomFieldValue(cf.fieldKey, v))}
                        </FieldRow>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── Communication Section ── */}
              <SectionHeader
                label="Communication Preferences"
                collapsed={collapsedSections.has('communication')}
                onToggle={() => toggleSection('communication')}
              />
              {!collapsedSections.has('communication') && (
                <div className="space-y-2 mb-3">
                  <FieldRow label="Do Not Contact" enabled={fields.doNotContact.enabled} onToggle={() => toggleField('doNotContact')}>
                    <ToggleSwitch checked={fields.doNotContact.value} onChange={v => setFieldValue('doNotContact', v)} />
                  </FieldRow>
                  <FieldRow label="Do Not Email" enabled={fields.doNotEmail.enabled} onToggle={() => toggleField('doNotEmail')}>
                    <ToggleSwitch checked={fields.doNotEmail.value} onChange={v => setFieldValue('doNotEmail', v)} />
                  </FieldRow>
                  <FieldRow label="Do Not Call" enabled={fields.doNotCall.enabled} onToggle={() => toggleField('doNotCall')}>
                    <ToggleSwitch checked={fields.doNotCall.value} onChange={v => setFieldValue('doNotCall', v)} />
                  </FieldRow>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || effectiveEnabled === 0 || loadingLookups}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? 'Updating...' : `Update ${totalCount.toLocaleString()} Lead${totalCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {/* Inline styles for field inputs */}
      <style>{`
        .field-input {
          width: 100%;
          font-size: 0.875rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 0.375rem 0.75rem;
          background: white;
          color: #111827;
        }
        .dark .field-input {
          background: #0f172a;
          border-color: #334155;
          color: #f1f5f9;
        }
        .field-input:focus {
          outline: none;
          ring: 2px;
          border-color: #3b82f6;
        }
      `}</style>
    </div>
  );
}

// ── Render custom field input based on type ──
function renderCustomFieldInput(cf: CustomField, value: any, onChange: (v: any) => void) {
  switch (cf.fieldType) {
    case 'select':
      return (
        <select value={value || ''} onChange={e => onChange(e.target.value)} className="field-input">
          <option value="">Select {cf.fieldLabel.toLowerCase()}...</option>
          {(cf.fieldOptions || []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );

    case 'multi_select':
      return (
        <div className="space-y-2 w-full">
          <select
            value=""
            onChange={e => {
              if (e.target.value) {
                const current = Array.isArray(value) ? value : [];
                if (!current.includes(e.target.value)) {
                  onChange([...current, e.target.value]);
                }
              }
            }}
            className="field-input"
          >
            <option value="">Add {cf.fieldLabel.toLowerCase()}...</option>
            {(cf.fieldOptions || [])
              .filter(opt => !(Array.isArray(value) ? value : []).includes(opt.value))
              .map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
          </select>
          {Array.isArray(value) && value.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.map((v: string) => {
                const opt = (cf.fieldOptions || []).find(o => o.value === v);
                return (
                  <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                    {opt?.label || v}
                    <button type="button" onClick={() => onChange(value.filter((x: string) => x !== v))} className="hover:text-blue-900 dark:hover:text-blue-100">
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      );

    case 'checkbox':
      return <ToggleSwitch checked={!!value} onChange={v => onChange(v)} />;

    case 'number':
      return (
        <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
          placeholder={cf.placeholder || `Enter ${cf.fieldLabel.toLowerCase()}`}
          min={cf.validationRules?.min} max={cf.validationRules?.max}
          className="field-input" />
      );

    case 'date':
      return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className="field-input" />;

    case 'textarea':
      return (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={cf.placeholder || `Enter ${cf.fieldLabel.toLowerCase()}`}
          rows={3} className="field-input" />
      );

    case 'url':
      return (
        <input type="url" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={cf.placeholder || 'https://example.com'} className="field-input" />
      );

    case 'email':
      return (
        <input type="email" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={cf.placeholder || 'email@example.com'} className="field-input" />
      );

    case 'phone':
      return (
        <input type="tel" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={cf.placeholder || 'Phone number'} className="field-input" />
      );

    default:
      return (
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={cf.placeholder || `Enter ${cf.fieldLabel.toLowerCase()}`} className="field-input" />
      );
  }
}

// ── Section header ──
function SectionHeader({ label, collapsed, onToggle }: { label: string; collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 w-full py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
    >
      {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
      {label}
    </button>
  );
}

// ── Reusable field row ──
function FieldRow({ label, enabled, onToggle, children }: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
      enabled
        ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10'
        : 'border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30'
    }`}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer" onClick={onToggle}>
          {label}
        </label>
        {enabled && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

// ── Simple toggle switch ──
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );
}
