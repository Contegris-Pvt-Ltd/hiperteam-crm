/**
 * ACCOUNT EDIT PAGE
 * 
 * Page Designer Integration Status:
 * - Hook added to check if custom layout is enabled
 * - For now, edit pages use the default form regardless of setting
 * - Future enhancement: DynamicFormRenderer for full edit page customization
 * 
 * Features:
 * - Custom fields/tabs/groups rendering (matching ContactEditPage)
 * - Collapsible field groups
 * - Parent account linking via SearchableSelect
 * - Multi-value emails, phones, addresses
 * - Social profiles
 * - Tags
 * - Real-time validation
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, X, Plus, Trash2, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { accountsApi } from '../../api/accounts.api';
import type { CreateAccountData } from '../../api/accounts.api';
import type { EmailEntry, PhoneEntry, AddressEntry, SocialProfiles } from '../../api/contacts.api';
import { uploadApi } from '../../api/upload.api';
import { AvatarUpload } from '../../components/shared/AvatarUpload';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import type { SelectOption } from '../../components/shared/SearchableSelect';
import { adminApi } from '../../api/admin.api';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';
import { CustomFieldRenderer } from '../../components/shared/CustomFieldRenderer';
import { QuickCreateContactModal } from '../../components/shared/QuickCreateContactModal';
import type { QuickCreateContactResult } from '../../components/shared/QuickCreateContactModal';
// ============ PAGE DESIGNER IMPORTS ============
import { useModuleLayout } from '../../hooks/useModuleLayout';
// Note: DynamicFormRenderer for edit pages is a future enhancement
// ===============================================

type TabType = 'basic' | 'contact' | 'address' | 'social' | 'other' | string;

const STANDARD_TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'contact', label: 'Contact Details' },
  { id: 'address', label: 'Addresses' },
  { id: 'social', label: 'Social' },
  { id: 'other', label: 'Other' },
];

const emailTypes = ['general', 'sales', 'support', 'billing', 'other'];
const phoneTypes = ['main', 'sales', 'support', 'fax', 'other'];
const addressTypes = ['headquarters', 'office', 'billing', 'shipping', 'other'];

const industries = [
  'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 
  'Education', 'Real Estate', 'Construction', 'Transportation', 
  'Energy', 'Media', 'Telecommunications', 'Agriculture', 'Other'
];

const companySizes = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'
];

export function AccountEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Parent account selection
  const [selectedParentAccount, setSelectedParentAccount] = useState<SelectOption | null>(null);

  // Custom fields, tabs, and groups
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomFieldGroup[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showQuickCreateContact, setShowQuickCreateContact] = useState(false);

  // Validation
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    emails?: string;
    phones?: string;
    duplicateEmailIndexes?: Set<number>;
    duplicatePhoneIndexes?: Set<number>;
  }>({});

  // ============ PAGE DESIGNER HOOK ============
  const { } = useModuleLayout('accounts', isNew ? 'create' : 'edit');
  // ============================================

  const [formData, setFormData] = useState<CreateAccountData>({
    name: '',
    website: '',
    industry: '',
    companySize: '',
    annualRevenue: undefined,
    description: '',
    emails: [],
    phones: [],
    addresses: [],
    socialProfiles: {},
    accountType: 'prospect',
    tags: [],
  });

  const [tagInput, setTagInput] = useState('');

  // Fetch custom fields, tabs, and groups
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
      fetchAccount();
    }
  }, [id]);

  const fetchAccount = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const account = await accountsApi.getOne(id);
      
      // Map emails
      const mappedEmails: EmailEntry[] = Array.isArray(account.emails)
        ? account.emails.map(e => ({
            type: e.type || 'general',
            email: e.email || '',
            primary: e.primary || false
          }))
        : [];

      // Map phones
      const mappedPhones: PhoneEntry[] = Array.isArray(account.phones)
        ? account.phones.map(p => ({
            type: p.type || 'main',
            number: p.number || '',
            primary: p.primary || false
          }))
        : [];

      // Map addresses
      const mappedAddresses: AddressEntry[] = Array.isArray(account.addresses)
        ? account.addresses.map(a => ({
            type: a.type || 'headquarters',
            line1: a.line1 || '',
            line2: a.line2 || '',
            city: a.city || '',
            state: a.state || '',
            postalCode: a.postalCode || '',
            country: a.country || '',
            primary: a.primary || false
          }))
        : [];

      setFormData({
        name: account.name || '',
        website: account.website || '',
        industry: account.industry || '',
        companySize: account.companySize || '',
        annualRevenue: account.annualRevenue || undefined,
        description: account.description || '',
        emails: mappedEmails,
        phones: mappedPhones,
        addresses: mappedAddresses,
        socialProfiles: account.socialProfiles || {},
        accountType: account.accountType || 'prospect',
        source: account.source || '',
        tags: account.tags || [],
      });

      setLogoUrl(account.logoUrl || null);

      // Load custom field values
      if (account.customFields) {
        setCustomFieldValues(account.customFields as Record<string, unknown>);
      }

      // Set parent account if exists
      if (account.parentAccount) {
        setSelectedParentAccount({
          id: account.parentAccount.id,
          label: account.parentAccount.name,
          sublabel: account.parentAccount.industry || '',
          imageUrl: account.parentAccount.logoUrl || undefined,
        });
      }
    } catch (error) {
      console.error('Failed to fetch account:', error);
      navigate('/accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchParentAccounts = async (query: string): Promise<SelectOption[]> => {
    try {
      const response = await accountsApi.getAll({ search: query, limit: 10 });
      return response.data
        .filter(account => account.id !== id)
        .map(account => ({
          id: account.id,
          label: account.name,
          sublabel: account.industry || account.accountType,
          imageUrl: account.logoUrl || undefined,
        }));
    } catch (error) {
      console.error('Failed to search accounts:', error);
      return [];
    }
  };

  // ============ DUPLICATE DETECTION HELPERS ============
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
      const normalized = entry.number?.replace(/[\s\-\(\)\.]/g, '');
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
  // =====================================================

  // Quick Create Contact handler
  const handleQuickContactCreated = (contact: QuickCreateContactResult) => {
    // Refresh will happen when user navigates to detail page
    // For now just close the modal - the contact is already linked via the modal
    console.log('Contact created and linked:', contact.firstName, contact.lastName);
  };

  const validateForm = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Account name is required';
    }

    // Check for duplicate emails
    const emailDuplicates = getDuplicateEmailIndexes(formData.emails || []);
    if (emailDuplicates.size > 0) {
      errors.emails = 'Please remove duplicate email addresses';
      errors.duplicateEmailIndexes = emailDuplicates;
    }

    // Check for duplicate phones
    const phoneDuplicates = getDuplicatePhoneIndexes(formData.phones || []);
    if (phoneDuplicates.size > 0) {
      errors.phones = 'Please remove duplicate phone numbers';
      errors.duplicatePhoneIndexes = phoneDuplicates;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      // Switch to relevant tab if validation fails
      if (validationErrors.name) {
        setActiveTab('basic');
      } else if (validationErrors.emails || validationErrors.phones) {
        setActiveTab('contact');
      }
      return;
    }

    setSaving(true);

    try {
      // Clean the data - remove empty strings and empty arrays
      const dataToSave: Partial<CreateAccountData> = {
        name: formData.name,
      };

      // Only include fields that have values
      if (formData.website?.trim()) dataToSave.website = formData.website.trim();
      if (formData.industry?.trim()) dataToSave.industry = formData.industry.trim();
      if (formData.companySize?.trim()) dataToSave.companySize = formData.companySize.trim();
      if (formData.annualRevenue) dataToSave.annualRevenue = formData.annualRevenue;
      if (formData.description?.trim()) dataToSave.description = formData.description.trim();
      if (formData.accountType?.trim()) dataToSave.accountType = formData.accountType.trim();
      if (formData.source?.trim()) dataToSave.source = formData.source.trim();

      // Arrays - only include if they have items with actual values
      const cleanedEmails = (formData.emails || []).filter(e => e.email?.trim());
      if (cleanedEmails.length > 0) dataToSave.emails = cleanedEmails;

      const cleanedPhones = (formData.phones || []).filter(p => p.number?.trim());
      if (cleanedPhones.length > 0) dataToSave.phones = cleanedPhones;

      const cleanedAddresses = (formData.addresses || []).filter(a => a.line1?.trim() || a.city?.trim());
      if (cleanedAddresses.length > 0) dataToSave.addresses = cleanedAddresses;

      // Tags
      if (formData.tags && formData.tags.length > 0) dataToSave.tags = formData.tags;

      // Social profiles - only if any have values
      if (formData.socialProfiles && Object.values(formData.socialProfiles).some(v => v?.trim())) {
        dataToSave.socialProfiles = formData.socialProfiles;
      }

      // Logo
      if (logoUrl) {
        dataToSave.logoUrl = logoUrl;
      }

      // Parent account
      if (selectedParentAccount) {
        dataToSave.parentAccountId = selectedParentAccount.id;
      }

      // Custom fields
      if (Object.keys(customFieldValues).length > 0) {
        dataToSave.customFields = customFieldValues;
      }

      if (isNew) {
        const account = await accountsApi.create(dataToSave as CreateAccountData);
        navigate(`/accounts/${account.id}`);
      } else {
        await accountsApi.update(id!, dataToSave as CreateAccountData);
        navigate(`/accounts/${id}`);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string | string[] } } };
      const message = error.response?.data?.message;
      setError(Array.isArray(message) ? message[0] : message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CreateAccountData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation errors when user types
    if (field === 'name' && validationErrors.name) {
      setValidationErrors(prev => ({ ...prev, name: undefined }));
    }
  };

  const handleSocialChange = (platform: keyof SocialProfiles, value: string) => {
    setFormData(prev => ({
      ...prev,
      socialProfiles: { ...prev.socialProfiles, [platform]: value },
    }));
  };

  const handleCustomFieldChange = (fieldKey: string, value: unknown) => {
    setCustomFieldValues(prev => ({ ...prev, [fieldKey]: value }));
  };

  const handleLogoUpload = async (file: File): Promise<string> => {
    if (isNew) {
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
      return url;
    }
    const result = await uploadApi.uploadAvatar('accounts', id!, file);
    setLogoUrl(result.url);
    return result.url;
  };

  // Email handlers
  const addEmail = () => {
    const currentEmails = formData.emails || [];
    handleChange('emails', [...currentEmails, { type: 'general', email: '', primary: currentEmails.length === 0 }]);
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
      }));

      return { ...prev, emails: newEmails };
    });
  };

  const removeEmail = (index: number) => {
    setFormData(prev => {
      const newEmails = (prev.emails || []).filter((_, i) => i !== index);

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
    const currentPhones = formData.phones || [];
    handleChange('phones', [...currentPhones, { type: 'main', number: '', primary: currentPhones.length === 0 }]);
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
      }));

      return { ...prev, phones: newPhones };
    });
  };

  const removePhone = (index: number) => {
    setFormData(prev => {
      const newPhones = (prev.phones || []).filter((_, i) => i !== index);

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
    const currentAddresses = formData.addresses || [];
    handleChange('addresses', [...currentAddresses, {
      type: 'headquarters', line1: '', line2: '', city: '', state: '', postalCode: '', country: '',
      primary: currentAddresses.length === 0
    }]);
  };

  const updateAddress = (index: number, field: keyof AddressEntry, value: string | boolean) => {
    const addresses = [...(formData.addresses || [])];
    addresses[index] = { ...addresses[index], [field]: value };
    if (field === 'primary' && value === true) {
      addresses.forEach((a, i) => { if (i !== index) a.primary = false; });
    }
    handleChange('addresses', addresses);
  };

  const removeAddress = (index: number) => {
    handleChange('addresses', (formData.addresses || []).filter((_, i) => i !== index));
  };

  // Tag handlers
  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      handleChange('tags', [...(formData.tags || []), tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    handleChange('tags', formData.tags?.filter(t => t !== tag));
  };

  // Toggle collapsed groups
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

  // Render custom fields for a section or tab
  const renderCustomFieldsForSection = (section: string, tabId?: string) => {
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

    return (
      <div className="space-y-6">
        {/* Grouped fields */}
        {sectionGroups
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(group => {
            const groupFields = sectionFields.filter(f => f.groupId === group.id);
            if (groupFields.length === 0) return null;

            const isCollapsed = collapsedGroups.has(group.id);

            return (
              <div key={group.id} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">{group.name}</span>
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
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

  // Build tabs array including custom tabs
  const allTabs = [
    ...STANDARD_TABS,
    ...customTabs.map(t => ({ id: `custom_${t.id}`, label: t.name, isCustom: true, tabId: t.id })),
  ];

  // Check if we need to show the "Custom Fields" tab (for fields in 'custom' section)
  const hasCustomSectionFields = customFields.some(f => f.section === 'custom' && !f.tabId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={isNew ? '/accounts' : `/accounts/${id}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {isNew ? 'Back to Accounts' : 'Back to Account'}
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isNew ? 'New Account' : 'Edit Account'}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(isNew ? '/accounts' : `/accounts/${id}`)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-gray-100 dark:border-slate-800 px-6">
            <div className="flex gap-1 overflow-x-auto">
              {allTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
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
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
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
                {/* Logo & Name */}
                <div className="flex items-start gap-6">
                  <AvatarUpload
                    currentUrl={logoUrl}
                    onUpload={handleLogoUpload}
                    name={formData.name || 'A'}
                    type="account"
                    size="lg"
                  />
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Account Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                        validationErrors.name 
                          ? 'border-red-300 dark:border-red-700' 
                          : 'border-gray-200 dark:border-slate-700'
                      }`}
                      placeholder="Enter company name"
                    />
                    {validationErrors.name && (
                      <p className="mt-1 text-sm text-red-500">{validationErrors.name}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Industry</label>
                    <select
                      value={formData.industry}
                      onChange={(e) => handleChange('industry', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    >
                      <option value="">Select industry...</option>
                      {industries.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Account Type</label>
                    <select
                      value={formData.accountType}
                      onChange={(e) => handleChange('accountType', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    >
                      <option value="prospect">Prospect</option>
                      <option value="customer">Customer</option>
                      <option value="partner">Partner</option>
                      <option value="vendor">Vendor</option>
                      <option value="competitor">Competitor</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Company Size</label>
                    <select
                      value={formData.companySize}
                      onChange={(e) => handleChange('companySize', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    >
                      <option value="">Select size...</option>
                      {companySizes.map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Annual Revenue</label>
                    <input
                      type="number"
                      value={formData.annualRevenue || ''}
                      onChange={(e) => handleChange('annualRevenue', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      placeholder="e.g., 1000000"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleChange('website', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                {/* Parent Account */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Parent Account</label>
                  {selectedParentAccount && (
                    <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700 dark:text-emerald-400 flex-1">{selectedParentAccount.label}</span>
                      <button type="button" onClick={() => setSelectedParentAccount(null)} className="text-emerald-600 hover:text-emerald-800">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <SearchableSelect
                    onSearch={handleSearchParentAccounts}
                    onSelect={(option) => setSelectedParentAccount(option)}
                    placeholder="Search parent account..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    placeholder="Brief description of the account..."
                  />
                </div>

                {/* Custom fields for basic section */}
                {renderCustomFieldsForSection('basic')}
              </div>
            )}

            {/* Contact Details Tab */}
            {activeTab === 'contact' && (
              <div className="space-y-6">
                {/* Emails */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Email Addresses</label>
                    <button type="button" onClick={addEmail} className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">
                      <Plus className="w-4 h-4" /> Add Email
                    </button>
                  </div>

                  {/* Email Error Message */}
                  {validationErrors.emails && (
                    <p className="text-sm text-red-500 mb-2">{validationErrors.emails}</p>
                  )}

                  {(formData.emails || []).length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-slate-500 py-2">No email addresses added</p>
                  ) : (
                    <div className="space-y-3">
                      {(formData.emails || []).map((email, index) => {
                        const isDuplicate = validationErrors.duplicateEmailIndexes?.has(index);
                        return (
                          <div key={index} className={`flex items-start gap-3 ${isDuplicate ? 'ring-2 ring-red-500 rounded-xl p-1' : ''}`}>
                            <select
                              value={email.type}
                              onChange={e => updateEmail(index, 'type', e.target.value)}
                              className="w-28 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
                            >
                              {emailTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input
                              type="email"
                              value={email.email}
                              onChange={e => updateEmail(index, 'email', e.target.value)}
                              className={`flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border rounded-xl ${
                                isDuplicate
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-gray-200 dark:border-slate-700'
                              }`}
                              placeholder="email@company.com"
                            />
                            <label className="flex items-center gap-1.5 px-3 py-2.5 text-sm">
                              <input type="radio" checked={email.primary} onChange={() => updateEmail(index, 'primary', true)} className="text-emerald-600" />
                              Primary
                            </label>
                            <button type="button" onClick={() => removeEmail(index)} className="p-2.5 text-gray-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Phones */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Phone Numbers</label>
                    <button type="button" onClick={addPhone} className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">
                      <Plus className="w-4 h-4" /> Add Phone
                    </button>
                  </div>

                  {/* Phone Error Message */}
                  {validationErrors.phones && (
                    <p className="text-sm text-red-500 mb-2">{validationErrors.phones}</p>
                  )}

                  {(formData.phones || []).length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-slate-500 py-2">No phone numbers added</p>
                  ) : (
                    <div className="space-y-3">
                      {(formData.phones || []).map((phone, index) => {
                        const isDuplicate = validationErrors.duplicatePhoneIndexes?.has(index);
                        return (
                          <div key={index} className={`flex items-start gap-3 ${isDuplicate ? 'ring-2 ring-red-500 rounded-xl p-1' : ''}`}>
                            <select
                              value={phone.type}
                              onChange={e => updatePhone(index, 'type', e.target.value)}
                              className="w-28 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
                            >
                              {phoneTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input
                              type="tel"
                              value={phone.number}
                              onChange={e => updatePhone(index, 'number', e.target.value)}
                              className={`flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border rounded-xl ${
                                isDuplicate
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-gray-200 dark:border-slate-700'
                              }`}
                              placeholder="+1 (555) 000-0000"
                            />
                            <label className="flex items-center gap-1.5 px-3 py-2.5 text-sm">
                              <input type="radio" checked={phone.primary} onChange={() => updatePhone(index, 'primary', true)} className="text-emerald-600" />
                              Primary
                            </label>
                            <button type="button" onClick={() => removePhone(index)} className="p-2.5 text-gray-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom fields for contact section */}
                {renderCustomFieldsForSection('contact')}
              </div>
            )}

            {/* Addresses Tab */}
            {activeTab === 'address' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Addresses</label>
                  <button type="button" onClick={addAddress} className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">
                    <Plus className="w-4 h-4" /> Add Address
                  </button>
                </div>
                {(formData.addresses || []).length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-slate-500 py-2">No addresses added</p>
                ) : (
                  <div className="space-y-6">
                    {(formData.addresses || []).map((address, index) => (
                      <div key={index} className="p-4 border border-gray-200 dark:border-slate-700 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <select
                              value={address.type}
                              onChange={e => updateAddress(index, 'type', e.target.value)}
                              className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                            >
                              {addressTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <label className="flex items-center gap-1.5 text-sm">
                              <input type="radio" checked={address.primary} onChange={() => updateAddress(index, 'primary', true)} className="text-emerald-600" />
                              Primary
                            </label>
                          </div>
                          <button type="button" onClick={() => removeAddress(index)} className="p-1.5 text-gray-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input type="text" value={address.line1 || ''} onChange={e => updateAddress(index, 'line1', e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" placeholder="Address Line 1" />
                        <input type="text" value={address.line2 || ''} onChange={e => updateAddress(index, 'line2', e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" placeholder="Address Line 2" />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <input type="text" value={address.city || ''} onChange={e => updateAddress(index, 'city', e.target.value)} className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" placeholder="City" />
                          <input type="text" value={address.state || ''} onChange={e => updateAddress(index, 'state', e.target.value)} className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" placeholder="State" />
                          <input type="text" value={address.postalCode || ''} onChange={e => updateAddress(index, 'postalCode', e.target.value)} className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" placeholder="Postal Code" />
                          <input type="text" value={address.country || ''} onChange={e => updateAddress(index, 'country', e.target.value)} className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" placeholder="Country" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom fields for address section */}
                {renderCustomFieldsForSection('address')}
              </div>
            )}

            {/* Social Tab */}
            {activeTab === 'social' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">LinkedIn</label>
                  <input type="url" value={formData.socialProfiles?.linkedin || ''} onChange={e => handleSocialChange('linkedin', e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" placeholder="https://linkedin.com/company/acme" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Twitter</label>
                  <input type="url" value={formData.socialProfiles?.twitter || ''} onChange={e => handleSocialChange('twitter', e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" placeholder="https://twitter.com/acme" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Facebook</label>
                  <input type="url" value={formData.socialProfiles?.facebook || ''} onChange={e => handleSocialChange('facebook', e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" placeholder="https://facebook.com/acme" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Instagram</label>
                  <input type="url" value={formData.socialProfiles?.instagram || ''} onChange={e => handleSocialChange('instagram', e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" placeholder="https://instagram.com/acme" />
                </div>

                {/* Custom fields for social section */}
                {renderCustomFieldsForSection('social')}
              </div>
            )}

            {/* Other Tab */}
            {activeTab === 'other' && (
              <div className="space-y-6">
                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Tags</label>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {formData.tags?.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-lg text-sm">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-violet-900">
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
                      className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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

                {/* Source */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Source</label>
                  <select
                    value={formData.source || ''}
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

            {/* Quick Create Contact Modal */}
            <QuickCreateContactModal
              isOpen={showQuickCreateContact}
              onClose={() => setShowQuickCreateContact(false)}
              onCreated={handleQuickContactCreated}
              accountId={id}
              accountName={formData.name}
            />
          </div>
        </div>
      </form>
    </div>
  );
}