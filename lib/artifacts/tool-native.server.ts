import { tool } from 'ai';
import { runArtifactTool, selectedNativeArtifactTools, type ArtifactToolSelection } from './tool-registry';

/** One model step only: tool execution is deterministic and never calls another model. */
export function buildNativeArtifactTools(selection: ArtifactToolSelection) {
  return Object.fromEntries(Object.values(selectedNativeArtifactTools(selection)).map((definition) => [definition.name, tool({
    description: definition.description,
    parameters: definition.inputSchema,
    execute: async (args) => runArtifactTool(definition.name, args),
  })]));
}
