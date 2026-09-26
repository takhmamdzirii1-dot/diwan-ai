import { z } from 'zod';
import { artifactDirection, documentFromMarkdown, isArtifact, parsePresentationResponse, type Artifact, type ChartArtifact, type DocumentArtifact, type PresentationArtifact, type SpreadsheetArtifact } from './core';
import { spreadsheetContext } from './spreadsheet-actions';

const short = z.string().trim().min(1).max(160);
const text = z.string().trim().min(1).max(2_000);
const language = z.string().trim().min(2).max(32).default('en');
const columns = z.array(short).min(1).max(16);
const tableRows = z.array(z.array(z.string().max(500)).max(16)).min(1).max(100);
const cell = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]);
const tableInput = z.object({ title: short, columns, rows: tableRows, language }).strict();
const chartInput = z.object({ title: short, chartType: z.enum(['bar', 'line', 'area', 'pie', 'donut', 'scatter']),
  categories: z.array(short).min(1).max(50), series: z.array(z.object({ name: short, values: z.array(z.number().finite().nullable()).min(1).max(50) }).strict()).min(1).max(4), language }).strict();
const documentInput = z.object({ title: short, markdown: z.string().trim().min(1).max(20_000), language }).strict();
const spreadsheetInput = z.object({ title: short, sheets: z.array(z.object({ name: short, columns,
  rows: z.array(z.array(cell).max(16)).max(500) }).strict()).min(1).max(5), language }).strict();
const slideBlock = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text }).strict(),
  z.object({ kind: z.literal('bullets'), items: z.array(text).min(1).max(8) }).strict(),
  z.object({ kind: z.literal('table'), rows: tableRows }).strict(),
]);
const presentationInput = z.object({ title: short, language, slides: z.array(z.object({
  title: short, subtitle: short.optional(), variant: z.enum(['cover', 'kpi', 'chart', 'table', 'insights']).optional(),
  layout: z.enum(['title', 'content']).optional(), blocks: z.array(slideBlock).max(10),
}).strict()).min(1).max(8) }).strict();

export type ArtifactToolName = 'create_table' | 'create_chart' | 'create_document' | 'create_spreadsheet' | 'create_presentation';
export type ArtifactToolGroup = 'artifact' | 'spreadsheet' | 'document';
export type ArtifactTaskSkill = 'presentation' | 'spreadsheet-analysis' | 'document';
export type ArtifactToolPath = 'native' | 'structured' | 'fallback';
type ToolDefinition = {
  name: ArtifactToolName; description: string; group: ArtifactToolGroup; risk: 'READ' | 'CREATE';
  progress: { en: string; fr: string; ar: string }; inputSchema: z.ZodTypeAny; exampleInput: object;
  execute: (input: never) => Artifact; verify: (artifact: Artifact) => boolean;
};

const nonEmptyRows = (rows: string[][], width: number) => rows.length > 0 && rows.every((row) => row.length === width);
const verifyDocument = (artifact: Artifact): artifact is DocumentArtifact => artifact.type === 'document' && artifact.blocks.length > 0
  && artifact.blocks.every((block) => block.kind !== 'table' || (block.rows.length > 0 && block.rows.every((row) => row.length === block.rows[0].length)));
const verifySpreadsheet = (artifact: Artifact): artifact is SpreadsheetArtifact => artifact.type === 'spreadsheet' && artifact.sheets.length > 0
  && artifact.sheets.every((sheet) => !!sheet.name.trim() && sheet.columns.length > 0 && sheet.rows.every((row) => row.length === sheet.columns.length));
const verifyChart = (artifact: Artifact): artifact is ChartArtifact => artifact.type === 'chart' && artifact.categories.length > 0
  && artifact.series.length > 0 && artifact.series.every((series) => series.values.length === artifact.categories.length
    && series.values.some((value) => value !== null) && series.values.every((value) => value === null || Number.isFinite(value)));
const verifyPresentation = (artifact: Artifact): artifact is PresentationArtifact => artifact.type === 'presentation' && artifact.slides.length > 0
  && artifact.slides.every((slide) => !!slide.title.trim() && (slide.layout === 'title' || slide.blocks.length > 0)
    && slide.blocks.every((block) => block.kind === 'text' ? !!block.text.trim()
      : block.kind === 'bullets' ? block.items.length > 0 && block.items.every((item) => !!item.trim())
        : block.kind === 'table' ? nonEmptyRows(block.rows, block.rows[0]?.length ?? 0)
          : false));

