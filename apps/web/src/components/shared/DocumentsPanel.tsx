import { useState, useRef } from 'react';
import { Upload, FileText, FileImage, FileSpreadsheet, FileType, File, Folder, Download, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Document } from '../../api/contacts.api';
import { uploadApi } from '../../api/upload.api';

interface DocumentsPanelProps {
  documents: Document[];
  loading?: boolean;
  entityType: 'contacts' | 'accounts';
  entityId: string;
  onDocumentUploaded?: (doc: Document) => void;
  onDocumentDeleted?: (docId: string) => void;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return FileSpreadsheet;
  if (mimeType.includes('pdf')) return FileType;
  if (mimeType.includes('document') || mimeType.includes('word')) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function DocumentsPanel({ 
  documents, 
  loading, 
  entityType, 
  entityId,
  onDocumentUploaded,
  onDocumentDeleted 
}: DocumentsPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleUpload(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleUpload(files[0]);
    }
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleUpload = async (file: File) => {
    // Validate file size (25MB max)
    if (file.size > 25 * 1024 * 1024) {
      setError('File size must be less than 25MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const result = await uploadApi.uploadDocument(entityType, entityId, file);
      
      if (onDocumentUploaded) {
        // Create a Document object from the upload result
        const newDoc: Document = {
          id: result.id! || crypto.randomUUID(),
          name: result.name || file.name,
          originalName: result.originalName || file.name,
          mimeType: result.mimeType || file.type,
          sizeBytes: result.sizeBytes || file.size,
          storagePath: result.path,
          storageUrl: result.url,
          uploadedBy: {
            id: '',
            firstName: 'You',
            lastName: '',
          },
          createdAt: new Date().toISOString(),
        };
        onDocumentUploaded(newDoc);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (onDocumentDeleted) {
      onDocumentDeleted(docId);
    }
  };

  const handleDownload = (doc: Document) => {
    window.open(doc.storageUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`mb-4 p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600'
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
            <p className="text-sm text-gray-600 dark:text-slate-400">Uploading...</p>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Drag and drop a file here, or click to select
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Maximum file size: 25MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="text-center py-8">
          <Folder className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">No documents yet</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
            Upload files to attach them to this record
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => {
            const IconComponent = getFileIcon(doc.mimeType);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <IconComponent className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {doc.name || doc.originalName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {formatFileSize(doc.sizeBytes)} • Uploaded {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                    {doc.uploadedBy && ` by ${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`.trim()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}