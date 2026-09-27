import { chatPartsFromMessage, validatedArtifactPartFromToolResult, type ChatMessagePart } from '@/lib/artifacts/chat-parts';
import type { ArtifactToolName, ArtifactToolSelection, ArtifactToolPath } from '@/lib/artifacts/tool-registry';
import { partMatchesRequestedAction } from './action-routing';

export type ActionFailureCategory = 'provider_stream_failure' | 'tool_call_incomplete' | 'tool_arguments_invalid'
  | 'tool_execution_failed' | 'tool_result_missing' | 'expected_artifact_missing';

export function actionFailureCode(category: ActionFailureCategory): string {
  return category.toUpperCase();
}

export type ToolLifecycle = {
  callStarted: boolean;
  toolNameReceived: boolean;
  argumentsCompleted: boolean;
  argumentsValid: boolean;
  executionStarted: boolean;
  executionCompleted: boolean;
  executionFailed: boolean;
  resultEmitted: boolean;
  resultValidated: boolean;
  argumentsInvalid: boolean;
};

export function emptyToolLifecycle(): ToolLifecycle {
  return { callStarted: false, toolNameReceived: false, argumentsCompleted: false,
    argumentsValid: false, executionStarted: false, executionCompleted: false,
    executionFailed: false, resultEmitted: false, resultValidated: false, argumentsInvalid: false };
}

export function explicitActionName(selection: ArtifactToolSelection): ArtifactToolName | null {
  return selection.mode === 'semantic' || selection.names.length !== 1 ? null : selection.names[0];
}

type ToolResult = { toolName: string; toolCallId: string; result: unknown };

/** Structured output and native tools share the same validated artifact/file contract. */
export function validatedExpectedActionPart(name: ArtifactToolName, path: ArtifactToolPath, text: string,
  results: readonly ToolResult[], emittedResultIds: ReadonlySet<string>): ChatMessagePart | null {
  if (path === 'native') {
    for (const entry of results) {
      if (entry.toolName !== name || !emittedResultIds.has(entry.toolCallId)) continue;
      const part = validatedArtifactPartFromToolResult(entry.toolName, entry.result);
      if (part && partMatchesRequestedAction(part, name)) return part;
    }
    return null;
  }
  const parts = chatPartsFromMessage(text, 'en');
  return parts.length === 1 && partMatchesRequestedAction(parts[0], name) ? parts[0] : null;
}

export function assessChatCompletion(input: {
  expectedAction: ArtifactToolName | null;
  finishReason: string | null;
  outputStarted: boolean;
  expectedResultValid: boolean;
  lifecycle: ToolLifecycle;
}): { completed: boolean; failureCategory: ActionFailureCategory | null; stage: string } {
  const { expectedAction, finishReason, outputStarted, expectedResultValid, lifecycle } = input;
  if (!expectedAction) {
    const completed = finishReason !== 'error' && outputStarted;
    return { completed, failureCategory: completed ? null : 'provider_stream_failure',
      stage: completed ? 'finalization_complete' : 'provider_stream' };
  }
  if (finishReason !== 'error' && expectedResultValid) {
    return { completed: true, failureCategory: null, stage: 'finalization_complete' };
  }
  if (finishReason === 'error' && expectedResultValid) {
    return { completed: false, failureCategory: 'provider_stream_failure', stage: 'provider_stream' };
  }
  if (lifecycle.argumentsInvalid) return { completed: false, failureCategory: 'tool_arguments_invalid', stage: 'validation' };
  if (lifecycle.executionFailed) return { completed: false, failureCategory: 'tool_execution_failed', stage: 'execution' };
  if ((lifecycle.callStarted && !lifecycle.argumentsCompleted)
    || (finishReason === 'tool-calls' && !lifecycle.callStarted)) {
    return { completed: false, failureCategory: 'tool_call_incomplete', stage: 'tool_selection' };
  }
  if (lifecycle.argumentsCompleted && !lifecycle.resultEmitted) {
    return { completed: false, failureCategory: 'tool_result_missing', stage: 'result_emission' };
  }
  if (finishReason === 'error' && !lifecycle.callStarted) {
    return { completed: false, failureCategory: 'provider_stream_failure', stage: 'provider_stream' };
  }
  return { completed: false, failureCategory: 'expected_artifact_missing', stage: 'finalization' };
}
