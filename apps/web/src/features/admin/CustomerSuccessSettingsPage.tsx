// ============================================================
// FILE: apps/web/src/features/admin/CustomerSuccessSettingsPage.tsx
// ============================================================
// Admin settings page for Customer 360: Health Score Config,
// Product Recommendations, and Upcoming Renewals.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Heart, Save, Plus, Trash2, X, AlertTriangle,
  ToggleLeft, ToggleRight, Package, RefreshCw, ChevronDown,
  Activity, ShoppingBag, Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { customer360Api } from '../../api/customer-360.api';
import type { ProductRecommendation, RenewalItem } from '../../api/customer-360.api';
import { productsApi } from '../../api/products.api';

// ════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════

interface HealthFactor {
  key: string;
  label: string;
  weight: number;
  description: string;
}

interface HealthConfig {
  factors: HealthFactor[];
  thresholds: { healthy: number; atRisk: number };
}

interface TriggerSignal {
  type: string;
  value: number;
  weight: number;
}

interface RecommendationForm {
  id?: string;
  productId: string;
  prerequisites: string[];
  exclusions: string[];
  idealMinSize: number | null;
  idealMaxSize: number | null;
  idealIndustries: string[];
  baseScore: number;
  triggerSignals: TriggerSignal[];
  isActive: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  code: string;
}

const SIGNAL_TYPES = [
  { value: 'renewal_within_days', label: 'Renewal Within Days' },
  { value: 'revenue_growth_percent', label: 'Revenue Growth %' },
  { value: 'usage_metric_above', label: 'Usage Metric Above' },
  { value: 'subscription_expired', label: 'Subscription Expired' },
];

const DAYS_OPTIONS = [30, 60, 90, 180];

const TABS = [
  { key: 'health', label: 'Health Score', icon: Activity },
  { key: 'recommendations', label: 'Recommendations', icon: ShoppingBag },
  { key: 'renewals', label: 'Upcoming Renewals', icon: Calendar },
] as const;

type TabKey = typeof TABS[number]['key'];

// ════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════

