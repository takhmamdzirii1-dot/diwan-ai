import type { ChatMessagePart } from '@/lib/artifacts/chat-parts';
import type { ResponseLanguage } from '@/lib/chat/response-language';
import { evaluateSearchSynthesis, renderEvidenceSourceIds, searchSynthesisRejectionReason } from './evidence';
import type { WebSearchHit } from './search.server';
import { currentInformationPolicy } from './selection';

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

/** Numeric artifact data are measured facts, not list numbering. Validate them
 * against that artifact/row's cited evidence; a neighboring artifact cannot grant support. */
function numericArtifactFailure(part: ChatMessagePart, hits: readonly WebSearchHit[]) {
  const supported = (content: string, values: number[]) => {
    if (!values.length) return true;
    const ids = new Set([...content.matchAll(/\[\[source:(S[1-9]\d*)\]\]/g)].map((match) => match[1]));
    const evidence = hits.filter((hit, index) => ids.has(hit.evidenceId ?? `S${index + 1}`))
      .map((hit) => `${hit.title} ${hit.description}`).join(' ');
    const allowed = new Set((evidence.match(/\b\d+(?:\.\d+)?\b/g) ?? []).map(Number));
    return values.every((value) => allowed.has(value));
  };
  if (part.type === 'chart') {
    const values = part.artifact.series.flatMap((series) => series.values.filter((value): value is number => value !== null));
    return supported(artifactEvidenceText(part), values) ? null : 'artifact_value_unverified';
  }
  if (part.type === 'spreadsheet' && part.artifact.sheets.some((sheet) => sheet.rows.some((row) =>
    !supported(row.map(String).join(' '), row.filter((value): value is number => typeof value === 'number')))))
    return 'artifact_value_unverified';
  return null;
}

function renderPart(part: ChatMessagePart, hits: readonly WebSearchHit[], language: ResponseLanguage): ChatMessagePart {
  // Schema/identity fields are left untouched. Only source tokens in content strings are resolved.
  const map = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string') return ['id', 'chartId', 'src', 'mimeType', 'direction', 'type', 'language'].includes(key)
      ? value : renderEvidenceSourceIds(value, hits, language) ?? value;
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
  const policy = currentInformationPolicy(input.request);
  const parts = input.parts.filter((part) => 'artifact' in part || part.type === 'file' && 'content' in part);
  let reason: string | null = null;
  let artifactCitations = 0;
  const charts = new Set(parts.flatMap((part) => part.type === 'chart' ? [part.artifact.id] : []));
  // Both normal text and every produced artifact/file must satisfy the same evidence contract.
  for (const part of parts) {
    reason = numericArtifactFailure(part, input.hits);
    if (reason) break;
    // A pre-existing chart reference is not evidence of the current chart's factual content.
    if (part.type === 'presentation' && part.artifact.slides.some((slide) => slide.blocks.some((block) =>
      block.kind === 'chart' && !charts.has(block.chartId)))) {
      reason = 'artifact_evidence_unavailable'; break;
    }
    const content = artifactEvidenceText(part);
    reason = searchSynthesisRejectionReason(content,
      input.hits, input.request, input.now, input.language, { artifact: true });
    if (reason) break;
    artifactCitations += [...content.matchAll(/\[\[source:S\d+\]\]|\]\(https:\/\/[^)\s]+\)/g)].length;
  }
  const textResult = input.text.trim() ? evaluateSearchSynthesis(input.text, input.hits,
    input.request, input.now, input.language) : null;
  reason ??= textResult && !textResult.synthesisAccepted ? textResult.synthesisRejectionReason : null;
  if (!parts.length && !textResult) reason ??= 'expected_answer_missing';
  return { accepted: reason === null, reason, text: textResult?.answer ?? '',
    parts: reason ? [] : parts.map((part) => renderPart(part, input.hits, input.language)),
    citationsCount: (textResult?.citationsCount ?? 0) + artifactCitations };
}
