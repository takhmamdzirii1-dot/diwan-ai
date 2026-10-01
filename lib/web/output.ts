import { chatPartsFromMessage, type ChatMessagePart } from '@/lib/artifacts/chat-parts';
import type { ResponseLanguage } from '@/lib/chat/response-language';
import { deliverResearchAnswer } from './research-answer';
import type { WebSearchHit } from './search.server';

/** Only customer content participates: not IDs, chart references, filenames, or schema versions. */
export function artifactEvidenceText(part: ChatMessagePart): string {
  if (part.type === 'file' && 'content' in part) return part.content;
  if (!('artifact' in part)) return '';
  const artifact = part.artifact;
  const blocks = (values: Array<{ kind: string; text?: string; items?: string[]; rows?: string[][] }>) =>
    values.flatMap((block) => block.text ?? block.items?.map((item) => `- ${item}`)
      ?? block.rows?.map((row) => row.join(' | ')) ?? []).join('\n\n');
  switch (artifact.type) {
    case 'document': return `${artifact.title}\n\n${blocks(artifact.blocks)}`;
    case 'presentation': return artifact.slides.map((slide) =>
      `${slide.title}\n\n${slide.subtitle ?? ''}\n\n${blocks(slide.blocks)}\n\n${slide.notes ?? ''}`).join('\n\n');
    case 'spreadsheet': return `${artifact.title}\n${artifact.sheets.flatMap((sheet) =>
      [sheet.name, ...sheet.columns, ...sheet.rows.flat().map((cell) => cell == null ? '' : String(cell))]).join('\n')}`;
    case 'chart': return `${artifact.title}\n${artifact.categories.join('\n')}\n${artifact.series.map((series) =>
      `${series.name}\n${series.values.filter((value) => value !== null).join('\n')}`).join('\n')}`;
  }
}

function renderPart(part: ChatMessagePart, hits: readonly WebSearchHit[], language: ResponseLanguage): ChatMessagePart {
  // Schema/identity fields are left untouched. Only source tokens in content strings are resolved.
  const map = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string') return ['id', 'chartId', 'src', 'mimeType', 'direction', 'type', 'language'].includes(key)
      ? value : deliverResearchAnswer(value, hits, language).text;
    if (Array.isArray(value)) return value.map((item) => map(item, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
      .map(([field, item]) => [field, field === 'metadata' ? item : map(item, field)]));
    return value;
  };
  const rendered = map(part) as ChatMessagePart;
  return part.type === 'file' && rendered.type === 'file' ? { ...rendered, name: part.name } : rendered;
}

export function evaluateCurrentOutput(input: { text: string; parts: readonly ChatMessagePart[];
  hits: readonly WebSearchHit[]; request: string; language: ResponseLanguage; now: Date }) {
  const warnings = new Set<string>();
  let artifactCitations = 0;
  const eligible = input.parts.filter((part) => 'artifact' in part || part.type === 'file' && 'content' in part);
  const safeParts = eligible.filter((part) => {
    const delivery = deliverResearchAnswer(artifactEvidenceText(part), input.hits, input.language);
    for (const warning of delivery.warnings) warnings.add(warning);
    // A suspect artifact is withheld, not published with unsafe citations. Keep
    // independent safe text/artifacts rather than deleting the whole answer.
    if (!delivery.accepted || delivery.warnings.some((warning) =>
      /unsafe|unknown_source|unsupported_citation/.test(warning))) {
      warnings.add('unsafe_artifact_omitted'); return false;
    }
    artifactCitations += delivery.citationsCount;
    return true;
  });
  // Citation expansion can change field lengths. Reuse the canonical schemas
  // after rendering, rather than casting transformed data into a valid artifact.
  const renderedParts = safeParts.flatMap((part) => {
    const rendered = renderPart(part, input.hits, input.language);
    const validated = chatPartsFromMessage('', input.language, [rendered])[0];
    if (!validated || validated.type !== part.type) {
      warnings.add('artifact_schema_omitted'); return [];
    }
    return [validated];
  });
  const charts = new Set(renderedParts.flatMap((part) => part.type === 'chart' ? [part.artifact.id] : []));
  const parts = renderedParts.filter((part) => {
    if (part.type === 'presentation' && part.artifact.slides.some((slide) => slide.blocks.some((block) =>
      block.kind === 'chart' && !charts.has(block.chartId)))) {
      warnings.add('artifact_reference_omitted'); return false;
    }
    return true;
  });
  const delivery = input.text.trim() ? deliverResearchAnswer(input.text, input.hits, input.language) : null;
  for (const warning of delivery?.warnings ?? []) warnings.add(warning);
  const accepted = Boolean(delivery?.accepted || parts.length);
  return { accepted, reason: accepted ? null : delivery?.reason ?? 'expected_answer_missing',
    text: delivery?.text ?? '', parts, warnings: [...warnings],
    citationsCount: (delivery?.citationsCount ?? 0) + artifactCitations };
}
