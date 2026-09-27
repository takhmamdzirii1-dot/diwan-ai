import { requestedPresentationSlideCount, type ChatMessagePart } from '@/lib/artifacts/chat-parts';
import type { SpreadsheetArtifact } from '@/lib/artifacts/core';
import { readSpreadsheetContextTool, runReadSpreadsheetContextTool, runArtifactTool } from '@/lib/artifacts/tool-registry';
import { chartFromPlan, type AgentChartPlan } from '@/lib/artifacts/spreadsheet-actions';
import { z } from 'zod';

const chartPlanSchema = z.object({ purpose: z.string().trim().min(3).max(160),
  categoryColumn: z.string().min(1).max(160), measureColumn: z.string().min(1).max(160),
  operation: z.enum(['average_by_category', 'top_n']), chartType: z.enum(['bar', 'line']) }).strict();
const analysisSchema = z.object({ summary: z.string().trim().min(1).max(500),
  insights: z.array(z.string().trim().min(1).max(300)).max(5),
  chartPlans: z.array(chartPlanSchema).min(1).max(2),
  presentationOutline: z.array(z.string().trim().min(1).max(120)).max(8) }).strict();
export type AgentAnalysis = { summary: string; insights: string[]; chartPlans: AgentChartPlan[];
  presentationOutline: string[] };

