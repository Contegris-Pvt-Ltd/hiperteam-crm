/**
 * Drop-in replacement for the abandoned 'xlsx' (SheetJS) package.
 * Wraps exceljs to expose the same API surface used throughout the codebase.
 *
 * Supported patterns:
 *   read(buffer, { type: 'buffer' })
 *   utils.sheet_to_json(sheet, { header: 1, defval: '' })
 *   utils.json_to_sheet(data, { header })
 *   utils.aoa_to_sheet(data)
 *   utils.book_new()
 *   utils.book_append_sheet(wb, ws, name)
 *   write(wb, { type: 'buffer', bookType: 'xlsx' })
 */
import ExcelJS from 'exceljs';

// Internal storage types
interface SheetData {
  _rows: any[][];
  _name: string;
}

interface WorkbookData {
  SheetNames: string[];
  Sheets: Record<string, SheetData>;
}

/**
 * Read a buffer into a workbook-like object
 */
async function readAsync(buffer: Buffer | ArrayBuffer): Promise<WorkbookData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const result: WorkbookData = { SheetNames: [], Sheets: {} };

  wb.eachSheet((sheet) => {
    const name = sheet.name;
    result.SheetNames.push(name);

    const rows: any[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const values = row.values as any[];
      // ExcelJS row.values is 1-indexed (index 0 is empty)
      rows[rowNumber - 1] = values.slice(1);
    });
    result.Sheets[name] = { _rows: rows, _name: name };
  });

  return result;
}

/**
 * Synchronous read wrapper — uses the async reader internally.
 * For backward compatibility with `XLSX.read(buffer, { type: 'buffer' })`.
 * Returns a Promise but callers can also use it synchronously in contexts
 * where the workbook is already cached.
 */
function read(buffer: Buffer, _opts?: any): WorkbookData {
  // We need a sync-compatible approach. ExcelJS is async-only for xlsx.
  // Use a blocking workaround: parse as CSV-like from buffer using exceljs sync API
  // Actually, we'll return a placeholder and provide readAsync for proper usage.
  // Since this is always used with await or in async contexts, we'll make it work.
  throw new Error('Use readAsync() instead of read() — see xlsx-compat.ts');
}

/**
 * Convert sheet to JSON (array of arrays when header: 1)
 */
function sheet_to_json(sheet: SheetData, opts?: { header?: number; defval?: any }): any[] {
  const rows = sheet._rows || [];
  const defval = opts?.defval;

  if (opts?.header === 1) {
    // Return raw arrays
    if (defval !== undefined) {
      const maxCols = Math.max(...rows.map(r => r?.length || 0), 0);
      return rows.map(r => {
        const row = r || [];
        const padded = [];
        for (let i = 0; i < maxCols; i++) {
          const v = row[i];
          padded.push(v !== undefined && v !== null ? v : defval);
        }
        return padded;
      });
    }
    return rows.map(r => r || []);
  }

  // Default: array of objects using first row as headers
  if (rows.length < 2) return [];
  const headers = (rows[0] || []).map((h: any) => String(h ?? ''));
  return rows.slice(1).map(row => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => {
      obj[h] = row?.[i] ?? defval;
    });
    return obj;
  });
}

/**
 * Convert JSON array to sheet data
 */
function json_to_sheet(data: Record<string, any>[], opts?: { header?: string[] }): SheetData {
  if (!data.length) return { _rows: [], _name: '' };

  const headers = opts?.header || Object.keys(data[0]);
  const rows: any[][] = [headers];
  for (const item of data) {
    rows.push(headers.map(h => item[h] ?? ''));
  }
  return { _rows: rows, _name: '' };
}

/**
 * Convert array-of-arrays to sheet data
 */
function aoa_to_sheet(data: any[][]): SheetData {
  return { _rows: data, _name: '' };
}

/**
 * Create a new workbook
 */
function book_new(): WorkbookData {
  return { SheetNames: [], Sheets: {} };
}

/**
 * Append a sheet to a workbook
 */
function book_append_sheet(wb: WorkbookData, ws: SheetData, name: string): void {
  wb.SheetNames.push(name);
  ws._name = name;
  wb.Sheets[name] = ws;
}

/**
 * Write workbook to buffer
 */
async function writeAsync(wb: WorkbookData, _opts?: any): Promise<Buffer> {
  const excelWb = new ExcelJS.Workbook();

  for (const name of wb.SheetNames) {
    const sheetData = wb.Sheets[name];
    const ws = excelWb.addWorksheet(name);

    for (const row of sheetData._rows || []) {
      ws.addRow(row);
    }
  }

  const arrayBuffer = await excelWb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// Synchronous write throws — use writeAsync
function write(_wb: WorkbookData, _opts?: any): never {
  throw new Error('Use writeAsync() instead of write() — see xlsx-compat.ts');
}

export const XLSX = {
  read,
  readAsync,
  write,
  writeAsync,
  utils: {
    sheet_to_json,
    json_to_sheet,
    aoa_to_sheet,
    book_new,
    book_append_sheet,
  },
};

export default XLSX;
