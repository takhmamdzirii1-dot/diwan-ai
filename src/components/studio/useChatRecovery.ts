'use client';
import { useEffect, useRef } from 'react';
import type { Message } from '@ai-sdk/react';
import { chatIdentifier, mayHydrateChat, mergeRecoveredHistory, type DurableMessage } from '@/lib/chat/durable-history';

type Session = { id: string; title: string; createdAt: number };

/** Server-authoritative recovery, browser history remains the legacy fallback.
 * Client reads only while a recovered reply is streaming; no server polling. */
export function useChatRecovery(input: {
  userId?: string; sessionId: string | null; busy: boolean;
  revision: React.MutableRefObject<number>;
  setSessionId: (id: string) => void;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  setMessages: (messages: Message[] | ((current: Message[]) => Message[])) => void;
}) {
  const latest = useRef(input); latest.current = input;
  useEffect(() => {
    if (!input.userId) return;
    const controller = new AbortController();
    const revision = input.revision.current;
    void fetch('/api/chat/history', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) return;
      const body = await response.json() as { sessions: Session[] };
      if (controller.signal.aborted) return;
      input.setSessions(current => [...body.sessions, ...current.filter(item => !body.sessions.some(row => row.id === item.id))].slice(0, 30));
      // Fresh entry stays fresh; reload resumes this tab's owned conversation.
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const saved = sessionStorage.getItem(`vantra_active_chat_${input.userId}`);
      if (navigation?.type === 'reload' && saved && chatIdentifier(saved) && !latest.current.busy
        && latest.current.revision.current === revision && body.sessions.some(row => row.id === saved)) input.setSessionId(saved);
    }).catch(() => { /* Keep legacy history on an unavailable connection. */ });
    return () => controller.abort();
  }, [input.userId, input.setSessions, input.setSessionId]);

  useEffect(() => {
    if (!input.userId || !input.sessionId || input.busy) return;
    const controller = new AbortController();
    const sessionId = input.sessionId;
    const revision = input.revision.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (controller.signal.aborted) return;
      try {
        const response = await fetch(`/api/chat/history?conversationId=${encodeURIComponent(sessionId)}`,
          { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) return;
        const body = await response.json() as { messages: DurableMessage[] };
        if (controller.signal.aborted || latest.current.revision.current !== revision
          || !mayHydrateChat(sessionId, latest.current.sessionId, latest.current.busy)) return;
        const restored: Message[] = body.messages.map(message => {
          const { annotations, ...rest } = message;
          return { ...rest, createdAt: new Date(message.createdAt),
            ...(Array.isArray(annotations) ? { annotations: annotations as NonNullable<Message['annotations']> } : {}) };
        });
        if (restored.length) input.setMessages(current => mergeRecoveredHistory(current, restored));
        if (body.messages.some(message => message.vantraStatus === 'streaming')) timer = setTimeout(() => void load(), 4_000);
      } catch { /* Do not overwrite cached history after a network error. */ }
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [input.userId, input.sessionId, input.busy, input.setMessages]);
}
