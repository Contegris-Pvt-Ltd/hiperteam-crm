// ============================================================
// FILE: apps/web/src/features/dashboard/DashboardPage.tsx
// Dynamic BI Dashboard — multi-tab, free-resize grid,
// widget builder panel, tab-level filters.
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import type { Layout, LayoutItem } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  Plus, Edit3, Check, X, MoreHorizontal,
  ChevronDown, LayoutDashboard, Filter, RefreshCw,
  PlusCircle, AlertTriangle, Download, Upload, Share2,
  FileImage, FileText, Loader2,
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { dashboardLayoutApi } from '../../api/dashboard-layout.api';
import type {
  UserDashboard, DashboardWidget,
} from '../../api/dashboard-layout.api';
import { DATE_RANGE_OPTIONS } from '../../api/dashboard-layout.api';
import { DashboardProvider, useDashboard } from './DashboardContext';
import { DashboardWidgetCard } from './DashboardWidget';
import { WidgetBuilderPanel } from './WidgetBuilderPanel';
import { ShareDashboardModal } from './ShareDashboardModal';
import { usePermissions } from '../../hooks/usePermissions';

// ── Reusable modal component ──────────────────────────────────

function DashboardModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function CreateDashboardModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setName(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const handleSubmit = () => {
    if (name.trim()) { onConfirm(name.trim()); setName(''); }
  };

  return (
    <DashboardModal open={open} title="Create New Dashboard" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Dashboard Name
          </label>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="e.g. Sales Overview"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl font-medium"
          >
            Create
          </button>
        </div>
      </div>
    </DashboardModal>
  );
}

function DeleteDashboardModal({
  open,
  dashboardName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  dashboardName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <DashboardModal open={open} title="Delete Dashboard" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <span className="font-semibold">"{dashboardName}"</span>?
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              All widgets in this dashboard will be permanently removed. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </DashboardModal>
  );
}

function ImportDashboardModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (payload: any) => void;
}) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (payload.version !== 1 || !payload.dashboard || !Array.isArray(payload.widgets)) {
        throw new Error('Invalid dashboard export file');
      }
      await onImport(payload);
    } catch (err: any) {
      setError(err.message || 'Failed to import dashboard');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  if (!open) return null;

  return (
    <DashboardModal open={open} title="Import Dashboard" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Select a previously exported dashboard JSON file to import.
        </p>
        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors">
          {importing ? (
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-2" />
          ) : (
            <Upload className="w-8 h-8 text-gray-300 dark:text-slate-600 mb-2" />
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {importing ? 'Importing...' : 'Click to select JSON file'}
          </span>
          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            disabled={importing}
            className="hidden"
          />
        </label>
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </DashboardModal>
  );
}

// ── Grid constants ────────────────────────────────────────────
const GRID_COLS = 12;
const ROW_HEIGHT = 80;
const GRID_MARGIN: [number, number] = [12, 12];

// ── Inner component (inside DashboardProvider) ───────────────

function DashboardInner({
  dashboard,
  widgets,
  onWidgetsChange,
}: {
  dashboard: UserDashboard;
  widgets: DashboardWidget[];
  onWidgetsChange: (widgets: DashboardWidget[]) => void;
}) {
  const { isEditMode, setEditMode, tabFilterValues, setDateRange, setScope } = useDashboard();
  const { canEdit, canExport } = usePermissions();
  const canEditDashboard = canEdit('reports');
  const canExportDashboard = canExport('reports');

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [savingPositions, setSavingPositions] = useState(false);
  const positionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const widgetsRef = useRef(widgets);
  widgetsRef.current = widgets;

  // Export/Share state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  // Measure container width for grid
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Clean up debounce timer on unmount — flush save
  useEffect(() => {
    return () => {
      if (positionSaveTimerRef.current) {
        clearTimeout(positionSaveTimerRef.current);
        positionSaveTimerRef.current = null;
        // Fire save synchronously before unmount
        const ws = widgetsRef.current;
        if (ws.length > 0) {
          dashboardLayoutApi.bulkUpdatePositions(
            dashboard.id,
            ws.map(w => ({ id: w.id, position: w.position })),
          ).catch(() => {});
        }
      }
    };
  }, [dashboard.id]);

  // Build react-grid-layout layout from widgets
  const layout: LayoutItem[] = widgets.map(w => {
    const isScorecard = w.widgetType === 'scorecard';
    return {
      i: w.id,
      x: w.position.x,
      y: w.position.y,
      w: w.position.w,
      h: w.position.h,
      minW: isScorecard ? 2 : 3,
      minH: isScorecard ? 1 : 2,
    };
  });

  // Save current widget positions to backend
  const savePositions = useCallback(async (widgetsToSave?: DashboardWidget[]) => {
    const ws = widgetsToSave || widgetsRef.current;
    if (ws.length === 0) return;
    setSavingPositions(true);
    try {
      await dashboardLayoutApi.bulkUpdatePositions(
        dashboard.id,
        ws.map(w => ({ id: w.id, position: w.position })),
      );
    } catch { /* ignore */ }
    finally { setSavingPositions(false); }
  }, [dashboard.id]);

  // Track whether user has actually dragged/resized (vs. layout change from entering edit mode)
  const userInteractedRef = useRef(false);

  const handleLayoutChange = useCallback((newLayout: Layout) => {
    if (!isEditMode) return;
    // Only update local positions if user has actually interacted (drag/resize)
    if (!userInteractedRef.current) return;

    const currentWidgets = widgetsRef.current;
    const updated = currentWidgets.map(w => {
      const l = newLayout.find(x => x.i === w.id);
      if (!l) return w;
      return { ...w, position: { x: l.x, y: l.y, w: l.w, h: l.h } };
    });
    onWidgetsChange(updated);
  }, [isEditMode, onWidgetsChange]);

  // Save positions when drag or resize finishes — use the full layout array
  // which has ALL widgets' final positions (including pushed/shifted ones)
  const handleDragResizeStop = useCallback((finalLayout: Layout) => {
    if (!isEditMode) return;
    userInteractedRef.current = true;

    const currentWidgets = widgetsRef.current;
    const updated = currentWidgets.map(w => {
      const l = finalLayout.find(x => x.i === w.id);
      if (!l) return w;
      return { ...w, position: { x: l.x, y: l.y, w: l.w, h: l.h } };
    });
    onWidgetsChange(updated);

    // Save to backend immediately (short debounce for rapid successive operations)
    if (positionSaveTimerRef.current) clearTimeout(positionSaveTimerRef.current);
    positionSaveTimerRef.current = setTimeout(() => savePositions(updated), 300);
  }, [isEditMode, onWidgetsChange, savePositions]);

  const handleAddWidget = async (dto: Partial<DashboardWidget>) => {
    try {
      // Find a free position
      const maxY = widgets.reduce((m, w) => Math.max(m, w.position.y + w.position.h), 0);
      const created = await dashboardLayoutApi.createWidget(dashboard.id, {
        ...dto,
        position: { x: 0, y: maxY, w: 6, h: 4 },
      });
      onWidgetsChange([...widgets, created]);
      setBuilderOpen(false);
      setEditingWidget(null);
    } catch (err) {
      console.error('Failed to create widget', err);
    }
  };

  const handleUpdateWidget = async (dto: Partial<DashboardWidget>) => {
    if (!editingWidget) return;
    try {
      const updated = await dashboardLayoutApi.updateWidget(editingWidget.id, dto);
      onWidgetsChange(widgets.map(w => w.id === updated.id ? updated : w));
      setBuilderOpen(false);
      setEditingWidget(null);
    } catch (err) {
      console.error('Failed to update widget', err);
    }
  };

  const handleDeleteWidget = async (widgetId: string) => {
    try {
      await dashboardLayoutApi.deleteWidget(widgetId);
      onWidgetsChange(widgets.filter(w => w.id !== widgetId));
    } catch (err) {
      console.error('Failed to delete widget', err);
    }
  };

  const handleDuplicateWidget = async (widget: DashboardWidget) => {
    try {
      const dup = await dashboardLayoutApi.duplicateWidget(widget.id, dashboard.id);
      onWidgetsChange([...widgets, dup]);
    } catch (err) {
      console.error('Failed to duplicate widget', err);
    }
  };

  const handleEditWidget = (widget: DashboardWidget) => {
    setEditingWidget(widget);
    setBuilderOpen(true);
  };

  const handleExportJSON = async () => {
    setExporting('json');
    setShowExportMenu(false);
    try {
      const payload = await dashboardLayoutApi.exportDashboard(dashboard.id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dashboard.name.replace(/[^a-z0-9]/gi, '_')}_dashboard.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(null);
    }
  };

  // Fix oklch() colors that html2canvas cannot parse
  const handleExportImage = async () => {
    if (!containerRef.current) return;
    setExporting('image');
    setShowExportMenu(false);
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#f9fafb',
        scale: 1.5,
        useCORS: true,
        logging: false,
        scrollY: -window.scrollY,
        windowHeight: containerRef.current.scrollHeight,
        height: containerRef.current.scrollHeight,
        onclone: (_doc, clonedEl) => {
          clonedEl.style.overflow = 'visible';
          clonedEl.style.height = 'auto';
          clonedEl.style.maxHeight = 'none';
        },
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dashboard.name.replace(/[^a-z0-9]/gi, '_')}_dashboard.png`;
      a.click();
    } catch (err) {
      console.error('Image export failed', err);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    if (!containerRef.current) return;
    setExporting('pdf');
    setShowExportMenu(false);
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#f9fafb',
        scale: 1,
        useCORS: true,
        logging: false,
        scrollY: -window.scrollY,
        windowHeight: containerRef.current.scrollHeight,
        height: containerRef.current.scrollHeight,
        onclone: (_doc, clonedEl) => {
          clonedEl.style.overflow = 'visible';
          clonedEl.style.height = 'auto';
          clonedEl.style.maxHeight = 'none';
        },
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.75);
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [imgWidth, imgHeight] });
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${dashboard.name.replace(/[^a-z0-9]/gi, '_')}_dashboard.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
    } finally {
      setExporting(null);
    }
  };

  const currentDateLabel = DATE_RANGE_OPTIONS[tabFilterValues.dateRangeKey]?.label || tabFilterValues.dateRangeKey;
  const scopeLabels = { own: 'My Data', team: 'Team', all: 'All' };

  const gridWidth = containerWidth > 0 ? containerWidth : 1200;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex-shrink-0 flex-wrap">
          {/* Date range picker */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(d => !d)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
            >
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              {currentDateLabel}
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
            {showDatePicker && (
              <div className="absolute top-9 left-0 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl py-1 min-w-40">
                {Object.entries(DATE_RANGE_OPTIONS).map(([key, opt]) => (
                  <button
                    key={key}
                    onClick={() => { setDateRange(key); setShowDatePicker(false); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between ${
                      tabFilterValues.dateRangeKey === key ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {opt.label}
                    {tabFilterValues.dateRangeKey === key && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scope picker */}
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden text-xs">
            {(['own', 'team', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-1.5 transition-colors ${
                  tabFilterValues.scope === s
                    ? 'bg-purple-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {scopeLabels[s]}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Saving indicator */}
          {savingPositions && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
            </span>
          )}

          {/* Exporting indicator */}
          {exporting && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Exporting...
            </span>
          )}

          {/* Export menu */}
          {!isEditMode && canExportDashboard && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(m => !m)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300"
              >
                <Download className="w-3.5 h-3.5" /> Export
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-9 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl py-1 min-w-44">
                  <button
                    onClick={handleExportJSON}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-gray-400" /> Export as JSON
                  </button>
                  <button
                    onClick={handleExportImage}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <FileImage className="w-3.5 h-3.5 text-gray-400" /> Export as Image
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-gray-400" /> Export as PDF
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Share button */}
          {!isEditMode && canEditDashboard && (
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          )}

          {/* Edit mode toggle */}
          {canEditDashboard && (
            isEditMode ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setBuilderOpen(true); setEditingWidget(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Add Widget
                </button>
                <button
                  onClick={() => {
                    // Flush any pending position save
                    if (positionSaveTimerRef.current) {
                      clearTimeout(positionSaveTimerRef.current);
                      positionSaveTimerRef.current = null;
                    }
                    savePositions();
                    userInteractedRef.current = false;
                    setEditMode(false); setBuilderOpen(false); setEditingWidget(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg"
                >
                  <Check className="w-3.5 h-3.5" /> Done
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Dashboard
              </button>
            )
          )}
        </div>

        {/* Grid area */}
        <div className={`flex-1 overflow-auto bg-gray-50 dark:bg-slate-950 p-4${!isEditMode ? ' [&_.react-resizable-handle]:hidden' : ''}`} ref={containerRef}>
          {widgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-center">
              <LayoutDashboard className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
                No widgets yet
              </h3>
              <p className="text-sm text-gray-400 dark:text-slate-500 mb-4 max-w-sm">
                Click "Edit Dashboard" then "Add Widget" to start building your dashboard.
              </p>
              {canEditDashboard && (
                <button
                  onClick={() => { setEditMode(true); setBuilderOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Add Your First Widget
                </button>
              )}
            </div>
          ) : (
            <GridLayout
              layout={layout}
              cols={GRID_COLS}
              rowHeight={ROW_HEIGHT}
              width={gridWidth}
              margin={GRID_MARGIN}
              isDraggable={isEditMode}
              isResizable={isEditMode}
              onLayoutChange={handleLayoutChange}
              onDragStop={handleDragResizeStop}
              onResizeStop={handleDragResizeStop}
              draggableHandle=".drag-handle"
              resizeHandles={['se', 'sw', 'ne', 'nw']}
            >
              {widgets.map(widget => (
                <div key={widget.id} className={isEditMode ? 'drag-handle' : ''}>
                  <DashboardWidgetCard
                    widget={widget}
                    onEdit={handleEditWidget}
                    onDuplicate={handleDuplicateWidget}
                    onDelete={handleDeleteWidget}
                  />
                </div>
              ))}
            </GridLayout>
          )}
        </div>
      </div>

      {/* Widget builder side panel */}
      {builderOpen && (
        <div className="w-80 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 overflow-hidden flex flex-col">
          <WidgetBuilderPanel
            widget={editingWidget}
            onSave={editingWidget ? handleUpdateWidget : handleAddWidget}
            onCancel={() => { setBuilderOpen(false); setEditingWidget(null); }}
          />
        </div>
      )}

      {/* Share modal */}
      <ShareDashboardModal
        open={showShareModal}
        dashboardId={dashboard.id}
        dashboardName={dashboard.name}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
}

// ── Tab bar component ─────────────────────────────────────────

function TabBar({
  dashboards,
  activeDashboardId,
  onSelect,
  onCreate,
  onImport,
  onRename,
  onDelete,
  canCreate,
  canDelete,
}: {
  dashboards: UserDashboard[];
  activeDashboardId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [tabMenuId, setTabMenuId] = useState<string | null>(null);

  const startRename = (d: UserDashboard) => {
    setRenamingId(d.id);
    setRenameValue(d.name);
    setTabMenuId(null);
  };

  const commitRename = (id: string) => {
    if (renameValue.trim()) onRename(id, renameValue.trim());
    setRenamingId(null);
  };

  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const openTabMenu = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (tabMenuId === id) {
      setTabMenuId(null);
      setMenuPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
    setTabMenuId(id);
  };

  // Close tab menu when clicking outside
  useEffect(() => {
    if (!tabMenuId) return;
    const handler = () => setTabMenuId(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tabMenuId]);

  return (
    <div className="flex items-center gap-1 px-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 overflow-x-auto flex-shrink-0">
      {dashboards.map(d => (
        <div
          key={d.id}
          className="flex items-center gap-1 flex-shrink-0"
        >
          {renamingId === d.id ? (
            <div className="flex items-center gap-1 px-2 py-2">
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename(d.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="text-sm border border-purple-400 rounded px-2 py-0.5 bg-white dark:bg-slate-800 dark:text-white w-32 outline-none"
              />
              <button onClick={() => commitRename(d.id)} className="text-green-500 hover:text-green-600">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setRenamingId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onSelect(d.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeDashboardId === d.id
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              {d.name}
            </button>
          )}

          {/* Tab context menu trigger */}
          {renamingId !== d.id && (
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => openTabMenu(d.id, e)}
              className="p-0.5 text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400 rounded"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      {/* Tab context menu — fixed position, rendered outside overflow */}
      {tabMenuId && menuPos && (
        <div
          className="fixed z-[200] w-36 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            onClick={() => { const d = dashboards.find(dd => dd.id === tabMenuId); if (d) startRename(d); }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Rename
          </button>
          {dashboards.length > 1 && canDelete && (
            <button
              onClick={() => { const id = tabMenuId; setTabMenuId(null); onDelete(id); }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Delete tab
            </button>
          )}
        </div>
      )}

      {/* New tab + Import buttons */}
      {canCreate && (
        <>
          <button
            onClick={onCreate}
            className="flex items-center gap-1 px-3 py-3 text-sm text-gray-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 flex-shrink-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New tab
          </button>
          <button
            onClick={onImport}
            className="flex items-center gap-1 px-3 py-3 text-sm text-gray-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 flex-shrink-0 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
        </>
      )}
    </div>
  );
}

// ── Main exported component ───────────────────────────────────

export function DashboardPage() {
  const { canCreate, canDelete } = usePermissions();
  const canCreateDashboard = canCreate('reports');
  const canDeleteDashboard = canDelete('reports');

  const [dashboards, setDashboards] = useState<UserDashboard[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string>('');
  const [widgetsByDashboard, setWidgetsByDashboard] = useState<Record<string, DashboardWidget[]>>({});
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingDashboard, setDeletingDashboard] = useState<UserDashboard | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const activeDashboard = dashboards.find(d => d.id === activeDashboardId);
  const activeWidgets = widgetsByDashboard[activeDashboardId] || [];

  // Load dashboards on mount
  useEffect(() => {
    dashboardLayoutApi.listDashboards()
      .then(async ds => {
        setDashboards(ds);
        const defaultTab = ds.find(d => d.isDefault) || ds[0];
        if (defaultTab) {
          setActiveDashboardId(defaultTab.id);
          const ws = await dashboardLayoutApi.listWidgets(defaultTab.id);
          setWidgetsByDashboard({ [defaultTab.id]: ws });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load widgets when switching tabs
  const handleSelectDashboard = async (id: string) => {
    setActiveDashboardId(id);
    if (!widgetsByDashboard[id]) {
      const ws = await dashboardLayoutApi.listWidgets(id);
      setWidgetsByDashboard(prev => ({ ...prev, [id]: ws }));
    }
  };

  const handleCreateDashboard = async (name: string) => {
    try {
      const created = await dashboardLayoutApi.createDashboard(name);
      setDashboards(prev => [...prev, created]);
      setWidgetsByDashboard(prev => ({ ...prev, [created.id]: [] }));
      setActiveDashboardId(created.id);
    } catch (err) {
      console.error('Failed to create dashboard', err);
    }
    setShowCreateModal(false);
  };

  const handleRenameDashboard = async (id: string, name: string) => {
    try {
      const updated = await dashboardLayoutApi.updateDashboard(id, { name });
      setDashboards(prev => prev.map(d => d.id === id ? updated : d));
    } catch (err) {
      console.error('Failed to rename dashboard', err);
    }
  };

  const handleDeleteDashboard = async () => {
    if (!deletingDashboard) return;
    const id = deletingDashboard.id;
    try {
      await dashboardLayoutApi.deleteDashboard(id);
      const remaining = dashboards.filter(d => d.id !== id);
      setDashboards(remaining);
      setWidgetsByDashboard(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
      if (activeDashboardId === id && remaining.length > 0) {
        handleSelectDashboard(remaining[0].id);
      }
    } catch (err) {
      console.error('Failed to delete dashboard', err);
    }
    setDeletingDashboard(null);
  };

  const handleRequestDelete = (id: string) => {
    const d = dashboards.find(db => db.id === id);
    if (d) setDeletingDashboard(d);
  };

  const handleImportDashboard = async (payload: any) => {
    try {
      const result = await dashboardLayoutApi.importDashboard(payload);
      setDashboards(prev => [...prev, result.dashboard]);
      setWidgetsByDashboard(prev => ({ ...prev, [result.dashboard.id]: result.widgets }));
      setActiveDashboardId(result.dashboard.id);
    } catch (err) {
      console.error('Failed to import dashboard', err);
      throw err;
    }
    setShowImportModal(false);
  };

  const handleWidgetsChange = (dashboardId: string, widgets: DashboardWidget[]) => {
    setWidgetsByDashboard(prev => ({ ...prev, [dashboardId]: widgets }));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 dark:text-slate-500">Loading dashboard...</p>
      </div>
    </div>
  );

  if (dashboards.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full">
      <LayoutDashboard className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
      <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No dashboards</h2>
      {canCreateDashboard && (
        <>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium"
          >
            Create Dashboard
          </button>
          <CreateDashboardModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onConfirm={handleCreateDashboard}
          />
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden -m-4 lg:-m-6">
      {/* Tab bar */}
      <TabBar
        dashboards={dashboards}
        activeDashboardId={activeDashboardId}
        onSelect={handleSelectDashboard}
        onCreate={() => setShowCreateModal(true)}
        onImport={() => setShowImportModal(true)}
        onRename={handleRenameDashboard}
        onDelete={handleRequestDelete}
        canCreate={canCreateDashboard}
        canDelete={canDeleteDashboard}
      />

      {/* Dashboard content — wrapped in context provider per tab */}
      {activeDashboard && (
        <DashboardProvider
          key={activeDashboard.id}
          tabFilters={activeDashboard.tabFilters}
        >
          <DashboardInner
            dashboard={activeDashboard}
            widgets={activeWidgets}
            onWidgetsChange={(ws) => handleWidgetsChange(activeDashboard.id, ws)}
          />
        </DashboardProvider>
      )}

      {/* Modals */}
      <CreateDashboardModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreateDashboard}
      />
      <DeleteDashboardModal
        open={!!deletingDashboard}
        dashboardName={deletingDashboard?.name || ''}
        onClose={() => setDeletingDashboard(null)}
        onConfirm={handleDeleteDashboard}
      />
      <ImportDashboardModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportDashboard}
      />
    </div>
  );
}
