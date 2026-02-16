// ============================================================
// FILE: apps/web/src/features/opportunities/OpportunityDetailPage.tsx
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, DollarSign, Building2,
  Trophy, XCircle, RotateCcw, Loader2,
  Users, Package, History, BarChart3, MessageSquare, FileText, Activity,
  UserPlus, X, Search,
} from 'lucide-react';
import { opportunitiesApi } from '../../api/opportunities.api';
import type { Opportunity, OpportunityContact, OpportunityLineItem } from '../../api/opportunities.api';
import { StageJourneyBar } from '../leads/components/StageJourneyBar';
import { CloseWonModal } from './components/CloseWonModal';
import { CloseLostModal } from './components/CloseLostModal';
import { ReopenModal } from './components/ReopenModal';
import { ContactRolesPanel } from './components/ContactRolesPanel';
import { LineItemsPanel } from './components/LineItemsPanel';
import { StageHistoryPanel } from './components/StageHistoryPanel';
import { ForecastView } from './components/ForecastView';
import { usePermissions } from '../../hooks/usePermissions';
//import { AuditLogViewer } from '../../components/shared/AuditLogViewer';
import { DocumentsPanel } from '../../components/shared/DocumentsPanel';

type Tab = 'details' | 'contacts' | 'products' | 'activity' | 'notes' | 'files' | 'history' | 'forecast';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'details', label: 'Details', icon: FileText },
  { id: 'contacts', label: 'Contact Roles', icon: Users },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'notes', label: 'Notes', icon: MessageSquare },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'history', label: 'Stage History', icon: History },
  { id: 'forecast', label: 'Forecast', icon: BarChart3 },
];

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();
  const isAdmin = true; // TODO: pull from auth store

  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('details');

  // Modals
  const [showCloseWon, setShowCloseWon] = useState(false);
  const [showCloseLost, setShowCloseLost] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Related data
  const [contacts, setContacts] = useState<OpportunityContact[]>([]);
  const [lineItems, setLineItems] = useState<OpportunityLineItem[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const fetchOpportunity = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await opportunitiesApi.getOne(id);
      setOpp(data);
    } catch (err) {
      console.error('Failed to fetch opportunity:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOpportunity(); }, [fetchOpportunity]);

  // Load team members
  useEffect(() => {
    if (!id) return;
    opportunitiesApi.getTeamMembers(id).then(d => setTeamMembers(Array.isArray(d) ? d : [])).catch(() => setTeamMembers([]));
  }, [id]);

  // Fetch tab-specific data when tab changes
  useEffect(() => {
    if (!id) return;
    if (activeTab === 'contacts') {
      opportunitiesApi.getContactRoles(id).then(setContacts).catch(console.error);
    } else if (activeTab === 'products') {
      opportunitiesApi.getLineItems(id).then(setLineItems).catch(console.error);
    } else if (activeTab === 'notes') {
      opportunitiesApi.getNotes(id).then(setNotes).catch(console.error);
    } else if (activeTab === 'activity') {
      opportunitiesApi.getActivities(id).then((res) => setActivities(res.data || res || [])).catch(console.error);
    } else if (activeTab === 'files') {
      opportunitiesApi.getDocuments(id).then(d => setDocuments(Array.isArray(d) ? d : [])).catch(console.error);
    }
  }, [id, activeTab]);

  const handleAddNote = async () => {
    if (!id || !newNote.trim()) return;
    setNoteSubmitting(true);
    try {
      await opportunitiesApi.addNote(id, newNote.trim());
      setNewNote('');
      const updated = await opportunitiesApi.getNotes(id);
      setNotes(updated);
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleStageChange = async (stageId: string, stageFields?: Record<string, any>, unlockReason?: string) => {
    if (!id) return;
    await opportunitiesApi.changeStage(id, stageId, stageFields, unlockReason);
    await fetchOpportunity();
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await opportunitiesApi.delete(id);
      navigate('/opportunities');
    } catch (err) {
      console.error('Failed to delete opportunity:', err);
    }
  };

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Opportunity not found</p>
        <button onClick={() => navigate('/opportunities')} className="mt-4 text-blue-600 hover:underline">Back to Opportunities</button>
      </div>
    );
  }

  const isWon = !!opp.wonAt;
  const isLost = !!opp.lostAt;
  const isClosed = isWon || isLost;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/opportunities')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={16} /> Back to Opportunities
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{opp.name}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  {opp.account && (
                    <Link to={`/accounts/${opp.accountId}`} className="flex items-center gap-1 hover:text-blue-600">
                      <Building2 size={14} /> {opp.account.name}
                    </Link>
                  )}
                  {opp.pipeline && (
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-xs">{opp.pipeline.name}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Close Won / Lost buttons (only for open deals) */}
            {!isClosed && canEdit('deals') && (
              <>
                <button onClick={() => setShowCloseWon(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  <Trophy size={14} /> Won
                </button>
                <button onClick={() => setShowCloseLost(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                  <XCircle size={14} /> Lost
                </button>
              </>
            )}

            {/* Reopen (admin only, closed deals) */}
            {isClosed && isAdmin && (
              <button onClick={() => setShowReopen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                <RotateCcw size={14} /> Reopen
              </button>
            )}

            {canEdit('deals') && (
              <button onClick={() => navigate(`/opportunities/${id}/edit`)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Pencil size={14} /> Edit
              </button>
            )}

            {canDelete('deals') && (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-gray-400 hover:text-red-600 rounded-lg">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stage Journey Bar (reuse from leads, adapted) */}
      {opp.allStages && opp.allStages.length > 0 && !isClosed && (
        <StageJourneyBar
          lead={opp as any}
          stages={opp.allStages as any}
          stageSettings={opp.stageSettings || {}}
          onStageChange={handleStageChange}
          onConvert={() => setShowCloseWon(true)}
          onDisqualify={() => setShowCloseLost(true)}
          disabled={isClosed}
        />
      )}

      {/* Won/Lost Banner */}
      {isWon && (
        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <Trophy size={16} />
            Closed Won on {new Date(opp.wonAt!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {opp.closeReason && <> · Reason: {opp.closeReason.name}</>}
            {opp.competitor && <> · Beat: {opp.competitor}</>}
          </p>
        </div>
      )}
      {isLost && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <XCircle size={16} />
            Closed Lost on {new Date(opp.lostAt!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {opp.closeReason && <> · Reason: {opp.closeReason.name}</>}
            {opp.competitor && <> · Lost to: {opp.competitor}</>}
          </p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 mb-6">
        <div className="p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-xs text-gray-500 mb-0.5">Amount</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(opp.amount)}</p>
        </div>
        <div className="p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-xs text-gray-500 mb-0.5">Weighted</p>
          <p className="text-lg font-bold text-emerald-600">{formatCurrency(opp.weightedAmount)}</p>
        </div>
        <div className="p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-xs text-gray-500 mb-0.5">Probability</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{opp.probability ?? '—'}%</p>
        </div>
        <div className="p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-xs text-gray-500 mb-0.5">Close Date</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {opp.closeDate ? new Date(opp.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
          </p>
        </div>
        <div className="p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-xs text-gray-500 mb-0.5">Forecast</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{opp.forecastCategory || '—'}</p>
        </div>
      </div>

      {/* 2-Column Layout: Tabs + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN (2/3): Tabs */}
        <div className="lg:col-span-2">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Opportunity Info</h3>
              <DetailRow label="Name" value={opp.name} />
              <DetailRow label="Type" value={opp.type} />
              <DetailRow label="Lead Source" value={opp.source} />
              <DetailRow label="Next Step" value={opp.nextStep} />
              <DetailRow label="Competitor" value={opp.competitor} />
              <DetailRow label="Description" value={opp.description} />
              {opp.tags && opp.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {opp.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 text-xs rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">People & Dates</h3>
              <DetailRow label="Account" value={opp.account?.name} link={opp.accountId ? `/accounts/${opp.accountId}` : undefined} />
              <DetailRow label="Primary Contact" value={opp.primaryContact ? `${opp.primaryContact.firstName} ${opp.primaryContact.lastName}` : null} link={opp.primaryContactId ? `/contacts/${opp.primaryContactId}` : undefined} />
              <DetailRow label="Owner" value={opp.owner ? `${opp.owner.firstName} ${opp.owner.lastName}` : null} />
              <DetailRow label="Created" value={new Date(opp.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
              <DetailRow label="Last Activity" value={opp.lastActivityAt ? new Date(opp.lastActivityAt).toLocaleDateString() : null} />
              {opp.closeNotes && <DetailRow label="Close Notes" value={opp.closeNotes} />}
            </div>
          </div>
        )}

        {/* Contact Roles Tab */}
        {activeTab === 'contacts' && (
          <ContactRolesPanel
            opportunityId={opp.id}
            contacts={contacts}
            onRefresh={() => id && opportunitiesApi.getContactRoles(id).then(setContacts)}
            canEdit={canEdit('deals')}
          />
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <LineItemsPanel
            opportunityId={opp.id}
            lineItems={lineItems}
            onRefresh={() => {
              if (id) {
                opportunitiesApi.getLineItems(id).then(setLineItems);
                fetchOpportunity(); // refresh amount
              }
            }}
            canEdit={canEdit('deals')}
          />
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>
            ) : (
              activities.map((a: any, idx: number) => (
                <div key={a.id || idx} className="flex gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <Activity size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{a.title || a.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div>
            {canEdit('deals') && (
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  placeholder="Add a note..."
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
                <button
                  onClick={handleAddNote}
                  disabled={noteSubmitting || !newNote.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {noteSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
                </button>
              </div>
            )}
            {notes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No notes yet</p>
            ) : (
              <div className="space-y-2">
                {notes.map((n: any) => (
                  <div key={n.id} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{n.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {n.createdByName || 'System'} · {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <DocumentsPanel
            documents={Array.isArray(documents) ? documents : []}
            entityType="leads"
            entityId={id!}
            onDocumentUploaded={() => {
              if (id) opportunitiesApi.getDocuments(id).then(d => setDocuments(Array.isArray(d) ? d : []));
            }}
            onDocumentDeleted={() => {
              if (id) opportunitiesApi.getDocuments(id).then(d => setDocuments(Array.isArray(d) ? d : []));
            }}
          />
        )}

        {/* Stage History Tab */}
        {activeTab === 'history' && <StageHistoryPanel opportunityId={opp.id} />}

        {/* Forecast Tab */}
        {activeTab === 'forecast' && <ForecastView pipelineId={opp.pipelineId || undefined} />}
      </div>
        </div>

        {/* RIGHT COLUMN (1/3): Owner + Record Team */}
        <div className="space-y-4">
          {/* Owner */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Owner</h3>
            {opp.owner ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-medium text-blue-600">
                  {opp.owner.firstName?.[0]}{opp.owner.lastName?.[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {opp.owner.firstName} {opp.owner.lastName}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No owner assigned</p>
            )}
          </div>

          {/* Record Team */}
          <RecordTeamSection
            opportunityId={id!}
            teamMembers={teamMembers}
            onRefresh={() => {
              if (id) opportunitiesApi.getTeamMembers(id).then(d => setTeamMembers(Array.isArray(d) ? d : [])).catch(() => []);
            }}
            canEdit={canEdit('deals')}
          />

          {/* Quick Info */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Details</h3>
            <div className="space-y-3 text-sm">
              {opp.type && (
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="text-gray-900 dark:text-white">{opp.type}</p>
                </div>
              )}
              {opp.source && (
                <div>
                  <p className="text-xs text-gray-500">Source</p>
                  <p className="text-gray-900 dark:text-white">{opp.source}</p>
                </div>
              )}
              {opp.competitor && (
                <div>
                  <p className="text-xs text-gray-500">Competitor</p>
                  <p className="text-gray-900 dark:text-white">{opp.competitor}</p>
                </div>
              )}
              {opp.nextStep && (
                <div>
                  <p className="text-xs text-gray-500">Next Step</p>
                  <p className="text-gray-900 dark:text-white">{opp.nextStep}</p>
                </div>
              )}
              {opp.createdAt && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-400">
                    Created {new Date(opp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCloseWon && <CloseWonModal opportunityId={opp.id} currentAmount={opp.amount} onClose={() => setShowCloseWon(false)} onClosed={fetchOpportunity} />}
      {showCloseLost && <CloseLostModal opportunityId={opp.id} onClose={() => setShowCloseLost(false)} onClosed={fetchOpportunity} />}
      {showReopen && <ReopenModal opportunityId={opp.id} stages={opp.allStages || []} onClose={() => setShowReopen(false)} onReopened={fetchOpportunity} />}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-sm shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Opportunity?</h3>
            <p className="text-sm text-gray-500 mb-4">This will permanently delete "{opp.name}" and all related data.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple detail row
function DetailRow({ label, value, link }: { label: string; value: string | null | undefined; link?: string }) {
  if (!value) return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-300 dark:text-gray-600">—</p>
    </div>
  );
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      {link ? (
        <Link to={link} className="text-sm text-blue-600 hover:underline">{value}</Link>
      ) : (
        <p className="text-sm text-gray-900 dark:text-white">{value}</p>
      )}
    </div>
  );
}

// ============================================================
// RECORD TEAM SECTION (internal users working on this deal)
// ============================================================
function RecordTeamSection({
  opportunityId, teamMembers, onRefresh, canEdit,
}: { opportunityId: string; teamMembers: any[]; onRefresh: () => void; canEdit: boolean }) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!search || search.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users?search=${encodeURIComponent(search)}&limit=5`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } },
        );
        const data = await response.json();
        const existingIds = new Set(teamMembers.map(m => m.userId));
        setResults((data.data || []).filter((u: any) => !existingIds.has(u.id)));
      } catch { /* ignore */ }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, teamMembers]);

  const handleAdd = async (userId: string) => {
    try {
      await opportunitiesApi.addTeamMember(opportunityId, userId);
      setShowAdd(false);
      setSearch('');
      setResults([]);
      onRefresh();
    } catch (err) { console.error('Failed to add team member:', err); }
  };

  const handleRemove = async (userId: string) => {
    setRemoving(userId);
    try {
      await opportunitiesApi.removeTeamMember(opportunityId, userId);
      onRefresh();
    } catch (err) { console.error('Failed to remove:', err); }
    finally { setRemoving(null); }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
          <Users size={12} /> Record Team
        </h3>
        {canEdit && (
          <button onClick={() => setShowAdd(!showAdd)} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Add team member">
            {showAdd ? <X size={14} /> : <UserPlus size={14} />}
          </button>
        )}
      </div>

      {/* Add Member */}
      {showAdd && (
        <div className="mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              autoFocus
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
          {searchLoading && <p className="text-xs text-gray-400 mt-1">Searching...</p>}
          {results.length > 0 && (
            <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {results.map(u => (
                <button key={u.id} onClick={() => handleAdd(u.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-800 text-xs border-t first:border-t-0 border-gray-100 dark:border-gray-800">
                  <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-medium">
                    {u.firstName?.[0]}{u.lastName?.[0]}
                  </div>
                  {u.firstName} {u.lastName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team List */}
      {teamMembers.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No team members</p>
      ) : (
        <div className="space-y-2">
          {teamMembers.map((m: any) => (
            <div key={m.id || m.userId} className="flex items-center justify-between group">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-medium text-gray-500 flex-shrink-0">
                  {m.firstName?.[0]}{m.lastName?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                    {m.firstName} {m.lastName}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {m.roleName || 'Member'} · {m.accessLevel === 'write' ? 'Read/Write' : 'Read-only'}
                  </p>
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => handleRemove(m.userId)}
                  disabled={removing === m.userId}
                  className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {removing === m.userId ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}