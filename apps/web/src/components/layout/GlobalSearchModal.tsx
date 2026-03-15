import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Users, Building2, Target, Briefcase, FolderKanban, CheckSquare } from 'lucide-react';
import { api } from '../../api/contacts.api';

interface SearchResult {
  id: string;
  type: 'contact' | 'account' | 'lead' | 'opportunity' | 'project' | 'task';
  title: string;
  subtitle: string | null;
  url: string;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  contact: { icon: Users, label: 'Contact', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  account: { icon: Building2, label: 'Account', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  lead: { icon: Target, label: 'Lead', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  opportunity: { icon: Briefcase, label: 'Opportunity', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  project: { icon: FolderKanban, label: 'Project', color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/30' },
  task: { icon: CheckSquare, label: 'Task', color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-900/30' },
};

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/search', { params: { q, limit: 20 } });
      setResults(data);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    setOpen(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 250);
  };

  const goTo = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    navigate(result.url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      goTo(results[selectedIndex]);
    }
  };

  const showDropdown = open && (query.length >= 2 || results.length > 0);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search contacts, leads, opportunities..."
          className="w-full pl-10 pr-16 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 hover:border-gray-300 dark:hover:border-slate-600 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30 outline-none transition-all"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        ) : (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-mono text-gray-400">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden z-50">
          <div className="max-h-[60vh] overflow-y-auto">
            {results.length === 0 && !loading && (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">No results found for &quot;{query}&quot;</p>
              </div>
            )}

            {results.length > 0 && (
              <div className="py-1">
                {results.map((result, idx) => {
                  const cfg = TYPE_CONFIG[result.type] || TYPE_CONFIG.contact;
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => goTo(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        idx === selectedIndex
                          ? 'bg-purple-50 dark:bg-purple-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {result.title}
                        </p>
                        {result.subtitle && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.subtitle}</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${cfg.color} flex-shrink-0`}>
                        {cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 flex items-center gap-4 text-[10px] text-gray-400">
              <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-700 rounded font-mono">↑↓</kbd> Navigate</span>
              <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-700 rounded font-mono">Enter</kbd> Open</span>
              <span><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-700 rounded font-mono">Esc</kbd> Close</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
