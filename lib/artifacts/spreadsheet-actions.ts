import { artifactDirection, type ArtifactSheet, type ChartArtifact, type ChartType, type PresentationArtifact, type SpreadsheetArtifact } from './core';

export function chartFromSheet(artifact: SpreadsheetArtifact, sheet: ArtifactSheet, chartType: ChartType, rowStart = 0, rowEnd = Math.min(sheet.rows.length, 100)): ChartArtifact {
  const start = Math.max(0, rowStart);
  const rows = sheet.rows.slice(start, Math.min(sheet.rows.length, rowEnd, start + 501));
  const genericColumns = sheet.columns.every((name, index) => name === spreadsheetColumnName(index));
  const firstRowIsHeader = start === 0 && (genericColumns
    || sheet.columns.every((name, index) => String(rows[0]?.[index] ?? '').trim() === name));
  const header = genericColumns ? sheet.rows[0] ?? [] : sheet.columns;
  const values = firstRowIsHeader ? rows.slice(1) : rows;
  if (values.length < 2) throw new Error('CHART_COLUMNS_REQUIRED');
  const names = sheet.columns.map((name, index) => String(header[index] ?? name).trim());
  const isIdentifier = (name: string) => /(?:^|[_\s-])(?:id|code|index|serial|sku|key)(?:$|[_\s-])|(?:id|code)$/i.test(name);
  const measureName = (name: string) => /price|sales|revenue|quantity|cost|amount|results?|spend|reach|impressions?|units?|profit|total|value|count|volume|score|rate/i.test(name);
  const numeric = names.map((_, index) => index).filter((index) => !isIdentifier(names[index])
    && values.some((row) => typeof row[index] === 'number' && Number.isFinite(row[index])));
  const measures = numeric.filter((index) => measureName(names[index]));
  const candidates = measures.length ? measures : numeric.filter((index) => {
    const numbers = values.map((row) => row[index]);
    const first = numbers[0];
    return !(typeof first === 'number' && numbers.every((value, position) => typeof value === 'number'
      && value === first + position));
  });
  const labelIndex = names.findIndex((name, index) => !numeric.includes(index) && !isIdentifier(name)
    && values.some((row) => typeof row[index] === 'string' && String(row[index]).trim()));
  if (labelIndex < 0 || !candidates.length) throw new Error('CHART_COLUMNS_REQUIRED');
  const categories = values.map((row) => String(row[labelIndex] ?? '').slice(0, 160));
  if (categories.some((category) => !category.trim())) throw new Error('CHART_COLUMNS_REQUIRED');
  const series = candidates.slice(0, 2).map((index) => ({ name: names[index],
    values: values.map((row) => typeof row[index] === 'number' && Number.isFinite(row[index]) ? row[index] as number : null) }));
  const title = `${sheet.name} chart`;
  return { schemaVersion: 1, id: crypto.randomUUID(), type: 'chart', title, chartType, language: artifact.language,
    direction: artifactDirection(artifact.language, `${title} ${categories.join(' ')}`, artifact.direction), categories, series,
    source: { artifactId: artifact.id, sheetId: sheet.id, rowStart, rowEnd }, metadata: {} };
}

function spreadsheetColumnName(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) { value--; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
  return result;
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
