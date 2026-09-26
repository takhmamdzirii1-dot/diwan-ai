import type { ChatMessagePart } from '@/lib/artifacts/chat-parts';
import type { SpreadsheetArtifact } from '@/lib/artifacts/core';
import { readSpreadsheetContextTool, runReadSpreadsheetContextTool, runArtifactTool } from '@/lib/artifacts/tool-registry';

export type AgentStatus = 'idle' | 'running' | 'waiting_for_user' | 'completed' | 'cancelled' | 'failed';
export type AgentStep = 'reading' | 'analyzing' | 'charts' | 'presentation';
export type AgentTask = { kind: 'spreadsheet_presentation'; chartCount: number; slideCount: number };
export type AgentRun = {
  agentRunId: string; conversationId: string; requestId: string | null; originalUserRequest: string; status: AgentStatus;
  currentStep: AgentStep | null; completedSteps: AgentStep[]; semanticCallCount: number; toolCallCount: number;
  maxSemanticCalls: number; maxToolCalls: number; cancelled: boolean; waitingForUser: boolean;
  artifacts: ChatMessagePart[]; analysisText: string; contextText: string; terminalError: 'switch_model' | 'tool_failure' | 'model_failure' | null;
  task: AgentTask;
};
export type AgentSemanticResult = { text: string; artifacts: ChatMessagePart[]; toolCallCount: number };

export function agentTaskFor(request: string): AgentTask | null {
  const text = request.slice(0, 8_000).toLowerCase();
  const spreadsheet = /\b(spreadsheet|workbook|sheet|tableur|feuille de calcul)\b|جدول\s*بيانات/.test(text);
  const analysis = /\b(analy[sz]e|inspect|review|summari[sz]e|analyse|analyser)\b|حلل|لخص/.test(text);
  const chart = /\b(charts?|graphs?|plots?|graphiques?)\b|رسوم?\s*بياني/.test(text);
  const presentation = /\b(presentation|slides?|powerpoint|présentation|diaporama)\b|عرض\s*تقديمي/.test(text);
  if (!spreadsheet || !analysis || !chart || !presentation) return null;
  const chartCount = /\b(?:two|2|deux)\s+(?:useful\s+)?(?:charts?|graphs?|graphiques?)\b/.test(text) ? 2 : 1;
  const slideCount = Number(/\b([2-8])[- ]slide\b|\b([2-8])\s+slides?\b/.exec(text)?.[1] ?? /\b([2-8])\s+slides?\b/.exec(text)?.[1] ?? 6);
  return { kind: 'spreadsheet_presentation', chartCount, slideCount };
}

export function createAgentRun(request: string, conversationId: string, agentRunId: string): AgentRun | null {
  const task = agentTaskFor(request);
  return task ? { agentRunId, conversationId, requestId: null, originalUserRequest: request, task, status: 'idle', currentStep: null,
    completedSteps: [], semanticCallCount: 0, toolCallCount: 0, maxSemanticCalls: 4, maxToolCalls: 8,
    cancelled: false, waitingForUser: false, artifacts: [], analysisText: '', contextText: '', terminalError: null } : null;
}

export function cancelAgentRun(run: AgentRun): AgentRun {
  return { ...run, status: 'cancelled', cancelled: true, waitingForUser: false, currentStep: null, requestId: null };
}

export function isCurrentAgentUpdate(state: AgentRun, active: Pick<AgentRun, 'agentRunId' | 'conversationId'> | null): boolean {
  return Boolean(active && state.agentRunId === active.agentRunId && state.conversationId === active.conversationId);
}

