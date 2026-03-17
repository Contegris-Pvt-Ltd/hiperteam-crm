// ============================================================
// FILE: apps/web/src/components/shared/StageFieldInput.tsx
// Renders the correct input for a stage-required field,
// including a proper drag-and-drop file uploader for file types.
// ============================================================
import { useState, useRef } from 'react';
import { Upload, FileText, X as XIcon, Loader2 } from 'lucide-react';
import { uploadApi } from '../../api/upload.api';

interface StageFieldInputProps {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  value: any;
  error?: string;
  onChange: (value: any) => void;
  onClearError: () => void;
}

const inputClass = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

export function StageFieldInput({
  fieldKey, fieldLabel, fieldType, value, error, onChange, onClearError,
}: StageFieldInputProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const errorClass = error ? 'border-red-500 focus:ring-red-500' : '';

  // ── File upload handler ──
  const handleFileUpload = async (file: File) => {
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      setUploadError('File size must be under 25MB');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const result = await uploadApi.uploadFile(file);
      onChange({
        url: result.url,
        name: result.originalName || file.name,
        mimeType: result.mimeType || file.type,
        sizeBytes: result.sizeBytes || file.size,
      });
      onClearError();
    } catch (err: any) {
      setUploadError(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = () => {
    onChange(null);
    setUploadError('');
  };

  // ── File type ──
  if (fieldType === 'file' || fieldType === 'document' || fieldType === 'attachment') {
    const fileValue = value && typeof value === 'object' ? value : null;

    return (
      <div>
        {fileValue ? (
          // Uploaded file display
          <div className={`flex items-center gap-3 px-3 py-2.5 border rounded-lg bg-gray-50 dark:bg-slate-800/50 ${error ? 'border-red-500' : 'border-gray-200 dark:border-slate-600'}`}>
            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {fileValue.name}
              </p>
              {fileValue.sizeBytes && (
                <p className="text-xs text-gray-400">{formatFileSize(fileValue.sizeBytes)}</p>
              )}
            </div>
            <button
              type="button"
              onClick={removeFile}
              className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
              title="Remove file"
            >
              <XIcon className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        ) : uploading ? (
          // Uploading state
          <div className="flex items-center justify-center gap-2 px-3 py-4 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800/50">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <span className="text-sm text-gray-500">Uploading...</span>
          </div>
        ) : (
          // Drop zone
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-1.5 px-3 py-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              dragActive
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10'
                : error
                  ? 'border-red-400 bg-red-50/50 dark:bg-red-900/5 hover:border-red-500'
                  : 'border-gray-300 dark:border-slate-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Upload className={`w-5 h-5 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-xs text-gray-500 dark:text-slate-400">
              <span className="font-medium text-blue-600 dark:text-blue-400">Click to upload</span> or drag & drop
            </p>
            <p className="text-[10px] text-gray-400">Max 25MB</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}
        {(error || uploadError) && (
          <p className="text-xs text-red-500 mt-1">{uploadError || error}</p>
        )}
      </div>
    );
  }

  // ── Textarea ──
  if (fieldType === 'textarea') {
    return (
      <div>
        <textarea
          value={value || ''}
          onChange={(e) => { onChange(e.target.value); onClearError(); }}
          rows={2}
          className={`${inputClass} ${errorClass}`}
          placeholder={`Enter ${fieldLabel.toLowerCase()}`}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  // ── Checkbox ──
  if (fieldType === 'checkbox') {
    return (
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => { onChange(e.target.checked); onClearError(); }}
            className="rounded text-blue-600"
          />
          <span className="text-sm text-gray-700 dark:text-slate-300">{fieldLabel}</span>
        </label>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }

  // ── Standard inputs ──
  const inputType =
    fieldType === 'email' ? 'email' :
    fieldType === 'number' ? 'number' :
    fieldType === 'date' ? 'date' :
    fieldType === 'phone' ? 'tel' :
    fieldType === 'url' ? 'url' : 'text';

  return (
    <div>
      <input
        type={inputType}
        value={value || ''}
        onChange={(e) => {
          const val = fieldType === 'number' && e.target.value ? Number(e.target.value) : e.target.value;
          onChange(val);
          onClearError();
        }}
        className={`${inputClass} ${errorClass}`}
        placeholder={`Enter ${fieldLabel.toLowerCase()}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
