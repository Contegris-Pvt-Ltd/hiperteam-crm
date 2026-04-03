import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Save, Plug, Eye, EyeOff,
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2,
  ExternalLink, Link2, Copy, Check, Plus, Pencil, Trash2, X, AppWindow,
  Search,
} from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { api } from '../../api/contacts.api';
import { emailMarketingApi } from '../../api/email-marketing.api';
import { generalSettingsApi } from '../../api/generalSettings.api';
import { useAuthStore } from '../../stores/auth.store';

// ============================================================
// EMBEDDED APP TYPES
// ============================================================

interface EmbeddedApp {
  id: string;
  name: string;
  description: string;
  modules: string[];
  url: string;
  authToken?: string;
  isActive: boolean;
}

interface ModuleVariable {
  key: string;
  label: string;
}

const AVAILABLE_MODULES = [
  { key: 'accounts', label: 'Accounts' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'leads', label: 'Leads' },
  { key: 'opportunities', label: 'Opportunities' },
];

// ============================================================
// PROVIDER DEFINITIONS
// ============================================================

type Provider = 'docusign' | 'xero' | 'twilio' | 'sendgrid' | 'stripe' | 'slack' | 'mattermost' | 'aws_ses' | 'custom_smtp' | 'mailerlite' | 'mailchimp';

type Category = 'email' | 'communication' | 'accounting' | 'marketing' | 'esignatures' | 'payments';

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'textarea';
  placeholder?: string;
  defaultValue?: string;
  helpText?: string;
}

interface ProviderDef {
  provider: Provider;
  label: string;
  description: string;
  category: Category;
  color: string;        // gradient from-to
  iconText: string;     // 2-letter abbreviation
  fields: FieldDef[];
  comingSoon?: boolean;
}

