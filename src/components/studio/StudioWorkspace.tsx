'use client';

import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import StudioSidebar, { type StudioMode, type ChatSession } from './StudioSidebar';
import StudioChat, { type ChatMessage } from './StudioChat';
import StudioImage from './StudioImage';
import StudioVideo from './StudioVideo';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import { createClient } from '../../lib/supabase/client';

export default function StudioWorkspace() {
  const { user, balance, refreshBalance } = useUser();
  const { openAuthModal } = useModal();
  const supabase = createClient();

  const [mode, setMode] = useState<StudioMode>('chat');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Active Sessions
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 'session-1',
      title: 'Algerian Darja E-Commerce',
      mode: 'chat',
      timestamp: 'Today',
      model: 'Auto-Routing Free Engine',
    },
    {
      id: 'session-2',
      title: 'Next.js Chargily Webhook',
      mode: 'chat',
      timestamp: 'Yesterday',
      model: 'Claude 3.5 Sonnet',
    },
  ]);

  const [activeSessionId, setActiveSessionId] = useState<string | null>('session-1');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const storedSessions = localStorage.getItem('vantra_sessions');
      const storedMessages = localStorage.getItem('vantra_messages');
      if (storedSessions) {
        setSessions(JSON.parse(storedSessions));
      }
      if (storedMessages) {
        setMessages(JSON.parse(storedMessages));
      }
    } catch (e) {
      console.error('Failed to load local storage:', e);
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('vantra_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('vantra_messages', JSON.stringify(messages));
    } else {
      localStorage.removeItem('vantra_messages');
    }
  }, [messages]);

  // Clear chat helper
  const handleClearChat = () => {
    localStorage.removeItem('vantra_messages');
    setMessages([]);
    setApiError(null);
  };

  // Create new session
  const handleNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat Session',
      mode: mode,
      timestamp: 'Just now',
      model: 'Auto-Routing Free Engine',
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMessages([]);
    setApiError(null);
  };

  // Delete session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
      setApiError(null);
    }
  };

  // Send message handler connecting to /api/generate/chat
  const handleSendMessage = async (content: string, model: string, cost: number) => {
    // If not logged in, prompt user to sign in
    if (!user) {
      openAuthModal('signin');
      return;
    }

    setApiError(null);

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

      const historyPayload = [...messages, userMessage].map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      const response = await fetch('/api/generate/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: content,
          model: model,
          messages: historyPayload,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Generation failed (${response.status})`);
      }

      const returnedModel = response.headers.get('X-Vantra-Model') || model;
      const returnedCost = parseInt(response.headers.get('X-Vantra-Cost') || '0');

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: '',
        model: returnedModel,
        cost: returnedCost,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let streamedContent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamedContent += decoder.decode(value, { stream: true });
          
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = streamedContent;
            return newMessages;
          });
        }
      }

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
      setApiError(err?.message || 'An error occurred while communicating with the AI gateway.');
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
            errorMessage={apiError}
            onDismissError={() => setApiError(null)}
            onClearChat={handleClearChat}
          />
        )}

        {mode === 'image' && <StudioImage />}

        {mode === 'video' && <StudioVideo />}
      </main>
    </div>
  );
}
