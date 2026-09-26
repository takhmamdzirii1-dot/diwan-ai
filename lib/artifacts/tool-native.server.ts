import { tool } from 'ai';
import { runArtifactTool, selectedNativeArtifactTools, type ArtifactToolSelection } from './tool-registry';

/** One model step only: tool execution is deterministic and never calls another model. */
export function buildNativeArtifactTools(selection: ArtifactToolSelection, maxCalls = Number.POSITIVE_INFINITY) {
  let calls = 0;
  const failures = new Map<string, number>();
  return Object.fromEntries(Object.values(selectedNativeArtifactTools(selection)).map((definition) => [definition.name, tool({
    description: definition.description,
    parameters: definition.inputSchema,
    execute: async (args) => {
      if (calls >= maxCalls || (Number.isFinite(maxCalls) && (failures.get(definition.name) ?? 0) >= 2))
        return { status: 'error' as const, message: 'This step could not be completed.' };
      calls++;
      const result = runArtifactTool(definition.name, args);
      if (result.status === 'error') failures.set(definition.name, (failures.get(definition.name) ?? 0) + 1);
      return result;
    },
  })]));
}
