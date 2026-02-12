import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Pencil, Trash2, MoreHorizontal,
  Mail, Phone, Globe, MapPin, 
  Calendar, User, Tag, Linkedin, Twitter, 
  Facebook, Instagram, Users, DollarSign,
  History, MessageSquare, FileText, Activity, Network,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { accountsApi } from '../../api/accounts.api';
import type { Account, LinkedContact } from '../../api/accounts.api';
import type { Activity as ActivityType, AuditLog, Note, Document } from '../../api/contacts.api';
import { uploadApi } from '../../api/upload.api';
import { adminApi } from '../../api/admin.api';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';
import { Timeline } from '../../components/shared/Timeline';
import { ChangeHistory } from '../../components/shared/ChangeHistory';
import { NotesPanel } from '../../components/shared/NotesPanel';
import { DocumentsPanel } from '../../components/shared/DocumentsPanel';
import { AvatarUpload } from '../../components/shared/AvatarUpload';
import { LinkContactModal } from '../../components/shared/LinkContactModal';
import { ProfileCompletion } from '../../components/shared/ProfileCompletion';
import type { ProfileCompletionData } from '../../components/shared/ProfileCompletion';
import { CustomFieldRenderer } from '../../components/shared/CustomFieldRenderer';
import { QuickCreateContactModal } from '../../components/shared/QuickCreateContactModal';
import type { QuickCreateContactResult } from '../../components/shared/QuickCreateContactModal';
// ============ PAGE DESIGNER IMPORTS ============
import { useModuleLayout } from '../../hooks/useModuleLayout';
import { DynamicPageRenderer } from '../../components/shared/DynamicPageRenderer';
// ===============================================

