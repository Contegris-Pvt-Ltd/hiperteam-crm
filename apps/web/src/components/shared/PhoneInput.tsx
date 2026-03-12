import { useState, useEffect, useRef } from 'react';
import { COUNTRIES, getCountryByCode } from '../../data/countries';
import { ChevronDown, Search } from 'lucide-react';

interface Props {
  value: string;          // full E.164 e.g. '+971501234567'
  defaultCountry?: string; // ISO2 fallback e.g. 'AE'
  onChange: (e164: string, countryCode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}

// Pre-sort countries by dial code length descending (longest first) for matching
const SORTED_BY_DIAL = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);

function deriveFromValue(value: string | undefined | null, defaultCountry: string) {
  if (!value) return { country: defaultCountry, local: '' };
  if (value.startsWith('+')) {
    for (const c of SORTED_BY_DIAL) {
      if (value.startsWith(c.dialCode)) {
        return { country: c.code, local: value.slice(c.dialCode.length) };
      }
    }
    // Has + but no match — strip + and show as local
    return { country: defaultCountry, local: value.slice(1) };
  }
  // Non-E.164 value (legacy data) — show as-is in the local field
  return { country: defaultCountry, local: value };
}

export function PhoneInput({ value, defaultCountry = 'US', onChange, placeholder = 'Phone number', disabled, label, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const internalChange = useRef(false);

  const initial = deriveFromValue(value, defaultCountry);
  const [selectedCountry, setSelectedCountry] = useState(initial.country);
  const [localNumber, setLocalNumber] = useState(initial.local);

  // Sync when external value changes (edit mode load, form reset) — skip if we triggered it
  useEffect(() => {
    if (internalChange.current) {
      internalChange.current = false;
      return;
    }
    const state = deriveFromValue(value, defaultCountry);
    setSelectedCountry(state.country);
    setLocalNumber(state.local);
  }, [value, defaultCountry]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = getCountryByCode(selectedCountry) ?? COUNTRIES.find(c => c.code === 'US')!;

  const filtered = search
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search) ||
        c.code.toLowerCase() === search.toLowerCase()
      )
    : COUNTRIES;

  const selectCountry = (code: string) => {
    const c = getCountryByCode(code)!;
    setSelectedCountry(code);
    setOpen(false);
    setSearch('');
    internalChange.current = true;
    const e164 = localNumber ? `${c.dialCode}${localNumber}` : '';
    onChange(e164, code);
  };

  const handleNumberChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    setLocalNumber(digits);
    internalChange.current = true;
    const e164 = digits ? `${selected.dialCode}${digits}` : '';
    onChange(e164, selectedCountry);
  };

  return (
    <div className={`space-y-1 ${className}`} ref={dropdownRef}>
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">{label}</label>}
      <div className="flex relative">
        {/* Country picker */}
        <button
          type="button" disabled={disabled}
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2.5 border border-r-0 border-gray-200 dark:border-slate-700 rounded-l-xl bg-white dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap flex-shrink-0"
        >
          <span className="text-base leading-none">{selected.flag}</span>
          <span className="text-xs font-medium">{selected.dialCode}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>

        {/* Number */}
        <input
          type="tel" value={localNumber} disabled={disabled}
          onChange={e => handleNumberChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-r-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none"
        />

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 dark:bg-slate-900 rounded-lg">
                <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input
                  autoFocus type="text" value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search country or code..."
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.map(c => (
                <button
                  key={c.code} type="button"
                  onClick={() => selectCountry(c.code)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors ${
                    c.code === selectedCountry ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                  }`}
                >
                  <span className="text-base leading-none w-6 text-center">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">{c.dialCode}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400 text-center">No results</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
