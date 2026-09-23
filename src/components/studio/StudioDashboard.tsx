'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Menu, ArrowDown, Plus, Zap, Swords, Database, Settings, Sparkles, LayoutGrid, MessageSquare, Image as ImageIcon, Video, PenLine, Code2, Lightbulb, BarChart3, RefreshCw, FileText } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import { ClaudeChatInput } from '@/components/ui/claude-style-chat-input';
import DashboardSidebar from './DashboardSidebar';
import MessageBubble from './MessageBubble';
import ChatCapacityHint from './ChatCapacityHint';
import { formatCapacityWait } from '@/lib/chat/chat-usage';
import ImageCanvas, { type ImageGenerationResult, type ImageRequestDraft } from './ImageCanvas';
import SettingsModal from './StudioSettingsDialog';
import PrunaMotionStudio, { type VideoGenerationResult, type VideoRequestDraft } from './PrunaMotionStudio';
import MediaLibrary from './MediaLibrary';
import { VantraLogo } from '../VantraLogo';
import { cn } from '@/lib/utils';
import { GhostButton } from './AppShell';
import type { StudioRuntimeModelDefinition } from '@/src/config/studio-registry';
import { isModelSelectable } from '@/src/config/studio-registry';
import { applyModelPlanAccess } from '@/lib/models/plan-entitlements';
import { useTranslations } from 'next-intl';
import { useStudioAccess } from '@/src/hooks/useStudioAccess';
import ActivationOffer, { type ActivationPrompt, type ActivationReason } from './ActivationOffer';
import type { ChatModelOption } from '@/components/ui/model-picker';
import { trackFunnelEvent } from '@/src/lib/funnel-analytics';

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
  const sidebarT = useTranslations('studio.sidebar');
  const { user, refreshBalance, planCode, planStatus } = useUser({ loadPlan: true, loadBalance: true });
  const { openAuthModal } = useModal();
  const { access } = useStudioAccess(Boolean(user));
  const [activationPrompt, setActivationPrompt] = useState<ActivationPrompt | null>(null);

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  const defaultChatModel = chatModels.find(isModelSelectable) ?? chatModels[0] ?? null;
  const [selectedModelId, setSelectedModelId] = useState(defaultChatModel?.id ?? '');
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [chatExchanges, setChatExchanges] = useState(0);
  const sendStartRef = useRef<number>(0);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const activeModel = chatModels.find((model) => model.id === selectedModelId) ?? defaultChatModel;

  useEffect(() => {
    if (activeModel && isModelSelectable(activeModel)) return;
    const available = chatModels.find(isModelSelectable);
    if (available) setSelectedModelId(available.id);
  }, [activeModel, chatModels]);

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
    onFinish: () => {
      if (sendStartRef.current) setLastLatencyMs(performance.now() - sendStartRef.current);
      setChatExchanges((count) => count + 1);
      refreshBalance();
    },
    onError: (chatError) => {
      // Server-side trial exhaustion surfaces here (e.g. allowance ran out
      // mid-session). Route it to the activation offer; anything else falls
      // through to the existing inline error renderer.
      try {
        const body = JSON.parse(chatError.message) as { error?: string };
        if ((body.error === 'MODEL_TRIAL_EXHAUSTED' || body.error === 'MODEL_TRIAL_UNCONFIGURED') && activeModel) {
          showActivation('model_trial_exhausted', 'chat', { id: activeModel.id, name: activeModel.displayName, requiredPlan: activeModel.requiredPlan });
        }
      } catch { /* Inline renderer shows the message. */ }
    },
  });

  const handleNewChat = useCallback(() => {
    // Abort any active text stream
    stop();
    // Lazy creation: no DB/list record yet â€” just a draft id so the composer stays live.
    setActiveSessionId(`draft-${Date.now()}`);
    setMessages([]);
    onWorkspaceChange('chat');
  }, [onWorkspaceChange, stop, setMessages]);

  const handleSelectSession = useCallback((sessionId: string) => {
    stop();
    setActiveSessionId(sessionId);
    onWorkspaceChange('chat');
  }, [onWorkspaceChange, stop]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    try {
      localStorage.removeItem(`vantra_chat_${sessionId}`);
    } catch {}
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (sessionId === activeSessionId) {
        // Move to the newest remaining session, or start a clean draft
        setActiveSessionId(next.length > 0 ? next[0].id : `draft-${Date.now()}`);
      }
      return next;
    });
  }, [activeSessionId]);

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
    if (!activeSessionId) return;
    // Debounced + capped: persist only the last 50 messages per session
    const t = setTimeout(() => {
      try {
        if (messages.length > 0) {
          localStorage.setItem(`vantra_chat_${activeSessionId}`, JSON.stringify(messages.slice(-50)));
        } else {
          localStorage.removeItem(`vantra_chat_${activeSessionId}`);
        }
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [messages, activeSessionId]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
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
    async (data: { message: string; isThinkingEnabled: boolean; files?: Array<{ file: File; preview?: string | null; type: string }> }) => {
      if (!activeModel || !isModelSelectable(activeModel)) return;
      if (access?.kind === 'paid_lapsed') {
        showActivation('paid_lapsed', 'chat', { id: activeModel.id, name: activeModel.displayName });
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
      if (data.isThinkingEnabled) {
        content = `Think through this step-by-step with careful reasoning before answering.\n\n${content}`;
      }

      // Convert attachments for experimental_attachments
      const capabilities = activeModel.capabilities;
      const attachments = (data.files || []).filter((f) => f.type.startsWith('image/')
        ? ('visionInput' in capabilities && capabilities.visionInput)
        : ('fileInput' in capabilities && capabilities.fileInput)).map((f) => ({
        name: f.file?.name || 'attachment',
        contentType: f.type,
        url: f.preview || '',
      }));

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
      await append(
        {
          role: 'user',
          content,
          experimental_attachments: attachments.length > 0 ? (attachments as any) : undefined,
        },
        {
          body: {
            model: selectedModelId,
            operationId: crypto.randomUUID(),
          },
        }
      );
    },
    [append, selectedModelId, activeSessionId, sessions, activeModel, user, openAuthModal, access?.kind, showActivation]
  );

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
      if (code === 'FREE_MEDIA_EXPIRED') showActivation('free_media_expired', 'image');
      else if (code === 'FREE_IMAGE_TRIAL_EXHAUSTED') showActivation('image_allowance_exhausted', 'image');
      else if (code === 'PAID_PLAN_REACTIVATION_REQUIRED') showActivation('paid_lapsed', 'image');
      else if (code === 'MODEL_TRIAL_EXHAUSTED' || code === 'MODEL_TRIAL_UNCONFIGURED') showActivation('model_trial_exhausted', 'image', { id: draft.modelId, name: imageModels.find((item) => item.id === draft.modelId)?.displayName ?? draft.modelId, requiredPlan: payload?.requiredPlan });
      else if (code === 'MODEL_PLAN_ACCESS_REQUIRED') showActivation('model_locked', 'image', { id: draft.modelId, name: imageModels.find((item) => item.id === draft.modelId)?.displayName ?? draft.modelId, requiredPlan: payload?.requiredPlan });
      if (/FREE_MEDIA_EXPIRED|FREE_IMAGE_TRIAL_EXHAUSTED|PAID_PLAN_REACTIVATION_REQUIRED|MODEL_TRIAL_|MODEL_PLAN_ACCESS_REQUIRED/.test(code ?? '')) throw new Error('ACCESS_PROMPTED');
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
      if (code === 'FREE_MEDIA_EXPIRED') showActivation('free_media_expired', 'video');
      else if (code === 'FREE_VIDEO_TRIAL_EXHAUSTED') showActivation('video_allowance_exhausted', 'video');
      else if (code === 'FREE_VIDEO_DURATION_LIMIT') showActivation('video_duration_limit', 'video');
      else if (code === 'PAID_PLAN_REACTIVATION_REQUIRED') showActivation('paid_lapsed', 'video');
      else if (code === 'MODEL_TRIAL_EXHAUSTED' || code === 'MODEL_TRIAL_UNCONFIGURED') showActivation('model_trial_exhausted', 'video', { id: draft.modelId, name: videoModels.find((item) => item.id === draft.modelId)?.displayName ?? draft.modelId, requiredPlan: payload?.requiredPlan });
      else if (code === 'MODEL_PLAN_ACCESS_REQUIRED') showActivation('model_locked', 'video', { id: draft.modelId, name: videoModels.find((item) => item.id === draft.modelId)?.displayName ?? draft.modelId, requiredPlan: payload?.requiredPlan });
      if (/FREE_MEDIA_EXPIRED|FREE_VIDEO_TRIAL_EXHAUSTED|FREE_VIDEO_DURATION_LIMIT|PAID_PLAN_REACTIVATION_REQUIRED|MODEL_TRIAL_|MODEL_PLAN_ACCESS_REQUIRED/.test(code ?? '')) throw new Error('ACCESS_PROMPTED');
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
                                isLatest={idx === messages.length - 1}
                                isStreaming={isLoading}
                                onRegenerate={isLoading ? undefined : () => reload()}
                              />
                            ))}
                          </motion.div>
                        )}

                        {/* Loading / Thinking */}
                        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                          <div className="flex items-center gap-2.5 py-1 text-[13.5px] text-white/60 animate-pulse" role="status" aria-live="polite">
                            <div className="ai-avatar-ring h-6 w-6 rounded-md p-[1px] shrink-0">
                              <div className="w-full h-full rounded-[calc(0.375rem-1px)] bg-[var(--studio-selected)] flex items-center justify-center">
                                <Sparkles className="h-3 w-3 text-white/70" />
                              </div>
                            </div>
                            <span className="font-sans antialiased text-white/70 font-normal">{t('thinking')}</span>
                          </div>
                        )}

                        {/* Error + retry */}
                        {error && !error.message?.includes('Failed to parse stream string') && (
                          <div className="flex justify-start" role="alert">
                            <div className="max-w-lg rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5">
                              <p className="text-[13px] text-white/80 leading-relaxed">
                                {(() => {
                                  try {
                                    if (!error?.message?.includes('{')) return error?.message || t('errorFallback');
                                    const body = JSON.parse(error.message) as {
                                      error?: string; nextAvailableAt?: string | null;
                                    };
                                    // Weighted chat limits speak calmly: no codes,
                                    // weights, or numeric allowances customer-side.
                                    if (body.error === 'CHAT_LIMIT_REACHED') {
                                      const wait = formatCapacityWait(body.nextAvailableAt ?? null);
                                      return wait
                                        ? t('chatCapacityAvailableIn', { wait })
                                        : t('chatCapacityLimit');
                                    }
                                    return body.error || error.message;
                                  } catch {
                                    return error?.message || t('errorFallback');
                                  }
                                })()}
                              </p>
                              <GhostButton onClick={() => reload()} className="mt-3">
                                <RefreshCw className="h-3.5 w-3.5" />
                                {t('retry')}
                              </GhostButton>
                            </div>
                          </div>
                        )}

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
                      selectedModelId={selectedModelId}
                      onSelectModel={setSelectedModelId}
                      isLoading={isLoading}
                      onStop={stop}
                      placeholder={isEmpty ? t('emptyPlaceholder') : t('placeholder')}
                      autoFocus={isEmpty}
                      onSignInClick={user ? undefined : () => openAuthModal('signin')}
                      onModelAccessRequest={(model) => requestModelAccess('chat', model)}
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
                <PrunaMotionStudio models={videoModels} onGenerate={handleVideoGenerate} onOpenLibrary={() => onWorkspaceChange('library')} onModelAccessRequest={(model) => requestModelAccess('video', model)} />
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
        onClose={() => setSettingsOpen(false)}
        selectedChatModelId={selectedModelId}
        onSelectChatModel={setSelectedModelId}
        models={entitledModels}
      />
      <ActivationOffer prompt={activationPrompt} onClose={() => setActivationPrompt(null)} />
    </div>
  );
}