type TabType = 'activity' | 'notes' | 'documents' | 'contacts' | 'children' | 'history';

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLinkContactModal, setShowLinkContactModal] = useState(false);
  const [showQuickCreateContact, setShowQuickCreateContact] = useState(false);

  // Tab data
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [childAccounts, setChildAccounts] = useState<Account[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Custom fields config
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomFieldGroup[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // ============ ADMIN-CONTROLLED LAYOUT ============
  const { 
    useCustomLayout, 
    loading: layoutLoading 
  } = useModuleLayout('accounts', 'detail');
  // =================================================

  // Fetch custom fields config
  useEffect(() => {
    const fetchCustomConfig = async () => {
      try {
        const [fieldsData, tabsData, groupsData] = await Promise.all([
          adminApi.getCustomFields('accounts'),
          adminApi.getTabs('accounts'),
          adminApi.getGroups({ module: 'accounts' }),
        ]);
        setCustomFields(fieldsData.filter(f => f.isActive));
        setCustomTabs(tabsData.filter(t => t.isActive));
        setCustomGroups(groupsData.filter(g => g.isActive));
        
        // Initialize collapsed state
        const defaultCollapsed = new Set(
          groupsData.filter(g => g.collapsedByDefault).map(g => g.id)
        );
        setCollapsedGroups(defaultCollapsed);
      } catch (err) {
        console.error('Failed to fetch custom fields config:', err);
      }
    };
    fetchCustomConfig();
  }, []);

  useEffect(() => {
    if (id) {
      fetchAccount();
    }
  }, [id]);

  useEffect(() => {
    if (account) {
      fetchTabData();
    }
  }, [activeTab, account]);

  const fetchAccount = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await accountsApi.getOne(id);
      setAccount(data);
    } catch (error) {
      console.error('Failed to fetch account:', error);
      navigate('/accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchTabData = async () => {
    if (!id) return;
    setTabLoading(true);
    try {
      switch (activeTab) {
        case 'activity':
          const activityData = await accountsApi.getActivities(id);
          setActivities(activityData.data);
          break;
        case 'history':
          const historyData = await accountsApi.getHistory(id);
          setHistory(historyData);
          break;
        case 'notes':
          const notesData = await accountsApi.getNotes(id);
          setNotes(notesData);
          break;
        case 'documents':
          const docsData = await accountsApi.getDocuments(id);
          setDocuments(docsData);
          break;
        case 'contacts':
          const contactsData = await accountsApi.getContacts(id);
          setLinkedContacts(contactsData);
          break;
        case 'children':
          const childrenData = await accountsApi.getChildren(id);
          setChildAccounts(childrenData);
          break;
      }
    } catch (error) {
      console.error('Failed to fetch tab data:', error);
    } finally {
      setTabLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await accountsApi.delete(id);
      navigate('/accounts');
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleLogoUpload = async (file: File): Promise<string> => {
    if (!id) throw new Error('No account ID');
    const result = await uploadApi.uploadAvatar('accounts', id, file);
    await accountsApi.update(id, { logoUrl: result.url });
    setAccount(prev => prev ? { ...prev, logoUrl: result.url } : null);
    return result.url;
  };

  const handleAddNote = async (content: string) => {
    if (!id) return;
    const note = await accountsApi.addNote(id, content);
    setNotes(prev => [note, ...prev]);
  };

  const handleLinkContact = async (contactId: string, role: string, isPrimary: boolean) => {
    if (!id) return;
    await accountsApi.linkContact(id, contactId, role, isPrimary);
    const contactsData = await accountsApi.getContacts(id);
    setLinkedContacts(contactsData);
  };

  const handleUnlinkContact = async (contactId: string) => {
    if (!id) return;
    await accountsApi.unlinkContact(id, contactId);
    setLinkedContacts(prev => prev.filter(c => c.id !== contactId));
  };

  const handleQuickContactCreated = async () => {
    // Refresh linked contacts list after creation
    if (!id) return;
    try {
      const contactsData = await accountsApi.getContacts(id);
      setLinkedContacts(contactsData);
    } catch (err) {
      console.error('Failed to refresh contacts:', err);
    }
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Helper to check if a section has any values
  const sectionHasValues = (section: string, tabId?: string) => {
    const customFieldValues = account?.customFields as Record<string, unknown> || {};
    const sectionFields = customFields.filter(f => {
      if (tabId) return f.tabId === tabId;
      return f.section === section && !f.tabId;
    });
    return sectionFields.some(f => {
      const val = customFieldValues[f.fieldKey];
      return val !== undefined && val !== null && val !== '';
    });
  };

  // Render custom fields for a section or tab
  const renderCustomFields = (section: string, tabId?: string) => {
    const customFieldValues = account?.customFields as Record<string, unknown> || {};
    
    // Get fields for this section/tab
    const sectionFields = customFields.filter(f => {
      if (tabId) return f.tabId === tabId;
      return f.section === section && !f.tabId;
    });

    if (sectionFields.length === 0) return null;

    // Get groups for this section/tab
    const sectionGroups = customGroups.filter(g => {
      if (tabId) return g.tabId === tabId;
      return g.section === section && !g.tabId;
    });

    // Ungrouped fields
    const ungroupedFields = sectionFields.filter(f => !f.groupId);
    const ungroupedWithValues = ungroupedFields.filter(f => {
      const val = customFieldValues[f.fieldKey];
      return val !== undefined && val !== null && val !== '';
    });

    return (
      <div className="space-y-4">
        {/* Grouped fields */}
        {sectionGroups.map(group => {
          const groupFields = sectionFields.filter(f => f.groupId === group.id);
          const groupFieldsWithValues = groupFields.filter(f => {
            const val = customFieldValues[f.fieldKey];
            return val !== undefined && val !== null && val !== '';
          });

          if (groupFieldsWithValues.length === 0) return null;

          const isCollapsed = collapsedGroups.has(group.id);

          return (
            <div key={group.id} className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{group.name}</span>
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {!isCollapsed && (
                <div className="p-4 space-y-2">
                  {groupFieldsWithValues
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map(field => (
                      <div key={field.id} className="flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-500 dark:text-slate-400">{field.fieldLabel}</span>
                        <span className="text-sm text-gray-900 dark:text-white text-right">
                          <CustomFieldRenderer
                            field={field}
                            value={customFieldValues[field.fieldKey]}
                            onChange={() => {}}
                            allFields={customFields}
                            allValues={customFieldValues}
                          />
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped fields */}
        {ungroupedWithValues.length > 0 && (
          <div className="space-y-2">
            {ungroupedWithValues
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map(field => (
                <div key={field.id} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-500 dark:text-slate-400">{field.fieldLabel}</span>
                  <span className="text-sm text-gray-900 dark:text-white text-right">
                    <CustomFieldRenderer
                      field={field}
                      value={customFieldValues[field.fieldKey]}
                      onChange={() => {}}
                      allFields={customFields}
                      allValues={customFieldValues}
                    />
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  if (loading || layoutLoading || !account) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ============ CUSTOM LAYOUT RENDERING ============
  if (useCustomLayout) {
    return (
      <div className="animate-fadeIn">
        {/* Header - always shown even with custom layout */}
        <div className="mb-6">
          <Link
            to="/accounts"
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Accounts
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <AvatarUpload
                currentUrl={account.logoUrl}
                onUpload={handleLogoUpload}
                name={account.name}
                type="account"
                size="lg"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{account.name}</h1>
                {account.industry && <p className="text-lg text-gray-600 dark:text-slate-400">{account.industry}</p>}
                {account.website && (
                  <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1">
                    <Globe className="w-4 h-4" />
                    {new URL(account.website).hostname}
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(`/accounts/${id}/edit`)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all">
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="p-2.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Page Renderer */}
        <DynamicPageRenderer
          module="accounts"
          layoutType="detail"
          recordId={account.id}
          data={account as unknown as Record<string, unknown>}
          customFields={customFields}
          tabs={customTabs}
          groups={customGroups}
          profileCompletionRenderer={() =>
            account.profileCompletion ? (
              <ProfileCompletion completion={account.profileCompletion as ProfileCompletionData} />
            ) : null
          }
          relatedRecordsRenderer={(_relatedModule, maxItems) => (
            <div className="space-y-2">
              {linkedContacts.slice(0, maxItems || 5).map(contact => (
                <Link key={contact.id} to={`/contacts/${contact.id}`} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  {contact.avatarUrl ? (
                    <img src={contact.avatarUrl} alt={`${contact.firstName} ${contact.lastName}`} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {contact.firstName[0]}{contact.lastName[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{contact.firstName} {contact.lastName}</p>
                    {contact.jobTitle && <p className="text-sm text-gray-500 dark:text-slate-400">{contact.jobTitle}</p>}
                  </div>
                  {contact.isPrimary && (
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">Primary</span>
                  )}
                </Link>
              ))}
              {linkedContacts.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">No linked contacts</p>
              )}
            </div>
          )}
          activityTimelineRenderer={(maxItems) => (
            <Timeline activities={activities.slice(0, maxItems || 10)} loading={tabLoading} />
          )}
          filesRenderer={() => (
            <DocumentsPanel
              documents={documents}
              loading={tabLoading}
              entityType="accounts"
              entityId={id!}
              onDocumentUploaded={(doc) => setDocuments(prev => [doc, ...prev])}
              onDocumentDeleted={async (docId) => setDocuments(prev => prev.filter(d => d.id !== docId))}
            />
          )}
          notesRenderer={() => (
            <NotesPanel notes={notes} loading={tabLoading} onAddNote={handleAddNote} />
          )}
        />

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Account</h3>
              <p className="text-gray-500 dark:text-slate-400 mb-6">
                Are you sure you want to delete &quot;{account.name}&quot;? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800">Cancel</button>
                <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Link Contact Modal */}
        <LinkContactModal
          isOpen={showLinkContactModal}
          onClose={() => setShowLinkContactModal(false)}
          onLink={handleLinkContact}
          existingContactIds={linkedContacts.map(c => c.id)}
        />
      </div>
    );
  }

  // ============ DEFAULT LAYOUT RENDERING ============
  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
    { id: 'contacts', label: 'Contacts', icon: <Users className="w-4 h-4" />, count: account.contactsCount },
    { id: 'notes', label: 'Notes', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'children', label: 'Sub-accounts', icon: <Network className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
  ];

  const primaryEmail = account.emails?.find(e => e.primary) || account.emails?.[0];
  const primaryPhone = account.phones?.find(p => p.primary) || account.phones?.[0];
  const primaryAddress = account.addresses?.find(a => a.primary) || account.addresses?.[0];

  const formatRevenue = (amount: number) => {
    if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  // Check which custom sections have values
  const hasCustomSectionFields = sectionHasValues('custom');
  const customTabsWithValues = customTabs.filter(tab => sectionHasValues('', tab.id));

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/accounts"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Accounts
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <AvatarUpload
              currentUrl={account.logoUrl}
              onUpload={handleLogoUpload}
              name={account.name}
              type="account"
              size="lg"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {account.name}
              </h1>
              {account.industry && (
                <p className="text-lg text-gray-600 dark:text-slate-400">{account.industry}</p>
              )}
              {account.website && (
                <a 
                  href={account.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
                >
                  <Globe className="w-4 h-4" />
                  {new URL(account.website).hostname}
                </a>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                  account.accountType === 'customer'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : account.accountType === 'prospect'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                }`}>
                  {account.accountType}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                  account.status === 'active'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                }`}>
                  {account.status}
                </span>
                {account.tags?.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-lg text-xs">
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/accounts/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button className="p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-1 space-y-6">
          {/* Company Info Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Company Details
            </h3>
            <div className="space-y-3 text-sm">
              {primaryEmail && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={`mailto:${primaryEmail.email}`} className="text-blue-600 dark:text-blue-400 hover:underline truncate">
                    {primaryEmail.email}
                  </a>
                </div>
              )}
              {primaryPhone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={`tel:${primaryPhone.number}`} className="text-gray-900 dark:text-white hover:text-blue-600">
                    {primaryPhone.number}
                  </a>
                </div>
              )}
              {account.website && (
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate">
                    {account.website}
                  </a>
                </div>
              )}
              {primaryAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span className="text-gray-900 dark:text-white">
                    {[primaryAddress.line1, primaryAddress.city, primaryAddress.state, primaryAddress.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Financial Info */}
          {(account.annualRevenue || account.companySize) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Financial
              </h3>
              <div className="space-y-3 text-sm">
                {account.annualRevenue && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-slate-400 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Revenue
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">{formatRevenue(account.annualRevenue)}</span>
                  </div>
                )}
                {account.companySize && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-slate-400 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Size
                    </span>
                    <span className="text-gray-900 dark:text-white">{account.companySize} employees</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Social Profiles */}
          {account.socialProfiles && Object.values(account.socialProfiles).some(v => v) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Social
              </h3>
              <div className="space-y-3">
                {account.socialProfiles.linkedin && (
                  <a href={account.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </a>
                )}
                {account.socialProfiles.twitter && (
                  <a href={account.socialProfiles.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <Twitter className="w-4 h-4" /> Twitter
                  </a>
                )}
                {account.socialProfiles.facebook && (
                  <a href={account.socialProfiles.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <Facebook className="w-4 h-4" /> Facebook
                  </a>
                )}
                {account.socialProfiles.instagram && (
                  <a href={account.socialProfiles.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <Instagram className="w-4 h-4" /> Instagram
                  </a>
                )}
              </div>

              {/* Custom fields for social section */}
              {sectionHasValues('social') && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                  {renderCustomFields('social')}
                </div>
              )}
            </div>
          )}

          {/* Custom Fields Card - for 'basic' section custom fields */}
          {sectionHasValues('basic') && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Additional Info
              </h3>
              {renderCustomFields('basic')}
            </div>
          )}

          {/* Custom Fields Card - for 'other' section */}
          {sectionHasValues('other') && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Other Details
              </h3>
              {renderCustomFields('other')}
            </div>
          )}

          {/* Custom Fields Card - for 'custom' section */}
          {hasCustomSectionFields && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Custom Fields
              </h3>
              {renderCustomFields('custom')}
            </div>
          )}

          {/* Custom Tabs as cards in sidebar */}
          {customTabsWithValues.map(tab => (
            <div key={tab.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                {tab.name}
              </h3>
              {renderCustomFields('', tab.id)}
            </div>
          ))}

          {/* Parent Account */}
          {account.parentAccount && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Parent Account
              </h3>
              <Link to={`/accounts/${account.parentAccount.id}`} className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg p-2 -m-2 transition-colors">
                {account.parentAccount.logoUrl ? (
                  <img src={account.parentAccount.logoUrl} alt={account.parentAccount.name} className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-semibold">
                    {account.parentAccount.name[0]}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{account.parentAccount.name}</p>
                  {account.parentAccount.industry && (
                    <p className="text-sm text-gray-500 dark:text-slate-400">{account.parentAccount.industry}</p>
                  )}
                </div>
              </Link>
            </div>
          )}

          {/* Record Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Record Info</h3>
            <div className="space-y-3 text-sm">
              {account.owner && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400 flex items-center gap-2">
                    <User className="w-4 h-4" /> Owner
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {account.owner.firstName} {account.owner.lastName}
                  </span>
                </div>
              )}
              {account.source && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Source</span>
                  <span className="text-gray-900 dark:text-white">{account.source}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-slate-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Created
                </span>
                <span className="text-gray-900 dark:text-white">
                  {format(new Date(account.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-slate-400">Last updated</span>
                <span className="text-gray-900 dark:text-white">
                  {formatDistanceToNow(new Date(account.updatedAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>

          {/* Profile Completion */}
          {account.profileCompletion && (
            <ProfileCompletion completion={account.profileCompletion as ProfileCompletionData} />
          )}
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            {/* Tab Headers */}
            <div className="border-b border-gray-100 dark:border-slate-800 px-6">
              <div className="flex gap-1 overflow-x-auto">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 rounded text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'activity' && (
                <Timeline activities={activities} loading={tabLoading} />
              )}

              {activeTab === 'notes' && (
                <NotesPanel
                  notes={notes}
                  loading={tabLoading}
                  onAddNote={handleAddNote}
                />
              )}

              {activeTab === 'documents' && (
                <DocumentsPanel
                  documents={documents}
                  loading={tabLoading}
                  entityType="accounts"
                  entityId={id!}
                  onDocumentUploaded={(doc) => setDocuments(prev => [doc, ...prev])}
                  onDocumentDeleted={async (docId) => {
                    setDocuments(prev => prev.filter(d => d.id !== docId));
                  }}
                />
              )}

              {activeTab === 'contacts' && (
                <div>
                  {tabLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* Link / Create Contact Buttons */}
                      <div className="mb-4 flex items-center gap-2">
                        <button
                          onClick={() => setShowLinkContactModal(true)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800"
                        >
                          <Users className="w-4 h-4" />
                          Link a Contact
                        </button>
                        <button
                          onClick={() => setShowQuickCreateContact(true)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                        >
                          <User className="w-4 h-4" />
                          Quick Create
                        </button>
                      </div>

                      {linkedContacts.length === 0 ? (
                        <div className="text-center py-8">
                          <Users className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                          <p className="text-gray-500 dark:text-slate-400">No contacts linked</p>
                          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                            Link contacts to this account
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {linkedContacts.map(contact => (
                            <div key={contact.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 group">
                              <Link to={`/contacts/${contact.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                                {contact.avatarUrl ? (
                                  <img src={contact.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                    {contact.firstName[0]}{contact.lastName[0]}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900 dark:text-white truncate">
                                    {contact.firstName} {contact.lastName}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-slate-400 truncate">
                                    {[contact.jobTitle, contact.role].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                              </Link>
                              <div className="flex items-center gap-2 shrink-0">
                                {contact.isPrimary && (
                                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-lg">
                                    Primary
                                  </span>
                                )}
                                <button
                                  onClick={() => handleUnlinkContact(contact.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                  title="Unlink contact"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'children' && (
                <div>
                  {tabLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : childAccounts.length === 0 ? (
                    <div className="text-center py-8">
                      <Network className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-slate-400">No sub-accounts</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {childAccounts.map(child => (
                        <Link
                          key={child.id}
                          to={`/accounts/${child.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          {child.logoUrl ? (
                            <img src={child.logoUrl} alt={child.name} className="w-10 h-10 rounded-xl object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-semibold">
                              {child.name[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{child.name}</p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              {[child.industry, child.status].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <ChangeHistory history={history} loading={tabLoading} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Account</h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete &quot;{account.name}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Contact Modal */}
      <LinkContactModal
        isOpen={showLinkContactModal}
        onClose={() => setShowLinkContactModal(false)}
        onLink={handleLinkContact}
        existingContactIds={linkedContacts.map(c => c.id)}
      />

      {/* Quick Create Contact Modal */}
      <QuickCreateContactModal
        isOpen={showQuickCreateContact}
        onClose={() => setShowQuickCreateContact(false)}
        onCreated={handleQuickContactCreated}
        accountId={id}
        accountName={account.name}
      />
    </div>
  );
}