import { experimental_wrapLanguageModel, type LanguageModel } from 'ai';

/** Research is allowed first; it cannot replace an explicitly requested document. */
export function documentAfterResearch(model: LanguageModel, researchReady: () => boolean = () => false) {
  return experimental_wrapLanguageModel({ model, middleware: {
    transformParams: async ({ params }) => {
      if (params.mode.type !== 'regular') return params;
      const lastUser = params.prompt.findLastIndex((message) => message.role === 'user');
      const results = params.prompt.slice(lastUser + 1).flatMap((message) => message.role === 'tool' ? message.content : []);
      const documentDone = results.some((result) => result.toolName === 'create_document');
      const researched = results.some((result) => ['web_search', 'read_web_page'].includes(result.toolName));
      if (!researched && !documentDone && !researchReady()) return params;
      return { ...params, ...(documentDone ? { maxTokens: Math.min(params.maxTokens ?? 96, 96),
        prompt: [...params.prompt, { role: 'system' as const,
          content: 'The document tool has finished. Give only one brief acknowledgement in the user language. Do not repeat the document or start another action. If the tool failed, acknowledge the failure honestly.' }] } : {}),
        mode: { ...params.mode, toolChoice: documentDone
        ? { type: 'none' } : { type: 'tool', toolName: 'create_document' } } };
    },
  } });
}
