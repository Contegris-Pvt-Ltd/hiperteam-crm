import { useState, useEffect } from 'react';
import { adminApi } from '../api/admin.api';
import type { CustomField } from '../api/admin.api';

interface UseCustomFieldsResult {
  fields: CustomField[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCustomFields(module: string): UseCustomFieldsResult {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFields = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getCustomFields(module);
      // Only return active fields, sorted by display order
      const activeFields = data
        .filter((f: CustomField) => f.isActive)
        .sort((a: CustomField, b: CustomField) => a.displayOrder - b.displayOrder);
      setFields(activeFields);
    } catch (err) {
      console.error('Failed to fetch custom fields:', err);
      setError('Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, [module]);

  return {
    fields,
    loading,
    error,
    refetch: fetchFields,
  };
}