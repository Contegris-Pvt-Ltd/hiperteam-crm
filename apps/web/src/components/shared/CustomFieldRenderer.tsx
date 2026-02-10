import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, X, FileText, AlertCircle, Music, Video, FileSpreadsheet, FileIcon, Image as ImageIcon } from 'lucide-react';
import type { CustomField } from '../../api/admin.api';
import { uploadApi } from '../../api/upload.api';

interface CustomFieldRendererProps {
  field: CustomField;
  value: unknown;
  onChange: (fieldKey: string, value: unknown) => void;
  allFields: CustomField[];
  allValues: Record<string, unknown>;
  error?: string;
}

interface FileValue {
  fileName?: string;
  url?: string;
  fileType?: string;
  fileSize?: number;
}

// Helper to detect file type category
const getFileCategory = (fileName?: string, mimeType?: string): string => {
  if (!fileName && !mimeType) return 'unknown';
  
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType?.toLowerCase() || '';
  
  // Images
  if (mime.startsWith('image/') || /^(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/.test(ext)) {
    return 'image';
  }
  
  // PDF
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  
  // Audio
  if (mime.startsWith('audio/') || /^(mp3|wav|ogg|flac|aac|m4a)$/.test(ext)) {
    return 'audio';
  }
  
  // Video
  if (mime.startsWith('video/') || /^(mp4|webm|mov|avi|mkv|wmv)$/.test(ext)) {
    return 'video';
  }
  
  // Spreadsheets
  if (/^(xlsx|xls|csv)$/.test(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
    return 'spreadsheet';
  }
  
  // Documents (Word)
  if (/^(docx|doc)$/.test(ext) || mime.includes('document') || mime.includes('word')) {
    return 'document';
  }
  
  // Presentations
  if (/^(pptx|ppt)$/.test(ext) || mime.includes('presentation') || mime.includes('powerpoint')) {
    return 'presentation';
  }
  
  // Google Docs/Sheets (by URL pattern)
  if (fileName?.includes('docs.google.com') || fileName?.includes('sheets.google.com')) {
    return 'google';
  }
  
  // Text files
  if (/^(txt|md|json|xml|html|css|js|ts|py|java|c|cpp|h)$/.test(ext) || mime.startsWith('text/')) {
    return 'text';
  }
  
  return 'other';
};

// Get icon based on file category
const getFileIcon = (category: string) => {
  switch (category) {
    case 'image': return <ImageIcon className="w-8 h-8 text-purple-500" />;
    case 'audio': return <Music className="w-8 h-8 text-pink-500" />;
    case 'video': return <Video className="w-8 h-8 text-red-500" />;
    case 'spreadsheet': return <FileSpreadsheet className="w-8 h-8 text-green-500" />;
    case 'pdf': return <FileText className="w-8 h-8 text-red-600" />;
    case 'document': return <FileText className="w-8 h-8 text-blue-500" />;
    case 'presentation': return <FileText className="w-8 h-8 text-orange-500" />;
    default: return <FileIcon className="w-8 h-8 text-gray-500" />;
  }
};

// Format file size
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function CustomFieldRenderer({
  field,
  value,
  onChange,
  allFields,
  allValues,
  error,
}: CustomFieldRendererProps) {
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get parent field if this is a dependent field
  const parentField = field.dependsOnFieldId 
    ? allFields.find(f => f.id === field.dependsOnFieldId) 
    : null;

  // Get options for select fields (handles dependent fields)
  const getOptions = useCallback((): { label: string; value: string }[] => {
    if (field.dependsOnFieldId && field.conditionalOptions) {
      const parent = allFields.find(f => f.id === field.dependsOnFieldId);
      if (parent) {
        const parentValue = allValues[parent.fieldKey] as string;
        if (parentValue && field.conditionalOptions[parentValue]) {
          return field.conditionalOptions[parentValue];
        }
      }
      return [];
    }
    return field.fieldOptions || [];
  }, [field, allFields, allValues]);

  // Check if dependent field should be disabled
  const isFieldDisabled = Boolean(field.dependsOnFieldId) && getOptions().length === 0;

  // Clear value if parent changes and current value is no longer valid
  useEffect(() => {
    if (field.dependsOnFieldId && value) {
      const options = getOptions();
      const currentValue = value as string | string[];
      
      if (Array.isArray(currentValue)) {
        const validValues = currentValue.filter(v => options.some(opt => opt.value === v));
        if (validValues.length !== currentValue.length) {
          onChange(field.fieldKey, validValues.length > 0 ? validValues : '');
        }
      } else {
        const isValid = options.some(opt => opt.value === currentValue);
        if (!isValid) {
          onChange(field.fieldKey, '');
        }
      }
    }
  }, [allValues, field.dependsOnFieldId, field.fieldKey, getOptions, onChange, value]);

  // Set default value if field is empty and has a default
  useEffect(() => {
    if (field.defaultValue && (value === undefined || value === null || value === '')) {
      onChange(field.fieldKey, field.defaultValue);
    }
  }, [field.defaultValue, field.fieldKey, onChange, value]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileUploading(true);
    
    try {
      const result = await uploadApi.uploadFile(file);
      
      onChange(field.fieldKey, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        url: result.url,
      });
    } catch (err) {
      console.error('File upload failed:', err);
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setFileUploading(false);
      // Reset the input value so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = () => {
    onChange(field.fieldKey, null);
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = (url: string) => {
    // Open in new tab for download (cross-origin download attribute doesn't work)
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const inputClasses = `w-full px-4 py-2.5 border rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
    error ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-slate-700'
  }`;

  const renderFilePreview = (fileValue: FileValue) => {
    const category = getFileCategory(fileValue.fileName, fileValue.fileType);
    
    return (
      <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {/* Preview Area */}
        {category === 'image' && fileValue.url && (
          <div className="p-4 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-center">
            <img 
              src={fileValue.url} 
              alt={fileValue.fileName}
              className="max-w-full max-h-[200px] rounded-lg object-contain"
            />
          </div>
        )}
        
        {category === 'pdf' && fileValue.url && (
          <div className="p-4 bg-gray-50 dark:bg-slate-800/50">
            <iframe
              src={fileValue.url}
              title={fileValue.fileName}
              className="w-full h-[200px] rounded-lg border border-gray-200 dark:border-slate-700"
            />
          </div>
        )}
        
        {category === 'audio' && fileValue.url && (
          <div className="p-4 bg-gray-50 dark:bg-slate-800/50">
            <audio controls className="w-full">
              <source src={fileValue.url} type={fileValue.fileType} />
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
        
        {category === 'video' && fileValue.url && (
          <div className="p-4 bg-gray-50 dark:bg-slate-800/50">
            <video controls className="w-full max-h-[200px] rounded-lg">
              <source src={fileValue.url} type={fileValue.fileType} />
              Your browser does not support the video element.
            </video>
          </div>
        )}
        
        {/* Office files - Use Google Docs Viewer */}
        {(['document', 'spreadsheet', 'presentation'].includes(category)) && fileValue.url && (
          <div className="p-4 bg-gray-50 dark:bg-slate-800/50">
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileValue.url)}&embedded=true`}
              title={fileValue.fileName}
              className="w-full h-[200px] rounded-lg border border-gray-200 dark:border-slate-700"
            />
          </div>
        )}
        
        {/* File Info Bar */}
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800">
          {getFileIcon(category)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {fileValue.fileName}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {fileValue.fileSize && (
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  {formatFileSize(fileValue.fileSize)}
                </span>
              )}
              {fileValue.url && (
                <>
                  {fileValue.fileSize && <span className="text-gray-300 dark:text-slate-600">•</span>}
                  <a
                    href={fileValue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open
                  </a>
                  <span className="text-gray-300 dark:text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={() => handleDownload(fileValue.url!)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Download
                  </button>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  const renderInput = () => {
    const options = getOptions();
    const selectedValues = Array.isArray(value) ? (value as string[]) : [];
    const fileValue = value as FileValue | null;

    switch (field.fieldType) {
      case 'text':
      case 'url':
      case 'email':
      case 'phone':
        return (
          <input
            type={field.fieldType === 'url' ? 'url' : field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : 'text'}
            value={String(value || '')}
            onChange={(e) => onChange(field.fieldKey, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.fieldLabel.toLowerCase()}`}
            className={inputClasses}
            disabled={isFieldDisabled}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) => onChange(field.fieldKey, e.target.value ? Number(e.target.value) : '')}
            placeholder={field.placeholder || `Enter ${field.fieldLabel.toLowerCase()}`}
            min={field.validationRules?.min}
            max={field.validationRules?.max}
            className={inputClasses}
            disabled={isFieldDisabled}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={String(value || '')}
            onChange={(e) => onChange(field.fieldKey, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.fieldLabel.toLowerCase()}`}
            rows={4}
            maxLength={field.validationRules?.maxLength}
            className={inputClasses}
            disabled={isFieldDisabled}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={String(value || '')}
            onChange={(e) => onChange(field.fieldKey, e.target.value)}
            className={inputClasses}
            disabled={isFieldDisabled}
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value === true || value === 'true'}
              onChange={(e) => onChange(field.fieldKey, e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500"
              disabled={isFieldDisabled}
            />
            <span className="text-gray-700 dark:text-slate-300">
              {field.placeholder || field.fieldLabel}
            </span>
          </label>
        );

      case 'select':
        return (
          <select
            value={String(value || '')}
            onChange={(e) => onChange(field.fieldKey, e.target.value)}
            className={inputClasses}
            disabled={isFieldDisabled}
          >
            <option value="">
              {isFieldDisabled 
                ? `Select ${parentField?.fieldLabel || 'parent'} first` 
                : field.placeholder || `Select ${field.fieldLabel.toLowerCase()}`}
            </option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'multi_select':
        return (
          <div className="space-y-2">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && !selectedValues.includes(e.target.value)) {
                  onChange(field.fieldKey, [...selectedValues, e.target.value]);
                }
              }}
              className={inputClasses}
              disabled={isFieldDisabled}
            >
              <option value="">
                {isFieldDisabled 
                  ? `Select ${parentField?.fieldLabel || 'parent'} first` 
                  : `Add ${field.fieldLabel.toLowerCase()}`}
              </option>
              {options.filter(opt => !selectedValues.includes(opt.value)).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedValues.map((val) => {
                  const opt = options.find(o => o.value === val);
                  return (
                    <span
                      key={val}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                    >
                      {opt?.label || val}
                      <button
                        type="button"
                        onClick={() => onChange(field.fieldKey, selectedValues.filter(v => v !== val))}
                        className="hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'file':
        if (fileValue?.fileName) {
          return renderFilePreview(fileValue);
        }
        
        return (
          <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-colors ${
            isFieldDisabled
              ? 'border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 cursor-not-allowed'
              : 'border-gray-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer'
          }`}>
            {fileUploading ? (
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-sm text-gray-500 dark:text-slate-400">Uploading...</span>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <span className="text-sm text-gray-500 dark:text-slate-400">
                  Click to upload or drag and drop
                </span>
                <span className="text-xs text-gray-400 dark:text-slate-500 mt-1 block">
                  Images, PDFs, Documents, Audio, Video
                </span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isFieldDisabled || fileUploading}
            />
          </label>
        );

      default:
        return (
          <input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(field.fieldKey, e.target.value)}
            placeholder={field.placeholder || undefined}
            className={inputClasses}
            disabled={isFieldDisabled}
          />
        );
    }
  };

  // Checkbox has inline label
  if (field.fieldType === 'checkbox') {
    return (
      <div>
        {renderInput()}
        {field.helpText && (
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{field.helpText}</p>
        )}
        {error && (
          <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
        {field.fieldLabel}
        {field.isRequired && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderInput()}
      {field.helpText && (
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{field.helpText}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
      {isFieldDisabled && !error && (
        <p className="mt-1 text-xs text-amber-500 dark:text-amber-400">
          Please select {parentField?.fieldLabel || 'parent option'} first
        </p>
      )}
    </div>
  );
}

// Component to render all custom fields for a module
interface CustomFieldsSectionProps {
  fields: CustomField[];
  values: Record<string, unknown>;
  onChange: (fieldKey: string, value: unknown) => void;
  errors?: Record<string, string>;
  columns?: 1 | 2;
}

export function CustomFieldsSection({
  fields,
  values,
  onChange,
  errors = {},
  columns = 2,
}: CustomFieldsSectionProps) {
  if (fields.length === 0) {
    return null;
  }

  const sortedFields = [...fields].sort((a, b) => {
    if (a.dependsOnFieldId && !b.dependsOnFieldId) return 1;
    if (!a.dependsOnFieldId && b.dependsOnFieldId) return -1;
    return a.displayOrder - b.displayOrder;
  });

  return (
    <div className={columns === 2 ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4 grid-cols-1'}>
      {sortedFields.map((field) => (
        <div key={field.id} className={field.fieldType === 'textarea' || field.fieldType === 'file' ? 'md:col-span-2' : ''}>
          <CustomFieldRenderer
            field={field}
            value={values[field.fieldKey]}
            onChange={onChange}
            allFields={fields}
            allValues={values}
            error={errors[field.fieldKey]}
          />
        </div>
      ))}
    </div>
  );
}