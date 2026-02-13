// ============================================================
// FILE: apps/web/src/components/shared/data-table/useTablePreferences.ts
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { tableApi } from '../../../api/tablePreferences.api';
import type { TablePreferences, TableColumn } from '../../../api/tablePreferences.api';

interface UseTablePreferencesReturn {
  visibleColumns: string[];
  pageSize: number;
  sortColumn: string;
  sortOrder: 'ASC' | 'DESC';
  columnWidths: Record<string, number>;
  loading: boolean;
  setVisibleColumns: (cols: string[]) => void;
  setPageSize: (size: number) => void;
  setSortColumn: (col: string) => void;
  setSortOrder: (order: 'ASC' | 'DESC') => void;
  setColumnWidths: (widths: Record<string, number>) => void;
  resetToDefaults: () => void;
}

/**
 * Hook that manages table preferences: loads from backend on mount,
 * auto-saves changes with debounce.
 *
 * @param module - Module name (e.g. 'leads', 'contacts')
 * @param allColumns - Dynamic column list from useTableColumns hook
 * @param defaultVisibleKeys - Default visible keys from useTableColumns
 */
export function useTablePreferences(
  module: string,
  allColumns: TableColumn[],
  defaultVisibleKeys: string[],
): UseTablePreferencesReturn {
  const [visibleColumns, setVisibleColumnsState] = useState<string[]>(defaultVisibleKeys);
  const [pageSize, setPageSizeState] = useState(25);
  const [sortColumn, setSortColumnState] = useState('created_at');
  const [sortOrder, setSortOrderState] = useState<'ASC' | 'DESC'>('DESC');
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);
  const prevDefaultKeys = useRef<string[]>([]);

  // ── Sync defaults when allColumns changes (e.g. after custom field added) ──
  useEffect(() => {
    if (defaultVisibleKeys.length > 0 && !initialLoadDone.current) {
      // Only use defaults before preferences load
      if (JSON.stringify(prevDefaultKeys.current) !== JSON.stringify(defaultVisibleKeys)) {
        setVisibleColumnsState(defaultVisibleKeys);
        prevDefaultKeys.current = defaultVisibleKeys;
      }
    }
  }, [defaultVisibleKeys]);

  // ── Load preferences from backend on mount ──
  useEffect(() => {
    if (allColumns.length === 0) return; // wait for columns to load first
    let cancelled = false;

    const load = async () => {
      try {
        const prefs = await tableApi.getPreferences(module);
        if (cancelled) return;

        if (prefs) {
          // Validate columns still exist in current column set
          const allKeys = new Set(allColumns.map(c => c.key));
          const validCols = prefs.visibleColumns.filter(k => allKeys.has(k));

          if (validCols.length > 0) setVisibleColumnsState(validCols);
          if (prefs.pageSize) setPageSizeState(prefs.pageSize);
          if (prefs.defaultSortColumn) setSortColumnState(prefs.defaultSortColumn);
          if (prefs.defaultSortOrder) setSortOrderState(prefs.defaultSortOrder);
          if (prefs.columnWidths) setColumnWidthsState(prefs.columnWidths);
        }
      } catch (err) {
        console.warn('Failed to load table preferences:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          initialLoadDone.current = true;
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [module, allColumns]);

  // ── Debounced save to backend ──
  const saveToBackend = useCallback((prefs: Partial<TablePreferences>) => {
    if (!initialLoadDone.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      try {
        await tableApi.savePreferences(module, prefs);
      } catch (err) {
        console.warn('Failed to save table preferences:', err);
      }
    }, 800); // debounce 800ms
  }, [module]);

  // ── Setters that auto-save ──
  const setVisibleColumns = useCallback((cols: string[]) => {
    setVisibleColumnsState(cols);
    saveToBackend({ visibleColumns: cols });
  }, [saveToBackend]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    saveToBackend({ pageSize: size });
  }, [saveToBackend]);

  const setSortColumn = useCallback((col: string) => {
    setSortColumnState(col);
    saveToBackend({ defaultSortColumn: col });
  }, [saveToBackend]);

  const setSortOrder = useCallback((order: 'ASC' | 'DESC') => {
    setSortOrderState(order);
    saveToBackend({ defaultSortOrder: order });
  }, [saveToBackend]);

  const setColumnWidths = useCallback((widths: Record<string, number>) => {
    setColumnWidthsState(widths);
    saveToBackend({ columnWidths: widths });
  }, [saveToBackend]);

  const resetToDefaults = useCallback(async () => {
    setVisibleColumnsState(defaultVisibleKeys);
    setPageSizeState(25);
    setSortColumnState('created_at');
    setSortOrderState('DESC');
    setColumnWidthsState({});
    try {
      await tableApi.resetPreferences(module);
    } catch (err) {
      console.warn('Failed to reset preferences:', err);
    }
  }, [module, defaultVisibleKeys]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  return {
    visibleColumns, pageSize, sortColumn, sortOrder, columnWidths, loading,
    setVisibleColumns, setPageSize, setSortColumn, setSortOrder, setColumnWidths,
    resetToDefaults,
  };
}