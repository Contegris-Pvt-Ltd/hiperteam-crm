import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface StepPreviewProps {
  headers: string[];
  previewRows: Record<string, any>[];
  mapping: Record<string, string>;
  leadFieldOptions: { value: string; label: string }[];
  totalRows: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d][\d\s\-().]{6,}$/;

type CellStatus = 'valid' | 'warning' | 'error';

function validateCell(value: string, fieldKey: string): { status: CellStatus; message?: string } {
  if (!value || value.trim() === '') {
    if (['lastName', 'email', 'phone'].includes(fieldKey)) {
      return { status: 'warning', message: 'Empty — will use other required field' };
    }
    return { status: 'valid' };
  }

  if (fieldKey === 'email') {
    if (!EMAIL_REGEX.test(value)) {
      return { status: 'error', message: 'Invalid email format — will not be imported' };
    }
  }

  if (fieldKey === 'phone' || fieldKey === 'mobile') {
    if (!PHONE_REGEX.test(value.replace(/\s/g, ''))) {
      return { status: 'error', message: 'Invalid phone — will not be imported' };
    }
    // Check if it looks like it needs normalization
    if (!value.startsWith('+')) {
      return { status: 'warning', message: 'Will be normalized with country code' };
    }
  }

  return { status: 'valid' };
}

export default function StepPreview({
  headers,
  previewRows,
  mapping,
  leadFieldOptions,
  totalRows,
}: StepPreviewProps) {
  // Get mapped columns only (non-skipped)
  const mappedColumns = headers.filter(h => mapping[h] && mapping[h] !== '__skip__');
  const fieldLabelMap = Object.fromEntries(leadFieldOptions.map(o => [o.value, o.label]));

  // Analyze all preview rows for summary
  let warningCount = 0;
  let errorCount = 0;

  const cellStatuses: { status: CellStatus; message?: string }[][] = previewRows.map(row => {
    return mappedColumns.map(header => {
      const fieldKey = mapping[header];
      const value = String(row[header] || '');
      const result = validateCell(value, fieldKey);
      if (result.status === 'warning') warningCount++;
      if (result.status === 'error') errorCount++;
      return result;
    });
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Preview Import</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing first {previewRows.length} of {totalRows.toLocaleString()} records
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span className="text-sm text-emerald-700 dark:text-emerald-300">
            {totalRows.toLocaleString()} records ready
          </span>
        </div>
        {warningCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle size={16} className="text-amber-500" />
            <span className="text-sm text-amber-700 dark:text-amber-300">
              {warningCount} cells will be normalized
            </span>
          </div>
        )}
        {errorCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <XCircle size={16} className="text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-400">
              {errorCount} cells have errors
            </span>
          </div>
        )}
      </div>

      {/* Preview table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800">
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-3 py-2 w-10">#</th>
              {mappedColumns.map(header => (
                <th key={header} className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-3 py-2 whitespace-nowrap">
                  {fieldLabelMap[mapping[header]] || mapping[header]}
                  <div className="text-[10px] font-normal text-gray-400">{header}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {previewRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="px-3 py-2 text-gray-400">{rowIdx + 1}</td>
                {mappedColumns.map((header, colIdx) => {
                  const value = String(row[header] || '');
                  const cellStatus = cellStatuses[rowIdx]?.[colIdx];

                  return (
                    <td key={header} className="px-3 py-2 relative group">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm ${
                          cellStatus?.status === 'error'
                            ? 'text-red-600 dark:text-red-400 line-through'
                            : cellStatus?.status === 'warning'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {value || <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </span>
                        {cellStatus?.status === 'error' && (
                          <XCircle size={13} className="text-red-500 flex-shrink-0" />
                        )}
                        {cellStatus?.status === 'warning' && (
                          <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      {cellStatus?.message && (
                        <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
                          {cellStatus.message}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalRows > 5 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
          ... and {(totalRows - 5).toLocaleString()} more records
        </p>
      )}
    </div>
  );
}
