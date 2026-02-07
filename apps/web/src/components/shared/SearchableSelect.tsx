import { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface SelectOption {
  id: string;
  label: string;
  sublabel?: string;
  imageUrl?: string;
}

interface SearchableSelectProps {
  placeholder?: string;
  onSearch: (query: string) => Promise<SelectOption[]>;
  onSelect: (option: SelectOption) => void;
  renderOption?: (option: SelectOption) => React.ReactNode;
  minSearchLength?: number;
  debounceMs?: number;
}

export function SearchableSelect({
  placeholder = 'Search...',
  onSearch,
  onSelect,
  renderOption,
  minSearchLength = 2,
  debounceMs = 300,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < minSearchLength) {
      setOptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(query);
        setOptions(results);
        setHighlightedIndex(0);
      } catch (error) {
        console.error('Search failed:', error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, onSearch, minSearchLength, debounceMs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (options[highlightedIndex]) {
          handleSelect(options[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (option: SelectOption) => {
    onSelect(option);
    setQuery('');
    setOptions([]);
    setIsOpen(false);
  };

  const defaultRenderOption = (option: SelectOption) => (
    <div className="flex items-center gap-3">
      {option.imageUrl ? (
        <img src={option.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
      ) : (
        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white text-sm font-semibold">
          {option.label[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">{option.label}</p>
        {option.sublabel && (
          <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{option.sublabel}</p>
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setOptions([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (query.length >= minSearchLength || options.length > 0) && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : options.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500 dark:text-slate-400">
              {query.length < minSearchLength
                ? `Type at least ${minSearchLength} characters to search`
                : 'No results found'}
            </div>
          ) : (
            <ul className="max-h-64 overflow-auto py-2">
              {options.map((option, index) => (
                <li key={option.id}>
                  <button
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-4 py-2.5 text-left transition-colors ${
                      index === highlightedIndex
                        ? 'bg-gray-100 dark:bg-slate-800'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {renderOption ? renderOption(option) : defaultRenderOption(option)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}