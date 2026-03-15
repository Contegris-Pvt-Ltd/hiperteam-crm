// ============================================================
// FILE: apps/web/src/features/opportunities/OpportunityDetailPage.tsx
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, DollarSign, Building2,
  Trophy, XCircle, RotateCcw, Loader2, CheckSquare,
  Users, Package, History, BarChart3, MessageSquare, FileText, Activity,
  UserPlus, X, Search, Copy, Send, Plus, Download, Mail, CheckCircle,
  FileSignature, Link2, ChevronDown, RefreshCw, Receipt,
} from 'lucide-react';
import { opportunitiesApi } from '../../api/opportunities.api';
import { proposalsApi } from '../../api/proposals.api';
import { api } from '../../api/contacts.api';
import type { Proposal, ProposalLineItem, CreateProposalData } from '../../api/proposals.api';
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
import { OwnerCard } from '../../components/shared/OwnerCard';
import { EntityTasksPanel } from '../tasks/components/EntityTasksPanel';
import { EntityEmailsTab } from '../email/EntityEmailsTab';
import { projectsApi } from '../../api/projects.api';
import { contractsApi } from '../../api/contracts.api';
import type { Contract } from '../../api/contracts.api';
import { invoicesApi } from '../../api/invoices.api';
import type { Invoice, InvoiceLineItem } from '../../api/invoices.api';