export async function executeAgentRun(run: AgentRun, spreadsheet: SpreadsheetArtifact | null, deps: {
  semantic: (stage: 'analysis' | 'presentation', prompt: string, operationId: string, toolBudget: number, signal: AbortSignal) => Promise<AgentSemanticResult>;
  operationId: () => string; signal: AbortSignal; onUpdate: (state: AgentRun) => void;
}): Promise<AgentRun> {
  const state: AgentRun = { ...run, completedSteps: [...run.completedSteps], artifacts: [...run.artifacts], terminalError: null };
  const update = () => deps.onUpdate({ ...state, completedSteps: [...state.completedSteps], artifacts: [...state.artifacts] });
  const checkCancelled = () => { if (state.cancelled || deps.signal.aborted) throw new Error('AGENT_CANCELLED'); };
  const begin = (step: AgentStep) => { checkCancelled(); state.status = 'running'; state.currentStep = step; update(); };
  const done = (step: AgentStep) => { state.completedSteps.push(step); state.currentStep = null; update(); };
  const tool = <T extends { status: string }>(execute: () => T): T => {
    let result: T;
    for (let attempt = 0; attempt < 2; attempt++) {
      checkCancelled();
      if (state.toolCallCount >= state.maxToolCalls) throw new Error('TOOL_LIMIT');
      state.toolCallCount++;
      result = execute();
      if (result.status === 'ok') return result;
    }
    throw new Error('TOOL_FAILURE');
  };
  try {
    checkCancelled();
    if (!spreadsheet) {
      state.status = 'waiting_for_user'; state.waitingForUser = true; state.currentStep = null; update(); return state;
    }
    state.waitingForUser = false;
    const sheet = spreadsheet.sheets[0];
    if (!sheet) throw new Error('TOOL_FAILURE');
    if (!state.completedSteps.includes('reading')) {
      begin('reading');
      const read = tool(() => runReadSpreadsheetContextTool(spreadsheet, sheet.id));
      if (read.status !== 'ok') throw new Error('TOOL_FAILURE');
      state.contextText = `Columns: ${read.headers.join('\t')}\n${read.context}`;
      done('reading');
    }
    if (!state.completedSteps.includes('analyzing')) {
      begin('analyzing');
      if (state.semanticCallCount >= state.maxSemanticCalls) throw new Error('SEMANTIC_LIMIT');
      state.semanticCallCount++;
      state.requestId = deps.operationId(); update();
      const result = await deps.semantic('analysis', `Analyze the bounded spreadsheet data below for the user's task. State only supported findings.\n\n${state.originalUserRequest}\n\n${state.contextText}`, state.requestId, state.maxToolCalls - state.toolCallCount, deps.signal);
      checkCancelled();
      state.requestId = null;
      if (!result.text.trim()) throw new Error('MODEL_FAILURE');
      state.analysisText = result.text;
      state.toolCallCount += result.toolCallCount;
      if (state.toolCallCount > state.maxToolCalls) throw new Error('TOOL_LIMIT');
      done('analyzing');
    }
    if (!state.completedSteps.includes('charts')) {
      begin('charts');
      const rows = sheet.rows.slice(0, 40);
      const numeric = sheet.columns.map((_, index) => index).filter((index) => index > 0 && rows.some((row) => typeof row[index] === 'number')).slice(0, 2);
      if (!numeric.length || !rows.length) throw new Error('TOOL_FAILURE');
      for (let index = state.artifacts.filter((part) => part.type === 'chart').length; index < state.task.chartCount; index++) {
        const column = numeric[index % numeric.length];
        const input = { title: `${sheet.name}: ${sheet.columns[column]}`, chartType: index === 0 ? 'bar' : 'line',
          categories: rows.map((row, rowIndex) => String(row[0] ?? rowIndex + 1).slice(0, 160)),
          series: [{ name: sheet.columns[column], values: rows.map((row) => typeof row[column] === 'number' ? row[column] as number : null) }],
          language: spreadsheet.language };
        const result = tool(() => runArtifactTool('create_chart', input));
        if (result.status !== 'ok' || result.artifact.type !== 'chart') throw new Error('TOOL_FAILURE');
        state.artifacts.push({ type: 'chart', artifact: result.artifact });
        update();
      }
      done('charts');
    }
    if (!state.completedSteps.includes('presentation')) {
      begin('presentation');
      if (state.semanticCallCount >= state.maxSemanticCalls) throw new Error('SEMANTIC_LIMIT');
      if (state.toolCallCount >= state.maxToolCalls) throw new Error('TOOL_LIMIT');
      state.semanticCallCount++;
      state.requestId = deps.operationId(); update();
      const chartTitles = state.artifacts.filter((part) => part.type === 'chart').map((part) => part.artifact.title).join(', ');
      const result = await deps.semantic('presentation', `Create a ${state.task.slideCount}-slide presentation for the user's request, using only the bounded data and findings. Summarize the existing charts in text; do not invent chart references.\n\n${state.originalUserRequest}\n\n${state.contextText}\n\nFindings:\n${state.analysisText}\n\nExisting charts: ${chartTitles}`, state.requestId, state.maxToolCalls - state.toolCallCount, deps.signal);
      checkCancelled();
      state.requestId = null;
      state.toolCallCount += result.toolCallCount;
      if (state.toolCallCount > state.maxToolCalls) throw new Error('TOOL_LIMIT');
      const presentation = result.artifacts.find((part) => part.type === 'presentation');
      if (!presentation || presentation.artifact.slides.length !== state.task.slideCount) throw new Error('MODEL_FAILURE');
      state.artifacts.push(presentation);
      done('presentation');
    }
    state.status = 'completed'; state.currentStep = null; update();
  } catch (error) {
    if (error && typeof error === 'object' && 'toolCallCount' in error
      && typeof error.toolCallCount === 'number') state.toolCallCount += error.toolCallCount;
    if (deps.signal.aborted || (error instanceof Error && error.message === 'AGENT_CANCELLED')) {
      state.status = 'cancelled'; state.cancelled = true;
    } else {
      state.status = 'failed';
      state.terminalError = error instanceof Error && error.message === 'SWITCH_MODEL' ? 'switch_model'
        : error instanceof Error && /TOOL/.test(error.message) ? 'tool_failure' : 'model_failure';
    }
    state.currentStep = null; state.requestId = null; update();
  }
  return state;
}

export const agentReadProgress = readSpreadsheetContextTool.progress;
