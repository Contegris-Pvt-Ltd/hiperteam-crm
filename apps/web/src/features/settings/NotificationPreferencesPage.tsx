import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Mail, Smartphone, Globe, MessageCircle, ArrowLeft,
  Save, Loader2, CheckCircle, AlertCircle, Send, Key,
  Eye, EyeOff, Hash, ExternalLink,
} from 'lucide-react';
import type {
  NotificationPreference,
  NotificationTemplate,
} from '../../api/notifications.api';
import { notificationsApi, EVENT_TYPE_LABELS } from '../../api/notifications.api';
import { subscribeToBrowserPush, unsubscribeFromBrowserPush } from '../../hooks/useNotifications';

// ============================================================
// CHANNEL CONFIG
// ============================================================
const CHANNELS = [
  { key: 'inApp', label: 'In-App', icon: Bell, description: 'Real-time bell notifications' },
  { key: 'email', label: 'Email', icon: Mail, description: 'Email notifications via SMTP' },
  { key: 'browserPush', label: 'Browser Push', icon: Globe, description: 'Browser push notifications' },
  { key: 'sms', label: 'SMS', icon: Smartphone, description: 'Text message notifications' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, description: 'WhatsApp message notifications' },
];

// ============================================================
// MAIN COMPONENT
// ============================================================
export function NotificationPreferencesPage() {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<'preferences' | 'channels' | 'templates'>('preferences');

  // Channel settings
  const [smtpConfig, setSmtpConfig] = useState<any>({});
  const [twilioConfig, setTwilioConfig] = useState<any>({});
  const [pushConfig, setPushConfig] = useState<any>({});
  const [smtpVerified, setSmtpVerified] = useState<boolean | null>(null);
  const [twilioVerified, setTwilioVerified] = useState<boolean | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Channel provider selections
  const [channelProviders, setChannelProviders] = useState<Record<string, string>>({
    email: 'system_default',
    sms: 'not_configured',
    whatsapp: 'not_configured',
    chat: 'none',
  });
  const [savingProviders, setSavingProviders] = useState(false);
  const [providerMessage, setProviderMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  // *** NEW STATE: Feedback messages, test email, push errors ***
  const [smtpMessage, setSmtpMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // Templates
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);

  // ============================================================
  // LOAD
  // ============================================================
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prefs, settings, tmpl, providers] = await Promise.all([
        notificationsApi.getPreferences(),
        notificationsApi.getSettings().catch(() => null),
        notificationsApi.getTemplates().catch(() => []),
        notificationsApi.getChannelProviders().catch(() => null),
      ]);

      setPreferences(prefs);
      if (settings) {
        setSmtpConfig(settings.smtp_config || {});
        setTwilioConfig(settings.twilio_config || {});
        setPushConfig(settings.push_config || {});
      }
      if (providers) {
        setChannelProviders(providers);
      }
      setTemplates(tmpl);

      // Check if browser push is subscribed
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          setPushSubscribed(!!sub);
        }
      }
    } catch (err) {
      console.error('Failed to load notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // TOGGLE PREFERENCE
  // ============================================================
  const togglePreference = (eventType: string, channel: string) => {
    setPreferences(prev =>
      prev.map(p => {
        if (p.eventType !== eventType) return p;
        return { ...p, [channel]: !(p as any)[channel] };
      }),
    );
    setDirty(true);
  };

  // ============================================================
  // SAVE PREFERENCES
  // ============================================================
  const savePreferences = async () => {
    setSaving(true);
    try {
      const updates = preferences.map(p => ({
        eventType: p.eventType,
        inApp: p.inApp,
        email: p.email,
        browserPush: p.browserPush,
        sms: p.sms,
        whatsapp: p.whatsapp,
      }));
      await notificationsApi.bulkUpdatePreferences(updates);
      setDirty(false);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // SAVE CHANNEL CONFIG
  // ============================================================
  const saveSmtp = async () => {
    setSaving(true);
    try {
      await notificationsApi.updateSetting('smtp_config', smtpConfig);
      setSmtpVerified(null);
    } finally {
      setSaving(false);
    }
  };

  const saveTwilio = async () => {
    setSaving(true);
    try {
      await notificationsApi.updateSetting('twilio_config', twilioConfig);
      setTwilioVerified(null);
    } finally {
      setSaving(false);
    }
  };

  // *** UPDATED: verifySmtp now shows error messages ***
  const verifySmtp = async () => {
    setSmtpMessage(null);
    try {
      const result = await notificationsApi.verifySmtp();
      setSmtpVerified(result.success);
      if (result.success) {
        setSmtpMessage({ type: 'success', text: 'SMTP connection verified successfully!' });
      } else {
        setSmtpMessage({ type: 'error', text: result.error || 'SMTP verification failed' });
      }
    } catch (err: any) {
      setSmtpVerified(false);
      setSmtpMessage({ type: 'error', text: err?.response?.data?.message || err?.message || 'SMTP verification failed' });
    }
  };

  const verifyTwilio = async () => {
    const result = await notificationsApi.verifyTwilio();
    setTwilioVerified(result.success);
  };

  // *** UPDATED: handlePushToggle now shows error messages ***
  const handlePushToggle = async () => {
    setPushError(null);
    if (pushSubscribed) {
      await unsubscribeFromBrowserPush();
      setPushSubscribed(false);
    } else {
      try {
        const success = await subscribeToBrowserPush();
        setPushSubscribed(success);
        if (!success) {
          setPushError('Push subscription failed. Ensure VAPID keys are configured and you are using HTTPS.');
        }
      } catch (err: any) {
        setPushError(err?.message || 'Push subscription failed. Check VAPID keys and HTTPS requirement.');
      }
    }
  };

  const generateVapid = async () => {
    const keys = await notificationsApi.generateVapidKeys();
    setPushConfig(keys);
  };

  // *** UPDATED: sendTest now accepts testEmail and shows feedback ***
  const sendTest = async (channel?: string) => {
    setSmtpMessage(null);
    setSendingTest(true);
    try {
      const result = await notificationsApi.sendTest(channel, testEmail || undefined);
      if (result.success) {
        setSmtpMessage({ type: 'success', text: `Test email sent${testEmail ? ` to ${testEmail}` : ' to your account email'}!` });
      } else {
        setSmtpMessage({ type: 'error', text: result.error || 'Failed to send test email' });
      }
    } catch (err: any) {
      setSmtpMessage({ type: 'error', text: err?.response?.data?.message || err?.message || 'Failed to send test email' });
    } finally {
      setSendingTest(false);
    }
  };

  // ============================================================
  // GROUP PREFERENCES BY CATEGORY
  // ============================================================
  const groupedPrefs = preferences.reduce<Record<string, NotificationPreference[]>>((groups, p) => {
    const category = EVENT_TYPE_LABELS[p.eventType]?.category || 'Other';
    if (!groups[category]) groups[category] = [];
    groups[category].push(p);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Notification Settings</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Configure how and when you receive notifications
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-slate-700">
        {(['preferences', 'channels', 'templates'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* TAB: PREFERENCES (matrix) */}
      {/* ============================================================ */}
      {activeTab === 'preferences' && (
        <div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
            {/* Matrix Header */}
            <div className="grid grid-cols-[1fr_repeat(5,_64px)] gap-0 px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
              <div className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Event</div>
              {CHANNELS.map(ch => (
                <div key={ch.key} className="text-center" title={ch.description}>
                  <ch.icon className="w-4 h-4 mx-auto text-gray-400 dark:text-slate-500" />
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 block">{ch.label}</span>
                </div>
              ))}
            </div>

            {/* Matrix Body — grouped by category */}
            {Object.entries(groupedPrefs).map(([category, prefs]) => (
              <div key={category}>
                <div className="px-4 py-2 bg-gray-50/50 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{category}</p>
                </div>
                {prefs.map(pref => {
                  const meta = EVENT_TYPE_LABELS[pref.eventType];
                  return (
                    <div
                      key={pref.eventType}
                      className="grid grid-cols-[1fr_repeat(5,_64px)] gap-0 px-4 py-3 border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50/50 dark:hover:bg-slate-800/30"
                    >
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">{meta?.label || pref.eventType}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{meta?.description || ''}</p>
                      </div>
                      {CHANNELS.map(ch => (
                        <div key={ch.key} className="flex items-center justify-center">
                          <button
                            onClick={() => togglePreference(pref.eventType, ch.key)}
                            className={`w-5 h-5 rounded border-2 transition-colors flex items-center justify-center ${
                              (pref as any)[ch.key]
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-gray-300 dark:border-slate-600 hover:border-blue-400'
                            }`}
                          >
                            {(pref as any)[ch.key] && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Save Button */}
          {dirty && (
            <div className="sticky bottom-4 mt-4 flex justify-end">
              <button
                onClick={savePreferences}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-lg transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Preferences
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: CHANNELS (admin config — provider selectors) */}
      {/* ============================================================ */}
      {activeTab === 'channels' && (
        <div className="space-y-6">

          {/* Provider Selector Cards */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Channel Providers</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-5">
              Select which provider to use for each notification channel. Configure credentials in Admin &rarr; Integrations.
            </p>

            <div className="space-y-5">
              {/* Email Provider */}
              <ProviderSelector
                icon={<Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                iconBg="bg-blue-100 dark:bg-blue-900/30"
                label="Email Provider"
                value={channelProviders.email || 'system_default'}
                onChange={v => setChannelProviders(p => ({ ...p, email: v }))}
                options={[
                  { value: 'system_default', label: 'System Default (.env)' },
                  { value: 'custom_smtp', label: 'Custom SMTP' },
                  { value: 'sendgrid', label: 'SendGrid' },
                  { value: 'aws_ses', label: 'AWS SES' },
                ]}
                testLabel="Test"
                testing={testingProvider === 'email'}
                onTest={async () => {
                  setTestingProvider('email');
                  setProviderMessage(null);
                  try {
                    const result = await notificationsApi.verifySmtp();
                    setProviderMessage(result.success
                      ? { type: 'success', text: `Email provider verified (${result.source || channelProviders.email})` }
                      : { type: 'error', text: result.error || 'Verification failed' });
                  } catch (err: any) {
                    setProviderMessage({ type: 'error', text: err?.response?.data?.message || err?.message || 'Test failed' });
                  } finally {
                    setTestingProvider(null);
                  }
                }}
              />

              {/* SMS Provider */}
              <ProviderSelector
                icon={<Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
                iconBg="bg-purple-100 dark:bg-purple-900/30"
                label="SMS Provider"
                value={channelProviders.sms || 'not_configured'}
                onChange={v => setChannelProviders(p => ({ ...p, sms: v }))}
                options={[
                  { value: 'not_configured', label: 'Not Configured' },
                  { value: 'twilio', label: 'Twilio' },
                ]}
                testLabel="Test"
                testing={testingProvider === 'sms'}
                onTest={async () => {
                  setTestingProvider('sms');
                  setProviderMessage(null);
                  try {
                    const result = await notificationsApi.verifyTwilio();
                    setProviderMessage(result.success
                      ? { type: 'success', text: 'Twilio SMS verified' }
                      : { type: 'error', text: result.error || 'Verification failed' });
                  } catch (err: any) {
                    setProviderMessage({ type: 'error', text: err?.response?.data?.message || err?.message || 'Test failed' });
                  } finally {
                    setTestingProvider(null);
                  }
                }}
              />

              {/* WhatsApp Provider */}
              <ProviderSelector
                icon={<MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />}
                iconBg="bg-green-100 dark:bg-green-900/30"
                label="WhatsApp Provider"
                value={channelProviders.whatsapp || 'not_configured'}
                onChange={v => setChannelProviders(p => ({ ...p, whatsapp: v }))}
                options={[
                  { value: 'not_configured', label: 'Not Configured' },
                  { value: 'twilio', label: 'Twilio' },
                ]}
                testLabel="Test"
                testing={testingProvider === 'whatsapp'}
                onTest={async () => {
                  setTestingProvider('whatsapp');
                  setProviderMessage(null);
                  try {
                    const result = await notificationsApi.verifyTwilio();
                    setProviderMessage(result.success
                      ? { type: 'success', text: 'Twilio WhatsApp verified' }
                      : { type: 'error', text: result.error || 'Verification failed' });
                  } catch (err: any) {
                    setProviderMessage({ type: 'error', text: err?.response?.data?.message || err?.message || 'Test failed' });
                  } finally {
                    setTestingProvider(null);
                  }
                }}
              />

              {/* Chat Notifications */}
              <ProviderSelector
                icon={<Hash className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                label="Chat Notifications"
                value={channelProviders.chat || 'none'}
                onChange={v => setChannelProviders(p => ({ ...p, chat: v }))}
                options={[
                  { value: 'none', label: 'Not Configured' },
                  { value: 'slack', label: 'Slack' },
                  { value: 'mattermost', label: 'Mattermost' },
                ]}
                testLabel="Test"
                testing={testingProvider === 'chat'}
                onTest={async () => {
                  setTestingProvider('chat');
                  setProviderMessage(null);
                  try {
                    const result = await notificationsApi.verifyChat();
                    setProviderMessage(result.success
                      ? { type: 'success', text: 'Chat provider verified' }
                      : { type: 'error', text: result.error || 'Verification failed' });
                  } catch (err: any) {
                    setProviderMessage({ type: 'error', text: err?.response?.data?.message || err?.message || 'Test failed' });
                  } finally {
                    setTestingProvider(null);
                  }
                }}
              />
            </div>

            {/* Save providers + feedback */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={async () => {
                  setSavingProviders(true);
                  setProviderMessage(null);
                  try {
                    const result = await notificationsApi.updateChannelProviders(channelProviders);
                    setChannelProviders(result);
                    setProviderMessage({ type: 'success', text: 'Channel providers saved' });
                    setTimeout(() => setProviderMessage(p => p?.text === 'Channel providers saved' ? null : p), 3000);
                  } catch (err: any) {
                    setProviderMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to save' });
                  } finally {
                    setSavingProviders(false);
                  }
                }}
                disabled={savingProviders}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingProviders ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Providers
              </button>
            </div>

            {providerMessage && (
              <div className={`mt-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                providerMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}>
                {providerMessage.type === 'success'
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span className="break-all">{providerMessage.text}</span>
                <button onClick={() => setProviderMessage(null)} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  &times;
                </button>
              </div>
            )}
          </div>

          {/* Test Email Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Send Test Email</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">Send a test email via the selected email provider</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="test@example.com (leave empty for your email)"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => sendTest('email')}
                disabled={sendingTest}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-slate-700 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Test
              </button>
            </div>
            {smtpMessage && (
              <div className={`mt-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                smtpMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}>
                {smtpMessage.type === 'success'
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span className="break-all">{smtpMessage.text}</span>
                <button onClick={() => setSmtpMessage(null)} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  &times;
                </button>
              </div>
            )}
          </div>

          {/* Browser Push */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Browser Push</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Web Push notifications (requires VAPID keys)</p>
                </div>
              </div>
              <button
                onClick={handlePushToggle}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  pushSubscribed
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200'
                }`}
              >
                {pushSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  VAPID Public Key: {pushConfig.publicKey ? `${pushConfig.publicKey.substring(0, 20)}...` : 'Not configured'}
                </p>
              </div>
              {!pushConfig.publicKey && (
                <button onClick={generateVapid} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                  <Key className="w-3.5 h-3.5" /> Generate VAPID Keys
                </button>
              )}
            </div>

            {/* *** Push Error Display *** */}
            {pushError && (
              <div className="mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{pushError}</span>
                <button onClick={() => setPushError(null)} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  &times;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: TEMPLATES */}
      {/* ============================================================ */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {templates.map(tmpl => {
            const meta = EVENT_TYPE_LABELS[tmpl.eventType];
            return (
              <div key={tmpl.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tmpl.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{meta?.description || tmpl.eventType}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${tmpl.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-500'}`}>
                    {tmpl.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                {tmpl.emailSubject && (
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                    <strong>Subject:</strong> {tmpl.emailSubject}
                  </p>
                )}
                {tmpl.smsBody && (
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                    <strong>SMS:</strong> {tmpl.smsBody}
                  </p>
                )}
              </div>
            );
          })}
          {templates.length === 0 && (
            <div className="text-center py-10 text-gray-500 dark:text-slate-400">
              No templates configured. Run the migration to seed default templates.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// REUSABLE FORM FIELDS
// ============================================================
function InputField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle }: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 pr-9 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function ProviderSelector({ icon, iconBg, label, value, onChange, options, testLabel, testing, onTest }: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  testLabel?: string;
  testing?: boolean;
  onTest?: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{label}</label>
        <div className="flex items-center gap-2">
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {onTest && (
            <button
              onClick={onTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-slate-700 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 flex-shrink-0"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              {testLabel || 'Test'}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
          Configure credentials in Admin &rarr; Integrations
        </p>
      </div>
    </div>
  );
}