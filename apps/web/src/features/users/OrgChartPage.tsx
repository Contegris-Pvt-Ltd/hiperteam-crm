import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, ChevronDown, ChevronRight, Search, Loader2,
  AlertCircle, Maximize2, Minimize2, ZoomIn, ZoomOut,
  Building2, Mail, Phone, ArrowLeft, UserCircle, Filter,
  ChevronUp,
} from 'lucide-react';
import { api } from '../../api/contacts.api';

// ============================================================
// TYPES
// ============================================================
interface OrgNode {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  status: string;
  managerId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  roleName: string | null;
  directReportCount: number;
  children: OrgNode[];
}

interface OrgTreeResponse {
  tree: OrgNode[];
  total: number;
}

// ============================================================
// API
// ============================================================
const orgApi = {
  getOrgTree: async (): Promise<OrgTreeResponse> => {
    const { data } = await api.get('/users/org-tree');
    return data;
  },
};

// ============================================================
// HELPER: initials from name
// ============================================================
function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

// ============================================================
// HELPER: color by department
// ============================================================
const DEPT_COLORS: Record<string, string> = {};
const COLOR_PALETTE = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-pink-600',
];
let colorIndex = 0;

function getDeptColor(deptName: string | null): string {
  if (!deptName) return 'from-gray-400 to-gray-500';
  if (!DEPT_COLORS[deptName]) {
    DEPT_COLORS[deptName] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
    colorIndex++;
  }
  return DEPT_COLORS[deptName];
}

