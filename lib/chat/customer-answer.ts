/** Native tool steps are orchestration, not the final customer answer.
 * Use SDK step boundaries, never wording/regex guesses about what is a plan.
 * Token usage still includes every step; only the delivery projection changes.
 */
export class CustomerAnswer {
  private pending = '';
  private answer = '';
  private excludedChars = 0;
  append(text: string) { this.pending += text; }
  finishStep(step: { finishReason: string; toolCalls: readonly unknown[]; isContinued?: boolean }) {
    if (step.finishReason === 'tool-calls' && step.toolCalls.length > 0 && !step.isContinued) {
      this.excludedChars += this.pending.length;
    } else this.answer += this.pending;
    this.pending = '';
  }
  get text() { return this.answer + this.pending; }
  get internalTextChars() { return this.excludedChars; }
}

/** Return the text-frame indices proven to belong to native orchestration steps.
 * Unknown/incomplete boundaries are NOT grounds for dropping text.
 */
export function internalTextFrames(lines: readonly string[]) {
  const excluded = new Set<number>();
  let pending: number[] = []; let calls = 0;
  for (const [index, line] of lines.entries()) {
    if (line.startsWith('0:')) pending.push(index);
    if (line.startsWith('9:')) calls++;
    if (line.startsWith('e:')) {
      const step = JSON.parse(line.slice(2));
      if (step.finishReason === 'tool-calls' && calls > 0 && !step.isContinued)
        pending.forEach((frame) => excluded.add(frame));
      pending = []; calls = 0;
    }
  }
  return excluded;
}
