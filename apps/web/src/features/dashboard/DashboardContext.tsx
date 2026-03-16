// ============================================================
// FILE: apps/web/src/features/dashboard/DashboardContext.tsx
// Event bus + tab filter state for the dashboard.
// v1: filter state only. Cross-widget click filtering in v2.
// ============================================================
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { DATE_RANGE_OPTIONS } from '../../api/dashboard-layout.api';
import type { DashboardTabFilters } from '../../api/dashboard-layout.api';

export interface TabFilterValues {
  dateRangeKey: string;          // 'this_quarter', 'this_month', etc.
  customFrom?: string;           // ISO string if dateRangeKey === 'custom'
  customTo?: string;
  scope: 'own' | 'team' | 'all';
}

export interface CrossWidgetFilter {
  fieldKey: string;
  value: any;
  emittedByWidgetId: string;
}

interface DashboardContextValue {
  // Tab-level filter values (current selections)
  tabFilterValues: TabFilterValues;
  setDateRange: (key: string, from?: string, to?: string) => void;
  setScope: (scope: 'own' | 'team' | 'all') => void;

  // Resolved date range (always absolute ISO strings)
  resolvedDateRange: { from: string; to: string } | null;

  // Cross-widget event bus (v1: emit is no-op, filters always empty)
  crossWidgetFilters: CrossWidgetFilter[];
  emitCrossWidgetFilter: (fieldKey: string, value: any, widgetId: string) => void;
  clearCrossWidgetFilter: (fieldKey: string) => void;
  clearAllCrossWidgetFilters: () => void;

  // Edit mode
  isEditMode: boolean;
  setEditMode: (v: boolean) => void;
}

const DashboardContext = createContext<DashboardContextValue>({
  tabFilterValues: { dateRangeKey: 'this_quarter', scope: 'own' },
  setDateRange: () => {},
  setScope: () => {},
  resolvedDateRange: null,
  crossWidgetFilters: [],
  emitCrossWidgetFilter: () => {},
  clearCrossWidgetFilter: () => {},
  clearAllCrossWidgetFilters: () => {},
  isEditMode: false,
  setEditMode: () => {},
});

export function DashboardProvider({
  children,
  tabFilters,
}: {
  children: ReactNode;
  tabFilters: DashboardTabFilters;
}) {
  const [tabFilterValues, setTabFilterValues] = useState<TabFilterValues>({
    dateRangeKey: tabFilters.dateRange?.default || 'this_quarter',
    scope: (tabFilters.scope?.default as any) || 'own',
  });
  const [crossWidgetFilters, setCrossWidgetFilters] = useState<CrossWidgetFilter[]>([]);
  const [isEditMode, setEditMode] = useState(false);

  const setDateRange = useCallback((key: string, from?: string, to?: string) => {
    setTabFilterValues(prev => ({ ...prev, dateRangeKey: key, customFrom: from, customTo: to }));
  }, []);

  const setScope = useCallback((scope: 'own' | 'team' | 'all') => {
    setTabFilterValues(prev => ({ ...prev, scope }));
  }, []);

  // Resolve the date range to absolute ISO strings
  const resolvedDateRange = (() => {
    if (tabFilterValues.dateRangeKey === 'custom') {
      if (tabFilterValues.customFrom && tabFilterValues.customTo) {
        return { from: tabFilterValues.customFrom, to: tabFilterValues.customTo };
      }
      return null;
    }
    const opt = DATE_RANGE_OPTIONS[tabFilterValues.dateRangeKey];
    return opt ? opt.getRange() : null;
  })();

  // v1: cross-widget filters are no-ops architecturally present
  const emitCrossWidgetFilter = useCallback(
    (fieldKey: string, value: any, widgetId: string) => {
      setCrossWidgetFilters(prev => {
        const existing = prev.findIndex(f => f.fieldKey === fieldKey);
        const updated = { fieldKey, value, emittedByWidgetId: widgetId };
        if (existing >= 0) {
          const copy = [...prev];
          copy[existing] = updated;
          return copy;
        }
        return [...prev, updated];
      });
    },
    [],
  );

  const clearCrossWidgetFilter = useCallback((fieldKey: string) => {
    setCrossWidgetFilters(prev => prev.filter(f => f.fieldKey !== fieldKey));
  }, []);

  const clearAllCrossWidgetFilters = useCallback(() => {
    setCrossWidgetFilters([]);
  }, []);

  return (
    <DashboardContext.Provider value={{
      tabFilterValues,
      setDateRange,
      setScope,
      resolvedDateRange,
      crossWidgetFilters,
      emitCrossWidgetFilter,
      clearCrossWidgetFilter,
      clearAllCrossWidgetFilters,
      isEditMode,
      setEditMode,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export const useDashboard = () => useContext(DashboardContext);

// ── Hook: build runtime filters for a widget ────────────────

export function useWidgetRuntimeFilters(
  filterSensitivity: { respondsToDashboardDateRange: boolean; respondsToDashboardScope: boolean; overrideScope?: string },
  widgetFilters: any[] = [],
): { runtimeFilters: any[]; scope: string } {
  const { tabFilterValues, resolvedDateRange, crossWidgetFilters } = useDashboard();

  const runtimeFilters: any[] = [...(widgetFilters || [])];

  // Apply date range filter if widget is sensitive to it
  if (filterSensitivity.respondsToDashboardDateRange && resolvedDateRange) {
    runtimeFilters.push({
      field: 'created_at',
      operator: 'between',
      value: [resolvedDateRange.from, resolvedDateRange.to],
    });
  }

  // Apply cross-widget filters (v2 will populate these)
  for (const cwf of crossWidgetFilters) {
    runtimeFilters.push({ field: cwf.fieldKey, operator: 'eq', value: cwf.value });
  }

  const scope = filterSensitivity.overrideScope ||
    (filterSensitivity.respondsToDashboardScope ? tabFilterValues.scope : 'all');

  return { runtimeFilters, scope };
}
