import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Loader2, Save, Plus, Trash2,
  Globe, Phone, MapPin, Tag, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { generalSettingsApi } from '../../api/admin.api';
import type { CompanySettings, Industry } from '../../api/admin.api';

const TABS = [
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'industries', label: 'Industries', icon: Tag },
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

      {activeTab === 'company'    && <CompanyProfileTab />}
      {activeTab === 'industries' && <IndustriesTab />}
    </div>
  );
}

// ── Company Profile Tab ──────────────────────────────────────────

function CompanyProfileTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [form, setForm]       = useState<CompanySettings>({});

  useEffect(() => {
    generalSettingsApi.getCompanySettings()
      .then(d => setForm(d ?? {}))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof CompanySettings, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await generalSettingsApi.updateCompanySettings(form);
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
        <Field label="Logo URL" span={2}>
          <input
            value={form.logoUrl ?? ''}
            onChange={e => set('logoUrl', e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
          {form.logoUrl && (
            <img
              src={form.logoUrl}
              alt="logo preview"
              className="mt-2 h-12 object-contain rounded border border-gray-200 dark:border-slate-600"
            />
          )}
        </Field>
        <Field label="Website" span={1}>
          <input
            value={form.website ?? ''}
            onChange={e => set('website', e.target.value)}
            placeholder="https://company.com"
            className={inputCls}
          />
        </Field>
        <Field label="Default Currency" span={1}>
          <input
            value={form.currency ?? ''}
            onChange={e => set('currency', e.target.value)}
            placeholder="PKR"
            className={inputCls}
            maxLength={10}
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
          <input
            value={form.phone ?? ''}
            onChange={e => set('phone', e.target.value)}
            placeholder="+92 300 0000000"
            className={inputCls}
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
          <input
            value={form.country ?? ''}
            onChange={e => set('country', e.target.value)}
            placeholder="Pakistan"
            className={inputCls}
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
      <div className="grid grid-cols-2 gap-4 p-4 bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl">
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
