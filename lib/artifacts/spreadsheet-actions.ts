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
  const language = artifact.language.split('-')[0];
  const t = language === 'ar' ? {
    overview: 'ملخص الأداء', metrics: 'المؤشرات الرئيسية', trend: 'الاتجاه', detail: 'ملخص المقاييس', insights: 'أبرز النتائج',
    latest: 'الأحدث', average: 'المتوسط', high: 'الأعلى', low: 'الأدنى', metric: 'المقياس', range: 'النطاق',
    records: 'سجلات محللة', increased: 'ارتفع', decreased: 'انخفض', unchanged: 'لم يتغير', from: 'من', to: 'إلى',
  } : language === 'fr' ? {
    overview: 'Vue d’ensemble', metrics: 'Indicateurs clés', trend: 'Tendance', detail: 'Synthèse des mesures', insights: 'Constats clés',
    latest: 'Dernière valeur', average: 'Moyenne', high: 'Maximum', low: 'Minimum', metric: 'Mesure', range: 'Plage',
    records: 'Enregistrements analysés', increased: 'a augmenté', decreased: 'a diminué', unchanged: 'est resté stable', from: 'de', to: 'à',
  } : {
    overview: 'Performance overview', metrics: 'Key metrics', trend: 'Trend', detail: 'Metrics summary', insights: 'Key insights',
    latest: 'Latest', average: 'Average', high: 'High', low: 'Low', metric: 'Metric', range: 'Range',
    records: 'Records analyzed', increased: 'increased', decreased: 'decreased', unchanged: 'was unchanged', from: 'from', to: 'to',
  };
  const rows = sheet.rows.slice(1);
  const format = (value: number) => new Intl.NumberFormat(artifact.language, { maximumFractionDigits: 2 }).format(value);
  const metrics = sheet.columns.map((name, index) => {
    if (index === 0) return null; // The first column is the category/period, not a measure.
    const values = rows.map((row) => row[index]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (!values.length) return null;
    const latest = values.at(-1)!;
    return { name, values, latest, first: values[0], average: values.reduce((sum, value) => sum + value, 0) / values.length,
      low: Math.min(...values), high: Math.max(...values) };
  }).filter((metric): metric is NonNullable<typeof metric> => metric !== null).slice(0, 4);
  const lead = metrics[0];
  const kpiRows = lead ? [
    [t.latest, format(lead.latest)], [t.average, format(lead.average)],
    [t.high, format(lead.high)], [t.low, format(lead.low)],
  ] : [[t.records, format(rows.length)]];
  const summaryRows = [[t.metric, t.latest, t.average, t.range], ...metrics.map((metric) => [
    metric.name, format(metric.latest), format(metric.average), `${format(metric.low)}–${format(metric.high)}`,
  ])];
  const insights = metrics.slice(0, 3).map((metric) => `${metric.name} ${metric.latest > metric.first ? t.increased : metric.latest < metric.first ? t.decreased : t.unchanged} ${t.from} ${format(metric.first)} ${t.to} ${format(metric.latest)}.`);
  if (!insights.length) insights.push(`${t.records}: ${format(rows.length)}.`);
  return { schemaVersion: 1, id: crypto.randomUUID(), type: 'presentation', title, language: artifact.language,
    direction: artifact.direction, metadata: {}, slides: [
      { id: 'title', layout: 'title', variant: 'cover', title, subtitle: `${sheet.name} · ${t.overview}`, blocks: [] },
      { id: 'kpi', layout: 'content', variant: 'kpi', title: t.metrics, subtitle: lead?.name, blocks: [{ kind: 'table', rows: kpiRows }] },
      ...(chart ? [{ id: 'chart', layout: 'content' as const, variant: 'chart' as const, title: t.trend, subtitle: chart.title, blocks: [{ kind: 'chart' as const, chartId: chart.id }] }] : []),
      { id: 'metrics', layout: 'content', variant: 'table', title: t.detail, blocks: [{ kind: 'table', rows: summaryRows }] },
      { id: 'insights', layout: 'content', variant: 'insights', title: t.insights, blocks: [{ kind: 'bullets', items: insights }] },
    ] };
}
