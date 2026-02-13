// ============================================================
// FILE: apps/web/src/features/leads/LeadEditPage.tsx
// ============================================================
// Enhanced with custom fields, custom tabs, custom groups
// matching Contacts/Accounts edit page pattern.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, AlertTriangle,
  ChevronDown, ChevronRight, Plus, X,
} from 'lucide-react';
import { leadsApi, leadSettingsApi } from '../../api/leads.api';
import type { CreateLeadData, LeadStage, LeadPriority, QualificationField, DuplicateMatch } from '../../api/leads.api';
import { adminApi } from '../../api/admin.api';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';
import { CustomFieldRenderer } from '../../components/shared/CustomFieldRenderer';
// ============ PAGE DESIGNER IMPORTS ============
import { useModuleLayout } from '../../hooks/useModuleLayout';
// ===============================================

type TabType = 'basic' | 'lead-details' | 'qualification' | 'address' | 'communication' | 'other' | string;

const STANDARD_TABS: { id: TabType; label: string }[] = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'lead-details', label: 'Lead Details' },
  { id: 'qualification', label: 'Qualification' },
  { id: 'address', label: 'Address' },
  { id: 'communication', label: 'Communication' },
  { id: 'other', label: 'Other' },
];

export function LeadEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('basic');

  // Lookups
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [priorities, setPriorities] = useState<LeadPriority[]>([]);
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [qualificationFields, setQualificationFields] = useState<QualificationField[]>([]);
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);

  // Custom fields, tabs, groups
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomFieldGroup[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Duplicate detection
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [_checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Stage change — required fields modal
  const [stageFieldsModal, setStageFieldsModal] = useState<{
    targetStageId: string;
    targetStageName: string;
    missingFields: { fieldKey: string; fieldLabel: string; fieldType: string; sortOrder: number }[];
  } | null>(null);
  const [stageFieldValues, setStageFieldValues] = useState<Record<string, any>>({});
  const [stageFieldErrors, setStageFieldErrors] = useState<Record<string, string>>({});
  const [stageChangeLoading, setStageChangeLoading] = useState(false);

  // Page Designer hook
  const { useCustomLayout: _useCustomLayout, loading: _layoutLoading } = useModuleLayout('leads', 'edit');

  // Form data
  const [formData, setFormData] = useState<CreateLeadData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mobile: '',
    company: '',
    jobTitle: '',
    website: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    source: '',
    stageId: '',
    priorityId: '',
    qualification: {},
    tags: [],
    customFields: {},
    doNotContact: false,
    doNotEmail: false,
    doNotCall: false,
    ownerId: '',
  });

  const [tagInput, setTagInput] = useState('');

  // ── Fetch lookups + custom fields on mount ──
  useEffect(() => {
    Promise.all([
      leadSettingsApi.getStages(),
      leadSettingsApi.getPriorities(),
      leadSettingsApi.getSources(),
      leadSettingsApi.getQualificationFrameworks(),
      fetchUsers(),
      adminApi.getCustomFields('leads'),
      adminApi.getTabs('leads'),
      adminApi.getGroups({ module: 'leads' }),
    ]).then(([stagesData, prioritiesData, sourcesData, frameworks, , fieldsData, tabsData, groupsData]) => {
      setStages(stagesData.filter((s: LeadStage) => s.isActive));
      setPriorities(prioritiesData.filter((p: any) => p.isActive !== false));
      setSources(sourcesData);
      setCustomFields(fieldsData.filter((f: CustomField) => f.isActive));
      setCustomTabs(tabsData.filter((t: CustomTab) => t.isActive));
      setCustomGroups(groupsData.filter((g: CustomFieldGroup) => g.isActive));

      // Initialize collapsed groups
      const defaultCollapsed = new Set(
        groupsData.filter((g: CustomFieldGroup) => g.collapsedByDefault).map((g: CustomFieldGroup) => g.id)
      );
      setCollapsedGroups(defaultCollapsed);

      // Get active framework fields
      const activeFw = frameworks.find((f: any) => f.isActive);
      if (activeFw?.fields) {
        setQualificationFields(activeFw.fields);
      }

      // Set defaults for new lead
      if (isNew) {
        const defaultStage = stagesData.find((s: LeadStage) => s.isActive && !s.isWon && !s.isLost);
        const defaultPriority = prioritiesData.find((p: any) => p.isDefault);
        setFormData(prev => ({
          ...prev,
          stageId: defaultStage?.id || '',
          priorityId: defaultPriority?.id || '',
          qualificationFrameworkId: activeFw?.id,
        }));
      }
    }).catch(console.error);
  }, [isNew]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users?limit=100`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } },
      );
      const data = await response.json();
      setUsers((data.data || []).map((u: any) => ({
        id: u.id, firstName: u.firstName, lastName: u.lastName,
      })));
    } catch { /* ignore */ }
  };

  // ── Fetch existing lead for edit ──
  useEffect(() => {
    if (id) fetchLead();
  }, [id]);

  const fetchLead = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await leadsApi.getOne(id);
      setFormData({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        phone: data.phone || '',
        mobile: data.mobile || '',
        company: data.company || '',
        jobTitle: data.jobTitle || '',
        website: data.website || '',
        addressLine1: data.addressLine1 || '',
        addressLine2: data.addressLine2 || '',
        city: data.city || '',
        state: data.state || '',
        postalCode: data.postalCode || '',
        country: data.country || '',
        source: data.source || '',
        stageId: data.stageId || '',
        priorityId: data.priorityId || '',
        qualification: data.qualification || {},
        qualificationFrameworkId: data.qualificationFrameworkId || undefined,
        tags: data.tags || [],
        customFields: data.customFields || {},
        doNotContact: data.doNotContact || false,
        doNotEmail: data.doNotEmail || false,
        doNotCall: data.doNotCall || false,
        ownerId: data.ownerId || '',
        socialProfiles: data.socialProfiles || {},
      });

      // Set custom field values from lead data
      setCustomFieldValues(data.customFields || {});

      if (data.qualificationFields) {
        setQualificationFields(data.qualificationFields);
      }
    } catch (error) {
      console.error('Failed to fetch lead:', error);
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  };

  // ── Duplicate detection (debounced) ──
  const checkDuplicates = useCallback(async (email?: string, phone?: string) => {
    if (!email && !phone) { setDuplicates([]); return; }
    setCheckingDuplicates(true);
    try {
      const dups = await leadsApi.checkDuplicates(email || undefined, phone || undefined, id);
      setDuplicates(dups);
    } catch { /* ignore */ }
    finally { setCheckingDuplicates(false); }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkDuplicates(formData.email, formData.phone);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.email, formData.phone, checkDuplicates]);

  // ── Field change ──
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleQualificationChange = (fieldKey: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      qualification: { ...prev.qualification, [fieldKey]: value },
    }));
  };

  const handleCustomFieldChange = (fieldKey: string, value: unknown) => {
    setCustomFieldValues(prev => ({ ...prev, [fieldKey]: value }));
    setFormData(prev => ({
      ...prev,
      customFields: { ...(prev.customFields || {}), [fieldKey]: value },
    }));
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags?.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
  };

  // ── Stage change with required-fields check ──
  const handleStageChange = async (newStageId: string) => {
    if (!newStageId || newStageId === formData.stageId) return;

    setStageChangeLoading(true);
    try {
      // 1. Fetch required fields for the target stage
      const stageFields = await leadSettingsApi.getStageFields(newStageId);
      const requiredFields = (Array.isArray(stageFields) ? stageFields : []).filter((f: any) => f.isRequired);

      if (requiredFields.length === 0) {
        // No required fields — change directly
        handleChange('stageId', newStageId);
        return;
      }

      // 2. Check which required fields are missing in the current formData
      const missing = requiredFields.filter((f: any) => {
        let val: any;
        if (f.fieldKey.startsWith('qualification.')) {
          const qKey = f.fieldKey.replace('qualification.', '');
          val = (formData.qualification as Record<string, any>)?.[qKey];
        } else if (f.fieldKey.startsWith('custom.')) {
          const cKey = f.fieldKey.replace('custom.', '');
          val = (formData.customFields as Record<string, any>)?.[cKey];
        } else {
          val = (formData as any)[f.fieldKey];
        }
        return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
      });

      if (missing.length === 0) {
        // All required fields already filled — change directly
        handleChange('stageId', newStageId);
        return;
      }

      // 3. Show modal to collect missing fields
      const targetStage = stages.find(s => s.id === newStageId);
      setStageFieldsModal({
        targetStageId: newStageId,
        targetStageName: targetStage?.name || 'Selected Stage',
        missingFields: missing.map((f: any) => ({
          fieldKey: f.fieldKey,
          fieldLabel: f.fieldLabel,
          fieldType: f.fieldType || 'text',
          sortOrder: f.sortOrder || 0,
        })),
      });
      setStageFieldValues({});
      setStageFieldErrors({});
    } catch (err) {
      console.error('Failed to check stage fields:', err);
      // Fallback: allow change without check
      handleChange('stageId', newStageId);
    } finally {
      setStageChangeLoading(false);
    }
  };

  const handleStageFieldsSubmit = () => {
    if (!stageFieldsModal) return;

    // Validate all missing fields are filled
    const errors: Record<string, string> = {};
    stageFieldsModal.missingFields.forEach(f => {
      const val = stageFieldValues[f.fieldKey];
      if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        errors[f.fieldKey] = `${f.fieldLabel} is required`;
      }
    });
    if (Object.keys(errors).length > 0) {
      setStageFieldErrors(errors);
      return;
    }

    // Merge collected field values into formData
    const updates: Record<string, any> = {};
    stageFieldsModal.missingFields.forEach(f => {
      const val = stageFieldValues[f.fieldKey];
      if (f.fieldKey.startsWith('qualification.')) {
        const qKey = f.fieldKey.replace('qualification.', '');
        updates.qualification = { ...(formData.qualification || {}), ...updates.qualification, [qKey]: val };
      } else if (f.fieldKey.startsWith('custom.')) {
        const cKey = f.fieldKey.replace('custom.', '');
        updates.customFields = { ...(formData.customFields || {}), ...updates.customFields, [cKey]: val };
        setCustomFieldValues(prev => ({ ...prev, [cKey]: val }));
      } else {
        updates[f.fieldKey] = val;
      }
    });

    // Apply all updates + change the stage
    setFormData(prev => ({
      ...prev,
      ...updates,
      stageId: stageFieldsModal.targetStageId,
    }));

    setStageFieldsModal(null);
  };

  // ── Save ──
  const handleSave = async () => {
    if (!formData.lastName?.trim()) {
      setError('Last name is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      // Strip empty strings from UUID fields so backend validation passes
      const dataToSave: Record<string, any> = { ...formData };
      ['ownerId', 'stageId', 'priorityId', 'qualificationFrameworkId'].forEach(key => {
        if (!dataToSave[key]) delete dataToSave[key];
      });

      if (isNew) {
        const created = await leadsApi.create(dataToSave as any);
        navigate(`/leads/${created.id}`);
      } else {
        await leadsApi.update(id!, dataToSave as any);
        navigate(`/leads/${id}`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save lead';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  // ── Custom fields renderer for a section ──
  const renderCustomFieldsForSection = (section: string, tabId?: string) => {
    let sectionFields = customFields.filter(f => {
      if (tabId) return f.tabId === tabId;
      return f.section === section && !f.tabId;
    });

    if (sectionFields.length === 0) return null;

    // Separate grouped vs ungrouped
    const groupedFieldIds = new Set(sectionFields.filter(f => f.groupId).map(f => f.groupId!));
    const sectionGroupsList = customGroups.filter(g => groupedFieldIds.has(g.id));
    const ungroupedFields = sectionFields.filter(f => !f.groupId);

    return (
      <div className="space-y-4 mt-4">
        {/* Grouped Fields */}
        {sectionGroupsList.map(group => {
          const groupFields = sectionFields.filter(f => f.groupId === group.id);
          if (groupFields.length === 0) return null;
          const isCollapsed = collapsedGroups.has(group.id);

          return (
            <div key={group.id} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 text-left transition-colors"
              >
                {isCollapsed
                  ? <ChevronRight className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{group.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{groupFields.length} field{groupFields.length !== 1 ? 's' : ''}</span>
              </button>
              {!isCollapsed && (
                <div className={`p-4 grid gap-4 ${group.columns === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {groupFields
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map(field => (
                      <div
                        key={field.id}
                        className={field.columnSpan === 2 ? 'md:col-span-2' : ''}
                      >
                        <CustomFieldRenderer
                          field={field}
                          value={customFieldValues[field.fieldKey]}
                          onChange={handleCustomFieldChange}
                          allFields={customFields}
                          allValues={customFieldValues}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped Fields */}
        {ungroupedFields.length > 0 && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {ungroupedFields
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map(field => (
                <div
                  key={field.id}
                  className={field.columnSpan === 2 ? 'md:col-span-2' : ''}
                >
                  <CustomFieldRenderer
                    field={field}
                    value={customFieldValues[field.fieldKey]}
                    onChange={handleCustomFieldChange}
                    allFields={customFields}
                    allValues={customFieldValues}
                  />
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  // Build tabs including custom tabs
  const allTabs: { id: TabType; label: string }[] = [
    ...STANDARD_TABS,
    ...customTabs.map(t => ({ id: `custom_${t.id}` as TabType, label: t.name })),
  ];

  // Hide qualification tab if no framework fields; hide Other if no relevant fields
  const hasCustomSectionFields = customFields.some(f => f.section === 'custom' && !f.tabId);
  const hasOtherSectionFields = customFields.some(f => (f.section === 'social' || f.section === 'other') && !f.tabId);
  const visibleTabs = allTabs.filter(t => {
    if (t.id === 'qualification' && qualificationFields.length === 0) return false;
    if (t.id === 'other' && !hasCustomSectionFields && !hasOtherSectionFields) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Shared input class ──
  const inputClass = "w-full border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow";

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={isNew ? '/leads' : `/leads/${id}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {isNew ? 'Back to Leads' : 'Back to Lead'}
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isNew ? 'New Lead' : 'Edit Lead'}
          </h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Lead'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Duplicate Warning */}
      {duplicates.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
            <AlertTriangle size={14} />
            Potential duplicates found
          </div>
          {duplicates.slice(0, 3).map((dup) => (
            <p key={`${dup.entityType}-${dup.id}`} className="text-xs text-amber-600 ml-6">
              {dup.entityType}: {dup.firstName ? `${dup.firstName} ${dup.lastName}` : dup.name} ({dup.matchType})
            </p>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700 mb-6">
        <nav className="flex gap-1 overflow-x-auto pb-px">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        {/* ── BASIC INFO TAB ── */}
        {activeTab === 'basic' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">First Name</label>
                <input type="text" value={formData.firstName || ''} onChange={(e) => handleChange('firstName', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={formData.lastName || ''} onChange={(e) => handleChange('lastName', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Email</label>
                <input type="email" value={formData.email || ''} onChange={(e) => handleChange('email', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Phone</label>
                <input type="text" value={formData.phone || ''} onChange={(e) => handleChange('phone', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Company</label>
                <input type="text" value={formData.company || ''} onChange={(e) => handleChange('company', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Job Title</label>
                <input type="text" value={formData.jobTitle || ''} onChange={(e) => handleChange('jobTitle', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Website</label>
                <input type="text" value={formData.website || ''} onChange={(e) => handleChange('website', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Mobile</label>
                <input type="text" value={formData.mobile || ''} onChange={(e) => handleChange('mobile', e.target.value)} className={inputClass} />
              </div>
            </div>

            {/* Custom fields for basic section */}
            {renderCustomFieldsForSection('basic')}
          </div>
        )}

        {/* ── LEAD DETAILS TAB ── */}
        {activeTab === 'lead-details' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Lead Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Source</label>
                <select value={formData.source || ''} onChange={(e) => handleChange('source', e.target.value)} className={inputClass}>
                  <option value="">Select source...</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Stage</label>
                <div className="relative">
                  <select
                    value={formData.stageId || ''}
                    onChange={(e) => handleStageChange(e.target.value)}
                    disabled={stageChangeLoading}
                    className={inputClass}
                  >
                    <option value="">Select stage...</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.isWon ? ' ✓' : s.isLost ? ' ✗' : ''}
                      </option>
                    ))}
                  </select>
                  {stageChangeLoading && (
                    <Loader2 size={14} className="absolute right-8 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Priority</label>
                <select value={formData.priorityId || ''} onChange={(e) => handleChange('priorityId', e.target.value)} className={inputClass}>
                  <option value="">Select priority...</option>
                  {priorities.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Owner</label>
                <select value={formData.ownerId || ''} onChange={(e) => handleChange('ownerId', e.target.value)} className={inputClass}>
                  <option value="">Auto-assign (me)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags */}
            <div className="mt-4">
              <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.tags || []).map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="text-blue-400 hover:text-red-500 transition-colors">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  placeholder="Add tag..."
                  className={`flex-1 ${inputClass}`}
                />
                <button onClick={handleAddTag} className="px-3 py-2 text-sm bg-gray-100 dark:bg-slate-800 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors">
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Custom fields for 'other' section shown under lead details */}
            {renderCustomFieldsForSection('other')}
          </div>
        )}

        {/* ── QUALIFICATION TAB ── */}
        {activeTab === 'qualification' && qualificationFields.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Qualification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {qualificationFields.map((field) => (
                <div key={field.fieldKey}>
                  <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">
                    {field.fieldLabel}
                    {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                    {field.scoreWeight > 0 && (
                      <span className="text-xs text-gray-400 ml-1">(+{field.scoreWeight} pts)</span>
                    )}
                  </label>
                  {field.fieldType === 'select' ? (
                    <select
                      value={formData.qualification?.[field.fieldKey] || ''}
                      onChange={(e) => handleQualificationChange(field.fieldKey, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select...</option>
                      {field.fieldOptions?.map((opt: any) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.qualification?.[field.fieldKey] || ''}
                      onChange={(e) => handleQualificationChange(field.fieldKey, e.target.value)}
                      className={inputClass}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ADDRESS TAB ── */}
        {activeTab === 'address' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Address</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Address Line 1</label>
                <input type="text" value={formData.addressLine1 || ''} onChange={(e) => handleChange('addressLine1', e.target.value)} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Address Line 2</label>
                <input type="text" value={formData.addressLine2 || ''} onChange={(e) => handleChange('addressLine2', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">City</label>
                <input type="text" value={formData.city || ''} onChange={(e) => handleChange('city', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">State / Province</label>
                <input type="text" value={formData.state || ''} onChange={(e) => handleChange('state', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Postal Code</label>
                <input type="text" value={formData.postalCode || ''} onChange={(e) => handleChange('postalCode', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Country</label>
                <input type="text" value={formData.country || ''} onChange={(e) => handleChange('country', e.target.value)} className={inputClass} />
              </div>
            </div>

            {renderCustomFieldsForSection('address')}
          </div>
        )}

        {/* ── COMMUNICATION TAB ── */}
        {activeTab === 'communication' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Communication Preferences</h3>
            <div className="space-y-1">
              {[
                { key: 'doNotContact', label: 'Do Not Contact', desc: 'Block all outreach to this lead' },
                { key: 'doNotEmail', label: 'Do Not Email', desc: 'Block email communication' },
                { key: 'doNotCall', label: 'Do Not Call', desc: 'Block phone communication' },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={(formData as any)[key] || false}
                    onChange={(e) => handleChange(key, e.target.checked)}
                    className="mt-0.5 text-blue-600 rounded border-gray-300 dark:border-slate-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white block">{label}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{desc}</span>
                  </div>
                </label>
              ))}
            </div>

            {renderCustomFieldsForSection('contact')}
          </div>
        )}

        {/* ── OTHER / CUSTOM FIELDS TAB ── */}
        {activeTab === 'other' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Other Information & Custom Fields</h3>
            {renderCustomFieldsForSection('social')}
            {renderCustomFieldsForSection('other')}
            {renderCustomFieldsForSection('custom')}
            {!hasCustomSectionFields && !hasOtherSectionFields && (
              <p className="text-sm text-gray-400 dark:text-slate-500">
                Add custom fields in Admin → Custom Fields to see them here.
              </p>
            )}
          </div>
        )}

        {/* ── CUSTOM TABs (user-defined) ── */}
        {activeTab.startsWith('custom_') && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
            {(() => {
              const tabId = activeTab.replace('custom_', '');
              const tab = customTabs.find(t => t.id === tabId);
              return (
                <>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                    {tab?.name || 'Custom Tab'}
                  </h3>
                  {renderCustomFieldsForSection('', tabId)}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Stage Required Fields Modal ── */}
      {stageFieldsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setStageFieldsModal(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'min(520px, 80vh)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Required for "{stageFieldsModal.targetStageName}"
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Fill in the required fields to move to this stage
                </p>
              </div>
              <button onClick={() => setStageFieldsModal(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {stageFieldsModal.missingFields.length} required field{stageFieldsModal.missingFields.length !== 1 ? 's' : ''} must be filled
                </p>
              </div>

              {stageFieldsModal.missingFields
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((field) => (
                  <div key={field.fieldKey}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {field.fieldLabel} <span className="text-red-500">*</span>
                    </label>
                    {field.fieldType === 'textarea' ? (
                      <textarea
                        value={stageFieldValues[field.fieldKey] || ''}
                        onChange={(e) => {
                          setStageFieldValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
                          setStageFieldErrors(prev => { const n = { ...prev }; delete n[field.fieldKey]; return n; });
                        }}
                        rows={2}
                        className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                          stageFieldErrors[field.fieldKey] ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
                        }`}
                        placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                      />
                    ) : field.fieldType === 'checkbox' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={stageFieldValues[field.fieldKey] || false}
                          onChange={(e) => {
                            setStageFieldValues(prev => ({ ...prev, [field.fieldKey]: e.target.checked }));
                            setStageFieldErrors(prev => { const n = { ...prev }; delete n[field.fieldKey]; return n; });
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-slate-300">{field.fieldLabel}</span>
                      </label>
                    ) : (
                      <input
                        type={
                          field.fieldType === 'email' ? 'email' :
                          field.fieldType === 'number' ? 'number' :
                          field.fieldType === 'date' ? 'date' :
                          field.fieldType === 'phone' ? 'tel' :
                          field.fieldType === 'url' ? 'url' : 'text'
                        }
                        value={stageFieldValues[field.fieldKey] || ''}
                        onChange={(e) => {
                          setStageFieldValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
                          setStageFieldErrors(prev => { const n = { ...prev }; delete n[field.fieldKey]; return n; });
                        }}
                        className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                          stageFieldErrors[field.fieldKey] ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
                        }`}
                        placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                      />
                    )}
                    {stageFieldErrors[field.fieldKey] && (
                      <p className="text-xs text-red-500 mt-1">{stageFieldErrors[field.fieldKey]}</p>
                    )}
                  </div>
                ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30 rounded-b-2xl flex-shrink-0">
              <button onClick={() => setStageFieldsModal(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleStageFieldsSubmit}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Move to {stageFieldsModal.targetStageName}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}