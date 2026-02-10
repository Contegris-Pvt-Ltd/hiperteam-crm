/**
 * USE MODULE LAYOUT HOOK
 * 
 * Used by pages (ContactDetailPage, etc.) to check if admin has enabled
 * custom layout for this module/view.
 * 
 * Returns:
 * - useCustomLayout: boolean - whether to render custom or default
 * - config: layout config if custom, null if default
 * - loading: boolean
 */

import { useState, useEffect } from 'react';
import { adminApi } from '../api/admin.api';

interface UseModuleLayoutResult {
  /** Whether admin has enabled custom layout */
  useCustomLayout: boolean;
  /** The layout config (if useCustomLayout is true) */
  config: Record<string, unknown> | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
}

export function useModuleLayout(
  module: string,
  layoutType: 'detail' | 'edit' | 'create'
): UseModuleLayoutResult {
  const [useCustomLayout, setUseCustomLayout] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkLayoutSetting();
  }, [module, layoutType]);

  const checkLayoutSetting = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await adminApi.checkModuleLayout(module, layoutType);
      setUseCustomLayout(result.useCustomLayout);
      setConfig(result.config);
    } catch (err) {
      console.error('Failed to check layout setting:', err);
      setError('Failed to load layout');
      // Default to standard view on error
      setUseCustomLayout(false);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    useCustomLayout,
    config,
    loading,
    error,
  };
}