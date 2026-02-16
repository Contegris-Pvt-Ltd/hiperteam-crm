/**
 * CONTACT EDIT PAGE
 * 
 * Page Designer Integration Status:
 * - Hook added to check if custom layout is enabled
 * - For now, edit pages use the default form regardless of setting
 * - Future enhancement: DynamicFormRenderer for full edit page customization
 * 
 * The detail page supports full custom layout rendering.
 * Edit pages will be enhanced in a future phase.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, X, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { contactsApi } from '../../api/contacts.api';
import type { CreateContactData, EmailEntry, PhoneEntry, AddressEntry } from '../../api/contacts.api';
import { uploadApi } from '../../api/upload.api';
import { AvatarUpload } from '../../components/shared/AvatarUpload';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import type { SelectOption } from '../../components/shared/SearchableSelect';
import { accountsApi } from '../../api/accounts.api';
import { adminApi } from '../../api/admin.api';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';
import { CustomFieldRenderer } from '../../components/shared/CustomFieldRenderer';
// ============ PAGE DESIGNER IMPORTS ============
import { useModuleLayout } from '../../hooks/useModuleLayout';
// Note: DynamicFormRenderer for edit pages is a future enhancement
// ===============================================
import { QuickCreateAccountModal } from '../../components/shared/QuickCreateAccountModal';
import type { QuickCreateAccountResult } from '../../components/shared/QuickCreateAccountModal';
import { moduleSettingsApi } from '../../api/module-settings.api';
import type { FieldValidationConfig } from '../../api/module-settings.api';
import { validateFields } from '../../utils/field-validation';

type TabType = 'basic' | 'contact' | 'address' | 'social' | 'other' | string;

const STANDARD_TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'contact', label: 'Contact Details' },
  { id: 'address', label: 'Address' },
  { id: 'social', label: 'Social Profiles' },
  { id: 'other', label: 'Other' },
];

const emailTypes = ['work', 'personal', 'other'];
const phoneTypes = ['mobile', 'work', 'home', 'fax', 'other'];
const addressTypes = ['home', 'work', 'billing', 'shipping', 'other'];

export function ContactEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Selected account for linking
  const [selectedAccount, setSelectedAccount] = useState<SelectOption | null>(null);
  
  // Custom fields, tabs, and groups
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomFieldGroup[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showQuickCreateAccount, setShowQuickCreateAccount] = useState(false);

  const [fieldValidationConfig, setFieldValidationConfig] = useState<FieldValidationConfig>({ rules: [] });

  const [validationErrors, setValidationErrors] = useState<{
    contactInfo?: string;
    emails?: string;
    phones?: string;
    duplicateEmailIndexes?: Set<number>;
    duplicatePhoneIndexes?: Set<number>;
  }>({});

  // ============ PAGE DESIGNER HOOK ============
  // Check if admin has enabled custom layout for edit pages
  // Note: For now, we don't render custom layout for edit pages
  // This is prep work for future enhancement
  const { 

  } = useModuleLayout('contacts', isNew ? 'create' : 'edit');
  // ============================================

  const [formData, setFormData] = useState<CreateContactData>({
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
    emails: [],
    phones: [],
    addresses: [],
    source: '',
    tags: [],
    notes: '',
    socialProfiles: {},
    doNotContact: false,
    doNotEmail: false,
    doNotCall: false,
  });

  const [tagInput, setTagInput] = useState('');

  // Fetch custom fields, tabs, and groups
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
        // Load field validation rules
        moduleSettingsApi.getFieldValidation('contacts')
        .then(setFieldValidationConfig)
        .catch(err => console.error('Failed to load validation rules:', err));
        
        // Initialize collapsed state for groups that are collapsed by default
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

  const fetchContact = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await contactsApi.getOne(id);
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
        emails: data.emails || [],
        phones: data.phones || [],
        addresses: data.addresses || [],
        source: data.source || '',
        tags: data.tags || [],
        notes: data.notes || '',
        socialProfiles: data.socialProfiles || {},
        doNotContact: data.doNotContact || false,
        doNotEmail: data.doNotEmail || false,
        doNotCall: data.doNotCall || false,
      });
      setAvatarUrl(data.avatarUrl || null);
      setCustomFieldValues(data.customFields || {});
      
      // Load linked account
      try {
        const linkedAccounts = await contactsApi.getAccounts(id);
        const primaryAccount = linkedAccounts.find(a => a.isPrimary) || linkedAccounts[0];
        if (primaryAccount) {
          setSelectedAccount({
            id: primaryAccount.id,
            label: primaryAccount.name,
            sublabel: primaryAccount.role || undefined,
            imageUrl: primaryAccount.logoUrl || undefined,
          });
        }
      } catch (e) {
        // Ignore if no linked accounts
      }
    } catch (error) {
      console.error('Failed to fetch contact:', error);
      navigate('/contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchAccounts = async (query: string): Promise<SelectOption[]> => {
    try {
      const response = await accountsApi.getAll({ search: query, limit: 10 });
      return response.data.map(account => ({
        id: account.id,
        label: account.name,
        sublabel: account.industry || undefined,
        imageUrl: account.logoUrl || undefined,
      }));
    } catch {
      return [];
    }
  };

  const handleChange = (field: keyof CreateContactData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialChange = (platform: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      socialProfiles: { ...prev.socialProfiles, [platform]: value }
    }));
  };

  const handleCustomFieldChange = (fieldKey: string, value: unknown) => {
    setCustomFieldValues(prev => ({ ...prev, [fieldKey]: value }));
  };

  const handleQuickAccountCreated = (account: QuickCreateAccountResult) => {
    setSelectedAccount({
      id: account.id,
      label: account.name,
      sublabel: account.industry || undefined,
      imageUrl: account.logoUrl || undefined,
    });
    handleChange('company', account.name);
  };

  // Email handlers
  const addEmail = () => {
    setFormData(prev => ({
      ...prev,
      emails: [...(prev.emails || []), { type: 'work', email: '', primary: (prev.emails?.length || 0) === 0 }]
    }));
    // Clear contact info error when adding new email
    setValidationErrors(prev => ({ ...prev, contactInfo: undefined }));
  };

  const updateEmail = (index: number, field: keyof EmailEntry, value: string | boolean) => {
    setFormData(prev => {
      const newEmails = prev.emails?.map((e, i) => {
        if (i === index) {
          return { ...e, [field]: value };
        }
        if (field === 'primary' && value === true) {
          return { ...e, primary: false };
        }
        return e;
      }) || [];
      
      // Real-time duplicate check
      const duplicates = getDuplicateEmailIndexes(newEmails);
      setValidationErrors(prev => ({
        ...prev,
        duplicateEmailIndexes: duplicates,
        emails: duplicates.size > 0 ? 'Duplicate email addresses detected' : undefined,
        contactInfo: undefined, // Clear contact info error when user adds email
      }));
      
      return { ...prev, emails: newEmails };
    });
  };

  const removeEmail = (index: number) => {
    setFormData(prev => {
      const newEmails = prev.emails?.filter((_, i) => i !== index) || [];
      
      // Recheck duplicates after removal
      const duplicates = getDuplicateEmailIndexes(newEmails);
      setValidationErrors(prev => ({
        ...prev,
        duplicateEmailIndexes: duplicates,
        emails: duplicates.size > 0 ? 'Duplicate email addresses detected' : undefined,
      }));
      
      return { ...prev, emails: newEmails };
    });
  };

  // Phone handlers
  const addPhone = () => {
    setFormData(prev => ({
      ...prev,
      phones: [...(prev.phones || []), { type: 'mobile', number: '', primary: (prev.phones?.length || 0) === 0 }]
    }));
    // Clear contact info error when adding new phone
    setValidationErrors(prev => ({ ...prev, contactInfo: undefined }));
  };

  const updatePhone = (index: number, field: keyof PhoneEntry, value: string | boolean) => {
    setFormData(prev => {
      const newPhones = prev.phones?.map((p, i) => {
        if (i === index) {
          return { ...p, [field]: value };
        }
        if (field === 'primary' && value === true) {
          return { ...p, primary: false };
        }
        return p;
      }) || [];
      
      // Real-time duplicate check
      const duplicates = getDuplicatePhoneIndexes(newPhones);
      setValidationErrors(prev => ({
        ...prev,
        duplicatePhoneIndexes: duplicates,
        phones: duplicates.size > 0 ? 'Duplicate phone numbers detected' : undefined,
        contactInfo: undefined, // Clear contact info error when user adds phone
      }));
      
      return { ...prev, phones: newPhones };
    });
  };

  const removePhone = (index: number) => {
    setFormData(prev => {
      const newPhones = prev.phones?.filter((_, i) => i !== index) || [];
      
      // Recheck duplicates after removal
      const duplicates = getDuplicatePhoneIndexes(newPhones);
      setValidationErrors(prev => ({
        ...prev,
        duplicatePhoneIndexes: duplicates,
        phones: duplicates.size > 0 ? 'Duplicate phone numbers detected' : undefined,
      }));
      
      return { ...prev, phones: newPhones };
    });
  };

  // Address handlers
  const addAddress = () => {
    setFormData(prev => ({
      ...prev,
      addresses: [...(prev.addresses || []), { 
        type: 'work', 
        line1: '', 
        line2: '', 
        city: '', 
        state: '', 
        postalCode: '', 
        country: '', 
        primary: (prev.addresses?.length || 0) === 0 
      }]
    }));
  };

  const updateAddress = (index: number, field: keyof AddressEntry, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      addresses: prev.addresses?.map((a, i) => {
        if (i === index) {
          return { ...a, [field]: value };
        }
        if (field === 'primary' && value === true) {
          return { ...a, primary: false };
        }
        return a;
      })
    }));
  };

  const removeAddress = (index: number) => {
    setFormData(prev => ({
      ...prev,
      addresses: prev.addresses?.filter((_, i) => i !== index)
    }));
  };

  // Tag handlers
  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags?.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags?.filter(t => t !== tag) }));
  };

  const handleAvatarUpload = async (file: File): Promise<string> => {
    if (isNew) {
      // For new contacts, just preview the file
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
      return url;
    }
    const result = await uploadApi.uploadAvatar('contacts', id!, file);
    setAvatarUrl(result.url);
    return result.url;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Clear previous errors
    setValidationErrors({});
    setError('');
    
    const newErrors: typeof validationErrors = {};
    
    const fieldErrors = validateFields(fieldValidationConfig, formData as Record<string, any>, formData.customFields as Record<string, any>);
    if (fieldErrors.length > 0) {
      setError(fieldErrors.map(e => e.message).join('. '));
      return;
    }
    
    // Validate first name
    if (!formData.firstName.trim()) {
      setError('First name is required');
      return;
    }
    
    // Validate: at least one contact method required
    const hasEmail = formData.emails?.some(e => e.email?.trim());
    const hasPhone = formData.phones?.some(p => p.number?.trim());
    
    if (!hasEmail && !hasPhone) {
      newErrors.contactInfo = 'At least one contact method (email or phone) is required';
    }
    
    // Check for duplicate emails
    const emailDuplicates = getDuplicateEmailIndexes(formData.emails || []);
    if (emailDuplicates.size > 0) {
      newErrors.emails = 'Please remove duplicate email addresses';
      newErrors.duplicateEmailIndexes = emailDuplicates;
    }
    
    // Check for duplicate phones
    const phoneDuplicates = getDuplicatePhoneIndexes(formData.phones || []);
    if (phoneDuplicates.size > 0) {
      newErrors.phones = 'Please remove duplicate phone numbers';
      newErrors.duplicatePhoneIndexes = phoneDuplicates;
    }
    
    // If any errors, show them and stop
    if (Object.keys(newErrors).length > 0) {
      setValidationErrors(newErrors);
      // Set first error as main error message
      const firstError = newErrors.contactInfo || newErrors.emails || newErrors.phones;
      if (firstError) setError(firstError);
      return;
    }
    
    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        accountId: selectedAccount?.id || undefined,
        customFields: customFieldValues,
      };

      let contactId: string;
      
      if (isNew) {
        const newContact = await contactsApi.create(dataToSave);
        contactId = newContact.id;
        
        // Link account for new contact if selected
        if (selectedAccount) {
          await contactsApi.linkAccount(contactId, selectedAccount.id, '', true);
        }
      } else {
        await contactsApi.update(id!, dataToSave);
        contactId = id!;
        
        // Get current linked accounts
        const linkedAccounts = await contactsApi.getAccounts(contactId);
        
        if (selectedAccount) {
          // Check if this account is already linked
          const alreadyLinked = linkedAccounts.some(a => a.id === selectedAccount.id);
          if (!alreadyLinked) {
            // Unlink old accounts first
            for (const account of linkedAccounts) {
              await contactsApi.unlinkAccount(contactId, account.id);
            }
            // Link new account
            await contactsApi.linkAccount(contactId, selectedAccount.id, '', true);
          }
        } else {
          // Unlink all accounts
          for (const account of linkedAccounts) {
            await contactsApi.unlinkAccount(contactId, account.id);
          }
        }
      }
      
      navigate(`/contacts/${contactId}`);
    } catch (err) {
      setError('Failed to save contact');
      console.error(err);
    } finally {
      setSaving(false);
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
      if (tabId) {
        return g.tabId === tabId;
      }
      return g.section === section && !g.tabId;
    });
  };

  // Get fields for a group
  const getFieldsForGroup = (groupId: string) => {
    return customFields.filter(f => f.groupId === groupId);
  };

  // Real-time duplicate detection helpers
  const getDuplicateEmailIndexes = (emails: EmailEntry[]): Set<number> => {
    const seen = new Map<string, number>();
    const duplicates = new Set<number>();
    
    emails.forEach((entry, index) => {
      const normalized = entry.email?.trim().toLowerCase();
      if (!normalized) return;
      
      if (seen.has(normalized)) {
        duplicates.add(seen.get(normalized)!);
        duplicates.add(index);
      } else {
        seen.set(normalized, index);
      }
    });
    
    return duplicates;
  };
  
  const getDuplicatePhoneIndexes = (phones: PhoneEntry[]): Set<number> => {
    const seen = new Map<string, number>();
    const duplicates = new Set<number>();
    
    phones.forEach((entry, index) => {
      // Normalize phone: remove all non-digits
      const normalized = entry.number?.replace(/\D/g, '');
      if (!normalized) return;
      
      if (seen.has(normalized)) {
        duplicates.add(seen.get(normalized)!);
        duplicates.add(index);
      } else {
        seen.set(normalized, index);
      }
    });
    
    return duplicates;
  };

  // Render custom fields for a section
  const renderCustomFieldsForSection = (section: string, tabId?: string) => {
    const groups = getGroupsForSection(section, tabId);
    const ungroupedFields = getUngroupedFields(section, tabId);

    if (groups.length === 0 && ungroupedFields.length === 0) {
      return null;
    }

    return (
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
        {/* Grouped Fields */}
        {groups.map(group => {
          const groupFields = getFieldsForGroup(group.id);
          if (groupFields.length === 0) return null;

          const isCollapsed = collapsedGroups.has(group.id);

          return (
            <div key={group.id} className="mb-6">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {group.name}
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  ({groupFields.length} fields)
                </span>
              </button>

              {!isCollapsed && (
                <div className={`grid gap-4 ${group.columns === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
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

  // Build tabs array including custom tabs
  const allTabs = [
    ...STANDARD_TABS,
    ...customTabs.map(t => ({ id: `custom_${t.id}`, label: t.name, isCustom: true, tabId: t.id })),
  ];

  // Check if we need to show the "Custom Fields" tab (for fields in 'custom' section)
  const hasCustomSectionFields = customFields.some(f => f.section === 'custom' && !f.tabId);

  // ============ LOADING STATE (includes layoutLoading) ============
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ============ RENDER DEFAULT FORM ============
  // Note: Custom layout rendering for edit pages is a future enhancement
  // For now, we always use the default form even if useCustomLayout is true
  // This provides a consistent editing experience while detail pages can be customized

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={isNew ? '/contacts' : `/contacts/${id}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {isNew ? 'Back to Contacts' : 'Back to Contact'}
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isNew ? 'New Contact' : 'Edit Contact'}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(isNew ? '/contacts' : `/contacts/${id}`)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          {/* Avatar Section */}
          <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center gap-6">
            <AvatarUpload
              currentUrl={avatarUrl}
              onUpload={handleAvatarUpload}
              name={`${formData.firstName} ${formData.lastName}`.trim() || 'New Contact'}
              type="contact"
              size="lg"
            />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Profile Photo</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Click the image to upload a new photo. Recommended size: 200x200px
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-100 dark:border-slate-800 px-6">
            <div className="flex gap-1 overflow-x-auto">
              {allTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {hasCustomSectionFields && (
                <button
                  type="button"
                  onClick={() => setActiveTab('custom')}
                  className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'custom'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                  }`}
                >
                  Custom Fields
                </button>
              )}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={formData.jobTitle}
                      onChange={(e) => handleChange('jobTitle', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Company
                    </label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => handleChange('company', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Link Account */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Link to Account
                  </label>
                  {selectedAccount ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                      {selectedAccount.imageUrl ? (
                        <img src={selectedAccount.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-semibold">
                          {selectedAccount.label[0]}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{selectedAccount.label}</p>
                        {selectedAccount.sublabel && (
                          <p className="text-sm text-gray-500 dark:text-slate-400">{selectedAccount.sublabel}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAccount(null)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <SearchableSelect
                        placeholder="Search for a company..."
                        onSearch={handleSearchAccounts}
                        onSelect={(option) => {
                          setSelectedAccount(option);
                          handleChange('company', option.label);
                        }}
                        minSearchLength={2}
                      />
                      <button
                        type="button"
                        onClick={() => setShowQuickCreateAccount(true)}
                        className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        <Plus className="w-4 h-4" />
                        Create New Account
                      </button>
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
                    Search and link to an existing account, or create a new one
                  </p>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags?.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-blue-900 dark:hover:text-blue-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Add a tag..."
                      className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Custom fields for basic section */}
                {renderCustomFieldsForSection('basic')}
              </div>
            )}

            {/* Contact Details Tab */}
            {activeTab === 'contact' && (
              <div className="space-y-6">
                {/* Contact Info Required Error Banner */}
                {validationErrors.contactInfo && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                      {validationErrors.contactInfo}
                    </p>
                  </div>
                )}

                {/* Section Header with Required Indicator */}
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    Contact Information
                  </h4>
                  <span className="text-xs text-red-500 font-medium">* At least one email or phone required</span>
                </div>

                {/* Additional Emails */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                      Email Addresses
                    </label>
                    <button
                      type="button"
                      onClick={addEmail}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Email
                    </button>
                  </div>
                  
                  {/* Email Error Message */}
                  {validationErrors.emails && (
                    <p className="text-sm text-red-500 mb-2">{validationErrors.emails}</p>
                  )}
                  
                  {formData.emails?.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 italic mb-2">
                      Click "Add Email" to add an email address
                    </p>
                  )}
                  
                  {formData.emails?.map((email, index) => {
                    const isDuplicate = validationErrors.duplicateEmailIndexes?.has(index);
                    return (
                      <div 
                        key={index} 
                        className={`flex gap-2 mb-2 ${isDuplicate ? 'ring-2 ring-red-500 rounded-xl p-1' : ''}`}
                      >
                        <select
                          value={email.type}
                          onChange={(e) => updateEmail(index, 'type', e.target.value)}
                          className="px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        >
                          {emailTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <input
                          type="email"
                          value={email.email}
                          onChange={(e) => updateEmail(index, 'email', e.target.value)}
                          className={`flex-1 px-4 py-2.5 border rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white ${
                            isDuplicate 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-200 dark:border-slate-700'
                          }`}
                          placeholder="email@example.com"
                        />
                        <label className="flex items-center gap-2 px-3">
                          <input
                            type="checkbox"
                            checked={email.primary}
                            onChange={(e) => updateEmail(index, 'primary', e.target.checked)}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-gray-600 dark:text-slate-400">Primary</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeEmail(index)}
                          className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Additional Phones */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                      Phone Numbers
                    </label>
                    <button
                      type="button"
                      onClick={addPhone}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Phone
                    </button>
                  </div>
                  
                  {/* Phone Error Message */}
                  {validationErrors.phones && (
                    <p className="text-sm text-red-500 mb-2">{validationErrors.phones}</p>
                  )}
                  
                  {formData.phones?.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 italic mb-2">
                      Click "Add Phone" to add a phone number
                    </p>
                  )}
                  
                  {formData.phones?.map((phone, index) => {
                    const isDuplicate = validationErrors.duplicatePhoneIndexes?.has(index);
                    return (
                      <div 
                        key={index} 
                        className={`flex gap-2 mb-2 ${isDuplicate ? 'ring-2 ring-red-500 rounded-xl p-1' : ''}`}
                      >
                        <select
                          value={phone.type}
                          onChange={(e) => updatePhone(index, 'type', e.target.value)}
                          className="px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        >
                          {phoneTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          value={phone.number}
                          onChange={(e) => updatePhone(index, 'number', e.target.value)}
                          className={`flex-1 px-4 py-2.5 border rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white ${
                            isDuplicate 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-200 dark:border-slate-700'
                          }`}
                          placeholder="+1 234 567 8900"
                        />
                        <label className="flex items-center gap-2 px-3">
                          <input
                            type="checkbox"
                            checked={phone.primary}
                            onChange={(e) => updatePhone(index, 'primary', e.target.checked)}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-gray-600 dark:text-slate-400">Primary</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removePhone(index)}
                          className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Communication Preferences */}
                <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                    Communication Preferences
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.doNotContact}
                        onChange={(e) => handleChange('doNotContact', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-600 dark:text-slate-400">Do Not Contact</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.doNotEmail}
                        onChange={(e) => handleChange('doNotEmail', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-600 dark:text-slate-400">Do Not Email</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.doNotCall}
                        onChange={(e) => handleChange('doNotCall', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-600 dark:text-slate-400">Do Not Call</span>
                    </label>
                  </div>
                </div>

                {/* Custom fields for contact section */}
                {renderCustomFieldsForSection('contact')}
              </div>
            )}

            {/* Address Tab */}
            {activeTab === 'address' && (
              <div className="space-y-6">
                {/* Primary Address */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Primary Address</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        value={formData.addressLine1}
                        onChange={(e) => handleChange('addressLine1', e.target.value)}
                        placeholder="Address Line 1"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        value={formData.addressLine2}
                        onChange={(e) => handleChange('addressLine2', e.target.value)}
                        placeholder="Address Line 2"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                        placeholder="City"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => handleChange('state', e.target.value)}
                        placeholder="State/Province"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) => handleChange('postalCode', e.target.value)}
                        placeholder="Postal Code"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={formData.country}
                        onChange={(e) => handleChange('country', e.target.value)}
                        placeholder="Country"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Addresses */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                      Additional Addresses
                    </label>
                    <button
                      type="button"
                      onClick={addAddress}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Address
                    </button>
                  </div>
                  {formData.addresses?.map((address, index) => (
                    <div key={index} className="p-4 border border-gray-200 dark:border-slate-700 rounded-xl mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <select
                          value={address.type}
                          onChange={(e) => updateAddress(index, 'type', e.target.value)}
                          className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                        >
                          {addressTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={address.primary}
                              onChange={(e) => updateAddress(index, 'primary', e.target.checked)}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-sm text-gray-600 dark:text-slate-400">Primary</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => removeAddress(index)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={address.line1}
                          onChange={(e) => updateAddress(index, 'line1', e.target.value)}
                          placeholder="Address Line 1"
                          className="md:col-span-2 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          value={address.line2 || ''}
                          onChange={(e) => updateAddress(index, 'line2', e.target.value)}
                          placeholder="Address Line 2"
                          className="md:col-span-2 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          value={address.city}
                          onChange={(e) => updateAddress(index, 'city', e.target.value)}
                          placeholder="City"
                          className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          value={address.state}
                          onChange={(e) => updateAddress(index, 'state', e.target.value)}
                          placeholder="State"
                          className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          value={address.postalCode}
                          onChange={(e) => updateAddress(index, 'postalCode', e.target.value)}
                          placeholder="Postal Code"
                          className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          value={address.country}
                          onChange={(e) => updateAddress(index, 'country', e.target.value)}
                          placeholder="Country"
                          className="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom fields for address section */}
                {renderCustomFieldsForSection('address')}
              </div>
            )}

            {/* Social Profiles Tab */}
            {activeTab === 'social' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    value={formData.socialProfiles?.linkedin || ''}
                    onChange={(e) => handleSocialChange('linkedin', e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Twitter
                  </label>
                  <input
                    type="url"
                    value={formData.socialProfiles?.twitter || ''}
                    onChange={(e) => handleSocialChange('twitter', e.target.value)}
                    placeholder="https://twitter.com/username"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Facebook
                  </label>
                  <input
                    type="url"
                    value={formData.socialProfiles?.facebook || ''}
                    onChange={(e) => handleSocialChange('facebook', e.target.value)}
                    placeholder="https://facebook.com/username"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Instagram
                  </label>
                  <input
                    type="url"
                    value={formData.socialProfiles?.instagram || ''}
                    onChange={(e) => handleSocialChange('instagram', e.target.value)}
                    placeholder="https://instagram.com/username"
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Custom fields for social section */}
                {renderCustomFieldsForSection('social')}
              </div>
            )}

            {/* Other Tab */}
            {activeTab === 'other' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Lead Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => handleChange('source', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select source...</option>
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="social">Social Media</option>
                    <option value="event">Event</option>
                    <option value="advertisement">Advertisement</option>
                    <option value="cold_call">Cold Call</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    placeholder="Add any notes about this contact..."
                  />
                </div>

                {/* Custom fields for other section */}
                {renderCustomFieldsForSection('other')}
              </div>
            )}

            {/* Custom Fields Tab (for 'custom' section) */}
            {activeTab === 'custom' && hasCustomSectionFields && (
              <div>
                {renderCustomFieldsForSection('custom')}
              </div>
            )}

            {/* Custom Tabs */}
            {activeTab.startsWith('custom_') && (
              <div>
                {(() => {
                  const tabId = activeTab.replace('custom_', '');
                  return renderCustomFieldsForSection('', tabId);
                })()}
              </div>
            )}
            {/* Quick Create Account Modal */}
            <QuickCreateAccountModal
              isOpen={showQuickCreateAccount}
              onClose={() => setShowQuickCreateAccount(false)}
              onCreated={handleQuickAccountCreated}
            />
          </div>
        </div>
      </form>
    </div>
  );
}