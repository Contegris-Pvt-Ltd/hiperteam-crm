import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, MoreHorizontal,
  Mail, Phone, Globe, MapPin,
  Calendar, User, Tag, Linkedin, Twitter,
  Facebook, Instagram, Users, DollarSign, CheckSquare,
  History, MessageSquare, FileText, Activity, Network,
  ChevronDown, ChevronRight, Cake, CreditCard, Building2, Target,
  RefreshCw, Heart, AlertTriangle,
  Shield, Package, CheckCircle, XCircle,
  Plus, Zap,
  BarChart3, Loader2, AlertCircle,
  Briefcase, FolderKanban, Receipt, GitBranch, Copy, Settings2,
  ChevronLeft, X, Send,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { accountsApi } from '../../api/accounts.api';
import type { Account, LinkedContact } from '../../api/accounts.api';
import { customer360Api } from '../../api/customer-360.api';
import { productsApi } from '../../api/products.api';
import type { Subscription, CustomerScores, SubscriptionSummary } from '../../api/customer-360.api';
import type { Activity as ActivityType, AuditLog, Note, Document } from '../../api/contacts.api';
import { uploadApi } from '../../api/upload.api';
import { adminApi } from '../../api/admin.api';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';
import { Timeline } from '../../components/shared/Timeline';
import { ChangeHistory } from '../../components/shared/ChangeHistory';
import { NotesPanel } from '../../components/shared/NotesPanel';
import { DocumentsPanel } from '../../components/shared/DocumentsPanel';
import { AvatarUpload } from '../../components/shared/AvatarUpload';
import { LinkContactModal } from '../../components/shared/LinkContactModal';
import { ProfileCompletion } from '../../components/shared/ProfileCompletion';
import type { ProfileCompletionData } from '../../components/shared/ProfileCompletion';
import { CustomFieldRenderer } from '../../components/shared/CustomFieldRenderer';
import { QuickCreateContactModal } from '../../components/shared/QuickCreateContactModal';
import { EntityTasksPanel } from '../tasks/components/EntityTasksPanel';
import { EntityEmailsTab } from '../email/EntityEmailsTab';
import { AccountEmailMarketingPanel } from '../email-marketing/AccountEmailMarketingPanel';

// ============ PAGE DESIGNER IMPORTS ============
import { useModuleLayout } from '../../hooks/useModuleLayout';
import { DynamicPageRenderer } from '../../components/shared/DynamicPageRenderer';
// ===============================================

// ════════════════════════════════════════════════════════════
// Helper Components (from Customer360)
// ════════════════════════════════════════════════════════════

function ScoreGauge({ value, size = 'lg' }: { value: number; size?: 'sm' | 'lg' }) {
  const color = value >= 70 ? 'text-green-500' : value >= 40 ? 'text-amber-500' : 'text-red-500';
  const sz = size === 'lg' ? 'w-20 h-20' : 'w-12 h-12';
  const textSz = size === 'lg' ? 'text-2xl' : 'text-sm';
  return (
    <div className={`${sz} rounded-full border-4 ${value >= 70 ? 'border-green-200 dark:border-green-900' : value >= 40 ? 'border-amber-200 dark:border-amber-900' : 'border-red-200 dark:border-red-900'} flex items-center justify-center relative`}>
      <span className={`${textSz} font-bold ${color}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    trial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    healthy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    at_risk: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    none: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    won: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    closed: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    new: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    qualified: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    on_hold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${styles[status] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function RenewalBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-gray-400">--</span>;
  if (days < 0) return <span className="text-xs font-medium text-red-600 dark:text-red-400">{Math.abs(days)}d overdue</span>;
  if (days <= 30) return <span className="text-xs font-medium text-red-600 dark:text-red-400">{days}d</span>;
  if (days <= 90) return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{days}d</span>;
  return <span className="text-xs text-green-600 dark:text-green-400">{days}d</span>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 ${className}`}>
      {children}
    </div>
  );
}

function formatCurrency(val: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function formatDate(d: string | null | undefined) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString();
}

