'use client';

import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import StudioSidebar, { type StudioMode, type ChatSession } from './StudioSidebar';
import StudioChat from './StudioChat';
import StudioImage from './StudioImage';
import StudioVideo from './StudioVideo';
import useUser from '../../hooks/useUser';

export default function StudioWorkspace() {
  const { user, balance, refreshBalance } = useUser();

  const [mode, setMode] = useState<StudioMode>('chat');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Active Sessions
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const storedSessions = localStorage.getItem('vantra_sessions');
      if (storedSessions) {
        setSessions(JSON.parse(storedSessions));
      }
    } catch (e) {
      console.error('Failed to load local storage:', e);
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem('vantra_sessions', JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to persist sessions:', e);
    }
  }, [sessions]);

  const modeLabel = mode === 'chat' ? 'AI Chat' : mode === 'image' ? 'Image Generator' : 'Video Engine';

  // Create new session
  const handleNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: `New ${modeLabel} Session`,
      mode: mode,
      timestamp: 'Just now',
      model: 'Free Auto-Route',
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
  };

  // Delete session + cleanup persisted messages
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      localStorage.removeItem(`vantra_chat_${id}`);
    } catch {}
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
  };

  // Auto-title a session from its first user message
  const handleSessionActivity = (sessionId: string | null, firstMessage: string) => {
    if (!sessionId || !firstMessage) return;
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        if (s.title !== `New ${modeLabel} Session`) return s; // already titled
        const clean = firstMessage.replace(/\[Attachment:[^\]]*\]/g, '').trim();
        const title = clean.length > 42 ? `${clean.slice(0, 42).trimEnd()}…` : clean;
        return { ...s, title: title || s.title };
      })
    );
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

        {user ? (
          <div className="text-xs font-mono font-bold text-[#1FD8B8]">
            {balance.toLocaleString()} PTS
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#1FD8B8]/10 text-[#1FD8B8]"
          >
            Sign in
          </button>
        )}
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
      <main className="flex-1 flex flex-col relative h-full min-w-0 pt-14 lg:pt-0 overflow-hidden">
        {mode === 'chat' && (
          <StudioChat
            key={activeSessionId || 'no-session'}
            activeSessionId={activeSessionId}
            onSessionActivity={handleSessionActivity}
          />
        )}

        {mode === 'image' && <StudioImage />}

        {mode === 'video' && <StudioVideo />}
      </main>
    </div>
  );
}
