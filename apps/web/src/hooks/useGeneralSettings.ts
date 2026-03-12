import { useState, useEffect } from 'react';
import { api } from '../api/contacts.api';

export interface GeneralSettings {
  companyName?: string;
  baseCountry?: string;   // ISO2
  baseCity?: string;
  defaultCurrency?: string; // e.g. 'USD'
  timezone?: string;
}

let cache: GeneralSettings | null = null;
const listeners: Array<() => void> = [];

export function useGeneralSettings() {
  const [settings, setSettings] = useState<GeneralSettings>(cache ?? {});
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) { setSettings(cache); setLoading(false); return; }
    api.get('/general-settings/company').then(res => {
      cache = res.data ?? {};
      setSettings(cache!);
      setLoading(false);
      listeners.forEach(fn => fn());
    }).catch(() => setLoading(false));
  }, []);

  return { settings, loading };
}

// Call this after saving general settings to bust the cache
export function invalidateGeneralSettingsCache() {
  cache = null;
}
