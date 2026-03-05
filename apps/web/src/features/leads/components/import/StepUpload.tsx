import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle, X } from 'lucide-react';
import { leadImportApi } from '../../../../api/lead-import.api';
import type { UploadResult } from '../../../../api/lead-import.api';

interface StepUploadProps {
  onUploadComplete: (result: UploadResult) => void;
}

export default function StepUpload({ onUploadComplete }: StepUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; rows: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setUploadedFile(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setError('Unsupported file format. Please upload .xlsx, .xls, or .csv files.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File is too large. Maximum size is 50MB.');
      return;
    }

    setUploading(true);
    try {
      const result = await leadImportApi.upload(file);
      setUploadedFile({
        name: result.fileName,
        size: result.fileSize,
        rows: result.totalRows,
      });
      onUploadComplete(result);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-lg mx-auto">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Upload File</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Upload an Excel (.xlsx, .xls) or CSV file containing your leads data.
        The first row should contain column headers.
      </p>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`p-10 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
            : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Uploading and parsing file...</p>
          </div>
        ) : uploadedFile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{uploadedFile.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatSize(uploadedFile.size)} &middot; {uploadedFile.rows.toLocaleString()} records found
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUploadedFile(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"
            >
              <X size={14} /> Upload a different file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
              <Upload className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium text-emerald-600">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Supports .xlsx, .xls, .csv (max 50MB)
              </p>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
