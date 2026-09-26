type TextPart = { type: 'text'; text: string };

type ChatHistoryMessage = {
  role: string;
  content?: unknown;
  parts?: unknown;
  experimental_attachments?: Array<{ name?: string; contentType?: string; url: string }>;
};

function textParts(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const parts = value.filter((part): part is TextPart =>
    part !== null && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string');
  return parts.length > 0 ? parts.map((part) => part.text).join('') : null;
}

export function completeMessageText(message: ChatHistoryMessage): string {
  if (typeof message.content === 'string' && message.content.length > 0) return message.content;
  return textParts(message.content) ?? textParts(message.parts) ?? '';
}

export function chatRequestMessages(messages: readonly ChatHistoryMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: completeMessageText(message),
    ...(message.experimental_attachments != null ? { experimental_attachments: message.experimental_attachments } : {}),
  }));
}

export function providerChatMessages(messages: readonly ChatHistoryMessage[]) {
  return messages.map((message) => {
    const { vantraParts: _artifactParts, parts: _uiParts, toolInvocations: _tools, ...providerMessage } =
      message as ChatHistoryMessage & { vantraParts?: unknown; toolInvocations?: unknown };
    return { ...providerMessage, content: completeMessageText(message) };
  });
}

export function serializeChatSession<T extends ChatHistoryMessage>(messages: readonly T[],
  finalizedParts: (message: T) => unknown): string {
  return JSON.stringify(messages.map((message) => message.role === 'assistant'
    ? { ...message, vantraParts: finalizedParts(message) }
    : message));
}
