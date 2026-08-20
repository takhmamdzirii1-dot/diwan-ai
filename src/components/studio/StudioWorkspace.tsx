'use client';

import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import StudioSidebar, { StudioMode, ChatSession } from './StudioSidebar';
import StudioChat, { ChatMessage } from './StudioChat';
import StudioImage from './StudioImage';
import StudioVideo from './StudioVideo';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import { supabase } from '../../lib/supabase/client';

export default function StudioWorkspace() {
  const { user, balance, refreshBalance } = useUser();
  const { openAuthModal } = useModal();

  const [mode, setMode] = useState<StudioMode>('chat');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 'session-default-1',
      title: '🇩🇿 Darja Marketing Plan',
      mode: 'chat',
      timestamp: 'Today',
      model: 'Claude 3.5 Sonnet',
    },
    {
      id: 'session-default-2',
      title: 'Casbah Dusk 4K Render',
      mode: 'image',
      timestamp: 'Yesterday',
      model: 'Flux.1 Pro',
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>('session-default-1');

  // Messages state for current chat session
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle new session creation
  const handleNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: mode === 'chat' ? 'New Conversation' : mode === 'image' ? 'New Image Session' : 'New Video Session',
      mode: mode,
      timestamp: 'Just now',
      model: mode === 'chat' ? 'Claude 3.5 Sonnet' : mode === 'image' ? 'Flux.1 Pro' : 'Kling AI 1.5',
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    if (mode === 'chat') {
      setMessages([]);
    }
  };

  // Delete session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  // Send message handler connecting to /api/generate/chat
  const handleSendMessage = async (content: string, model: string, cost: number) => {
    // If not logged in, prompt user to sign in
    if (!user) {
      openAuthModal('signin');
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      // Get current Supabase session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch('/api/generate/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: content,
          model: model,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Generation failed (${response.status})`);
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: data.response || data.content || 'Response generated successfully.',
        model: data.model || model,
        cost: data.cost ?? cost,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update session title if first message
      if (messages.length === 0 && activeSessionId) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, title: content.slice(0, 30) + (content.length > 30 ? '...' : '') }
              : s
          )
        );
      }

      // Refresh balance
      await refreshBalance();
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now() + 2}`,
        sender: 'assistant',
        content: `⚠️ **Request Notice (${model})**\n\n${err?.message || 'An error occurred while communicating with the AI gateway.'}\n\n*Tip: You can switch to **DeepSeek R1 (Free)** or **Gemini 2.0 Flash (Free)** in the model selector below to generate without deduction.*`,
        model: model,
        cost: 0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050506] text-[#F5F6F8]">
      {/* Mobile Top Navbar with Drawer Toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#0A0B0E] border-b border-white/[0.08] px-4 flex items-center justify-between z-30">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-xl border border-white/10 bg-white/5 text-white"
          aria-label="Open Studio Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="font-heading font-bold text-sm text-white">VANTRA STUDIO</span>

        <div className="text-xs font-mono font-bold text-[#1FD8B8]">
          {balance.toLocaleString()} PTS
        </div>
      </div>

      {/* Sidebar */}
      <StudioSidebar
        currentMode={mode}
        onSelectMode={(m) => {
          setMode(m);
        }}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => setActiveSessionId(id)}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Mode Canvas */}
      <main className="flex-1 flex flex-col h-full overflow-hidden pt-14 lg:pt-0">
        {mode === 'chat' && (
          <StudioChat
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isGenerating}
          />
        )}

        {mode === 'image' && <StudioImage />}

        {mode === 'video' && <StudioVideo />}
      </main>
    </div>
  );
}
