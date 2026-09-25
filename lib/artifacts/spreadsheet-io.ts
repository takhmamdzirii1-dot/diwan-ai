import { artifactDirection, type ArtifactSheet, type SheetCell, type SpreadsheetArtifact } from './core';

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_CELLS = 100_000;
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function safeCell(value: unknown, csv = false): SheetCell {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === 'string' && csv && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value))) return Number(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function safeName(name: string): string { return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '').slice(0, 80) || 'spreadsheet'; }

export async function importSpreadsheet(file: File, language: string): Promise<SpreadsheetArtifact> {
  if (!/\.(xlsx|csv)$/i.test(file.name)) throw new Error('Only XLSX and CSV files are supported.');
  if (file.size > MAX_FILE_BYTES) throw new Error('This workbook is too large for browser preview.');
  return parseSpreadsheetBuffer(await file.arrayBuffer(), file.name, language);
}

export async function parseSpreadsheetBuffer(buffer: ArrayBuffer, fileName: string, language: string): Promise<SpreadsheetArtifact> {
  const XLSX = await import('xlsx');
  const csv = /\.csv$/i.test(fileName);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, bookVBA: false, raw: csv });
  let cellCount = 0;
  const sheets: ArtifactSheet[] = workbook.SheetNames.map((name, index) => {
    const worksheet = workbook.Sheets[name];
    const bounds = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    cellCount += (bounds.e.r + 1) * (bounds.e.c + 1);
    if (cellCount > MAX_CELLS) throw new Error('Select a smaller workbook or range.');
    const data = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, defval: null }) as unknown[][];
    const width = data.reduce((maximum, row) => Math.max(maximum, row.length), 1);
    return { id: `sheet-${index}`, name, columns: Array.from({ length: width }, (_, column) => XLSX.utils.encode_col(column)), rows: data.map((row) => row.map((cell) => safeCell(cell, csv))) };
  });
  const title = safeName(fileName.replace(/\.(xlsx|csv)$/i, ''));
  return { schemaVersion: 1, id: crypto.randomUUID(), type: 'spreadsheet', title, language,
    direction: artifactDirection(language, sheets[0]?.rows.slice(0, 5).flat().join(' ') ?? ''), sheets, metadata: {} };
}

function exportCell(value: SheetCell): SheetCell {
  // Spreadsheet applications must not interpret untrusted text as a formula on export.
  return typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export async function exportSpreadsheet(artifact: SpreadsheetArtifact): Promise<Blob> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  artifact.sheets.forEach((sheet, index) => {
    const rows = sheet.rows.map((row) => row.map(exportCell));
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName(sheet.name).slice(0, 31) || `Sheet ${index + 1}`);
  });
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([bytes], { type: MIME });
}
