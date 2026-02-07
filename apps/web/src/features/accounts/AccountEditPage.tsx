import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, X } from 'lucide-react';
import { accountsApi } from '../../api/accounts.api';
import type { CreateAccountData } from '../../api/accounts.api';

export function AccountEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<CreateAccountData>({
    name: '',
    website: '',
    industry: '',
    companySize: '',
    description: '',
    accountType: 'prospect',
  });

  useEffect(() => {
    if (id) fetchAccount();
  }, [id]);

  const fetchAccount = async () => {
    if (!id) return;
    try {
      const account = await accountsApi.getOne(id);
      setFormData({
        name: account.name,
        website: account.website || '',
        industry: account.industry || '',
        companySize: account.companySize || '',
        description: account.description || '',
        accountType: account.accountType || 'prospect',
        tags: account.tags,
      });
    } catch {
      navigate('/accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (isNew) {
        const account = await accountsApi.create(formData);
        navigate(`/accounts/${account.id}`);
      } else {
        await accountsApi.update(id!, formData);
        navigate(`/accounts/${id}`);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string | string[] } } };
      const message = error.response?.data?.message;
      setError(Array.isArray(message) ? message[0] : message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CreateAccountData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      <Link to={isNew ? '/accounts' : `/accounts/${id}`} className="inline-flex items-center gap-2 text-sm text-gray-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isNew ? 'New Account' : 'Edit Account'}
        </h1>
        <div className="flex gap-2">
          <button onClick={() => navigate(isNew ? '/accounts' : `/accounts/${id}`)} className="flex items-center gap-2 px-4 py-2 border rounded-xl">
            <X className="w-4 h-4" /> Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1.5">Company Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
              placeholder="Acme Corporation"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={e => handleChange('website', e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Industry</label>
              <input
                type="text"
                value={formData.industry}
                onChange={e => handleChange('industry', e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                placeholder="Technology"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Company Size</label>
              <select
                value={formData.companySize}
                onChange={e => handleChange('companySize', e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
              >
                <option value="">Select size</option>
                <option value="1-10">1-10</option>
                <option value="11-50">11-50</option>
                <option value="51-200">51-200</option>
                <option value="201-500">201-500</option>
                <option value="501-1000">501-1000</option>
                <option value="1000+">1000+</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Account Type</label>
              <select
                value={formData.accountType}
                onChange={e => handleChange('accountType', e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
              >
                <option value="prospect">Prospect</option>
                <option value="customer">Customer</option>
                <option value="partner">Partner</option>
                <option value="vendor">Vendor</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={formData.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white resize-none"
              placeholder="Company description..."
            />
          </div>
        </div>
      </form>
    </div>
  );
}