const definitions: Record<ArtifactToolName, ToolDefinition> = {
  create_table: {
    name: 'create_table', description: 'Create a concise table with aligned columns and rows.', group: 'artifact', risk: 'CREATE',
    progress: { en: 'Creating table…', fr: 'Création du tableau…', ar: 'جارٍ إنشاء الجدول…' }, inputSchema: tableInput,
    exampleInput: { title: 'Summary', columns: ['Metric', 'Value'], rows: [['Revenue', '1200']] },
    execute: (input: z.infer<typeof tableInput>) => ({ schemaVersion: 1, id: crypto.randomUUID(), type: 'document', title: input.title,
      language: input.language, direction: artifactDirection(input.language, input.title), metadata: { artifactKind: 'table' },
      blocks: [{ kind: 'table', rows: [input.columns, ...input.rows] }] }),
    verify: verifyDocument,
  },
  create_chart: {
    name: 'create_chart', description: 'Create a chart from named categories and numeric series; never invent missing values.', group: 'artifact', risk: 'CREATE',
    progress: { en: 'Creating chart…', fr: 'Création du graphique…', ar: 'جارٍ إنشاء الرسم البياني…' }, inputSchema: chartInput,
    exampleInput: { title: 'Trend', chartType: 'line', categories: ['Jan', 'Feb'], series: [{ name: 'Sales', values: [10, 20] }] },
    execute: (input: z.infer<typeof chartInput>) => ({ schemaVersion: 1, id: crypto.randomUUID(), type: 'chart', title: input.title,
      chartType: input.chartType, language: input.language, direction: artifactDirection(input.language, input.title), metadata: {},
      categories: input.categories, series: input.series as ChartArtifact['series'] }),
    verify: verifyChart,
  },
  create_document: {
    name: 'create_document', description: 'Create a structured document from concise Markdown.', group: 'document', risk: 'CREATE',
    progress: { en: 'Creating document…', fr: 'Création du document…', ar: 'جارٍ إنشاء المستند…' }, inputSchema: documentInput,
    exampleInput: { title: 'Brief', markdown: '# Brief\n\nKey point.' },
    execute: (input: z.infer<typeof documentInput>) => ({ ...documentFromMarkdown(crypto.randomUUID(), input.markdown, input.language), title: input.title }),
    verify: verifyDocument,
  },
  create_spreadsheet: {
    name: 'create_spreadsheet', description: 'Create a bounded spreadsheet with consistent column widths.', group: 'spreadsheet', risk: 'CREATE',
    progress: { en: 'Creating spreadsheet…', fr: 'Création du classeur…', ar: 'جارٍ إنشاء جدول البيانات…' }, inputSchema: spreadsheetInput,
    exampleInput: { title: 'Forecast', sheets: [{ name: 'Data', columns: ['Month', 'Sales'], rows: [['Jan', 10]] }] },
    execute: (input: z.infer<typeof spreadsheetInput>) => ({ schemaVersion: 1, id: crypto.randomUUID(), type: 'spreadsheet', title: input.title,
      language: input.language, direction: artifactDirection(input.language, input.title), metadata: {},
      sheets: input.sheets.map((sheet, index) => ({ id: `sheet-${index + 1}`, name: sheet.name, columns: sheet.columns, rows: sheet.rows })) }),
    verify: verifySpreadsheet,
  },
  create_presentation: {
    name: 'create_presentation', description: 'Create a concise executive presentation with cover, metrics, and evidence-based insights. Do not dump raw rows.', group: 'artifact', risk: 'CREATE',
    progress: { en: 'Creating presentation…', fr: 'Création de la présentation…', ar: 'جارٍ إنشاء العرض التقديمي…' }, inputSchema: presentationInput,
    exampleInput: { title: 'Quarterly review', slides: [{ title: 'Quarterly review', layout: 'title', variant: 'cover', blocks: [] },
      { title: 'Key metrics', variant: 'kpi', blocks: [{ kind: 'table', rows: [['Revenue', '$1,200'], ['Growth', '12%']] }] }] },
    execute: (input: z.infer<typeof presentationInput>) => {
      const slides = input.slides.map((slide) => ({ ...slide, layout: slide.layout ?? (slide.variant === 'cover' ? 'title' : 'content') }));
      const result = parsePresentationResponse(JSON.stringify({ type: 'presentation', ...input, slides }), input.language);
      if (!result.artifact) throw new Error('PRESENTATION_INVALID');
      return result.artifact;
    },
    verify: verifyPresentation,
  },
};

