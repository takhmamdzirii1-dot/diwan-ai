import { artifactDirection, type ArtifactSheet, type ChartArtifact, type ChartType, type PresentationArtifact, type SpreadsheetArtifact } from './core';

export function chartFromSheet(artifact: SpreadsheetArtifact, sheet: ArtifactSheet, chartType: ChartType, rowStart = 0, rowEnd = Math.min(sheet.rows.length, 100)): ChartArtifact {
  const start = Math.max(0, rowStart);
  const rows = sheet.rows.slice(start, Math.min(sheet.rows.length, rowEnd, start + 501));
  const header = rows[0] ?? [];
  const values = rows.slice(1);
  const numericColumns = sheet.columns.map((_, index) => index).filter((index) => index > 0 && values.some((row) => typeof row[index] === 'number'));
  if (!numericColumns.length || !values.length) throw new Error('Select a range with labels and numeric values.');
  const categories = values.map((row, index) => String(row[0] ?? index + rowStart + 2));
  const series = numericColumns.map((index) => ({ name: String(header[index] ?? sheet.columns[index]), values: values.map((row) => typeof row[index] === 'number' ? row[index] as number : null) }));
  const title = `${sheet.name} chart`;
  return { schemaVersion: 1, id: crypto.randomUUID(), type: 'chart', title, chartType, language: artifact.language,
    direction: artifactDirection(artifact.language, `${title} ${categories.join(' ')}`, artifact.direction), categories, series,
    source: { artifactId: artifact.id, sheetId: sheet.id, rowStart, rowEnd }, metadata: {} };
}

export function spreadsheetContext(artifact: SpreadsheetArtifact, sheet: ArtifactSheet, rowStart = 0, rowEnd = Math.min(sheet.rows.length, 40)): string {
  const start = Math.max(0, rowStart);
  const end = Math.min(sheet.rows.length, rowEnd, start + 40);
  const lines = sheet.rows.slice(start, end).map((row) => row.slice(0, 16).map((cell) => String(cell ?? '').replace(/[\t\r\n]+/g, ' ').slice(0, 100)).join('\t'));
  return `Workbook: ${artifact.title}\nSheet: ${sheet.name}\nRows: ${sheet.rows.length}; columns: ${sheet.columns.length}\nSelected rows: ${start + 1}-${end}\n${lines.join('\n').slice(0, 12000)}`;
}

export function presentationFromSheet(artifact: SpreadsheetArtifact, sheet: ArtifactSheet, chart?: ChartArtifact): PresentationArtifact {
  const title = artifact.title;
  const preview = sheet.rows.slice(0, 9).map((row) => row.slice(0, 6).map((cell) => String(cell ?? '')));
  return { schemaVersion: 1, id: crypto.randomUUID(), type: 'presentation', title, language: artifact.language,
    direction: artifact.direction, metadata: {}, slides: [
      { id: 'title', layout: 'title', title, subtitle: sheet.name, blocks: [] },
      { id: 'data', layout: 'content', title: sheet.name, blocks: [{ kind: 'table', rows: preview }] },
      ...(chart ? [{ id: 'chart', layout: 'content' as const, title: chart.title, blocks: [{ kind: 'chart' as const, chartId: chart.id }] }] : []),
    ] };
}
