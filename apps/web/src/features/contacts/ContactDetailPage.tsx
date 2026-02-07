import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Pencil, Trash2, MoreHorizontal,
  Mail, Phone, Globe, MapPin, Building2, 
  Calendar, User, Tag, Linkedin, Twitter, 
  Facebook, Instagram, PhoneOff, MailX, BellOff,
  History, MessageSquare, FileText, Activity, Users
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { contactsApi } from '../../api/contacts.api';
import type { Contact, Activity as ActivityType, AuditLog, Note, Document } from '../../api/contacts.api';
import { uploadApi } from '../../api/upload.api';
import { Timeline } from '../../components/shared/Timeline';
import { ChangeHistory } from '../../components/shared/ChangeHistory';
import { NotesPanel } from '../../components/shared/NotesPanel';
import { DocumentsPanel } from '../../components/shared/DocumentsPanel';
import { AvatarUpload } from '../../components/shared/AvatarUpload';

type TabType = 'activity' | 'notes' | 'documents' | 'history' | 'accounts';

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Tab data
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<{ id: string; name: string; logoUrl: string; role: string; isPrimary: boolean }[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchContact();
    }
  }, [id]);

  useEffect(() => {
    if (contact) {
      fetchTabData();
    }
  }, [activeTab, contact]);

  const fetchContact = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await contactsApi.getOne(id);
      setContact(data);
    } catch (error) {
      console.error('Failed to fetch contact:', error);
      navigate('/contacts');
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
          const activityData = await contactsApi.getActivities(id);
          setActivities(activityData.data);
          break;
        case 'history':
          const historyData = await contactsApi.getHistory(id);
          setHistory(historyData);
          break;
        case 'notes':
          const notesData = await contactsApi.getNotes(id);
          setNotes(notesData);
          break;
        case 'documents':
          const docsData = await contactsApi.getDocuments(id);
          setDocuments(docsData);
          break;
        case 'accounts':
          const accountsData = await contactsApi.getAccounts(id);
          setLinkedAccounts(accountsData);
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
      await contactsApi.delete(id);
      navigate('/contacts');
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  const handleAvatarUpload = async (file: File): Promise<string> => {
    if (!id) throw new Error('No contact ID');
    const result = await uploadApi.uploadAvatar('contacts', id, file);
    await contactsApi.update(id, { avatarUrl: result.url });
    setContact(prev => prev ? { ...prev, avatarUrl: result.url } : null);
    return result.url;
  };

  const handleAddNote = async (content: string) => {
    if (!id) return;
    const note = await contactsApi.addNote(id, content);
    setNotes(prev => [note, ...prev]);
  };

  if (loading || !contact) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'accounts', label: 'Accounts', icon: <Building2 className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
  ];

  const primaryEmail = contact.emails?.find(e => e.primary) || contact.emails?.[0];
  const primaryPhone = contact.phones?.find(p => p.primary) || contact.phones?.[0];
  const primaryAddress = contact.addresses?.find(a => a.primary) || contact.addresses?.[0];

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/contacts"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <AvatarUpload
              currentUrl={contact.avatarUrl}
              onUpload={handleAvatarUpload}
              name={`${contact.firstName} ${contact.lastName}`}
              type="contact"
              size="lg"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {contact.firstName} {contact.lastName}
              </h1>
              {contact.jobTitle && (
                <p className="text-lg text-gray-600 dark:text-slate-400">{contact.jobTitle}</p>
              )}
              {contact.company && (
                <p className="text-gray-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                  <Building2 className="w-4 h-4" />
                  {contact.company}
                </p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                  contact.status === 'active'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                }`}>
                  {contact.status}
                </span>
                {contact.tags?.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-xs">
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/contacts/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
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
          {/* Contact Info Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Contact Information
            </h3>
            <div className="space-y-4">
              {(primaryEmail || contact.email) && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Email</p>
                    <a href={`mailto:${primaryEmail?.email || contact.email}`} className="text-sm text-gray-900 dark:text-white hover:text-blue-600 truncate block">
                      {primaryEmail?.email || contact.email}
                    </a>
                  </div>
                </div>
              )}

              {(primaryPhone || contact.phone) && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Phone</p>
                    <a href={`tel:${primaryPhone?.number || contact.phone}`} className="text-sm text-gray-900 dark:text-white">
                      {primaryPhone?.number || contact.phone}
                    </a>
                  </div>
                </div>
              )}

              {contact.mobile && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                    <Phone className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Mobile</p>
                    <a href={`tel:${contact.mobile}`} className="text-sm text-gray-900 dark:text-white">
                      {contact.mobile}
                    </a>
                  </div>
                </div>
              )}

              {contact.website && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                    <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Website</p>
                    <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-900 dark:text-white hover:text-blue-600 truncate block">
                      {contact.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Address Card */}
          {(primaryAddress || contact.addressLine1) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Address
              </h3>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-rose-100 dark:bg-rose-900/30 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="text-sm text-gray-700 dark:text-slate-300">
                  {primaryAddress ? (
                    <>
                      {primaryAddress.line1 && <p>{primaryAddress.line1}</p>}
                      {primaryAddress.line2 && <p>{primaryAddress.line2}</p>}
                      <p>{[primaryAddress.city, primaryAddress.state, primaryAddress.postalCode].filter(Boolean).join(', ')}</p>
                      {primaryAddress.country && <p>{primaryAddress.country}</p>}
                    </>
                  ) : (
                    <>
                      {contact.addressLine1 && <p>{contact.addressLine1}</p>}
                      {contact.addressLine2 && <p>{contact.addressLine2}</p>}
                      <p>{[contact.city, contact.state, contact.postalCode].filter(Boolean).join(', ')}</p>
                      {contact.country && <p>{contact.country}</p>}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Social Profiles */}
          {contact.socialProfiles && Object.values(contact.socialProfiles).some(Boolean) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Social Profiles
              </h3>
              <div className="flex flex-wrap gap-2">
                {contact.socialProfiles.linkedin && (
                  <a href={contact.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer" className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50">
                    <Linkedin className="w-5 h-5" />
                  </a>
                )}
                {contact.socialProfiles.twitter && (
                  <a href={contact.socialProfiles.twitter} target="_blank" rel="noopener noreferrer" className="p-3 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-xl hover:bg-sky-200 dark:hover:bg-sky-900/50">
                    <Twitter className="w-5 h-5" />
                  </a>
                )}
                {contact.socialProfiles.facebook && (
                  <a href={contact.socialProfiles.facebook} target="_blank" rel="noopener noreferrer" className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-900/50">
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {contact.socialProfiles.instagram && (
                  <a href={contact.socialProfiles.instagram} target="_blank" rel="noopener noreferrer" className="p-3 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-xl hover:bg-pink-200 dark:hover:bg-pink-900/50">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Communication Preferences */}
          {(contact.doNotContact || contact.doNotEmail || contact.doNotCall) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Communication Preferences
              </h3>
              <div className="flex flex-wrap gap-2">
                {contact.doNotContact && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                    <BellOff className="w-4 h-4" /> Do not contact
                  </span>
                )}
                {contact.doNotEmail && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                    <MailX className="w-4 h-4" /> Do not email
                  </span>
                )}
                {contact.doNotCall && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                    <PhoneOff className="w-4 h-4" /> Do not call
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Meta Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              Record Info
            </h3>
            <div className="space-y-3 text-sm">
              {contact.owner && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400 flex items-center gap-2">
                    <User className="w-4 h-4" /> Owner
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {contact.owner.firstName} {contact.owner.lastName}
                  </span>
                </div>
              )}
              {contact.source && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Source</span>
                  <span className="text-gray-900 dark:text-white">{contact.source}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-slate-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Created
                </span>
                <span className="text-gray-900 dark:text-white">
                  {format(new Date(contact.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-slate-400">Last updated</span>
                <span className="text-gray-900 dark:text-white">
                  {formatDistanceToNow(new Date(contact.updatedAt), { addSuffix: true })}
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
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
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

              {activeTab === 'accounts' && (
                <div>
                  {tabLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : linkedAccounts.length === 0 ? (
                    <div className="text-center py-8">
                      <Building2 className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-slate-400">No linked accounts</p>
                      <button className="mt-4 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                        Link an Account
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {linkedAccounts.map(account => (
                        <Link
                          key={account.id}
                          to={`/accounts/${account.id}`}
                          className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-semibold">
                            {account.logoUrl ? (
                              <img src={account.logoUrl} alt={account.name} className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              account.name[0]
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">{account.name}</p>
                            {account.role && (
                              <p className="text-sm text-gray-500 dark:text-slate-400">{account.role}</p>
                            )}
                          </div>
                          {account.isPrimary && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-lg">
                              Primary
                            </span>
                          )}
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
              Delete Contact
            </h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete <strong>{contact.firstName} {contact.lastName}</strong>? This action cannot be undone.
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
    </div>
  );
}