export default function CustomerSuccessSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('health');

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Success</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Health scores, recommendations & renewals</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'health' && <HealthScoreTab />}
      {activeTab === 'recommendations' && <RecommendationsTab />}
      {activeTab === 'renewals' && <RenewalsTab />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 1: Health Score Configuration
// ════════════════════════════════════════════════════════════

function HealthScoreTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<HealthConfig | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await customer360Api.getHealthConfig();
      setConfig(data);
    } catch {
      toast.error('Failed to load health score configuration');
    } finally {
      setLoading(false);
    }
  };

  const totalWeight = config?.factors.reduce((sum, f) => sum + f.weight, 0) ?? 0;

  const updateFactor = (index: number, weight: number) => {
    if (!config) return;
    const factors = [...config.factors];
    factors[index] = { ...factors[index], weight };
    setConfig({ ...config, factors });
  };

  const updateThreshold = (key: 'healthy' | 'atRisk', value: number) => {
    if (!config) return;
    setConfig({ ...config, thresholds: { ...config.thresholds, [key]: value } });
  };

  const handleSave = async () => {
    if (!config) return;
    if (totalWeight !== 100) {
      toast.error('Total weight must equal 100');
      return;
    }
    if (config.thresholds.atRisk >= config.thresholds.healthy) {
      toast.error('"At Risk" threshold must be lower than "Healthy" threshold');
      return;
    }
    try {
      setSaving(true);
      await customer360Api.saveHealthConfig(config);
      toast.success('Health score configuration saved');
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-gray-600 dark:text-slate-400">Failed to load configuration</p>
        <button onClick={loadConfig} className="mt-2 text-purple-600 hover:text-purple-700 text-sm font-medium">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Factors */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Health Score Factors</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">Configure the weight of each factor in the overall health score</p>
          </div>
          <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
            totalWeight === 100
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}>
            Total: {totalWeight}%
          </div>
        </div>

        {totalWeight !== 100 && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Weights must add up to 100. Currently {totalWeight}% ({totalWeight > 100 ? `${totalWeight - 100}% over` : `${100 - totalWeight}% remaining`})</span>
          </div>
        )}

        <div className="space-y-4">
          {config.factors.map((factor, idx) => (
            <div key={factor.key} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white">{factor.label}</div>
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{factor.description}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={factor.weight}
                  onChange={(e) => updateFactor(idx, parseInt(e.target.value))}
                  className="w-32 accent-purple-600"
                />
                <div className="w-12 text-right text-sm font-semibold text-gray-900 dark:text-white">
                  {factor.weight}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Thresholds */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Score Thresholds</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Define the score ranges for health statuses</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Healthy Threshold (score &ge;)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={config.thresholds.healthy}
                onChange={(e) => updateThreshold('healthy', parseInt(e.target.value))}
                className="flex-1 accent-green-600"
              />
              <span className="w-12 text-right text-sm font-semibold text-green-600">{config.thresholds.healthy}</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Accounts scoring at or above this are "Healthy"</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              At Risk Threshold (score &ge;)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={99}
                value={config.thresholds.atRisk}
                onChange={(e) => updateThreshold('atRisk', parseInt(e.target.value))}
                className="flex-1 accent-amber-600"
              />
              <span className="w-12 text-right text-sm font-semibold text-amber-600">{config.thresholds.atRisk}</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Accounts scoring below this are "Critical"</p>
          </div>
        </div>

        {/* Visual threshold bar */}
        <div className="mt-6">
          <div className="flex items-center text-xs text-gray-500 dark:text-slate-400 mb-1">
            <span>0</span>
            <span className="flex-1" />
            <span>100</span>
          </div>
          <div className="h-4 rounded-full overflow-hidden flex">
            <div
              className="bg-red-400 dark:bg-red-500 transition-all"
              style={{ width: `${config.thresholds.atRisk}%` }}
            />
            <div
              className="bg-amber-400 dark:bg-amber-500 transition-all"
              style={{ width: `${config.thresholds.healthy - config.thresholds.atRisk}%` }}
            />
            <div
              className="bg-green-400 dark:bg-green-500 transition-all"
              style={{ width: `${100 - config.thresholds.healthy}%` }}
            />
          </div>
          <div className="flex items-center text-xs mt-1">
            <span className="text-red-600 dark:text-red-400 font-medium">Critical</span>
            <span className="flex-1" />
            <span className="text-amber-600 dark:text-amber-400 font-medium">At Risk</span>
            <span className="flex-1" />
            <span className="text-green-600 dark:text-green-400 font-medium">Healthy</span>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || totalWeight !== 100}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 2: Product Recommendations
// ════════════════════════════════════════════════════════════

function RecommendationsTab() {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingForm, setEditingForm] = useState<RecommendationForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recs, prodData] = await Promise.all([
        customer360Api.getRecommendations(),
        productsApi.getAll({ limit: 500 }),
      ]);
      setRecommendations(recs);
      setProducts(prodData.data.map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
    } catch {
      toast.error('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingForm({
      productId: '',
      prerequisites: [],
      exclusions: [],
      idealMinSize: null,
      idealMaxSize: null,
      idealIndustries: [],
      baseScore: 50,
      triggerSignals: [],
      isActive: true,
    });
    setShowForm(true);
  };

  const openEdit = (rec: ProductRecommendation) => {
    setEditingForm({
      id: rec.id,
      productId: rec.productId,
      prerequisites: rec.prerequisites || [],
      exclusions: rec.exclusions || [],
      idealMinSize: rec.idealMinSize,
      idealMaxSize: rec.idealMaxSize,
      idealIndustries: rec.idealIndustries || [],
      baseScore: rec.baseScore,
      triggerSignals: rec.triggerSignals || [],
      isActive: rec.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editingForm) return;
    if (!editingForm.productId) {
      toast.error('Please select a product');
      return;
    }
    try {
      setSaving(true);
      await customer360Api.saveRecommendation(editingForm);
      toast.success(editingForm.id ? 'Recommendation updated' : 'Recommendation created');
      setShowForm(false);
      setEditingForm(null);
      await loadData();
    } catch {
      toast.error('Failed to save recommendation');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recommendation rule?')) return;
    try {
      await customer360Api.deleteRecommendation(id);
      toast.success('Recommendation deleted');
      setRecommendations(prev => prev.filter(r => r.id !== id));
    } catch {
      toast.error('Failed to delete recommendation');
    }
  };

  const handleToggle = async (rec: ProductRecommendation) => {
    try {
      await customer360Api.saveRecommendation({ ...rec, isActive: !rec.isActive });
      setRecommendations(prev =>
        prev.map(r => r.id === rec.id ? { ...r, isActive: !r.isActive } : r)
      );
    } catch {
      toast.error('Failed to toggle recommendation');
    }
  };

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Product Recommendation Rules</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Configure which products to recommend based on account profile and signals</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Recommendation
        </button>
      </div>

      {/* Recommendation Cards */}
      {recommendations.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center">
          <Package className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">No recommendation rules configured yet</p>
          <button onClick={openNew} className="mt-3 text-purple-600 hover:text-purple-700 text-sm font-medium">
            Create your first rule
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {recommendations.map(rec => (
            <div
              key={rec.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {rec.productName || getProductName(rec.productId)}
                    </span>
                    {rec.productCode && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded-full">
                        {rec.productCode}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      rec.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                    }`}>
                      {rec.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-slate-400 mt-2">
                    {rec.prerequisites?.length > 0 && (
                      <span>Prerequisites: {rec.prerequisites.map(id => getProductName(id)).join(', ')}</span>
                    )}
                    {rec.exclusions?.length > 0 && (
                      <span>Exclusions: {rec.exclusions.map(id => getProductName(id)).join(', ')}</span>
                    )}
                    <span>Base Score: {rec.baseScore}</span>
                    <span>{rec.triggerSignals?.length || 0} Trigger Signal{(rec.triggerSignals?.length || 0) !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(rec)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                    title={rec.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {rec.isActive ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <button
                    onClick={() => openEdit(rec)}
                    className="px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(rec.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && editingForm && (
        <RecommendationFormModal
          form={editingForm}
          products={products}
          saving={saving}
          onUpdate={setEditingForm}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingForm(null); }}
        />
      )}
    </div>
  );
}

// ── Recommendation Form Modal ────────────────────────────────

function RecommendationFormModal({
  form,
  products,
  saving,
  onUpdate,
  onSave,
  onClose,
}: {
  form: RecommendationForm;
  products: ProductOption[];
  saving: boolean;
  onUpdate: (f: RecommendationForm) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const [industryInput, setIndustryInput] = useState('');

  const addIndustry = () => {
    const trimmed = industryInput.trim();
    if (trimmed && !form.idealIndustries.includes(trimmed)) {
      onUpdate({ ...form, idealIndustries: [...form.idealIndustries, trimmed] });
    }
    setIndustryInput('');
  };

  const removeIndustry = (ind: string) => {
    onUpdate({ ...form, idealIndustries: form.idealIndustries.filter(i => i !== ind) });
  };

  const addSignal = () => {
    onUpdate({
      ...form,
      triggerSignals: [...form.triggerSignals, { type: 'renewal_within_days', value: 90, weight: 10 }],
    });
  };

  const updateSignal = (idx: number, updates: Partial<TriggerSignal>) => {
    const signals = [...form.triggerSignals];
    signals[idx] = { ...signals[idx], ...updates };
    onUpdate({ ...form, triggerSignals: signals });
  };

  const removeSignal = (idx: number) => {
    onUpdate({ ...form, triggerSignals: form.triggerSignals.filter((_, i) => i !== idx) });
  };

  const toggleMulti = (field: 'prerequisites' | 'exclusions', id: string) => {
    const current = form[field];
    const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    onUpdate({ ...form, [field]: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {form.id ? 'Edit Recommendation' : 'New Recommendation'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Product */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Product</label>
            <select
              value={form.productId}
              onChange={(e) => onUpdate({ ...form, productId: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select a product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          {/* Prerequisites */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Prerequisites</label>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Account must own these products before this can be recommended</p>
            <MultiProductSelect
              products={products.filter(p => p.id !== form.productId)}
              selected={form.prerequisites}
              onToggle={(id) => toggleMulti('prerequisites', id)}
            />
          </div>

          {/* Exclusions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Exclusions</label>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Do not recommend if account owns any of these</p>
            <MultiProductSelect
              products={products.filter(p => p.id !== form.productId)}
              selected={form.exclusions}
              onToggle={(id) => toggleMulti('exclusions', id)}
            />
          </div>

          {/* Company Size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Min Company Size</label>
              <input
                type="number"
                value={form.idealMinSize ?? ''}
                onChange={(e) => onUpdate({ ...form, idealMinSize: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="No minimum"
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Max Company Size</label>
              <input
                type="number"
                value={form.idealMaxSize ?? ''}
                onChange={(e) => onUpdate({ ...form, idealMaxSize: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="No maximum"
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Industries */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Ideal Industries</label>
            <div className="flex gap-2 mb-2">
              <input
                value={industryInput}
                onChange={(e) => setIndustryInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIndustry(); } }}
                placeholder="Type an industry and press Enter"
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={addIndustry}
                className="px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {form.idealIndustries.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.idealIndustries.map(ind => (
                  <span key={ind} className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-sm">
                    {ind}
                    <button onClick={() => removeIndustry(ind)} className="hover:text-purple-900 dark:hover:text-purple-100">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Base Score */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Base Score: {form.baseScore}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={form.baseScore}
              onChange={(e) => onUpdate({ ...form, baseScore: parseInt(e.target.value) })}
              className="w-full accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500">
              <span>0</span>
              <span>100</span>
            </div>
          </div>

          {/* Trigger Signals */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Trigger Signals</label>
              <button
                onClick={addSignal}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                <Plus className="w-3 h-3" />
                Add Signal
              </button>
            </div>
            {form.triggerSignals.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-slate-500">No trigger signals configured</p>
            ) : (
              <div className="space-y-3">
                {form.triggerSignals.map((signal, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                    <select
                      value={signal.type}
                      onChange={(e) => updateSignal(idx, { type: e.target.value })}
                      className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {SIGNAL_TYPES.map(st => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={signal.value}
                      onChange={(e) => updateSignal(idx, { value: parseFloat(e.target.value) || 0 })}
                      className="w-24 px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Value"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 dark:text-slate-400">Wt:</span>
                      <input
                        type="number"
                        value={signal.weight}
                        onChange={(e) => updateSignal(idx, { weight: parseFloat(e.target.value) || 0 })}
                        className="w-16 px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <button onClick={() => removeSignal(idx)} className="p-1 text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Active</span>
            <button
              onClick={() => onUpdate({ ...form, isActive: !form.isActive })}
              className="transition-colors"
            >
              {form.isActive
                ? <ToggleRight className="w-8 h-8 text-green-500" />
                : <ToggleLeft className="w-8 h-8 text-gray-400" />
              }
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.productId}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Multi Product Select ─────────────────────────────────────

function MultiProductSelect({
  products,
  selected,
  onToggle,
}: {
  products: ProductOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-left text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        <span className={selected.length === 0 ? 'text-gray-400 dark:text-slate-500' : ''}>
          {selected.length === 0 ? 'None selected' : `${selected.length} selected`}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(id => {
            const prod = products.find(p => p.id === id);
            return (
              <span key={id} className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded text-xs">
                {prod?.name || id}
                <button onClick={() => onToggle(id)}><X className="w-3 h-3" /></button>
              </span>
            );
          })}
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg max-h-48 overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-slate-600">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full px-2 py-1.5 bg-gray-50 dark:bg-slate-600 border-0 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-36">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400 dark:text-slate-500">No products found</div>
            ) : (
              filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onToggle(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors ${
                    selected.includes(p.id) ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-slate-300'
                  }`}
                >
                  <input type="checkbox" checked={selected.includes(p.id)} readOnly className="rounded accent-purple-600" />
                  <span>{p.name}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">{p.code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 3: Upcoming Renewals
// ════════════════════════════════════════════════════════════

function RenewalsTab() {
  const [loading, setLoading] = useState(true);
  const [renewals, setRenewals] = useState<RenewalItem[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [days, setDays] = useState(90);

  const loadRenewals = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const result = await customer360Api.getUpcomingRenewals({ days, page, limit: 20 });
      setRenewals(result.data);
      setMeta(result.meta);
    } catch {
      toast.error('Failed to load renewals');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadRenewals(1);
  }, [loadRenewals]);

  const getDaysLeftColor = (daysLeft: number | null) => {
    if (daysLeft === null) return 'text-gray-500 dark:text-slate-400';
    if (daysLeft < 0) return 'text-red-600 dark:text-red-400 font-semibold';
    if (daysLeft < 30) return 'text-red-600 dark:text-red-400';
    if (daysLeft < 90) return 'text-amber-600 dark:text-amber-400';
    return 'text-green-600 dark:text-green-400';
  };

  const formatCurrency = (val: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Renewals</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {meta.total} renewal{meta.total !== 1 ? 's' : ''} within {days} days
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {DAYS_OPTIONS.map(d => (
              <option key={d} value={d}>Next {d} days</option>
            ))}
          </select>
          <button
            onClick={() => loadRenewals(meta.page)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : renewals.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-slate-400">No upcoming renewals in the next {days} days</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Account</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-right">MRR</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Renewal Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-right">Days Left</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-center">Auto-Renew</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {renewals.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.accountLogoUrl ? (
                            <img src={r.accountLogoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-400">
                              {r.accountName?.charAt(0) || '?'}
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[180px]">
                            {r.accountName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{r.productName || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right font-medium">
                        {formatCurrency(r.mrr, r.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">
                        {r.renewalDate ? new Date(r.renewalDate).toLocaleDateString() : '-'}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right ${getDaysLeftColor(r.daysUntilRenewal)}`}>
                        {r.daysUntilRenewal !== null ? (
                          r.daysUntilRenewal < 0 ? `${Math.abs(r.daysUntilRenewal)}d overdue` : `${r.daysUntilRenewal}d`
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.autoRenew ? (
                          <span className="inline-block px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full font-medium">Yes</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-xs rounded-full">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300 truncate max-w-[120px]">
                        {r.ownerName || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Page {meta.page} of {meta.totalPages} ({meta.total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadRenewals(meta.page - 1)}
                    disabled={meta.page <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => loadRenewals(meta.page + 1)}
                    disabled={meta.page >= meta.totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
