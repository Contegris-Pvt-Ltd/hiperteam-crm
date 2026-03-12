import { useState, useEffect, useRef } from 'react';
import { TIMEZONES } from '../../data/timezones';
import { ChevronDown, Search, Clock } from 'lucide-react';

interface Props {
  value: string;
  onChange: (tz: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function TimezoneSelect({ value, onChange, placeholder = 'Select timezone...', className = '', disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = TIMEZONES.find(t => t.value === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search when opening
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const filtered = search
    ? TIMEZONES.filter(t =>
        t.label.toLowerCase().includes(search.toLowerCase()) ||
        t.value.toLowerCase().includes(search.toLowerCase()) ||
        t.offset.includes(search)
      )
    : TIMEZONES;

  const handleSelect = (tz: string) => {
    onChange(tz);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none disabled:opacity-50"
      >
        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
        {selected ? (
          <span className="flex-1 text-gray-900 dark:text-white truncate">
            ({selected.offset}) {selected.label}
          </span>
        ) : value ? (
          <span className="flex-1 text-gray-900 dark:text-white truncate">{value}</span>
        ) : (
          <span className="flex-1 text-gray-400 dark:text-slate-500">{placeholder}</span>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 dark:bg-slate-900 rounded-lg">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search timezone..."
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {filtered.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleSelect(t.value)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors ${
                  t.value === value
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                <span className="text-xs text-gray-400 dark:text-slate-500 w-20 shrink-0 font-mono">{t.offset}</span>
                <span className="flex-1 truncate">{t.label}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-400 text-center">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
