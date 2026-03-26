import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Loader2, Save, Plus, Trash2, Star,
  Globe, Phone, MapPin, Tag, ToggleLeft, ToggleRight, DollarSign, Upload,
  Download, AlertTriangle, Shield, Database, CheckCircle2,
  ChevronUp, ChevronDown, Users, Mail, Home,
} from 'lucide-react';
import { generalSettingsApi } from '../../api/admin.api';
import type { CompanySettings, Industry } from '../../api/admin.api';
import { generalSettingsApi as newSettingsApi } from '../../api/generalSettings.api';
import { uploadApi } from '../../api/upload.api';
import { CountrySelect } from '../../components/shared/CountrySelect';
import { CitySelect } from '../../components/shared/CitySelect';
import { invalidateGeneralSettingsCache } from '../../hooks/useGeneralSettings';
import { getCountryByCode, getCountryCodeByName } from '../../data/countries';
import { PhoneInput } from '../../components/shared/PhoneInput';
import { TimezoneSelect } from '../../components/shared/TimezoneSelect';

const TABS = [
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'industries', label: 'Industries', icon: Tag },
  { id: 'currencies', label: 'Currencies', icon: DollarSign },
  { id: 'account-statuses', label: 'Account Statuses', icon: Users },
  { id: 'contact-types', label: 'Contact Types', icon: Phone },
  { id: 'data', label: 'Data Management', icon: Database },
] as const;
type TabId = typeof TABS[number]['id'];

export function GeneralSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('company');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 mb-3"
        >
          <ArrowLeft size={14} /> Back to Admin
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Building2 size={22} /> General Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Company profile used in proposals, contracts &amp; invoices. Manage shared picklists.
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-slate-700 mb-6">
        <nav className="flex gap-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 pb-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'company'          && <CompanyProfileTab />}
      {activeTab === 'industries'       && <IndustriesTab />}
      {activeTab === 'currencies'       && <CurrenciesTab />}
      {activeTab === 'account-statuses' && <AccountStatusesTab />}
      {activeTab === 'contact-types'    && <ContactTypesTab />}
      {activeTab === 'data'             && <DataManagementTab />}
    </div>
  );
}

// ── Company Profile Tab ──────────────────────────────────────────

function CompanyProfileTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [form, setForm]       = useState<CompanySettings>({});
  const [activeCurrencies, setActiveCurrencies] = useState<any[]>([]);
  const [logoError, setLogoError] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      newSettingsApi.getCompany(),
      newSettingsApi.getActiveCurrencies(),
    ]).then(([settings, currencies]) => {
      setForm(settings ?? {});
      setActiveCurrencies(currencies ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const set = (key: keyof CompanySettings, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await newSettingsApi.updateCompany(form);
      invalidateGeneralSettingsCache();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Brand Identity */}
      <Section title="Brand Identity" icon={Building2}>
        <Field label="Company Name" span={2}>
          <input
            value={form.companyName ?? ''}
            onChange={e => set('companyName', e.target.value)}
            placeholder="Intellicon Technologies"
            className={inputCls}
          />
        </Field>
        <Field label="Tagline" span={2}>
          <input
            value={form.tagline ?? ''}
            onChange={e => set('tagline', e.target.value)}
            placeholder="Your CRM Tagline"
            className={inputCls}
          />
        </Field>
        <Field label="Logo" span={2}>
          <div className="flex items-start gap-4">
            {/* Preview */}
            <div className="w-24 h-16 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 overflow-hidden shrink-0">
              {form.logoUrl && !logoError ? (
                <img
                  key={form.logoUrl}
                  src={form.logoUrl}
                  alt="logo"
                  referrerPolicy="no-referrer"
                  className="max-h-14 max-w-20 object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Building2 className="w-6 h-6 text-gray-300 dark:text-slate-500" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              {/* Upload button */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setLogoUploading(true);
                  setLogoError(false);
                  try {
                    const result = await uploadApi.uploadFile(file);
                    set('logoUrl', result.url);
                  } catch {
                    setLogoError(true);
                  } finally {
                    setLogoUploading(false);
                    if (logoInputRef.current) logoInputRef.current.value = '';
                  }
                }}
              />
              <button
                type="button"
                disabled={logoUploading}
                onClick={() => logoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {logoUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {logoUploading ? 'Uploading...' : 'Upload Logo'}
              </button>
              {/* Or paste URL */}
              <div className="flex items-center gap-2">
                <input
                  value={form.logoUrl ?? ''}
                  onChange={e => { set('logoUrl', e.target.value); setLogoError(false); }}
                  placeholder="Or paste image URL..."
                  className={`${inputCls} text-xs`}
                />
              </div>
              {logoError && form.logoUrl && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Could not load preview. Try uploading the image instead.</p>
              )}
            </div>
          </div>
        </Field>
        <Field label="Website" span={2}>
          <input
            value={form.website ?? ''}
            onChange={e => set('website', e.target.value)}
            placeholder="https://company.com"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Locale */}
      <Section title="Locale & Defaults" icon={Globe}>
        <Field label="Base Country" span={1}>
          <CountrySelect
            value={form.baseCountry ?? ''}
            onChange={code => setForm(prev => ({ ...prev, baseCountry: code, baseCity: '' }))}
          />
          {form.baseCountry && (
            <p className="text-xs text-gray-400 mt-1">
              Default phone code: {getCountryByCode(form.baseCountry)?.dialCode}
            </p>
          )}
        </Field>
        <Field label="Base City" span={1}>
          <CitySelect
            countryCode={form.baseCountry ?? ''}
            value={form.baseCity ?? ''}
            onChange={city => setForm(prev => ({ ...prev, baseCity: city }))}
          />
        </Field>
        <Field label="Default Currency" span={1}>
          <select
            value={form.defaultCurrency ?? 'USD'}
            onChange={e => setForm(prev => ({ ...prev, defaultCurrency: e.target.value }))}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
          >
            {activeCurrencies.map((c: any) => (
              <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>
            ))}
          </select>
        </Field>
        <Field label="Timezone" span={1}>
          <TimezoneSelect
            value={form.timezone ?? 'UTC'}
            onChange={tz => set('timezone', tz)}
          />
        </Field>
      </Section>

      {/* Contact */}
      <Section title="Contact Information" icon={Phone}>
        <Field label="Email" span={1}>
          <input
            type="email"
            value={form.email ?? ''}
            onChange={e => set('email', e.target.value)}
            placeholder="info@company.com"
            className={inputCls}
          />
        </Field>
        <Field label="Phone" span={1}>
          <PhoneInput
            value={form.phone ?? ''}
            defaultCountry={form.baseCountry ?? 'US'}
            onChange={(e164) => set('phone', e164)}
            placeholder="Phone number"
          />
        </Field>
      </Section>

      {/* Address */}
      <Section title="Address" icon={MapPin}>
        <Field label="Address Line 1" span={2}>
          <input
            value={form.addressLine1 ?? ''}
            onChange={e => set('addressLine1', e.target.value)}
            placeholder="Street address"
            className={inputCls}
          />
        </Field>
        <Field label="Address Line 2" span={2}>
          <input
            value={form.addressLine2 ?? ''}
            onChange={e => set('addressLine2', e.target.value)}
            placeholder="Suite / Floor"
            className={inputCls}
          />
        </Field>
        <Field label="City" span={1}>
          <input
            value={form.city ?? ''}
            onChange={e => set('city', e.target.value)}
            placeholder="Lahore"
            className={inputCls}
          />
        </Field>
        <Field label="State / Province" span={1}>
          <input
            value={form.state ?? ''}
            onChange={e => set('state', e.target.value)}
            placeholder="Punjab"
            className={inputCls}
          />
        </Field>
        <Field label="Country" span={1}>
          <CountrySelect
            value={getCountryCodeByName(form.country ?? '') || form.country || ''}
            onChange={code => {
              const name = getCountryByCode(code)?.name ?? code;
              setForm(prev => ({ ...prev, country: name }));
            }}
            placeholder="Select country..."
          />
        </Field>
        <Field label="Postal Code" span={1}>
          <input
            value={form.postalCode ?? ''}
            onChange={e => set('postalCode', e.target.value)}
            placeholder="54000"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Legal */}
      <Section title="Legal & Tax" icon={Globe}>
        <Field label="Tax ID / NTN" span={1}>
          <input
            value={form.taxId ?? ''}
            onChange={e => set('taxId', e.target.value)}
            placeholder="Tax registration number"
            className={inputCls}
          />
        </Field>
        <Field label="Company Registration No." span={1}>
          <input
            value={form.registrationNo ?? ''}
            onChange={e => set('registrationNo', e.target.value)}
            placeholder="SECP / CNIC"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Industries Tab ───────────────────────────────────────────────

function IndustriesTab() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [adding, setAdding]         = useState(false);
  const [newName, setNewName]       = useState('');
  const [saving, setSaving]         = useState(false);

  const load = () => {
    setLoading(true);
    generalSettingsApi.getIndustries()
      .then(setIndustries)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await generalSettingsApi.createIndustry(newName.trim());
      setNewName('');
      setAdding(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ind: Industry) => {
    await generalSettingsApi.updateIndustry(ind.id, { isActive: !ind.isActive });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this industry?')) return;
    await generalSettingsApi.deleteIndustry(id);
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Industries</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Used in Leads, Contacts, Accounts &amp; Opportunities
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs hover:bg-purple-700"
        >
          <Plus className="w-3 h-3" /> Add Industry
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Industry name"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || saving}
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-purple-700"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
          </button>
          <button
            onClick={() => { setAdding(false); setNewName(''); }}
            className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-700/50">
        {industries.map(ind => (
          <div
            key={ind.id}
            className={`flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 ${!ind.isActive ? 'opacity-50' : ''}`}
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ind.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="flex-1 text-sm text-gray-900 dark:text-white font-medium">{ind.name}</span>
            {ind.isSystem && (
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded">
                System
              </span>
            )}
            <button
              onClick={() => handleToggle(ind)}
              className="text-gray-400 hover:text-purple-600 transition-colors"
              title={ind.isActive ? 'Deactivate' : 'Activate'}
            >
              {ind.isActive
                ? <ToggleRight size={18} className="text-green-500" />
                : <ToggleLeft size={18} />
              }
            </button>
            {!ind.isSystem && (
              <button
                onClick={() => handleDelete(ind.id)}
                className="text-gray-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        {industries.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No industries yet.</div>
        )}
      </div>
    </div>
  );
}

// ── Currencies Tab ──────────────────────────────────────────────

function CurrenciesTab() {
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({ code: '', name: '', symbol: '', decimalPlaces: 2 });

  const load = () => {
    setLoading(true);
    newSettingsApi.getCurrencies().then(data => { setCurrencies(data); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newForm.code || !newForm.name || !newForm.symbol) return;
    setSaving(true);
    try {
      await newSettingsApi.createCurrency(newForm);
      setNewForm({ code: '', name: '', symbol: '', decimalPlaces: 2 });
      setAdding(false);
      load();
    } finally { setSaving(false); }
  };

  const toggle = async (c: any) => {
    await newSettingsApi.updateCurrency(c.id, { isActive: !c.is_active });
    load();
  };

  const setDefault = async (c: any) => {
    await newSettingsApi.setDefaultCurrency(c.id);
    load();
  };

  const remove = async (c: any) => {
    if (!window.confirm(`Delete ${c.code}?`)) return;
    await newSettingsApi.deleteCurrency(c.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Currencies</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">Manage currencies available across the CRM</p>
        </div>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Currency
        </button>
      </div>

      {adding && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Code *</label>
            <input maxLength={3} value={newForm.code}
              onChange={e => setNewForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="USD" className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Name *</label>
            <input value={newForm.name}
              onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
              placeholder="US Dollar" className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Symbol *</label>
            <input value={newForm.symbol}
              onChange={e => setNewForm(p => ({ ...p, symbol: e.target.value }))}
              placeholder="$" className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Decimals</label>
            <select value={newForm.decimalPlaces}
              onChange={e => setNewForm(p => ({ ...p, decimalPlaces: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white">
              <option value={0}>0</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
          <div className="col-span-4 flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800">Cancel</button>
            <button onClick={handleAdd} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : currencies.map((c, idx) => (
          <div key={c.id} className={`flex items-center gap-4 px-4 py-3 ${idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''}`}>
            <span className="text-base font-bold text-gray-900 dark:text-white w-12">{c.code}</span>
            <span className="text-sm text-gray-500 dark:text-slate-400 w-8 text-center">{c.symbol}</span>
            <span className="flex-1 text-sm text-gray-700 dark:text-slate-300">{c.name}</span>
            <span className="text-xs text-gray-400">{c.decimal_places} dec.</span>

            {/* Default star */}
            <button onClick={() => !c.is_default && setDefault(c)}
              title={c.is_default ? 'Default currency' : 'Set as default'}
              className={`p-1.5 rounded-lg transition-colors ${c.is_default ? 'text-yellow-500' : 'text-gray-300 dark:text-slate-600 hover:text-yellow-400'}`}>
              <Star className="w-4 h-4" fill={c.is_default ? 'currentColor' : 'none'} />
            </button>

            {/* Active toggle */}
            <button onClick={() => !c.is_default && toggle(c)} disabled={c.is_default}
              title={c.is_default ? 'Default currency cannot be deactivated' : (c.is_active ? 'Deactivate' : 'Activate')}
              className="disabled:opacity-40">
              {c.is_active
                ? <ToggleRight className="w-7 h-7 text-blue-600" />
                : <ToggleLeft className="w-7 h-7 text-gray-400" />}
            </button>

            {/* Delete */}
            <button onClick={() => remove(c)} disabled={c.is_default}
              className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-red-500 disabled:opacity-30 transition-colors rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Data Management Tab ──────────────────────────────────────────

function DataManagementTab() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<Record<string, number> | null>(null);
  const [purgeError, setPurgeError] = useState('');

  const phraseMatches = confirmPhrase === 'DELETE ALL DATA';

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      await newSettingsApi.exportAllData();
    } catch (err: any) {
      setExportError(err?.response?.data?.message || 'Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handlePurgeClick = () => {
    if (!phraseMatches) return;
    setShowPurgeModal(true);
  };

  const handlePurgeConfirm = async () => {
    setPurging(true);
    setPurgeError('');
    try {
      const result = await newSettingsApi.purgeAllData(confirmPhrase);
      setPurgeResult(result.deleted);
      setShowPurgeModal(false);
      setConfirmPhrase('');
    } catch (err: any) {
      setPurgeError(err?.response?.data?.message || 'Failed to purge data. Please try again.');
      setShowPurgeModal(false);
    } finally {
      setPurging(false);
    }
  };

  const preservedItems = [
    'Users and user accounts',
    'Roles and permissions',
    'Teams and departments',
    'Products and price books',
    'Pipeline and stage configurations',
    'Custom fields and form layouts',
    'System settings',
  ];

  return (
    <div className="space-y-6">
      {/* Export Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Export All Data</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Download a complete export of all your CRM data as an Excel file. Includes accounts,
              contacts, leads, opportunities, tasks, invoices, and more.
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {exporting ? 'Preparing Export...' : 'Download Export'}
        </button>

        {exportError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertTriangle size={14} /> {exportError}
          </p>
        )}

        <p className="mt-3 text-xs text-gray-400 dark:text-slate-500">
          This may take a few moments for large datasets.
        </p>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-red-300 dark:border-red-800 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
          </div>
        </div>

        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Delete All Data</h4>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Permanently delete ALL data from your CRM including accounts, contacts, leads,
              opportunities, tasks, invoices, projects, and all related records.
            </p>
          </div>
        </div>

        <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <Shield size={14} className="text-green-600 dark:text-green-400" />
            The following will NOT be deleted:
          </p>
          <ul className="space-y-1">
            {preservedItems.map(item => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800/50 mb-4">
          <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-1.5 mb-1">
            <AlertTriangle size={14} />
            This action is PERMANENT and cannot be undone.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
            To confirm, type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE ALL DATA</span> below:
          </label>
          <input
            type="text"
            value={confirmPhrase}
            onChange={e => setConfirmPhrase(e.target.value)}
            placeholder="Type DELETE ALL DATA to confirm"
            className="w-full max-w-md px-3 py-2 text-sm border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
          />
        </div>

        <button
          onClick={handlePurgeClick}
          disabled={!phraseMatches || purging}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {purging ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          Delete All Data
        </button>

        {purgeError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertTriangle size={14} /> {purgeError}
          </p>
        )}

        {/* Purge Results */}
        {purgeResult && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800/50">
            <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Data purge completed successfully
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(purgeResult)
                .filter(([, count]) => count > 0)
                .map(([table, count]) => (
                  <div key={table} className="text-xs text-gray-600 dark:text-slate-400">
                    <span className="font-medium">{table.replace(/_/g, ' ')}:</span>{' '}
                    <span className="text-red-600 dark:text-red-400">{count} deleted</span>
                  </div>
                ))}
            </div>
            {Object.values(purgeResult).every(c => c <= 0) && (
              <p className="text-xs text-gray-500 dark:text-slate-400">No data was found to delete.</p>
            )}
          </div>
        )}
      </div>

      {/* Purge Confirmation Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Are you absolutely sure?</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              This will permanently delete all accounts, contacts, leads, opportunities, tasks,
              invoices, projects, and all related records. This action cannot be undone.
            </p>

            <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-6">
              We strongly recommend exporting your data first before proceeding.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowPurgeModal(false)}
                disabled={purging}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePurgeConfirm}
                disabled={purging}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {purging ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {purging ? 'Deleting...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Account Statuses Tab ─────────────────────────────────────────

interface AccountStatus {
  value: string;
  label: string;
  color: string;
  isDefault: boolean;
}

function AccountStatusesTab() {
  const [statuses, setStatuses] = useState<AccountStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    newSettingsApi.getAccountStatuses()
      .then((data: AccountStatus[]) => setStatuses(data))
      .finally(() => setLoading(false));
  }, []);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleAdd = () => {
    setStatuses(prev => [
      ...prev,
      { value: '', label: '', color: '#6b7280', isDefault: false },
    ]);
  };

  const handleRemove = (idx: number) => {
    setStatuses(prev => prev.filter((_, i) => i !== idx));
  };

  const handleChange = (idx: number, field: keyof AccountStatus, val: any) => {
    setStatuses(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const updated = { ...s, [field]: val };
      if (field === 'label' && !s.value) {
        updated.value = slugify(val as string);
      }
      return updated;
    }));
  };

  const handleSetDefault = (idx: number) => {
    setStatuses(prev => prev.map((s, i) => ({ ...s, isDefault: i === idx })));
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    setStatuses(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const handleMoveDown = (idx: number) => {
    if (idx >= statuses.length - 1) return;
    setStatuses(prev => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Auto-generate slugs for any empty values
      const cleaned = statuses.map(s => ({
        ...s,
        value: s.value || slugify(s.label),
      }));
      await newSettingsApi.updateAccountStatuses(cleaned);
      setStatuses(cleaned);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Account Statuses</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Define the lifecycle statuses available for accounts
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs hover:bg-purple-700"
        >
          <Plus className="w-3 h-3" /> Add Status
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[40px_44px_1fr_1fr_80px_70px_40px] gap-2 px-4 py-2 bg-gray-50 dark:bg-slate-800 text-xs font-medium text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-700">
          <span>Order</span>
          <span>Color</span>
          <span>Label</span>
          <span>Value (slug)</span>
          <span>Default</span>
          <span></span>
          <span></span>
        </div>

        {statuses.map((status, idx) => (
          <div
            key={idx}
            className={`grid grid-cols-[40px_44px_1fr_1fr_80px_70px_40px] gap-2 px-4 py-2.5 items-center ${
              idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''
            }`}
          >
            {/* Up/Down arrows */}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => handleMoveUp(idx)}
                disabled={idx === 0}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-20"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => handleMoveDown(idx)}
                disabled={idx >= statuses.length - 1}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-20"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {/* Color picker */}
            <div className="flex items-center">
              <input
                type="color"
                value={status.color}
                onChange={e => handleChange(idx, 'color', e.target.value)}
                className="w-7 h-7 rounded-lg border border-gray-200 dark:border-slate-700 cursor-pointer p-0.5"
              />
            </div>

            {/* Label */}
            <input
              value={status.label}
              onChange={e => handleChange(idx, 'label', e.target.value)}
              placeholder="Status label"
              className="px-2 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
            />

            {/* Value slug */}
            <input
              value={status.value}
              onChange={e => handleChange(idx, 'value', e.target.value)}
              placeholder="auto-generated"
              className="px-2 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-slate-400 focus:ring-2 focus:ring-purple-500 outline-none font-mono text-xs"
            />

            {/* Default radio */}
            <div className="flex justify-center">
              <input
                type="radio"
                name="defaultStatus"
                checked={status.isDefault}
                onChange={() => handleSetDefault(idx)}
                className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
              />
            </div>

            {/* Delete */}
            <div className="flex justify-center">
              <button
                onClick={() => handleRemove(idx)}
                className="text-gray-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* Color preview circle */}
            <div
              className="w-5 h-5 rounded-full border border-gray-200 dark:border-slate-700"
              style={{ backgroundColor: status.color }}
            />
          </div>
        ))}

        {statuses.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No statuses defined. Click "Add Status" to get started.
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save Statuses'}
        </button>
      </div>
    </div>
  );
}

// ── Contact Types Tab ────────────────────────────────────────────

interface TypeItem {
  value: string;
  label: string;
}

interface ContactTypeSettings {
  phoneTypes: TypeItem[];
  emailTypes: TypeItem[];
  addressTypes: TypeItem[];
}

function ContactTypesTab() {
  const [settings, setSettings] = useState<ContactTypeSettings>({
    phoneTypes: [],
    emailTypes: [],
    addressTypes: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    newSettingsApi.getContactTypeSettings()
      .then((data: ContactTypeSettings) => setSettings(data))
      .finally(() => setLoading(false));
  }, []);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleAdd = (key: keyof ContactTypeSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: [...prev[key], { value: '', label: '' }],
    }));
  };

  const handleRemove = (key: keyof ContactTypeSettings, idx: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== idx),
    }));
  };

  const handleChange = (
    key: keyof ContactTypeSettings,
    idx: number,
    field: keyof TypeItem,
    val: string,
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: prev[key].map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: val };
        if (field === 'label' && !item.value) {
          updated.value = slugify(val);
        }
        return updated;
      }),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Auto-generate slugs for any empty values
      const cleaned: ContactTypeSettings = {
        phoneTypes: settings.phoneTypes.map(t => ({
          ...t,
          value: t.value || slugify(t.label),
        })),
        emailTypes: settings.emailTypes.map(t => ({
          ...t,
          value: t.value || slugify(t.label),
        })),
        addressTypes: settings.addressTypes.map(t => ({
          ...t,
          value: t.value || slugify(t.label),
        })),
      };
      await newSettingsApi.updateContactTypeSettings(cleaned);
      setSettings(cleaned);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const sections: { key: keyof ContactTypeSettings; title: string; icon: React.ElementType }[] = [
    { key: 'phoneTypes', title: 'Phone Types', icon: Phone },
    { key: 'emailTypes', title: 'Email Types', icon: Mail },
    { key: 'addressTypes', title: 'Address Types', icon: Home },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Contact Type Settings</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Configure the types available for phone numbers, email addresses, and physical addresses
        </p>
      </div>

      {sections.map(({ key, title, icon: Icon }) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-300">
              <Icon size={15} className="text-gray-400" /> {title}
            </h4>
            <button
              onClick={() => handleAdd(key)}
              className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {settings[key].map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''
                }`}
              >
                <input
                  value={item.label}
                  onChange={e => handleChange(key, idx, 'label', e.target.value)}
                  placeholder="Type label"
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <input
                  value={item.value}
                  onChange={e => handleChange(key, idx, 'value', e.target.value)}
                  placeholder="auto-generated"
                  className="w-36 px-2 py-1.5 text-xs font-mono border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-slate-400 focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <button
                  onClick={() => handleRemove(key, idx)}
                  className="text-gray-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {settings[key].length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                No types defined. Click "Add" to create one.
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save Contact Types'}
        </button>
      </div>
    </div>
  );
}

// ── Shared UI helpers ────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none';

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
        <Icon size={15} className="text-gray-400" /> {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl">
        {children}
      </div>
    </div>
  );
}

function Field({ label, span, children }: {
  label: string;
  span: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <div className={span === 2 ? 'col-span-2' : 'col-span-1'}>
      <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