type Tab = 'details' | 'contacts' | 'products' | 'proposals' | 'contracts' | 'invoices' | 'activity' | 'emails' | 'notes' | 'tasks' | 'files' | 'history' | 'forecast';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'details', label: 'Details', icon: FileText },
  { id: 'contacts', label: 'Contact Roles', icon: Users },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'proposals', label: 'Proposals', icon: FileText },
  { id: 'contracts', label: 'Contracts', icon: FileSignature },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'emails', label: 'Emails', icon: Mail },
  { id: 'notes', label: 'Notes', icon: MessageSquare },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
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
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Create project from opportunity
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [bannerTemplates, setBannerTemplates] = useState<import('../../api/projects.api').ProjectTemplate[]>([]);
  const [bannerTemplateId, setBannerTemplateId] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

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
    } else if (activeTab === 'proposals') {
      opportunitiesApi.getLineItems(id).then(setLineItems).catch(console.error);
      setProposalsLoading(true);
      proposalsApi.getAll(id).then(setProposals).catch(console.error).finally(() => setProposalsLoading(false));
    } else if (activeTab === 'contracts') {
      setContractsLoading(true);
      contractsApi.getAll(id).then(setContracts).catch(console.error).finally(() => setContractsLoading(false));
      // Also load proposals for "Create from Proposal" dropdown
      if (proposals.length === 0) {
        proposalsApi.getAll(id).then(setProposals).catch(console.error);
      }
    } else if (activeTab === 'invoices') {
      setInvoicesLoading(true);
      invoicesApi.getAll({ opportunityId: id })
        .then(res => setInvoices(res.data))
        .catch(console.error)
        .finally(() => setInvoicesLoading(false));
      // Also load contracts & proposals for "Create from" options
      if (contracts.length === 0) {
        contractsApi.getAll(id).then(setContracts).catch(console.error);
      }
      if (proposals.length === 0) {
        proposalsApi.getAll(id).then(setProposals).catch(console.error);
      }
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

  const handleCreateProject = async () => {
    if (!projectForm.name.trim() && !bannerTemplateId) return;
    setCreatingProject(true);
    try {
      let created;
      if (bannerTemplateId) {
        created = await projectsApi.createFromOpportunity({
          opportunityId: opp.id,
          templateId: bannerTemplateId,
        });
      } else {
        created = await projectsApi.create({
          name: projectForm.name.trim(),
          description: projectForm.description.trim() || null,
          startDate: projectForm.startDate || null,
          endDate: projectForm.endDate || null,
          opportunityId: opp.id,
          accountId: opp.accountId || null,
        });
      }
      setCreatedProjectId(created.id);
      setCreateProjectOpen(false);
    } catch (err) {
      console.error('Failed to create project', err);
    } finally {
      setCreatingProject(false);
    }
  };

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
        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between">
          <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <Trophy size={16} />
            Closed Won on {new Date(opp.wonAt!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {opp.closeReason && <> · Reason: {opp.closeReason.name}</>}
            {opp.competitor && <> · Beat: {opp.competitor}</>}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {!createdProjectId && (
              <button
                onClick={() => {
                  setProjectForm(f => ({
                    ...f,
                    name: opp.name ?? '',
                    description: opp.description ?? '',
                  }));
                  setBannerTemplateId('');
                  projectsApi.getTemplates().then(setBannerTemplates).catch(console.error);
                  setCreateProjectOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <Plus size={14} /> Create Project
              </button>
            )}
            {createdProjectId && (
              <button
                onClick={() => navigate(`/projects/${createdProjectId}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-green-600 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                View Project
              </button>
            )}
          </div>
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
              <DetailRow label="Team" value={opp.team?.name ?? null} />
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

        {/* Proposals Tab */}
        {activeTab === 'proposals' && (
          <ProposalsTab
            opportunityId={opp.id}
            proposals={proposals}
            loading={proposalsLoading}
            canEdit={canEdit('deals')}
            opportunityLineItems={lineItems}
            contacts={contacts}
            accountEmail={opp.account?.email}
            contactEmail={opp.primaryContact?.email}
            onRefresh={() => {
              if (id) {
                setProposalsLoading(true);
                proposalsApi.getAll(id).then(setProposals).catch(console.error).finally(() => setProposalsLoading(false));
              }
            }}
            onSent={() => {
              if (id) {
                setProposalsLoading(true);
                proposalsApi.getAll(id).then(setProposals).catch(console.error).finally(() => setProposalsLoading(false));
              }
            }}
          />
        )}

        {/* Contracts Tab */}
        {activeTab === 'contracts' && opp && (
          <ContractsTab
            opportunityId={opp.id}
            contracts={contracts}
            loading={contractsLoading}
            proposals={proposals}
            canEdit={canEdit('deals')}
            onRefresh={() => {
              setContractsLoading(true);
              contractsApi.getAll(opp.id)
                .then(setContracts)
                .catch(console.error)
                .finally(() => setContractsLoading(false));
            }}
          />
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && opp && (
          <InvoicesTab
            opportunityId={opp.id}
            invoices={invoices}
            loading={invoicesLoading}
            contracts={contracts}
            proposals={proposals}
            canEdit={canEdit('deals')}
            accountEmail={opp.account?.email}
            contactEmail={opp.primaryContact?.email}
            onRefresh={() => {
              setInvoicesLoading(true);
              invoicesApi.getAll({ opportunityId: id })
                .then(res => setInvoices(res.data))
                .catch(console.error)
                .finally(() => setInvoicesLoading(false));
            }}
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

        {activeTab === 'emails' && (
          <EntityEmailsTab
            entityType="opportunity"
            entityId={opp.id}
            entityEmail={opp.primaryContact?.email ?? undefined}
          />
        )}

        {activeTab === 'tasks' && (
          <EntityTasksPanel
            entityType="opportunities"
            entityId={opp.id}
            entityName={opp.name}
          />
        )}
      </div>
        </div>

        {/* RIGHT COLUMN (1/3): Owner + Record Team */}
        <div className="space-y-4">
          {/* Owner */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <OwnerCard
              owner={opp.owner}
              onUpdate={async (ownerId) => {
                await opportunitiesApi.update(id!, { ownerId: ownerId } as any);
                await fetchOpportunity();
              }}
            />
          </div>

          {/* Team */}
          {opp.team && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Team</h3>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{opp.team.name}</p>
            </div>
          )}

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
      {showCloseWon && <CloseWonModal opportunityId={opp.id} opportunityName={opp.name} currentAmount={opp.amount} onClose={() => setShowCloseWon(false)} onClosed={(projectId) => { if (projectId) setCreatedProjectId(projectId); fetchOpportunity(); }} />}
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

      {/* ── CREATE PROJECT FROM OPPORTUNITY ──────────────── */}
      {createProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Create Project from Opportunity
            </h3>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block">
                  Project Template
                </label>
                <select
                  value={bannerTemplateId}
                  onChange={(e) => setBannerTemplateId(e.target.value)}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No template (blank project)</option>
                  {bannerTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.estimatedDays ? ` (${t.estimatedDays} days)` : ''}
                    </option>
                  ))}
                </select>
                {bannerTemplateId && bannerTemplates.find(t => t.id === bannerTemplateId)?.description && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {bannerTemplates.find(t => t.id === bannerTemplateId)?.description}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={projectForm.description}
                  onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={projectForm.startDate}
                    onChange={e => setProjectForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={projectForm.endDate}
                    onChange={e => setProjectForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setCreateProjectOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={creatingProject || (!projectForm.name.trim() && !bannerTemplateId)}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium disabled:opacity-50"
              >
                {creatingProject ? 'Creating…' : 'Create Project'}
              </button>
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
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Remove member"
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

// ============================================================
// PROPOSALS TAB
// ============================================================
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  published: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  viewed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  declined: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const EMPTY_LINE_ITEM: ProposalLineItem = { description: '', quantity: 1, unitPrice: 0, discount: 0, discountType: 'percentage' };

// ============================================================
// SendProposalEmailModal
// ============================================================
function SendProposalEmailModal({
  proposal, opportunityId, contacts, accountEmail, contactEmail, onClose, onSent,
}: {
  proposal: Proposal;
  opportunityId: string;
  contacts: OpportunityContact[];
  accountEmail?: string | null;
  contactEmail?: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState(`Proposal: ${proposal.title}`);
  const [manualEmail, setManualEmail] = useState('');
  const [activeField, setActiveField] = useState<'to' | 'cc' | 'bcc'>('to');
  const [sending, setSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);

  // Pre-fill from primary contact + opportunity contact + account email
  useEffect(() => {
    const emails: string[] = [];
    const seen = new Set<string>();
    const primary = contacts.find(c => c.isPrimary && c.email);
    if (primary?.email) { seen.add(primary.email.toLowerCase()); emails.push(primary.email); }
    if (contactEmail && !seen.has(contactEmail.toLowerCase())) { seen.add(contactEmail.toLowerCase()); emails.push(contactEmail); }
    if (accountEmail && !seen.has(accountEmail.toLowerCase())) { emails.push(accountEmail); }
    if (emails.length > 0) setTo(emails);
  }, [contacts, accountEmail, contactEmail]);

  const addEmail = (email: string, field: 'to' | 'cc' | 'bcc') => {
    const setter = field === 'to' ? setTo : field === 'cc' ? setCc : setBcc;
    const current = field === 'to' ? to : field === 'cc' ? cc : bcc;
    if (email && !current.includes(email)) setter([...current, email]);
  };

  const removeEmail = (email: string, field: 'to' | 'cc' | 'bcc') => {
    const setter = field === 'to' ? setTo : field === 'cc' ? setCc : setBcc;
    setter(prev => prev.filter(e => e !== email));
  };

  const handleAddManual = () => {
    const trimmed = manualEmail.trim();
    if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      addEmail(trimmed, activeField);
      setManualEmail('');
    }
  };

  const handleSend = async () => {
    if (to.length === 0) return;
    setSending(true);
    try {
      await proposalsApi.sendWithEmail(opportunityId, proposal.id, {
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject: subject.trim() || undefined,
      });
      onSent();
      onClose();
    } catch (err) {
      console.error('Failed to send proposal email:', err);
    } finally {
      setSending(false);
    }
  };

  const renderChips = (emails: string[], field: 'to' | 'cc' | 'bcc') => (
    <div className="flex flex-wrap gap-1">
      {emails.map(email => (
        <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs">
          {email}
          <button onClick={() => removeEmail(email, field)} className="hover:text-red-500">
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );

  const contactsWithEmail = contacts.filter(c => c.email);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-purple-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Send Proposal via Email</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* To field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">To *</label>
              {!showCcBcc && (
                <button onClick={() => setShowCcBcc(true)} className="text-xs text-purple-600 hover:underline">
                  CC / BCC
                </button>
              )}
            </div>
            {renderChips(to, 'to')}
            {/* Quick-add from contacts */}
            {contactsWithEmail.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {contactsWithEmail
                  .filter(c => c.email && !to.includes(c.email))
                  .map(c => (
                    <button
                      key={c.contactId}
                      onClick={() => { addEmail(c.email!, activeField); }}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    >
                      + {c.firstName} {c.lastName}
                    </button>
                  ))}
              </div>
            )}
            <div className="flex gap-1 mt-1">
              <input
                value={manualEmail}
                onChange={e => setManualEmail(e.target.value)}
                onFocus={() => setActiveField('to')}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddManual(); } }}
                placeholder="Type email and press Enter"
                className="flex-1 text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* CC / BCC */}
          {showCcBcc && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">CC</label>
                {renderChips(cc, 'cc')}
                <input
                  placeholder="Type email and press Enter"
                  onFocus={() => setActiveField('cc')}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                        addEmail(val, 'cc');
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">BCC</label>
                {renderChips(bcc, 'bcc')}
                <input
                  placeholder="Type email and press Enter"
                  onFocus={() => setActiveField('bcc')}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                        addEmail(val, 'bcc');
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                  className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white mt-1"
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Proposal summary */}
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <p><strong>Proposal:</strong> {proposal.title}</p>
            <p><strong>Amount:</strong> {proposal.currency} {proposal.totalAmount.toFixed(2)}</p>
            {proposal.validUntil && <p><strong>Valid until:</strong> {new Date(proposal.validUntil).toLocaleDateString()}</p>}
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
            disabled={sending || to.length === 0}
            className="px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Send Email
          </button>
        </div>
      </div>
    </div>
  );
}

function ProposalsTab({
  opportunityId, proposals, loading, canEdit, onRefresh, opportunityLineItems, contacts, accountEmail, contactEmail, onSent,
}: {
  opportunityId: string;
  proposals: Proposal[];
  loading: boolean;
  canEdit: boolean;
  onRefresh: () => void;
  opportunityLineItems: OpportunityLineItem[];
  contacts: OpportunityContact[];
  accountEmail?: string | null;
  contactEmail?: string | null;
  onSent: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailModal, setEmailModal] = useState<Proposal | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [coverMessage, setCoverMessage] = useState('');
  const [terms, setTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [lineItems, setLineItems] = useState<ProposalLineItem[]>([{ ...EMPTY_LINE_ITEM }]);

  const resetForm = () => {
    setTitle('');
    setCoverMessage('');
    setTerms('');
    setValidUntil('');
    setCurrency('USD');
    setLineItems([{ ...EMPTY_LINE_ITEM }]);
    setEditingId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    setTitle('');
    setCoverMessage('');
    setTerms('');
    setValidUntil('');
    setCurrency('USD');
    setLineItems(
      opportunityLineItems.length > 0
        ? opportunityLineItems.map(li => ({
            productId: li.productId,
            description: li.productName,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            discount: li.discount,
            discountType: li.discountType,
          }))
        : [{ description: '', quantity: 1, unitPrice: 0, discount: 0, discountType: 'percentage' as const }]
    );
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = async (p: Proposal) => {
    // Fetch full proposal with line items (list endpoint only returns lineItemCount)
    try {
      const full = await proposalsApi.getOne(opportunityId, p.id);
      setEditingId(full.id);
      setTitle(full.title);
      setCoverMessage(full.coverMessage || '');
      setTerms(full.terms || '');
      setValidUntil(full.validUntil ? full.validUntil.slice(0, 10) : '');
      setCurrency(full.currency || 'USD');
      setLineItems(
        full.lineItems && full.lineItems.length > 0
          ? full.lineItems.map(li => ({ ...li }))
          : [{ ...EMPTY_LINE_ITEM }],
      );
      setShowForm(true);
    } catch (err) {
      console.error('Failed to load proposal for editing:', err);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const dto: CreateProposalData = {
        title: title.trim(),
        coverMessage: coverMessage.trim() || undefined,
        terms: terms.trim() || undefined,
        validUntil: validUntil || undefined,
        currency,
        lineItems: lineItems.filter(li => li.description.trim()),
      };
      if (editingId) {
        await proposalsApi.update(opportunityId, editingId, dto);
      } else {
        await proposalsApi.create(opportunityId, dto);
      }
      resetForm();
      onRefresh();
    } catch (err) {
      console.error('Failed to save proposal:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (proposalId: string) => {
    setDeletingId(proposalId);
    try {
      await proposalsApi.delete(opportunityId, proposalId);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete proposal:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePublish = async (proposalId: string) => {
    setPublishingId(proposalId);
    setPublishMessage(null);
    try {
      const result = await proposalsApi.publish(opportunityId, proposalId);
      if (result && (result as any).approvalRequired) {
        const req = (result as any).approvalRequest;
        const currentStep = req?.steps?.find((s: any) => s.stepOrder === req.currentStep);
        const approverName = currentStep?.approverName || 'the designated approver';
        setPublishMessage({ type: 'info', text: `Proposal submitted for approval. Pending with ${approverName} (step ${req?.currentStep || 1} of ${req?.steps?.length || 1}).` });
      } else {
        setPublishMessage({ type: 'success', text: 'Proposal published successfully.' });
      }
      onRefresh();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to publish proposal';
      setPublishMessage({ type: 'error', text: msg });
    } finally {
      setPublishingId(null);
    }
  };

  const handleCopyLink = (p: Proposal) => {
    if (!p.publicToken) return;
    const url = `${window.location.origin}/proposals/public/${p.tenantId}/${p.publicToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadPdf = async (proposalId: string) => {
    try {
      const response = await api.get(
        `/opportunities/${opportunityId}/proposals/${proposalId}/pdf`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `proposal-${proposalId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    }
  };

  const updateLineItem = (index: number, field: keyof ProposalLineItem, value: any) => {
    setLineItems(prev => prev.map((li, i) => (i === index ? { ...li, [field]: value } : li)));
  };

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  };

  const handleProductSelect = (index: number, productId: string) => {
    if (!productId) {
      setLineItems(prev => prev.map((li, i) => i === index ? {
        ...li, productId: undefined, unitPrice: 0, quantity: 1, discount: 0,
      } : li));
      return;
    }
    const match = opportunityLineItems.find(oli => oli.productId === productId);
    if (match) {
      setLineItems(prev => prev.map((li, i) => i === index ? {
        ...li,
        productId: match.productId,
        description: match.productName,
        quantity: match.quantity,
        unitPrice: match.unitPrice,
        discount: match.discount,
        discountType: match.discountType,
      } : li));
    }
  };

  const calcLineTotal = (li: ProposalLineItem) => {
    const subtotal = li.quantity * li.unitPrice;
    if (!li.discount) return subtotal;
    return li.discountType === 'percentage'
      ? subtotal * (1 - li.discount / 100)
      : subtotal - li.discount;
  };

  const formTotal = lineItems.reduce((sum, li) => sum + calcLineTotal(li), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Proposals ({proposals.length})
        </h3>
        {canEdit && !showForm && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus size={14} /> New Proposal
          </button>
        )}
      </div>

      {/* Publish notification banner */}
      {publishMessage && (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm ${
          publishMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
          publishMessage.type === 'info' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
          'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
        }`}>
          <span>{publishMessage.text}</span>
          <button onClick={() => setPublishMessage(null)} className="text-current opacity-60 hover:opacity-100 shrink-0">&times;</button>
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4 bg-gray-50 dark:bg-slate-800/50">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {editingId ? 'Edit Proposal' : 'New Proposal'}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                placeholder="Proposal title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="PKR">PKR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valid Until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={e => setValidUntil(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Cover Message</label>
            <textarea
              value={coverMessage}
              onChange={e => setCoverMessage(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              placeholder="Optional message to the client..."
            />
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Line Items</label>
              <button
                onClick={() => setLineItems(prev => [...prev, { ...EMPTY_LINE_ITEM }])}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <Plus size={12} /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {lineItems.map((li, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-3">
                    {idx === 0 && <p className="text-[10px] text-gray-400 mb-0.5">Product</p>}
                    <select
                      value={li.productId || ''}
                      onChange={e => handleProductSelect(idx, e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                    >
                      {opportunityLineItems.map((oli, oIdx) => (
                        <option key={oli.productId || oIdx} value={oli.productId || ''}>
                          {oli.productName}
                        </option>
                      ))}
                      <option value="">+ Custom Item</option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <p className="text-[10px] text-gray-400 mb-0.5">Description</p>}
                    <input
                      value={li.description}
                      onChange={e => updateLineItem(idx, 'description', e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                      placeholder="Item description"
                    />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <p className="text-[10px] text-gray-400 mb-0.5">Qty</p>}
                    <input
                      type="number"
                      min={1}
                      value={li.quantity}
                      onChange={e => updateLineItem(idx, 'quantity', Number(e.target.value))}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <p className="text-[10px] text-gray-400 mb-0.5">Unit Price</p>}
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={li.unitPrice}
                      onChange={e => updateLineItem(idx, 'unitPrice', Number(e.target.value))}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="col-span-1">
                    {idx === 0 && <p className="text-[10px] text-gray-400 mb-0.5">Disc%</p>}
                    <input
                      type="number"
                      min={0}
                      value={li.discount || 0}
                      onChange={e => updateLineItem(idx, 'discount', Number(e.target.value))}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="col-span-1 pt-1.5">
                    {idx === 0 && <p className="text-[10px] text-transparent mb-0.5">.</p>}
                    <button onClick={() => removeLineItem(idx)} className="text-gray-300 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Total: {currency} {formTotal.toFixed(2)}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Terms & Conditions</label>
            <textarea
              value={terms}
              onChange={e => setTerms(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              placeholder="Payment terms, delivery conditions..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Update' : 'Create'} Proposal
            </button>
          </div>
        </div>
      )}

      {/* Proposals List */}
      {proposals.length === 0 && !showForm ? (
        <div className="text-center py-10">
          <FileText className="mx-auto w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500">No proposals yet</p>
          {canEdit && (
            <button
              onClick={openCreate}
              className="mt-3 text-sm text-purple-600 hover:text-purple-700"
            >
              Create your first proposal
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map(p => (
            <div key={p.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.title}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[p.status] || STATUS_COLORS.draft}`}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {p.currency} {p.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    {p.lineItemCount !== undefined && (
                      <span>{p.lineItemCount} item{p.lineItemCount !== 1 ? 's' : ''}</span>
                    )}
                    {p.validUntil && (
                      <span>Valid until {new Date(p.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    )}
                    <span>Created {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  {p.sentAt && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Sent {new Date(p.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {p.viewedAt && <> · Viewed {new Date(p.viewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                  {p.status === 'draft' && canEdit && (
                    <>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handlePublish(p.id)}
                        disabled={publishingId === p.id}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"
                        title="Publish"
                      >
                        {publishingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      </button>
                    </>
                  )}
                  {['published', 'sent', 'accepted'].includes(p.status) && canEdit && (
                    <button
                      onClick={() => setEmailModal(p)}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 rounded"
                      title={p.status === 'published' ? 'Send via Email' : 'Resend Email'}
                    >
                      {p.status === 'published' ? <Mail size={14} /> : <RefreshCw size={14} />}
                    </button>
                  )}
                  {p.publicToken && p.status !== 'draft' && (
                    <button
                      onClick={() => handleCopyLink(p)}
                      className="p-1.5 text-gray-400 hover:text-purple-600 rounded"
                      title={copiedId === p.id ? 'Copied!' : 'Copy public link'}
                    >
                      {copiedId === p.id ? (
                        <span className="text-[10px] text-emerald-600 font-medium">Copied</span>
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleDownloadPdf(p.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                    title="Download PDF"
                  >
                    <Download size={14} />
                  </button>
                  {p.status === 'draft' && canEdit && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="p-1.5 text-gray-300 hover:text-red-500 rounded"
                      title="Delete"
                    >
                      {deletingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Send Email Modal */}
      {emailModal && (
        <SendProposalEmailModal
          proposal={emailModal}
          opportunityId={opportunityId}
          contacts={contacts}
          accountEmail={accountEmail}
          contactEmail={contactEmail}
          onClose={() => setEmailModal(null)}
          onSent={() => { setEmailModal(null); onSent(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// CONTRACTS TAB
// ============================================================

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  draft:            'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  sent_for_signing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  partially_signed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  fully_signed:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  expired:          'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  terminated:       'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  renewed:          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft:            'Draft',
  sent_for_signing: 'Sent for Signing',
  partially_signed: 'Partially Signed',
  fully_signed:     'Fully Signed',
  expired:          'Expired',
  terminated:       'Terminated',
  renewed:          'Renewed',
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  nda:               'NDA',
  msa:               'MSA',
  sow:               'SOW',
  service_agreement: 'Service Agreement',
  custom:            'Custom',
};

const SIG_DOT_COLORS: Record<string, string> = {
  signed:   'bg-green-500',
  sent:     'bg-amber-400',
  pending:  'bg-gray-300',
  declined: 'bg-red-500',
};

interface ContractsTabProps {
  opportunityId: string;
  contracts: Contract[];
  loading: boolean;
  proposals: Proposal[];
  canEdit: boolean;
  onRefresh: () => void;
}

function ContractsTab({
  opportunityId, contracts, loading, proposals, canEdit, onRefresh,
}: ContractsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [terminating, setTerminating] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkDropdown, setLinkDropdown] = useState<string | null>(null);

  // Form state
  const [useProposal, setUseProposal] = useState(true);
  const [form, setForm] = useState<{
    proposalId: string;
    title: string;
    type: string;
    value: number;
    currency: string;
    startDate: string;
    endDate: string;
    renewalDate: string;
    autoRenewal: boolean;
    terms: string;
    signMode: string;
    signatories: Array<{
      signatoryType: 'internal' | 'external';
      signOrder: number;
      name: string;
      email: string;
    }>;
  }>({
    proposalId: '',
    title: '',
    type: 'service_agreement',
    value: 0,
    currency: 'USD',
    startDate: '',
    endDate: '',
    renewalDate: '',
    autoRenewal: false,
    terms: '',
    signMode: 'internal',
    signatories: [
      { signatoryType: 'internal', signOrder: 1, name: '', email: '' },
      { signatoryType: 'external', signOrder: 2, name: '', email: '' },
    ],
  });

  const eligibleProposals = proposals.filter(p =>
    ['accepted', 'published', 'sent'].includes(p.status)
  );

  const handleProposalSelect = (proposalId: string) => {
    const selected = proposals.find(p => p.id === proposalId);
    setForm(prev => ({
      ...prev,
      proposalId,
      title: selected ? selected.title : prev.title,
      value: selected ? selected.totalAmount : prev.value,
      currency: selected ? selected.currency : prev.currency,
      terms: selected?.terms || prev.terms,
    }));
  };

  const updateForm = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateSignatory = (index: number, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      signatories: prev.signatories.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  const addSignatory = () => {
    setForm(prev => ({
      ...prev,
      signatories: [
        ...prev.signatories,
        { signatoryType: 'external' as const, signOrder: prev.signatories.length + 1, name: '', email: '' },
      ],
    }));
  };

  const removeSignatory = (index: number) => {
    if (form.signatories.length <= 1) return;
    setForm(prev => ({
      ...prev,
      signatories: prev.signatories
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, signOrder: i + 1 })),
    }));
  };

  const resetForm = () => {
    setForm({
      proposalId: '',
      title: '',
      type: 'service_agreement',
      value: 0,
      currency: 'USD',
      startDate: '',
      endDate: '',
      renewalDate: '',
      autoRenewal: false,
      terms: '',
      signMode: 'internal',
      signatories: [
        { signatoryType: 'internal' as const, signOrder: 1, name: '', email: '' },
        { signatoryType: 'external' as const, signOrder: 2, name: '', email: '' },
      ],
    });
    setUseProposal(true);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (contract: Contract) => {
    setForm({
      proposalId: contract.proposalId || '',
      title: contract.title,
      type: contract.type,
      value: contract.value,
      currency: contract.currency,
      startDate: contract.startDate ? contract.startDate.slice(0, 10) : '',
      endDate: contract.endDate ? contract.endDate.slice(0, 10) : '',
      renewalDate: contract.renewalDate ? contract.renewalDate.slice(0, 10) : '',
      autoRenewal: contract.autoRenewal,
      terms: contract.terms || '',
      signMode: contract.signMode || 'internal',
      signatories: (contract.signatories || []).map(s => ({
        signatoryType: s.signatoryType,
        signOrder: s.signOrder,
        name: s.name,
        email: s.email,
      })),
    });
    setUseProposal(!!contract.proposalId);
    setEditingId(contract.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (useProposal && !form.proposalId) return;
    if (!useProposal && !form.title.trim()) return;
    setSaving(true);
    try {
      const dto: any = {
        ...form,
        signatories: form.signatories.filter(s => s.name.trim() && s.email.trim()),
      };
      if (!useProposal) delete dto.proposalId;
      if (editingId) {
        await contractsApi.update(opportunityId, editingId, dto);
      } else {
        await contractsApi.create(opportunityId, dto);
      }
      resetForm();
      onRefresh();
    } catch (err) {
      console.error(`Failed to ${editingId ? 'update' : 'create'} contract:`, err);
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (contractId: string) => {
    setSending(contractId);
    try {
      await contractsApi.send(opportunityId, contractId);
      onRefresh();
    } catch (err) {
      console.error('Failed to send contract:', err);
    } finally {
      setSending(null);
    }
  };

  const handleResend = async (contractId: string) => {
    setResending(contractId);
    try {
      await contractsApi.resend(opportunityId, contractId);
      onRefresh();
    } catch (err) {
      console.error('Failed to resend emails:', err);
    } finally {
      setResending(null);
    }
  };

  const handleTerminate = async (contractId: string) => {
    setTerminating(contractId);
    try {
      await contractsApi.terminate(opportunityId, contractId);
      onRefresh();
    } catch (err) {
      console.error('Failed to terminate contract:', err);
    } finally {
      setTerminating(null);
    }
  };

  const handleDelete = async (contractId: string) => {
    setDeletingId(contractId);
    try {
      await contractsApi.delete(opportunityId, contractId);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete contract:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopySignLink = (signatoryToken: string) => {
    const url = `${window.location.origin}/contracts/sign/${signatoryToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(signatoryToken);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Contracts ({contracts.length})
        </h3>
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus size={14} /> New Contract
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4 bg-gray-50 dark:bg-slate-800/50">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{editingId ? 'Edit Contract' : 'New Contract'}</h4>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5 w-fit">
            <button
              onClick={() => setUseProposal(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                useProposal
                  ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              From Proposal
            </button>
            <button
              onClick={() => setUseProposal(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                !useProposal
                  ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Manual
            </button>
          </div>

          {useProposal ? (
            <>
              {/* Proposal selector */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Select Proposal *</label>
                <select
                  value={form.proposalId}
                  onChange={(e) => handleProposalSelect(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="">Choose a proposal...</option>
                  {eligibleProposals.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} — {p.currency} {p.totalAmount.toLocaleString()} ({p.status})
                    </option>
                  ))}
                </select>
              </div>
              {form.proposalId && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                    <p className="text-gray-400 mb-0.5">Title</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{form.title}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                    <p className="text-gray-400 mb-0.5">Value</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{form.currency} {form.value.toLocaleString()}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                    <p className="text-gray-400 mb-0.5">Currency</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{form.currency}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700">
                    <p className="text-gray-400 mb-0.5">Terms</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{form.terms || '—'}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Manual form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Title *</label>
                  <input
                    value={form.title}
                    onChange={e => updateForm('title', e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                    placeholder="Contract title"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={e => updateForm('type', e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  >
                    <option value="service_agreement">Service Agreement</option>
                    <option value="nda">NDA</option>
                    <option value="msa">MSA</option>
                    <option value="sow">SOW</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Value</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.value}
                    onChange={e => updateForm('value', Number(e.target.value))}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Currency</label>
                  <select
                    value={form.currency}
                    onChange={e => updateForm('currency', e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="PKR">PKR</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => updateForm('startDate', e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => updateForm('endDate', e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Renewal Date</label>
                  <input
                    type="date"
                    value={form.renewalDate}
                    onChange={e => updateForm('renewalDate', e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.autoRenewal}
                      onChange={e => updateForm('autoRenewal', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Auto-Renewal
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Terms & Conditions</label>
                <textarea
                  value={form.terms}
                  onChange={e => updateForm('terms', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  placeholder="Payment terms, conditions..."
                />
              </div>
            </>
          )}

          {/* Sign Mode (shared by both modes) */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Signing Method</label>
            <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5 w-fit">
              <button
                onClick={() => updateForm('signMode', 'internal')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  form.signMode === 'internal'
                    ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Internal E-Sign
              </button>
              <button
                onClick={() => updateForm('signMode', 'docusign')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  form.signMode === 'docusign'
                    ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                DocuSign
              </button>
            </div>
            {form.signMode === 'docusign' && (
              <p className="text-[10px] text-amber-600 mt-1">DocuSign requires API configuration in Admin Settings</p>
            )}
          </div>

          {/* Signatories */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Signatories</label>
              <button
                onClick={addSignatory}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <Plus size={12} /> Add Signatory
              </button>
            </div>
            <div className="space-y-2">
              {form.signatories.map((sig, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-1 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                      {sig.signOrder}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={sig.signatoryType}
                      onChange={e => updateSignatory(idx, 'signatoryType', e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                    >
                      <option value="internal">Internal</option>
                      <option value="external">External</option>
                    </select>
                  </div>
                  <div className="col-span-4">
                    <input
                      value={sig.name}
                      onChange={e => updateSignatory(idx, 'name', e.target.value)}
                      placeholder="Full name"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      value={sig.email}
                      onChange={e => updateSignatory(idx, 'email', e.target.value)}
                      placeholder="Email address"
                      type="email"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => removeSignatory(idx)}
                      className="text-gray-300 hover:text-red-500"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (useProposal ? !form.proposalId : !form.title.trim())}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Update Contract' : 'Create Contract'}
            </button>
          </div>
        </div>
      )}

      {/* Contract cards */}
      {contracts.length === 0 && !showForm ? (
        <div className="text-center py-10">
          <FileSignature className="mx-auto w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500">No contracts yet</p>
          {canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-purple-600 hover:text-purple-700"
            >
              Create your first contract
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map(c => {
            const sigCount = c.signatoryCount ?? c.signatories?.length ?? 0;
            const signedCount = c.signedCount ?? c.signatories?.filter(s => s.status === 'signed').length ?? 0;

            return (
              <div key={c.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-gray-400">{c.contractNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CONTRACT_TYPE_LABELS[c.type] ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' : ''}`}>
                        {CONTRACT_TYPE_LABELS[c.type] || c.type}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CONTRACT_STATUS_COLORS[c.status] || CONTRACT_STATUS_COLORS.draft}`}>
                        {CONTRACT_STATUS_LABELS[c.status] || c.status}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.title}</h4>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {c.currency} {c.value.toLocaleString()}
                      </span>
                      {c.startDate && c.endDate && (
                        <span>
                          {new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(c.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                      {c.proposalTitle && (
                        <span className="text-gray-400">via {c.proposalTitle}</span>
                      )}
                    </div>

                    {/* Signatories progress */}
                    {sigCount > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-gray-500">{signedCount} of {sigCount} signed</span>
                        <div className="flex items-center gap-1">
                          {(c.signatories || []).map((sig, idx) => (
                            <div
                              key={sig.id || idx}
                              className="relative group"
                              title={`${sig.name} (${sig.status})`}
                            >
                              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[9px] font-medium text-gray-500 dark:text-gray-400 border border-white dark:border-slate-900">
                                {sig.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${SIG_DOT_COLORS[sig.status] || SIG_DOT_COLORS.pending}`} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                    {c.status === 'draft' && canEdit && (
                      <>
                        <button
                          onClick={() => handleEdit(c)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                          title="Edit Contract"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleSend(c.id)}
                          disabled={sending === c.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          title="Send for Signing"
                        >
                          {sending === c.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Send
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="p-1.5 text-gray-300 hover:text-red-500 rounded"
                          title="Delete"
                        >
                          {deletingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </>
                    )}
                    {['sent_for_signing', 'partially_signed', 'fully_signed'].includes(c.status) && (
                      <div className="relative">
                        <button
                          onClick={() => setLinkDropdown(linkDropdown === c.id ? null : c.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                          title="Copy Sign Links"
                        >
                          <Link2 size={12} />
                          Sign Links
                          <ChevronDown size={10} />
                        </button>
                        {linkDropdown === c.id && (
                          <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                            {(c.signatories || []).map((sig, idx) => (
                              <button
                                key={sig.id || idx}
                                onClick={() => {
                                  if (sig.token) handleCopySignLink(sig.token);
                                }}
                                disabled={!sig.token}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 border-t first:border-t-0 border-gray-100 dark:border-gray-700 disabled:opacity-40"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-2 h-2 rounded-full ${SIG_DOT_COLORS[sig.status] || SIG_DOT_COLORS.pending}`} />
                                  <span className="truncate">{sig.name}</span>
                                  <span className="text-gray-400 capitalize">({sig.status})</span>
                                </div>
                                {copiedId === sig.token
                                  ? <span className="text-green-600 text-[10px] font-medium shrink-0">Copied!</span>
                                  : <Copy size={10} className="text-gray-400 shrink-0" />
                                }
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {['sent_for_signing', 'partially_signed'].includes(c.status) && canEdit && (
                      <button
                        onClick={() => handleResend(c.id)}
                        disabled={resending === c.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                        title="Resend signing emails"
                      >
                        {resending === c.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Resend
                      </button>
                    )}
                    {['sent_for_signing', 'partially_signed'].includes(c.status) && canEdit && (
                      <button
                        onClick={() => handleTerminate(c.id)}
                        disabled={terminating === c.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        title="Terminate"
                      >
                        {terminating === c.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// INVOICES TAB
// ============================================================

const INVOICE_STATUS_BADGE: Record<string, string> = {
  draft:          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  sent:           'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  partially_paid: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  paid:           'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  overdue:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled:      'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  void:           'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', partially_paid: 'Partially Paid',
  paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled', void: 'Void',
};

interface InvoicesTabProps {
  opportunityId: string;
  invoices: Invoice[];
  loading: boolean;
  contracts: Contract[];
  proposals: Proposal[];
  canEdit: boolean;
  accountEmail?: string | null;
  contactEmail?: string | null;
  onRefresh: () => void;
}

function InvoicesTab({
  opportunityId, invoices, loading, contracts, proposals, canEdit, accountEmail, contactEmail, onRefresh,
}: InvoicesTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailModal, setEmailModal] = useState<Invoice | null>(null);
  const [paymentModal, setPaymentModal] = useState<Invoice | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pushingXero, setPushingXero] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form
  const [sourceType, setSourceType] = useState<'contract' | 'proposal' | 'manual'>('contract');
  const [form, setForm] = useState({
    sourceId: '',
    title: '',
    currency: 'USD',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    terms: '',
    isRecurring: false,
    recurrenceInterval: 'monthly' as const,
    lineItems: [] as InvoiceLineItem[],
  });

  const eligibleContracts = contracts.filter(c =>
    ['fully_signed', 'partially_signed'].includes(c.status),
  );
  const eligibleProposals = proposals.filter(p => p.status === 'accepted');

  const resetForm = () => {
    setForm({
      sourceId: '',
      title: '',
      currency: 'USD',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      notes: '',
      terms: '',
      isRecurring: false,
      recurrenceInterval: 'monthly',
      lineItems: [],
    });
    setSourceType('contract');
    setShowForm(false);
  };

  const openFormWith = (type: 'contract' | 'proposal' | 'manual') => {
    resetForm();
    setSourceType(type);
    if (type === 'manual') {
      setForm(prev => ({
        ...prev,
        lineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
      }));
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (sourceType !== 'manual' && form.sourceId) {
        await invoicesApi.create({
          sourceType: sourceType as 'contract' | 'proposal',
          sourceId: form.sourceId,
          opportunityId,
          dueDate: form.dueDate || undefined,
          notes: form.notes || undefined,
        });
      } else {
        await invoicesApi.create({
          ...form,
          opportunityId,
          lineItems: form.lineItems.filter(li => li.description.trim()),
        });
      }
      resetForm();
      onRefresh();
    } catch (err) {
      console.error('Failed to create invoice:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    setDeletingId(invoiceId);
    try {
      await invoicesApi.delete(invoiceId);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete invoice:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    setDownloadingId(invoiceId);
    try {
      const blob = await invoicesApi.downloadPdf(invoiceId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePushXero = async (invoiceId: string) => {
    setPushingXero(invoiceId);
    try {
      await invoicesApi.pushToXero(invoiceId);
      onRefresh();
    } catch (err) {
      console.error('Failed to push to Xero:', err);
    } finally {
      setPushingXero(null);
    }
  };

  const handleCancel = async (invoiceId: string) => {
    try {
      await invoicesApi.cancel(invoiceId);
      onRefresh();
    } catch (err) {
      console.error('Failed to cancel invoice:', err);
    }
  };

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: any) => {
    setForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((li, i) => (i === index ? { ...li, [field]: value } : li)),
    }));
  };

  const removeLineItem = (index: number) => {
    setForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.length > 1 ? prev.lineItems.filter((_, i) => i !== index) : prev.lineItems,
    }));
  };

  const calcLineTotal = (li: InvoiceLineItem) => {
    const subtotal = li.quantity * li.unitPrice;
    if (!li.discount) return subtotal;
    return li.discountType === 'percentage'
      ? subtotal * (1 - li.discount / 100)
      : subtotal - li.discount;
  };

  const formTotal = form.lineItems.reduce((sum, li) => sum + calcLineTotal(li), 0);

  const fmtCurrency = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Invoices ({invoices.length})
        </h3>
        {canEdit && !showForm && (
          <button
            onClick={() => openFormWith('contract')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus size={14} /> New Invoice
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4 bg-gray-50 dark:bg-slate-800/50">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">New Invoice</h4>

          {/* Source toggle */}
          <div className="flex gap-2">
            {(['contract', 'proposal', 'manual'] as const).map(t => (
              <button
                key={t}
                onClick={() => {
                  setSourceType(t);
                  setForm(prev => ({
                    ...prev,
                    sourceId: '',
                    lineItems: t === 'manual' ? [{ description: '', quantity: 1, unitPrice: 0 }] : [],
                  }));
                }}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  sourceType === t
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {t === 'contract' ? 'From Contract' : t === 'proposal' ? 'From Proposal' : 'Manual'}
              </button>
            ))}
          </div>

          {/* Source selector */}
          {sourceType === 'contract' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Select Contract</label>
              <select
                value={form.sourceId}
                onChange={e => setForm(prev => ({ ...prev, sourceId: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              >
                <option value="">Choose a signed contract...</option>
                {eligibleContracts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.contractNumber} — {c.title} ({c.currency} {c.value.toLocaleString()})
                  </option>
                ))}
              </select>
              {eligibleContracts.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No signed contracts available</p>
              )}
            </div>
          )}

          {sourceType === 'proposal' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Select Proposal</label>
              <select
                value={form.sourceId}
                onChange={e => setForm(prev => ({ ...prev, sourceId: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              >
                <option value="">Choose an accepted proposal...</option>
                {eligibleProposals.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.currency} {p.totalAmount.toLocaleString()})
                  </option>
                ))}
              </select>
              {eligibleProposals.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No accepted proposals available</p>
              )}
            </div>
          )}

          {/* Manual form fields */}
          {sourceType === 'manual' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  placeholder="Invoice title"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={e => setForm(prev => ({ ...prev, issueDate: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Currency</label>
                  <select
                    value={form.currency}
                    onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="PKR">PKR</option>
                  </select>
                </div>
              </div>

              {/* Recurring toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={e => setForm(prev => ({ ...prev, isRecurring: e.target.checked }))}
                    className="rounded"
                  />
                  Recurring Invoice
                </label>
                {form.isRecurring && (
                  <select
                    value={form.recurrenceInterval}
                    onChange={e => setForm(prev => ({ ...prev, recurrenceInterval: e.target.value as any }))}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-800"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                )}
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Line Items</label>
                  <button
                    onClick={() => setForm(prev => ({
                      ...prev,
                      lineItems: [...prev.lineItems, { description: '', quantity: 1, unitPrice: 0 }],
                    }))}
                    className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {form.lineItems.map((li, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        {idx === 0 && <p className="text-[10px] text-gray-400 mb-0.5">Description</p>}
                        <input
                          value={li.description}
                          onChange={e => updateLineItem(idx, 'description', e.target.value)}
                          className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                          placeholder="Item description"
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <p className="text-[10px] text-gray-400 mb-0.5">Qty</p>}
                        <input
                          type="number"
                          min={1}
                          value={li.quantity}
                          onChange={e => updateLineItem(idx, 'quantity', Number(e.target.value))}
                          className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <p className="text-[10px] text-gray-400 mb-0.5">Unit Price</p>}
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={li.unitPrice}
                          onChange={e => updateLineItem(idx, 'unitPrice', Number(e.target.value))}
                          className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <p className="text-[10px] text-gray-400 mb-0.5">Tax %</p>}
                        <input
                          type="number"
                          min={0}
                          value={li.taxRate || 0}
                          onChange={e => updateLineItem(idx, 'taxRate', Number(e.target.value))}
                          className="w-full border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div className="col-span-1 pt-1.5">
                        {idx === 0 && <p className="text-[10px] text-transparent mb-0.5">.</p>}
                        <button onClick={() => removeLineItem(idx)} className="text-gray-300 hover:text-red-500">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Total: {form.currency} {formTotal.toFixed(2)}
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                    placeholder="Notes visible on invoice..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Terms</label>
                  <textarea
                    value={form.terms}
                    onChange={e => setForm(prev => ({ ...prev, terms: e.target.value }))}
                    rows={2}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                    placeholder="Payment terms..."
                  />
                </div>
              </div>
            </>
          )}

          {/* Common fields for source types */}
          {sourceType !== 'manual' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  placeholder="Optional notes"
                />
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (sourceType !== 'manual' && !form.sourceId) || (sourceType === 'manual' && !form.title.trim())}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Create Invoice
            </button>
          </div>
        </div>
      )}

      {/* Invoice Cards */}
      {invoices.length === 0 && !showForm ? (
        <div className="text-center py-10">
          <Receipt className="mx-auto w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 mb-4">No invoices yet</p>
          {canEdit && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => openFormWith('contract')}
                className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                From Contract
              </button>
              <button
                onClick={() => openFormWith('proposal')}
                className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                From Proposal
              </button>
              <button
                onClick={() => openFormWith('manual')}
                className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Manual
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const paymentPct = inv.totalAmount > 0 ? Math.min(100, (inv.amountPaid / inv.totalAmount) * 100) : 0;
            return (
              <div key={inv.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{inv.invoiceNumber}</span>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{inv.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${INVOICE_STATUS_BADGE[inv.status] || INVOICE_STATUS_BADGE.draft}`}>
                        {INVOICE_STATUS_LABEL[inv.status] || inv.status}
                      </span>
                      {inv.xeroInvoiceId && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                          Synced to Xero
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {fmtCurrency(inv.totalAmount, inv.currency)}
                      </span>
                      {inv.amountDue > 0 && inv.amountDue < inv.totalAmount && (
                        <span className="text-amber-600 dark:text-amber-400">
                          Due: {fmtCurrency(inv.amountDue, inv.currency)}
                        </span>
                      )}
                      <span>Issued {new Date(inv.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      {inv.dueDate && (
                        <span>Due {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>

                    {/* Payment progress bar */}
                    {inv.amountPaid > 0 && (
                      <div className="mt-2">
                        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${paymentPct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {fmtCurrency(inv.amountPaid, inv.currency)} paid ({paymentPct.toFixed(0)}%)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                    {/* Draft actions */}
                    {inv.status === 'draft' && canEdit && (
                      <>
                        <button
                          onClick={() => setEmailModal(inv)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                          title="Send Invoice"
                        >
                          <Send size={12} /> Send
                        </button>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          disabled={deletingId === inv.id}
                          className="p-1.5 text-gray-300 hover:text-red-500 rounded"
                          title="Delete"
                        >
                          {deletingId === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </>
                    )}

                    {/* Sent / Overdue / Partially Paid actions */}
                    {['sent', 'overdue', 'partially_paid'].includes(inv.status) && canEdit && (
                      <>
                        <button
                          onClick={() => setPaymentModal(inv)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                          title="Record Payment"
                        >
                          <DollarSign size={12} /> Pay
                        </button>
                        <button
                          onClick={() => setEmailModal(inv)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 rounded"
                          title="Send Email"
                        >
                          <Mail size={14} />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(inv.id)}
                          disabled={downloadingId === inv.id}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                          title="Download PDF"
                        >
                          {downloadingId === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        </button>
                        {!inv.xeroInvoiceId && (
                          <button
                            onClick={() => handlePushXero(inv.id)}
                            disabled={pushingXero === inv.id}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs border border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-400 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
                            title="Push to Xero"
                          >
                            {pushingXero === inv.id ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                            Xero
                          </button>
                        )}
                        <button
                          onClick={() => handleCancel(inv.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          title="Cancel Invoice"
                        >
                          <XCircle size={14} />
                        </button>
                      </>
                    )}

                    {/* Paid actions */}
                    {inv.status === 'paid' && (
                      <button
                        onClick={() => handleDownloadPdf(inv.id)}
                        disabled={downloadingId === inv.id}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                        title="Download PDF"
                      >
                        {downloadingId === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <PaymentModal
          invoice={paymentModal}
          onClose={() => setPaymentModal(null)}
          onSaved={() => { setPaymentModal(null); onRefresh(); }}
        />
      )}

      {/* Send Email Modal */}
      {emailModal && (
        <SendInvoiceEmailModal
          invoice={emailModal}
          accountEmail={accountEmail}
          contactEmail={contactEmail}
          onClose={() => setEmailModal(null)}
          onSent={() => { setEmailModal(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// PAYMENT MODAL
// ============================================================

interface PaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}

function PaymentModal({ invoice, onClose, onSaved }: PaymentModalProps) {
  const [amount, setAmount] = useState(invoice.amountDue);
  const [paymentMethod, setPaymentMethod] = useState('manual');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (amount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    if (amount > invoice.amountDue) {
      setError(`Amount cannot exceed amount due (${invoice.amountDue.toFixed(2)})`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await invoicesApi.recordPayment(invoice.id, {
        amount,
        paymentMethod,
        reference: reference || undefined,
        notes: notes || undefined,
        paidAt: paidAt || undefined,
      });
      onSaved();
    } catch (err) {
      console.error('Failed to record payment:', err);
      setError('Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-green-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Record Payment</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Amount Due</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {invoice.currency} {invoice.amountDue.toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-400">of {invoice.currency} {invoice.totalAmount.toFixed(2)} total</p>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount *</label>
            <input
              type="number"
              min={0.01}
              max={invoice.amountDue}
              step={0.01}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              <option value="manual">Manual</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Reference</label>
            <input
              value={reference}
              onChange={e => setReference(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="Transaction ID, check number, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Payment Date</label>
            <input
              type="date"
              value={paidAt}
              onChange={e => setPaidAt(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || amount <= 0}
            className="px-4 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SEND INVOICE EMAIL MODAL
// ============================================================

function SendInvoiceEmailModal({
  invoice, accountEmail, contactEmail, onClose, onSent,
}: {
  invoice: Invoice;
  accountEmail?: string | null;
  contactEmail?: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  // Auto-load emails from opportunity account + contact + invoice contact
  const initialEmails: string[] = [];
  const seen = new Set<string>();
  for (const e of [invoice.contactEmail, contactEmail, accountEmail]) {
    if (e && !seen.has(e.toLowerCase())) {
      seen.add(e.toLowerCase());
      initialEmails.push(e);
    }
  }

  const [to, setTo] = useState<string[]>(initialEmails);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState(`Invoice: ${invoice.title} (${invoice.invoiceNumber})`);
  const [manualEmail, setManualEmail] = useState('');
  const [activeField, setActiveField] = useState<'to' | 'cc' | 'bcc'>('to');
  const [sending, setSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);

  const addEmail = (email: string, field: 'to' | 'cc' | 'bcc') => {
    const setter = field === 'to' ? setTo : field === 'cc' ? setCc : setBcc;
    const current = field === 'to' ? to : field === 'cc' ? cc : bcc;
    if (email && !current.includes(email)) setter([...current, email]);
  };

  const removeEmail = (email: string, field: 'to' | 'cc' | 'bcc') => {
    const setter = field === 'to' ? setTo : field === 'cc' ? setCc : setBcc;
    setter(prev => prev.filter(e => e !== email));
  };

  const handleAddManual = () => {
    const trimmed = manualEmail.trim();
    if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      addEmail(trimmed, activeField);
      setManualEmail('');
    }
  };

  const handleSend = async () => {
    if (to.length === 0) return;
    setSending(true);
    try {
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

  const renderChips = (emails: string[], field: 'to' | 'cc' | 'bcc') => (
    <div className="flex flex-wrap gap-1">
      {emails.map(email => (
        <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs">
          {email}
          <button onClick={() => removeEmail(email, field)} className="hover:text-red-500">
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-purple-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Send Invoice via Email</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* To field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">To *</label>
              {!showCcBcc && (
                <button onClick={() => setShowCcBcc(true)} className="text-xs text-purple-600 hover:underline">
                  CC / BCC
                </button>
              )}
            </div>
            {renderChips(to, 'to')}
            <div className="flex gap-1 mt-1">
              <input
                value={activeField === 'to' ? manualEmail : ''}
                onFocus={() => setActiveField('to')}
                onChange={e => { setActiveField('to'); setManualEmail(e.target.value); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddManual(); } }}
                placeholder="Type email and press Enter"
                className="flex-1 text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* CC field */}
          {showCcBcc && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">CC</label>
              {renderChips(cc, 'cc')}
              <div className="flex gap-1 mt-1">
                <input
                  value={activeField === 'cc' ? manualEmail : ''}
                  onFocus={() => setActiveField('cc')}
                  onChange={e => { setActiveField('cc'); setManualEmail(e.target.value); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddManual(); } }}
                  placeholder="Add CC email"
                  className="flex-1 text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* BCC field */}
          {showCcBcc && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">BCC</label>
              {renderChips(bcc, 'bcc')}
              <div className="flex gap-1 mt-1">
                <input
                  value={activeField === 'bcc' ? manualEmail : ''}
                  onFocus={() => setActiveField('bcc')}
                  onChange={e => { setActiveField('bcc'); setManualEmail(e.target.value); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddManual(); } }}
                  placeholder="Add BCC email"
                  className="flex-1 text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <p><strong>Invoice:</strong> {invoice.invoiceNumber} — {invoice.title}</p>
            <p><strong>Amount:</strong> {invoice.currency} {invoice.totalAmount.toFixed(2)}</p>
            {invoice.dueDate && <p><strong>Due:</strong> {new Date(invoice.dueDate).toLocaleDateString()}</p>}
            <p className="text-[10px] text-gray-400">PDF will be attached automatically</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || to.length === 0}
            className="px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Send Email
          </button>
        </div>
      </div>
    </div>
  );
}