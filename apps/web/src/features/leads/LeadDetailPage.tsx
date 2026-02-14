// ============================================================
// FILE: apps/web/src/features/leads/LeadDetailPage.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, MoreHorizontal,
  Mail, Phone, Globe, MapPin, Building2,
  Tag, Activity, History,
  MessageSquare, FileText,
  ExternalLink, Flame, Thermometer, Snowflake, Sun, Minus,
  AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { leadsApi } from '../../api/leads.api';
import type { Lead } from '../../api/leads.api';
import { StageJourneyBar } from './components/StageJourneyBar';
import { ConvertLeadModal } from './components/ConvertLeadModal';
import { DisqualifyModal } from './components/DisqualifyModal';
import { RecordTeamPanel } from './components/RecordTeamPanel';
import { Timeline } from '../../components/shared/Timeline';
import { ChangeHistory } from '../../components/shared/ChangeHistory';
import { NotesPanel } from '../../components/shared/NotesPanel';
import { DocumentsPanel } from '../../components/shared/DocumentsPanel';
import { adminApi } from '../../api/admin.api';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';
import { usePermissions } from '../../hooks/usePermissions';

type TabType = 'activity' | 'notes' | 'documents' | 'history';

const PRIORITY_ICONS: Record<string, any> = {
  flame: Flame, thermometer: Thermometer, snowflake: Snowflake, sun: Sun, minus: Minus,
};

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [tabData, setTabData] = useState<any>(null);
  const [tabLoading, setTabLoading] = useState(false);

  // Modals
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showDisqualifyModal, setShowDisqualifyModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomFieldGroup[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // ── Fetch Lead ──
  useEffect(() => {
    if (id) fetchLead();
  }, [id]);

  useEffect(() => {
    if (lead && id) fetchTabData();
  }, [activeTab, lead]);

  // Fetch custom field definitions
  useEffect(() => {
    const loadCustomConfig = async () => {
      try {
        const [fieldsData, tabsData, groupsData] = await Promise.all([
          adminApi.getCustomFields('leads'),
          adminApi.getTabs('leads'),
          adminApi.getGroups({ module: 'leads' }),
        ]);
        setCustomFields(fieldsData.filter((f: CustomField) => f.isActive));
        setCustomTabs(tabsData.filter((t: CustomTab) => t.isActive));
        setCustomGroups(groupsData.filter((g: CustomFieldGroup) => g.isActive));
        const defaultCollapsed = new Set(
          groupsData.filter((g: CustomFieldGroup) => g.collapsedByDefault).map((g: CustomFieldGroup) => g.id)
        );
        setCollapsedGroups(defaultCollapsed);
      } catch (err) {
        console.error('Failed to fetch custom fields config:', err);
      }
    };
    loadCustomConfig();
  }, []);

  const fetchLead = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await leadsApi.getOne(id);
      setLead(data);
    } catch (error) {
      console.error('Failed to fetch lead:', error);
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchTabData = async () => {
    if (!id) return;
    setTabLoading(true);
    try {
      switch (activeTab) {
        case 'activity': setTabData(await leadsApi.getActivities(id)); break;
        case 'history': setTabData(await leadsApi.getHistory(id)); break;
        case 'notes': setTabData(await leadsApi.getNotes(id)); break;
        case 'documents': setTabData(await leadsApi.getDocuments(id)); break;
      }
    } catch (error) {
      console.error('Failed to fetch tab data:', error);
    } finally {
      setTabLoading(false);
    }
  };

  const handleStageChange = async (stageId: string, stageFields?: Record<string, any>, unlockReason?: string) => {
    if (!id) return;
    await leadsApi.changeStage(id, stageId, stageFields, unlockReason);
    await fetchLead();
  };

  const handleDelete = async () => {
    if (!id) return;
    await leadsApi.delete(id);
    navigate('/leads');
  };

  const handleNoteAdded = async (content: string) => {
    if (!id) return;
    await leadsApi.addNote(id, content);
    setTabData(await leadsApi.getNotes(id));
  };

  if (loading || !lead) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
  const isReadOnly = !!lead.convertedAt || !!lead.disqualifiedAt;
  const PriorityIcon = lead.priority?.icon ? PRIORITY_ICONS[lead.priority.icon] : null;

  // Score color
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-500';
  };
  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-400';
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/leads')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{fullName}</h1>
              {lead.pipeline && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 8h14M3 12h10M3 16h6" />
                  </svg>
                  {lead.pipeline.name}
                </span>
              )}
              {lead.priority && PriorityIcon && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${lead.priority.color}18`, color: lead.priority.color }}>
                  <PriorityIcon size={12} />
                  {lead.priority.name}
                </span>
              )}
              {isReadOnly && (
                <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                  Read-only
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {lead.company && <span>{lead.company}</span>}
              {lead.jobTitle && <span> · {lead.jobTitle}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit('leads') && !isReadOnly && (
            <button
              onClick={() => navigate(`/leads/${id}/edit`)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Pencil size={14} /> Edit
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <MoreHorizontal size={18} className="text-gray-500" />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 top-10 z-10 w-48 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                {canDelete('leads') && (
                  <button
                    onClick={() => { setShowDeleteConfirm(true); setShowMoreMenu(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                  >
                    <Trash2 size={14} /> Delete Lead
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── STAGE JOURNEY BAR ── */}
      <StageJourneyBar
        lead={lead}
        stages={lead.allStages || []}
        stageSettings={lead.stageSettings || {}}
        onStageChange={handleStageChange}
        onConvert={() => setShowConvertModal(true)}
        onDisqualify={() => setShowDisqualifyModal(true)}
        disabled={isReadOnly}
      />

      {/* ── Conversion links ── */}
      {lead.convertedAt && (
        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-400">
            Converted on {format(new Date(lead.convertedAt), 'MMM d, yyyy')}
            {lead.convertedContactId && (
              <> · <Link to={`/contacts/${lead.convertedContactId}`} className="underline hover:no-underline">View Contact</Link></>
            )}
            {lead.convertedAccountId && (
              <> · <Link to={`/accounts/${lead.convertedAccountId}`} className="underline hover:no-underline">View Account</Link></>
            )}
          </p>
        </div>
      )}

      {lead.disqualifiedAt && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">
            Disqualified on {format(new Date(lead.disqualifiedAt), 'MMM d, yyyy')}
            {lead.disqualificationReasonName && <> · Reason: {lead.disqualificationReasonName}</>}
          </p>
        </div>
      )}

      {/* ── MAIN CONTENT: LEFT + RIGHT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* ── LEFT COLUMN (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info Card */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lead.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-gray-400 flex-shrink-0" />
                  <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline truncate">{lead.email}</a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-gray-400 flex-shrink-0" />
                  <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">{lead.phone}</a>
                </div>
              )}
              {lead.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe size={14} className="text-gray-400 flex-shrink-0" />
                  <a href={lead.website} target="_blank" rel="noopener" className="text-blue-600 hover:underline truncate">{lead.website}</a>
                </div>
              )}
              {lead.company && (
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                  {lead.company}
                </div>
              )}
              {(lead.city || lead.state || lead.country) && (
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                  {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
                </div>
              )}
              {lead.source && (
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
                  Source: {lead.source}
                </div>
              )}
            </div>

            {/* Tags */}
            {lead.tags && lead.tags.length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Tag size={14} className="text-gray-400" />
                {lead.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Qualification Section */}
          {lead.qualificationFields && lead.qualificationFields.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Qualification {lead.qualificationFramework && `(${lead.qualificationFramework.name})`}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lead.qualificationFields.map((field) => {
                  const value = lead.qualification?.[field.fieldKey];
                  const option = field.fieldOptions?.find((o: any) => o.value === value);
                  return (
                    <div key={field.fieldKey}>
                      <label className="text-xs text-gray-500 block mb-1">{field.fieldLabel}</label>
                      <p className={`text-sm font-medium ${value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                        {option?.label || value || 'Not set'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Fields — rendered with proper labels, groups, tabs */}
          {customFields.length > 0 && lead.customFields && Object.keys(lead.customFields).length > 0 && (() => {
            const cfValues = lead.customFields as Record<string, unknown>;

            // Fields with values, no tab assignment
            const mainFields = customFields.filter(f =>
              !f.tabId && cfValues[f.fieldKey] !== undefined && cfValues[f.fieldKey] !== null && cfValues[f.fieldKey] !== ''
            );

            // Group them
            const grouped = customGroups.filter(g => mainFields.some(f => f.groupId === g.id));
            const ungrouped = mainFields.filter(f => !f.groupId);

            // Custom tabs with data
            const tabsWithData = customTabs.filter(tab =>
              customFields.some(f => f.tabId === tab.id && cfValues[f.fieldKey] !== undefined && cfValues[f.fieldKey] !== null && cfValues[f.fieldKey] !== '')
            );

            if (mainFields.length === 0 && tabsWithData.length === 0) return null;

            return (
              <>
                {/* Main custom fields (no tab) */}
                {mainFields.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Custom Fields</h3>

                    {/* Grouped */}
                    {grouped.map(group => {
                      const gFields = mainFields.filter(f => f.groupId === group.id).sort((a, b) => a.displayOrder - b.displayOrder);
                      const isCollapsed = collapsedGroups.has(group.id);
                      return (
                        <div key={group.id} className="mb-3 border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
                          <button
                            onClick={() => {
                              setCollapsedGroups(prev => {
                                const next = new Set(prev);
                                next.has(group.id) ? next.delete(group.id) : next.add(group.id);
                                return next;
                              });
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-800/50 text-left text-sm font-medium text-gray-700 dark:text-slate-300"
                          >
                            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {group.name}
                          </button>
                          {!isCollapsed && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
                              {gFields.map(field => (
                                <div key={field.id}>
                                  <label className="text-xs text-gray-500 block mb-0.5">{field.fieldLabel}</label>
                                  <p className="text-sm text-gray-900 dark:text-white">{String(cfValues[field.fieldKey])}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Ungrouped */}
                    {ungrouped.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ungrouped.sort((a, b) => a.displayOrder - b.displayOrder).map(field => (
                          <div key={field.id}>
                            <label className="text-xs text-gray-500 block mb-0.5">{field.fieldLabel}</label>
                            <p className="text-sm text-gray-900 dark:text-white">{String(cfValues[field.fieldKey])}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Custom tabs with data */}
                {tabsWithData.map(tab => {
                  const tabFields = customFields
                    .filter(f => f.tabId === tab.id && cfValues[f.fieldKey] !== undefined && cfValues[f.fieldKey] !== null && cfValues[f.fieldKey] !== '')
                    .sort((a, b) => a.displayOrder - b.displayOrder);

                  return (
                    <div key={tab.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{tab.name}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {tabFields.map(field => (
                          <div key={field.id}>
                            <label className="text-xs text-gray-500 block mb-0.5">{field.fieldLabel}</label>
                            <p className="text-sm text-gray-900 dark:text-white">{String(cfValues[field.fieldKey])}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}

          {/* ── TABS ── */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {[
                { key: 'activity', label: 'Activity', icon: Activity },
                { key: 'notes', label: 'Notes', icon: MessageSquare },
                { key: 'documents', label: 'Documents', icon: FileText },
                { key: 'history', label: 'History', icon: History },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as TabType)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {tabLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activeTab === 'activity' ? (
                <Timeline activities={tabData?.data || tabData || []} />
              ) : activeTab === 'notes' ? (
                <NotesPanel
                  notes={tabData || []}
                  onAddNote={handleNoteAdded}
                />
              ) : activeTab === 'documents' ? (
                <DocumentsPanel
                  documents={tabData || []}
                  entityType="leads"
                  entityId={id!}
                />
              ) : activeTab === 'history' ? (
                <ChangeHistory history={tabData || []} />
              ) : null}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (1/3) ── */}
        <div className="space-y-4">
          {/* Score Card */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Lead Score</h3>
            <div className="text-center">
              <span className={`text-4xl font-bold ${getScoreColor(lead.score)}`}>{lead.score}</span>
              <span className="text-gray-400 text-lg">/100</span>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getScoreBg(lead.score)}`}
                style={{ width: `${Math.min(100, lead.score)}%` }}
              />
            </div>

            {/* Score Breakdown */}
            {lead.scoreBreakdown && Object.keys(lead.scoreBreakdown).length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-500 font-medium">Breakdown:</p>
                {Object.entries(lead.scoreBreakdown).map(([name, info]: [string, any]) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400 truncate">{name}</span>
                    <span className={`font-medium ${info.delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {info.delta > 0 ? '+' : ''}{info.delta}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Owner & Record Team */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Owner</h3>
            {lead.owner ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-medium text-blue-600">
                  {lead.owner.firstName?.[0]}{lead.owner.lastName?.[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {lead.owner.firstName} {lead.owner.lastName}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No owner assigned</p>
            )}

            {/* Record Team */}
            <RecordTeamPanel
              leadId={id!}
              teamMembers={lead.teamMembers || []}
              onRefresh={fetchLead}
              canEdit={canEdit('leads') && !isReadOnly}
            />

            {/* Created by */}
            {lead.createdByUser && (
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500">
                  Created by {lead.createdByUser.firstName} {lead.createdByUser.lastName}
                  {lead.createdAt && <> · {format(new Date(lead.createdAt), 'MMM d, yyyy')}</>}
                </p>
              </div>
            )}
          </div>

          {/* Duplicates Panel */}
          {lead.duplicates && lead.duplicates.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-amber-600 flex items-center gap-1.5 mb-3">
                <AlertTriangle size={14} />
                Potential Duplicates ({lead.duplicates.length})
              </h3>
              <div className="space-y-2">
                {lead.duplicates.map((dup) => (
                  <div key={`${dup.entityType}-${dup.id}`} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/10 rounded">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {dup.firstName ? `${dup.firstName} ${dup.lastName}` : dup.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {dup.entityType} · Match: {dup.matchType}
                      </p>
                    </div>
                    <Link
                      to={`/${dup.entityType === 'lead' ? 'leads' : dup.entityType === 'contact' ? 'contacts' : 'accounts'}/${dup.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Info */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Pipeline</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 8h14M3 12h10M3 16h6" />
                  </svg>
                  {lead.pipeline?.name || 'Default'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Stage</span>
                <span className="text-gray-900 dark:text-white flex items-center gap-1.5">
                  {lead.stage?.color && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: lead.stage.color }} />
                  )}
                  {lead.stage?.name || 'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Source</span>
                <span className="text-gray-900 dark:text-white">{lead.source || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Activity</span>
                <span className="text-gray-900 dark:text-white">
                  {lead.lastActivityAt ? formatDistanceToNow(new Date(lead.lastActivityAt), { addSuffix: true }) : 'Never'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900 dark:text-white">
                  {format(new Date(lead.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {showConvertModal && (
        <ConvertLeadModal
          lead={lead}
          onClose={() => setShowConvertModal(false)}
          onConverted={fetchLead}
        />
      )}

      {showDisqualifyModal && (
        <DisqualifyModal
          leadId={id!}
          onClose={() => setShowDisqualifyModal(false)}
          onDisqualified={fetchLead}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Lead</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete "{fullName}"?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}