// ============================================================
// FILE: apps/web/src/features/opportunities/OpportunityEditPage.tsx
// ============================================================
// Create/Edit opportunity with pipeline/stage, account/contact lookups,
// custom fields, custom tabs, custom groups — matching LeadEditPage pattern.
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, AlertTriangle,
  ChevronDown, ChevronRight, Plus, X, Search,
} from 'lucide-react';
import { opportunitiesApi, opportunitySettingsApi } from '../../api/opportunities.api';
import type {
  CreateOpportunityData, OpportunityStage, OpportunityPriority, Pipeline,
} from '../../api/opportunities.api';
import { adminApi } from '../../api/admin.api';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';
import { CustomFieldRenderer } from '../../components/shared/CustomFieldRenderer';
import { useModuleLayout } from '../../hooks/useModuleLayout';

type TabType = 'basic' | 'deal-details' | 'address' | 'other' | string;

const STANDARD_TABS: { id: TabType; label: string }[] = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'deal-details', label: 'Deal Details' },
  { id: 'other', label: 'Other' },
];

const OPPORTUNITY_TYPES = ['New Business', 'Existing Business', 'Renewal', 'Upsell'];

export function OpportunityEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('basic');

  // Lookups
  const [stages, setStages] = useState<OpportunityStage[]>([]);
  const [priorities, setPriorities] = useState<OpportunityPriority[]>([]);
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);

  // Account/contact search
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState<any[]>([]);
  const [_accountSearchLoading, setAccountSearchLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<{ id: string; name: string } | null>(null);

  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<any[]>([]);
  const [_contactSearchLoading, setContactSearchLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{ id: string; name: string } | null>(null);

  // Custom fields, tabs, groups
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomFieldGroup[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Stage change — required fields modal
  const [stageFieldsModal, setStageFieldsModal] = useState<{
    targetStageId: string;
    targetStageName: string;
    missingFields: { fieldKey: string; fieldLabel: string; fieldType: string; sortOrder: number }[];
  } | null>(null);
  const [stageFieldValues, setStageFieldValues] = useState<Record<string, any>>({});
  const [stageFieldErrors, setStageFieldErrors] = useState<Record<string, string>>({});

  // Page Designer hook
  const { useCustomLayout: _useCustomLayout, loading: _layoutLoading } = useModuleLayout('opportunities', isNew ? 'create' : 'edit');

  // Form data
  const [formData, setFormData] = useState<CreateOpportunityData>({
    name: '',
    pipelineId: '',
    stageId: '',
    amount: undefined,
    currency: 'USD',
    probability: undefined,
    forecastCategory: '',
    closeDate: '',
    type: '',
    source: '',
    nextStep: '',
    description: '',
    competitor: '',
    tags: [],
    customFields: {},
    priorityId: '',
    accountId: '',
    primaryContactId: '',
    ownerId: '',
  });

  const [tagInput, setTagInput] = useState('');

  // ── Fetch lookups + custom fields on mount ──
  useEffect(() => {
    Promise.all([
      opportunitySettingsApi.getPipelines(),
      opportunitySettingsApi.getStages(),
      opportunitySettingsApi.getPriorities(),
      opportunitySettingsApi.getSources(),
      adminApi.getCustomFields('opportunities').catch(() => []),
      adminApi.getTabs('opportunities').catch(() => []),
      adminApi.getGroups({ module: 'opportunities' }).catch(() => []),
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users?limit=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      }).then(r => r.json()).then(d => d.data || []).catch(() => []),
    ]).then(([pipelinesData, stagesData, prioritiesData, sourcesData, cfData, ctData, cgData, usersData]) => {
      setPipelines(pipelinesData);
      setPriorities(prioritiesData);
      setSources(sourcesData);
      setCustomFields(cfData);
      setCustomTabs(ctData);
      setCustomGroups(cgData);
      setUsers(usersData);

      if (isNew) {
        const defaultPl = pipelinesData.find((p: Pipeline) => p.isDefault);
        if (defaultPl) {
          setFormData(prev => ({ ...prev, pipelineId: defaultPl.id }));
          // Load stages for default pipeline
          opportunitySettingsApi.getStages(defaultPl.id).then(s => {
            setStages(s.filter((st: OpportunityStage) => st.isActive));
            const defaultStage = s.find((st: OpportunityStage) => st.isActive && !st.isWon && !st.isLost);
            if (defaultStage) setFormData(prev => ({ ...prev, stageId: defaultStage.id }));
          });
        } else {
          setStages(stagesData.filter((s: OpportunityStage) => s.isActive));
        }
      } else {
        setStages(stagesData.filter((s: OpportunityStage) => s.isActive));
      }
    }).catch(console.error);
  }, [isNew]);

  // ── Load existing opportunity for edit ──
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    opportunitiesApi.getOne(id)
      .then((opp) => {
        setFormData({
          name: opp.name || '',
          pipelineId: opp.pipelineId || '',
          stageId: opp.stageId || '',
          amount: opp.amount ?? undefined,
          currency: opp.currency || 'USD',
          probability: opp.probability ?? undefined,
          forecastCategory: opp.forecastCategory || '',
          closeDate: opp.closeDate ? opp.closeDate.split('T')[0] : '',
          type: opp.type || '',
          source: opp.source || '',
          nextStep: opp.nextStep || '',
          description: opp.description || '',
          competitor: opp.competitor || '',
          tags: opp.tags || [],
          customFields: opp.customFields || {},
          priorityId: opp.priorityId || '',
          accountId: opp.accountId || '',
          primaryContactId: opp.primaryContactId || '',
          ownerId: opp.ownerId || '',
        });
        setCustomFieldValues(opp.customFields || {});
        if (opp.account) setSelectedAccount({ id: opp.account.id, name: opp.account.name });
        if (opp.primaryContact) setSelectedContact({
          id: opp.primaryContact.id,
          name: `${opp.primaryContact.firstName} ${opp.primaryContact.lastName}`,
        });
        // Load stages for opportunity's pipeline
        if (opp.pipelineId) {
          opportunitySettingsApi.getStages(opp.pipelineId).then(s => {
            setStages(s.filter((st: OpportunityStage) => st.isActive));
          });
        }
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to load opportunity'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Account search ──
  useEffect(() => {
    if (!accountSearch || accountSearch.length < 2) { setAccountResults([]); return; }
    const timer = setTimeout(async () => {
      setAccountSearchLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/accounts?search=${encodeURIComponent(accountSearch)}&limit=5`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } },
        );
        const data = await response.json();
        setAccountResults(data.data || []);
      } catch { /* ignore */ }
      finally { setAccountSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [accountSearch]);

  // ── Contact search ──
  useEffect(() => {
    if (!contactSearch || contactSearch.length < 2) { setContactResults([]); return; }
    const timer = setTimeout(async () => {
      setContactSearchLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/contacts?search=${encodeURIComponent(contactSearch)}&limit=5`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } },
        );
        const data = await response.json();
        setContactResults(data.data || []);
      } catch { /* ignore */ }
      finally { setContactSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomFieldChange = (key: string, value: any) => {
    setCustomFieldValues(prev => ({ ...prev, [key]: value }));
    setFormData(prev => ({
      ...prev,
      customFields: { ...(prev.customFields || {}), [key]: value },
    }));
  };

  // ── Pipeline change: reload stages ──
  const handlePipelineChange = async (newPipelineId: string) => {
    handleChange('pipelineId', newPipelineId);
    handleChange('stageId', '');
    if (!newPipelineId) return;
    try {
      const newStages = await opportunitySettingsApi.getStages(newPipelineId);
      setStages(newStages.filter((s: OpportunityStage) => s.isActive));
      const defaultStage = newStages.find((s: OpportunityStage) => s.isActive && !s.isWon && !s.isLost);
      if (defaultStage) handleChange('stageId', defaultStage.id);
    } catch (err) {
      console.error('Failed to load stages for pipeline:', err);
    }
  };

  // ── Stage change with required fields check ──
  const handleStageChange = async (newStageId: string) => {
    if (!newStageId || newStageId === formData.stageId) {
      handleChange('stageId', newStageId);
      return;
    }
    try {
      const stageFields = await opportunitySettingsApi.getStageFields(newStageId);
      const requiredFields = (Array.isArray(stageFields) ? stageFields : []).filter((f: any) => f.isRequired);

      if (requiredFields.length === 0) {
        handleChange('stageId', newStageId);
        return;
      }

      const missing = requiredFields.filter((f: any) => {
        let val: any;
        if (f.fieldKey.startsWith('custom.')) {
          val = customFieldValues[f.fieldKey.replace('custom.', '')];
        } else {
          val = (formData as any)[f.fieldKey];
        }
        return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
      });

      if (missing.length === 0) {
        handleChange('stageId', newStageId);
        return;
      }

      const targetStage = stages.find(s => s.id === newStageId);
      setStageFieldsModal({
        targetStageId: newStageId,
        targetStageName: targetStage?.name || 'Stage',
        missingFields: missing,
      });
      setStageFieldValues({});
      setStageFieldErrors({});
    } catch (err) {
      handleChange('stageId', newStageId);
    }
  };

  const handleStageFieldSubmit = () => {
    if (!stageFieldsModal) return;
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

    const updates: Record<string, any> = {};
    stageFieldsModal.missingFields.forEach(f => {
      const val = stageFieldValues[f.fieldKey];
      if (f.fieldKey.startsWith('custom.')) {
        const cKey = f.fieldKey.replace('custom.', '');
        updates.customFields = { ...(formData.customFields || {}), ...updates.customFields, [cKey]: val };
        setCustomFieldValues(prev => ({ ...prev, [cKey]: val }));
      } else {
        updates[f.fieldKey] = val;
      }
    });

    setFormData(prev => ({
      ...prev,
      ...updates,
      stageId: stageFieldsModal.targetStageId,
    }));
    setStageFieldsModal(null);
  };

  // ── Tags ──
  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags?.includes(tag)) {
      handleChange('tags', [...(formData.tags || []), tag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    handleChange('tags', (formData.tags || []).filter(t => t !== tag));
  };

  // ── Save ──
  const handleSave = async () => {
    if (!formData.name?.trim()) {
      setError('Opportunity name is required');
      setActiveTab('basic');
      return;
    }
    if (!formData.pipelineId) {
      setError('Pipeline is required');
      setActiveTab('deal-details');
      return;
    }
    if (!formData.stageId) {
      setError('Stage is required');
      setActiveTab('deal-details');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const dataToSave: Record<string, any> = { ...formData };
      // Strip empty strings from UUID fields
      ['ownerId', 'priorityId', 'accountId', 'primaryContactId'].forEach(key => {
        if (!dataToSave[key]) delete dataToSave[key];
      });
      // Strip empty optional fields
      if (!dataToSave.amount && dataToSave.amount !== 0) delete dataToSave.amount;
      if (!dataToSave.probability && dataToSave.probability !== 0) delete dataToSave.probability;

      if (isNew) {
        const created = await opportunitiesApi.create(dataToSave as CreateOpportunityData);
        navigate(`/opportunities/${created.id}`);
      } else {
        await opportunitiesApi.update(id!, dataToSave as Partial<CreateOpportunityData>);
        navigate(`/opportunities/${id}`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save opportunity';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  // ── Custom fields for a section ──
  const renderCustomFieldsForSection = (section: string, tabId?: string) => {
    const groupsForSection = customGroups.filter(g => g.section === section && (!tabId || g.tabId === tabId));
    const ungroupedFields = customFields.filter(f =>
      f.section === section && !f.groupId && (!tabId || (f as any).tabId === tabId)
    );

    return (
      <>
        {groupsForSection
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          .map(group => {
            const groupFields = customFields.filter(f => f.groupId === group.id);
            if (groupFields.length === 0) return null;
            const isCollapsed = collapsedGroups.has(group.id);
            return (
              <div key={group.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setCollapsedGroups(prev => {
                    const next = new Set(prev);
                    next.has(group.id) ? next.delete(group.id) : next.add(group.id);
                    return next;
                  })}
                  className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-slate-800"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{group.name}</span>
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                {!isCollapsed && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groupFields
                      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                      .map(f => (
                        <CustomFieldRenderer
                            key={f.id}
                            field={f}
                            value={customFieldValues[f.fieldKey]}
                            onChange={handleCustomFieldChange}
                            allFields={customFields}
                            allValues={customFieldValues}
                        />
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        {ungroupedFields.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ungroupedFields
              .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
              .map(f => (
                <CustomFieldRenderer
                    key={f.id}
                    field={f}
                    value={customFieldValues[f.fieldKey]}
                    onChange={handleCustomFieldChange}
                    allFields={customFields}
                    allValues={customFieldValues}
                />
              ))}
          </div>
        )}
      </>
    );
  };

  // Build all tabs
  const allTabs = [
    ...STANDARD_TABS,
    ...customTabs
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map(ct => ({ id: ct.id, label: ct.name })),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(isNew ? '/opportunities' : `/opportunities/${id}`)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
            <ArrowLeft size={18} className="text-gray-500" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isNew ? 'New Opportunity' : 'Edit Opportunity'}
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isNew ? 'Create' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {allTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        {/* ── Basic Info Tab ── */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Opportunity Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Acme Corp - Enterprise License"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>

              {/* Account (search) */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Account</label>
                {selectedAccount ? (
                  <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-900 dark:text-white flex-1">{selectedAccount.name}</span>
                    <button onClick={() => { setSelectedAccount(null); handleChange('accountId', ''); }} className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      placeholder="Search accounts..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-slate-800"
                    />
                    {accountResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {accountResults.map((a: any) => (
                          <button
                            key={a.id}
                            onClick={() => {
                              setSelectedAccount({ id: a.id, name: a.name });
                              handleChange('accountId', a.id);
                              setAccountSearch('');
                              setAccountResults([]);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
                          >
                            {a.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Primary Contact (search) */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Primary Contact</label>
                {selectedContact ? (
                  <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-900 dark:text-white flex-1">{selectedContact.name}</span>
                    <button onClick={() => { setSelectedContact(null); handleChange('primaryContactId', ''); }} className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Search contacts..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-slate-800"
                    />
                    {contactResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {contactResults.map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedContact({ id: c.id, name: `${c.firstName} ${c.lastName}` });
                              handleChange('primaryContactId', c.id);
                              setContactSearch('');
                              setContactResults([]);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
                          >
                            {c.firstName} {c.lastName} {c.email ? `(${c.email})` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Amount</label>
                <input
                  type="number"
                  value={formData.amount ?? ''}
                  onChange={(e) => handleChange('amount', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Deal value"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>

              {/* Close Date */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Close Date</label>
                <input
                  type="date"
                  value={formData.closeDate || ''}
                  onChange={(e) => handleChange('closeDate', e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>

              {/* Owner */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Owner</label>
                <select
                  value={formData.ownerId || ''}
                  onChange={(e) => handleChange('ownerId', e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Type</label>
                <select
                  value={formData.type || ''}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="">Select type...</option>
                  {OPPORTUNITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 resize-none"
              />
            </div>

            {renderCustomFieldsForSection('basic')}
          </div>
        )}

        {/* ── Deal Details Tab ── */}
        {activeTab === 'deal-details' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pipeline */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Pipeline <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.pipelineId || ''}
                  onChange={(e) => handlePipelineChange(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="">Select pipeline...</option>
                  {pipelines.filter(p => p.isActive).map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (Default)' : ''}</option>
                  ))}
                </select>
              </div>

              {/* Stage */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Stage <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.stageId || ''}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="">Select stage...</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.probability}%){s.isWon ? ' ★ Won' : ''}{s.isLost ? ' ✕ Lost' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Probability */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Probability (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.probability ?? ''}
                  onChange={(e) => handleChange('probability', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Auto-set from stage"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Priority</label>
                <select
                  value={formData.priorityId || ''}
                  onChange={(e) => handleChange('priorityId', e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="">No priority</option>
                  {priorities.filter(p => p.isActive !== false).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Forecast Category */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Forecast Category</label>
                <select
                  value={formData.forecastCategory || ''}
                  onChange={(e) => handleChange('forecastCategory', e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="">Auto (from probability)</option>
                  <option value="Pipeline">Pipeline</option>
                  <option value="Best Case">Best Case</option>
                  <option value="Commit">Commit</option>
                  <option value="Closed">Closed</option>
                  <option value="Omitted">Omitted</option>
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Source</label>
                <select
                  value={formData.source || ''}
                  onChange={(e) => handleChange('source', e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="">Select source...</option>
                  {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              {/* Next Step */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Next Step</label>
                <input
                  type="text"
                  value={formData.nextStep || ''}
                  onChange={(e) => handleChange('nextStep', e.target.value)}
                  placeholder="What happens next?"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>

              {/* Competitor */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Competitor</label>
                <input
                  type="text"
                  value={formData.competitor || ''}
                  onChange={(e) => handleChange('competitor', e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Tags</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {(formData.tags || []).map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs rounded-full">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500"><X size={10} /></button>
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
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
                <button onClick={handleAddTag} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {renderCustomFieldsForSection('deal-details')}
          </div>
        )}

        {/* ── Other Tab ── */}
        {activeTab === 'other' && (
          <div className="space-y-4">
            {renderCustomFieldsForSection('other')}
            {customFields.filter(f => f.section === 'other' || !f.section).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No additional fields configured</p>
            )}
          </div>
        )}

        {/* ── Custom Tabs ── */}
        {customTabs.map(ct => {
          if (activeTab !== ct.id) return null;
          return (
            <div key={ct.id} className="space-y-4">
              {renderCustomFieldsForSection(ct.id, ct.id)}
              {customFields.filter(f => (f as any).tabId === ct.id).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No fields in this tab yet</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Stage Required Fields Modal ── */}
      {stageFieldsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setStageFieldsModal(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'min(520px, 80vh)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Required for "{stageFieldsModal.targetStageName}"
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Fill in the required fields to move to this stage
                </p>
              </div>
              <button onClick={() => setStageFieldsModal(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {stageFieldsModal.missingFields.length} required field{stageFieldsModal.missingFields.length !== 1 ? 's' : ''} missing
                </p>
              </div>
              {stageFieldsModal.missingFields.sort((a, b) => a.sortOrder - b.sortOrder).map(f => (
                <div key={f.fieldKey}>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    {f.fieldLabel} <span className="text-red-500">*</span>
                  </label>
                  {f.fieldType === 'date' ? (
                    <input type="date" value={stageFieldValues[f.fieldKey] || ''} onChange={(e) => setStageFieldValues(prev => ({ ...prev, [f.fieldKey]: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
                  ) : f.fieldType === 'number' ? (
                    <input type="number" value={stageFieldValues[f.fieldKey] || ''} onChange={(e) => setStageFieldValues(prev => ({ ...prev, [f.fieldKey]: e.target.value ? Number(e.target.value) : '' }))} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
                  ) : (
                    <input type="text" value={stageFieldValues[f.fieldKey] || ''} onChange={(e) => setStageFieldValues(prev => ({ ...prev, [f.fieldKey]: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
                  )}
                  {stageFieldErrors[f.fieldKey] && <p className="text-xs text-red-500 mt-1">{stageFieldErrors[f.fieldKey]}</p>}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700 flex-shrink-0">
              <button onClick={() => setStageFieldsModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
              <button onClick={handleStageFieldSubmit} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Apply & Move</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}