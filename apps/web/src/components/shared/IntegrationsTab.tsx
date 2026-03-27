import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { ExternalLink, Loader2, Plug } from 'lucide-react';
import { generalSettingsApi } from '../../api/generalSettings.api';

interface EmbeddedApp {
  id: string;
  name: string;
  description: string;
  modules: string[];
  url: string;
  authToken?: string;
  isActive: boolean;
}

const buildUrl = (template: string, record: any, authToken?: string): string => {
  return template.replace(/\{(\w+(?:\.\w+)?)\}/g, (_match, key) => {
    if (key === 'auth_token') return authToken || '';
    // Support nested keys: custom_fields.my_field
    const parts = key.split('.');
    let val = record;
    for (const p of parts) val = val?.[p];
    return val != null ? encodeURIComponent(String(val)) : '';
  });
};

interface IntegrationsTabProps {
  moduleName: string;
  record: any;
  recordId: string;
  children: ReactNode; // Email marketing panel
}

export function IntegrationsTab({ moduleName, record, recordId, children }: IntegrationsTabProps) {
  const [embeddedApps, setEmbeddedApps] = useState<EmbeddedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('email_marketing');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    generalSettingsApi.getEmbeddedAppsForModule(moduleName)
      .then(data => {
        if (!cancelled) {
          setEmbeddedApps(Array.isArray(data) ? data : []);
        }
      })
      .catch(err => console.error('Failed to load embedded apps:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [moduleName]);

  const subTabs = useMemo(() => {
    const tabs = [
      { id: 'email_marketing', label: 'Email Marketing' },
      ...embeddedApps.map(app => ({ id: app.id, label: app.name })),
    ];
    return tabs;
  }, [embeddedApps]);

  const activeApp = embeddedApps.find(a => a.id === activeSubTab);

  const iframeUrl = useMemo(() => {
    if (!activeApp) return '';
    return buildUrl(activeApp.url, record, activeApp.authToken);
  }, [activeApp, record]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tab pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeSubTab === tab.id
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400'
                : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {activeSubTab === 'email_marketing' && (
        <div>{children}</div>
      )}

      {activeApp && (
        <div className="relative flex flex-col" style={{ minHeight: '500px' }}>
          {/* Open in new tab button */}
          <div className="flex justify-end mb-2">
            <a
              href={iframeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in new tab
            </a>
          </div>

          {/* Iframe */}
          <iframe
            src={iframeUrl}
            title={activeApp.name}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            loading="lazy"
            className="flex-1 w-full rounded-lg border border-gray-200 dark:border-slate-700"
            style={{ minHeight: '500px', border: 'none' }}
          />
        </div>
      )}

      {subTabs.length <= 1 && activeSubTab === 'email_marketing' && embeddedApps.length === 0 && (
        <div className="mt-4 text-center py-4">
          <Plug className="w-8 h-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Configure embedded apps in Admin &gt; Integrations
          </p>
        </div>
      )}
    </div>
  );
}
