// ============================================================
// Hook: useFormFieldOrder
// Returns ordered + visibility-filtered field keys per tab
// for a given module. Falls back to default order if no config.
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { moduleSettingsApi } from '../api/module-settings.api';
import type { FormFieldOrderConfig } from '../api/module-settings.api';

interface FieldDef {
  key: string;
  visible: boolean;
}

export function useFormFieldOrder(module: string) {
  const [config, setConfig] = useState<FormFieldOrderConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    moduleSettingsApi.getFormFieldOrder(module)
      .then(setConfig)
      .catch(() => setConfig({ tabs: {} }))
      .finally(() => setLoading(false));
  }, [module]);

  /**
   * Given a tab key and a default ordered list of field keys,
   * returns the fields sorted by the saved config order.
   * Fields not in the config keep their default position.
   * Hidden fields are excluded.
   */
  const getOrderedFields = useCallback(
    (tab: string, defaultFields: string[]): string[] => {
      if (!config || !config.tabs[tab]) return defaultFields;

      const tabConfig = config.tabs[tab];
      const savedOrder: FieldDef[] = tabConfig.fields || [];

      // Build a set of saved keys for quick lookup
      const savedKeys = new Set(savedOrder.map(f => f.key));
      // Hidden keys
      const hiddenKeys = new Set(savedOrder.filter(f => !f.visible).map(f => f.key));

      // Start with saved order (visible only), then append any defaults not in saved
      const ordered: string[] = [];
      for (const f of savedOrder) {
        if (f.visible && defaultFields.includes(f.key)) {
          ordered.push(f.key);
        }
      }
      // Append defaults that weren't in the saved config (new fields added after config was saved)
      for (const key of defaultFields) {
        if (!savedKeys.has(key) && !hiddenKeys.has(key)) {
          ordered.push(key);
        }
      }

      return ordered;
    },
    [config],
  );

  return { config, loading, getOrderedFields };
}
