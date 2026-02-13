// ============================================================
// FILE: apps/web/src/components/shared/data-table/DataTable.tsx
// ============================================================
import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Loader2,
  Columns3, Search, X,
} from 'lucide-react';
import type { TableColumn } from '../../../api/tablePreferences.api';
import { ColumnSettingsModal } from './ColumnSettingsModal';
import { formatDistanceToNow, format } from 'date-fns';

// ============================================================
// TYPES
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DataTableProps<T = any> {
  /** Module name */
  module: string;
  /** All available columns from useTableColumns */
  allColumns: TableColumn[];
  /** Default visible column keys from useTableColumns */
  defaultVisibleKeys: string[];
  /** Data rows from API */
  data: T[];
  /** Loading state */
  loading?: boolean;
  /** Pagination meta from API */
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  /** Currently visible column keys (from useTablePreferences) */
  visibleColumns: string[];
  /** Current sort column key */
  sortColumn: string;
  /** Current sort direction */
  sortOrder: 'ASC' | 'DESC';
  /** Current page size */
  pageSize: number;
  /** Column widths override */
  columnWidths?: Record<string, number>;

  // ── Callbacks ──
  onSort: (column: string, order: 'ASC' | 'DESC') => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onColumnsChange: (columns: string[]) => void;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  onRowClick?: (row: T) => void;

  /** Optional: override cell renderer for specific columns */
  renderCell?: (column: TableColumn, value: unknown, row: T) => React.ReactNode | undefined;
  /** Optional: row actions column */
  renderActions?: (row: T) => React.ReactNode;
  /** Empty state message */
  emptyMessage?: string;
  /** Search input value (optional external control) */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
}

// ============================================================
// MEDIA QUERY HOOK
// ============================================================
function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mql); // sync on mount
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

