/** Small, deterministic customer intent router. No model, network, or content search. */
export type ChatIntent = 'create_chart' | 'create_document' | 'create_presentation' | 'create_spreadsheet'
  | 'export_pdf' | 'export_docx' | 'export_xlsx' | 'export_csv' | 'normal_chat';
export type IntentResource = { attachmentId: string; kind: 'spreadsheet' | 'document' | 'file' | 'image' };
export type ResourceStatus = 'not_referenced' | 'resolved' | 'missing' | 'ambiguous';
export type IntentRoute = { intent: ChatIntent; confidence: 'high' | 'low'; resourceStatus: ResourceStatus;
  attachmentId: string | null; resourceKind: 'spreadsheet' | 'document' | 'image' | 'file' | null };

export function normalizeIntentText(input: string): string {
  return input.slice(0, 800).toLowerCase().normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/\p{M}/gu, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

const actions = [
  'make', 'mak', 'create', 'build', 'generate', 'draft', 'write', 'prepare', 'produce', 'design',
  'turn', 'convert', 'export', 'download', 'save', 'plot', 'visualize', 'show', 'give me',
  'cree', 'creer', 'creez', 'fais', 'faites', 'genere', 'generer', 'redige', 'rediger',
  'ecris', 'ecrivez', 'donne', 'donnez', 'donne moi', 'donnez moi', 'exporte', 'transforme',
  'اعمل', 'اصنع', 'انشئ', 'اكتب', 'اكتبلي', 'حرر', 'صغ', 'جهز', 'سوي', 'عطيني', 'اعطني',
  'اريد', 'ابغى', 'ابي', 'وريني', 'اشوف', 'طلع', 'صدر',
] as const;
const subjects: Record<Exclude<ChatIntent, 'normal_chat' | `export_${string}`>, readonly string[]> = {
  create_chart: ['chart', 'charte', 'graph', 'graphe', 'graphique', 'graphqiue', 'plot', 'diagram',
    'مخطط', 'المخطط', 'شارت', 'الشارت', 'رسم', 'الرسم', 'رسم بياني'],
  create_document: ['report', 'article', 'brief', 'document', 'resume', 'cv', 'proposal', 'memo',
    'executive summary', 'formal letter', 'rapport', 'proposition', 'lettre', 'meme',
    'تقرير', 'تقريرا', 'التقرير', 'مقال', 'مقالا', 'مستند', 'وثيقة', 'مذكرة', 'مقترح', 'سيرة ذاتية', 'خطاب', 'رسالة', 'طلب'],
  create_presentation: ['presentation', 'presntation', 'powerpoint', 'power point', 'ppt', 'pptx',
    'slide deck', 'slides', 'diaporama', 'عرض تقديمي', 'العرض التقديمي', 'عرض شرائح',
    'بوربوينت', 'بريزنتيشن', 'شرائح'],
  create_spreadsheet: ['spreadsheet', 'workbook', 'tableur', 'feuille de calcul', 'excel', 'exel',
    'xlsx', 'csv', 'جدول بيانات', 'الجدول', 'اكسل'],
};
const formats = {
  export_pdf: ['pdf'], export_docx: ['docx', 'word'],
  export_xlsx: ['xlsx', 'excel', 'exel', 'اكسل'], export_csv: ['csv'],
} as const;
type Found = { index: number; fuzzy: boolean };

function oneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + Number(i < a.length || j < b.length) === 1;
}

function findAlias(tokens: string[], aliases: readonly string[], fuzzy = true): Found | null {
  let best: Found | null = null;
  for (const alias of aliases) {
    const words = normalizeIntentText(alias).split(' ');
    for (let i = 0; i <= tokens.length - words.length; i++) {
      if (words.every((word, offset) => tokens[i + offset] === word)
        && (best === null || i < best.index)) best = { index: i, fuzzy: false };
    }
  }
  if (best || !fuzzy) return best;
  // At most one edit, only for long vocabulary words. Never fuzzy-match whole customer text.
  for (const alias of aliases) {
    const word = normalizeIntentText(alias);
    if (word.includes(' ') || word.length < 6 || !/^[a-z]+$/.test(word)) continue;
    for (let i = 0; i < tokens.length; i++) if (tokens[i].length >= 5 && oneEdit(tokens[i], word)
      && (best === null || i < best.index)) best = { index: i, fuzzy: true };
  }
  return best;
}