// ============================================================
// NODE CARD COMPONENT
// ============================================================
function NodeCard({
  node,
  isExpanded,
  onToggle,
  onSelect,
  isSelected,
  isCompact,
}: {
  node: OrgNode;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
  isCompact: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const deptColor = getDeptColor(node.departmentName);

  if (isCompact) {
    return (
      <div
        className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md shadow-blue-500/10'
            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
        }`}
        onClick={onSelect}
      >
        {/* Avatar */}
        {node.avatarUrl ? (
          <img src={node.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className={`w-8 h-8 bg-gradient-to-br ${deptColor} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
            {getInitials(node.firstName, node.lastName)}
          </div>
        )}

        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {node.firstName} {node.lastName}
          </p>
          {node.jobTitle && (
            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{node.jobTitle}</p>
          )}
        </div>

        {/* Expand toggle */}
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="ml-auto p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 flex-shrink-0"
          >
            {isExpanded
              ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
              : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            }
            <span className="sr-only">{isExpanded ? 'Collapse' : 'Expand'}</span>
          </button>
        )}

        {/* Report count badge */}
        {hasChildren && !isExpanded && (
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-gray-600 dark:bg-slate-500 text-white px-1.5 py-0.5 rounded-full">
            {node.directReportCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl border-2 cursor-pointer transition-all hover:shadow-lg w-56 ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-500/10'
          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
      }`}
      onClick={onSelect}
    >
      {/* Dept color bar */}
      <div className={`h-1.5 rounded-t-xl bg-gradient-to-r ${deptColor}`} />

      <div className="p-4 text-center">
        {/* Avatar */}
        {node.avatarUrl ? (
          <img src={node.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover mx-auto mb-2 ring-2 ring-white dark:ring-slate-700 shadow-md" />
        ) : (
          <div className={`w-14 h-14 bg-gradient-to-br ${deptColor} rounded-full flex items-center justify-center text-white text-lg font-bold mx-auto mb-2 ring-2 ring-white dark:ring-slate-700 shadow-md`}>
            {getInitials(node.firstName, node.lastName)}
          </div>
        )}

        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {node.firstName} {node.lastName}
        </p>
        {node.jobTitle && (
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">{node.jobTitle}</p>
        )}
        {node.departmentName && (
          <span className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gradient-to-r ${deptColor} text-white`}>
            {node.departmentName}
          </span>
        )}
      </div>

      {/* Expand/collapse */}
      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm text-xs font-medium text-gray-600 dark:text-slate-300 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Hide
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              {node.directReportCount}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ============================================================
// TREE NODE (recursive)
// ============================================================
function TreeNode({
  node,
  expandedIds,
  onToggle,
  selectedId,
  onSelect,
  isCompact,
  depth,
}: {
  node: OrgNode;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isCompact: boolean;
  depth: number;
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* This node's card */}
      <NodeCard
        node={node}
        isExpanded={isExpanded}
        onToggle={() => onToggle(node.id)}
        onSelect={() => onSelect(node.id)}
        isSelected={selectedId === node.id}
        isCompact={isCompact}
      />

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col items-center mt-8">
          {/* Vertical connector line from parent */}
          <div className="w-px h-6 bg-gray-300 dark:bg-slate-600" />

          {/* Horizontal line across children */}
          {node.children.length > 1 && (
            <div className="relative w-full flex justify-center">
              <div
                className="h-px bg-gray-300 dark:bg-slate-600 absolute top-0"
                style={{
                  left: `${100 / (node.children.length * 2)}%`,
                  right: `${100 / (node.children.length * 2)}%`,
                }}
              />
            </div>
          )}

          {/* Child nodes */}
          <div className="flex gap-6 items-start">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical connector to child */}
                <div className="w-px h-6 bg-gray-300 dark:bg-slate-600" />
                <TreeNode
                  node={child}
                  expandedIds={expandedIds}
                  onToggle={onToggle}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  isCompact={isCompact}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DETAIL SIDEBAR
// ============================================================
function DetailSidebar({
  node,
  onClose,
  onNavigate,
}: {
  node: OrgNode | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  if (!node) return null;

  const deptColor = getDeptColor(node.departmentName);

  return (
    <div className="w-80 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 overflow-y-auto">
      <div className="p-5">
        {/* Close */}
        <div className="flex justify-end mb-4">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Avatar + Name */}
        <div className="text-center mb-6">
          {node.avatarUrl ? (
            <img src={node.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-3 ring-4 ring-gray-100 dark:ring-slate-800 shadow-lg" />
          ) : (
            <div className={`w-20 h-20 bg-gradient-to-br ${deptColor} rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3 ring-4 ring-gray-100 dark:ring-slate-800 shadow-lg`}>
              {getInitials(node.firstName, node.lastName)}
            </div>
          )}
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {node.firstName} {node.lastName}
          </h3>
          {node.jobTitle && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{node.jobTitle}</p>
          )}
          {node.departmentName && (
            <span className={`inline-block mt-2 text-xs font-medium px-3 py-1 rounded-full bg-gradient-to-r ${deptColor} text-white`}>
              {node.departmentName}
            </span>
          )}
        </div>

        {/* Info rows */}
        <div className="space-y-3">
          {node.email && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a href={`mailto:${node.email}`} className="text-sm text-blue-600 dark:text-blue-400 truncate hover:underline">
                {node.email}
              </a>
            </div>
          )}
          {node.phone && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a href={`tel:${node.phone}`} className="text-sm text-gray-700 dark:text-slate-300 truncate">
                {node.phone}
              </a>
            </div>
          )}
          {node.roleName && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <UserCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-slate-300 capitalize">{node.roleName}</span>
            </div>
          )}
        </div>

        {/* Direct Reports */}
        {node.children.length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Direct Reports ({node.children.length})
            </h4>
            <div className="space-y-2">
              {node.children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onNavigate(child.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  {child.avatarUrl ? (
                    <img src={child.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className={`w-8 h-8 bg-gradient-to-br ${getDeptColor(child.departmentName)} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                      {getInitials(child.firstName, child.lastName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {child.firstName} {child.lastName}
                    </p>
                    {child.jobTitle && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{child.jobTitle}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LIST VIEW (alternative flat view)
// ============================================================
function ListView({
  nodes,
  search,
  selectedId,
  onSelect,
  filterDept,
}: {
  nodes: OrgNode[];
  search: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  filterDept: string;
}) {
  // Flatten the tree
  const flatList: OrgNode[] = [];
  const flatten = (items: OrgNode[]) => {
    for (const item of items) {
      flatList.push(item);
      if (item.children.length > 0) flatten(item.children);
    }
  };
  flatten(nodes);

  // Filter
  const filtered = flatList.filter((n) => {
    const matchesSearch = !search || `${n.firstName} ${n.lastName} ${n.email} ${n.jobTitle || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesDept = !filterDept || n.departmentName === filterDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="divide-y divide-gray-100 dark:divide-slate-800">
      {filtered.length === 0 && (
        <div className="py-12 text-center text-gray-400 dark:text-slate-500">
          No users match the current filters
        </div>
      )}
      {filtered.map((node) => {
        const deptColor = getDeptColor(node.departmentName);
        return (
          <button
            key={node.id}
            onClick={() => onSelect(node.id)}
            className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors ${
              selectedId === node.id
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
            }`}
          >
            {node.avatarUrl ? (
              <img src={node.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className={`w-10 h-10 bg-gradient-to-br ${deptColor} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                {getInitials(node.firstName, node.lastName)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {node.firstName} {node.lastName}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                {[node.jobTitle, node.departmentName].filter(Boolean).join(' · ')}
              </p>
            </div>
            {node.directReportCount > 0 && (
              <span className="text-xs font-medium text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {node.directReportCount} reports
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export function OrgChartPage() {
  const navigate = useNavigate();

  // Data
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [isCompact, setIsCompact] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Canvas panning
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Load data
  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await orgApi.getOrgTree();
      setTree(data.tree);
      setTotal(data.total);
      // Auto-expand first 2 levels
      const idsToExpand = new Set<string>();
      for (const root of data.tree) {
        idsToExpand.add(root.id);
        for (const child of root.children) {
          idsToExpand.add(child.id);
        }
      }
      setExpandedIds(idsToExpand);
    } catch {
      setError('Failed to load organization chart');
    } finally {
      setLoading(false);
    }
  };

  // Find node by ID (recursive)
  const findNode = useCallback((nodes: OrgNode[], id: string): OrgNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = findNode(n.children, id);
      if (found) return found;
    }
    return null;
  }, []);

  const selectedNode = selectedId ? findNode(tree, selectedId) : null;

  // Collect all departments for filter
  const departments = new Set<string>();
  const collectDepts = (nodes: OrgNode[]) => {
    for (const n of nodes) {
      if (n.departmentName) departments.add(n.departmentName);
      collectDepts(n.children);
    }
  };
  collectDepts(tree);

  // Toggle expand/collapse
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Expand all / collapse all
  const expandAll = () => {
    const allIds = new Set<string>();
    const collect = (nodes: OrgNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) allIds.add(n.id);
        collect(n.children);
      }
    };
    collect(tree);
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // Navigate to a user in sidebar
  const handleNavigateToUser = (id: string) => {
    setSelectedId(id);
    // Expand path to this user
    const expandPath = (nodes: OrgNode[], targetId: string, path: string[]): string[] | null => {
      for (const n of nodes) {
        if (n.id === targetId) return [...path, n.id];
        const found = expandPath(n.children, targetId, [...path, n.id]);
        if (found) return found;
      }
      return null;
    };
    const path = expandPath(tree, id, []);
    if (path) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const pid of path) next.add(pid);
        return next;
      });
    }
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || viewMode !== 'tree') return;
    // Only start panning on the background, not on cards
    if ((e.target as HTMLElement).closest('[data-card]')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading organization chart...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
        <button onClick={loadTree} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Organization Chart
              </h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {total} team member{total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people..."
                className="pl-9 pr-4 py-2 w-56 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            {/* Department filter */}
            {departments.size > 0 && (
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="pl-9 pr-8 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                >
                  <option value="">All Departments</option>
                  {Array.from(departments).sort().map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            )}

            {/* View toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode('tree')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'tree'
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
                }`}
              >
                Tree
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Tree-specific controls */}
        {viewMode === 'tree' && (
          <div className="flex items-center gap-2 mt-3">
            <button onClick={expandAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Expand All
            </button>
            <span className="text-gray-300 dark:text-slate-600">|</span>
            <button onClick={collapseAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Collapse All
            </button>
            <span className="text-gray-300 dark:text-slate-600">|</span>
            <button
              onClick={() => setIsCompact(!isCompact)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {isCompact ? 'Full Cards' : 'Compact Cards'}
            </button>

            {/* Zoom controls */}
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400" title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(2, z + 0.15))} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400" title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={resetView} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400" title="Reset view">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'tree' ? (
            <div
              ref={canvasRef}
              className={`w-full h-full overflow-auto ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div
                className="inline-flex p-10 min-w-full min-h-full justify-center items-start"
                style={{
                  transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                  transformOrigin: 'top center',
                }}
              >
                {tree.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-20 text-gray-400 dark:text-slate-500">
                    <Users className="w-12 h-12" />
                    <p className="text-lg font-medium">No organization structure</p>
                    <p className="text-sm">Assign managers to users to build the org chart</p>
                  </div>
                ) : (
                  <div className="flex gap-10 items-start" data-card>
                    {tree.map((root) => (
                      <TreeNode
                        key={root.id}
                        node={root}
                        expandedIds={expandedIds}
                        onToggle={toggleExpand}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        isCompact={isCompact}
                        depth={0}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <ListView
                nodes={tree}
                search={search}
                selectedId={selectedId}
                onSelect={setSelectedId}
                filterDept={filterDept}
              />
            </div>
          )}
        </div>

        {/* Detail sidebar */}
        {selectedNode && (
          <DetailSidebar
            node={selectedNode}
            onClose={() => setSelectedId(null)}
            onNavigate={handleNavigateToUser}
          />
        )}
      </div>
    </div>
  );
}