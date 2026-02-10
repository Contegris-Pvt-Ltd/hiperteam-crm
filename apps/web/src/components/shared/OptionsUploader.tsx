import { useState, useRef } from 'react';
import { FileText, FileSpreadsheet, AlertCircle, CheckCircle, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Option {
  label: string;
  value: string;
}

interface ConditionalOption {
  parentValue: string;
  label: string;
  value: string;
}

interface OptionsUploaderProps {
  mode: 'simple' | 'conditional' | 'singleParent';
  parentOptions?: { label: string; value: string }[];
  selectedParentValue?: string; // For singleParent mode
  selectedParentLabel?: string; // For display
  onOptionsLoaded: (options: Option[] | Record<string, Option[]>) => void;
  onClose: () => void;
}

interface ParseResult {
  valid: Option[] | ConditionalOption[];
  errors: string[];
  warnings: string[];
}

export function OptionsUploader({ 
  mode, 
  parentOptions, 
  selectedParentValue,
  selectedParentLabel,
  onOptionsLoaded, 
  onClose 
}: OptionsUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateValue = (label: string): string => {
    return label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const sanitizeText = (text: string): string => {
    return text
      .trim()
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 200); // Max 200 chars
  };

  const validateOption = (label: string, value: string): { valid: boolean; error?: string } => {
    if (!label || label.trim().length === 0) {
      return { valid: false, error: 'Label is empty' };
    }
    if (label.length > 200) {
      return { valid: false, error: 'Label too long (max 200 chars)' };
    }
    if (value && value.length > 100) {
      return { valid: false, error: 'Value too long (max 100 chars)' };
    }
    if (value && !/^[a-z0-9_-]+$/i.test(value)) {
      return { valid: false, error: 'Value contains invalid characters' };
    }
    return { valid: true };
  };

  // Case-insensitive parent value lookup
  const findParentValue = (inputValue: string): string | null => {
    if (!parentOptions) return null;
    const match = parentOptions.find(
      p => p.value.toLowerCase() === inputValue.toLowerCase() || 
           p.label.toLowerCase() === inputValue.toLowerCase()
    );
    return match?.value || null;
  };

  const parseTXT = (content: string): ParseResult => {
    const lines = content.split(/[\r\n]+/).filter(line => line.trim());
    const valid: Option[] | ConditionalOption[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenValues = new Set<string>();

    lines.forEach((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        
        if (mode === 'conditional') {
        // Format: parent_value, label, value
        const parentInput = parts[0] || '';
        const parentValue = findParentValue(parentInput);
        const label = sanitizeText(parts[1] || '');
        let value = parts[2]?.trim() || generateValue(label);

        if (!parentInput) {
            errors.push(`Line ${index + 1}: Parent value is required`);
            return;
        }

        if (!parentValue) {
            errors.push(`Line ${index + 1}: Invalid parent value "${parentInput}" (no match found)`);
            return;
        }

        const validation = validateOption(label, value);
        if (!validation.valid) {
            errors.push(`Line ${index + 1}: ${validation.error} - "${line}"`);
            return;
        }

        const key = `${parentValue}:${value}`;
        if (seenValues.has(key)) {
            warnings.push(`Line ${index + 1}: Duplicate value "${value}" for parent "${parentInput}" - skipped`);
            return;
        }

        seenValues.add(key);
        (valid as ConditionalOption[]).push({ parentValue, label, value });
        } else if (mode === 'singleParent') {
        // Format: label, value (parent is pre-selected)
        const label = sanitizeText(parts[0] || '');
        let value = parts[1]?.trim() || generateValue(label);

        if (!label) return; // Skip empty lines

        const validation = validateOption(label, value);
        if (!validation.valid) {
            errors.push(`Line ${index + 1}: ${validation.error} - "${line}"`);
            return;
        }

        if (seenValues.has(value)) {
            warnings.push(`Line ${index + 1}: Duplicate value "${value}" - skipped`);
            return;
        }

        seenValues.add(value);
        (valid as Option[]).push({ label, value });
        } else {
        // Format: label, value
        const label = sanitizeText(parts[0] || '');
        let value = parts[1]?.trim() || generateValue(label);

        const validation = validateOption(label, value);
        if (!validation.valid) {
            errors.push(`Line ${index + 1}: ${validation.error} - "${line}"`);
            return;
        }

        if (seenValues.has(value)) {
            warnings.push(`Line ${index + 1}: Duplicate value "${value}" - skipped`);
            return;
        }

        seenValues.add(value);
        (valid as Option[]).push({ label, value });
        }
    });

    return { valid, errors, warnings };
  };

  const parseCSV = (content: string): ParseResult => {
    const lines = content.split(/[\r\n]+/).filter(line => line.trim());
    const valid: Option[] | ConditionalOption[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const seenValues = new Set<string>();

    // Check if first line is header
    const firstLine = lines[0]?.toLowerCase() || '';
    const hasHeader = firstLine.includes('label') || firstLine.includes('value') || firstLine.includes('parent');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    dataLines.forEach((line, index) => {
      const lineNum = hasHeader ? index + 2 : index + 1;
      // Handle quoted CSV values
      const parts = line.match(/("([^"]*)"|[^,]+)/g)?.map(p => p.replace(/^"|"$/g, '').trim()) || [];

      if (mode === 'conditional') {
        // Format: parent_value, label, value
        const parentInput = parts[0] || '';
        const parentValue = findParentValue(parentInput);
        const label = sanitizeText(parts[1] || '');
        let value = parts[2]?.trim() || generateValue(label);

        if (!parentInput) {
          errors.push(`Line ${lineNum}: Parent value is required`);
          return;
        }

        if (!parentValue) {
          errors.push(`Line ${lineNum}: Invalid parent value "${parentInput}" (no match found)`);
          return;
        }

        const validation = validateOption(label, value);
        if (!validation.valid) {
          errors.push(`Line ${lineNum}: ${validation.error}`);
          return;
        }

        const key = `${parentValue}:${value}`;
        if (seenValues.has(key)) {
          warnings.push(`Line ${lineNum}: Duplicate value "${value}" for parent "${parentInput}" - skipped`);
          return;
        }

        seenValues.add(key);
        (valid as ConditionalOption[]).push({ parentValue, label, value });
      } else if (mode === 'singleParent') {
        // Format: label, value (parent is pre-selected)
        const label = sanitizeText(parts[0] || '');
        let value = parts[1]?.trim() || generateValue(label);

        if (!label) return; // Skip empty lines

        const validation = validateOption(label, value);
        if (!validation.valid) {
          errors.push(`Line ${lineNum}: ${validation.error}`);
          return;
        }

        if (seenValues.has(value)) {
          warnings.push(`Line ${lineNum}: Duplicate value "${value}" - skipped`);
          return;
        }

        seenValues.add(value);
        (valid as Option[]).push({ label, value });
      } else {
        // Format: label, value
        const label = sanitizeText(parts[0] || '');
        let value = parts[1]?.trim() || generateValue(label);

        const validation = validateOption(label, value);
        if (!validation.valid) {
          errors.push(`Line ${lineNum}: ${validation.error}`);
          return;
        }

        if (seenValues.has(value)) {
          warnings.push(`Line ${lineNum}: Duplicate value "${value}" - skipped`);
          return;
        }

        seenValues.add(value);
        (valid as Option[]).push({ label, value });
      }
    });

    return { valid, errors, warnings };
  };

  const parseXLSX = async (file: File): Promise<ParseResult> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

          const valid: Option[] | ConditionalOption[] = [];
          const errors: string[] = [];
          const warnings: string[] = [];
          const seenValues = new Set<string>();

          // Check if first row is header
          const firstRow = rows[0]?.map(cell => String(cell || '').toLowerCase()) || [];
          const hasHeader = firstRow.some(cell => 
            cell.includes('label') || cell.includes('value') || cell.includes('parent')
          );
          const dataRows = hasHeader ? rows.slice(1) : rows;

          dataRows.forEach((row, index) => {
            const lineNum = hasHeader ? index + 2 : index + 1;
            const cells = row.map(cell => String(cell || '').trim());

            if (mode === 'conditional') {
              const parentInput = cells[0] || '';
              const parentValue = findParentValue(parentInput);
              const label = sanitizeText(cells[1] || '');
              let value = cells[2] || generateValue(label);

              if (!parentInput) {
                errors.push(`Row ${lineNum}: Parent value is required`);
                return;
              }

              if (!parentValue) {
                errors.push(`Row ${lineNum}: Invalid parent value "${parentInput}" (no match found)`);
                return;
              }

              const validation = validateOption(label, value);
              if (!validation.valid) {
                errors.push(`Row ${lineNum}: ${validation.error}`);
                return;
              }

              const key = `${parentValue}:${value}`;
              if (seenValues.has(key)) {
                warnings.push(`Row ${lineNum}: Duplicate value "${value}" for parent "${parentInput}" - skipped`);
                return;
              }

              seenValues.add(key);
              (valid as ConditionalOption[]).push({ parentValue, label, value });
            } else if (mode === 'singleParent') {
              const label = sanitizeText(cells[0] || '');
              let value = cells[1] || generateValue(label);

              if (!label) return; // Skip empty rows

              const validation = validateOption(label, value);
              if (!validation.valid) {
                errors.push(`Row ${lineNum}: ${validation.error}`);
                return;
              }

              if (seenValues.has(value)) {
                warnings.push(`Row ${lineNum}: Duplicate value "${value}" - skipped`);
                return;
              }

              seenValues.add(value);
              (valid as Option[]).push({ label, value });
            } else {
              const label = sanitizeText(cells[0] || '');
              let value = cells[1] || generateValue(label);

              if (!label) return; // Skip empty rows

              const validation = validateOption(label, value);
              if (!validation.valid) {
                errors.push(`Row ${lineNum}: ${validation.error}`);
                return;
              }

              if (seenValues.has(value)) {
                warnings.push(`Row ${lineNum}: Duplicate value "${value}" - skipped`);
                return;
              }

              seenValues.add(value);
              (valid as Option[]).push({ label, value });
            }
          });

          resolve({ valid, errors, warnings });
        } catch {
          resolve({ valid: [], errors: ['Failed to parse Excel file'], warnings: [] });
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setResult(null);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let parseResult: ParseResult;

      if (ext === 'txt') {
        const content = await file.text();
        parseResult = parseTXT(content);
      } else if (ext === 'csv') {
        const content = await file.text();
        parseResult = parseCSV(content);
      } else if (ext === 'xlsx' || ext === 'xls') {
        parseResult = await parseXLSX(file);
      } else {
        parseResult = { valid: [], errors: ['Unsupported file type'], warnings: [] };
      }

      setResult(parseResult);
    } catch {
      setResult({ valid: [], errors: ['Failed to read file'], warnings: [] });
    } finally {
      setParsing(false);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFile(files[0]);
    }
  };

  const handleApply = () => {
    if (!result || result.valid.length === 0) return;

    if (mode === 'conditional') {
      // Group by parent value
      const grouped: Record<string, Option[]> = {};
      (result.valid as ConditionalOption[]).forEach(opt => {
        if (!grouped[opt.parentValue]) {
          grouped[opt.parentValue] = [];
        }
        grouped[opt.parentValue].push({ label: opt.label, value: opt.value });
      });
      onOptionsLoaded(grouped);
    } else if (mode === 'singleParent' && selectedParentValue) {
      // Return as grouped with single parent
      const grouped: Record<string, Option[]> = {
        [selectedParentValue]: result.valid as Option[],
      };
      onOptionsLoaded(grouped);
    } else {
      onOptionsLoaded(result.valid as Option[]);
    }
  };

  const downloadTemplate = () => {
    let content: string;
    let filename: string;

    if (mode === 'conditional') {
      content = 'parent_value,label,value\n';
      content += '# Parent value can match by value OR label (case-insensitive)\n';
      parentOptions?.forEach(parent => {
        content += `${parent.value},Example Option 1,example_1\n`;
        content += `${parent.value},Example Option 2,example_2\n`;
      });
      filename = 'conditional_options_template.csv';
    } else if (mode === 'singleParent') {
      content = 'label,value\n';
      content += `# Options for: ${selectedParentLabel || selectedParentValue}\n`;
      content += 'Option 1,option_1\nOption 2,option_2\nOption 3,option_3\n';
      filename = `options_for_${selectedParentValue}_template.csv`;
    } else {
      content = 'label,value\nOption 1,option_1\nOption 2,option_2\nOption 3,option_3\n';
      filename = 'options_template.csv';
    }

    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFormatDescription = () => {
    if (mode === 'conditional') {
      return (
        <>
          Format: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">parent_value, label, value</code>
          <br />
          <span className="text-xs">Parent matching is case-insensitive and works with label or value</span>
        </>
      );
    } else if (mode === 'singleParent') {
      return (
        <>
          Format: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">label, value</code> (value is optional)
          <br />
          <span className="text-xs">All options will be added to: <strong>{selectedParentLabel || selectedParentValue}</strong></span>
        </>
      );
    } else {
      return (
        <>Format: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">label, value</code> (value is optional)</>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Bulk Upload Options
              </h3>
              {mode === 'singleParent' && selectedParentLabel && (
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  For: {selectedParentLabel}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Instructions */}
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                Supported formats: TXT, CSV, XLSX
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                {getFormatDescription()}
              </p>
              <button
                onClick={downloadTemplate}
                className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> Download template
              </button>
            </div>

            {/* Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600'
              }`}
            >
              {parsing ? (
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-sm text-gray-600 dark:text-slate-400">Parsing file...</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center gap-2 mb-3">
                    <FileText className="w-8 h-8 text-gray-400" />
                    <FileSpreadsheet className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Drag and drop a file here, or click to select
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    TXT, CSV, or Excel file
                  </p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".txt,.csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Results */}
            {result && (
              <div className="mt-4 space-y-3">
                {/* Success count */}
                {result.valid.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">
                      {result.valid.length} valid option{result.valid.length !== 1 ? 's' : ''} found
                    </span>
                  </div>
                )}

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                      {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}:
                    </p>
                    <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1 max-h-20 overflow-y-auto">
                      {result.warnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Errors */}
                {result.errors.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}:
                    </p>
                    <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
                      {result.errors.map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preview */}
                {result.valid.length > 0 && (
                  <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-slate-800 text-xs font-medium text-gray-500 dark:text-slate-400">
                      Preview (first 10)
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-slate-700">
                            {mode === 'conditional' && (
                              <th className="px-3 py-2 text-left text-gray-500 dark:text-slate-400">Parent</th>
                            )}
                            <th className="px-3 py-2 text-left text-gray-500 dark:text-slate-400">Label</th>
                            <th className="px-3 py-2 text-left text-gray-500 dark:text-slate-400">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(result.valid as (Option | ConditionalOption)[]).slice(0, 10).map((opt, i) => (
                            <tr key={i} className="border-b border-gray-100 dark:border-slate-800 last:border-0">
                              {mode === 'conditional' && (
                                <td className="px-3 py-2 text-purple-600 dark:text-purple-400">
                                  {(opt as ConditionalOption).parentValue}
                                </td>
                              )}
                              <td className="px-3 py-2 text-gray-900 dark:text-white">{opt.label}</td>
                              <td className="px-3 py-2 text-gray-500 dark:text-slate-400">
                                <code>{opt.value}</code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!result || result.valid.length === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add {result?.valid.length || 0} Options
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}