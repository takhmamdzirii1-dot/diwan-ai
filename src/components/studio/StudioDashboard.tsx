'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Menu, ArrowDown, Plus, Zap, Swords, Database, Settings, Sparkles, LayoutGrid, MessageSquare, Image as ImageIcon, Video, PenLine, Code2, Lightbulb, BarChart3, FileText } from 'lucide-react';
import { useChat, type Message } from '@ai-sdk/react';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import { ClaudeChatInput } from '@/components/ui/claude-style-chat-input';
import DashboardSidebar from './DashboardSidebar';
import MessageBubble from './MessageBubble';
import ChatCapacityHint from './ChatCapacityHint';
import RenewalBanner from './RenewalBanner';
import ImageCanvas, { type ImageGenerationResult, type ImageRequestDraft } from './ImageCanvas';
import SettingsModal from './StudioSettingsDialog';
import PrunaMotionStudio, { type VideoGenerationResult, type VideoRequestDraft } from './PrunaMotionStudio';
import MediaLibrary from './MediaLibrary';
import { VantraLogo } from '../VantraLogo';
import { cn } from '@/lib/utils';
import type { StudioRuntimeModelDefinition } from '@/src/config/studio-registry';
import { isModelSelectable } from '@/src/config/studio-registry';
import { applyModelPlanAccess } from '@/lib/models/plan-entitlements';
import { useLocale, useTranslations } from 'next-intl';
import { useStudioAccess } from '@/src/hooks/useStudioAccess';
import ActivationOffer, { type ActivationPrompt, type ActivationReason } from './ActivationOffer';
import type { ChatModelOption } from '@/components/ui/model-picker';
import { trackFunnelEvent } from '@/src/lib/funnel-analytics';
import dynamic from 'next/dynamic';
import { chatPartsFromMessage, requestedPresentationSlideCount, type ChatMessagePart } from '@/lib/artifacts/chat-parts';
import { attachConversationFile, AttachmentActionGate, attachmentRequestContext, chartFromSpreadsheetAttachment, clearPendingAttachments,
  getConversationAttachment, getConversationAttachments, getCurrentSpreadsheetAttachment, markPendingAttachment,
  resolveSpreadsheetAttachment,
  sentMessageAttachments,
  parseConversationAttachments, removePendingAttachment, uploadFileKind,
  type ConversationAttachment, type ConversationAttachmentDraft, type ConversationAttachmentStore,
  type PendingAttachmentIdStore } from '@/lib/chat/conversation-attachments';
import { canRegenerateAssistantMessage, chatRequestMessages, serializeChatSession } from '@/lib/chat/message-history';
import { chatModelRequestBody, resolveSelectedChatModel } from '@/lib/chat/studio-model-request';
import { executeAgentSemanticStep } from '@/lib/chat/agent-client';
import { agentTaskFor, cancelAgentRun, createAgentRun, distinctAgentChartPlans, executeAgentRun, isCurrentAgentUpdate,
  isSingleSpreadsheetChartRequest, type AgentRun } from '@/lib/chat/agent-runtime';
import { ChatRequestTracker, ChatStreamFinalizer, consumeCanonicalChatStream, hasUsableCanonicalOutput, restoreCanonicalAssistantText,
  type ChatRequestOutcome, type ChatTerminationReason } from '@/lib/chat/client-finalization';
import { presentationCompletion } from '@/lib/chat/presentation-completion';
import { guidanceForChatError, shouldShowChatError, type GuidanceAction } from '@/lib/chat/contextual-guidance';
import { selectArtifactTools } from '@/lib/artifacts/tool-registry';
import { routeConversationIntent } from '@/lib/chat/intent-router';
import { deterministicContextOutput, expectedOutputType, partMatchesRequestedAction,
  validateRequestedChatOutput } from '@/lib/chat/action-routing';
import ChatGuidanceCard from './ChatGuidanceCard';
import { decideWebSearchWithHistory } from '@/lib/web/selection';

const ArtifactSpreadsheetPreview = dynamic(() => import('./ArtifactSpreadsheetPreview'), { ssr: false });
const FileAttachmentPreview = dynamic(() => import('./FileAttachmentPreview'), { ssr: false });

type CenterMode = 'chat' | 'image' | 'video' | 'library';

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
}

const BOTTOM_THRESHOLD = 100;

const MAGIC_SKILLS = [
  {
    icon: Code2,
    key: 'writeCode',
  },
  {
    icon: ImageIcon,
    key: 'analyzeImage',
  },
  {
    icon: Video,
    key: 'planVideo',
  },
  {
    icon: FileText,
    key: 'summarizeDoc',
  },
] as const;