export function parseAgentAnalysis(text: string): AgentAnalysis | null {
  try {
    const parsed = analysisSchema.safeParse(JSON.parse(text.trim()));
    if (!parsed.success) return null;
    const visible = [parsed.data.summary, ...parsed.data.insights, ...parsed.data.presentationOutline,
      ...parsed.data.chartPlans.map((plan) => plan.purpose)].join(' ');
    return /```|\b(?:import\s+\w+|def\s+\w+|function\s+\w+|as an ai|python|javascript)\b/i.test(visible)
      ? null : parsed.data as AgentAnalysis;
  } catch { return null; }
}

export function distinctAgentChartPlans(plans: AgentChartPlan[]): AgentChartPlan[] {
  const seen = new Set<string>();
  return plans.filter((plan) => {
    const key = [plan.categoryColumn, plan.measureColumn, plan.operation].map((part) => part.toLowerCase()).join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type AgentStatus = 'idle' | 'running' | 'waiting_for_user' | 'completed' | 'cancelled' | 'failed';
export type AgentStep = 'reading' | 'analyzing' | 'charts' | 'presentation';
export type AgentTask = { kind: 'spreadsheet_presentation'; chartCount: number; slideCount: number };
export type AgentRun = {
  agentRunId: string; conversationId: string; attachmentId: string | null; requestId: string | null; originalUserRequest: string; status: AgentStatus;
  currentStep: AgentStep | null; completedSteps: AgentStep[]; semanticCallCount: number; toolCallCount: number;
  maxSemanticCalls: number; maxToolCalls: number; cancelled: boolean; waitingForUser: boolean;
  artifacts: ChatMessagePart[]; analysis: AgentAnalysis | null; contextText: string;
  failedStep: AgentStep | null;
  terminalError: 'switch_model' | 'analysis_failed' | 'chart_failed' | 'presentation_failed' | 'provider_or_network_failed' | null;
  task: AgentTask;
};
export type AgentSemanticResult = { text: string; artifacts: ChatMessagePart[]; toolCallCount: number };

export function isSingleSpreadsheetChartRequest(request: string): boolean {
  const text = request.slice(0, 8_000).toLowerCase();
  return /\b(create|make|build|plot)\b.*\b(charts?|graphs?|plots?)\b/.test(text)
    && !/\b(presentation|slides?|powerpoint|analy[sz]e|summari[sz]e|report|document|article|brief|memo)\b/.test(text);
}

export function agentTaskFor(request: string, hasAttachedSpreadsheet = false): AgentTask | null {
  const text = request.slice(0, 8_000).toLowerCase();
  const spreadsheet = /\b(spreadsheet|workbook|sheet|tableur|feuille de calcul)\b|جدول\s*بيانات/.test(text);
  const chart = /\b(charts?|graphs?|plots?|graphiques?)\b|رسوم?\s*بياني/.test(text);
  const presentation = /\b(presentation|slides?|powerpoint|présentation|diaporama)\b|عرض\s*تقديمي/.test(text);
  if (!(spreadsheet || hasAttachedSpreadsheet) || !chart || !presentation) return null;
  const chartCount = /\b(?:two|2|deux)\s+(?:useful\s+)?(?:charts?|graphs?|graphiques?)\b/.test(text) ? 2 : 1;
  const slideCount = requestedPresentationSlideCount(request) ?? 6;
  return { kind: 'spreadsheet_presentation', chartCount, slideCount };
}

export function createAgentRun(request: string, conversationId: string, agentRunId: string,
  hasAttachedSpreadsheet = false, attachmentId: string | null = null): AgentRun | null {
  const task = agentTaskFor(request, hasAttachedSpreadsheet);
  return task ? { agentRunId, conversationId, attachmentId, requestId: null, originalUserRequest: request, task, status: 'idle', currentStep: null,
    completedSteps: [], semanticCallCount: 0, toolCallCount: 0, maxSemanticCalls: 4, maxToolCalls: 8,
    cancelled: false, waitingForUser: false, artifacts: [], analysis: null, contextText: '', failedStep: null,
    terminalError: null } : null;
}

export function cancelAgentRun(run: AgentRun): AgentRun {
  return { ...run, status: 'cancelled', cancelled: true, waitingForUser: false, currentStep: null, requestId: null };
}

export function isCurrentAgentUpdate(state: AgentRun, active: Pick<AgentRun, 'agentRunId' | 'conversationId'> | null): boolean {
  return Boolean(active && state.agentRunId === active.agentRunId && state.conversationId === active.conversationId);
}

export async function executeAgentRun(run: AgentRun, spreadsheet: SpreadsheetArtifact | null, deps: {
  semantic: (stage: 'analysis' | 'presentation', prompt: string, operationId: string, toolBudget: number,
    signal: AbortSignal, options?: { requestedSlideCount: number }) => Promise<AgentSemanticResult>;
  operationId: () => string; signal: AbortSignal; onUpdate: (state: AgentRun) => void;
}): Promise<AgentRun> {
  const state: AgentRun = { ...run, completedSteps: [...run.completedSteps], artifacts: [...run.artifacts],
    failedStep: null, terminalError: null };
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
      const result = await deps.semantic('analysis', `Analyze the bounded spreadsheet for the user's task. Return ONLY one JSON object with exactly these keys: summary (one concise sentence), insights (up to five concise supported findings), chartPlans (up to two), presentationOutline (short slide topics). Each chart plan has purpose, categoryColumn, measureColumn, operation (average_by_category or top_n), chartType (bar or line). Use exact column names. Plans must answer distinct questions; changing chart type alone does not make a different plan. IDs, codes and indexes are never measures. Do not include code, implementation notes, markdown, or unsupported claims.\n\nTask:\n${state.originalUserRequest}\n\nBounded data:\n${state.contextText}`, state.requestId, state.maxToolCalls - state.toolCallCount, deps.signal);
      checkCancelled();
      state.requestId = null;
      const analysis = parseAgentAnalysis(result.text);
      if (!analysis) throw new Error('MODEL_FAILURE');
      state.analysis = analysis;
      state.toolCallCount += result.toolCallCount;
      if (state.toolCallCount > state.maxToolCalls) throw new Error('TOOL_LIMIT');
      done('analyzing');
    }
    if (!state.completedSteps.includes('charts')) {
      begin('charts');
      const plans = distinctAgentChartPlans(state.analysis?.chartPlans ?? []);
      for (let index = state.artifacts.filter((part) => part.type === 'chart').length;
        index < Math.min(state.task.chartCount, plans.length); index++) {
        const chart = chartFromPlan(spreadsheet, sheet, plans[index]);
        const input = { title: chart.title, chartType: chart.chartType,
          categories: chart.categories, series: chart.series, language: spreadsheet.language };
        const result = tool(() => runArtifactTool('create_chart', input));
        if (result.status !== 'ok' || result.artifact.type !== 'chart') throw new Error('TOOL_FAILURE');
        state.artifacts.push({ type: 'chart', artifact: result.artifact });
        update();
      }
      if (state.artifacts.filter((part) => part.type === 'chart').length < state.task.chartCount)
        throw new Error('CHART_COLUMNS_REQUIRED');
      done('charts');
    }
    if (!state.completedSteps.includes('presentation')) {
      begin('presentation');
      if (state.semanticCallCount >= state.maxSemanticCalls) throw new Error('SEMANTIC_LIMIT');
      if (state.toolCallCount >= state.maxToolCalls) throw new Error('TOOL_LIMIT');
      state.semanticCallCount++;
      state.requestId = deps.operationId(); update();
      const compactCharts = state.artifacts.filter((part) => part.type === 'chart').map((part) => ({
        title: part.artifact.title, category: part.artifact.categories.slice(0, 8),
        measure: part.artifact.series[0]?.name, values: part.artifact.series[0]?.values.slice(0, 8),
      }));
      const result = await deps.semantic('presentation', `Create exactly ${state.task.slideCount} slides with create_presentation. Supply exactly that many slides in the tool input. Use only the validated findings and compact chart data. Do not include raw workbook rows or invent chart references.\n\nTask: ${state.originalUserRequest}\nSheet: ${sheet.name}; rows: ${sheet.rows.length}; columns: ${sheet.columns.join(', ')}\nAnalysis: ${JSON.stringify(state.analysis)}\nCharts: ${JSON.stringify(compactCharts)}`, state.requestId, state.maxToolCalls - state.toolCallCount, deps.signal,
        { requestedSlideCount: state.task.slideCount });
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
      state.failedStep = state.currentStep;
      state.terminalError = error instanceof Error && error.message === 'SWITCH_MODEL' ? 'switch_model'
        : state.currentStep === 'presentation' ? 'presentation_failed'
          : state.currentStep === 'charts' ? 'chart_failed'
            : state.currentStep === 'analyzing' || state.currentStep === 'reading' ? 'analysis_failed'
              : 'provider_or_network_failed';
    }
    state.currentStep = null; state.requestId = null; update();
  }
  return state;
}

export const agentReadProgress = readSpreadsheetContextTool.progress;
