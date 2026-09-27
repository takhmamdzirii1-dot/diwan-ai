import { tool } from 'ai';
import { runArtifactTool, selectedNativeArtifactTools, type ArtifactToolSelection } from './tool-registry';

/** One model step only: tool execution is deterministic and never calls another model. */
export function buildNativeArtifactTools(selection: ArtifactToolSelection, maxCalls = Number.POSITIVE_INFINITY,
  onExecution?: (event: { toolName: string; stage: 'started' | 'completed' | 'failed' }) => void) {
  let calls = 0;
  const failures = new Map<string, number>();
  return Object.fromEntries(Object.values(selectedNativeArtifactTools(selection)).map((definition) => [definition.name, tool({
    description: definition.description,
    parameters: definition.inputSchema,
    execute: async (args) => {
      onExecution?.({ toolName: definition.name, stage: 'started' });
      if (calls >= maxCalls || (Number.isFinite(maxCalls) && (failures.get(definition.name) ?? 0) >= 2)) {
        onExecution?.({ toolName: definition.name, stage: 'failed' });
        return { status: 'error' as const, message: 'This step could not be completed.' };
      }
      calls++;
      const result = runArtifactTool(definition.name, args);
      if (result.status === 'error') {
        failures.set(definition.name, (failures.get(definition.name) ?? 0) + 1);
        onExecution?.({ toolName: definition.name, stage: 'failed' });
      } else onExecution?.({ toolName: definition.name, stage: 'completed' });
      return result;
    },
  })]));
}