export default function StudioDashboard({
  activeWorkspace,
  onWorkspaceChange,
  models,
}: {
  activeWorkspace: CenterMode;
  onWorkspaceChange: (workspace: CenterMode) => void;
  models: StudioRuntimeModelDefinition[];
}) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations('studio.chat');
  const locale = useLocale();
  const sidebarT = useTranslations('studio.sidebar');
  const { user, refreshBalance, balance, balanceStatus, planCode, planStatus, planEndsAt } = useUser({ loadPlan: true, loadBalance: true });
  const { openAuthModal, openTopUpModal } = useModal();
  const { access } = useStudioAccess(Boolean(user));
  const [activationPrompt, setActivationPrompt] = useState<ActivationPrompt | null>(null);

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'apps'>('general');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [attachmentsBySession, setAttachmentsBySession] = useState<ConversationAttachmentStore>({});
  const attachmentsBySessionRef = useRef<ConversationAttachmentStore>({});
  const [pendingAttachmentIdsBySession, setPendingAttachmentIdsBySession] = useState<PendingAttachmentIdStore>({});
  const pendingAttachmentIdsRef = useRef<PendingAttachmentIdStore>({});
  const pendingAttachmentActionsRef = useRef(new AttachmentActionGate());
  const [pendingAttachmentActions, setPendingAttachmentActions] = useState<Set<string>>(new Set());
  const [agentRun, setAgentRun] = useState<AgentRun | null>(null);
  const agentRunRef = useRef<AgentRun | null>(null);
  const agentAbortRef = useRef<AbortController | null>(null);
  const agentMessageRef = useRef<{ assistantId: string; history: Array<{ role: string; content: string }>; modelId: string } | null>(null);

  const showActivation = useCallback((reason: ActivationReason, modality: 'chat' | 'image' | 'video', model?: { id: string; name: string; requiredPlan?: import('@/lib/models/plan-entitlements').ModelPlanCode | null }) => {
    if (model && (reason === 'model_locked' || reason === 'model_trial_exhausted')) {
      void trackFunnelEvent('model_locked_clicked', `${model.id}:${planCode}`, { model: model.id, modality, currentPlan: planCode, requiredPlan: model.requiredPlan ?? '', accessState: reason });
    }
    setActivationPrompt({
      reason, modality, modelId: model?.id, modelName: model?.name,
      currentPlan: planCode, requiredPlan: model?.requiredPlan,
      renewalPlanId: access?.paidPlanId, renewalPlanName: access?.paidPlanName,
    });
  }, [access?.paidPlanId, access?.paidPlanName, planCode]);

  const requestModelAccess = useCallback((modality: 'chat' | 'image' | 'video', model: ChatModelOption) => {
    showActivation('model_locked', modality, { id: model.id, name: model.name, requiredPlan: model.requiredPlan });
  }, [showActivation]);

  const entitledModels = useMemo(() => models.map((model) =>
    applyModelPlanAccess(model, planStatus === 'ready' ? planCode : 'free')),
  [models, planCode, planStatus]);
  const chatModels = useMemo(() => entitledModels.filter((model) => model.modality === 'chat'), [entitledModels]);
  const imageModels = useMemo(() => entitledModels.filter((model) => model.modality === 'image'), [entitledModels]);
  const videoModels = useMemo(() => entitledModels.filter((model) => model.modality === 'video'), [entitledModels]);
  const defaultChatModel = chatModels.find(isModelSelectable) ?? null;
  const [selectedModelId, setSelectedModelId] = useState(defaultChatModel?.id ?? '');
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [chatExchanges, setChatExchanges] = useState(0);
  const sendStartRef = useRef<number>(0);
  const [chatDebugEnabled] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('VANTRA_CHAT_DEBUG') === '1'; }
    catch { return false; }
  });
  const debugRequestIdRef = useRef<string | null>(null);
  const requestTrackerRef = useRef(new ChatRequestTracker());
  const [requestOutcome, setRequestOutcome] = useState<ChatRequestOutcome | null>(null);
  const recordRequestOutcome = useCallback((requestId: string, conversationId: string, reason: ChatTerminationReason) => {
    const outcome = requestTrackerRef.current.finish(requestId, conversationId, reason);
    if (outcome) setRequestOutcome(outcome);
  }, []);
  const debugClientCharsRef = useRef(0);
  const [canonicalPending, setCanonicalPending] = useState(false);
  const canonicalPendingRef = useRef(false);
  const activeFinalizerRef = useRef<ChatStreamFinalizer | null>(null);
  const canonicalFinalRef = useRef<{ sessionId: string | null; messageId: string; text: string } | null>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;
  const conversationId = activeSessionId ?? 'default-session';
  const conversationAttachments = getConversationAttachments(attachmentsBySession, conversationId);
  const attachmentsHydrated = Object.prototype.hasOwnProperty.call(attachmentsBySession, conversationId);
  const currentSpreadsheet = getCurrentSpreadsheetAttachment(attachmentsBySession, conversationId)?.artifact ?? null;
  useEffect(() => {
    if (Object.prototype.hasOwnProperty.call(attachmentsBySessionRef.current, conversationId)) return;
    let restored: ConversationAttachment[] = [];
    try {
      const saved = localStorage.getItem(`vantra_attachments_${conversationId}`);
      if (saved) restored = parseConversationAttachments(saved, conversationId);
    } catch { /* This conversation remains available in memory. */ }
    if (Object.prototype.hasOwnProperty.call(attachmentsBySessionRef.current, conversationId)) return;
    attachmentsBySessionRef.current = { ...attachmentsBySessionRef.current, [conversationId]: restored };
    setAttachmentsBySession(attachmentsBySessionRef.current);
  }, [conversationId]);
  const attachToConversation = useCallback((attachment: ConversationAttachmentDraft, expectedConversationId?: string) => {
    const id = expectedConversationId ?? activeSessionIdRef.current ?? 'default-session';
    if (id !== (activeSessionIdRef.current ?? 'default-session')) return null;
    setSessions((current) => current.some((session) => session.id === id) ? current
      : [{ id, title: attachment.name, createdAt: Date.now() }, ...current].slice(0, 30));
    const before = getConversationAttachments(attachmentsBySessionRef.current, id);
    const next = attachConversationFile(before, attachment, id);
    attachmentsBySessionRef.current = { ...attachmentsBySessionRef.current, [id]: next };
    setAttachmentsBySession(attachmentsBySessionRef.current);
    try { localStorage.setItem(`vantra_attachments_${id}`, JSON.stringify(next)); } catch { /* Keep in memory. */ }
    const bound = next.find((item) => item.kind === attachment.kind && ('artifact' in item && 'artifact' in attachment
      ? item.artifact.id === attachment.artifact.id
      : 'url' in item && 'url' in attachment && item.url === attachment.url)) ?? null;
    if (bound && next !== before) {
      pendingAttachmentIdsRef.current = markPendingAttachment(pendingAttachmentIdsRef.current, id, bound.attachmentId);
      setPendingAttachmentIdsBySession(pendingAttachmentIdsRef.current);
    }
    return bound;
  }, []);
  const detachFromConversation = useCallback((attachmentId: string) => {
    const id = activeSessionIdRef.current ?? 'default-session';
    const next = getConversationAttachments(attachmentsBySessionRef.current, id)
      .filter((item) => item.attachmentId !== attachmentId);
    attachmentsBySessionRef.current = { ...attachmentsBySessionRef.current, [id]: next };
    setAttachmentsBySession(attachmentsBySessionRef.current);
    pendingAttachmentIdsRef.current = removePendingAttachment(pendingAttachmentIdsRef.current, id, attachmentId);
    setPendingAttachmentIdsBySession(pendingAttachmentIdsRef.current);
    try { localStorage.setItem(`vantra_attachments_${id}`, JSON.stringify(next)); } catch { /* Keep in memory. */ }
  }, []);

  const activeModel = resolveSelectedChatModel<StudioRuntimeModelDefinition>(chatModels, selectedModelId, isModelSelectable);
  const currentModelId = activeModel?.id ?? '';

  useEffect(() => {
    if (selectedModelId !== currentModelId) setSelectedModelId(currentModelId);
  }, [selectedModelId, currentModelId]);

  useEffect(() => {
    try {
      const s = localStorage.getItem('vantra_sessions_v2');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Drop legacy empty placeholders â€” only sessions with real content survive
          const cleaned = parsed.filter((p: ChatSession) => {
            if (!p?.id) return false;
            if (!p.title || p.title.startsWith('New Chat')) {
              try {
                return !!localStorage.getItem(`vantra_chat_${p.id}`);
              } catch {
                return false;
              }
            }
            return true;
          });
          setSessions(cleaned);
          setActiveSessionId(cleaned.length > 0 ? cleaned[0].id : `draft-${Date.now()}`);
          return;
        }
      }
    } catch {}
    // First visit: a draft session keeps the composer live without polluting history
    setActiveSessionId(`draft-${Date.now()}`);
  }, []);

  // Landing → Studio bridge: prefill the composer with a stashed hero prompt
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('vantra_pending_prompt');
      if (pending) {
        sessionStorage.removeItem('vantra_pending_prompt');
        window.dispatchEvent(new CustomEvent('vantra-prefill-prompt', { detail: { prompt: pending } }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Debounced + capped: keep max 30 sessions, never block main thread per keystroke
    const t = setTimeout(() => {
      try {
        localStorage.setItem('vantra_sessions_v2', JSON.stringify(sessions.slice(0, 30)));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [sessions]);

  const {
    messages,
    setMessages,
    append,
    reload,
    isLoading,
    error,
    stop,
  } = useChat({
    id: activeSessionId || 'default-session',
    api: '/api/generate/chat',
    experimental_prepareRequestBody: ({ messages: requestMessages, requestBody }) => {
      const requestId = crypto.randomUUID();
      debugRequestIdRef.current = requestId;
      requestTrackerRef.current.begin(requestId, activeSessionId ?? 'default-session');
      setRequestOutcome(null);
      debugClientCharsRef.current = 0;
      if (chatDebugEnabled) {
        console.info('[VANTRA_CHAT_DEBUG] CLIENT_SEND', { requestId, messageCount: requestMessages.length, started: true });
      }
      return { messages: chatRequestMessages(requestMessages), ...requestBody };
    },
    fetch: async (input, init) => {
      const requestId = debugRequestIdRef.current ?? crypto.randomUUID();
      const sessionId = activeSessionId ?? 'default-session';
      const requestAction = (() => {
        try {
          const body = JSON.parse(String(init?.body)) as { requestedSlideCount?: unknown;
            messages?: Array<{ role: string; content: string }> };
          const requestedSlideCount = typeof body.requestedSlideCount === 'number' && Number.isInteger(body.requestedSlideCount)
            && body.requestedSlideCount >= 2 && body.requestedSlideCount <= 8 ? body.requestedSlideCount : null;
          const userTexts = body.messages?.filter((entry) => entry.role === 'user').map((entry) => entry.content) ?? [];
          const current = userTexts.at(-1) ?? '';
          const route = routeConversationIntent(current, userTexts.slice(0, -1));
          const selection = selectArtifactTools(current, { route });
          return { requestedSlideCount, expectedType: expectedOutputType(selection),
            expectedTool: selection.mode !== 'semantic' && selection.names.length === 1 ? selection.names[0] : undefined };
        } catch { return { requestedSlideCount: null, expectedType: null, expectedTool: undefined }; }
      })();
      const { requestedSlideCount } = requestAction;
      let nativeToolResultRequired = false;
      let streamErrorReason: 'provider_error' | 'network_error' = 'network_error';
      const finalizer = new ChatStreamFinalizer(requestId, ({ text, artifacts, status, annotations }) => {
        if (activeFinalizerRef.current !== finalizer) return;
        if ((activeSessionIdRef.current ?? 'default-session') !== sessionId) return;
        const presentation = presentationCompletion(text, artifacts, requestedSlideCount, locale);
        const action = validateRequestedChatOutput(requestAction.expectedType,
          presentation.text, presentation.artifacts, locale, requestAction.expectedTool);
        const finalArtifacts = action.parts;
        const finalText = action.text;
        const actionValid = action.valid && (!nativeToolResultRequired || !requestAction.expectedTool
          || artifacts.some((part) => partMatchesRequestedAction(part, requestAction.expectedTool!)));
        if (status === 'unverified') {
          // Server-filtered refusal, not a successful answer or a provider outage.
          // Keep its explanation and owned context available for the next turn.
          recordRequestOutcome(requestId, sessionId, 'verification_failed');
          setMessages((current) => {
            const last = current[current.length - 1];
            const assistant = last?.role === 'assistant' ? { ...last, content: text, vantraParts: [],
              ...(annotations ? { annotations } : {}), createdAt: last.createdAt ?? new Date() }
              : { id: crypto.randomUUID(), role: 'assistant' as const,
              content: text, ...(annotations ? { annotations } : {}), createdAt: new Date() };
            canonicalFinalRef.current = { sessionId, messageId: assistant.id, text };
            return last?.role === 'assistant' ? [...current.slice(0, -1), assistant] : [...current, assistant];
          });
        } else if (presentation.valid && actionValid && hasUsableCanonicalOutput(status, finalText, finalArtifacts)) {
          recordRequestOutcome(requestId, sessionId, 'completed');
          setMessages((current) => {
            if ((activeSessionIdRef.current ?? 'default-session') !== sessionId) return current;
            const last = current[current.length - 1];
            const vantraParts: ChatMessagePart[] = [
              ...(finalText ? [{ type: 'text' as const, text: finalText }] : []), ...finalArtifacts,
            ];
            if (last?.role === 'assistant') {
              canonicalFinalRef.current = { sessionId, messageId: last.id, text: finalText };
              return [...current.slice(0, -1), { ...last, createdAt: last.createdAt ?? new Date(), content: finalText,
                ...(annotations ? { annotations } : {}), ...(finalArtifacts.length > 0 ? { vantraParts } : {}) }];
            }
            if (last?.role === 'user') {
              const assistant = { id: crypto.randomUUID(), role: 'assistant' as const, createdAt: new Date(), content: finalText,
                ...(annotations ? { annotations } : {}), ...(finalArtifacts.length > 0 ? { vantraParts } : {}) };
              canonicalFinalRef.current = { sessionId, messageId: assistant.id, text: finalText };
              return [...current, assistant];
            }
            return current;
          });
        } else {
          recordRequestOutcome(requestId, sessionId, status === 'error' ? streamErrorReason : 'provider_error');
          if (!presentation.valid || !actionValid) setMessages((current) => current.map((message, index) => index === current.length - 1
            && message.role === 'assistant' ? { ...message, content: '', vantraParts: [] } : message));
        }
        activeFinalizerRef.current = null;
        canonicalPendingRef.current = false;
        setCanonicalPending(false);
      });
      activeFinalizerRef.current = finalizer;
      canonicalFinalRef.current = null;
      canonicalPendingRef.current = true;
      setCanonicalPending(true);
      const headers = new Headers(init?.headers);
      if (chatDebugEnabled) headers.set('x-vantra-chat-debug-id', requestId);
      try {
        const response = await fetch(input, { ...init, headers });
        if (!response.ok || !response.body) {
          streamErrorReason = 'provider_error';
          if (chatDebugEnabled) console.info('[VANTRA_CHAT_DEBUG] CLIENT_STREAM', {
            requestId, textChars: 0, status: 'error', errorCategory: 'http_error',
          });
          finalizer.rawDone('error');
          return response;
        }
        nativeToolResultRequired = response.headers.get('x-vantra-requires-tool-result') === '1';
        const [sdkBody, canonicalBody] = response.body.tee();
        let documentToolCalls = 0;
        let validatedDocumentResults = 0;
        let presentationToolCalls = 0;
        let validatedPresentationResults = 0;
        void consumeCanonicalChatStream(canonicalBody, (delta) => {
          finalizer.append(delta);
          debugClientCharsRef.current = finalizer.textChars;
        }, init?.signal ?? undefined, (reason) => { streamErrorReason = reason; },
        (part) => finalizer.appendArtifact(part), (event) => {
          if (event.toolName === 'create_document' && event.called) documentToolCalls++;
          if (event.toolName === 'create_document' && event.resultValidated) validatedDocumentResults++;
          if (event.toolName === 'create_presentation' && event.called) presentationToolCalls++;
          if (event.toolName === 'create_presentation' && event.resultValidated) validatedPresentationResults++;
        }, (reference) => finalizer.setSearchReference(reference), (sources) => finalizer.setWebSources(sources)).then((status) => {
          if (chatDebugEnabled) console.info('[VANTRA_CHAT_DEBUG] CLIENT_STREAM', {
            requestId, textChars: finalizer.textChars, documentToolCalls,
            validatedDocumentResults, presentationToolCalls, validatedPresentationResults,
            requestedSlideCount: requestedSlideCount ?? 0, clientArtifactPartCount: finalizer.artifactCount,
            artifactPartCount: finalizer.artifactCount, status,
            errorCategory: status === 'error' ? 'stream_error' : null,
          });
          finalizer.rawDone(status);
        });
        return new Response(sdkBody, { status: response.status, statusText: response.statusText, headers: response.headers });
      } catch (error) {
        const status = init?.signal?.aborted ? 'aborted' : 'error';
        streamErrorReason = 'network_error';
        if (chatDebugEnabled) console.info('[VANTRA_CHAT_DEBUG] CLIENT_STREAM', { requestId, textChars: finalizer.textChars,
          status, errorCategory: status === 'aborted' ? null : 'fetch_error' });
        finalizer.rawDone(status);
        throw error;
      }
    },
    onFinish: () => {
      const current = requestTrackerRef.current.current;
      if (!current || current.conversationId !== (activeSessionId ?? 'default-session')
        || current.reason === 'user_stop' || current.reason === 'navigation_abort'
        || current.reason === 'conversation_switch_abort') return;
      if (sendStartRef.current) setLastLatencyMs(performance.now() - sendStartRef.current);
      setChatExchanges((count) => count + 1);
      refreshBalance();
    },
    onError: (chatError) => {
      const current = requestTrackerRef.current.current;
      if (!current || current.conversationId !== (activeSessionId ?? 'default-session')
        || current.reason === 'user_stop' || current.reason === 'navigation_abort'
        || current.reason === 'conversation_switch_abort' || current.reason === 'completed') return;
      if (chatDebugEnabled && debugRequestIdRef.current) console.info('[VANTRA_CHAT_DEBUG] CLIENT_STREAM', {
        requestId: debugRequestIdRef.current, textChars: debugClientCharsRef.current, status: 'error', errorCategory: 'consumer_error',
      });
      // Server-side trial exhaustion surfaces here (e.g. allowance ran out
      // mid-session). Route it to the activation offer; anything else falls
      // through to the existing inline error renderer.
      try {
        const body = JSON.parse(chatError.message) as { error?: string };
        if (body.error === 'FREE_ACCESS_RESTRICTED') {
          showActivation('free_access_restricted', 'chat');
        } else if ((body.error === 'MODEL_TRIAL_EXHAUSTED' || body.error === 'MODEL_TRIAL_UNCONFIGURED') && activeModel) {
          showActivation('model_trial_exhausted', 'chat', { id: activeModel.id, name: activeModel.displayName, requiredPlan: activeModel.requiredPlan });
        }
      } catch { /* Inline renderer shows the message. */ }
    },
  });

  const retryChatResponse = useCallback(() => {
    if (!currentModelId) return;
    void reload({ body: chatModelRequestBody(currentModelId) });
  }, [currentModelId, reload]);

  const runAgentRequest = useCallback(async (run: AgentRun,
    context: { assistantId: string; history: Array<{ role: string; content: string }>; modelId: string }) => {
    const controller = new AbortController();
    agentAbortRef.current = controller;
    const bound = run.attachmentId
      ? getConversationAttachment(attachmentsBySessionRef.current, run.conversationId, run.attachmentId)
      : getCurrentSpreadsheetAttachment(attachmentsBySessionRef.current, run.conversationId);
    const spreadsheet = bound?.kind === 'spreadsheet' ? bound.artifact : null;
    const result = await executeAgentRun(run, spreadsheet, {
      operationId: () => crypto.randomUUID(), signal: controller.signal,
      semantic: async (stage, prompt, operationId, toolBudget, signal, options) => {
        const output = await executeAgentSemanticStep({ stage, prompt, model: context.modelId,
          history: context.history, operationId, toolBudget, signal, debug: chatDebugEnabled,
          requestedSlideCount: options?.requestedSlideCount });
        refreshBalance();
        return output;
      },
      onUpdate: (state) => {
        if (!isCurrentAgentUpdate(state, agentRunRef.current)
          || (activeSessionIdRef.current ?? 'default-session') !== state.conversationId) return;
        if (chatDebugEnabled) console.info('[VANTRA_CHAT_DEBUG] AGENT_STEP', {
          requestId: state.requestId, agentRunId: state.agentRunId,
          currentStep: state.currentStep, status: state.status,
          chartArtifactCount: state.artifacts.filter((part) => part.type === 'chart').length,
          presentationArtifactCount: state.artifacts.filter((part) => part.type === 'presentation').length,
          analysisResultValidated: Boolean(state.analysis),
          chartPlanCount: state.analysis?.chartPlans.length ?? 0,
          distinctChartPlanCount: distinctAgentChartPlans(state.analysis?.chartPlans ?? []).length,
          requestedSlideCount: state.task.slideCount,
          actualSlideCount: state.artifacts.find((part) => part.type === 'presentation')?.artifact.slides.length ?? 0,
          presentationStepStatus: state.completedSteps.includes('presentation') ? 'completed'
            : state.failedStep === 'presentation' ? 'failed'
              : state.currentStep === 'presentation' ? 'running' : 'pending',
          toolCallCount: state.toolCallCount, semanticCallCount: state.semanticCallCount,
        });
        agentRunRef.current = state;
        setAgentRun(state);
        const vantraParts: ChatMessagePart[] = [...state.artifacts];
        setMessages((current) => current.map((message) => message.id === context.assistantId
          ? { ...message, content: '', vantraParts } : message));
      },
    });
    if (agentAbortRef.current === controller) agentAbortRef.current = null;
    return result;
  }, [refreshBalance, setMessages, chatDebugEnabled]);

  useEffect(() => {
    const run = agentRunRef.current;
    const context = agentMessageRef.current;
    if (run?.status === 'waiting_for_user' && currentSpreadsheet && context
      && run.conversationId === (activeSessionId ?? 'default-session')) {
      void runAgentRequest({ ...run, attachmentId: getCurrentSpreadsheetAttachment(attachmentsBySessionRef.current,
        run.conversationId)?.attachmentId ?? null }, context);
    }
  }, [currentSpreadsheet, activeSessionId, runAgentRequest]);

  useEffect(() => {
    const run = agentRunRef.current;
    const context = agentMessageRef.current;
    if (currentModelId && run?.status === 'failed' && run.terminalError === 'switch_model' && context
      && context.modelId !== currentModelId && run.conversationId === (activeSessionId ?? 'default-session')) {
      context.modelId = currentModelId;
      void runAgentRequest(run, context);
    }
  }, [currentModelId, activeSessionId, currentSpreadsheet, runAgentRequest]);

  const abortAgentRun = useCallback(() => {
    const run = agentRunRef.current;
    if (!run || (run.status !== 'running' && run.status !== 'waiting_for_user')) return;
    agentAbortRef.current?.abort();
    const cancelled = cancelAgentRun(run);
    agentRunRef.current = cancelled;
    setAgentRun(cancelled);
  }, []);

  const chatBusy = isLoading || canonicalPending || agentRun?.status === 'running';
  // Presentation only: use the shared decision while required retrieval is
  // awaiting response headers. Actual source progress comes from the server.
  const awaitingSearch = chatBusy && messages.at(-1)?.role === 'user'
    && decideWebSearchWithHistory(messages.at(-1)!.content, messages.slice(0, -1)).decision.path === 'required';
  const wasSdkLoadingRef = useRef(false);
  useEffect(() => {
    if (wasSdkLoadingRef.current && !isLoading) activeFinalizerRef.current?.consumerDone();
    wasSdkLoadingRef.current = isLoading;
  }, [isLoading]);
  const discardFinalization = useCallback(() => {
    activeFinalizerRef.current?.invalidate();
    activeFinalizerRef.current = null;
    canonicalFinalRef.current = null;
    canonicalPendingRef.current = false;
    setCanonicalPending(false);
  }, []);
  const abortChatRequest = useCallback((reason: 'user_stop' | 'navigation_abort' | 'conversation_switch_abort') => {
    const agent = agentRunRef.current;
    if (agent && (agent.status === 'running' || agent.status === 'waiting_for_user')
      && agent.conversationId === (activeSessionIdRef.current ?? 'default-session') && messages.length > 0) {
      try { localStorage.setItem(`vantra_chat_${agent.conversationId}`, serializeChatSession(messages,
        (message) => chatPartsFromMessage(message.content, locale,
          (message as typeof message & { vantraParts?: unknown }).vantraParts))); } catch { /* Keep in-memory results. */ }
    }
    abortAgentRun();
    const current = requestTrackerRef.current.current;
    if (!current || current.reason) return;
    if (activeSessionIdRef.current === current.conversationId && messages.length > 0) {
      try {
        localStorage.setItem(`vantra_chat_${current.conversationId}`, serializeChatSession(messages,
          (message) => chatPartsFromMessage(message.content, locale,
            (message as typeof message & { vantraParts?: unknown }).vantraParts)));
      } catch { /* Keep the in-memory partial message if storage is unavailable. */ }
    }
    recordRequestOutcome(current.requestId, current.conversationId, reason);
    discardFinalization();
    stop();
  }, [abortAgentRun, discardFinalization, locale, messages, recordRequestOutcome, stop]);
  const abortOnUnmountRef = useRef(abortChatRequest);
  abortOnUnmountRef.current = abortChatRequest;
  useEffect(() => {
    if (activeWorkspace !== 'chat') abortChatRequest('navigation_abort');
  }, [activeWorkspace, abortChatRequest]);
  useEffect(() => () => abortOnUnmountRef.current('navigation_abort'), []);

  useEffect(() => {
    const final = canonicalFinalRef.current;
    if (!final || final.sessionId !== activeSessionId) return;
    const current = messages.find((message) => message.id === final.messageId);
    if (current?.role === 'assistant' && current.content !== final.text) {
      setMessages((latest) => restoreCanonicalAssistantText(latest, final.messageId, final.text));
    }
  }, [messages, activeSessionId, setMessages]);

  const handleNewChat = useCallback(() => {
    // Abort any active text stream
    abortChatRequest('conversation_switch_abort');
    agentRunRef.current = null; agentMessageRef.current = null; setAgentRun(null); setPendingFile(null);
    // Lazy creation: no DB/list record yet â€” just a draft id so the composer stays live.
    setActiveSessionId(`draft-${Date.now()}`);
    setMessages([]);
    onWorkspaceChange('chat');
  }, [abortChatRequest, onWorkspaceChange, setMessages]);

  const handleSelectSession = useCallback((sessionId: string) => {
    abortChatRequest('conversation_switch_abort');
    agentRunRef.current = null; agentMessageRef.current = null; setAgentRun(null); setPendingFile(null);
    setActiveSessionId(sessionId);
    onWorkspaceChange('chat');
  }, [abortChatRequest, onWorkspaceChange]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    if (sessionId === activeSessionId) abortChatRequest('conversation_switch_abort');
    if (sessionId === activeSessionId) { agentRunRef.current = null; agentMessageRef.current = null; setAgentRun(null); setPendingFile(null); }
    try {
      localStorage.removeItem(`vantra_chat_${sessionId}`);
      localStorage.removeItem(`vantra_attachments_${sessionId}`);
    } catch {}
    setAttachmentsBySession((current) => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    const pending = { ...pendingAttachmentIdsRef.current };
    delete pending[sessionId];
    pendingAttachmentIdsRef.current = pending;
    setPendingAttachmentIdsBySession(pending);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (sessionId === activeSessionId) {
        // Move to the newest remaining session, or start a clean draft
        setActiveSessionId(next.length > 0 ? next[0].id : `draft-${Date.now()}`);
      }
      return next;
    });
  }, [activeSessionId, abortChatRequest]);

  // Persistence per session
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`vantra_chat_${activeSessionId}`);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch {
      setMessages([]);
    }
  }, [activeSessionId, setMessages]);

  useEffect(() => {
    if (!activeSessionId || chatBusy) return;
    // Persist the complete current conversation, including every earlier turn.
    const t = setTimeout(() => {
      try {
        if (messages.length > 0) {
          localStorage.setItem(`vantra_chat_${activeSessionId}`, serializeChatSession(messages,
            (message) => chatPartsFromMessage(message.content, locale,
              (message as typeof message & { vantraParts?: unknown }).vantraParts)));
        } else {
          localStorage.removeItem(`vantra_chat_${activeSessionId}`);
        }
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [messages, activeSessionId, chatBusy, locale]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const previousChatLoadingRef = useRef(false);
  useEffect(() => {
    const wasLoading = previousChatLoadingRef.current;
    previousChatLoadingRef.current = chatBusy;
    if (!chatDebugEnabled || !wasLoading || chatBusy || !debugRequestIdRef.current) return;
    const requestId = debugRequestIdRef.current;
    requestAnimationFrame(() => {
      const last = messages[messages.length - 1];
      const storedTextChars = last?.role === 'assistant' ? last.content.length : 0;
      const renderedTextChars = Array.from(transcriptRef.current?.querySelectorAll('[data-chat-debug-latest-assistant] [data-chat-rendered-text]') ?? [])
        .reduce((total, element) => total + (element.textContent?.length ?? 0)
          - Array.from(element.querySelectorAll('button')).reduce((controls, button) => controls + (button.textContent?.length ?? 0), 0), 0);
      console.info('[VANTRA_CHAT_DEBUG] FINAL_UI', { requestId, storedAssistantTextChars: storedTextChars, renderedAssistantTextChars: renderedTextChars });
    });
  }, [chatDebugEnabled, chatBusy, messages]);
  const composerRef = useRef<HTMLDivElement>(null);
  const followLatestRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const pendingSendRef = useRef(false);
  const [composerPadding, setComposerPadding] = useState(176);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const updateScrollButton = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollButton(!followLatestRef.current && distance > BOTTOM_THRESHOLD);
  }, []);

  const scrollToLatest = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    followLatestRef.current = true;
    setShowScrollButton(false);
    container.scrollTop = container.scrollHeight - container.clientHeight;
    lastScrollTopRef.current = container.scrollTop;
  }, []);

  const scheduleFollow = useCallback(() => {
    if (!followLatestRef.current || scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      if (followLatestRef.current) scrollToLatest();
    });
  }, [scrollToLatest]);

  const stopFollowing = useCallback(() => {
    followLatestRef.current = false;
    updateScrollButton();
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
  }, [updateScrollButton]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const movedUp = container.scrollTop < lastScrollTopRef.current - 1;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distance <= BOTTOM_THRESHOLD) {
      followLatestRef.current = true;
    } else if (movedUp) {
      stopFollowing();
    }
    lastScrollTopRef.current = container.scrollTop;
    updateScrollButton();
  }, [stopFollowing, updateScrollButton]);

  useLayoutEffect(() => {
    const transcript = transcriptRef.current;
    const composer = composerRef.current;
    if (!transcript || !composer) return;
    setComposerPadding(Math.ceil(composer.getBoundingClientRect().height) + 24);
    const observer = new ResizeObserver((entries) => {
      if (entries.some((entry) => entry.target === composer)) {
        setComposerPadding(Math.ceil(composer.getBoundingClientRect().height) + 24);
      }
      updateScrollButton();
      scheduleFollow();
    });
    observer.observe(transcript);
    observer.observe(composer);
    return () => {
      observer.disconnect();
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    };
  }, [activeWorkspace, scheduleFollow, updateScrollButton]);

  useLayoutEffect(() => {
    if (pendingSendRef.current && messages[messages.length - 1]?.role === 'user') {
      pendingSendRef.current = false;
      scrollToLatest();
    } else {
      scheduleFollow();
    }
  }, [messages, scrollToLatest, scheduleFollow]);

  useLayoutEffect(() => {
    scheduleFollow();
  }, [composerPadding, scheduleFollow]);

  useEffect(() => {
    followLatestRef.current = true;
    setShowScrollButton(false);
    scheduleFollow();
  }, [activeSessionId, scheduleFollow]);

  const handleSend = useCallback(
    async (data: { message: string; isThinkingEnabled: boolean; files?: Array<{ file: File; preview?: string | null; type: string }>; attachmentId?: string }) => {
      if (canonicalPendingRef.current || agentRunRef.current?.status === 'running') return;
      if (!activeModel || !isModelSelectable(activeModel)) return;
      if (access?.kind !== 'paid_active' && access?.freeEligibility && !['eligible', 'manually_approved'].includes(access.freeEligibility)) {
        showActivation('free_access_restricted', 'chat');
        return;
      }
      if (activeModel.accessState === 'locked') {
        showActivation('model_locked', 'chat', { id: activeModel.id, name: activeModel.displayName, requiredPlan: activeModel.requiredPlan });
        return;
      }
      if (activeModel.accessState === 'trial' && activeModel.trialAllowance == null) {
        showActivation('model_trial_exhausted', 'chat', { id: activeModel.id, name: activeModel.displayName, requiredPlan: activeModel.requiredPlan });
        return;
      }
      if (!user && (activeModel.verifiedCreditCost ?? 0) > 0) {
        openAuthModal('signin');
        return;
      }
      let content = data.message;
      const sendConversationId = activeSessionIdRef.current ?? 'default-session';
      const pendingAttachmentIds = pendingAttachmentIdsRef.current[sendConversationId] ?? [];
      const sendAttachments = getConversationAttachments(attachmentsBySessionRef.current, sendConversationId);
      const routedIntent = routeConversationIntent(data.message,
        messages.filter((entry) => entry.role === 'user').map((entry) => entry.content), sendAttachments, data.attachmentId);
      if (routedIntent.confidence === 'high' && !data.files?.length
        && (routedIntent.resourceStatus === 'missing' || routedIntent.resourceStatus === 'ambiguous')) return;
      const resolvedId = data.attachmentId ?? routedIntent.attachmentId ?? undefined;
      const resolvedAttachment = data.attachmentId
        ? getConversationAttachment(attachmentsBySessionRef.current, sendConversationId, data.attachmentId)
        : resolvedId ? getConversationAttachment(attachmentsBySessionRef.current, sendConversationId, resolvedId)
          : resolveSpreadsheetAttachment(attachmentsBySessionRef.current, sendConversationId).attachment;
      if (data.attachmentId && !resolvedAttachment) return;
      const boundSpreadsheet = resolvedAttachment?.kind === 'spreadsheet' ? resolvedAttachment : null;
      const agentRequested = Boolean(agentTaskFor(data.message, Boolean(boundSpreadsheet)));
      if (chatDebugEnabled) console.info('[VANTRA_CHAT_DEBUG] FILE_CONTEXT', {
        conversationId: sendConversationId, attachmentFound: Boolean(boundSpreadsheet),
        attachmentIdPresent: Boolean(boundSpreadsheet?.attachmentId), agentStarted: agentRequested,
      });
      if (data.isThinkingEnabled && !agentRequested) {
        content = `Think through this step-by-step with careful reasoning before answering.\n\n${content}`;
      }

      // Convert attachments for experimental_attachments
      const capabilities = activeModel.capabilities;
      const attachments = [...sendAttachments.filter((item): item is Extract<ConversationAttachment, { kind: 'file' | 'image' }> =>
        pendingAttachmentIds.includes(item.attachmentId) && (item.kind === 'file' || item.kind === 'image')).map((item) => ({
        name: item.name, contentType: item.contentType, url: item.url,
      })), ...(data.files || []).filter((f) => f.type.startsWith('image/')
        ? ('visionInput' in capabilities && capabilities.visionInput)
        : ('fileInput' in capabilities && capabilities.fileInput)).map((f) => ({
        name: f.file?.name || 'attachment',
        contentType: f.type,
        url: f.preview || '',
      }))];

      // Lazy session creation: the record is materialised only on the first prompt
      const derivedTitle = (() => {
        const t = content.replace(/\[Attachment:[^\]]*\]/g, '').trim();
        return t.length > 42 ? `${t.slice(0, 42).trimEnd()}…` : t || 'New Chat';
      })();

      if (activeSessionId) {
        const exists = sessions.some((s) => s.id === activeSessionId);
        if (!exists) {
          setSessions((prev) =>
            [{ id: activeSessionId, title: derivedTitle, createdAt: Date.now() }, ...prev].slice(0, 30)
          );
        } else {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId && s.title.startsWith('New Chat')
                ? { ...s, title: derivedTitle }
                : s
            )
          );
        }
      }
      sendStartRef.current = performance.now();
      pendingSendRef.current = true;
      pendingAttachmentIdsRef.current = clearPendingAttachments(pendingAttachmentIdsRef.current, sendConversationId);
      setPendingAttachmentIdsBySession(pendingAttachmentIdsRef.current);
      const priorAssistant = [...messages].reverse().find((entry) => entry.role === 'assistant');
      const priorParts = priorAssistant ? chatPartsFromMessage(priorAssistant.content, locale,
        (priorAssistant as Message & { vantraParts?: unknown }).vantraParts) : [];
      const existingOutput = routedIntent.confidence === 'high'
        ? deterministicContextOutput(routedIntent.intent, data.message, boundSpreadsheet?.artifact ?? null, priorParts) : null;
      if (existingOutput) {
        pendingSendRef.current = false;
        setMessages((current) => [...current,
          { id: crypto.randomUUID(), role: 'user' as const, createdAt: new Date(),
            vantraAttachmentIds: pendingAttachmentIds, content: data.message },
          { id: crypto.randomUUID(), role: 'assistant' as const, createdAt: new Date(), content: '',
            vantraParts: [existingOutput] },
        ]);
        return;
      }
      if (boundSpreadsheet && isSingleSpreadsheetChartRequest(data.message)) {
        const chart = chartFromSpreadsheetAttachment(boundSpreadsheet);
        const answer = chart ? { id: crypto.randomUUID(), role: 'assistant' as const, content: '',
          vantraParts: [{ type: 'chart' as const, artifact: chart }] }
          : { id: crypto.randomUUID(), role: 'assistant' as const,
            content: locale === 'ar' ? 'اختر أعمدة واضحة للتصنيف والقيمة لإنشاء الرسم البياني.'
              : locale === 'fr' ? 'Choisissez une colonne de catégorie et une mesure pour créer le graphique.'
                : 'Choose a category and a value column to create a useful chart.' };
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user' as const,
          createdAt: new Date(), vantraAttachmentIds: pendingAttachmentIds, content: data.message },
          { ...answer, createdAt: new Date(), ...(chart ? {} : { vantraFailureKind: 'chart',
            vantraAttachmentId: boundSpreadsheet.attachmentId }) }]);
        return;
      }
      if (agentRequested) {
        const conversationId = sendConversationId;
        const run = createAgentRun(data.message, conversationId, crypto.randomUUID(), Boolean(boundSpreadsheet),
          boundSpreadsheet?.attachmentId ?? null);
        if (!run) return;
        const userMessage = { id: crypto.randomUUID(), role: 'user' as const, createdAt: new Date(),
          vantraAttachmentIds: pendingAttachmentIds, content };
        const assistantId = crypto.randomUUID();
        const context = { assistantId, history: chatRequestMessages([...messages, userMessage]), modelId: currentModelId };
        agentRunRef.current = run;
        agentMessageRef.current = context;
        setAgentRun(run);
        setMessages((current) => [...current, userMessage, { id: assistantId, role: 'assistant' as const,
          createdAt: new Date(), content: '' }]);
        await runAgentRequest(run, context);
        return;
      }
      await append(
        {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          experimental_attachments: attachments.length > 0 ? (attachments as any) : undefined,
          createdAt: new Date(), vantraAttachmentIds: pendingAttachmentIds,
        } as Message,
        {
          body: {
            ...chatModelRequestBody(currentModelId),
            ...attachmentRequestContext(sendAttachments, boundSpreadsheet?.artifact,
              resolvedAttachment?.kind === 'document' ? resolvedAttachment.artifact : undefined),
            requestedSlideCount: requestedPresentationSlideCount(data.message),
          },
        }
      );
    },
    [append, currentModelId, activeSessionId, sessions, activeModel, user, openAuthModal, access?.kind, showActivation,
      messages, locale, runAgentRequest, setMessages, chatDebugEnabled]
  );

  const handleChatGuidanceAction = (action: GuidanceAction) => {
    if (action === 'open_connected_apps') {
      setSettingsInitialTab('apps');
      setSettingsOpen(true);
      return;
    }
    if (currentModelId && (action === 'try_again' || action === 'try_chart_again' || action === 'try_presentation_again')
      && agentRunRef.current?.status === 'failed' && agentMessageRef.current) {
      void runAgentRequest(agentRunRef.current,
        { ...agentMessageRef.current, modelId: currentModelId });
      return;
    }
    if (action === 'switch_model' && agentRunRef.current?.terminalError === 'switch_model') {
      setSettingsOpen(true);
      return;
    }
    if (action === 'add_credits') openTopUpModal();
    else if ((action === 'get_pro' || action === 'view_plans') && activeModel) showActivation('model_locked', 'chat', {
      id: activeModel.id, name: activeModel.displayName, requiredPlan: activeModel.requiredPlan,
    });
    else if (action === 'try_again' || action === 'try_chart_again' || action === 'try_presentation_again'
      || action === 'try_document_again' || action === 'try_file_again') retryChatResponse();
    else if (action === 'choose_file') {
      document.querySelector<HTMLInputElement>('[data-chat-file-input]')?.click();
    }
    else if (action === 'upload_file' || action === 'upload_document' || action === 'upload_image' || action === 'upload_spreadsheet') document.querySelector<HTMLInputElement>('[data-chat-file-input]')?.click();
    else if (action === 'switch_model') {
      const lastUser = [...messages].reverse().find((message) => message.role === 'user');
      const attachments = (lastUser as typeof lastUser & { experimental_attachments?: Array<{ contentType?: string }> } | undefined)?.experimental_attachments ?? [];
      const needsImage = attachments.some((file) => file.contentType?.startsWith('image/'));
      const needsFile = attachments.some((file) => file.contentType && !file.contentType.startsWith('image/'));
      const candidate = chatModels.find((model) => model.id !== currentModelId && isModelSelectable(model)
        && (!needsImage || 'visionInput' in model.capabilities && model.capabilities.visionInput)
        && (!needsFile || 'fileInput' in model.capabilities && model.capabilities.fileInput));
      if (candidate) setSelectedModelId(candidate.id);
    }
  };

  const handleStarter = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent('vantra-prefill-prompt', { detail: { prompt: text } }));
  }, []);

  const handleImageGenerate = useCallback(async (draft: ImageRequestDraft): Promise<ImageGenerationResult> => {
    if (!user) {
      openAuthModal('signin');
      throw new Error('AUTHENTICATION_REQUIRED');
    }
    const response = await fetch('/api/generate/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: draft.prompt,
        modelId: draft.modelId,
        aspectRatio: draft.aspectRatio,
        outputCount: draft.outputCount ?? 1,
        operationId: crypto.randomUUID(),
      }),
    });
    const payload = await response.json().catch(() => null) as {
      error?: string;
      image?: { src?: string; mimeType?: string };
      creditsCharged?: number;
      libraryAssetId?: string;
      requiredPlan?: import('@/lib/models/plan-entitlements').ModelPlanCode | null;
    } | null;
    if (!response.ok || !payload?.image?.src || !payload.libraryAssetId) {
      const code = payload?.error;
      if (code === 'FREE_ACCESS_RESTRICTED') showActivation('free_access_restricted', 'image');
      else if (code === 'FREE_MEDIA_EXPIRED') showActivation('free_media_expired', 'image');
      else if (code === 'FREE_IMAGE_TRIAL_EXHAUSTED') showActivation('image_allowance_exhausted', 'image');
      else if (code === 'PAID_PLAN_REACTIVATION_REQUIRED') showActivation('paid_lapsed', 'image');
      else if (code === 'MODEL_TRIAL_EXHAUSTED' || code === 'MODEL_TRIAL_UNCONFIGURED') showActivation('model_trial_exhausted', 'image', { id: draft.modelId, name: imageModels.find((item) => item.id === draft.modelId)?.displayName ?? draft.modelId, requiredPlan: payload?.requiredPlan });
      else if (code === 'MODEL_PLAN_ACCESS_REQUIRED') showActivation('model_locked', 'image', { id: draft.modelId, name: imageModels.find((item) => item.id === draft.modelId)?.displayName ?? draft.modelId, requiredPlan: payload?.requiredPlan });
      if (/FREE_ACCESS_RESTRICTED|FREE_MEDIA_EXPIRED|FREE_IMAGE_TRIAL_EXHAUSTED|PAID_PLAN_REACTIVATION_REQUIRED|MODEL_TRIAL_|MODEL_PLAN_ACCESS_REQUIRED/.test(code ?? '')) throw new Error('ACCESS_PROMPTED');
      throw new Error(payload?.error ?? 'IMAGE_GENERATION_FAILED');
    }
    await refreshBalance();
    return {
      src: payload.image.src,
      mimeType: payload.image.mimeType ?? 'image/png',
      creditsCharged: payload.creditsCharged ?? 0,
      libraryAssetId: payload.libraryAssetId,
    };
  }, [imageModels, openAuthModal, refreshBalance, showActivation, user]);

  const handleVideoGenerate = useCallback(async (draft: VideoRequestDraft): Promise<VideoGenerationResult> => {
    if (!user) {
      openAuthModal('signin');
      throw new Error('AUTHENTICATION_REQUIRED');
    }
    const operationId = crypto.randomUUID();
    let body: BodyInit;
    let headers: HeadersInit | undefined;
    if (draft.sourceMode === 'image' && draft.sourceImage) {
      const form = new FormData();
      form.set('prompt', draft.prompt);
      form.set('modelId', draft.modelId);
      form.set('sourceMode', 'image');
      form.set('duration', String(draft.duration));
      form.set('resolution', draft.resolution);
      form.set('mode', draft.mode);
      form.set('operationId', operationId);
      form.set('sourceImage', draft.sourceImage);
      if (draft.endImage) form.set('endImage', draft.endImage);
      body = form;
    } else {
      headers = { 'Content-Type': 'application/json' };
      body = JSON.stringify({
        prompt: draft.prompt,
        modelId: draft.modelId,
        duration: draft.duration,
        aspectRatio: draft.aspectRatio,
        resolution: draft.resolution,
        mode: draft.mode,
        operationId,
      });
    }
    const response = await fetch('/api/generate/video', {
      method: 'POST',
      headers,
      body,
    });
    const payload = await response.json().catch(() => null) as {
      error?: string;
      video?: { src?: string; mimeType?: string };
      creditsCharged?: number;
      libraryAssetId?: string;
      requiredPlan?: import('@/lib/models/plan-entitlements').ModelPlanCode | null;
    } | null;
    if (!response.ok || !payload?.video?.src || !payload.libraryAssetId) {
      const code = payload?.error;
      if (code === 'FREE_ACCESS_RESTRICTED') showActivation('free_access_restricted', 'video');
      else if (code === 'FREE_MEDIA_EXPIRED') showActivation('free_media_expired', 'video');
      else if (code === 'FREE_VIDEO_TRIAL_EXHAUSTED') showActivation('video_allowance_exhausted', 'video');
      else if (code === 'FREE_VIDEO_DURATION_LIMIT') showActivation('video_duration_limit', 'video');
      else if (code === 'LITE_VIDEO_DURATION_LIMIT') showActivation('lite_video_duration_limit', 'video');
      else if (code === 'PAID_PLAN_REACTIVATION_REQUIRED') showActivation('paid_lapsed', 'video');
      else if (code === 'MODEL_TRIAL_EXHAUSTED' || code === 'MODEL_TRIAL_UNCONFIGURED') showActivation('model_trial_exhausted', 'video', { id: draft.modelId, name: videoModels.find((item) => item.id === draft.modelId)?.displayName ?? draft.modelId, requiredPlan: payload?.requiredPlan });
      else if (code === 'MODEL_PLAN_ACCESS_REQUIRED') showActivation('model_locked', 'video', { id: draft.modelId, name: videoModels.find((item) => item.id === draft.modelId)?.displayName ?? draft.modelId, requiredPlan: payload?.requiredPlan });
      if (/FREE_ACCESS_RESTRICTED|FREE_MEDIA_EXPIRED|FREE_VIDEO_TRIAL_EXHAUSTED|FREE_VIDEO_DURATION_LIMIT|LITE_VIDEO_DURATION_LIMIT|PAID_PLAN_REACTIVATION_REQUIRED|MODEL_TRIAL_|MODEL_PLAN_ACCESS_REQUIRED/.test(code ?? '')) throw new Error('ACCESS_PROMPTED');
      throw new Error(payload?.error ?? 'VIDEO_GENERATION_FAILED');
    }
    await refreshBalance();
    return {
      src: payload.video.src,
      mimeType: payload.video.mimeType ?? 'video/mp4',
      creditsCharged: payload.creditsCharged ?? 0,
      libraryAssetId: payload.libraryAssetId,
    };
  }, [openAuthModal, refreshBalance, showActivation, user, videoModels]);

  const totalTokens = useMemo(
    () => Math.ceil(messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 4),
    [messages]
  );

  function content_title(text: string) {
    return text.length > 42 ? `${text.slice(0, 42).trimEnd()}…` : text || 'New Chat';
  }

  const isEmpty = messages.length === 0;
  const lastUserPrompt = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const requestedArtifact = selectArtifactTools(lastUserPrompt, { route: routeConversationIntent(lastUserPrompt,
    messages.filter((entry) => entry.role === 'user').slice(0, -1).map((entry) => entry.content)) }).names[0];
  const artifactRetryAction: GuidanceAction = requestedArtifact === 'create_chart' ? 'try_chart_again'
    : requestedArtifact === 'create_presentation' ? 'try_presentation_again'
      : requestedArtifact === 'create_document' ? 'try_document_again'
        : requestedArtifact?.endsWith('_file') ? 'try_file_again' : 'try_again';

  return (
    <div className="studio-shell relative flex h-[100dvh] w-full overflow-hidden bg-[var(--studio-bg)] text-white font-sans">
      {/* Sidebar */}
      <DashboardSidebar
        activeWorkspace={activeWorkspace}
        onNewChat={handleNewChat}
        sessions={sessions.map((s) => ({ id: s.id, title: s.title }))}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={() => setSettingsOpen(true)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Workspace — absolute black + bottom glow behind all content */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-[var(--studio-canvas)]">
        {/* Bottom glow — restricted to bottom half, pure white 3% */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.03)_0%,transparent_100%)] pointer-events-none z-0" aria-hidden="true" />

        {/* Renewal reminder for expiring paid plans (dismissible, all workspaces) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-16 pt-3 lg:px-6">
          <RenewalBanner planCode={planStatus === 'ready' ? planCode : 'free'} planEndsAt={planEndsAt} onRenew={() => openTopUpModal()} />
        </div>

        {/* Mobile Navigation Trigger */}
        <button
          type="button"
          onClick={() => setIsMobileNavOpen(true)}
          aria-label={sidebarT('openNavigation')}
          aria-expanded={isMobileNavOpen}
          className="lg:hidden absolute top-3.5 start-4 z-40 p-2 rounded-xl bg-[var(--studio-popover)] border border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-primary)] transition-[color,background-color,transform] duration-150 active:scale-95 cursor-pointer shadow-lg motion-reduce:transition-none"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Center content */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
          <>
            {/* ── Chat Studio ── */}
            {activeWorkspace === 'chat' && (
              <motion.div
                key="chat"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }}
                className="absolute inset-0 flex flex-col min-h-0 overflow-hidden"
              >
                {/* Scrollable Message Timeline Area */}
                <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                  <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    tabIndex={0}
                    className="chat-scrollbar flex-1 h-full overflow-y-auto focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/30"
                    style={{ overflowAnchor: 'none', paddingBottom: composerPadding }}
                  >
                    <div ref={transcriptRef} className={cn(
                      'w-full flex justify-center transition-[min-height,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                      isEmpty ? 'min-h-full items-center py-6' : 'pt-6'
                    )}>
                      <div className="mx-auto flex w-full max-w-4xl flex-col gap-y-5 px-4 sm:px-6">
                        {/* Empty State: Headline & Magic Skills Cards (Animated Exit) */}
                        <AnimatePresence>
                          {isEmpty && (
                            <motion.div
                              key="empty-state-content"
                              initial={{ opacity: 1, height: 'auto', scale: 1 }}
                              exit={{
                                opacity: 0,
                                height: 0,
                                scale: 0.95,
                                marginBottom: 0,
                                transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] }
                              }}
                              className="w-full flex flex-col items-center text-center overflow-hidden"
                            >
                              {/* 1st (Top): Headline */}
                              <motion.h2
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: reduceMotion ? 0 : 0.16 }}
                                className="mb-5 text-xl font-medium tracking-tight text-white/90 sm:text-2xl"
                              >
                                {t('emptyTitle')}
                              </motion.h2>

                              {/* 2nd (Middle): Magic Skills Grid */}
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: reduceMotion ? 0 : 0.16 }}
                                className="mb-5 grid w-full grid-cols-1 gap-3 text-start sm:grid-cols-2"
                              >
                                {MAGIC_SKILLS.map((skill) => {
                                  const Icon = skill.icon;
                                  return (
                                    <button
                                      key={skill.key}
                                      type="button"
                                      onClick={() => handleStarter(t(`starters.${skill.key}.prompt`))}
                                      className="group flex min-h-24 cursor-pointer flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-start text-sm text-white/70 transition-[color,background-color,border-color,transform] duration-150 hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <div className="h-7 w-7 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/90 shrink-0 group-hover:border-white/20 transition-colors">
                                          <Icon className="h-3.5 w-3.5" />
                                        </div>
                                        <span className="font-medium text-white/90">{t(`starters.${skill.key}.title`)}</span>
                                      </div>
                                      <p className="text-[12.5px] text-white/55 leading-relaxed font-normal">
                                        {t(`starters.${skill.key}.description`)}
                                      </p>
                                    </button>
                                  );
                                })}
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Messages Timeline Feed */}
                        {messages.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }}
                            className="flex flex-col gap-y-5 w-full"
                          >
                            {messages.map((msg, idx) => (
                              <MessageBubble
                                key={msg.id || idx}
                                message={msg}
                                sentAttachments={msg.role === 'user' ? sentMessageAttachments(attachmentsBySession,
                                  conversationId, (msg as Message & { vantraAttachmentIds?: unknown }).vantraAttachmentIds) : []}
                                agentRun={msg.role === 'assistant' && msg.id === agentMessageRef.current?.assistantId
                                  && agentRun?.conversationId === (activeSessionId ?? 'default-session') ? agentRun : null}
                                onStopAgent={() => abortChatRequest('user_stop')}
                                precedingUserMessage={msg.role === 'assistant'
                                  ? [...messages.slice(0, idx)].reverse().find((entry) => entry.role === 'user') ?? null : null}
                                isLatest={idx === messages.length - 1}
                                isStreaming={(isLoading || canonicalPending) && idx === messages.length - 1 && msg.role === 'assistant'}
                                onRegenerate={chatBusy || !currentModelId || !canRegenerateAssistantMessage(msg,
                                  msg.id === agentMessageRef.current?.assistantId) ? undefined : retryChatResponse}
                                onRetryArtifact={() => {
                                  if (chatBusy || (activeSessionIdRef.current ?? 'default-session') !== conversationId) return;
                                  const failure = msg as Message & { vantraFailureKind?: string; vantraAttachmentId?: string };
                                  if (failure.vantraFailureKind !== 'chart' || !failure.vantraAttachmentId) return;
                                  const attachment = getConversationAttachment(attachmentsBySessionRef.current,
                                    conversationId, failure.vantraAttachmentId);
                                  const chart = chartFromSpreadsheetAttachment(attachment);
                                  if (!chart) return;
                                  setMessages((current) => (activeSessionIdRef.current ?? 'default-session') !== conversationId
                                    ? current : current.map((entry) => entry.id === msg.id
                                    ? { ...entry, content: '', vantraParts: [{ type: 'chart' as const, artifact: chart }],
                                      vantraFailureKind: undefined } : entry));
                                }}
                                onRequestPrompt={(prompt, artifact, context) => {
                                  const attached = artifact ? attachToConversation({ kind: 'spreadsheet',
                                    name: `${artifact.title}.xlsx`, artifact }) : null;
                                  void handleSend({ message: prompt, isThinkingEnabled: false,
                                    attachmentId: attached?.attachmentId });
                                }}
                              />
                            ))}
                          </motion.div>
                        )}

                        {/* Loading / Thinking */}
                        {chatBusy && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                          <div className="flex items-center gap-2.5 py-1 text-[13.5px] text-white/60 animate-pulse" role="status" aria-live="polite">
                            <div className="ai-avatar-ring h-6 w-6 rounded-md p-[1px] shrink-0">
                              <div className="w-full h-full rounded-[calc(0.375rem-1px)] bg-[var(--studio-selected)] flex items-center justify-center">
                                <Sparkles className="h-3 w-3 text-white/70" />
                              </div>
                            </div>
                            <span className="font-sans antialiased text-[var(--studio-text-secondary)] font-normal">{awaitingSearch
                              ? locale === 'ar' ? 'جارٍ البحث…' : locale === 'fr' ? 'Recherche…' : 'Searching…'
                              : t('thinking')}</span>
                          </div>
                        )}

                        {/* Error + retry */}
                        {shouldShowChatError({ busy: chatBusy, requestId: debugRequestIdRef.current,
                          conversationId: activeSessionId ?? 'default-session', outcome: requestOutcome,
                        }) && <div className="max-w-lg"><ChatGuidanceCard
                          guidance={(() => { const guidance = guidanceForChatError(error?.message ?? 'CHAT_REQUEST_FAILED', locale);
                            return guidance.actions.includes('try_again') ? { ...guidance, actions: [artifactRetryAction] } : guidance;
                          })()} locale={locale} onAction={handleChatGuidanceAction} /></div>}
                        {agentRun?.conversationId === (activeSessionId ?? 'default-session')
                          && (agentRun.status === 'waiting_for_user' || agentRun.status === 'failed') && <div className="max-w-lg"><ChatGuidanceCard
                            guidance={agentRun.status === 'waiting_for_user' ? { kind: 'requirement',
                              message: locale === 'ar' ? 'أحتاج جدول البيانات أولاً.' : locale === 'fr' ? "J'ai d'abord besoin de la feuille de calcul." : 'I need the spreadsheet first.',
                              actions: ['upload_spreadsheet'] } : agentRun.terminalError === 'switch_model'
                              ? guidanceForChatError('MODEL_CAPABILITY_UNSUPPORTED', locale) : {
                                kind: agentRun.failedStep === 'charts' && agentRun.artifacts.some((part) => part.type === 'chart')
                                  ? 'requirement' : 'recoverable_error',
                                message: agentRun.failedStep === 'presentation'
                                  ? locale === 'ar' ? 'تعذر إنشاء العرض التقديمي. الرسوم البيانية المكتملة لا تزال متاحة.'
                                    : locale === 'fr' ? "Je n'ai pas pu créer la présentation. Vos graphiques sont conservés."
                                      : "I couldn't build the presentation. Your completed charts are still available."
                                  : agentRun.failedStep === 'charts' && agentRun.artifacts.some((part) => part.type === 'chart')
                                    ? locale === 'ar' ? 'أنشأت مخططًا واحدًا. حدّد أعمدة المخطط الثاني.'
                                      : locale === 'fr' ? 'Un graphique est prêt. Indiquez les colonnes du second graphique.'
                                        : 'One chart is ready. Tell me which columns to use for the second chart.'
                                  : agentRun.failedStep === 'charts'
                                    ? locale === 'ar' ? 'تعذر إنشاء الرسوم البيانية. يرجى اختيار أعمدة واضحة.'
                                      : locale === 'fr' ? "Je n'ai pas pu créer les graphiques. Choisissez des colonnes claires."
                                        : "I couldn't create useful charts. Choose clear columns and try again."
                                    : locale === 'ar' ? 'تعذر إكمال الخطوة المتبقية.'
                                      : locale === 'fr' ? "Je n'ai pas pu terminer l'étape restante."
                                        : "I couldn't complete the remaining step.",
                                actions: agentRun.failedStep === 'charts' && agentRun.artifacts.some((part) => part.type === 'chart')
                                  ? [] : [agentRun.failedStep === 'charts' ? 'try_chart_again'
                                    : agentRun.failedStep === 'presentation' ? 'try_presentation_again' : 'try_again'] }} locale={locale} onAction={handleChatGuidanceAction} /></div>}

                      </div>
                    </div>
                  </div>

                  {/* Floating "Scroll to Bottom" Action Button */}
                  <AnimatePresence>
                    {showScrollButton && !isEmpty && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.9 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="absolute left-1/2 z-50 -translate-x-1/2 pointer-events-auto"
                        style={{ bottom: composerPadding + 8 }}
                      >
                        <button
                          type="button"
                          onClick={scrollToLatest}
                          aria-label={t('jumpToLatest')}
                          className="flex items-center justify-center gap-1.5 rounded-full border border-[var(--studio-border)] bg-[var(--studio-popover)] px-3 py-2 text-xs font-medium text-[var(--studio-text-secondary)] shadow-xl transition-[color,background-color,transform] duration-150 hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]"
                        >
                          <ArrowDown className="h-4 w-4" />
                          <span>{t('jumpToLatest')}</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 3rd (Bottom): Floating composer over the fading message timeline */}
                <div ref={composerRef} className="absolute bottom-0 left-0 flex w-full flex-col items-center justify-end bg-transparent p-4 pb-6 pointer-events-none">
                  <>
                    <ChatCapacityHint refreshSignal={chatExchanges} />
                    <div className="pointer-events-auto mx-auto w-full max-w-4xl px-6">
                      <ClaudeChatInput
                      onSendMessage={handleSend}
                      onSelectFile={(file) => setPendingFile(file)}
                      attachmentStore={attachmentsBySession}
                      conversationId={conversationId}
                      attachmentsHydrated={attachmentsHydrated}
                      pendingAttachmentIds={pendingAttachmentIdsBySession[conversationId] ?? []}
                      pendingAttachmentActions={pendingAttachmentActions}
                      onRemoveConversationAttachment={detachFromConversation}
                      onConversationAttachmentAction={(action, selected) => { void (async () => {
                        const activeConversationId = activeSessionIdRef.current ?? 'default-session';
                        const attachment = getConversationAttachment(attachmentsBySessionRef.current,
                          activeConversationId, selected.attachmentId);
                        if (!attachment) return;
                        if (!pendingAttachmentActionsRef.current.begin(activeConversationId,
                          attachment.attachmentId, action)) return;
                        setPendingAttachmentActions(pendingAttachmentActionsRef.current.snapshot());
                        try {
                        if (action === 'ask') {
                          window.dispatchEvent(new CustomEvent('vantra-prefill-prompt', { detail: { prompt: `Ask about ${attachment.name}: ` } }));
                          return;
                        }
                        if (action === 'chart' && attachment.kind === 'spreadsheet') {
                          await handleSend({ message: 'Create a chart from this spreadsheet.',
                            isThinkingEnabled: false, attachmentId: attachment.attachmentId });
                          return;
                        }
                        const message = action === 'analyze' ? 'Analyze this spreadsheet and summarize the main findings.'
                          : action === 'summarize' ? 'Summarize this document.' : 'Create a 6-slide presentation from this spreadsheet.';
                        await handleSend({ message: attachment.kind === 'document' || attachment.kind === 'file'
                          ? action === 'presentation' ? 'Create a presentation from this document.' : message : message,
                          isThinkingEnabled: false,
                          attachmentId: attachment.attachmentId });
                        } finally {
                          pendingAttachmentActionsRef.current.end(activeConversationId, attachment.attachmentId, action);
                          setPendingAttachmentActions(pendingAttachmentActionsRef.current.snapshot());
                        }
                      })(); }}
                      locale={locale}
                      models={chatModels.map((model) => ({
                        id: model.id,
                        name: model.displayName,
                        availability: model.availability,
                        enabled: model.enabled,
                        requiresAuth: (model.verifiedCreditCost ?? 0) > 0,
                        creditCost: model.verifiedCreditCost,
                        requiredPlan: model.enabled && !model.planAccessible ? model.requiredPlan : null,
                        iconUrl: model.iconUrl,
                        provider: model.provider,
                        brand: model.brand,
                        allowedPlans: model.allowedPlans,
                        accessState: model.accessState,
                        trialAllowance: model.trialAllowance,
                        visionInput: 'visionInput' in model.capabilities && model.capabilities.visionInput,
                        fileInput: 'fileInput' in model.capabilities && model.capabilities.fileInput,
                      }))}
                      selectedModelId={currentModelId}
                      onSelectModel={setSelectedModelId}
                      isLoading={chatBusy}
                      onStop={() => abortChatRequest('user_stop')}
                      placeholder={isEmpty ? t('emptyPlaceholder') : t('placeholder')}
                      autoFocus={isEmpty}
                      onSignInClick={user ? undefined : () => openAuthModal('signin')}
                      onModelAccessRequest={(model) => requestModelAccess('chat', model)}
                      balance={balance}
                      balanceStatus={balanceStatus}
                      onAddCredits={openTopUpModal}
                      />
                    </div>
                  </>
                </div>
              </motion.div>
            )}

          {/* ── Image Canvas ── */}
          {activeWorkspace === 'image' && (
            <motion.div key="image" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }} className="absolute inset-0">
              <ImageCanvas models={imageModels} onGenerate={handleImageGenerate} onOpenLibrary={() => onWorkspaceChange('library')} onModelAccessRequest={(model) => requestModelAccess('image', model)} />
            </motion.div>
          )}

            {/* ── Motion Studio ── */}
            {activeWorkspace === 'video' && (
              <motion.div key="video" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }} className="absolute inset-0">
                <PrunaMotionStudio models={videoModels} planCode={planCode} onGenerate={handleVideoGenerate} onOpenLibrary={() => onWorkspaceChange('library')} onModelAccessRequest={(model) => requestModelAccess('video', model)} />
              </motion.div>
            )}

            {/* ── Library ── */}
            {activeWorkspace === 'library' && (
              <motion.div key="library" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }} className="absolute inset-0">
                <MediaLibrary />
              </motion.div>
            )}
          </>
        </div>
      </main>

      <SettingsModal
        open={settingsOpen}
        initialTab={settingsInitialTab}
        onClose={() => setSettingsOpen(false)}
        selectedChatModelId={currentModelId}
        onSelectChatModel={setSelectedModelId}
        models={entitledModels}
      />
      <ActivationOffer prompt={activationPrompt} onClose={() => setActivationPrompt(null)} />
      {pendingFile && uploadFileKind(pendingFile) === 'spreadsheet' && <ArtifactSpreadsheetPreview file={pendingFile} locale={locale} onClose={() => setPendingFile(null)} onAttach={(artifact, name) => attachToConversation({ kind: 'spreadsheet', name, artifact })} onAnalyze={(prompt, artifact) => { const attached = attachToConversation({ kind: 'spreadsheet', name: pendingFile.name, artifact }); void handleSend({ message: prompt, isThinkingEnabled: false, attachmentId: attached?.attachmentId }); }} />}
      {pendingFile && uploadFileKind(pendingFile) !== 'spreadsheet' && <FileAttachmentPreview file={pendingFile} locale={locale} onCancel={() => setPendingFile(null)} onAttach={(attachment) => { attachToConversation(attachment); setPendingFile(null); }} />}
    </div>
  );
}
