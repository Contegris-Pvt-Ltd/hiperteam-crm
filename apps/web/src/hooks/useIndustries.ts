import { useState, useEffect } from 'react';
import { generalSettingsApi } from '../api/admin.api';
import type { Industry } from '../api/admin.api';

let _cache: Industry[] | null = null;

export function useIndustries() {
  const [industries, setIndustries] = useState<Industry[]>(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) return;
    generalSettingsApi.getIndustries()
      .then(data => {
        _cache = data.filter((i: Industry) => i.isActive);
        setIndustries(_cache);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { industries, loading };
}