export function getArtifactTool(name: string): ToolDefinition | null {
  return Object.hasOwn(definitions, name) ? definitions[name as ArtifactToolName] : null;
}

export type ArtifactToolResult = { status: 'ok'; artifact: Artifact } | { status: 'error'; message: string };
const safeError = 'A safe artifact could not be created. Please try again.';

export function verifyArtifactToolResult(name: string, result: unknown): Artifact | null {
  const definition = getArtifactTool(name);
  if (!definition || !result || typeof result !== 'object') return null;
  const envelope = result as { status?: unknown; artifact?: unknown };
  return envelope.status === 'ok' && isArtifact(envelope.artifact) && definition.verify(envelope.artifact) ? envelope.artifact : null;
}

export function runArtifactTool(name: string, rawInput: unknown): ArtifactToolResult {
  const definition = getArtifactTool(name);
  if (!definition) return { status: 'error', message: safeError };
  const parsed = definition.inputSchema.safeParse(rawInput);
  if (!parsed.success) return { status: 'error', message: safeError };
  try {
    const artifact = definition.execute(parsed.data as never);
    if (!isArtifact(artifact) || !definition.verify(artifact)) return { status: 'error', message: safeError };
    return { status: 'ok', artifact };
  } catch { return { status: 'error', message: safeError }; }
}

export type ArtifactToolSelection = { names: ArtifactToolName[]; skill: ArtifactTaskSkill | null };
const emptySelection: ArtifactToolSelection = { names: [], skill: null };
export function agentToolSelection(step: 'analysis' | 'presentation'): ArtifactToolSelection {
  return step === 'analysis' ? { names: [], skill: 'spreadsheet-analysis' }
    : { names: ['create_presentation'], skill: 'presentation' };
}
export function isExplicitDocumentIntent(input: string): boolean {
  const text = input.slice(0, 8_000).replace(/[\u064B-\u065F\u0670]/g, '');
  return /\b(?:write|draft|create|prepare|generate|compose|make|build|produce|give me)\b[\s\S]{0,120}\b(?:report|article|brief|document|resume|cv|proposal|memo|executive summary|formal letter)\b/i.test(text)
    || /(?:écris|écrivez|rédige|rédigez|crée|créez|prépare|préparez|fais|faites|génère|générez)[\s\S]{0,120}(?:rapport|article|document|cv|curriculum vitae|proposition|mémo|note de synthèse|résumé exécutif|lettre formelle|lettre officielle)/i.test(text)
    || /(?:اكتب|اكتبي|اكتبوا|أنشئ|انشئ|حرر|صغ|أعد|اعد)[\s\S]{0,120}(?:تقرير|مقال|مستند|وثيقة|مذكرة|مقترح|سيرة ذاتية|خطاب رسمي|رسالة رسمية|ملخص تنفيذي)/.test(text);
}
export function selectArtifactTools(input: string): ArtifactToolSelection {
  const text = input.slice(0, 8_000).toLowerCase();
  if (isExplicitDocumentIntent(text)) return { names: ['create_document'], skill: 'document' };
  const create = /\b(create|make|build|generate|draft|write|prepare|plot|visualize|need|want)\b|\bgive me\b|(?:أنشئ|انشئ|اكتب|حرر|صغ|اصنع|créer|créez|générer|écris|écrivez|rédige|rédigez)/i.test(text);
  if (create && /\b(presentation|slide deck|powerpoint|pptx|diaporama|présentation)\b|عرض\s*(?:تقديمي|شرائح)/i.test(text)) return { names: ['create_presentation'], skill: 'presentation' };
  if (create && /\b(chart|graph|plot|trend|graphique|graphe)\b|رسم\s*بياني/i.test(text)) return { names: ['create_chart'], skill: null };
  if (create && /\b(spreadsheet|workbook|xlsx|tableur|feuille de calcul)\b|جدول\s*بيانات/i.test(text)) return { names: ['create_spreadsheet'], skill: 'spreadsheet-analysis' };
  if (create && /\b(document|report|memo|brief|rapport|document)\b|مستند|تقرير/i.test(text)) return { names: ['create_document'], skill: 'document' };
  if (create && /\b(table|tableau)\b|جدول/i.test(text)) return { names: ['create_table'], skill: null };
  if (/\b(analy[sz]e|summari[sz]e|analyse|analyser)\b.*\b(spreadsheet|workbook|sheet|tableur)\b|حلل.*جدول/i.test(text)) return { names: [], skill: 'spreadsheet-analysis' };
  return emptySelection;
}

