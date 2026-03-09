import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Save, Plug, Eye, EyeOff,
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2,
  ExternalLink, Link2,
} from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import { api } from '../../api/contacts.api';

// ============================================================
// PROVIDER DEFINITIONS
// ============================================================

type Provider = 'docusign' | 'xero' | 'twilio' | 'sendgrid' | 'stripe' | 'slack';

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
  color: string;        // gradient from-to
  iconText: string;     // 2-letter abbreviation
  fields: FieldDef[];
}

const PROVIDERS: ProviderDef[] = [
  {
    provider: 'docusign',
    label: 'DocuSign',
    description: 'E-signature for contracts',
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
    provider: 'xero',
    label: 'Xero',
    description: 'Accounting & invoicing',
    color: 'from-cyan-500 to-blue-600',
    iconText: 'XR',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'OAuth 2.0 Client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'secret', placeholder: 'OAuth 2.0 Client Secret' },
      { key: 'tenantId', label: 'Xero Tenant ID', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    ],
  },
  {
    provider: 'twilio',
    label: 'Twilio',
    description: 'SMS & voice communications',
    color: 'from-red-500 to-rose-600',
    iconText: 'TW',
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'text', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'authToken', label: 'Auth Token', type: 'secret', placeholder: 'Your Twilio auth token' },
      { key: 'phoneNumber', label: 'Phone Number', type: 'text', placeholder: '+1234567890' },
    ],
  },
  {
    provider: 'sendgrid',
    label: 'SendGrid',
    description: 'Transactional email',
    color: 'from-blue-500 to-indigo-600',
    iconText: 'SG',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'secret', placeholder: 'SG.xxxxxxxxxxxxxxxxxx' },
      { key: 'fromEmail', label: 'From Email', type: 'text', placeholder: 'noreply@yourcompany.com' },
      { key: 'fromName', label: 'From Name', type: 'text', placeholder: 'Your Company' },
    ],
  },
  {
    provider: 'stripe',
    label: 'Stripe',
    description: 'Payments & billing',
    color: 'from-violet-500 to-purple-600',
    iconText: 'ST',
    fields: [
      { key: 'secretKey', label: 'Secret Key', type: 'secret', placeholder: 'sk_test_xxxxxxxxxx' },
      { key: 'publishableKey', label: 'Publishable Key', type: 'text', placeholder: 'pk_test_xxxxxxxxxx' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'secret', placeholder: 'whsec_xxxxxxxxxx' },
    ],
  },
  {
    provider: 'slack',
    label: 'Slack',
    description: 'Team notifications',
    color: 'from-emerald-500 to-green-600',
    iconText: 'SL',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'secret', placeholder: 'xoxb-xxxxxxxxxx' },
      { key: 'channelId', label: 'Default Channel ID', type: 'text', placeholder: 'C0XXXXXXXXX' },
      { key: 'webhookUrl', label: 'Incoming Webhook URL', type: 'text', placeholder: 'https://hooks.slack.com/services/...' },
    ],
  },
];

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
  const [expandedProvider, setExpandedProvider] = useState<Provider | null>(null);
  const [saving, setSaving] = useState<Provider | null>(null);
  const [success, setSuccess] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [connectingXero, setConnectingXero] = useState(false);

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Plug className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Integrations</h1>
            <p className="text-gray-600 dark:text-slate-400">Connect third-party services</p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {PROVIDERS.map((providerDef) => {
            const isExpanded = expandedProvider === providerDef.provider;
            const isEnabled = getEnabled(providerDef.provider);
            const config = getConfig(providerDef.provider);
            const isSaving = saving === providerDef.provider;
            const isSuccess = success === providerDef.provider;

            return (
              <div
                key={providerDef.provider}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden"
              >
                {/* Card Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors"
                  onClick={() => setExpandedProvider(isExpanded ? null : providerDef.provider)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${providerDef.color} rounded-lg flex items-center justify-center text-white text-sm font-bold`}>
                      {providerDef.iconText}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">{providerDef.label}</h3>
                        {isEnabled && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-slate-400">{providerDef.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isSuccess && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Saved
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleEnabled(providerDef.provider); }}
                      className="flex-shrink-0"
                      title={isEnabled ? 'Disable' : 'Enable'}
                    >
                      {isEnabled
                        ? <ToggleRight className="w-7 h-7 text-green-500" />
                        : <ToggleLeft className="w-7 h-7 text-gray-400" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Config */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-slate-700 p-4">
                    <div className="space-y-4">
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
                                  onChange={(e) => updateLocalConfig(providerDef.provider, field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  rows={4}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                                />
                              ) : (
                                <input
                                  type={isSecret && !isVisible ? 'password' : 'text'}
                                  value={config[field.key] || field.defaultValue || ''}
                                  onChange={(e) => updateLocalConfig(providerDef.provider, field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                                />
                              )}
                              {isSecret && !isTextarea && (
                                <button
                                  type="button"
                                  onClick={() => toggleSecretVisibility(fieldUid)}
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
                    </div>

                    {/* Save Button */}
                    <div className="mt-6 flex items-center gap-3">
                      <button
                        onClick={() => handleSave(providerDef)}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save {providerDef.label}
                      </button>
                    </div>

                    {/* Xero-specific actions */}
                    {providerDef.provider === 'xero' && isEnabled && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 flex items-center gap-3">
                        {!config.accessToken ? (
                          <button
                            onClick={handleConnectXero}
                            disabled={connectingXero}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl transition-colors disabled:opacity-50"
                          >
                            {connectingXero ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                            Connect to Xero
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate('/admin/xero-matching')}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl transition-colors"
                          >
                            <Link2 className="w-4 h-4" />
                            Match Contacts
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