const PROVIDERS: ProviderDef[] = [
  {
    provider: 'custom_smtp',
    label: 'Custom SMTP',
    description: 'Use your own SMTP server',
    category: 'email',
    color: 'from-slate-500 to-gray-600',
    iconText: 'SM',
    fields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'smtp.example.com' },
      { key: 'port', label: 'Port', type: 'text', placeholder: '587' },
      { key: 'user', label: 'Username', type: 'text', placeholder: 'user@example.com' },
      { key: 'pass', label: 'Password', type: 'secret', placeholder: 'Your SMTP password' },
      { key: 'fromEmail', label: 'From Email', type: 'text', placeholder: 'noreply@yourcompany.com' },
      { key: 'fromName', label: 'From Name', type: 'text', placeholder: 'Your Company' },
    ],
  },
  {
    provider: 'sendgrid',
    label: 'SendGrid',
    description: 'Transactional email via SendGrid API',
    category: 'email',
    color: 'from-blue-500 to-indigo-600',
    iconText: 'SG',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'secret', placeholder: 'SG.xxxxxxxxxxxxxxxxxx' },
      { key: 'fromEmail', label: 'From Email', type: 'text', placeholder: 'noreply@yourcompany.com' },
      { key: 'fromName', label: 'From Name', type: 'text', placeholder: 'Your Company' },
    ],
  },
  {
    provider: 'aws_ses',
    label: 'AWS SES',
    description: 'Amazon Simple Email Service',
    category: 'email',
    color: 'from-orange-500 to-amber-600',
    iconText: 'SE',
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', placeholder: 'AKIAxxxxxxxxxxxxxxxx' },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'secret', placeholder: 'Your AWS secret access key' },
      { key: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1', helpText: 'AWS region (e.g. us-east-1, us-west-2, eu-west-1, ap-southeast-1)' },
      { key: 'fromEmail', label: 'From Email', type: 'text', placeholder: 'noreply@yourcompany.com' },
      { key: 'fromName', label: 'From Name', type: 'text', placeholder: 'Your Company' },
    ],
  },
  {
    provider: 'twilio',
    label: 'Twilio',
    description: 'SMS & WhatsApp messaging',
    category: 'communication',
    color: 'from-red-500 to-rose-600',
    iconText: 'TW',
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'text', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'authToken', label: 'Auth Token', type: 'secret', placeholder: 'Your Twilio auth token' },
      { key: 'phoneNumber', label: 'Phone Number', type: 'text', placeholder: '+1234567890' },
    ],
  },
  {
    provider: 'slack',
    label: 'Slack',
    description: 'Team notifications via webhook',
    category: 'communication',
    color: 'from-emerald-500 to-green-600',
    iconText: 'SL',
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', type: 'text', placeholder: 'https://hooks.slack.com/services/...' },
      { key: 'channelName', label: 'Channel Name (optional)', type: 'text', placeholder: '#general', helpText: 'For display purposes only. The webhook determines the channel.' },
    ],
  },
  {
    provider: 'mattermost',
    label: 'Mattermost',
    description: 'Open-source team messaging',
    category: 'communication',
    color: 'from-blue-500 to-sky-600',
    iconText: 'MM',
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', type: 'text', placeholder: 'https://mattermost.example.com/hooks/...' },
      { key: 'channelName', label: 'Channel Name (optional)', type: 'text', placeholder: 'town-square', helpText: 'For display purposes only. The webhook determines the channel.' },
    ],
  },
  {
    provider: 'xero',
    label: 'Xero',
    description: 'Accounting & invoicing sync',
    category: 'accounting',
    color: 'from-cyan-500 to-blue-600',
    iconText: 'XR',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'OAuth 2.0 Client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'secret', placeholder: 'OAuth 2.0 Client Secret' },
      { key: 'tenantId', label: 'Xero Tenant ID', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    ],
  },
  {
    provider: 'mailerlite',
    label: 'MailerLite',
    description: 'Email marketing automation',
    category: 'marketing',
    color: 'from-green-500 to-emerald-600',
    iconText: 'ML',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'secret', placeholder: 'Your MailerLite API key' },
    ],
  },
  {
    provider: 'mailchimp',
    label: 'Mailchimp',
    description: 'Email marketing platform',
    category: 'marketing',
    color: 'from-yellow-500 to-orange-600',
    iconText: 'MC',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'secret', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us14' },
      { key: 'dataCenter', label: 'Data Center', type: 'text', placeholder: 'us14', helpText: 'Found at the end of your API key (e.g. us14)' },
    ],
  },
  {
    provider: 'docusign',
    label: 'DocuSign',
    description: 'Electronic signature platform',
    category: 'esignatures',
    color: 'from-yellow-500 to-amber-600',
    iconText: 'DS',
    fields: [
      { key: 'integrationKey', label: 'Integration Key', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'userId', label: 'User ID (API User)', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'accountId', label: 'Account ID', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'privateKey', label: 'RSA Private Key', type: 'textarea', placeholder: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----' },
      { key: 'basePath', label: 'Base Path', type: 'text', defaultValue: 'https://demo.docusign.net/restapi', helpText: 'Use https://na1.docusign.net/restapi for production' },
      { key: 'oauthServer', label: 'OAuth Server', type: 'text', defaultValue: 'account-d.docusign.com', helpText: 'Use account.docusign.com for production' },
    ],
  },
  {
    provider: 'stripe',
    label: 'Stripe',
    description: 'Payment processing',
    category: 'payments',
    color: 'from-violet-500 to-purple-600',
    iconText: 'ST',
    comingSoon: true,
    fields: [
      { key: 'secretKey', label: 'Secret Key', type: 'secret', placeholder: 'sk_test_xxxxxxxxxx' },
      { key: 'publishableKey', label: 'Publishable Key', type: 'text', placeholder: 'pk_test_xxxxxxxxxx' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'secret', placeholder: 'whsec_xxxxxxxxxx' },
    ],
  },
];

// ============================================================
// CATEGORY TABS
// ============================================================

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'email', label: 'Email' },
  { key: 'communication', label: 'Communication' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'esignatures', label: 'E-Signatures' },
  { key: 'payments', label: 'Payments' },
  { key: 'embedded', label: 'Embedded Apps' },
] as const;

type CategoryTab = typeof CATEGORIES[number]['key'];