// ============================================================
// PAGE SIZE OPTIONS
// ============================================================
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ============================================================
// COMPONENT
// ============================================================
export function DataTable<T>({
  module, allColumns, defaultVisibleKeys, data, loading, meta,
  visibleColumns, sortColumn, sortOrder, pageSize,
  columnWidths = {},
  onSort, onPageChange, onPageSizeChange, onColumnsChange, onColumnWidthsChange,
  onRowClick, renderCell, renderActions,
  emptyMessage = 'No records found',
  searchValue, onSearchChange, onSearchSubmit,
}: DataTableProps<T>) {
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const isMobile = useIsMobile();

  const colMap = useMemo(() => new Map(allColumns.map(c => [c.key, c])), [allColumns]);

  // Build ordered column list from visibleColumns
  const columns = useMemo(() => {
    return visibleColumns
      .map(key => colMap.get(key))
      .filter((c): c is TableColumn => !!c);
  }, [visibleColumns, colMap]);

  // Split columns into frozen (card header) vs non-frozen (card body)
  const frozenCol = useMemo(() => columns.find(c => c.frozen), [columns]);
  const bodyColumns = useMemo(() => columns.filter(c => !c.frozen), [columns]);

  // ── Drag-reorder on headers ──
  const dragCol = useRef<number | null>(null);
  const dragOverCol = useRef<number | null>(null);

  const handleHeaderDragStart = (index: number) => {
    dragCol.current = index;
  };
  const handleHeaderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverCol.current = index;
  };
  const handleHeaderDrop = () => {
    if (dragCol.current === null || dragOverCol.current === null) return;
    if (dragCol.current === dragOverCol.current) return;
    const newOrder = [...visibleColumns];
    const [dragged] = newOrder.splice(dragCol.current, 1);
    newOrder.splice(dragOverCol.current, 0, dragged);
    onColumnsChange(newOrder);
    dragCol.current = null;
    dragOverCol.current = null;
  };

  // ── Sort handler ──
  const handleSort = useCallback((col: TableColumn) => {
    if (!col.sortable) return;
    const sortKey = col.sortKey || col.key;
    if (sortColumn === sortKey) {
      onSort(sortKey, sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      onSort(sortKey, 'DESC');
    }
  }, [sortColumn, sortOrder, onSort]);

  // ── Pagination helpers ──
  const startRecord = Math.min((meta.page - 1) * meta.limit + 1, meta.total);
  const endRecord = Math.min(meta.page * meta.limit, meta.total);

  // ── Pagination range (desktop) ──
  const pageRange = useMemo(() => {
    const total = meta.totalPages;
    const current = meta.page;
    const range: (number | 'ellipsis')[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) range.push(i);
    } else {
      range.push(1);
      if (current > 3) range.push('ellipsis');
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        range.push(i);
      }
      if (current < total - 2) range.push('ellipsis');
      range.push(total);
    }
    return range;
  }, [meta.page, meta.totalPages]);

  // ── Mobile pagination (simplified: prev/current/next only) ──
  const mobilePageRange = useMemo(() => {
    const range: number[] = [];
    const current = meta.page;
    const total = meta.totalPages;
    if (total <= 3) {
      for (let i = 1; i <= total; i++) range.push(i);
    } else {
      if (current === 1) range.push(1, 2, 3);
      else if (current === total) range.push(total - 2, total - 1, total);
      else range.push(current - 1, current, current + 1);
    }
    return range;
  }, [meta.page, meta.totalPages]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          {/* Search (if controlled externally) */}
          {onSearchChange && (
            <form onSubmit={(e) => { e.preventDefault(); onSearchSubmit?.(); }} className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                className="pl-9 pr-8 py-1.5 w-40 sm:w-56 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              {searchValue && (
                <button type="button" onClick={() => { onSearchChange(''); onSearchSubmit?.(); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </form>
          )}
          <span className="text-sm text-gray-500 dark:text-slate-400 hidden sm:inline">
            {meta.total} record{meta.total !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-gray-500 dark:text-slate-400 sm:hidden">
            {meta.total}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Page size selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-slate-400 hidden sm:inline">Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {PAGE_SIZE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Column settings button */}
          <button
            onClick={() => setShowColumnSettings(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            title="Column settings"
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Columns</span>
          </button>
        </div>
      </div>

      {/* ── Loading / Empty states ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
        </div>
      ) : data.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-sm text-gray-500 dark:text-slate-400">{emptyMessage}</p>
        </div>
      ) : isMobile ? (
        /* ════════════════════════════════════════════════════════════
           MOBILE: CARD VIEW
           ════════════════════════════════════════════════════════════ */
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {data.map((row, rowIndex) => {
            const rowObj = row as Record<string, unknown>;

            // Frozen column value = card header
            const headerValue = frozenCol ? getNestedValue(rowObj, frozenCol.key) : null;
            const headerCustom = frozenCol ? renderCell?.(frozenCol, headerValue, row) : undefined;

            return (
              <div
                key={String(rowObj.id || rowIndex)}
                onClick={() => onRowClick?.(row)}
                className={`px-4 py-3 ${
                  onRowClick ? 'cursor-pointer active:bg-blue-50 dark:active:bg-slate-800' : ''
                }`}
              >
                {/* Card header — frozen column (name/title) + actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {headerCustom !== undefined ? (
                      headerCustom
                    ) : frozenCol ? (
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {headerValue != null ? String(headerValue) : '—'}
                      </p>
                    ) : null}
                  </div>
                  {renderActions && (
                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {renderActions(row)}
                    </div>
                  )}
                </div>

                {/* Card body — remaining visible columns as label:value grid */}
                {bodyColumns.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {bodyColumns.map((col) => {
                      const value = getNestedValue(rowObj, col.key);
                      const custom = renderCell?.(col, value, row);

                      return (
                        <div key={col.key} className="min-w-0">
                          <p className="text-[10px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider leading-tight">
                            {col.label}
                          </p>
                          <div className="text-sm text-gray-700 dark:text-slate-300 truncate mt-0.5">
                            {custom !== undefined ? (
                              custom
                            ) : (
                              <CellRenderer column={col} value={value} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════
           DESKTOP: TABLE VIEW
           ════════════════════════════════════════════════════════════ */
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Header */}
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                {columns.map((col, index) => {
                  const sortKey = col.sortKey || col.key;
                  const isSorted = sortColumn === sortKey;
                  const isSortable = col.sortable;
                  const width = columnWidths[col.key] || col.defaultWidth || 150;

                  return (
                    <th
                      key={col.key}
                      draggable={!col.frozen}
                      onDragStart={() => handleHeaderDragStart(index)}
                      onDragOver={(e) => handleHeaderDragOver(e, index)}
                      onDrop={handleHeaderDrop}
                      onClick={() => isSortable && handleSort(col)}
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider select-none whitespace-nowrap ${
                        isSortable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50' : ''
                      } ${col.frozen ? 'sticky left-0 z-10 bg-white dark:bg-slate-900' : ''} ${
                        !col.frozen ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${isSorted ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'}`}
                      style={col.frozen ? { width, minWidth: width } : { width, minWidth: 80 }}
                      title={isSortable ? `Sort by ${col.label}` : col.label}
                    >
                      <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                        {col.label}
                        {isSortable && (
                          <span className="inline-flex">
                            {isSorted ? (
                              sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
                {renderActions && (
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 sticky right-0 bg-white dark:bg-slate-900 w-16">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
              {data.map((row, rowIndex) => (
                <tr
                  key={String((row as Record<string, unknown>).id || rowIndex)}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800/50' : 'hover:bg-gray-50/50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  {columns.map((col) => {
                    const value = getNestedValue(row as Record<string, unknown>, col.key);
                    // Check for custom render override
                    const custom = renderCell?.(col, value, row);
                    if (custom !== undefined) {
                      const w = columnWidths[col.key] || col.defaultWidth || 150;
                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-3 text-sm ${col.frozen ? 'sticky left-0 z-10 bg-white dark:bg-slate-900' : ''}`}
                          style={col.frozen ? { width: w, minWidth: w } : { width: w }}
                        >
                          {custom}
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-sm ${col.frozen ? 'sticky left-0 z-10 bg-white dark:bg-slate-900' : ''} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                        style={col.frozen ? { width: columnWidths[col.key] || col.defaultWidth || 150, minWidth: columnWidths[col.key] || col.defaultWidth || 150 } : { width: columnWidths[col.key] || col.defaultWidth || 150 }}
                      >
                        <CellRenderer column={col} value={value} />
                      </td>
                    );
                  })}
                  {renderActions && (
                    <td className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-slate-900">
                      {renderActions(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {meta.totalPages > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-800">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            <span className="hidden sm:inline">Showing </span>{startRecord}–{endRecord}<span className="hidden sm:inline"> of {meta.total}</span>
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(meta.page - 1)}
              disabled={meta.page <= 1}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Desktop: full page range */}
            <div className="hidden sm:flex items-center gap-1">
              {pageRange.map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e-${i}`} className="px-1 text-gray-400 dark:text-slate-500 text-xs">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${
                      p === meta.page
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>

            {/* Mobile: simplified page range */}
            <div className="flex sm:hidden items-center gap-1">
              {mobilePageRange.map((p) => (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${
                    p === meta.page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => onPageChange(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Column Settings Modal ── */}
      {showColumnSettings && (
        <ColumnSettingsModal
          allColumns={allColumns}
          visibleColumns={visibleColumns}
          defaultVisibleKeys={defaultVisibleKeys}
          onSave={onColumnsChange}
          onClose={() => setShowColumnSettings(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// CELL RENDERER
// ============================================================

function CellRenderer({ column, value }: { column: TableColumn; value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-300 dark:text-slate-600">—</span>;
  }

  switch (column.type) {
    case 'badge': {
      const str = String(value);
      const colorKey = str.toLowerCase();
      const colors: Record<string, string> = column.badgeColors || {};
      const color = colors[colorKey] || guessColor(colorKey);
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeClasses(color)}`}>
          {str}
        </span>
      );
    }

    case 'date':
      return <span className="text-gray-700 dark:text-slate-300 whitespace-nowrap">{formatDate(value)}</span>;

    case 'datetime':
      return (
        <span className="text-gray-700 dark:text-slate-300 whitespace-nowrap" title={formatDateTime(value)}>
          {formatRelative(value)}
        </span>
      );

    case 'currency':
      return <span className="text-gray-900 dark:text-white font-medium tabular-nums">{formatCurrency(value)}</span>;

    case 'number':
      return <span className="text-gray-900 dark:text-white tabular-nums">{String(value)}</span>;

    case 'link':
      return (
        <a
          href={String(value).startsWith('http') ? String(value) : `https://${value}`}
          target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-[200px]"
        >
          {String(value).replace(/^https?:\/\/(www\.)?/, '')}
        </a>
      );

    case 'tags': {
      const tags = Array.isArray(value) ? value : [];
      if (tags.length === 0) return <span className="text-gray-300 dark:text-slate-600">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((t: string, i: number) => (
            <span key={i} className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 text-xs rounded">
              {t}
            </span>
          ))}
          {tags.length > 3 && <span className="text-xs text-gray-400">+{tags.length - 3}</span>}
        </div>
      );
    }

    case 'boolean':
      return value ? (
        <span className="text-green-600">Yes</span>
      ) : (
        <span className="text-gray-400">No</span>
      );

    default:
      return <span className="text-gray-900 dark:text-white truncate block">{String(value)}</span>;
  }
}

// ============================================================
// HELPERS
// ============================================================

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function formatDate(value: unknown): string {
  try {
    return format(new Date(String(value)), 'MMM d, yyyy');
  } catch {
    return String(value);
  }
}

function formatDateTime(value: unknown): string {
  try {
    return format(new Date(String(value)), 'MMM d, yyyy h:mm a');
  } catch {
    return String(value);
  }
}

function formatRelative(value: unknown): string {
  try {
    return formatDistanceToNow(new Date(String(value)), { addSuffix: true });
  } catch {
    return String(value);
  }
}

function formatCurrency(value: unknown): string {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
}

function guessColor(str: string): string {
  if (['active', 'completed', 'won', 'converted', 'yes'].includes(str)) return 'green';
  if (['inactive', 'pending', 'draft'].includes(str)) return 'gray';
  if (['suspended', 'disqualified', 'lost', 'churned', 'discontinued', 'no'].includes(str)) return 'red';
  if (['new', 'prospect', 'lead'].includes(str)) return 'blue';
  if (['hot', 'urgent', 'critical'].includes(str)) return 'orange';
  if (['warm', 'medium'].includes(str)) return 'yellow';
  if (['cold'].includes(str)) return 'cyan';
  return 'gray';
}

function getBadgeClasses(color: string): string {
  const map: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    gray: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400',
  };
  return map[color] || map.gray;
}