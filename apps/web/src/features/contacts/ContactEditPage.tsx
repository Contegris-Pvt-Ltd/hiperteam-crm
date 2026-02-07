import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, X, Plus, Trash2 } from 'lucide-react';
import { contactsApi } from '../../api/contacts.api';
import type { CreateContactData, EmailEntry, PhoneEntry, AddressEntry, SocialProfiles } from '../../api/contacts.api';
import { uploadApi } from '../../api/upload.api';
import { AvatarUpload } from '../../components/shared/AvatarUpload';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import type { SelectOption } from '../../components/shared/SearchableSelect';
import { accountsApi } from '../../api/accounts.api';

type TabType = 'basic' | 'contact' | 'address' | 'social' | 'other';

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

  useEffect(() => {
    if (id) {
      fetchContact();
    }
  }, [id]);

  const fetchContact = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const contact = await contactsApi.getOne(id);
      
      // Map emails - ensure we have proper array
      const mappedEmails: EmailEntry[] = Array.isArray(contact.emails) 
        ? contact.emails.map(e => ({
            type: e.type || 'work',
            email: e.email || '',
            primary: e.primary || false
          }))
        : [];

      // Map phones - ensure we have proper array
      const mappedPhones: PhoneEntry[] = Array.isArray(contact.phones)
        ? contact.phones.map(p => ({
            type: p.type || 'mobile',
            number: p.number || '',
            primary: p.primary || false
          }))
        : [];

      // Map addresses - ensure we have proper array
      const mappedAddresses: AddressEntry[] = Array.isArray(contact.addresses)
        ? contact.addresses.map(a => ({
            type: a.type || 'work',
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
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        phone: contact.phone || '',
        mobile: contact.mobile || '',
        company: contact.company || '',
        jobTitle: contact.jobTitle || '',
        website: contact.website || '',
        addressLine1: contact.addressLine1 || '',
        addressLine2: contact.addressLine2 || '',
        city: contact.city || '',
        state: contact.state || '',
        postalCode: contact.postalCode || '',
        country: contact.country || '',
        emails: mappedEmails,
        phones: mappedPhones,
        addresses: mappedAddresses,
        source: contact.source || '',
        tags: contact.tags || [],
        notes: contact.notes || '',
        socialProfiles: contact.socialProfiles || {},
        doNotContact: contact.doNotContact || false,
        doNotEmail: contact.doNotEmail || false,
        doNotCall: contact.doNotCall || false,
        accountId: contact.accountId || undefined,
        ownerId: contact.ownerId || undefined,
      });
      setAvatarUrl(contact.avatarUrl || null);

      // If contact has an account linked, fetch and set it
      if (contact.accountId && contact.account) {
        setSelectedAccount({
          id: contact.accountId,
          label: contact.account.name,
          sublabel: contact.account.industry || undefined,
          imageUrl: contact.account.logoUrl || undefined,
        });
      } else if (contact.company) {
        // If just company name, show it but no account linked
        setSelectedAccount(null);
      }

      // Also check linked accounts
      try {
        const linkedAccounts = await contactsApi.getAccounts(id);
        if (linkedAccounts.length > 0) {
          const primaryAccount = linkedAccounts.find(a => a.isPrimary) || linkedAccounts[0];
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
        sublabel: account.industry || account.accountType,
        imageUrl: account.logoUrl || undefined,
      }));
    } catch (error) {
      console.error('Failed to search accounts:', error);
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const dataToSave = { ...formData };
      if (avatarUrl) {
        dataToSave.avatarUrl = avatarUrl;
      }
      
      // Set company name from selected account if available
      if (selectedAccount) {
        dataToSave.company = selectedAccount.label;
        dataToSave.accountId = selectedAccount.id;
      }

      if (isNew) {
        const contact = await contactsApi.create(dataToSave);
        // Link to account if selected
        if (selectedAccount) {
          await contactsApi.linkAccount(contact.id, selectedAccount.id, '', true);
        }
        navigate(`/contacts/${contact.id}`);
      } else {
        await contactsApi.update(id!, dataToSave);
        // Update account link if changed
        if (selectedAccount) {
          try {
            await contactsApi.linkAccount(id!, selectedAccount.id, '', true);
          } catch (e) {
            // May already be linked, ignore
          }
        }
        navigate(`/contacts/${id}`);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string | string[] } } };
      const message = error.response?.data?.message;
      setError(Array.isArray(message) ? message[0] : message || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CreateContactData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSocialChange = (platform: keyof SocialProfiles, value: string) => {
    setFormData(prev => ({
      ...prev,
      socialProfiles: { ...prev.socialProfiles, [platform]: value },
    }));
  };

  const handleAvatarUpload = async (file: File): Promise<string> => {
    if (isNew) {
      // For new contacts, just preview locally
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
      return url;
    }
    const result = await uploadApi.uploadAvatar('contacts', id!, file);
    setAvatarUrl(result.url);
    return result.url;
  };

  // Email handlers
  const addEmail = () => {
    const currentEmails = formData.emails || [];
    handleChange('emails', [...currentEmails, { type: 'work', email: '', primary: currentEmails.length === 0 }]);
  };

  const updateEmail = (index: number, field: keyof EmailEntry, value: string | boolean) => {
    const emails = [...(formData.emails || [])];
    emails[index] = { ...emails[index], [field]: value };
    if (field === 'primary' && value === true) {
      emails.forEach((e, i) => { if (i !== index) e.primary = false; });
    }
    handleChange('emails', emails);
  };

  const removeEmail = (index: number) => {
    handleChange('emails', (formData.emails || []).filter((_, i) => i !== index));
  };

  // Phone handlers
  const addPhone = () => {
    const currentPhones = formData.phones || [];
    handleChange('phones', [...currentPhones, { type: 'mobile', number: '', primary: currentPhones.length === 0 }]);
  };

  const updatePhone = (index: number, field: keyof PhoneEntry, value: string | boolean) => {
    const phones = [...(formData.phones || [])];
    phones[index] = { ...phones[index], [field]: value };
    if (field === 'primary' && value === true) {
      phones.forEach((p, i) => { if (i !== index) p.primary = false; });
    }
    handleChange('phones', phones);
  };

  const removePhone = (index: number) => {
    handleChange('phones', (formData.phones || []).filter((_, i) => i !== index));
  };

  // Address handlers
  const addAddress = () => {
    const currentAddresses = formData.addresses || [];
    handleChange('addresses', [...currentAddresses, { 
      type: 'work', line1: '', line2: '', city: '', state: '', postalCode: '', country: '', 
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

  const tabs: { id: TabType; label: string }[] = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'contact', label: 'Contact Details' },
    { id: 'address', label: 'Addresses' },
    { id: 'social', label: 'Social' },
    { id: 'other', label: 'Other' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
              {tabs.map(tab => (
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
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={e => handleChange('firstName', e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={e => handleChange('lastName', e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                {/* Account Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Company / Account
                  </label>
                  {selectedAccount ? (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3">
                      {selectedAccount.imageUrl ? (
                        <img src={selectedAccount.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-semibold">
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
                        onClick={() => {
                          setSelectedAccount(null);
                          handleChange('company', '');
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <SearchableSelect
                      placeholder="Search for a company..."
                      onSearch={handleSearchAccounts}
                      onSelect={(option) => {
                        setSelectedAccount(option);
                        handleChange('company', option.label);
                      }}
                      minSearchLength={2}
                    />
                  )}
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
                    Search and link to an existing account, or leave empty
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={e => handleChange('jobTitle', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="VP of Sales"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={e => handleChange('website', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={e => handleChange('source', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select source</option>
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Trade Show">Trade Show</option>
                    <option value="Advertisement">Advertisement</option>
                    <option value="Partner">Partner</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="space-y-6">
                {/* Emails */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Email Addresses ({(formData.emails || []).length})
                    </label>
                    <button
                      type="button"
                      onClick={addEmail}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Email
                    </button>
                  </div>
                  {(formData.emails || []).length === 0 ? (
                    <button
                      type="button"
                      onClick={addEmail}
                      className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-400 hover:border-gray-400 text-sm"
                    >
                      Click to add an email address
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {(formData.emails || []).map((email, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <select
                            value={email.type || 'work'}
                            onChange={e => updateEmail(index, 'type', e.target.value)}
                            className="w-32 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                          >
                            {emailTypes.map(type => (
                              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                            ))}
                          </select>
                          <input
                            type="email"
                            value={email.email || ''}
                            onChange={e => updateEmail(index, 'email', e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="email@example.com"
                          />
                          <label className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl cursor-pointer">
                            <input
                              type="checkbox"
                              checked={email.primary || false}
                              onChange={e => updateEmail(index, 'primary', e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600"
                            />
                            <span className="text-xs text-gray-600 dark:text-slate-400">Primary</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => removeEmail(index)}
                            className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phones */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Phone Numbers ({(formData.phones || []).length})
                    </label>
                    <button
                      type="button"
                      onClick={addPhone}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Phone
                    </button>
                  </div>
                  {(formData.phones || []).length === 0 ? (
                    <button
                      type="button"
                      onClick={addPhone}
                      className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-400 hover:border-gray-400 text-sm"
                    >
                      Click to add a phone number
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {(formData.phones || []).map((phone, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <select
                            value={phone.type || 'mobile'}
                            onChange={e => updatePhone(index, 'type', e.target.value)}
                            className="w-32 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white"
                          >
                            {phoneTypes.map(type => (
                              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            value={phone.number || ''}
                            onChange={e => updatePhone(index, 'number', e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="+1 555-123-4567"
                          />
                          <label className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl cursor-pointer">
                            <input
                              type="checkbox"
                              checked={phone.primary || false}
                              onChange={e => updatePhone(index, 'primary', e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600"
                            />
                            <span className="text-xs text-gray-600 dark:text-slate-400">Primary</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => removePhone(index)}
                            className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'address' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Addresses ({(formData.addresses || []).length})
                  </label>
                  <button
                    type="button"
                    onClick={addAddress}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Address
                  </button>
                </div>
                {(formData.addresses || []).length === 0 ? (
                  <button
                    type="button"
                    onClick={addAddress}
                    className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-400 hover:border-gray-400 text-sm"
                  >
                    Click to add an address
                  </button>
                ) : (
                  <div className="space-y-4">
                    {(formData.addresses || []).map((address, index) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <select
                              value={address.type || 'work'}
                              onChange={e => updateAddress(index, 'type', e.target.value)}
                              className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white"
                            >
                              {addressTypes.map(type => (
                                <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                              ))}
                            </select>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={address.primary || false}
                                onChange={e => updateAddress(index, 'primary', e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600"
                              />
                              <span className="text-sm text-gray-600 dark:text-slate-400">Primary</span>
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAddress(index)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={address.line1 || ''}
                          onChange={e => updateAddress(index, 'line1', e.target.value)}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                          placeholder="Address Line 1"
                        />
                        <input
                          type="text"
                          value={address.line2 || ''}
                          onChange={e => updateAddress(index, 'line2', e.target.value)}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                          placeholder="Address Line 2"
                        />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <input
                            type="text"
                            value={address.city || ''}
                            onChange={e => updateAddress(index, 'city', e.target.value)}
                            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                            placeholder="City"
                          />
                          <input
                            type="text"
                            value={address.state || ''}
                            onChange={e => updateAddress(index, 'state', e.target.value)}
                            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                            placeholder="State"
                          />
                          <input
                            type="text"
                            value={address.postalCode || ''}
                            onChange={e => updateAddress(index, 'postalCode', e.target.value)}
                            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                            placeholder="Postal Code"
                          />
                          <input
                            type="text"
                            value={address.country || ''}
                            onChange={e => updateAddress(index, 'country', e.target.value)}
                            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                            placeholder="Country"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'social' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    value={formData.socialProfiles?.linkedin || ''}
                    onChange={e => handleSocialChange('linkedin', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Twitter
                  </label>
                  <input
                    type="url"
                    value={formData.socialProfiles?.twitter || ''}
                    onChange={e => handleSocialChange('twitter', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://twitter.com/username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Facebook
                  </label>
                  <input
                    type="url"
                    value={formData.socialProfiles?.facebook || ''}
                    onChange={e => handleSocialChange('facebook', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://facebook.com/username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Instagram
                  </label>
                  <input
                    type="url"
                    value={formData.socialProfiles?.instagram || ''}
                    onChange={e => handleSocialChange('instagram', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://instagram.com/username"
                  />
                </div>
              </div>
            )}

            {activeTab === 'other' && (
              <div className="space-y-6">
                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Tags
                  </label>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {formData.tags?.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm"
                      >
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                      placeholder="Add a tag"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-200"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e => handleChange('notes', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white resize-none"
                    placeholder="Additional notes..."
                  />
                </div>

                {/* Communication Preferences */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                    Communication Preferences
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.doNotContact}
                        onChange={e => handleChange('doNotContact', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-red-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-slate-300">Do not contact</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.doNotEmail}
                        onChange={e => handleChange('doNotEmail', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-red-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-slate-300">Do not email</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.doNotCall}
                        onChange={e => handleChange('doNotCall', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-red-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-slate-300">Do not call</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}