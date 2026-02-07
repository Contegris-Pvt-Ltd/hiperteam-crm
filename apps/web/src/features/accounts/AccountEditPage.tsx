import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, X, Plus, Trash2 } from 'lucide-react';
import { accountsApi } from '../../api/accounts.api';
import type { CreateAccountData } from '../../api/accounts.api';
import type { EmailEntry, PhoneEntry, AddressEntry, SocialProfiles } from '../../api/contacts.api';
import { uploadApi } from '../../api/upload.api';
import { AvatarUpload } from '../../components/shared/AvatarUpload';

type TabType = 'basic' | 'contact' | 'address' | 'social' | 'other';

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
      setFormData({
        name: account.name,
        website: account.website || '',
        industry: account.industry || '',
        companySize: account.companySize || '',
        annualRevenue: account.annualRevenue || undefined,
        description: account.description || '',
        emails: account.emails || [],
        phones: account.phones || [],
        addresses: account.addresses || [],
        socialProfiles: account.socialProfiles || {},
        parentAccountId: account.parentAccountId || undefined,
        accountType: account.accountType || 'prospect',
        tags: account.tags || [],
        source: account.source || undefined,
        ownerId: account.ownerId || undefined,
      });
      setLogoUrl(account.logoUrl);
    } catch (error) {
      console.error('Failed to fetch account:', error);
      navigate('/accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const dataToSave = { ...formData };
      if (logoUrl) {
        dataToSave.logoUrl = logoUrl;
      }

      if (isNew) {
        const account = await accountsApi.create(dataToSave);
        navigate(`/accounts/${account.id}`);
      } else {
        await accountsApi.update(id!, dataToSave);
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
  };

  const handleSocialChange = (platform: keyof SocialProfiles, value: string) => {
    setFormData(prev => ({
      ...prev,
      socialProfiles: { ...prev.socialProfiles, [platform]: value },
    }));
  };

  const handleLogoUpload = async (file: File): Promise<string> => {
    if (isNew) {
      return URL.createObjectURL(file);
    }
    const result = await uploadApi.uploadAvatar('accounts', id!, file);
    setLogoUrl(result.url);
    return result.url;
  };

  // Email handlers
  const addEmail = () => {
    handleChange('emails', [...(formData.emails || []), { type: 'general', email: '', primary: formData.emails?.length === 0 }]);
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
    handleChange('emails', formData.emails?.filter((_, i) => i !== index));
  };

  // Phone handlers
  const addPhone = () => {
    handleChange('phones', [...(formData.phones || []), { type: 'main', number: '', primary: formData.phones?.length === 0 }]);
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
    handleChange('phones', formData.phones?.filter((_, i) => i !== index));
  };

  // Address handlers
  const addAddress = () => {
    handleChange('addresses', [...(formData.addresses || []), {
      type: 'headquarters', line1: '', line2: '', city: '', state: '', postalCode: '', country: '',
      primary: formData.addresses?.length === 0
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
    handleChange('addresses', formData.addresses?.filter((_, i) => i !== index));
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
              {saving ? 'Saving...' : 'Save Account'}
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
          {/* Logo Section */}
          <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center gap-6">
            <AvatarUpload
              currentUrl={logoUrl}
              onUpload={handleLogoUpload}
              name={formData.name || 'New Account'}
              type="account"
              size="lg"
            />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Company Logo</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Click the image to upload a logo. Recommended size: 200x200px
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
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => handleChange('name', e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Acme Corporation"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={e => handleChange('website', e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="https://acme.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      Industry
                    </label>
                    <select
                      value={formData.industry}
                      onChange={e => handleChange('industry', e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select industry</option>
                      {industries.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      Company Size
                    </label>
                    <select
                      value={formData.companySize}
                      onChange={e => handleChange('companySize', e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select size</option>
                      {companySizes.map(size => (
                        <option key={size} value={size}>{size} employees</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      Annual Revenue
                    </label>
                    <input
                      type="number"
                      value={formData.annualRevenue || ''}
                      onChange={e => handleChange('annualRevenue', e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="5000000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                      Account Type
                    </label>
                    <select
                      value={formData.accountType}
                      onChange={e => handleChange('accountType', e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="prospect">Prospect</option>
                      <option value="customer">Customer</option>
                      <option value="partner">Partner</option>
                      <option value="vendor">Vendor</option>
                      <option value="competitor">Competitor</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => handleChange('description', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    placeholder="Company description..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="space-y-6">
                {/* Emails */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Email Addresses
                    </label>
                    <button type="button" onClick={addEmail} className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Add Email
                    </button>
                  </div>
                  {formData.emails?.length === 0 ? (
                    <button type="button" onClick={addEmail} className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-400 hover:border-gray-400 text-sm">
                      Click to add an email address
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {formData.emails?.map((email, index) => (
                        <div key={index} className="flex gap-2">
                          <select
                            value={email.type}
                            onChange={e => updateEmail(index, 'type', e.target.value)}
                            className="w-32 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
                          >
                            {emailTypes.map(type => (
                              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                            ))}
                          </select>
                          <input
                            type="email"
                            value={email.email}
                            onChange={e => updateEmail(index, 'email', e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl"
                            placeholder="email@company.com"
                          />
                          <label className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl cursor-pointer">
                            <input type="checkbox" checked={email.primary || false} onChange={e => updateEmail(index, 'primary', e.target.checked)} className="w-4 h-4 rounded" />
                            <span className="text-xs text-gray-600 dark:text-slate-400">Primary</span>
                          </label>
                          <button type="button" onClick={() => removeEmail(index)} className="p-2.5 text-gray-400 hover:text-red-600 rounded-xl">
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Phone Numbers</label>
                    <button type="button" onClick={addPhone} className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Add Phone
                    </button>
                  </div>
                  {formData.phones?.length === 0 ? (
                    <button type="button" onClick={addPhone} className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-400 hover:border-gray-400 text-sm">
                      Click to add a phone number
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {formData.phones?.map((phone, index) => (
                        <div key={index} className="flex gap-2">
                          <select
                            value={phone.type}
                            onChange={e => updatePhone(index, 'type', e.target.value)}
                            className="w-32 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm"
                          >
                            {phoneTypes.map(type => (
                              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            value={phone.number}
                            onChange={e => updatePhone(index, 'number', e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl"
                            placeholder="+1 555-123-4567"
                          />
                          <label className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl cursor-pointer">
                            <input type="checkbox" checked={phone.primary || false} onChange={e => updatePhone(index, 'primary', e.target.checked)} className="w-4 h-4 rounded" />
                            <span className="text-xs text-gray-600 dark:text-slate-400">Primary</span>
                          </label>
                          <button type="button" onClick={() => removePhone(index)} className="p-2.5 text-gray-400 hover:text-red-600 rounded-xl">
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Addresses</label>
                  <button type="button" onClick={addAddress} className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Add Address
                  </button>
                </div>
                {formData.addresses?.length === 0 ? (
                  <button type="button" onClick={addAddress} className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-400 hover:border-gray-400 text-sm">
                    Click to add an address
                  </button>
                ) : (
                  <div className="space-y-4">
                    {formData.addresses?.map((address, index) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <select
                              value={address.type}
                              onChange={e => updateAddress(index, 'type', e.target.value)}
                              className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                            >
                              {addressTypes.map(type => (
                                <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                              ))}
                            </select>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={address.primary || false} onChange={e => updateAddress(index, 'primary', e.target.checked)} className="w-4 h-4 rounded" />
                              <span className="text-sm text-gray-600 dark:text-slate-400">Primary</span>
                            </label>
                          </div>
                          <button type="button" onClick={() => removeAddress(index)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg">
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
              </div>
            )}

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
              </div>
            )}

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
                    <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" placeholder="Add a tag" />
                    <button type="button" onClick={addTag} className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">Add</button>
                  </div>
                </div>

                {/* Source */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Source</label>
                  <select value={formData.source || ''} onChange={e => handleChange('source', e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
                    <option value="">Select source</option>
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Cold Outreach">Cold Outreach</option>
                    <option value="Trade Show">Trade Show</option>
                    <option value="Advertisement">Advertisement</option>
                    <option value="Partner">Partner</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}