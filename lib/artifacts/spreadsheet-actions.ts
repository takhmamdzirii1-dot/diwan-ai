import { artifactDirection, type ArtifactSheet, type ChartArtifact, type ChartType, type PresentationArtifact, type SpreadsheetArtifact } from './core';

export type SpreadsheetColumnKind = 'label' | 'identifier' | 'measure' | 'date' | 'unusable';
export type AgentChartPlan = { purpose: string; categoryColumn: string; measureColumn?: string;
  operation: 'count' | 'average_by_category' | 'sum_by_category' | 'min_by_category' | 'max_by_category' | 'top_n';
  chartType: 'bar' | 'line'; limit?: number };

const isIdentifierColumn = (name: string) => /(?:^|[_\s-])(?:id|code|index|serial|sku|key)(?:$|[_\s-])|(?:id|code)$/i.test(name);
const isAdditiveMeasure = (name: string) => /sales|revenue|quantity|amount|spend|results?|units?|profit|total|volume|count|impressions?|reach/i.test(name);
const numberCell = (cell: unknown): number | null => {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(cell.trim())) return null;
  const value = Number(cell.trim());
  return Number.isFinite(value) ? value : null;
};

function chartSheetData(sheet: ArtifactSheet): { names: string[]; rows: ArtifactSheet['rows'] } {
  const generic = sheet.columns.every((name, index) => name === spreadsheetColumnName(index));
  const repeatedHeader = sheet.columns.every((name, index) => String(sheet.rows[0]?.[index] ?? '').trim() === name);
  return { names: generic && sheet.rows[0] ? sheet.rows[0].map((cell) => String(cell ?? '').trim()) : sheet.columns,
    rows: generic || repeatedHeader ? sheet.rows.slice(1) : sheet.rows };
}

export function classifySpreadsheetColumns(sheet: ArtifactSheet): Array<{ name: string; kind: SpreadsheetColumnKind }> {
  const { names, rows } = chartSheetData(sheet);
  return names.map((name, index) => {
    const samples = rows.slice(0, 100).map((row) => row[index]).filter((cell) => cell !== null && cell !== '');
    if (!name || !samples.length) return { name, kind: 'unusable' };
    if (isIdentifierColumn(name)) return { name, kind: 'identifier' };
    if (/date|time|month|year|period|quarter|week|day/i.test(name)) return { name, kind: 'date' };
    if (/price|sales|revenue|quantity|cost|amount|spend|results?|units?|profit|total|value|count|volume|score|rate|impressions?|reach/i.test(name)
      && samples.some((cell) => numberCell(cell) !== null)) return { name, kind: 'measure' };
    if (/product|item|name|title|label|category|supplier|group|type|brand/i.test(name)
      || samples.some((cell) => typeof cell === 'string' && numberCell(cell) === null)) return { name, kind: 'label' };
    return { name, kind: 'unusable' };
  });
}

/** Deterministic alternatives when a semantic plan names unusable columns. */
export function inferAgentChartPlans(sheet: ArtifactSheet): AgentChartPlan[] {
  const columns = classifySpreadsheetColumns(sheet);
  const { rows: sheetRows } = chartSheetData(sheet);
  const rows = sheetRows.slice(0, 501);
  const measure = columns.find((column) => column.kind === 'measure')?.name;
  const labels = columns.filter((column) => column.kind === 'label');
  const label = labels.find((column) => /product|item|name|title/i.test(column.name))?.name ?? labels[0]?.name;
  const groupable = columns.filter((column) => column.kind === 'identifier' || column.kind === 'label')
    .filter((column) => column.name !== label || !measure)
    .filter((column) => {
      const index = columns.findIndex((entry) => entry.name === column.name);
      const values = rows.map((row) => String(row[index] ?? '').trim()).filter(Boolean);
      const distinct = new Set(values).size;
      return distinct >= 2 && distinct < values.length * 0.9;
    });
  const plans: AgentChartPlan[] = [];
  if (label && measure) plans.push({ purpose: `Top 10 ${label} by ${measure}`, categoryColumn: label,
    measureColumn: measure, operation: 'top_n', chartType: 'bar', limit: 10 });
  for (const group of groupable) {
    if (measure) plans.push({ purpose: `Average ${measure} by ${group.name}`, categoryColumn: group.name,
      measureColumn: measure, operation: 'average_by_category', chartType: 'bar', limit: 20 });
  }
  for (const group of groupable) plans.push({ purpose: `Count by ${group.name}`, categoryColumn: group.name,
    operation: 'count', chartType: 'bar', limit: 20 });
  return plans;
}

