export type TextDirection = 'rtl' | 'ltr';
export type BidiRun = { text: string; direction?: TextDirection };

/** Logical-order segmentation, not string reversal. Keep technical names and their
 * punctuation/numbers together; bidi controls from outside content cannot override us.
 */
export function bidiRuns(value: string, direction: TextDirection): BidiRun[] {
  const text = value.replace(/[\u202A-\u202E\u2066-\u2069]/gu, '');
  const pattern = direction === 'rtl'
    ? /https?:\/\/[^\s<>]+|[A-Za-z][A-Za-z\d]*(?:[._/+:-][A-Za-z\d]+)*(?:[ \t]+[A-Za-z][A-Za-z\d]*(?:[._/+:-][A-Za-z\d]+)*)*|(?:[~≈$€£¥+−-]\s*)?\p{Number}+(?:[.,٬٫:/-]\p{Number}+)*(?:\s*(?:[%٪$€£¥]|USD|EUR|DZD|DA))?/gu
    : /\p{Script=Arabic}[\p{Script=Arabic}\p{Mark}]*(?:[ \t]+[\p{Script=Arabic}\p{Mark}]+)*/gu;
  const runs: BidiRun[] = []; let position = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > position) runs.push({ text: text.slice(position, match.index) });
    runs.push({ text: match[0], direction: direction === 'rtl' ? 'ltr' : 'rtl' });
    position = match.index! + match[0].length;
  }
  if (position < text.length) runs.push({ text: text.slice(position) });
  return runs;
}

export function isolatedPlainText(text: string, direction: TextDirection) {
  return text.split('\n').map((line) => {
    const isolated = bidiRuns(line, direction).map((run) => run.direction
      ? `${run.direction === 'ltr' ? '\u2066' : '\u2067'}${run.text}\u2069` : run.text).join('');
    return direction === 'rtl' && line.trim() ? `\u2067${isolated}\u2069` : isolated;
  }).join('\n');
}
