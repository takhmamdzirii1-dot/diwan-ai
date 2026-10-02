import { messageDirection } from './web-sources';
import { bidiRuns, isolatedPlainText, type TextDirection } from './bidi';

export function cleanCopyText(text: string, sourceUrls: readonly string[] = []) {
  const sources = new Set(sourceUrls);
  return text.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gu, (_all, label: string, url: string) =>
    sources.has(url) || /^(?:\d+|S\d+)$/u.test(label.trim()) ? '' : label)
    .replace(/\[\[source:S\d+\]\]|\[(?:\d+|S\d+)\]/gu, '')
    .replace(/\*\*|__/gu, '').replace(/^#{1,6}\s+/gmu, '').trim();
}

export function copyPayload(text: string, sourceUrls: readonly string[] = [], direction?: TextDirection) {
  const clean = cleanCopyText(text, sourceUrls);
  const dir = direction ?? messageDirection(clean);
  const escape = (text: string) => text.replace(/[&<>"']/gu, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  const html = bidiRuns(clean, dir).map((run) => run.direction
    ? `<bdi dir="${run.direction}">${escape(run.text)}</bdi>` : escape(run.text)).join('');
  return { plain: isolatedPlainText(clean, dir), html: `<div dir="${dir}" style="white-space:pre-wrap;unicode-bidi:isolate">${html}</div>` };
}

/** Native select-all copy fallback; source cards themselves remain selectable. */
export function copySelectionWithoutSources(event: { clipboardData: DataTransfer | null; preventDefault(): void }, direction: TextDirection) {
  if (!event.clipboardData) return;
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const content = document.createElement('div');
  for (let index = 0; index < selection.rangeCount; index++) content.append(selection.getRangeAt(index).cloneContents());
  if (!content.querySelector('[data-source-bubble]')) return;
  content.querySelectorAll('[data-source-bubble]').forEach((node) => node.remove());
  content.querySelectorAll('p, li, h1, h2, h3, h4, tr').forEach((node) => node.append('\n'));
  const payload = copyPayload(content.textContent ?? '', [], direction);
  event.clipboardData.setData('text/plain', payload.plain);
  event.clipboardData.setData('text/html', payload.html);
  event.preventDefault();
}

let sourceCopySubscribers = 0;
const sourceCopyFallback = (event: ClipboardEvent) => {
  if (event.defaultPrevented) return;
  const anchor = window.getSelection()?.anchorNode;
  const element = anchor instanceof Element ? anchor : anchor?.parentElement;
  copySelectionWithoutSources(event, element && getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr');
};
/** One listener for select-all even when the browser dispatches copy on body. */
export function subscribeSourceCopyFallback() {
  if (sourceCopySubscribers++ === 0) document.addEventListener('copy', sourceCopyFallback);
  return () => { if (--sourceCopySubscribers === 0) document.removeEventListener('copy', sourceCopyFallback); };
}

/** Rich clipboard when supported; native copy-event fallback for embedded browsers. */
export async function copyChatContent(text: string, sourceUrls: readonly string[] = [], direction?: TextDirection) {
  const { plain, html } = copyPayload(text, sourceUrls, direction);
  if (!plain) throw new Error('NOTHING_TO_COPY');
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([plain], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }) })]); return;
    }
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(plain); return; }
  } catch { /* Embedded browsers may deny the async clipboard. */ }
  const focused = document.activeElement as HTMLElement | null;
  const field = document.createElement('textarea');
  field.value = plain; field.style.position = 'fixed'; field.style.insetInlineStart = '-10000px';
  document.body.append(field); field.select();
  const onCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    event.clipboardData.setData('text/plain', plain); event.clipboardData.setData('text/html', html); event.preventDefault();
  };
  document.addEventListener('copy', onCopy);
  try { if (!document.execCommand('copy')) throw new Error('COPY_UNAVAILABLE'); }
  finally { document.removeEventListener('copy', onCopy); field.remove(); focused?.focus(); }
}