function referencedResource(tokens: string[]): IntentRoute['resourceKind'] {
  const fileWords = ['file', 'fichier', 'ملف', 'الملف'];
  const spreadsheetWords = ['spreadsheet', 'workbook', 'sheet', 'tableur', 'جدول', 'الجدول'];
  const documentWords = ['document', 'pdf', 'مستند', 'المستند'];
  const imageWords = ['image', 'photo', 'صورة', 'الصورة'];
  const prefixes = ['from', 'using', 'depuis', 'de', 'avec', 'من', 'باستخدام'];
  const demonstratives = ['this', 'the', 'my', 'ce', 'cette', 'هذا', 'هذه'];
  for (let i = 0; i < tokens.length; i++) {
    if (!prefixes.includes(tokens[i]) && !demonstratives.includes(tokens[i])) continue;
    for (let j = i + 1; j < Math.min(tokens.length, i + 5); j++) {
      if (spreadsheetWords.includes(tokens[j])) return 'spreadsheet';
      if (documentWords.includes(tokens[j])) return 'document';
      if (imageWords.includes(tokens[j])) return 'image';
      if (fileWords.includes(tokens[j])) return 'file';
    }
  }
  return null;
}

function resourceResolution(kind: IntentRoute['resourceKind'], resources: readonly IntentResource[],
  selectedId?: string): Pick<IntentRoute, 'resourceStatus' | 'attachmentId'> {
  if (!kind) return { resourceStatus: 'not_referenced', attachmentId: null };
  const candidates = resources.filter((item) => kind === 'spreadsheet' ? item.kind === 'spreadsheet'
    : kind === 'document' ? item.kind === 'document' || item.kind === 'file'
      : kind === 'image' ? item.kind === 'image' : true);
  const selected = candidates.find((item) => item.attachmentId === selectedId);
  if (selected) return { resourceStatus: 'resolved', attachmentId: selected.attachmentId };
  if (candidates.length === 1) return { resourceStatus: 'resolved', attachmentId: candidates[0].attachmentId };
  return { resourceStatus: candidates.length ? 'ambiguous' : 'missing', attachmentId: null };
}

export function routeChatIntent(input: string, resources: readonly IntentResource[] = [],
  selectedAttachmentId?: string): IntentRoute {
  const normalized = normalizeIntentText(input);
  const tokens = normalized.split(' ').filter(Boolean).slice(0, 60);
  const resourceKind = referencedResource(tokens);
  const resource = resourceResolution(resourceKind, resources, selectedAttachmentId);
  const finish = (intent: ChatIntent, confidence: IntentRoute['confidence']): IntentRoute =>
    ({ intent, confidence, resourceKind, ...resource });
  if (!tokens.length) return finish('normal_chat', 'low');
  if (['what', 'why', 'how', 'explain', 'define', 'describe', 'qu', 'explique', 'decris',
    'pourquoi', 'comment', 'c est quoi', 'ماهو', 'ما', 'اشرح', 'فسر']
    .some((prefix) => normalized === prefix || normalized.startsWith(`${prefix} `)))
    return finish('normal_chat', 'low');
  const matches = (Object.keys(subjects) as Array<keyof typeof subjects>)
    .map((intent) => ({ intent, found: findAlias(tokens, subjects[intent]) }))
    .filter((item): item is { intent: keyof typeof subjects; found: Found } => item.found !== null)
    .sort((a, b) => a.found.index - b.found.index);
  const subject = matches[0] ?? null;
  const format = (Object.keys(formats) as Array<keyof typeof formats>)
    .map((intent) => ({ intent, found: findAlias(tokens, formats[intent], false) }))
    .filter((item): item is { intent: keyof typeof formats; found: Found } => item.found !== null)
    .sort((a, b) => a.found.index - b.found.index)[0] ?? null;
  const barePresentation = subjects.create_presentation.some((alias) => normalized === normalizeIntentText(alias));
  if (barePresentation) return finish('create_presentation', 'high');
  const bareDocumentFormat = tokens.length <= 3 && subject?.intent === 'create_document'
    && (format?.intent === 'export_pdf' || format?.intent === 'export_docx');
  if (bareDocumentFormat) return finish(format.intent, 'high');
  const action = findAlias(tokens, actions);
  const target = subject ?? format;
  if (!action || !target || action.index > target.found.index || target.found.index - action.index > 18
    || action.fuzzy && target.found.fuzzy) return finish('normal_chat', 'low');
  if (subject?.intent === 'create_chart' || subject?.intent === 'create_presentation')
    return finish(subject.intent, 'high');
  if (format && (!subject || subject.intent === 'create_document' &&
    (format.intent === 'export_pdf' || format.intent === 'export_docx')
    || subject.intent === 'create_spreadsheet' &&
    (format.intent === 'export_xlsx' || format.intent === 'export_csv'))) return finish(format.intent, 'high');
  return finish(subject?.intent ?? 'normal_chat', subject ? 'high' : 'low');
}
