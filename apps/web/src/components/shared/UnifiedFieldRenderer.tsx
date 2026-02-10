/**
 * UNIFIED FIELD RENDERER
 * 
 * Renders both system fields and custom fields using a consistent interface.
 * Handles special components like account-link, tags, etc.
 */

import { useState } from 'react';
import { Upload, X, FileText, Search, Building2 } from 'lucide-react';
import type { CustomField } from '../../api/admin.api';
import type { SystemFieldDefinition } from '../../config/field-registry';
import { isSystemField } from '../../config/field-registry';

type FieldType = SystemFieldDefinition | CustomField;

interface UnifiedFieldRendererProps {
  field: FieldType;
  value: unknown;
  onChange: (fieldKey: string, value: unknown) => void;
  allFields: FieldType[];
  allValues: Record<string, unknown>;
  error?: string;
  disabled?: boolean;
  // For special components
  onAccountSearch?: (query: string) => Promise<Array<{ id: string; name: string }>>;
  accounts?: Array<{ id: string; name: string }>;
}

export function UnifiedFieldRenderer({
  field,
  value,
  onChange,
  allFields,
  allValues,
  error,
  disabled = false,
  onAccountSearch,
  accounts = [],
}: UnifiedFieldRendererProps) {
  const [fileUploading, setFileUploading] = useState(false);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  // Check if this is a system field with special component
  const specialComponent = isSystemField(field) ? field.component : undefined;

  // Get field options (for select/multi_select)
  const getFieldOptions = (): Array<{ label: string; value: string }> => {
    if ('fieldOptions' in field && Array.isArray(field.fieldOptions)) {
      // Check for dependent field
      if ('dependsOnFieldId' in field && field.dependsOnFieldId) {
        const parentValue = allValues[
          allFields.find(f => f.id === field.dependsOnFieldId)?.fieldKey || ''
        ];
        if (parentValue && 'conditionalOptions' in field && field.conditionalOptions) {
          return field.conditionalOptions[String(parentValue)] || [];
        }
        return [];
      }
      return field.fieldOptions;
    }
    return [];
  };

  // Handle change
  const handleChange = (newValue: unknown) => {
    onChange(field.fieldKey, newValue);
  };

  // Render label
  const renderLabel = () => (
    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
      {field.fieldLabel}
      {field.isRequired && <span className="text-red-500 ml-1">*</span>}
      {isSystemField(field) && (
        <span className="ml-2 text-xs text-gray-400 font-normal">(System)</span>
      )}
    </label>
  );

  // Render help text
  const renderHelpText = () => {
    const helpText = 'helpText' in field ? field.helpText : undefined;
    if (!helpText) return null;
    return <p className="mt-1 text-xs text-gray-500">{helpText}</p>;
  };

  // Render error
  const renderError = () => {
    if (!error) return null;
    return <p className="mt-1 text-xs text-red-500">{error}</p>;
  };

  // Common input classes
  const inputClasses = `w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white
    ${error ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    focus:outline-none focus:ring-2 focus:ring-blue-500`;

  // Special component: Account Link
  if (specialComponent === 'account-link') {
    const selectedAccount = accounts.find(a => a.id === value);
    
    return (
      <div>
        {renderLabel()}
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={selectedAccount ? selectedAccount.name : accountSearchQuery}
                onChange={(e) => {
                  setAccountSearchQuery(e.target.value);
                  setShowAccountDropdown(true);
                  if (onAccountSearch) {
                    onAccountSearch(e.target.value);
                  }
                }}
                onFocus={() => setShowAccountDropdown(true)}
                className={inputClasses}
                placeholder="Search for account..."
                disabled={disabled}
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            {selectedAccount && (
              <button
                onClick={() => handleChange(null)}
                className="p-2 text-gray-400 hover:text-red-500"
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {showAccountDropdown && accountSearchQuery && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {accounts.filter(a => 
                a.name.toLowerCase().includes(accountSearchQuery.toLowerCase())
              ).map(account => (
                <button
                  key={account.id}
                  onClick={() => {
                    handleChange(account.id);
                    setAccountSearchQuery('');
                    setShowAccountDropdown(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                >
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span>{account.name}</span>
                </button>
              ))}
              {accounts.length === 0 && (
                <div className="px-3 py-2 text-gray-500 text-sm">No accounts found</div>
              )}
            </div>
          )}
        </div>
        {renderHelpText()}
        {renderError()}
      </div>
    );
  }

  // Special component: Tags
  if (specialComponent === 'tags') {
    const tags = Array.isArray(value) ? value : [];
    const [inputValue, setInputValue] = useState('');

    return (
      <div>
        {renderLabel()}
        <div className={`${inputClasses} min-h-[42px] flex flex-wrap gap-1 items-center`}>
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm"
            >
              {tag}
              <button
                onClick={() => handleChange(tags.filter((_, i) => i !== idx))}
                className="hover:text-blue-900"
                disabled={disabled}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                e.preventDefault();
                handleChange([...tags, inputValue.trim()]);
                setInputValue('');
              }
            }}
            className="flex-1 min-w-[100px] border-none outline-none bg-transparent"
            placeholder={tags.length === 0 ? 'Add tags...' : ''}
            disabled={disabled}
          />
        </div>
        {renderHelpText()}
        {renderError()}
      </div>
    );
  }

  // Regular field types
  switch (field.fieldType) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      return (
        <div>
          {renderLabel()}
          <input
            type={field.fieldType === 'email' ? 'email' : field.fieldType === 'url' ? 'url' : 'text'}
            value={String(value || '')}
            onChange={(e) => handleChange(e.target.value)}
            className={inputClasses}
            placeholder={'placeholder' in field ? field.placeholder || '' : ''}
            disabled={disabled}
          />
          {renderHelpText()}
          {renderError()}
        </div>
      );

    case 'number':
      return (
        <div>
          {renderLabel()}
          <input
            type="number"
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : null)}
            className={inputClasses}
            placeholder={'placeholder' in field ? field.placeholder || '' : ''}
            disabled={disabled}
          />
          {renderHelpText()}
          {renderError()}
        </div>
      );

    case 'textarea':
      return (
        <div>
          {renderLabel()}
          <textarea
            value={String(value || '')}
            onChange={(e) => handleChange(e.target.value)}
            className={`${inputClasses} min-h-[100px] resize-y`}
            placeholder={'placeholder' in field ? field.placeholder || '' : ''}
            disabled={disabled}
          />
          {renderHelpText()}
          {renderError()}
        </div>
      );

    case 'date':
      return (
        <div>
          {renderLabel()}
          <input
            type="date"
            value={value ? String(value).split('T')[0] : ''}
            onChange={(e) => handleChange(e.target.value)}
            className={inputClasses}
            disabled={disabled}
          />
          {renderHelpText()}
          {renderError()}
        </div>
      );

    case 'select':
      const options = getFieldOptions();
      return (
        <div>
          {renderLabel()}
          <select
            value={String(value || '')}
            onChange={(e) => handleChange(e.target.value)}
            className={inputClasses}
            disabled={disabled}
          >
            <option value="">Select...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {renderHelpText()}
          {renderError()}
        </div>
      );

    case 'multi_select':
      const multiOptions = getFieldOptions();
      const selectedValues = Array.isArray(value) ? value : [];
      
      return (
        <div>
          {renderLabel()}
          <div className={`${inputClasses} min-h-[42px]`}>
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedValues.map((v) => {
                const opt = multiOptions.find((o) => o.value === v);
                return (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm"
                  >
                    {opt?.label || v}
                    <button
                      onClick={() => handleChange(selectedValues.filter((sv) => sv !== v))}
                      disabled={disabled}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && !selectedValues.includes(e.target.value)) {
                  handleChange([...selectedValues, e.target.value]);
                }
              }}
              className="w-full border-none outline-none bg-transparent"
              disabled={disabled}
            >
              <option value="">Add option...</option>
              {multiOptions
                .filter((opt) => !selectedValues.includes(opt.value))
                .map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
            </select>
          </div>
          {renderHelpText()}
          {renderError()}
        </div>
      );

    case 'checkbox':
      return (
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
              disabled={disabled}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {field.fieldLabel}
              {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </span>
          </label>
          {renderHelpText()}
          {renderError()}
        </div>
      );

    case 'file':
      const fileValue = value as { url: string; fileName: string } | null;
      
      return (
        <div>
          {renderLabel()}
          {fileValue ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg">
              <FileText className="w-8 h-8 text-blue-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileValue.fileName}</p>
                <a
                  href={fileValue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  View file
                </a>
              </div>
              <button
                onClick={() => handleChange(null)}
                className="p-1 text-gray-400 hover:text-red-500"
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-400 transition-colors ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}>
              {fileUploading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Click to upload</span>
                </>
              )}
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFileUploading(true);
                    // Note: Actual upload logic would go here
                    // For now, just create a placeholder
                    setTimeout(() => {
                      handleChange({
                        url: URL.createObjectURL(file),
                        fileName: file.name,
                      });
                      setFileUploading(false);
                    }, 1000);
                  }
                }}
                disabled={disabled || fileUploading}
              />
            </label>
          )}
          {renderHelpText()}
          {renderError()}
        </div>
      );

    default:
      return (
        <div>
          {renderLabel()}
          <input
            type="text"
            value={String(value || '')}
            onChange={(e) => handleChange(e.target.value)}
            className={inputClasses}
            disabled={disabled}
          />
          {renderHelpText()}
          {renderError()}
        </div>
      );
  }
}