export function resolveArtifactToolPath(selection: ArtifactToolSelection, capabilities: { tools: { state: string }; structuredOutput: { state: string } }): ArtifactToolPath {
  if (selection.names.length > 0 && capabilities.tools.state === 'supported') return 'native';
  return capabilities.structuredOutput.state === 'supported' ? 'structured' : 'fallback';
}
export function documentToolChoice(selection: ArtifactToolSelection, path: ArtifactToolPath): { type: 'tool'; toolName: 'create_document' } | undefined {
  return path === 'native' && selection.names.length === 1 && selection.names[0] === 'create_document'
    ? { type: 'tool', toolName: 'create_document' } : undefined;
}

const skills: Record<ArtifactTaskSkill, string> = {
  presentation: 'Create a concise slide narrative: cover, key metrics, trend only when data supports it, and evidence-based insights. Never paste raw spreadsheet rows or invent chart references.',
  'spreadsheet-analysis': 'Use only the bounded spreadsheet context supplied in this request. State missing data and limitations; do not infer unseen rows.',
  document: 'Write a concise structured document with clear headings and only claims supported by the user context.',
};

export function artifactTaskInstruction(selection: ArtifactToolSelection, path: ArtifactToolPath): string {
  const skill = selection.skill ? skills[selection.skill] : '';
  if (!selection.names.length) return skill;
  if (path === 'native') return `${skill}\nUse the supplied artifact tool for the result. Do not print JSON or tool arguments as customer text.`.trim();
  const examples = selection.names.map((name) => {
    const definition = definitions[name];
    return `${name}: ${definition.description} Input example: ${JSON.stringify(definition.exampleInput)}`;
  }).join('\n');
  return `${skill}\nReturn ONLY one JSON object shaped as {"tool":"<selected name>","input":{...}}. ${path === 'structured' ? 'Use strict structured JSON.' : 'Do not add prose or code fences.'}\n${examples}`.trim();
}

export function artifactToolProgress(name: string, locale: string): string | null {
  const definition = getArtifactTool(name);
  const language = locale.split('-')[0] as 'en' | 'fr' | 'ar';
  return definition?.progress[language] ?? definition?.progress.en ?? null;
}

export function selectedNativeArtifactTools(selection: ArtifactToolSelection) {
  return Object.fromEntries(selection.names.map((name) => [name, definitions[name]])) as Partial<Record<ArtifactToolName, ToolDefinition>>;
}

export const readSpreadsheetContextTool = { name: 'read_spreadsheet_context', group: 'spreadsheet', risk: 'READ',
  progress: { en: 'Reading spreadsheet', fr: 'Lecture de la feuille de calcul', ar: 'قراءة جدول البيانات' } } as const;
export function runReadSpreadsheetContextTool(artifact: unknown, sheetId: string, rowStart = 0, rowEnd = 40):
  { status: 'ok'; sheetName: string; headers: string[]; rowCount: number; context: string } | { status: 'error' } {
  if (!isArtifact(artifact) || artifact.type !== 'spreadsheet' || !verifySpreadsheet(artifact)) return { status: 'error' };
  const sheet = artifact.sheets.find((entry) => entry.id === sheetId);
  if (!sheet || !Number.isInteger(rowStart) || !Number.isInteger(rowEnd) || rowStart < 0 || rowEnd <= rowStart) return { status: 'error' };
  return { status: 'ok', sheetName: sheet.name, headers: sheet.columns.slice(0, 16), rowCount: sheet.rows.length,
    context: spreadsheetContext(artifact, sheet, rowStart, Math.min(rowEnd, rowStart + 40)) };
}
