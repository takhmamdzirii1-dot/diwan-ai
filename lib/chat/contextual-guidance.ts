import type { ChatMessagePart } from '@/lib/artifacts/chat-parts';
import { documentToText, type ChartArtifact, type DocumentArtifact, type PresentationArtifact, type SheetCell, type SpreadsheetArtifact } from '@/lib/artifacts/core';
import { formatCapacityWait } from './chat-usage';
import type { ChatRequestOutcome } from './client-finalization';

export type GuidanceKind = 'requirement' | 'suggestion' | 'warning' | 'confirmation' | 'success' | 'recoverable_error' | 'next_action';
export type GuidanceAction = 'upload_image' | 'upload_document' | 'upload_spreadsheet' | 'switch_model' | 'add_credits' | 'get_pro' | 'view_plans' | 'choose_file' | 'try_again';
export type ChatGuidance = { kind: GuidanceKind; message: string; actions: GuidanceAction[] };

// Only explicit document output earns a primary document action. Length, lists,
// and ordinary Markdown headings are common in conversational answers.
export function canOpenAsDocument(text: string): boolean {
  const heading = text.match(/^#{1,2}\s+(.+)$/m)?.[1]?.trim() ?? '';
  return (Boolean(heading) && !/[?؟]/.test(heading) && (
    /\b(?:report|article|brief|executive summary|research summary|rapport|note de synthèse|résumé exécutif)\b/i.test(heading)
    || /(?:تقرير|مقال|ملخص تنفيذي)/.test(heading)))
    || /^(?:(?:here is|here's) (?:the|your|a) )?(?:report|article|brief|document|executive summary|research summary)\s*[:—-]/i.test(text.trim());
}

export function shouldShowChatError(input: {
  busy: boolean; requestId: string | null; conversationId: string | null;
  outcome: ChatRequestOutcome | null;
}): boolean {
  if (input.busy || !input.outcome || input.requestId !== input.outcome.requestId
    || input.conversationId !== input.outcome.conversationId) return false;
  return input.outcome.reason === 'provider_error' || input.outcome.reason === 'network_error';
}
export type ArtifactAction = 'copy' | 'copy_table' | 'create_chart' | 'preview' | 'analyze' | 'build_presentation'
  | 'download_xlsx' | 'download_png' | 'use_in_presentation' | 'download_pptx' | 'copy_outline' | 'export_document';
type Locale = 'en' | 'fr' | 'ar';
const lang = (locale: string): Locale => locale.startsWith('ar') ? 'ar' : locale.startsWith('fr') ? 'fr' : 'en';
const say = (locale: string, words: Record<Locale, string>) => words[lang(locale)];

export function guidanceActionLabel(action: GuidanceAction, locale: string): string {
  const labels: Record<GuidanceAction, Record<Locale, string>> = {
    upload_image: { en: 'Upload image', fr: 'Importer une image', ar: 'ارفع صورة' },
    upload_document: { en: 'Upload document', fr: 'Importer un document', ar: 'ارفع مستندًا' },
    upload_spreadsheet: { en: 'Upload spreadsheet', fr: 'Importer une feuille de calcul', ar: 'ارفع جدول بيانات' },
    switch_model: { en: 'Switch model', fr: 'Changer de modèle', ar: 'غيّر النموذج' },
    add_credits: { en: 'Add credits', fr: 'Ajouter des crédits', ar: 'أضف رصيدًا' },
    get_pro: { en: 'Get Pro', fr: 'Passer à Pro', ar: 'اشترك في Pro' },
    view_plans: { en: 'View plans', fr: 'Voir les offres', ar: 'عرض الخطط' },
    choose_file: { en: 'Choose another file', fr: 'Choisir un autre fichier', ar: 'اختر ملفًا آخر' },
    try_again: { en: 'Try again', fr: 'Réessayer', ar: 'حاول مجددًا' },
  };
  return labels[action][lang(locale)];
}

export function artifactActionLabel(action: ArtifactAction, locale: string): string {
  const labels: Record<ArtifactAction, Record<Locale, string>> = {
    copy: { en: 'Copy', fr: 'Copier', ar: 'نسخ' },
    copy_table: { en: 'Copy table', fr: 'Copier le tableau', ar: 'نسخ الجدول' },
    create_chart: { en: 'Create chart', fr: 'Créer un graphique', ar: 'إنشاء رسم بياني' },
    preview: { en: 'Preview', fr: 'Aperçu', ar: 'معاينة' },
    analyze: { en: 'Analyze', fr: 'Analyser', ar: 'تحليل' },
    build_presentation: { en: 'Build presentation', fr: 'Créer une présentation', ar: 'إنشاء عرض تقديمي' },
    download_xlsx: { en: 'Download XLSX', fr: 'Télécharger XLSX', ar: 'تنزيل XLSX' },
    download_png: { en: 'Download PNG', fr: 'Télécharger PNG', ar: 'تنزيل PNG' },
    use_in_presentation: { en: 'Use in presentation', fr: 'Utiliser dans une présentation', ar: 'استخدمه في عرض' },
    download_pptx: { en: 'Download PPTX', fr: 'Télécharger PPTX', ar: 'تنزيل PPTX' },
    copy_outline: { en: 'Copy outline', fr: 'Copier le plan', ar: 'نسخ المخطط' },
    export_document: { en: 'Export', fr: 'Exporter', ar: 'تصدير' },
  };
  return labels[action][lang(locale)];
}

export type ComposerGuidanceInput = {
  text: string;
  files: Array<{ type: string }>;
  model: { visionInput?: boolean; fileInput?: boolean; requiredPlan?: string | null; accessState?: string; creditCost?: number } | null;
  balance: number | null;
  balanceStatus: string;
  requiresCredits?: boolean;
  locale: string;
};

export function attachmentMenuActions(hasModels: boolean, hasSpreadsheet: boolean): GuidanceAction[] {
  return [...(hasModels ? ['upload_image', 'upload_document'] as const : []),
    ...(hasSpreadsheet ? ['upload_spreadsheet'] as const : [])];
}

export function guidanceForComposer(input: ComposerGuidanceInput): ChatGuidance | null {
  const { text, files, model, balance, balanceStatus, locale, requiresCredits } = input;
  if (model?.accessState === 'locked' || model?.requiredPlan) return planGuidance(model.requiredPlan, locale);
  const image = files.some((file) => file.type.startsWith('image/'));
  const document = files.some((file) => !file.type.startsWith('image/'));
  if (image && !model?.visionInput) return { kind: 'requirement',
    message: say(locale, { en: "This model can't read images.", fr: 'Ce modèle ne peut pas lire les images.', ar: 'لا يستطيع هذا النموذج قراءة الصور.' }), actions: ['switch_model'] };
  if (document && !model?.fileInput) return { kind: 'requirement',
    message: say(locale, { en: "This model can't read this file.", fr: 'Ce modèle ne peut pas lire ce fichier.', ar: 'لا يستطيع هذا النموذج قراءة هذا الملف.' }), actions: ['switch_model'] };
  const fileRequest = /\b(?:analy[sz]e|summari[sz]e|read|review|extract|translate|compare|create|make|build|chart|plot|describe|open|use)\b/i.test(text)
    || /(?:حلل|لخص|اقرأ|افتح|استخرج|أنشئ)/.test(text);
  const missing = fileRequest && (/\b(?:this|the|attached|uploaded)\s+(?:file|document|pdf|image|photo|spreadsheet|workbook)\b/i.test(text)
    || /(?:هذا|هذه|المرفق|المرفقة)\s+(?:الملف|المستند|الصورة|الجدول)/.test(text));
  if (missing && files.length === 0) {
    const action: GuidanceAction = /\b(?:image|photo)\b|الصورة/i.test(text) ? 'upload_image'
      : /\b(?:spreadsheet|workbook)\b|الجدول/i.test(text) ? 'upload_spreadsheet' : 'upload_document';
    return { kind: 'requirement', message: say(locale, { en: 'I need the file first.', fr: "J'ai d'abord besoin du fichier.", ar: 'أحتاج إلى الملف أولًا.' }), actions: [action] };
  }
  if (requiresCredits && balanceStatus === 'ready' && balance !== null && model?.accessState !== 'trial'
    && typeof model?.creditCost === 'number' && model.creditCost > 0 && balance < model.creditCost) return {
    kind: 'requirement', message: say(locale, { en: 'This action needs more credits.', fr: 'Cette action nécessite plus de crédits.', ar: 'يتطلب هذا الإجراء رصيدًا إضافيًا.' }), actions: ['add_credits'],
  };
  return null;
}

function planGuidance(requiredPlan: string | null | undefined, locale: string): ChatGuidance {
  const plan = requiredPlan === 'lite' ? 'Lite' : requiredPlan === 'pro' ? 'Pro' : requiredPlan === 'max' ? 'Max' : null;
  return { kind: 'requirement', message: plan ? say(locale, {
    en: `This feature is available on ${plan}.`, fr: `Cette fonction est disponible avec ${plan}.`, ar: `هذه الميزة متاحة في ${plan}.`,
  }) : say(locale, {
    en: 'This feature needs a different plan.', fr: 'Cette fonction nécessite une autre offre.', ar: 'تتطلب هذه الميزة خطة أخرى.',
  }), actions: [plan === 'Pro' ? 'get_pro' : 'view_plans'] };
}

export function guidanceForChatError(raw: string, locale: string): ChatGuidance {
  let code = '';
  let nextAvailableAt: string | null = null;
  let requiredPlan: string | null = null;
  try { const parsed: unknown = JSON.parse(raw); if (parsed && typeof parsed === 'object') {
    if ('error' in parsed && typeof parsed.error === 'string') code = parsed.error;
    if ('nextAvailableAt' in parsed && typeof parsed.nextAvailableAt === 'string') nextAvailableAt = parsed.nextAvailableAt;
    if ('requiredPlan' in parsed && typeof parsed.requiredPlan === 'string') requiredPlan = parsed.requiredPlan;
  } }
  catch { code = raw; }
  if (/INSUFFICIENT_CREDITS|NOT_ENOUGH_CREDITS|CREDITS_EXHAUSTED|CREDIT_BALANCE_TOO_LOW/i.test(code)) return { kind: 'requirement', message: say(locale, {
    en: 'This action needs more credits.', fr: 'Cette action nécessite plus de crédits.', ar: 'يتطلب هذا الإجراء رصيدًا إضافيًا.' }), actions: ['add_credits'] };
  if (/MODEL_PLAN_ACCESS_REQUIRED|MODEL_TRIAL_EXHAUSTED|MODEL_TRIAL_UNCONFIGURED/i.test(code)) return planGuidance(requiredPlan, locale);
  if (/MODEL_CAPABILITY_UNSUPPORTED/i.test(code)) return { kind: 'requirement', message: say(locale, {
    en: "This model can't perform that action.", fr: 'Ce modèle ne peut pas effectuer cette action.', ar: 'لا يستطيع هذا النموذج تنفيذ هذا الإجراء.' }), actions: ['switch_model'] };
  if (/FILE|ATTACHMENT|UPLOAD|DOCUMENT_READ/i.test(code)) return { kind: 'recoverable_error', message: say(locale, {
    en: "I couldn't read this file.", fr: "Je n'ai pas pu lire ce fichier.", ar: 'تعذرت قراءة هذا الملف.' }), actions: ['choose_file'] };
  if (/CHAT_LIMIT_REACHED/i.test(code)) {
    const wait = formatCapacityWait(nextAvailableAt);
    return { kind: 'warning', message: wait ? say(locale, {
      en: `Chat is temporarily at capacity. Try again in ${wait}.`, fr: `Le chat est temporairement saturé. Réessayez dans ${wait}.`, ar: `الدردشة مشغولة مؤقتًا. حاول بعد ${wait}.`,
    }) : say(locale, {
      en: 'Chat is temporarily at capacity. Try again later.', fr: 'Le chat est temporairement saturé. Réessayez plus tard.', ar: 'الدردشة مشغولة مؤقتًا. حاول لاحقًا.',
    }), actions: [] };
  }
  if (/FREE_ACCESS_RESTRICTED/i.test(code)) return { kind: 'warning', message: say(locale, {
    en: 'Chat is unavailable for this account right now.', fr: 'Le chat est indisponible pour ce compte actuellement.', ar: 'الدردشة غير متاحة لهذا الحساب حاليًا.' }), actions: [] };
  return { kind: 'recoverable_error', message: say(locale, {
    en: "I couldn't complete this right now.", fr: "Je n'ai pas pu terminer cette action pour le moment.", ar: 'تعذر إكمال هذا الآن.' }), actions: ['try_again'] };
}

const numeric = (value: SheetCell): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value.replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : null;
};
export function chartableRows(rows: SheetCell[][]): boolean {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 100); rowIndex++) {
    const row = rows[rowIndex];
    for (let column = 1; column < Math.min(row.length, 16); column++) if (numeric(row[column]) !== null) return true;
  }
  return false;
}
export function documentTable(artifact: DocumentArtifact): string[][] | null {
  return artifact.blocks.find((block) => block.kind === 'table')?.rows ?? null;
}
export function primaryArtifactActions(part: ChatMessagePart): ArtifactAction[] {
  if (part.type === 'document') {
    const table = documentTable(part.artifact);
    return table ? chartableRows(table.slice(1)) ? ['copy_table', 'create_chart'] : ['copy_table'] : ['copy', 'export_document'];
  }
  if (part.type === 'spreadsheet') {
    const sheet = part.artifact.sheets[0];
    return sheet && chartableRows(sheet.rows) ? ['analyze', 'create_chart', 'build_presentation'] : ['analyze', 'build_presentation', 'preview'];
  }
  if (part.type === 'chart') return ['download_png', 'use_in_presentation'];
  if (part.type === 'presentation') return ['preview', 'download_pptx'];
  return [];
}
export function secondaryArtifactActions(part: ChatMessagePart): ArtifactAction[] {
  if (part.type === 'spreadsheet') return ['preview', 'download_xlsx'].filter((action) => !primaryArtifactActions(part).includes(action as ArtifactAction)) as ArtifactAction[];
  if (part.type === 'presentation') return ['copy_outline'];
  if (part.type === 'document' && documentTable(part.artifact)) return ['export_document'];
  return [];
}

