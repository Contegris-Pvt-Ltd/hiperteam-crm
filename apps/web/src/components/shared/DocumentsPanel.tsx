import { useState, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  FileText, Upload, Download, Trash2, File, 
  FileImage, FileSpreadsheet, FileType, Folder 
} from 'lucide-react';

interface Document {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  uploadedBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

interface DocumentsPanelProps {
  documents: Document[];
  loading?: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <FileImage className="w-8 h-8 text-purple-500" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className="w-8 h-8 text-emerald-500" />;
  if (mimeType.includes('pdf')) return <FileType className="w-8 h-8 text-red-500" />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="w-8 h-8 text-blue-500" />;
  return <File className="w-8 h-8 text-gray-500" />;
}

export function DocumentsPanel({ documents, loading, onUpload, onDelete }: DocumentsPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await onUpload(file);
      }
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
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-slate-400">Uploading...</span>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Drop files here or <span className="text-blue-600 dark:text-blue-400">browse</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Max 25MB per file
            </p>
          </>
        )}
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8">
          <Folder className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">No documents yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              {getFileIcon(doc.mimeType)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {doc.originalName}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {formatFileSize(doc.sizeBytes)} • {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={doc.storageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                </a>
                {onDelete && (
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}