// ============================================================
// TYPES
// ============================================================

interface IntegrationRow {
  provider: Provider;
  isEnabled: boolean;
  config: Record<string, string>;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function IntegrationsPage() {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<Record<Provider, IntegrationRow>>({} as any);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Provider | null>(null);
  const [success, setSuccess] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [connectingXero, setConnectingXero] = useState(false);
  const [testingConnection, setTestingConnection] = useState<Provider | null>(null);
  const [testResult, setTestResult] = useState<{ provider: Provider; listCount: number } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);
  const tenant = useAuthStore((s) => s.tenant);

  // New state for tabs, search, and modal
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('all');
  const [search, setSearch] = useState('');
  const [configModalProvider, setConfigModalProvider] = useState<ProviderDef | null>(null);

  // ── Load data ────────────────────────────────────────────────
  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getIntegrations() as IntegrationRow[];
      const map: Record<string, IntegrationRow> = {};
      data.forEach((row) => { map[row.provider] = row; });
      setIntegrations(map as any);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────
  const getConfig = (provider: Provider): Record<string, string> => {
    return integrations[provider]?.config || {};
  };

  const getEnabled = (provider: Provider): boolean => {
    return integrations[provider]?.isEnabled || false;
  };

  const updateLocalConfig = (provider: Provider, key: string, value: string) => {
    setIntegrations((prev) => ({
      ...prev,
      [provider]: {
        provider,
        isEnabled: prev[provider]?.isEnabled || false,
        config: { ...(prev[provider]?.config || {}), [key]: value },
      },
    }));
  };

  const toggleEnabled = (provider: Provider) => {
    setIntegrations((prev) => ({
      ...prev,
      [provider]: {
        provider,
        isEnabled: !prev[provider]?.isEnabled,
        config: prev[provider]?.config || {},
      },
    }));
  };

