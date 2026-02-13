// ============================================================
// FILE: apps/web/src/components/shared/data-table/ColumnSettingsModal.tsx
// ============================================================
import { useState, useRef } from 'react';
import {
  X, GripVertical, Eye, EyeOff, RotateCcw, Check,
} from 'lucide-react';
import type { TableColumn } from '../../../api/tablePreferences.api';

interface ColumnSettingsModalProps {
  allColumns: TableColumn[];
  visibleColumns: string[];
  defaultVisibleKeys: string[];
  onSave: (columns: string[]) => void;
  onClose: () => void;
}

export function ColumnSettingsModal({
  allColumns, visibleColumns, defaultVisibleKeys, onSave, onClose,
}: ColumnSettingsModalProps) {
  // Build ordered list: visible first (in order), then hidden
  const [ordered, setOrdered] = useState<string[]>(() => {
    const visible = visibleColumns.filter(k => allColumns.some(c => c.key === k));
    const hidden = allColumns.filter(c => !visible.includes(c.key)).map(c => c.key);
    return [...visible, ...hidden];
  });
  const [checked, setChecked] = useState<Set<string>>(() => new Set(visibleColumns));

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const colMap = new Map<string, TableColumn>(allColumns.map(c => [c.key, c]));

  // ── Drag handlers ──
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItem.current = index;
  };

  const handleDrop = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = [...ordered];
    const [dragged] = items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, dragged);
    setOrdered(items);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // ── Toggle visibility ──
  const toggleColumn = (key: string) => {
    const col = colMap.get(key);
    if (col?.frozen) return; // Can't hide frozen columns
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Reset to defaults ──
  const resetDefaults = () => {
    setChecked(new Set(defaultVisibleKeys));
    const visible = defaultVisibleKeys.filter(k => allColumns.some(c => c.key === k));
    const hidden = allColumns.filter(c => !visible.includes(c.key)).map(c => c.key);
    setOrdered([...visible, ...hidden]);
  };

  // ── Save ──
  const handleSave = () => {
    const result = ordered.filter(k => checked.has(k));
    onSave(result);
    onClose();
  };

  const sourceLabel = (source: string) => {
    if (source === 'custom') return 'Custom';
    if (source === 'computed') return 'Auto';
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'min(600px, 85vh)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Table Columns</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Drag to reorder · Toggle visibility
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Column List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {ordered.map((key, index) => {
            const col = colMap.get(key);
            if (!col) return null;
            const isVisible = checked.has(key);
            const isFrozen = col.frozen;

            return (
              <div
                key={key}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={handleDrop}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg mb-0.5 cursor-grab active:cursor-grabbing transition-colors ${
                  isVisible
                    ? 'bg-white dark:bg-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800'
                    : 'bg-gray-50 dark:bg-slate-900/50 opacity-60 hover:opacity-80'
                }`}
              >
                {/* Drag handle */}
                <GripVertical className="w-4 h-4 text-gray-300 dark:text-slate-600 flex-shrink-0" />

                {/* Visibility toggle */}
                <button
                  onClick={() => toggleColumn(key)}
                  disabled={isFrozen}
                  className={`p-1 rounded ${
                    isFrozen
                      ? 'text-blue-500 cursor-not-allowed'
                      : isVisible
                      ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                  title={isFrozen ? 'This column is always visible' : isVisible ? 'Hide column' : 'Show column'}
                >
                  {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>

                {/* Column label */}
                <span className={`flex-1 text-sm ${
                  isVisible ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-slate-400'
                }`}>
                  {col.label}
                </span>

                {/* Source indicator */}
                {sourceLabel(col.source) && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    col.source === 'custom'
                      ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500'
                  }`}>
                    {sourceLabel(col.source)}
                  </span>
                )}

                {isFrozen && (
                  <span className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                    Pinned
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30 rounded-b-2xl flex-shrink-0">
          <button
            onClick={resetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              <Check className="w-3.5 h-3.5" />
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}