function relativeTime(d: string) {
  const now = Date.now();
  const then = new Date(d).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function PaginationControl({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4 text-gray-500" />
      </button>
      <span className="text-sm text-gray-600 dark:text-slate-400">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Revenue Bar Chart
// ════════════════════════════════════════════════════════════

function RevenueBarChart({ accountId, fullWidth = false }: { accountId: string; fullWidth?: boolean }) {
  const [data, setData] = useState<{ month: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await customer360Api.getRevenueTrend(accountId, 12);
        if (!cancelled) setData(Array.isArray(result) ? result : []);
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load revenue trend');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500 py-4 text-center">{error}</p>;
  }

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">No revenue data available.</p>;
  }

  const maxValue = Math.max(...data.map(d => d.amount), 1);
  const chartHeight = fullWidth ? 200 : 140;

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: chartHeight }}>
        {data.map((d, i) => {
          const pct = (d.amount / maxValue) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 dark:bg-slate-600 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none z-10">
                {formatCurrency(d.amount)}
              </div>
              <div
                className="w-full rounded-t-md bg-purple-500 dark:bg-purple-400 transition-all group-hover:bg-purple-600 dark:group-hover:bg-purple-300 min-h-[2px]"
                style={{ height: `${Math.max(pct, 1)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[10px] text-gray-400">{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Customer Journey Map
// ════════════════════════════════════════════════════════════

function CustomerJourneyMap({ accountId }: { accountId: string }) {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await customer360Api.getJourney(accountId);
        if (!cancelled) setMilestones(Array.isArray(result) ? result : (result?.milestones || []));
      } catch {
        if (!cancelled) setMilestones([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
      </div>
    );
  }

  const defaultMilestones = [
    { stage: 'Lead', icon: Users, completed: false, date: null, detail: null },
    { stage: 'Opportunity', icon: Briefcase, completed: false, date: null, detail: null },
    { stage: 'Deal Won', icon: CheckCircle, completed: false, date: null, detail: null },
    { stage: 'Project', icon: FolderKanban, completed: false, date: null, detail: null },
    { stage: 'Go-Live', icon: Zap, completed: false, date: null, detail: null },
    { stage: 'Renewal', icon: RefreshCw, completed: false, date: null, detail: null },
  ];

  const steps = milestones.length > 0
    ? milestones.map((m: any) => ({
        stage: m.stage || m.name,
        completed: !!m.completed || !!m.completedAt || !!m.date,
        date: m.date || m.completedAt || null,
        detail: m.detail || m.description || null,
      }))
    : defaultMilestones;

  const iconMap: Record<string, any> = {
    Lead: Users,
    Opportunity: Briefcase,
    'Deal Won': CheckCircle,
    Deal: CheckCircle,
    Project: FolderKanban,
    'Go-Live': Zap,
    Renewal: RefreshCw,
  };

  return (
    <div className="flex items-start overflow-x-auto py-2 gap-0">
      {steps.map((step: any, i: number) => {
        const Icon = iconMap[step.stage] || GitBranch;
        const isCompleted = step.completed;
        const isLast = i === steps.length - 1;
        return (
          <div key={i} className="flex items-start flex-shrink-0">
            <div className="flex flex-col items-center w-28">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted
                    ? 'bg-purple-100 dark:bg-purple-900/40 border-2 border-purple-500'
                    : 'bg-gray-100 dark:bg-slate-700 border-2 border-dashed border-gray-300 dark:border-slate-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${isCompleted ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-slate-500'}`} />
              </div>
              <span className={`text-xs font-medium mt-2 text-center ${isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'}`}>
                {step.stage}
              </span>
              {step.date && (
                <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                  {formatDate(step.date)}
                </span>
              )}
              {step.detail && (
                <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 text-center line-clamp-2">
                  {step.detail}
                </span>
              )}
            </div>
            {!isLast && (
              <div className="flex items-center mt-5 -mx-1">
                <div className={`w-8 h-0.5 ${isCompleted ? 'bg-purple-400' : 'bg-gray-300 dark:bg-slate-600'} ${!isCompleted ? 'border-t border-dashed border-gray-300 dark:border-slate-600 h-0 bg-transparent' : ''}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Overview Tab Content
// ════════════════════════════════════════════════════════════

function OverviewTabContent({
  scores, subscriptions, accountId, onSwitchTab,
}: {
  scores: CustomerScores | null;
  subscriptions: Subscription[];
  accountId: string;
  onSwitchTab: (tab: TabType) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Customer Journey Map */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-purple-500" /> Customer Journey
        </h3>
        <CustomerJourneyMap accountId={accountId} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Breakdown */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500" /> Health Score Breakdown
          </h3>
          {scores?.healthBreakdown ? (
            <div className="space-y-3">
              {Object.entries(scores.healthBreakdown).map(([key, { score, weight }]) => (
                <div key={key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{score}/100 <span className="text-xs text-gray-400">({weight}%)</span></span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No scores calculated yet. Click Recalculate.</p>
          )}
        </Card>

        {/* Upsell Opportunities */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Upsell Opportunities
          </h3>
          {scores?.upsellSuggestions && scores.upsellSuggestions.length > 0 ? (
            <div className="space-y-3">
              {scores.upsellSuggestions.map((s, i) => (
                <div key={s.productId} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{i + 1}. {s.productName}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      s.score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : s.score >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-slate-600 dark:text-slate-300'
                    }`}>
                      Score: {s.score}
                    </span>
                  </div>
                  <ul className="text-xs text-gray-500 dark:text-slate-400 space-y-0.5">
                    {s.reasons.map((r, j) => <li key={j}>- {r}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No upsell opportunities detected.</p>
          )}
        </Card>
      </div>

      {/* Subscriptions Summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" /> Subscriptions
          </h3>
          <button
            onClick={() => onSwitchTab('subscriptions')}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
          >
            View All &rarr;
          </button>
        </div>
        {subscriptions.length > 0 ? (
          <div className="space-y-2">
            {subscriptions.slice(0, 6).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{s.productName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(s.mrr)}/mo</span>
                  <RenewalBadge days={s.daysUntilRenewal} />
                </div>
              </div>
            ))}
            {subscriptions.length > 6 && (
              <p className="text-xs text-gray-400 text-center pt-1">+{subscriptions.length - 6} more</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No subscriptions yet.</p>
        )}
      </Card>

      {/* Revenue Trend Chart */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-500" /> Revenue Trend (12 Months)
        </h3>
        <RevenueBarChart accountId={accountId} />
      </Card>

      {/* Churn Signals */}
      {scores?.churnSignals && scores.churnSignals.length > 0 && (
        <Card className="p-5 border-amber-200 dark:border-amber-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Churn Signals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {scores.churnSignals.map((s, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  s.severity === 'high' ? 'bg-red-500' : s.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <span className="text-sm text-gray-700 dark:text-slate-300">{s.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Add Subscription Modal
// ════════════════════════════════════════════════════════════

function AddSubscriptionModal({ accountId, onClose, onSaved }: { accountId: string; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const [form, setForm] = useState({
    productId: '',
    productName: '',
    status: 'active' as string,
    billingFrequency: 'monthly' as string,
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    renewalDate: '',
    autoRenew: true,
    notes: '',
  });

  useEffect(() => {
    (async () => {
      setProductsLoading(true);
      try {
        const res = await productsApi.getAll({ limit: 200, status: 'active' });
        setProducts(Array.isArray(res) ? res : (res?.data || []));
      } catch {
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    })();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const q = productSearch.toLowerCase();
    return products.filter((p: any) =>
      (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const handleSelectProduct = (p: any) => {
    setForm(prev => ({ ...prev, productId: p.id, productName: p.name, unitPrice: p.basePrice || 0 }));
    setProductSearch(p.name);
    setShowProductDropdown(false);
  };

  const handleSave = async () => {
    if (!form.productId) {
      setError('Please select a product');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await customer360Api.createSubscription(accountId, {
        productId: form.productId,
        status: form.status as any,
        billingFrequency: form.billingFrequency,
        quantity: form.quantity,
        unitPrice: form.unitPrice,
        discountPercent: form.discountPercent,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        renewalDate: form.renewalDate || null,
        autoRenew: form.autoRenew,
        notes: form.notes || null,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create subscription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Subscription</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Product */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Product *</label>
            <input
              type="text"
              value={productSearch}
              onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
              onFocus={() => setShowProductDropdown(true)}
              placeholder={productsLoading ? 'Loading products...' : 'Search products...'}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {showProductDropdown && filteredProducts.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredProducts.slice(0, 20).map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-900 dark:text-white"
                  >
                    {p.name} {p.code ? <span className="text-gray-400 ml-1">({p.code})</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status + Billing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Billing Frequency</label>
              <select
                value={form.billingFrequency}
                onChange={e => setForm(prev => ({ ...prev, billingFrequency: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semi_annual">Semi-Annual</option>
                <option value="annual">Annual</option>
                <option value="one_time">One-Time</option>
              </select>
            </div>
          </div>

          {/* Quantity + Unit Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={e => setForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Unit Price</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.unitPrice}
                onChange={e => setForm(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Discount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Discount %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.discountPercent}
              onChange={e => setForm(prev => ({ ...prev, discountPercent: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Renewal Date</label>
              <input
                type="date"
                value={form.renewalDate}
                onChange={e => setForm(prev => ({ ...prev, renewalDate: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Auto-Renew */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoRenew}
                onChange={e => setForm(prev => ({ ...prev, autoRenew: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-500 peer-checked:bg-purple-600" />
            </label>
            <span className="text-sm text-gray-700 dark:text-slate-300">Auto-Renew</span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Add Subscription'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Usage Source Configure Modal
// ════════════════════════════════════════════════════════════

function UsageSourceModal({
  accountId,
  productId,
  productName,
  onClose,
}: {
  accountId: string;
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [sourceType, setSourceType] = useState<'manual' | 'pull_api' | 'push_webhook'>('manual');
  const [apiUrl, setApiUrl] = useState('');
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiHeaders, setApiHeaders] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
  const [pollInterval, setPollInterval] = useState('daily');
  const [metricMappings, setMetricMappings] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
  const [webhookKey, setWebhookKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const source = await customer360Api.getUsageSource(accountId, productId);
        if (source) {
          setSourceType(source.sourceType);
          setApiUrl(source.apiUrl || '');
          setApiMethod(source.apiMethod || 'GET');
          setWebhookKey(source.webhookKey || null);
          setPollInterval(source.pollInterval || 'daily');

          const hdrs = source.apiHeaders ? Object.entries(source.apiHeaders) : [];
          setApiHeaders(hdrs.length > 0 ? hdrs.map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }]);

          const maps = source.metricMappings ? Object.entries(source.metricMappings) : [];
          setMetricMappings(maps.length > 0 ? maps.map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }]);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [accountId, productId]);

  const webhookUrl = webhookKey
    ? `${window.location.origin}/api/customer-360/webhook/${webhookKey}`
    : 'Save to generate webhook URL';

  const handleCopy = () => {
    if (webhookKey) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const addHeader = () => setApiHeaders(prev => [...prev, { key: '', value: '' }]);
  const removeHeader = (i: number) => setApiHeaders(prev => prev.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) => {
    setApiHeaders(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: val } : h));
  };

  const addMapping = () => setMetricMappings(prev => [...prev, { key: '', value: '' }]);
  const removeMapping = (i: number) => setMetricMappings(prev => prev.filter((_, idx) => idx !== i));
  const updateMapping = (i: number, field: 'key' | 'value', val: string) => {
    setMetricMappings(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const headersObj: Record<string, string> = {};
      apiHeaders.forEach(h => { if (h.key.trim()) headersObj[h.key.trim()] = h.value; });

      const mappingsObj: Record<string, string> = {};
      metricMappings.forEach(m => { if (m.key.trim()) mappingsObj[m.key.trim()] = m.value; });

      const result = await customer360Api.saveUsageSource(accountId, productId, {
        sourceType,
        apiUrl: sourceType === 'pull_api' ? apiUrl : null,
        apiMethod: sourceType === 'pull_api' ? apiMethod : 'GET',
        apiHeaders: sourceType === 'pull_api' ? headersObj : {},
        metricMappings: sourceType === 'pull_api' ? mappingsObj : {},
        pollInterval: sourceType === 'pull_api' ? pollInterval : 'daily',
        isActive: true,
      });
      if (result.webhookKey) setWebhookKey(result.webhookKey);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Configure Usage Source</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{productName}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Source Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Source Type</label>
              <select
                value={sourceType}
                onChange={e => setSourceType(e.target.value as any)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
              >
                <option value="manual">Manual</option>
                <option value="pull_api">Pull API</option>
                <option value="push_webhook">Push Webhook</option>
              </select>
            </div>

            {/* Pull API fields */}
            {sourceType === 'pull_api' && (
              <>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">URL</label>
                    <input
                      type="url"
                      value={apiUrl}
                      onChange={e => setApiUrl(e.target.value)}
                      placeholder="https://api.example.com/usage"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Method</label>
                    <select
                      value={apiMethod}
                      onChange={e => setApiMethod(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>
                </div>

                {/* Headers */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Headers</label>
                    <button onClick={addHeader} className="text-xs text-purple-600 dark:text-purple-400 hover:underline">+ Add</button>
                  </div>
                  <div className="space-y-2">
                    {apiHeaders.map((h, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          value={h.key}
                          onChange={e => updateHeader(i, 'key', e.target.value)}
                          placeholder="Key"
                          className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={h.value}
                          onChange={e => updateHeader(i, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-900 dark:text-white"
                        />
                        {apiHeaders.length > 1 && (
                          <button onClick={() => removeHeader(i)} className="text-red-400 hover:text-red-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Poll Interval */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Poll Interval</label>
                  <select
                    value={pollInterval}
                    onChange={e => setPollInterval(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-900 dark:text-white"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                {/* Metric Mappings */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Metric Mappings</label>
                    <button onClick={addMapping} className="text-xs text-purple-600 dark:text-purple-400 hover:underline">+ Add</button>
                  </div>
                  <div className="space-y-2">
                    {metricMappings.map((m, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          value={m.key}
                          onChange={e => updateMapping(i, 'key', e.target.value)}
                          placeholder="metricKey"
                          className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={m.value}
                          onChange={e => updateMapping(i, 'value', e.target.value)}
                          placeholder="$.data.usage"
                          className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-900 dark:text-white"
                        />
                        {metricMappings.length > 1 && (
                          <button onClick={() => removeMapping(i)} className="text-red-400 hover:text-red-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Push Webhook fields */}
            {sourceType === 'push_webhook' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-xs text-gray-600 dark:text-slate-300 select-all"
                  />
                  <button
                    onClick={handleCopy}
                    disabled={!webhookKey}
                    className="px-3 py-2 bg-gray-100 dark:bg-slate-600 hover:bg-gray-200 dark:hover:bg-slate-500 rounded-xl text-sm disabled:opacity-40 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {!webhookKey && (
                  <p className="text-xs text-amber-500 mt-1">Save to generate a webhook URL.</p>
                )}
              </div>
            )}
          </div>
        )}

        {!loading && (
          <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 dark:border-slate-700">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Subscriptions Tab Content
// ════════════════════════════════════════════════════════════

function SubscriptionsTabContent({
  subscriptions, summary, onRefresh, accountId,
}: {
  subscriptions: Subscription[];
  summary: SubscriptionSummary | null;
  onRefresh: () => void;
  accountId: string;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [usageSourceModal, setUsageSourceModal] = useState<{ productId: string; productName: string } | null>(null);

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Active', value: summary.activeCount, color: 'text-green-600' },
            { label: 'Trial', value: summary.trialCount, color: 'text-blue-600' },
            { label: 'MRR', value: formatCurrency(summary.totalMrr), color: 'text-gray-900 dark:text-white' },
            { label: 'ARR', value: formatCurrency(summary.totalArr), color: 'text-gray-900 dark:text-white' },
            { label: 'Renewals (90d)', value: summary.renewalsIn90Days, color: summary.renewalsIn90Days > 0 ? 'text-amber-600' : 'text-gray-400' },
          ].map((s, i) => (
            <Card key={i} className="p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Add Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" /> Add Subscription
        </button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">MRR</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Renewal</th>
                <th className="px-4 py-3">Auto</th>
                <th className="px-4 py-3">Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {subscriptions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{s.productName || 'Unknown'}</span>
                      {s.productCode && <span className="text-xs text-gray-400 ml-2">{s.productCode}</span>}
                      {s.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.notes}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(s.mrr)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{s.billingFrequency}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                    {s.startDate ? new Date(s.startDate).toLocaleDateString() : '--'}
                  </td>
                  <td className="px-4 py-3"><RenewalBadge days={s.daysUntilRenewal} /></td>
                  <td className="px-4 py-3">
                    {s.autoRenew ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {s.usageSourceType ? (
                        <span className="text-xs text-green-600 dark:text-green-400">{s.usageSourceType}</span>
                      ) : (
                        <span className="text-xs text-gray-400">Not configured</span>
                      )}
                      <button
                        onClick={() => setUsageSourceModal({ productId: s.productId, productName: s.productName || 'Unknown' })}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
                      >
                        <Settings2 className="w-3 h-3" /> Configure
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No subscriptions. Click &quot;Add Subscription&quot; to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showAddModal && (
        <AddSubscriptionModal
          accountId={accountId}
          onClose={() => setShowAddModal(false)}
          onSaved={onRefresh}
        />
      )}

      {usageSourceModal && (
        <UsageSourceModal
          accountId={accountId}
          productId={usageSourceModal.productId}
          productName={usageSourceModal.productName}
          onClose={() => setUsageSourceModal(null)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Leads Tab Content
// ════════════════════════════════════════════════════════════

function LeadsTabContent({ accountId }: { accountId: string }) {
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; totalPages: number }>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await customer360Api.getAccountLeads(accountId, { page, limit: 20 });
      setData(result?.data || (Array.isArray(result) ? result : []));
      if (result?.meta) setMeta(result.meta);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [accountId, page]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">{error}</p>
        <button onClick={load} className="mt-3 px-4 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700">Retry</button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Users className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400 text-sm">No leads associated with this account</p>
      </Card>
    );
  }

  return (
    <div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data.map((lead: any) => (
                <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <Link to={`/leads/${lead.id}`} className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline">
                      {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || '--'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{lead.email || '--'}</td>
                  <td className="px-4 py-3">
                    {lead.stageName ? <StatusBadge status={lead.stageName} /> : <span className="text-xs text-gray-400">--</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{lead.ownerName || '--'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{formatDate(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <PaginationControl page={meta.page || page} totalPages={meta.totalPages || 0} onPageChange={setPage} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Opportunities Tab Content
// ════════════════════════════════════════════════════════════

function OpportunitiesTabContent({ accountId }: { accountId: string }) {
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; totalPages: number }>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await customer360Api.getAccountOpportunities(accountId, { page, limit: 20 });
      setData(result?.data || (Array.isArray(result) ? result : []));
      if (result?.meta) setMeta(result.meta);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }, [accountId, page]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">{error}</p>
        <button onClick={load} className="mt-3 px-4 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700">Retry</button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Briefcase className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400 text-sm">No opportunities associated with this account</p>
      </Card>
    );
  }

  return (
    <div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Probability</th>
                <th className="px-4 py-3">Close Date</th>
                <th className="px-4 py-3">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data.map((opp: any) => {
                const isWon = opp.stageName?.toLowerCase().includes('won') || opp.isWon;
                const isLost = opp.stageName?.toLowerCase().includes('lost') || opp.isLost;
                return (
                  <tr key={opp.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isWon && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                        {isLost && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        <Link to={`/opportunities/${opp.id}`} className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline">
                          {opp.name || '--'}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {opp.amount != null ? formatCurrency(opp.amount, opp.currency || 'USD') : '--'}
                    </td>
                    <td className="px-4 py-3">
                      {opp.stageName ? <StatusBadge status={opp.stageName} /> : <span className="text-xs text-gray-400">--</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                      {opp.probability != null ? `${opp.probability}%` : '--'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{formatDate(opp.closeDate || opp.expectedCloseDate)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{opp.ownerName || '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <PaginationControl page={meta.page || page} totalPages={meta.totalPages || 0} onPageChange={setPage} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Projects Tab Content
// ════════════════════════════════════════════════════════════

function ProjectsTabContent({ accountId }: { accountId: string }) {
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; totalPages: number }>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await customer360Api.getAccountProjects(accountId, { page, limit: 20 });
      setData(result?.data || (Array.isArray(result) ? result : []));
      if (result?.meta) setMeta(result.meta);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [accountId, page]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">{error}</p>
        <button onClick={load} className="mt-3 px-4 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700">Retry</button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FolderKanban className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400 text-sm">No projects associated with this account</p>
      </Card>
    );
  }

  const healthColors: Record<string, string> = {
    green: 'bg-green-500',
    yellow: 'bg-amber-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    healthy: 'bg-green-500',
    at_risk: 'bg-amber-500',
    critical: 'bg-red-500',
  };

  return (
    <div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {data.map((proj: any) => {
                const totalTasks = (proj.completedTasks || 0) + (proj.pendingTasks || 0);
                const progress = totalTasks > 0 ? Math.round(((proj.completedTasks || 0) / totalTasks) * 100) : 0;
                return (
                  <tr key={proj.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <Link to={`/projects/${proj.id}`} className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline">
                        {proj.name || '--'}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {proj.status ? <StatusBadge status={proj.status} /> : <span className="text-xs text-gray-400">--</span>}
                    </td>
                    <td className="px-4 py-3">
                      {proj.health ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${healthColors[proj.health] || 'bg-gray-400'}`} />
                          <span className="text-xs text-gray-600 dark:text-slate-400 capitalize">{proj.health.replace(/_/g, ' ')}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 dark:bg-slate-600 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          {proj.completedTasks || 0}/{totalTasks}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                      {proj.budget != null ? formatCurrency(proj.budget) : '--'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{proj.ownerName || '--'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{formatDate(proj.dueDate || proj.endDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <PaginationControl page={meta.page || page} totalPages={meta.totalPages || 0} onPageChange={setPage} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Financials Tab Content
// ════════════════════════════════════════════════════════════

function FinancialsTabContent({ accountId }: { accountId: string }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; totalPages: number }>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await customer360Api.getAccountInvoices(accountId, { page, limit: 20 });
      setInvoices(result?.data || (Array.isArray(result) ? result : []));
      if (result?.meta) setMeta(result.meta);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [accountId, page]);

  useEffect(() => { load(); }, [load]);

  const summaryCards = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum: number, inv: any) => sum + (inv.total || inv.amount || 0), 0);
    const totalPaid = invoices.reduce((sum: number, inv: any) => sum + (inv.paidAmount || inv.paid || 0), 0);
    const outstanding = totalInvoiced - totalPaid;
    const overdue = invoices
      .filter((inv: any) => {
        const isOverdue = inv.status === 'overdue' || (inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'paid');
        return isOverdue;
      })
      .reduce((sum: number, inv: any) => sum + ((inv.total || inv.amount || 0) - (inv.paidAmount || inv.paid || 0)), 0);
    return [
      { label: 'Total Invoiced', value: formatCurrency(totalInvoiced), color: 'text-gray-900 dark:text-white' },
      { label: 'Total Paid', value: formatCurrency(totalPaid), color: 'text-green-600' },
      { label: 'Outstanding', value: formatCurrency(outstanding), color: outstanding > 0 ? 'text-amber-600' : 'text-gray-400' },
      { label: 'Overdue', value: formatCurrency(overdue), color: overdue > 0 ? 'text-red-600' : 'text-gray-400' },
    ];
  }, [invoices]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">{error}</p>
        <button onClick={load} className="mt-3 px-4 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue Chart */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-500" /> Revenue Trend (12 Months)
        </h3>
        <RevenueBarChart accountId={accountId} fullWidth />
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((c, i) => (
          <Card key={i} className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-slate-400">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      {/* Invoice Table */}
      {invoices.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700/50 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {invoices.map((inv: any) => {
                  const total = inv.total || inv.amount || 0;
                  const paid = inv.paidAmount || inv.paid || 0;
                  const due = total - paid;
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {inv.invoiceNumber || inv.number || '--'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{inv.title || inv.description || '--'}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status || 'draft'} /></td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(total)}</td>
                      <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400">{formatCurrency(paid)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{formatCurrency(due)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{formatDate(inv.issueDate || inv.createdAt)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{formatDate(inv.dueDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Receipt className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">No invoices found for this account</p>
        </Card>
      )}

      <PaginationControl page={meta.page || page} totalPages={meta.totalPages || 0} onPageChange={setPage} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Timeline Tab Content (from Customer360)
// ════════════════════════════════════════════════════════════

const timelineTypeConfig: Record<string, { color: string; bgColor: string; icon: any }> = {
  lead: { color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: Users },
  opportunity: { color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: Briefcase },
  invoice: { color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: Receipt },
  project: { color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30', icon: FolderKanban },
  email: { color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700', icon: Mail },
  task: { color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: FileText },
  subscription: { color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-100 dark:bg-teal-900/30', icon: Package },
  note: { color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700', icon: FileText },
  activity: { color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30', icon: Activity },
};

function TimelineTabContent({ accountId }: { accountId: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'lead', label: 'Leads' },
    { key: 'opportunity', label: 'Opportunities' },
    { key: 'invoice', label: 'Invoices' },
    { key: 'project', label: 'Projects' },
  ];

  const loadEntries = useCallback(async (pageNum: number, append: boolean) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const filterParam = filter !== 'all' ? filter : undefined;
      const result = await customer360Api.getTimeline(accountId, { page: pageNum, limit: 20, filter: filterParam });
      const items = result?.data || (Array.isArray(result) ? result : []);
      if (append) {
        setEntries(prev => [...prev, ...items]);
      } else {
        setEntries(items);
      }
      const totalPages = result?.meta?.totalPages || 1;
      setHasMore(pageNum < totalPages);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load timeline');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [accountId, filter]);

  useEffect(() => {
    setPage(1);
    setEntries([]);
    loadEntries(1, false);
  }, [loadEntries]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadEntries(nextPage, true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-slate-400">{error}</p>
        <button onClick={() => loadEntries(1, false)} className="mt-3 px-4 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${
              filter === f.key
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card className="p-12 text-center">
          <Activity className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">No timeline entries found</p>
        </Card>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-700" />

          <div className="space-y-4">
            {entries.map((entry: any, i: number) => {
              const typeKey = (entry.type || entry.entityType || 'activity').toLowerCase();
              const config = timelineTypeConfig[typeKey] || timelineTypeConfig.activity;
              const Icon = config.icon;
              return (
                <div key={entry.id || i} className="relative flex gap-4 pl-0">
                  {/* Icon */}
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor}`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  {/* Content */}
                  <Card className="flex-1 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.title || entry.action || '--'}</p>
                        {entry.description && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{entry.description}</p>
                        )}
                        {entry.performedBy && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">by {entry.performedBy}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                          {typeKey}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">
                          {entry.createdAt || entry.date ? relativeTime(entry.createdAt || entry.date) : ''}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center mt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab Type Definition
// ════════════════════════════════════════════════════════════

type TabType = 'overview' | 'subscriptions' | 'leads' | 'opportunities' | 'projects' | 'financials' | 'contacts' | 'emails' | 'tasks' | 'notes' | 'documents' | 'timeline' | 'history' | 'children' | 'email_marketing';

// ════════════════════════════════════════════════════════════
// Main Page Component
// ════════════════════════════════════════════════════════════

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLinkContactModal, setShowLinkContactModal] = useState(false);
  const [showQuickCreateContact, setShowQuickCreateContact] = useState(false);

  // Tab data (from original AccountDetailPage)
  const [activities] = useState<ActivityType[]>([]);
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [childAccounts, setChildAccounts] = useState<Account[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Custom fields config
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomFieldGroup[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Customer 360 data
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [scores, setScores] = useState<CustomerScores | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [, setC360Error] = useState<string | null>(null);

  // ============ ADMIN-CONTROLLED LAYOUT ============
  const {
    useCustomLayout,
    loading: layoutLoading,
  } = useModuleLayout('accounts', 'detail');
  // =================================================

  // Fetch custom fields config
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

  // Fetch account + customer 360 data
  const fetchAllData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setC360Error(null);
    try {
      const [acc, subs, sum, sc] = await Promise.all([
        accountsApi.getOne(id),
        customer360Api.getSubscriptions(id).catch(() => [] as Subscription[]),
        customer360Api.getSubscriptionSummary(id).catch(() => null),
        customer360Api.getScores(id).catch(() => null),
      ]);
      setAccount(acc);
      setSubscriptions(subs);
      setSummary(sum);
      setScores(sc);
    } catch (error: any) {
      console.error('Failed to fetch account:', error);
      setC360Error(error.response?.data?.message || error.message || 'Failed to load');
      // Try to at least load the account
      try {
        const acc = await accountsApi.getOne(id);
        setAccount(acc);
      } catch {
        navigate('/accounts');
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Fetch tab-specific data for tabs that need it
  useEffect(() => {
    if (!account || !id) return;

    const fetchTabData = async () => {
      setTabLoading(true);
      try {
        switch (activeTab) {
          case 'notes': {
            const notesData = await accountsApi.getNotes(id);
            setNotes(notesData);
            break;
          }
          case 'documents': {
            const docsData = await accountsApi.getDocuments(id);
            setDocuments(docsData);
            break;
          }
          case 'contacts': {
            const contactsData = await accountsApi.getContacts(id);
            setLinkedContacts(contactsData);
            break;
          }
          case 'children': {
            const childrenData = await accountsApi.getChildAccounts(id);
            setChildAccounts(childrenData);
            break;
          }
          case 'history': {
            const historyData = await accountsApi.getHistory(id);
            setHistory(historyData);
            break;
          }
        }
      } catch (error) {
        console.error('Failed to fetch tab data:', error);
      } finally {
        setTabLoading(false);
      }
    };

    // Only fetch for tabs that need API calls from accountsApi
    if (['notes', 'documents', 'contacts', 'children', 'history'].includes(activeTab)) {
      fetchTabData();
    }
  }, [activeTab, account, id]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await accountsApi.delete(id);
      navigate('/accounts');
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleLogoUpload = async (file: File): Promise<string> => {
    if (!id) throw new Error('No account ID');
    const result = await uploadApi.uploadAvatar('accounts', id, file);
    const freshUrl = `${result.url}?v=${Date.now()}`;
    await accountsApi.update(id, { logoUrl: freshUrl });
    setAccount(prev => prev ? { ...prev, logoUrl: freshUrl } : null);
    return freshUrl;
  };

  const handleAddNote = async (content: string) => {
    if (!id) return;
    const note = await accountsApi.createNote(id, content);
    setNotes(prev => [note, ...prev]);
  };

  const handleLinkContact = async (contactId: string, role: string, isPrimary: boolean) => {
    if (!id) return;
    await accountsApi.linkContact(id, contactId, role, isPrimary);
    const contactsData = await accountsApi.getContacts(id);
    setLinkedContacts(contactsData);
  };

  const handleUnlinkContact = async (contactId: string) => {
    if (!id) return;
    await accountsApi.unlinkContact(id, contactId);
    setLinkedContacts(prev => prev.filter(c => c.id !== contactId));
  };

  const handleQuickContactCreated = async () => {
    if (!id) return;
    try {
      const contactsData = await accountsApi.getContacts(id);
      setLinkedContacts(contactsData);
    } catch (err) {
      console.error('Failed to refresh contacts:', err);
    }
  };

  const handleRecalculate = async () => {
    if (!id) return;
    setRecalculating(true);
    try {
      const newScores = await customer360Api.recalculateScores(id);
      setScores(newScores);
    } catch { /* ignore */ }
    setRecalculating(false);
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

  // Helper to check if a section has any values
  const sectionHasValues = (section: string, tabId?: string) => {
    const customFieldValues = account?.customFields as Record<string, unknown> || {};
    const sectionFields = customFields.filter(f => {
      if (tabId) return f.tabId === tabId;
      return f.section === section && !f.tabId;
    });
    return sectionFields.some(f => {
      const val = customFieldValues[f.fieldKey];
      return val !== undefined && val !== null && val !== '';
    });
  };

  // Render custom fields for a section or tab
  const renderCustomFields = (section: string, tabId?: string) => {
    const customFieldValues = account?.customFields as Record<string, unknown> || {};

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
    const ungroupedWithValues = ungroupedFields.filter(f => {
      const val = customFieldValues[f.fieldKey];
      return val !== undefined && val !== null && val !== '';
    });

    return (
      <div className="space-y-4">
        {/* Grouped fields */}
        {sectionGroups.map(group => {
          const groupFields = sectionFields.filter(f => f.groupId === group.id);
          const groupFieldsWithValues = groupFields.filter(f => {
            const val = customFieldValues[f.fieldKey];
            return val !== undefined && val !== null && val !== '';
          });

          if (groupFieldsWithValues.length === 0) return null;

          const isCollapsed = collapsedGroups.has(group.id);

          return (
            <div key={group.id} className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{group.name}</span>
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {!isCollapsed && (
                <div className="p-4 space-y-2">
                  {groupFieldsWithValues
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map(field => (
                      <div key={field.id} className="flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-500 dark:text-slate-400">{field.fieldLabel}</span>
                        <span className="text-sm text-gray-900 dark:text-white text-right">
                          <CustomFieldRenderer
                            field={field}
                            value={customFieldValues[field.fieldKey]}
                            onChange={() => {}}
                            allFields={customFields}
                            allValues={customFieldValues}
                          />
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped fields */}
        {ungroupedWithValues.length > 0 && (
          <div className="space-y-2">
            {ungroupedWithValues
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map(field => (
                <div key={field.id} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-500 dark:text-slate-400">{field.fieldLabel}</span>
                  <span className="text-sm text-gray-900 dark:text-white text-right">
                    <CustomFieldRenderer
                      field={field}
                      value={customFieldValues[field.fieldKey]}
                      onChange={() => {}}
                      allFields={customFields}
                      allValues={customFieldValues}
                    />
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  if (loading || layoutLoading || !account) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ============ CUSTOM LAYOUT RENDERING ============
  if (useCustomLayout) {
    return (
      <div className="animate-fadeIn">
        {/* Header - always shown even with custom layout */}
        <div className="mb-6">
          <Link
            to="/accounts"
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Accounts
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <AvatarUpload
                currentUrl={account.logoUrl}
                onUpload={handleLogoUpload}
                name={account.name}
                type="account"
                size="lg"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {account.accountClassification === 'individual' && account.firstName
                    ? `${account.firstName} ${account.lastName || ''}`
                    : account.name}
                </h1>
                {account.accountClassification === 'individual' ? (
                  account.accountType && (
                    <p className="text-lg text-gray-600 dark:text-slate-400 capitalize">{account.accountType}</p>
                  )
                ) : (
                  account.industry && (
                    <p className="text-lg text-gray-600 dark:text-slate-400">{account.industry}</p>
                  )
                )}
                {account.website && (
                  <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1">
                    <Globe className="w-4 h-4" />
                    {(() => { try { return new URL(account.website.startsWith('http') ? account.website : `https://${account.website}`).hostname; } catch { return account.website; } })()}
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(`/accounts/${id}/edit`)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all">
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="p-2.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Page Renderer */}
        <DynamicPageRenderer
          module="accounts"
          layoutType="detail"
          recordId={account.id}
          data={account as unknown as Record<string, unknown>}
          customFields={customFields}
          tabs={customTabs}
          groups={customGroups}
          profileCompletionRenderer={() =>
            account.profileCompletion ? (
              <ProfileCompletion completion={account.profileCompletion as ProfileCompletionData} />
            ) : null
          }
          relatedRecordsRenderer={(_relatedModule, maxItems) => (
            <div className="space-y-2">
              {linkedContacts.slice(0, maxItems || 5).map(contact => (
                <Link key={contact.id} to={`/contacts/${contact.id}`} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  {contact.avatarUrl ? (
                    <img src={contact.avatarUrl} alt={`${contact.firstName} ${contact.lastName}`} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {contact.firstName[0]}{contact.lastName[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{contact.firstName} {contact.lastName}</p>
                    {contact.jobTitle && <p className="text-sm text-gray-500 dark:text-slate-400">{contact.jobTitle}</p>}
                  </div>
                  {contact.isPrimary && (
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">Primary</span>
                  )}
                </Link>
              ))}
              {linkedContacts.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">No linked contacts</p>
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
              entityType="accounts"
              entityId={id!}
              onDocumentUploaded={(doc) => setDocuments(prev => [doc, ...prev])}
              onDocumentDeleted={async (docId) => setDocuments(prev => prev.filter(d => d.id !== docId))}
            />
          )}
          notesRenderer={() => (
            <NotesPanel notes={notes} loading={tabLoading} onAddNote={handleAddNote} />
          )}
        />

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Account</h3>
              <p className="text-gray-500 dark:text-slate-400 mb-6">
                Are you sure you want to delete &quot;{account.name}&quot;? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800">Cancel</button>
                <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Link Contact Modal */}
        <LinkContactModal
          isOpen={showLinkContactModal}
          onClose={() => setShowLinkContactModal(false)}
          onLink={handleLinkContact}
          existingContactIds={linkedContacts.map(c => c.id)}
        />
      </div>
    );
  }

  // ============ DEFAULT LAYOUT RENDERING ============

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'subscriptions', label: 'Subscriptions', icon: <Package className="w-4 h-4" />, count: subscriptions.length },
    { id: 'leads', label: 'Leads', icon: <Target className="w-4 h-4" /> },
    { id: 'opportunities', label: 'Opportunities', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4" /> },
    { id: 'financials', label: 'Financials', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'contacts', label: 'Contacts', icon: <Users className="w-4 h-4" />, count: account.contactsCount },
    { id: 'emails', label: 'Emails', icon: <Mail className="w-4 h-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
    { id: 'children', label: 'Sub-accounts', icon: <Network className="w-4 h-4" /> },
    { id: 'email_marketing', label: 'Email Marketing', icon: <Send className="w-4 h-4" /> },
  ];

  const primaryEmail = account.emails?.find(e => e.primary) || account.emails?.[0];
  const primaryPhone = account.phones?.find(p => p.primary) || account.phones?.[0];
  const primaryAddress = account.addresses?.find(a => a.primary) || account.addresses?.[0];

  const formatRevenue = (amount: number) => {
    if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  // Check which custom sections have values
  const hasCustomSectionFields = sectionHasValues('custom');
  const customTabsWithValues = customTabs.filter(tab => sectionHasValues('', tab.id));

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/accounts"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Accounts
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <AvatarUpload
              currentUrl={account.logoUrl}
              onUpload={handleLogoUpload}
              name={account.name}
              type="account"
              size="lg"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {account.name}
              </h1>
              {account.industry && (
                <p className="text-lg text-gray-600 dark:text-slate-400">{account.industry}</p>
              )}
              {account.website && (
                <a
                  href={account.website.startsWith('http') ? account.website : `https://${account.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
                >
                  <Globe className="w-4 h-4" />
                  {(() => { try { return new URL(account.website.startsWith('http') ? account.website : `https://${account.website}`).hostname; } catch { return account.website; } })()}
                </a>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                  account.accountType === 'customer'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : account.accountType === 'prospect'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                }`}>
                  {account.accountType}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                  account.accountClassification === 'individual'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {account.accountClassification === 'individual' ? (
                    <><User className="w-3 h-3" /> Individual</>
                  ) : (
                    <><Building2 className="w-3 h-3" /> Business</>
                  )}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                  account.status === 'active'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                }`}>
                  {account.status}
                </span>
                {account.tags?.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-lg text-xs">
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex items-center gap-2 px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
              {recalculating ? 'Calculating...' : 'Recalculate'}
            </button>
            <button
              onClick={() => navigate(`/accounts/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all"
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

      {/* Score Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Health</span>
            <Heart className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex items-center gap-3">
            <ScoreGauge value={scores?.healthScore || 0} size="sm" />
            <div>
              <StatusBadge status={scores?.healthStatus || 'unknown'} />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Revenue</span>
            <DollarSign className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(summary?.totalMrr || 0)}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">MRR  {formatCurrency(summary?.totalArr || 0)} ARR</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Churn Risk</span>
            <Shield className="w-4 h-4 text-gray-400" />
          </div>
          <div className="mt-1">
            <StatusBadge status={scores?.churnRisk || 'unknown'} />
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{scores?.churnSignals?.length || 0} signal(s)</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">CLTV</span>
            <Target className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(scores?.cltv || 0)}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{scores?.upsellSuggestions?.length || 0} upsell opportunities</p>
        </Card>
      </div>

      {/* Main Content: Sidebar + Tabs */}
      <div className="flex gap-6">
        {/* Left Sidebar */}
        <div className="w-[300px] flex-shrink-0 space-y-6 hidden lg:block">
          {/* Company Info Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
              {account.accountClassification === 'individual' ? 'Personal Details' : 'Company Details'}
            </h3>
            <div className="space-y-3 text-sm">
              {primaryEmail && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={`mailto:${primaryEmail.email}`} className="text-blue-600 dark:text-blue-400 hover:underline truncate">
                    {primaryEmail.email}
                  </a>
                </div>
              )}
              {primaryPhone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={`tel:${primaryPhone.number}`} className="text-gray-900 dark:text-white hover:text-blue-600">
                    {primaryPhone.number}
                  </a>
                </div>
              )}
              {account.website && (
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                  <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate">
                    {account.website}
                  </a>
                </div>
              )}
              {primaryAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span className="text-gray-900 dark:text-white">
                    {[primaryAddress.line1, primaryAddress.city, primaryAddress.state, primaryAddress.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}

              {/* B2C Individual-specific fields */}
              {account.accountClassification === 'individual' && (
                <>
                  {account.dateOfBirth && (
                    <div className="flex items-center gap-3">
                      <Cake className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-900 dark:text-white">
                        {new Date(account.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {account.gender && (
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-900 dark:text-white capitalize">
                        {account.gender.replace(/-/g, ' ')}
                      </span>
                    </div>
                  )}
                  {account.nationalId && (
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-gray-900 dark:text-white">{account.nationalId}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Financial Info */}
          {account.accountClassification !== 'individual' && (account.annualRevenue || account.companySize) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Financial Info
              </h3>
              <div className="space-y-3 text-sm">
                {account.annualRevenue && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-slate-400 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Revenue
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">{formatRevenue(account.annualRevenue)}</span>
                  </div>
                )}
                {account.companySize && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-slate-400 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Size
                    </span>
                    <span className="text-gray-900 dark:text-white">{account.companySize} employees</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Social Profiles */}
          {account.socialProfiles && Object.values(account.socialProfiles).some(v => v) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Social
              </h3>
              <div className="space-y-3">
                {account.socialProfiles.linkedin && (
                  <a href={account.socialProfiles.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </a>
                )}
                {account.socialProfiles.twitter && (
                  <a href={account.socialProfiles.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <Twitter className="w-4 h-4" /> Twitter
                  </a>
                )}
                {account.socialProfiles.facebook && (
                  <a href={account.socialProfiles.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <Facebook className="w-4 h-4" /> Facebook
                  </a>
                )}
                {account.socialProfiles.instagram && (
                  <a href={account.socialProfiles.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <Instagram className="w-4 h-4" /> Instagram
                  </a>
                )}
              </div>

              {/* Custom fields for social section */}
              {sectionHasValues('social') && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                  {renderCustomFields('social')}
                </div>
              )}
            </div>
          )}

          {/* Custom Fields Card - for 'basic' section custom fields */}
          {sectionHasValues('basic') && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Additional Info
              </h3>
              {renderCustomFields('basic')}
            </div>
          )}

          {/* Custom Fields Card - for 'other' section */}
          {sectionHasValues('other') && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Other Details
              </h3>
              {renderCustomFields('other')}
            </div>
          )}

          {/* Custom Fields Card - for 'custom' section */}
          {hasCustomSectionFields && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Custom Fields
              </h3>
              {renderCustomFields('custom')}
            </div>
          )}

          {/* Custom Tabs as cards in sidebar */}
          {customTabsWithValues.map(tab => (
            <div key={tab.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                {tab.name}
              </h3>
              {renderCustomFields('', tab.id)}
            </div>
          ))}

          {/* Parent Account */}
          {account.accountClassification !== 'individual' && account.parentAccount && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Parent Account
              </h3>
              <Link to={`/accounts/${account.parentAccount.id}`} className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg p-2 -m-2 transition-colors">
                {account.parentAccount.logoUrl ? (
                  <img src={account.parentAccount.logoUrl} alt={account.parentAccount.name} className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-semibold">
                    {account.parentAccount.name[0]}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{account.parentAccount.name}</p>
                  {account.parentAccount.industry && (
                    <p className="text-sm text-gray-500 dark:text-slate-400">{account.parentAccount.industry}</p>
                  )}
                </div>
              </Link>
            </div>
          )}

          {/* Record Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Record Info</h3>
            <div className="space-y-3 text-sm">
              {account.owner && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400 flex items-center gap-2">
                    <User className="w-4 h-4" /> Owner
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {account.owner.firstName} {account.owner.lastName}
                  </span>
                </div>
              )}
              {account.source && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Source</span>
                  <span className="text-gray-900 dark:text-white">{account.source}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-slate-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Created
                </span>
                <span className="text-gray-900 dark:text-white">
                  {format(new Date(account.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-slate-400">Last updated</span>
                <span className="text-gray-900 dark:text-white">
                  {formatDistanceToNow(new Date(account.updatedAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>

          {/* Profile Completion */}
          {account.profileCompletion && (
            <ProfileCompletion completion={account.profileCompletion as ProfileCompletionData} />
          )}
        </div>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            {/* Tab Headers */}
            <div className="border-b border-gray-100 dark:border-slate-800 px-6">
              <div className="flex gap-1 overflow-x-auto">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 rounded text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'overview' && (
                <OverviewTabContent
                  scores={scores}
                  subscriptions={subscriptions}
                  accountId={id!}
                  onSwitchTab={setActiveTab}
                />
              )}

              {activeTab === 'subscriptions' && (
                <SubscriptionsTabContent
                  subscriptions={subscriptions}
                  summary={summary}
                  onRefresh={fetchAllData}
                  accountId={id!}
                />
              )}

              {activeTab === 'leads' && <LeadsTabContent accountId={id!} />}
              {activeTab === 'opportunities' && <OpportunitiesTabContent accountId={id!} />}
              {activeTab === 'projects' && <ProjectsTabContent accountId={id!} />}
              {activeTab === 'financials' && <FinancialsTabContent accountId={id!} />}
              {activeTab === 'timeline' && <TimelineTabContent accountId={id!} />}

              {activeTab === 'contacts' && (
                <div>
                  {tabLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* Link / Create Contact Buttons */}
                      <div className="mb-4 flex items-center gap-2">
                        <button
                          onClick={() => setShowLinkContactModal(true)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800"
                        >
                          <Users className="w-4 h-4" />
                          Link a Contact
                        </button>
                        <button
                          onClick={() => setShowQuickCreateContact(true)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                        >
                          <User className="w-4 h-4" />
                          Quick Create
                        </button>
                      </div>

                      {linkedContacts.length === 0 ? (
                        <div className="text-center py-8">
                          <Users className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                          <p className="text-gray-500 dark:text-slate-400">No contacts linked</p>
                          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                            Link contacts to this account
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {linkedContacts.map(contact => (
                            <div key={contact.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 group">
                              <Link to={`/contacts/${contact.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                                {contact.avatarUrl ? (
                                  <img src={contact.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                    {contact.firstName[0]}{contact.lastName[0]}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900 dark:text-white truncate">
                                    {contact.firstName} {contact.lastName}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-slate-400 truncate">
                                    {[contact.jobTitle, contact.role].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                              </Link>
                              <div className="flex items-center gap-2 shrink-0">
                                {contact.isPrimary && (
                                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-lg">
                                    Primary
                                  </span>
                                )}
                                <button
                                  onClick={() => handleUnlinkContact(contact.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                  title="Unlink contact"
                                >
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

              {activeTab === 'emails' && (
                <EntityEmailsTab
                  entityType="account"
                  entityId={id!}
                  entityEmail={primaryEmail?.email}
                />
              )}

              {activeTab === 'tasks' && (
                <EntityTasksPanel
                  entityType="accounts"
                  entityId={id!}
                  entityName={account.name}
                />
              )}

              {activeTab === 'notes' && (
                <NotesPanel
                  notes={notes}
                  loading={tabLoading}
                  onAddNote={handleAddNote}
                />
              )}

              {activeTab === 'documents' && (
                <DocumentsPanel
                  documents={documents}
                  loading={tabLoading}
                  entityType="accounts"
                  entityId={id!}
                  onDocumentUploaded={(doc) => setDocuments(prev => [doc, ...prev])}
                  onDocumentDeleted={async (docId) => {
                    setDocuments(prev => prev.filter(d => d.id !== docId));
                  }}
                />
              )}

              {activeTab === 'history' && (
                <ChangeHistory history={history} loading={tabLoading} />
              )}

              {activeTab === 'children' && (
                <div>
                  {tabLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : childAccounts.length === 0 ? (
                    <div className="text-center py-8">
                      <Network className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-slate-400">No sub-accounts</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {childAccounts.map(child => (
                        <Link
                          key={child.id}
                          to={`/accounts/${child.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          {child.logoUrl ? (
                            <img src={child.logoUrl} alt={child.name} className="w-10 h-10 rounded-xl object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-semibold">
                              {child.name[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{child.name}</p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              {[child.industry, child.status].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'email_marketing' && (
                <AccountEmailMarketingPanel accountId={id!} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Account</h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete &quot;{account.name}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Contact Modal */}
      <LinkContactModal
        isOpen={showLinkContactModal}
        onClose={() => setShowLinkContactModal(false)}
        onLink={handleLinkContact}
        existingContactIds={linkedContacts.map(c => c.id)}
      />

      {/* Quick Create Contact Modal */}
      <QuickCreateContactModal
        isOpen={showQuickCreateContact}
        onClose={() => setShowQuickCreateContact(false)}
        onCreated={handleQuickContactCreated}
        accountId={id}
        accountName={account.name}
      />
    </div>
  );
}