  const toggleSecretVisibility = (fieldKey: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  const handleSave = async (providerDef: ProviderDef) => {
    setError(null);
    setSuccess(null);
    setSaving(providerDef.provider);
    try {
      const row = integrations[providerDef.provider];
      await adminApi.updateIntegration(providerDef.provider, {
        isEnabled: row?.isEnabled || false,
        config: row?.config || {},
      });
      setSuccess(providerDef.provider);
      setTimeout(() => setSuccess((prev) => (prev === providerDef.provider ? null : prev)), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || `Failed to save ${providerDef.label} settings`);
    } finally {
      setSaving(null);
    }
  };

  const handleConnectXero = async () => {
    setConnectingXero(true);
    setError(null);
    try {
      const { data } = await api.get('/admin/xero/auth-url');
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to get Xero authorization URL');
      setConnectingXero(false);
    }
  };

  const handleTestEmailConnection = async (provider: Provider) => {
    setTestingConnection(provider);
    setTestResult(null);
    setError(null);
    try {
      const result = await emailMarketingApi.testConnection();
      setTestResult({ provider, listCount: result.listCount ?? 0 });
      setTimeout(() => setTestResult((prev) => (prev?.provider === provider ? null : prev)), 5000);
    } catch (err: any) {
      setError(err?.response?.data?.message || `Failed to connect to ${provider}`);
    } finally {
      setTestingConnection(null);
    }
  };

  const handleTestChatWebhook = async (providerDef: ProviderDef) => {
    setTestingConnection(providerDef.provider);
    setError(null);
    try {
      const config = getConfig(providerDef.provider);
      const webhookUrl = config.webhookUrl;
      if (!webhookUrl) {
        setError(`Please configure a webhook URL for ${providerDef.label}`);
        return;
      }
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          providerDef.provider === 'slack'
            ? { blocks: [
                { type: 'header', text: { type: 'plain_text', text: 'Test Notification' } },
                { type: 'section', text: { type: 'mrkdwn', text: 'This is a test message from IntelliSales CRM.' } },
              ] }
            : { text: '**Test Notification**\nThis is a test message from IntelliSales CRM.' }
        ),
      });
      if (res.ok) {
        setSuccess(providerDef.provider);
        setTimeout(() => setSuccess((prev) => (prev === providerDef.provider ? null : prev)), 3000);
      } else {
        setError(`${providerDef.label} webhook returned status ${res.status}`);
      }
    } catch (err: any) {
      setError(err?.message || `Failed to send test to ${providerDef.label}`);
    } finally {
      setTestingConnection(null);
    }
  };

  const copyWebhookUrl = (provider: Provider) => {
    const tenantId = tenant?.id || 'YOUR_TENANT_ID';
    const url = `${window.location.origin}/api/webhooks/${provider}?tenant=${tenantId}`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(provider);
    setTimeout(() => setCopiedWebhook((prev) => (prev === provider ? null : prev)), 2000);
  };

  // ── Filter logic ─────────────────────────────────────────────
  const filteredProviders = PROVIDERS.filter((p) => {
    if (activeCategory !== 'all' && activeCategory !== 'embedded' && p.category !== activeCategory) return false;
    if (search && !p.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Plug className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Integrations</h1>
              <p className="text-gray-600 dark:text-slate-400">Connect third-party services</p>
            </div>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search integrations..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.key
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 dark:hover:text-red-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : activeCategory === 'embedded' ? (
        /* Embedded Apps Tab */
        <EmbeddedAppsSection />
      ) : (
        <>
          {/* Provider Card Grid */}
          {filteredProviders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-slate-500">
              <Search className="w-10 h-10 mb-3" />
              <p className="text-sm">No integrations found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProviders.map((providerDef) => {
                const isEnabled = getEnabled(providerDef.provider);

                return (
                  <div
                    key={providerDef.provider}
                    className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex flex-col justify-between ${
                      providerDef.comingSoon ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Top: icon + name + description */}
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-10 h-10 bg-gradient-to-br ${providerDef.color} rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                          {providerDef.iconText}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">{providerDef.label}</h3>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">{providerDef.description}</p>
                    </div>

                    {/* Status + action */}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <div className="flex items-center gap-1.5">
                        {providerDef.comingSoon ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Coming Soon</span>
                          </>
                        ) : isEnabled ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Connected</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Not Configured</span>
                          </>
                        )}
                      </div>
                      {!providerDef.comingSoon && (
                        <button
                          onClick={() => setConfigModalProvider(providerDef)}
                          className="px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                        >
                          Configure
                        </button>
                      )}
                      {providerDef.comingSoon && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Configure Modal */}
      {configModalProvider && (
        <ConfigureModal
          providerDef={configModalProvider}
          config={getConfig(configModalProvider.provider)}
          isEnabled={getEnabled(configModalProvider.provider)}
          saving={saving === configModalProvider.provider}
          isSuccess={success === configModalProvider.provider}
          visibleSecrets={visibleSecrets}
          testingConnection={testingConnection}
          testResult={testResult}
          copiedWebhook={copiedWebhook}
          connectingXero={connectingXero}
          tenant={tenant}
          onUpdateConfig={(key, value) => updateLocalConfig(configModalProvider.provider, key, value)}
          onToggleEnabled={() => toggleEnabled(configModalProvider.provider)}
          onToggleSecretVisibility={toggleSecretVisibility}
          onSave={() => handleSave(configModalProvider)}
          onTestEmailConnection={() => handleTestEmailConnection(configModalProvider.provider)}
          onTestChatWebhook={() => handleTestChatWebhook(configModalProvider)}
          onConnectXero={handleConnectXero}
          onCopyWebhookUrl={() => copyWebhookUrl(configModalProvider.provider)}
          onNavigateXeroMatching={() => navigate('/admin/xero-matching')}
          onClose={() => setConfigModalProvider(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// CONFIGURE MODAL
// ============================================================

function ConfigureModal({
  providerDef,
  config,
  isEnabled,
  saving,
  isSuccess,
  visibleSecrets,
  testingConnection,
  testResult,
  copiedWebhook,
  connectingXero,
  tenant,
  onUpdateConfig,
  onToggleEnabled,
  onToggleSecretVisibility,
  onSave,
  onTestEmailConnection,
  onTestChatWebhook,
  onConnectXero,
  onCopyWebhookUrl,
  onNavigateXeroMatching,
  onClose,
}: {
  providerDef: ProviderDef;
  config: Record<string, string>;
  isEnabled: boolean;
  saving: boolean;
  isSuccess: boolean;
  visibleSecrets: Set<string>;
  testingConnection: Provider | null;
  testResult: { provider: Provider; listCount: number } | null;
  copiedWebhook: string | null;
  connectingXero: boolean;
  tenant: any;
  onUpdateConfig: (key: string, value: string) => void;
  onToggleEnabled: () => void;
  onToggleSecretVisibility: (fieldKey: string) => void;
  onSave: () => void;
  onTestEmailConnection: () => void;
  onTestChatWebhook: () => void;
  onConnectXero: () => void;
  onCopyWebhookUrl: () => void;
  onNavigateXeroMatching: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${providerDef.color} rounded-lg flex items-center justify-center text-white text-sm font-bold`}>
              {providerDef.iconText}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Configure {providerDef.label}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500 dark:text-slate-400">{providerDef.description}</p>

          {/* Config Fields */}
          {providerDef.fields.map((field) => {
            const fieldUid = `${providerDef.provider}.${field.key}`;
            const isSecret = field.type === 'secret';
            const isTextarea = field.type === 'textarea';
            const isVisible = visibleSecrets.has(fieldUid);

            return (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {field.label}
                </label>
                <div className="relative">
                  {isTextarea ? (
                    <textarea
                      value={config[field.key] || field.defaultValue || ''}
                      onChange={(e) => onUpdateConfig(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                    />
                  ) : (
                    <input
                      type={isSecret && !isVisible ? 'password' : 'text'}
                      value={config[field.key] || field.defaultValue || ''}
                      onChange={(e) => onUpdateConfig(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                    />
                  )}
                  {isSecret && !isTextarea && (
                    <button
                      type="button"
                      onClick={() => onToggleSecretVisibility(fieldUid)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                    >
                      {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {field.helpText && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{field.helpText}</p>
                )}
              </div>
            );
          })}

          {/* Enabled Toggle */}
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onToggleEnabled}>
              {isEnabled
                ? <ToggleRight className="w-7 h-7 text-green-500" />
                : <ToggleLeft className="w-7 h-7 text-gray-400" />}
            </button>
            <span className="text-sm text-gray-700 dark:text-slate-300">Enabled</span>
          </div>

          {/* Xero-specific actions */}
          {providerDef.provider === 'xero' && isEnabled && (
            <div className="pt-2 border-t border-gray-200 dark:border-slate-700 flex items-center gap-3">
              {!config.accessToken ? (
                <button
                  onClick={onConnectXero}
                  disabled={connectingXero}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {connectingXero ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Connect to Xero
                </button>
              ) : (
                <button
                  onClick={onNavigateXeroMatching}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                  Match Contacts
                </button>
              )}
            </div>
          )}

          {/* Chat provider actions (Slack / Mattermost) — Test Message */}
          {(providerDef.provider === 'slack' || providerDef.provider === 'mattermost') && isEnabled && (
            <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <button
                  onClick={onTestChatWebhook}
                  disabled={testingConnection === providerDef.provider}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {testingConnection === providerDef.provider
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ExternalLink className="w-4 h-4" />}
                  Send Test Message
                </button>
              </div>
            </div>
          )}

          {/* Email marketing provider actions (MailerLite / Mailchimp) */}
          {(providerDef.provider === 'mailerlite' || providerDef.provider === 'mailchimp') && (
            <div className="pt-2 border-t border-gray-200 dark:border-slate-700 space-y-4">
              {/* Test Connection */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onTestEmailConnection}
                  disabled={testingConnection === providerDef.provider}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {testingConnection === providerDef.provider
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <ExternalLink className="w-4 h-4" />}
                  Test Connection
                </button>
                {testResult?.provider === providerDef.provider && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Connected — {testResult.listCount} list{testResult.listCount !== 1 ? 's' : ''} found
                  </span>
                )}
              </div>

              {/* Webhook URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Webhook URL
                </label>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                  Configure this URL in your {providerDef.label} webhook settings to receive subscription updates.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/api/webhooks/${providerDef.provider}?tenant=${tenant?.id || 'YOUR_TENANT_ID'}`}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 text-sm font-mono cursor-text"
                  />
                  <button
                    onClick={onCopyWebhookUrl}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 rounded-lg transition-colors text-sm"
                  >
                    {copiedWebhook === providerDef.provider
                      ? <><Check className="w-4 h-4 text-green-500" /> Copied</>
                      : <><Copy className="w-4 h-4" /> Copy</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-slate-700">
          <div>
            {isSuccess && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Saved successfully
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EMBEDDED APPS SECTION COMPONENT
// ============================================================

function EmbeddedAppsSection() {
  const [apps, setApps] = useState<EmbeddedApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingApp, setEditingApp] = useState<EmbeddedApp | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    setLoadingApps(true);
    try {
      const data = await generalSettingsApi.getEmbeddedApps();
      setApps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load embedded apps:', err);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleSaveApps = async (updatedApps: EmbeddedApp[]) => {
    setSaving(true);
    setError(null);
    try {
      await generalSettingsApi.saveEmbeddedApps(updatedApps);
      setApps(updatedApps);
      setSuccessMsg('Embedded apps saved');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save embedded apps');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (appId: string) => {
    const updated = apps.map(a => a.id === appId ? { ...a, isActive: !a.isActive } : a);
    await handleSaveApps(updated);
  };

  const handleDelete = async (appId: string) => {
    if (!confirm('Delete this embedded app?')) return;
    const updated = apps.filter(a => a.id !== appId);
    await handleSaveApps(updated);
  };

  const handleSaveApp = async (app: EmbeddedApp) => {
    let updated: EmbeddedApp[];
    if (isCreating) {
      updated = [...apps, app];
    } else {
      updated = apps.map(a => a.id === app.id ? app : a);
    }
    await handleSaveApps(updated);
    setEditingApp(null);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingApp({
      id: crypto.randomUUID(),
      name: '',
      description: '',
      modules: [],
      url: '',
      authToken: '',
      isActive: true,
    });
  };

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <AppWindow className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Embedded Apps</h2>
            <p className="text-sm text-gray-600 dark:text-slate-400">Embed external applications as iframes in record detail pages</p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Embedded App
        </button>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Loading */}
      {loadingApps ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      ) : (
        <>
          {/* App Cards */}
          {apps.length === 0 && !editingApp ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center">
              <AppWindow className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400">No embedded apps configured</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Click "Add Embedded App" to create one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apps.map(app => (
                <div
                  key={app.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">{app.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                          app.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${app.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {app.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {app.description && (
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">{app.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {app.modules.map(mod => (
                          <span
                            key={mod}
                            className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          >
                            {mod}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 font-mono truncate max-w-lg">
                        {app.url}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(app.id)}
                        className="flex-shrink-0"
                        title={app.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {app.isActive
                          ? <ToggleRight className="w-7 h-7 text-green-500" />
                          : <ToggleLeft className="w-7 h-7 text-gray-400" />}
                      </button>
                      <button
                        onClick={() => { setIsCreating(false); setEditingApp({ ...app }); }}
                        className="p-2 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(app.id)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit/Create Modal */}
      {editingApp && (
        <EmbeddedAppModal
          app={editingApp}
          isCreating={isCreating}
          saving={saving}
          onSave={handleSaveApp}
          onClose={() => { setEditingApp(null); setIsCreating(false); }}
        />
      )}
    </div>
  );
}

// ============================================================
// EMBEDDED APP MODAL
// ============================================================

function EmbeddedAppModal({
  app,
  isCreating,
  saving,
  onSave,
  onClose,
}: {
  app: EmbeddedApp;
  isCreating: boolean;
  saving: boolean;
  onSave: (app: EmbeddedApp) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EmbeddedApp>({ ...app });
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [variables, setVariables] = useState<ModuleVariable[]>([]);
  const [loadingVars, setLoadingVars] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Fetch variables when modules change
  useEffect(() => {
    if (form.modules.length === 0) {
      setVariables([]);
      return;
    }
    let cancelled = false;
    setLoadingVars(true);
    Promise.all(form.modules.map(m => generalSettingsApi.getModuleVariables(m)))
      .then(results => {
        if (cancelled) return;
        // Combine and deduplicate
        const seen = new Set<string>();
        const combined: ModuleVariable[] = [];
        results.flat().forEach((v: ModuleVariable) => {
          if (!seen.has(v.key)) {
            seen.add(v.key);
            combined.push(v);
          }
        });
        // Always add auth_token
        if (!seen.has('auth_token')) {
          combined.push({ key: 'auth_token', label: 'Auth Token' });
        }
        setVariables(combined);
      })
      .catch(err => console.error('Failed to load variables:', err))
      .finally(() => { if (!cancelled) setLoadingVars(false); });
    return () => { cancelled = true; };
  }, [form.modules]);

  const toggleModule = (mod: string) => {
    setForm(prev => ({
      ...prev,
      modules: prev.modules.includes(mod)
        ? prev.modules.filter(m => m !== mod)
        : [...prev.modules, mod],
    }));
  };

  const insertVariable = (varKey: string) => {
    const input = urlInputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? form.url.length;
    const end = input.selectionEnd ?? start;
    const token = `{${varKey}}`;
    const newUrl = form.url.slice(0, start) + token + form.url.slice(end);
    setForm(prev => ({ ...prev, url: newUrl }));
    // Re-focus and position cursor after inserted variable
    setTimeout(() => {
      input.focus();
      const pos = start + token.length;
      input.setSelectionRange(pos, pos);
    }, 0);
  };

  const variableIsInUrl = (key: string) => form.url.includes(`{${key}}`);

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (!form.url.trim()) return;
    if (form.modules.length === 0) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isCreating ? 'Add Embedded App' : 'Edit Embedded App'}
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="License Information"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Client license lookup"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Modules */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Modules</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_MODULES.map(mod => (
                <button
                  key={mod.key}
                  type="button"
                  onClick={() => toggleModule(mod.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    form.modules.includes(mod.key)
                      ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                      : 'border-gray-200 bg-white text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                    form.modules.includes(mod.key)
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'border-gray-300 dark:border-slate-500'
                  }`}>
                    {form.modules.includes(mod.key) && <Check className="w-2.5 h-2.5" />}
                  </span>
                  {mod.label}
                </button>
              ))}
            </div>
          </div>

          {/* URL Template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">URL Template</label>
            <input
              ref={urlInputRef}
              type="text"
              value={form.url}
              onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://app.example.com/client/{id}?t={auth_token}"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          {/* Variable Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Insert Variable
            </label>
            {form.modules.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-slate-500">Select modules first to see available variables</p>
            ) : loadingVars ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading variables...
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {variables.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    title={`Insert {${v.key}}`}
                    className={`px-2 py-0.5 text-xs rounded-full cursor-pointer transition-colors ${
                      variableIsInUrl(v.key)
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 ring-1 ring-purple-300 dark:ring-purple-600'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                    }`}
                  >
                    {v.label} <span className="opacity-60">({v.key})</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Click a variable to insert it at cursor position in the URL</p>
          </div>

          {/* Auth Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Auth Token (optional)</label>
            <div className="relative">
              <input
                type={showAuthToken ? 'text' : 'password'}
                value={form.authToken || ''}
                onChange={e => setForm(prev => ({ ...prev, authToken: e.target.value }))}
                placeholder="sk-xxx-yyy-zzz"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAuthToken(!showAuthToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                {showAuthToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Used to replace the {'{auth_token}'} variable in the URL</p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
            >
              {form.isActive
                ? <ToggleRight className="w-7 h-7 text-green-500" />
                : <ToggleLeft className="w-7 h-7 text-gray-400" />}
            </button>
            <span className="text-sm text-gray-700 dark:text-slate-300">Active</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.name.trim() || !form.url.trim() || form.modules.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
