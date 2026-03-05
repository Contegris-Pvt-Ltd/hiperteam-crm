import { useEffect, useState, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Download, ArrowRight, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { leadImportApi } from '../../../../api/lead-import.api';
import type { ImportProgressEvent } from '../../../../api/lead-import.api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface StepProgressProps {
  jobId: string;
  onClose: () => void;
  onViewLeads: () => void;
}

export default function StepProgress({ jobId, onClose, onViewLeads }: StepProgressProps) {
  const [progress, setProgress] = useState<ImportProgressEvent>({
    jobId,
    status: 'pending',
    totalRecords: 0,
    processedRecords: 0,
    importedRecords: 0,
    failedRecords: 0,
    skippedRecords: 0,
    duplicateRecords: 0,
    percentComplete: 0,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to WebSocket for real-time progress
    const token = localStorage.getItem('accessToken');
    const wsUrl = API_URL.replace(/\/api$/, '');

    const socket = io(`${wsUrl}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('import_progress', (data: ImportProgressEvent) => {
      if (data.jobId === jobId) {
        setProgress(data);
      }
    });

    socket.on('import_complete', (data: ImportProgressEvent) => {
      if (data.jobId === jobId) {
        setProgress(data);
        setIsComplete(true);
      }
    });

    // Also poll for status in case WebSocket misses events
    const pollInterval = setInterval(async () => {
      try {
        const job = await leadImportApi.getJob(jobId);
        setProgress({
          jobId: job.id,
          status: job.status,
          totalRecords: job.totalRecords,
          processedRecords: job.processedRecords,
          importedRecords: job.importedRecords,
          failedRecords: job.failedRecords,
          skippedRecords: job.skippedRecords,
          duplicateRecords: job.duplicateRecords,
          percentComplete: job.percentComplete,
          errorMessage: job.errorMessage || undefined,
        });
        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
          setIsComplete(true);
          clearInterval(pollInterval);
        }
      } catch {
        // ignore poll errors
      }
    }, 3000);

    return () => {
      socket.disconnect();
      clearInterval(pollInterval);
    };
  }, [jobId]);

  const handleDownloadFailed = async () => {
    setDownloading(true);
    try {
      await leadImportApi.downloadFailed(jobId);
    } catch {
      // ignore
    }
    setDownloading(false);
  };

  const isFailed = progress.status === 'failed';
  const isCancelled = progress.status === 'cancelled';
  const isCompleted = progress.status === 'completed';
  const isProcessing = !isComplete;

  return (
    <div className="max-w-lg mx-auto text-center">
      {/* Status Icon */}
      <div className="mb-6">
        {isProcessing ? (
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          </div>
        ) : isCompleted ? (
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
        ) : isFailed ? (
          <div className="w-16 h-16 mx-auto rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        ) : (
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {isProcessing
          ? 'Importing Leads...'
          : isCompleted
          ? 'Import Complete'
          : isFailed
          ? 'Import Failed'
          : 'Import Cancelled'}
      </h3>

      {progress.errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{progress.errorMessage}</p>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2 mt-4">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${
            isFailed ? 'bg-red-500' : isCancelled ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {(progress.processedRecords ?? 0).toLocaleString()} of {(progress.totalRecords ?? 0).toLocaleString()} records processed
        ({progress.percentComplete ?? 0}%)
      </p>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <p className="text-2xl font-bold text-emerald-600">{progress.importedRecords.toLocaleString()}</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Imported</p>
        </div>
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-2xl font-bold text-red-600">{progress.failedRecords.toLocaleString()}</p>
          <p className="text-xs text-red-700 dark:text-red-300">Failed</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-2xl font-bold text-amber-600">{progress.skippedRecords.toLocaleString()}</p>
          <p className="text-xs text-amber-700 dark:text-amber-300">Skipped</p>
        </div>
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-2xl font-bold text-blue-600">{progress.duplicateRecords.toLocaleString()}</p>
          <p className="text-xs text-blue-700 dark:text-blue-300">Duplicates</p>
        </div>
      </div>

      {/* Actions */}
      {isComplete && (
        <div className="flex justify-center gap-3">
          {progress.failedRecords > 0 && (
            <button
              onClick={handleDownloadFailed}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
            >
              <Download size={16} />
              {downloading ? 'Downloading...' : 'Download Failed Records'}
            </button>
          )}
          {progress.importedRecords > 0 && (
            <button
              onClick={onViewLeads}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              View Leads <ArrowRight size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Close
          </button>
        </div>
      )}

      {isProcessing && (
        <button
          onClick={async () => {
            try {
              await leadImportApi.cancelJob(jobId);
              setProgress(prev => ({ ...prev, status: 'cancelled' }));
              setIsComplete(true);
            } catch {
              // ignore
            }
          }}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Cancel Import
        </button>
      )}
    </div>
  );
}