export function chartFromPlan(artifact: SpreadsheetArtifact, sheet: ArtifactSheet, plan: AgentChartPlan): ChartArtifact {
  const { names, rows } = chartSheetData(sheet);
  const columns = classifySpreadsheetColumns(sheet);
  const categoryIndex = names.indexOf(plan.categoryColumn);
  const measureIndex = plan.measureColumn ? names.indexOf(plan.measureColumn) : -1;
  const measureKind = columns[measureIndex]?.kind;
  if (categoryIndex < 0 || !['label', 'identifier', 'date'].includes(columns[categoryIndex]?.kind)
    || (plan.operation !== 'count' && (measureIndex < 0 || measureIndex === categoryIndex || measureKind !== 'measure'))
    || (plan.operation === 'count' && plan.measureColumn)
    || (plan.operation === 'sum_by_category' && !isAdditiveMeasure(plan.measureColumn ?? ''))
    || (plan.operation === 'top_n' && !['label', 'date'].includes(columns[categoryIndex]?.kind)))
    throw new Error('CHART_COLUMNS_REQUIRED');
  const limit = Math.min(20, Math.max(2, Number.isInteger(plan.limit) ? plan.limit! : plan.operation === 'top_n' ? 10 : 20));
  const observations = rows.slice(0, 501).map((row) => ({ label: String(row[categoryIndex] ?? '').trim().slice(0, 160),
    value: measureIndex >= 0 ? numberCell(row[measureIndex]) : 1 })).filter((entry) => entry.label && entry.value !== null);
  if (observations.length < 2) throw new Error('CHART_COLUMNS_REQUIRED');
  const groups = new Map<string, number[]>();
  for (const { label, value } of observations) groups.set(label, [...(groups.get(label) ?? []), value!]);
  if (groups.size < 2) throw new Error('CHART_COLUMNS_REQUIRED');
  if (plan.operation !== 'top_n' && groups.size > 20 && groups.size >= observations.length * 0.9)
    throw new Error('CHART_COLUMNS_REQUIRED');
  if (plan.operation === 'count' && [...groups.values()].every((values) => values.length === 1))
    throw new Error('CHART_COLUMNS_REQUIRED');
  const entries = plan.operation === 'top_n'
    ? observations.map((entry) => ({ label: entry.label, value: entry.value! })).sort((a, b) => b.value - a.value)
    : [...groups.entries()].map(([label, values]) => ({ label, value: plan.operation === 'count' ? values.length
      : plan.operation === 'sum_by_category' ? values.reduce((sum, value) => sum + value, 0)
        : plan.operation === 'min_by_category' ? Math.min(...values)
          : plan.operation === 'max_by_category' ? Math.max(...values)
            : values.reduce((sum, value) => sum + value, 0) / values.length }));
  if (plan.operation !== 'top_n' && entries.length > limit) entries.sort((a, b) => b.value - a.value);
  const selected = entries.slice(0, limit);
  const title = plan.purpose.trim().slice(0, 160);
  if (!title) throw new Error('CHART_COLUMNS_REQUIRED');
  return { schemaVersion: 1, id: crypto.randomUUID(), type: 'chart', title,
    chartType: plan.chartType, language: artifact.language,
    direction: artifactDirection(artifact.language, title, artifact.direction),
    categories: selected.map((entry) => entry.label),
    series: [{ name: plan.operation === 'count' ? 'Count' : plan.measureColumn!, values: selected.map((entry) => entry.value) }],
    source: { artifactId: artifact.id, sheetId: sheet.id, rowStart: 0, rowEnd: Math.min(sheet.rows.length, 501) }, metadata: {} };
}

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
