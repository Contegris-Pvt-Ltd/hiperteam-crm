import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Pencil, Trash2, MoreHorizontal,
  Mail, Phone, Globe, MapPin, Building2, 
  Calendar, User, Tag, Linkedin, Twitter, 
  Facebook, Instagram, Users, DollarSign,
  History, MessageSquare, FileText, Activity, Network
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { accountsApi } from '../../api/accounts.api';
import type { Account, LinkedContact } from '../../api/accounts.api';
import type { Activity as ActivityType, AuditLog, Note, Document } from '../../api/contacts.api';
import { uploadApi } from '../../api/upload.api';
import { Timeline } from '../../components/shared/Timeline';
import { ChangeHistory } from '../../components/shared/ChangeHistory';
import { NotesPanel } from '../../components/shared/NotesPanel';
import { DocumentsPanel } from '../../components/shared/DocumentsPanel';
import { AvatarUpload } from '../../components/shared/AvatarUpload';
import { LinkContactModal } from '../../components/shared/LinkContactModal';

type TabType = 'activity' | 'notes' | 'documents' | 'contacts' | 'children' | 'history';

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Tab data
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [childAccounts, setChildAccounts] = useState<Account[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [showLinkContactModal, setShowLinkContactModal] = useState(false);

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

  const handleUnlinkContact = async (contactId: string) => {
    if (!id) return;
    await accountsApi.unlinkContact(id, contactId);
    setLinkedContacts(prev => prev.filter(c => c.id !== contactId));
  };

  const handleLinkContact = async (contactId: string, role: string, isPrimary: boolean) => {
    if (!id) return;
    await accountsApi.linkContact(id, contactId, role, isPrimary);
    const contactsData = await accountsApi.getContacts(id);
    setLinkedContacts(contactsData);
  };

  if (loading || !account) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
              Company Information
            </h3>
            <div className="space-y-4">
              {account.companySize && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Company Size</p>
                    <p className="text-sm text-gray-900 dark:text-white">{account.companySize} employees</p>
                  </div>
                </div>
              )}

              {account.annualRevenue && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Annual Revenue</p>
                    <p className="text-sm text-gray-900 dark:text-white">{formatRevenue(account.annualRevenue)}</p>
                  </div>
                </div>
              )}

              {account.parentAccount && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Parent Account</p>
                    <Link to={`/accounts/${account.parentAccountId}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      {account.parentAccount.name}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contact Info Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Contact Information
            </h3>
            <div className="space-y-4">
              {primaryEmail && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-slate-400">{primaryEmail.type}</p>
                    <a href={`mailto:${primaryEmail.email}`} className="text-sm text-gray-900 dark:text-white hover:text-blue-600 truncate block">
                      {primaryEmail.email}
                    </a>
                  </div>
                </div>
              )}

              {primaryPhone && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-slate-400">{primaryPhone.type}</p>
                    <a href={`tel:${primaryPhone.number}`} className="text-sm text-gray-900 dark:text-white">
                      {primaryPhone.number}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Address Card */}
          {primaryAddress && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Address
              </h3>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-rose-100 dark:bg-rose-900/30 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="text-sm text-gray-700 dark:text-slate-300">
                  {primaryAddress.line1 && <p>{primaryAddress.line1}</p>}
                  {primaryAddress.line2 && <p>{primaryAddress.line2}</p>}
                  <p>{[primaryAddress.city, primaryAddress.state, primaryAddress.postalCode].filter(Boolean).join(', ')}</p>
                  {primaryAddress.country && <p>{primaryAddress.country}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Social Profiles */}
          {account.socialProfiles && Object.values(account.socialProfiles).some(Boolean) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Social Profiles
              </h3>
              <div className="flex flex-wrap gap-2">
                {account.socialProfiles.linkedin && (
                  <a href={account.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50">
                    <Linkedin className="w-5 h-5" />
                  </a>
                )}
                {account.socialProfiles.twitter && (
                  <a href={account.socialProfiles.twitter} target="_blank" rel="noopener noreferrer" className="p-3 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-xl hover:bg-sky-200 dark:hover:bg-sky-900/50">
                    <Twitter className="w-5 h-5" />
                  </a>
                )}
                {account.socialProfiles.facebook && (
                  <a href={account.socialProfiles.facebook} target="_blank" rel="noopener noreferrer" className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-900/50">
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {account.socialProfiles.instagram && (
                  <a href={account.socialProfiles.instagram} target="_blank" rel="noopener noreferrer" className="p-3 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-xl hover:bg-pink-200 dark:hover:bg-pink-900/50">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {account.description && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Description
              </h3>
              <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">
                {account.description}
              </p>
            </div>
          )}

          {/* Meta Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Record Info
            </h3>
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
                  onUpload={async () => {}}
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
                        {/* Link Contact Button */}
                        <div className="mb-4">
                        <button
                            onClick={() => setShowLinkContactModal(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800"
                        >
                            <Users className="w-4 h-4" />
                            Link a Contact
                        </button>
                        </div>

                        {linkedContacts.length === 0 ? (
                        <div className="text-center py-8">
                            <Users className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-slate-400">No linked contacts</p>
                            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                            Click "Link a Contact" to associate people with this account
                            </p>
                        </div>
                        ) : (
                        <div className="space-y-3">
                            {linkedContacts.map(contact => (
                            <div
                                key={contact.id}
                                className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <Link to={`/contacts/${contact.id}`} className="flex items-center gap-3 flex-1">
                                {contact.avatarUrl ? (
                                    <img src={contact.avatarUrl} alt={`${contact.firstName} ${contact.lastName}`} className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                    {contact.firstName[0]}{contact.lastName[0]}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-white">
                                    {contact.firstName} {contact.lastName}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-slate-400">
                                    {contact.jobTitle || contact.email}
                                    </p>
                                </div>
                                </Link>
                                <div className="flex items-center gap-2">
                                {contact.role && (
                                    <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs rounded-lg">
                                    {contact.role}
                                    </span>
                                )}
                                {contact.isPrimary && (
                                    <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs rounded-lg">
                                    Primary
                                    </span>
                                )}
                                <button
                                    onClick={() => handleUnlinkContact(contact.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg"
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
                    <div className="space-y-3">
                      {childAccounts.map(child => (
                        <Link
                          key={child.id}
                          to={`/accounts/${child.id}`}
                          className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          {child.logoUrl ? (
                            <img src={child.logoUrl} alt={child.name} className="w-10 h-10 rounded-xl object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-semibold">
                              {child.name[0]}
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">{child.name}</p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">{child.industry || child.accountType}</p>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Account
            </h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete <strong>{account.name}</strong>? This will also remove all linked contact relationships. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
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
    </div>
  );
}