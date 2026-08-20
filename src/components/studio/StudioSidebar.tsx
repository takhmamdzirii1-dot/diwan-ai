'use client';

import React from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Image as ImageIcon,
  Video,
  Plus,
  ArrowLeft,
  Wallet,
  Trash2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';

export type StudioMode = 'chat' | 'image' | 'video';

export interface ChatSession {
  id: string;
  title: string;
  mode: StudioMode;
  timestamp: string;
  model: string;
}

interface StudioSidebarProps {
  currentMode: StudioMode;
  onSelectMode: (mode: StudioMode) => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function StudioSidebar({
  currentMode,
  onSelectMode,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isMobileOpen = false,
  onCloseMobile,
}: StudioSidebarProps) {
  const { user, balance, signOut } = useUser();
  const { openTopUpModal } = useModal();

  const filteredSessions = sessions.filter((s) => s.mode === currentMode);

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md lg:hidden cursor-pointer"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-72 flex flex-col justify-between border-r border-white/5 bg-[#0A0B0D]/80 backdrop-blur-xl p-4 transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Section */}
        <div className="space-y-4">
          {/* Brand & Home Link */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-8 w-8 rounded-xl bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 flex items-center justify-center text-[#1FD8B8] shadow-[0_0_15px_rgba(31,216,184,0.2)]">
                <img src="/brandmark.svg" alt="VANTRA" className="h-4 w-4" />
              </div>
              <div>
                <span className="font-heading font-bold text-sm text-white tracking-wider">
                  VANTRA
                </span>
                <span className="text-[10px] font-mono text-[#1FD8B8] ml-1.5 px-1.5 py-0.5 rounded bg-[#1FD8B8]/10 border border-[#1FD8B8]/20 font-bold">
                  STUDIO
                </span>
              </div>
            </Link>

            <Link
              href="/"
              className="h-7 px-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-[11px] text-[#94A3B8] hover:text-white flex items-center gap-1 transition"
              title="Return to Landing Page"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Exit</span>
            </Link>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1.5 bg-[#050608] p-1.5 rounded-2xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                onSelectMode('chat');
                onCloseMobile?.();
              }}
              className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentMode === 'chat'
                  ? 'bg-[#1FD8B8] text-[#050506] font-bold shadow-[0_2px_12px_rgba(31,216,184,0.35)]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <MessageSquare
                className={`h-4 w-4 mb-1 ${
                  currentMode === 'chat' ? 'text-[#050506]' : 'text-[#1FD8B8]'
                }`}
              />
              <span className="text-[11px]">Chat</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectMode('image');
                onCloseMobile?.();
              }}
              className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentMode === 'image'
                  ? 'bg-[#1FD8B8] text-[#050506] font-bold shadow-[0_2px_12px_rgba(31,216,184,0.35)]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <ImageIcon
                className={`h-4 w-4 mb-1 ${
                  currentMode === 'image' ? 'text-[#050506]' : 'text-[#1FD8B8]'
                }`}
              />
              <span className="text-[11px]">Image</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectMode('video');
                onCloseMobile?.();
              }}
              className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentMode === 'video'
                  ? 'bg-[#1FD8B8] text-[#050506] font-bold shadow-[0_2px_12px_rgba(31,216,184,0.35)]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Video
                className={`h-4 w-4 mb-1 ${
                  currentMode === 'video' ? 'text-[#050506]' : 'text-[#1FD8B8]'
                }`}
              />
              <span className="text-[11px]">Video</span>
            </button>
          </div>

          {/* New Prompt / Chat Button */}
          <button
            type="button"
            onClick={() => {
              onNewSession();
              onCloseMobile?.();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-[#1FD8B8]/30 bg-[#1FD8B8]/10 hover:bg-[#1FD8B8]/20 text-[#1FD8B8] h-10 text-xs font-bold transition shadow-[0_0_15px_rgba(31,216,184,0.1)] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>
              {currentMode === 'chat'
                ? 'New Chat Session'
                : currentMode === 'image'
                ? 'New Image Canvas'
                : 'New Video Scene'}
            </span>
          </button>

          {/* Recent Sessions List */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 pt-2 text-[10px] font-mono text-[#64748B] uppercase tracking-wider">
              <span>Recent {currentMode} history</span>
              <span>{filteredSessions.length}</span>
            </div>

            <div className="max-h-[calc(100vh-390px)] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredSessions.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#64748B] border border-dashed border-white/[0.06] rounded-2xl my-2">
                  No previous sessions. Start generating above!
                </div>
              ) : (
                filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => {
                      onSelectSession(session.id);
                      onCloseMobile?.();
                    }}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition cursor-pointer ${
                      activeSessionId === session.id
                        ? 'bg-[#1FD8B8]/10 text-white font-semibold border-l-2 border-[#1FD8B8]'
                        : 'text-[#94A3B8] hover:bg-white/5 hover:text-white border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate max-w-[190px]">
                      <Sparkles className={`h-3 w-3 shrink-0 ${activeSessionId === session.id ? 'text-[#1FD8B8]' : 'text-white/30 group-hover:text-[#1FD8B8]'}`} />
                      <span className="truncate">{session.title}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => onDeleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-[#64748B] hover:text-red-400 p-1 transition"
                      title="Delete session"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom Profile & Top-Up Card */}
        <div className="pt-3 space-y-2 relative z-10">
          {/* Balance Pill */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1FD8B8] opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#1FD8B8]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-[#64748B] uppercase font-mono leading-none tracking-wider mb-1">
                  Credits
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono font-bold text-sm text-white leading-none">
                    {balance.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#1FD8B8] font-bold">PTS</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openTopUpModal()}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-[#1FD8B8]/10 hover:bg-[#1FD8B8]/20 border border-[#1FD8B8]/30 text-[#1FD8B8] transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* User Details */}
          {user && (
            <div className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/5 transition border border-transparent hover:border-white/5 cursor-pointer group">
              <div className="flex items-center gap-2.5 truncate max-w-[180px]">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1FD8B8] to-[#0EA98E] text-[#050506] font-bold text-sm flex items-center justify-center shrink-0 shadow-inner">
                  {(user.user_metadata?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-white/90 group-hover:text-white truncate transition">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-[#64748B] truncate">{user.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => signOut()}
                className="text-[#64748B] hover:text-white/90 p-1.5 transition rounded-full hover:bg-white/10"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
