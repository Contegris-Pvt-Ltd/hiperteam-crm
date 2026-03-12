import { useState } from 'react';
import { getCitiesForCountry } from '../../data/cities';

interface Props {
  countryCode: string;
  value: string;
  onChange: (city: string) => void;
  className?: string;
  disabled?: boolean;
}

export function CitySelect({ countryCode, value, onChange, className = '', disabled }: Props) {
  const [customMode, setCustomMode] = useState(false);
  const cities = getCitiesForCountry(countryCode);
  const inList = cities.includes(value);
  const showCustom = customMode || (!!value && !inList);

  if (!countryCode) {
    return (
      <input
        type="text" disabled value=""
        placeholder="Select a country first"
        className={`w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-400 text-sm ${className}`}
      />
    );
  }

  if (showCustom || cities.length === 0) {
    return (
      <div className="relative">
        <input
          type="text" value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Enter city"
          className={`w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 ${className}`}
        />
        {cities.length > 0 && (
          <button type="button" onClick={() => { setCustomMode(false); onChange(''); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-500 hover:underline">
            Pick from list
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={e => {
        if (e.target.value === '__custom__') { setCustomMode(true); onChange(''); }
        else onChange(e.target.value);
      }}
      disabled={disabled}
      className={`w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      <option value="">Select city...</option>
      {cities.map(c => <option key={c} value={c}>{c}</option>)}
      <option value="__custom__">Other (type manually)</option>
    </select>
  );
}
