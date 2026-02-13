// ============================================================
// FILE: apps/web/src/components/shared/data-table/useTableColumns.ts
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { tableApi } from '../../../api/tablePreferences.api';
import type { TableColumn } from '../../../api/tablePreferences.api';

interface UseTableColumnsReturn {
  /** All available columns for this module (system + custom + computed + utility) */
  allColumns: TableColumn[];
  /** Map: key → TableColumn for quick lookups */
  columnMap: Map<string, TableColumn>;
  /** Default visible column keys (ordered) */
  defaultVisibleKeys: string[];
  /** Loading state */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Re-fetch columns (e.g. after adding a custom field) */
  refetch: () => void;
}

/**
 * Fetches all available table columns for a module from the backend.
 * Backend merges: system fields + custom fields + computed/joined + utility columns.
 */
export function useTableColumns(module: string): UseTableColumnsReturn {
  const [allColumns, setAllColumns] = useState<TableColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    tableApi.getColumns(module)
      .then((columns) => {
        if (!cancelled) {
          setAllColumns(columns);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('Failed to fetch table columns:', err);
          setError('Failed to load column definitions');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [module, fetchKey]);

  const columnMap = useMemo(
    () => new Map(allColumns.map(c => [c.key, c])),
    [allColumns],
  );

  const defaultVisibleKeys = useMemo(
    () => allColumns.filter(c => c.defaultVisible).map(c => c.key),
    [allColumns],
  );

  const refetch = () => setFetchKey(k => k + 1);

  return { allColumns, columnMap, defaultVisibleKeys, loading, error, refetch };
}