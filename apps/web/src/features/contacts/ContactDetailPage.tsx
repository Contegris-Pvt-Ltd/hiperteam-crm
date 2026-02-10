import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Pencil, Trash2, MoreHorizontal,
  Mail, Phone, Globe, MapPin, Building2, 
  Calendar, User, Tag, Linkedin, Twitter, 
  Facebook, Instagram, PhoneOff, MailX, BellOff,
  History, MessageSquare, FileText, Activity,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { contactsApi } from '../../api/contacts.api';
import type { Contact, Activity as ActivityType, AuditLog, Note, Document } from '../../api/contacts.api';
import { uploadApi } from '../../api/upload.api';
import { adminApi } from '../../api/admin.api';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';
import { Timeline } from '../../components/shared/Timeline';
import { ChangeHistory } from '../../components/shared/ChangeHistory';
import { NotesPanel } from '../../components/shared/NotesPanel';
import { DocumentsPanel } from '../../components/shared/DocumentsPanel';
import { AvatarUpload } from '../../components/shared/AvatarUpload';
import { LinkAccountModal } from '../../components/shared/LinkAccountModal';
import { ProfileCompletion } from '../../components/shared/ProfileCompletion';
import type { ProfileCompletionData } from '../../components/shared/ProfileCompletion';
// ============ PAGE DESIGNER IMPORTS ============
import { useModuleLayout } from '../../hooks/useModuleLayout';
import { DynamicPageRenderer } from '../../components/shared/DynamicPageRenderer';
// ===============================================

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
  const [showLinkAccountModal, setShowLinkAccountModal] = useState(false);
  
  // Custom fields config
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomFieldGroup[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // ============ ADMIN-CONTROLLED LAYOUT ============
  const { 
    useCustomLayout, 
    config: layoutConfig, 
    loading: layoutLoading 
  } = useModuleLayout('contacts', 'detail');
  // =================================================

  // Fetch custom fields config
  useEffect(() => {
    const fetchCustomConfig = async () => {
      try {
        const [fieldsData, tabsData, groupsData] = await Promise.all([
          adminApi.getCustomFields('contacts'),
          adminApi.getTabs('contacts'),
          adminApi.getGroups({ module: 'contacts' }),
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
  
  const handleLinkAccount = async (accountId: string, role: string, isPrimary: boolean) => {
    if (!id) return;
    await contactsApi.linkAccount(id, accountId, role, isPrimary);
    const accountsData = await contactsApi.getAccounts(id);
    setLinkedAccounts(accountsData);
  };

  const handleUnlinkAccount = async (accountId: string) => {
    if (!id) return;
    await contactsApi.unlinkAccount(id, accountId);
    setLinkedAccounts(prev => prev.filter(a => a.id !== accountId));
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

  // Get fields for a section (standard) or tab (custom)
  const getFieldsForSection = (section: string, tabId?: string) => {
    return customFields.filter(f => {
      if (tabId) return f.tabId === tabId;
      return f.section === section && !f.tabId;
    });
  };

  // Get ungrouped fields
  const getUngroupedFields = (section: string, tabId?: string) => {
    return getFieldsForSection(section, tabId).filter(f => !f.groupId);
  };

  // Get groups for a section
  const getGroupsForSection = (section: string, tabId?: string) => {
    return customGroups.filter(g => {
      if (tabId) return g.tabId === tabId;
      return g.section === section && !g.tabId;
    });
  };

  // Get fields for a group
  const getFieldsForGroup = (groupId: string) => {
    return customFields.filter(f => f.groupId === groupId);
  };

  // Check if section has any custom fields with values
  const sectionHasValues = (section: string, tabId?: string) => {
    const fields = getFieldsForSection(section, tabId);
    return fields.some(f => {
      const value = contact?.customFields?.[f.fieldKey];
      return value !== undefined && value !== null && value !== '';
    });
  };

  // Helper to detect file type category
  const getFileCategory = (fileName?: string, mimeType?: string): string => {
    if (!fileName && !mimeType) return 'unknown';
    
    const ext = fileName?.split('.').pop()?.toLowerCase() || '';
    const mime = mimeType?.toLowerCase() || '';
    
    if (mime.startsWith('image/') || /^(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/.test(ext)) return 'image';
    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (mime.startsWith('audio/') || /^(mp3|wav|ogg|flac|aac|m4a)$/.test(ext)) return 'audio';
    if (mime.startsWith('video/') || /^(mp4|webm|mov|avi|mkv|wmv)$/.test(ext)) return 'video';
    if (/^(xlsx|xls|csv)$/.test(ext) || mime.includes('spreadsheet') || mime.includes('excel')) return 'spreadsheet';
    if (/^(docx|doc)$/.test(ext) || mime.includes('document') || mime.includes('word')) return 'document';
    if (/^(pptx|ppt)$/.test(ext) || mime.includes('presentation') || mime.includes('powerpoint')) return 'presentation';
    
    return 'other';
  };

  const renderCustomFieldValue = (field: CustomField, value: unknown): React.ReactNode => {
    if (value === null || value === undefined || value === '') return null;

    switch (field.fieldType) {
      case 'checkbox':
        return value === true || value === 'true' ? 'Yes' : 'No';
      
      case 'select': {
        if (field.dependsOnFieldId && field.conditionalOptions) {
          const parentValue = contact?.customFields?.[
            customFields.find(f => f.id === field.dependsOnFieldId)?.fieldKey || ''
          ];
          const options = field.conditionalOptions[String(parentValue)] || [];
          const option = options.find(o => o.value === value);
          return option?.label || String(value);
        }
        const option = field.fieldOptions?.find(o => o.value === value);
        return option?.label || String(value);
      }
      
      case 'multi_select':
        if (Array.isArray(value)) {
          return value.map(v => {
            const opt = field.fieldOptions?.find(o => o.value === v);
            return opt?.label || v;
          }).join(', ');
        }
        return String(value);
      
      case 'date':
        try {
          return format(new Date(String(value)), 'MMM d, yyyy');
        } catch {
          return String(value);
        }
      
      case 'url':
        return (
          <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {String(value)}
          </a>
        );
      
      case 'email':
        return (
          <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
            {String(value)}
          </a>
        );
      
      case 'phone':
        return (
          <a href={`tel:${value}`} className="text-blue-600 hover:underline">
            {String(value)}
          </a>
        );
      
      case 'file': {
        const fileValue = value as { fileName?: string; url?: string; fileType?: string; fileSize?: number };
        if (!fileValue?.fileName) return 'No file';
        
        const category = getFileCategory(fileValue.fileName, fileValue.fileType);
        
        return (
          <div className="flex flex-col items-end gap-2">
            {category === 'image' && fileValue.url && (
              <img src={fileValue.url} alt={fileValue.fileName} className="max-w-[150px] max-h-[100px] rounded-lg object-cover border border-gray-200 dark:border-slate-700" />
            )}
            {category === 'audio' && fileValue.url && (
              <audio controls className="max-w-[200px]">
                <source src={fileValue.url} type={fileValue.fileType} />
              </audio>
            )}
            {category === 'video' && fileValue.url && (
              <video controls className="max-w-[200px] max-h-[120px] rounded-lg">
                <source src={fileValue.url} type={fileValue.fileType} />
              </video>
            )}
            {category === 'pdf' && fileValue.url && (
              <iframe src={fileValue.url} title={fileValue.fileName} className="w-[200px] h-[120px] rounded-lg border border-gray-200 dark:border-slate-700" />
            )}
            <div className="flex items-center gap-2">
              {fileValue.url && (
                <>
                  <a href={fileValue.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                  <a href={fileValue.url} download={fileValue.fileName} className="text-xs text-blue-600 hover:underline">Download</a>
                </>
              )}
            </div>
            <span className="text-xs text-gray-500">{fileValue.fileName}</span>
          </div>
        );
      }
      
      default:
        return String(value);
    }
  };

  const renderCustomFieldsForSection = (section: string, tabId?: string) => {
    const groups = getGroupsForSection(section, tabId);
    const ungroupedFields = getUngroupedFields(section, tabId);
    const customFieldValues = contact?.customFields || {};

    return (
      <div className="space-y-4">
        {groups.map(group => {
          const groupFields = getFieldsForGroup(group.id);
          if (groupFields.length === 0) return null;
          
          const hasValues = groupFields.some(f => {
            const val = customFieldValues[f.fieldKey];
            return val !== undefined && val !== null && val !== '';
          });
          
          if (!hasValues) return null;

          const isCollapsed = collapsedGroups.has(group.id);

          return (
            <div key={group.id} className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <span className="font-medium text-sm text-gray-700 dark:text-slate-300">{group.name}</span>
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              
              {!isCollapsed && (
                <div className="p-3 space-y-3">
                  {groupFields
                    .filter(f => {
                      const val = customFieldValues[f.fieldKey];
                      return val !== undefined && val !== null && val !== '';
                    })
                    .map(field => (
                      <div key={field.id} className="flex items-start justify-between gap-4">
                        <span className="text-sm text-gray-500 dark:text-slate-400">{field.fieldLabel}</span>
                        <span className="text-sm text-gray-900 dark:text-white text-right">
                          {renderCustomFieldValue(field, customFieldValues[field.fieldKey])}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}

        {ungroupedFields.length > 0 && (
          <div className="space-y-3">
            {ungroupedFields
              .filter(f => {
                const val = customFieldValues[f.fieldKey];
                return val !== undefined && val !== null && val !== '';
              })
              .map(field => (
                <div key={field.id} className="flex items-start justify-between gap-4">
                  <span className="text-sm text-gray-500 dark:text-slate-400">{field.fieldLabel}</span>
                  <span className="text-sm text-gray-900 dark:text-white text-right">
                    {renderCustomFieldValue(field, customFieldValues[field.fieldKey])}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  // ============ LOADING STATE ============
  if (loading || layoutLoading || !contact) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ============ CUSTOM VIEW RENDERER ============
  const renderCustomView = () => (
    <DynamicPageRenderer
      module="contacts"
      layoutType="detail"
      data={contact as unknown as Record<string, unknown>}
      customFields={customFields}
      tabs={customTabs}
      groups={customGroups}
      profileCompletionRenderer={() => 
        contact.profileCompletion ? (
          <ProfileCompletion completion={contact.profileCompletion as ProfileCompletionData} />
        ) : null
      }
      relatedRecordsRenderer={(relatedModule, maxItems) => (
        <div className="space-y-2">
          {linkedAccounts.slice(0, maxItems || 5).map(acc => (
            <Link key={acc.id} to={`/accounts/${acc.id}`} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
              {acc.logoUrl ? (
                <img src={acc.logoUrl} alt={acc.name} className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white text-sm font-semibold">
                  {acc.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{acc.name}</p>
                {acc.role && <p className="text-sm text-gray-500 dark:text-slate-400">{acc.role}</p>}
              </div>
              {acc.isPrimary && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">Primary</span>
              )}
            </Link>
          ))}
          {linkedAccounts.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">No linked accounts</p>
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
          entityType="contacts"
          entityId={id!}
          onDocumentUploaded={(doc) => setDocuments(prev => [doc, ...prev])}
          onDocumentDeleted={async (docId) => setDocuments(prev => prev.filter(d => d.id !== docId))}
        />
      )}
      notesRenderer={() => (
        <NotesPanel notes={notes} loading={tabLoading} onAddNote={handleAddNote} />
      )}
    />
  );

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

  const hasContactSectionFields = sectionHasValues('contact');
  const hasAddressSectionFields = sectionHasValues('address');
  const hasSocialSectionFields = sectionHasValues('social');
  const hasOtherSectionFields = sectionHasValues('other');
  const hasBasicSectionFields = sectionHasValues('basic');
  const hasCustomSectionFields = sectionHasValues('custom');
  const customTabsWithValues = customTabs.filter(tab => sectionHasValues('', tab.id));
  
  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link to="/contacts" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-4">
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

      {/* ============ CONDITIONAL LAYOUT ============ */}
      {useCustomLayout ? (
        renderCustomView()
      ) : (
        <>
          {/* Main Content - Default Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-1 space-y-6">
              {/* Contact Info Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Contact Information</h3>
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
                        <a href={`tel:${contact.mobile}`} className="text-sm text-gray-900 dark:text-white">{contact.mobile}</a>
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
                {hasContactSectionFields && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                    {renderCustomFieldsForSection('contact')}
                  </div>
                )}
              </div>

              {/* Address Card */}
              {(primaryAddress || contact.addressLine1 || hasAddressSectionFields) && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Address</h3>
                  {(primaryAddress || contact.addressLine1) && (
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-rose-100 dark:bg-rose-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white">
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
                  )}
                  {hasAddressSectionFields && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                      {renderCustomFieldsForSection('address')}
                    </div>
                  )}
                </div>
              )}

              {/* Social Profiles */}
              {((contact.socialProfiles && Object.keys(contact.socialProfiles).length > 0) || hasSocialSectionFields) && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Social Profiles</h3>
                  <div className="space-y-3">
                    {contact.socialProfiles?.linkedin && (
                      <a href={contact.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                        <Linkedin className="w-5 h-5 text-[#0A66C2]" />
                        <span className="text-sm text-gray-900 dark:text-white">LinkedIn</span>
                      </a>
                    )}
                    {contact.socialProfiles?.twitter && (
                      <a href={contact.socialProfiles.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                        <Twitter className="w-5 h-5 text-[#1DA1F2]" />
                        <span className="text-sm text-gray-900 dark:text-white">Twitter</span>
                      </a>
                    )}
                    {contact.socialProfiles?.facebook && (
                      <a href={contact.socialProfiles.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                        <Facebook className="w-5 h-5 text-[#1877F2]" />
                        <span className="text-sm text-gray-900 dark:text-white">Facebook</span>
                      </a>
                    )}
                    {contact.socialProfiles?.instagram && (
                      <a href={contact.socialProfiles.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                        <Instagram className="w-5 h-5 text-[#E4405F]" />
                        <span className="text-sm text-gray-900 dark:text-white">Instagram</span>
                      </a>
                    )}
                  </div>
                  {hasSocialSectionFields && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                      {renderCustomFieldsForSection('social')}
                    </div>
                  )}
                </div>
              )}

              {/* Communication Preferences */}
              {(contact.doNotContact || contact.doNotEmail || contact.doNotCall) && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Communication Preferences</h3>
                  <div className="space-y-2">
                    {contact.doNotContact && (
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <BellOff className="w-4 h-4" />
                        <span className="text-sm">Do Not Contact</span>
                      </div>
                    )}
                    {contact.doNotEmail && (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <MailX className="w-4 h-4" />
                        <span className="text-sm">Do Not Email</span>
                      </div>
                    )}
                    {contact.doNotCall && (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <PhoneOff className="w-4 h-4" />
                        <span className="text-sm">Do Not Call</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Other Info */}
              {(contact.source || hasOtherSectionFields) && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Other Information</h3>
                  {contact.source && (
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-500 dark:text-slate-400">Lead Source</span>
                      <span className="text-sm text-gray-900 dark:text-white">{contact.source}</span>
                    </div>
                  )}
                  {hasOtherSectionFields && renderCustomFieldsForSection('other')}
                </div>
              )}

              {/* Custom Section */}
              {hasCustomSectionFields && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Additional Information</h3>
                  {renderCustomFieldsForSection('custom')}
                </div>
              )}

              {/* Custom Tabs */}
              {customTabsWithValues.map(tab => (
                <div key={tab.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-purple-100 dark:border-purple-900/30 p-6">
                  <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-300 uppercase tracking-wider mb-4">{tab.name}</h3>
                  {renderCustomFieldsForSection('', tab.id)}
                </div>
              ))}

              {/* Quick Info */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Record Info</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-slate-400 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Created
                    </span>
                    <span className="text-gray-900 dark:text-white">{format(new Date(contact.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-slate-400">Last updated</span>
                    <span className="text-gray-900 dark:text-white">{formatDistanceToNow(new Date(contact.updatedAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>

              {/* Profile Completion */}
              {contact.profileCompletion && (
                <ProfileCompletion completion={contact.profileCompletion as ProfileCompletionData} />
              )}
            </div>

            {/* Right Column - Tabs */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
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

                <div className="p-6">
                  {activeTab === 'activity' && <Timeline activities={activities} loading={tabLoading} />}
                  {activeTab === 'notes' && <NotesPanel notes={notes} loading={tabLoading} onAddNote={handleAddNote} />}
                  {activeTab === 'documents' && (
                    <DocumentsPanel
                      documents={documents}
                      loading={tabLoading}
                      entityType="contacts"
                      entityId={id!}
                      onDocumentUploaded={(doc) => setDocuments(prev => [doc, ...prev])}
                      onDocumentDeleted={async (docId) => setDocuments(prev => prev.filter(d => d.id !== docId))}
                    />
                  )}
                  {activeTab === 'accounts' && (
                    <div>
                      {tabLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <>
                          <div className="mb-4">
                            <button onClick={() => setShowLinkAccountModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <Building2 className="w-4 h-4" />
                              Link an Account
                            </button>
                          </div>
                          {linkedAccounts.length === 0 ? (
                            <div className="text-center py-8">
                              <Building2 className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                              <p className="text-gray-500 dark:text-slate-400">No linked accounts</p>
                              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Click "Link an Account" to associate this contact with a company</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {linkedAccounts.map(account => (
                                <div key={account.id} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                                  <Link to={`/accounts/${account.id}`} className="flex items-center gap-3 flex-1">
                                    {account.logoUrl ? (
                                      <img src={account.logoUrl} alt={account.name} className="w-10 h-10 rounded-xl object-cover" />
                                    ) : (
                                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-semibold">{account.name[0]}</div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 dark:text-white">{account.name}</p>
                                      {account.role && <p className="text-sm text-gray-500 dark:text-slate-400">{account.role}</p>}
                                    </div>
                                  </Link>
                                  <div className="flex items-center gap-2">
                                    {account.isPrimary && <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-lg">Primary</span>}
                                    <button onClick={() => handleUnlinkAccount(account.id)} className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg" title="Unlink account">
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
                  {activeTab === 'history' && <ChangeHistory history={history} loading={tabLoading} />}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {/* ============ END CONDITIONAL LAYOUT ============ */}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Contact</h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete <strong>{contact.firstName} {contact.lastName}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Link Account Modal */}
      <LinkAccountModal
        isOpen={showLinkAccountModal}
        onClose={() => setShowLinkAccountModal(false)}
        onLink={handleLinkAccount}
        existingAccountIds={linkedAccounts.map(a => a.id)}
      />
    </div>
  );
}