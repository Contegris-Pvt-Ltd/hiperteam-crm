// ============================================================
// FILE: apps/web/src/components/shared/QuickCreateAccountModal.tsx
// Updated: B2B/B2C classification support
// ============================================================
import { useState, useEffect } from 'react';
import { X, Building2, Loader2, User } from 'lucide-react';
import { accountsApi, getAccountTypesForClassification, ACCOUNT_CLASSIFICATIONS } from '../../api/accounts.api';
import type { AccountClassification } from '../../api/accounts.api';

export interface QuickCreateAccountResult {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  logoUrl?: string;
  accountClassification?: AccountClassification;
}

interface QuickCreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (account: QuickCreateAccountResult) => void;
  initialName?: string;
  initialClassification?: AccountClassification;
}

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail',
  'Education', 'Real Estate', 'Consulting', 'Marketing', 'Legal',
  'Non-profit', 'Government', 'Other',
];

export function QuickCreateAccountModal({
  isOpen,
  onClose,
  onCreated,
  initialName = '',
  initialClassification = 'business',
}: QuickCreateAccountModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: initialName,
    firstName: '',
    lastName: '',
    industry: '',
    website: '',
    accountType: 'prospect',
    accountClassification: initialClassification as AccountClassification,
    phone: '',
    email: '',
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialName,
        firstName: '',
        lastName: '',
        industry: '',
        website: '',
        accountType: 'prospect',
        accountClassification: initialClassification,
        phone: '',
        email: '',
      });
      setError('');
    }
  }, [isOpen, initialName, initialClassification]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClassificationChange = (classification: AccountClassification) => {
    setFormData(prev => ({
      ...prev,
      accountClassification: classification,
      accountType: 'prospect',
      // Clear irrelevant fields
      ...(classification === 'individual' ? { industry: '' } : { firstName: '', lastName: '' }),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isIndividual = formData.accountClassification === 'individual';

    // Validate
    if (isIndividual) {
      if (!formData.firstName.trim()) {
        setError('First name is required');
        return;
      }
    } else {
      if (!formData.name.trim()) {
        setError('Account name is required');
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      const accountName = isIndividual
        ? [formData.firstName, formData.lastName].filter(Boolean).join(' ')
        : formData.name.trim();

      const accountData = {
        name: accountName,
        accountClassification: formData.accountClassification,
        firstName: isIndividual ? formData.firstName.trim() : undefined,
        lastName: isIndividual ? formData.lastName.trim() : undefined,
        industry: !isIndividual && formData.industry ? formData.industry : undefined,
        website: formData.website || undefined,
        accountType: formData.accountType,
        emails: formData.email ? [{ type: 'work', email: formData.email, primary: true }] : [],
        phones: formData.phone ? [{ type: 'work', number: formData.phone, primary: true }] : [],
      };

      const newAccount = await accountsApi.create(accountData);
      
      onCreated({
        id: newAccount.id,
        name: newAccount.name,
        industry: newAccount.industry,
        website: newAccount.website,
        logoUrl: newAccount.logoUrl,
        accountClassification: newAccount.accountClassification,
      });
      
      onClose();
    } catch (err) {
      console.error('Failed to create account:', err);
      setError('Failed to create account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isIndividual = formData.accountClassification === 'individual';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              {isIndividual ? (
                <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quick Create Account
            </h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Classification Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Type</label>
            <div className="flex gap-2">
              {ACCOUNT_CLASSIFICATIONS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleClassificationChange(c.value)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    formData.accountClassification === c.value
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                      : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-300'
                  }`}
                >
                  {c.value === 'business' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  {c.value === 'business' ? 'Business' : 'Individual'}
                </button>
              ))}
            </div>
          </div>

          {/* Name fields — conditional */}
          {isIndividual ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={e => handleChange('firstName', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                  placeholder="First name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={e => handleChange('lastName', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                  placeholder="Last name"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                placeholder="Company name"
                autoFocus
              />
            </div>
          )}

          {/* Industry — B2B only */}
          {!isIndividual && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Industry</label>
              <select
                value={formData.industry}
                onChange={e => handleChange('industry', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
          )}

          {/* Account Type — dynamic options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Account Type</label>
            <select
              value={formData.accountType}
              onChange={e => handleChange('accountType', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
            >
              {getAccountTypesForClassification(formData.accountClassification).map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          {/* Website — optional for both */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={e => handleChange('website', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              placeholder="https://..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}