export function readableArtifactCopy(part: ChatMessagePart): string {
  if (part.type === 'text') return part.text;
  if (part.type === 'document') return documentToText(part.artifact);
  if (part.type === 'spreadsheet') return part.artifact.sheets.map((sheet) =>
    [sheet.name, sheet.columns.join('\t'), ...sheet.rows.map((row) => row.map((cell) => String(cell ?? '')).join('\t'))].join('\n')).join('\n\n');
  if (part.type === 'chart') return [part.artifact.title, ['Category', ...part.artifact.series.map((series) => series.name)].join('\t'),
    ...part.artifact.categories.map((category, index) => [category, ...part.artifact.series.map((series) => String(series.values[index] ?? ''))].join('\t'))].join('\n');
  if (part.type === 'presentation') return presentationOutline(part.artifact);
  return part.name;
}
export function readableTableCopy(artifact: DocumentArtifact): string {
  return documentTable(artifact)?.map((row) => row.join('\t')).join('\n') ?? '';
}
export function presentationOutline(artifact: PresentationArtifact): string {
  return [artifact.title, ...artifact.slides.map((slide, index) => [
    `${index + 1}. ${slide.title}`, slide.subtitle ?? '',
    ...slide.blocks.map((block) => block.kind === 'text' ? block.text : block.kind === 'bullets' ? block.items.map((item) => `- ${item}`).join('\n')
      : block.kind === 'table' ? block.rows.map((row) => row.join('\t')).join('\n') : block.kind === 'chart' ? '[Chart]' : '[Image]'),
  ].filter(Boolean).join('\n'))].join('\n\n');
}

export function chartFromStructuredRows(title: string, language: string, direction: 'ltr' | 'rtl', columns: string[], rows: SheetCell[][]): ChartArtifact | null {
  const selected = rows.slice(0, 100);
  const indices = columns.map((_, index) => index).filter((index) => index > 0 && selected.some((row) => numeric(row[index]) !== null)).slice(0, 4);
  if (!indices.length || !selected.length) return null;
  return { schemaVersion: 1, id: crypto.randomUUID(), type: 'chart', title, language, direction, metadata: {}, chartType: 'bar',
    categories: selected.map((row, index) => String(row[0] ?? index + 1)),
    series: indices.map((index) => ({ name: columns[index], values: selected.map((row) => numeric(row[index])) })) };
}
export function presentationFromChart(chart: ChartArtifact): PresentationArtifact {
  return { schemaVersion: 1, id: crypto.randomUUID(), type: 'presentation', title: chart.title, language: chart.language,
    direction: chart.direction, metadata: {}, slides: [
      { id: 'cover', layout: 'title', variant: 'cover', title: chart.title, blocks: [] },
      { id: 'chart', layout: 'content', variant: 'chart', title: chart.title, blocks: [{ kind: 'chart', chartId: chart.id }] },
    ] };
}
