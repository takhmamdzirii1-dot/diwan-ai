'use client';

import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import StudioSidebar, { type StudioMode, type ChatSession } from './StudioSidebar';
import StudioChat from './StudioChat';
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
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const storedSessions = localStorage.getItem('vantra_sessions');
      const storedMessages = localStorage.getItem('vantra_messages');
      if (storedSessions) {
        setSessions(JSON.parse(storedSessions));
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

  // Clear chat helper
  const handleClearChat = () => {
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
    setApiError(null);
  };

  // Delete session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setApiError(null);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#050506] text-white">
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
      <main className="flex-1 flex flex-col relative h-full min-w-0 pt-14 lg:pt-0">
        {mode === 'chat' && (
          <StudioChat
            activeSessionId={activeSessionId}
            onClearChat={handleClearChat}
          />
        )}

        {mode === 'image' && <StudioImage />}

        {mode === 'video' && <StudioVideo />}
      </main>
    </div>
  );
}
