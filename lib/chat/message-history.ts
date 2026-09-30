import { searchContextReference } from '@/lib/web/search-context';

type TextPart = { type: 'text'; text: string };

type ChatHistoryMessage = {
  role: string;
  content?: unknown;
  parts?: unknown;
  annotations?: unknown;
  experimental_attachments?: Array<{ name?: string; contentType?: string; url: string }>;
};

export function formatChatTimestamp(value: unknown, locale: string, now = new Date()): string | null {
  const date = value instanceof Date ? value : typeof value === 'string' || typeof value === 'number'
    ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const language = locale.startsWith('ar') ? 'ar' : locale.startsWith('fr') ? 'fr' : 'en';
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  if (date.getTime() >= startToday) return time;
  if (date.getTime() >= startYesterday) return `${{ en: 'Yesterday', fr: 'Hier', ar: 'أمس' }[language]}, ${time}`;
  return `${new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)}, ${time}`;
}

export function canRegenerateAssistantMessage(message: { role: string; content?: unknown;
  vantraParts?: unknown; toolInvocations?: unknown; vantraFailureKind?: unknown }, agentResult = false): boolean {
  if (message.role !== 'assistant' || agentResult || typeof message.content !== 'string' || !message.content.trim()) return false;
  if (message.vantraFailureKind) return false;
  if (Array.isArray(message.vantraParts) && message.vantraParts.some((part) => part && typeof part === 'object'
    && 'type' in part && part.type !== 'text')) return false;
  if (Array.isArray(message.toolInvocations) && message.toolInvocations.some((part) => part && typeof part === 'object'
    && 'state' in part && part.state === 'result')) return false;
  return true;
}

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
    ...(searchContextReference(message.annotations) ? { annotations: [searchContextReference(message.annotations)] } : {}),
    ...(message.experimental_attachments != null ? { experimental_attachments: message.experimental_attachments } : {}),
  }));
}

export function providerChatMessages(messages: readonly ChatHistoryMessage[]) {
  return messages.map((message) => {
    const { vantraParts: _artifactParts, parts: _uiParts, toolInvocations: _tools, annotations: _annotations, ...providerMessage } =
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
