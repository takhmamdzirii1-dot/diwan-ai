'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Image as ImageIcon,
  Video,
  Trash2,
  LogOut,
  LogIn,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  MessagesSquare,
} from 'lucide-react';
import Link from 'next/link';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';

export type StudioMode = 'chat' | 'image' | 'video';

export interface ChatSession {
  id: string;
  title: string;
  mode: StudioMode;
  timestamp: string;
  createdAt?: number;
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

/* Date grouping — Claude style */
function groupLabel(createdAt: number): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;
  if (createdAt >= startOfToday) return 'Today';
  if (createdAt >= startOfToday - day) return 'Yesterday';
  if (createdAt >= startOfToday - 7 * day) return 'Previous 7 days';
  if (createdAt >= startOfToday - 30 * day) return 'Previous 30 days';
  return 'Older';
}

const MODE_META: { id: StudioMode; label: string; icon: React.ElementType }[] = [
  { id: 'chat', label: 'Chats', icon: MessageSquare },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Video },
];

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
  const { openTopUpModal, openAuthModal } = useModal();

  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('vantra_sidebar_collapsed') === '1');
    } catch {}
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('vantra_sidebar_collapsed', c ? '0' : '1');
      } catch {}
      return !c;
    });
  };

  const modeSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.mode === currentMode)
        .filter((s) => !query.trim() || s.title.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [sessions, currentMode, query]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ChatSession[]>();
    modeSessions.forEach((s) => {
      const label = groupLabel(s.createdAt ?? Date.now());
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(s);
    });
    return Array.from(map.entries());
  }, [modeSessions]);

  const isCollapsed = collapsed && !isMobileOpen;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md lg:hidden cursor-pointer"
        />
      )}

      <aside
        className={`studio-sidebar flex flex-col fixed lg:static top-0 bottom-0 left-0 z-50 h-full bg-[#070709]/95 backdrop-blur-xl border-r border-white/[0.06] font-sans transition-all duration-300 shadow-2xl shadow-black/30 ${
          isCollapsed ? 'w-[72px]' : 'w-[264px]'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* ── Logo row ── */}
        <div className={`flex items-center h-[60px] shrink-0 border-b border-white/[0.05] ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer" title="Back to home">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 bg-[#1FD8B8]/15 blur-lg rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity" />
              <img src="/brandmark.svg" alt="VANTRA" className="relative w-6 h-6 object-contain" />
            </div>
            {!isCollapsed && (
              <span className="font-heading font-bold text-[13px] tracking-[0.18em] text-white/90 group-hover:text-white transition-colors">
                VANTRA
              </span>
            )}
          </Link>

          {!isCollapsed && (
            <button
              type="button"
              onClick={toggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Collapsed: expand button */}
        {isCollapsed && (
          <button
            type="button"
            onClick={toggleCollapse}
            className="hidden lg:flex mx-auto mt-3 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* ── New chat (primary action) ── */}
        <div className={`${isCollapsed ? 'px-2.5' : 'px-3'} pt-4`}>
          <button
            type="button"
            onClick={() => {
              onNewSession();
              onCloseMobile?.();
            }}
            className={`group flex items-center gap-2.5 h-10 rounded-xl border border-white/[0.09] bg-white/[0.04] hover:bg-[#1FD8B8]/[0.1] hover:border-[#1FD8B8]/40 text-white/85 hover:text-white text-[13px] font-semibold transition-all duration-200 hover:-translate-y-px hover:shadow-[0_8px_24px_-12px_rgba(31,216,184,0.5)] cursor-pointer ${
              isCollapsed ? 'w-10 justify-center mx-auto' : 'w-full px-3.5'
            }`}
            title="New chat"
          >
            <Plus className="h-4 w-4 text-[#1FD8B8] group-hover:rotate-90 transition-transform duration-300" />
            {!isCollapsed && <span>New chat</span>}
          </button>
        </div>

        {/* ── Search ── */}
        <div className={`${isCollapsed ? 'px-2.5' : 'px-3'} pt-2.5`}>
          {isCollapsed ? (
            <button
              type="button"
              onClick={() => {
                setCollapsed(false);
                setSearchOpen(true);
              }}
              className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Search chats"
            >
              <Search className="h-4 w-4" />
            </button>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setSearchOpen(false)}
                placeholder="Search chats..."
                className="w-full h-9 rounded-xl bg-white/[0.03] border border-white/[0.07] focus:border-[#1FD8B8]/40 pl-9 pr-3 text-[12.5px] text-white placeholder-white/25 outline-none transition-colors"
              />
            </div>
          )}
        </div>

        {/* ── Modes ── */}
        <div className={`${isCollapsed ? 'px-2' : 'px-3'} pt-4`}>
          {!isCollapsed && (
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/25 px-1 mb-2">Studio</p>
          )}
          <div className={`flex ${isCollapsed ? 'flex-col items-center gap-1.5' : 'flex-row gap-1.5'}`}>
            {MODE_META.map(({ id, label, icon: Icon }) => {
              const active = currentMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelectMode(id);
                    onCloseMobile?.();
                  }}
                  title={label}
                  className={`flex items-center rounded-xl text-[12px] font-medium transition-all duration-200 cursor-pointer ${
                    isCollapsed ? 'w-10 h-10 justify-center' : 'flex-1 h-9 justify-center gap-1.5'
                  } ${
                    active
                      ? 'bg-[#1FD8B8]/[0.12] text-white ring-1 ring-[#1FD8B8]/25 shadow-[0_0_20px_-8px_rgba(31,216,184,0.5)]'
                      : 'text-white/40 hover:text-white/85 hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {!isCollapsed && <span>{label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Recents (grouped by date) ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-thin mt-5 px-2 pb-4">
          {!isCollapsed && (
            <>
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/25 px-2 mb-2 flex items-center gap-1.5">
                <MessagesSquare className="h-3 w-3" />
                Recents
              </p>

              {grouped.length === 0 && (
                <p className="text-[12px] text-white/25 px-2 py-3 leading-relaxed">
                  {query.trim() ? 'No chats match your search.' : 'No conversations yet — start one above.'}
                </p>
              )}

              {grouped.map(([label, items]) => (
                <div key={label} className="mb-3">
                  <p className="text-[10.5px] font-semibold text-white/30 px-2 mb-1">{label}</p>
                  <div className="flex flex-col gap-0.5">
                    {items.map((session) => {
                      const active = activeSessionId === session.id;
                      return (
                        <div
                          key={session.id}
                          onClick={() => {
                            onSelectSession(session.id);
                            onCloseMobile?.();
                          }}
                          className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150 relative overflow-hidden ${
                            active
                              ? 'bg-white/[0.07] text-white'
                              : 'text-white/50 hover:text-white/90 hover:bg-white/[0.04]'
                          }`}
                        >
                          {active && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-5 rounded-full bg-gradient-to-b from-[#1FD8B8] to-transparent" />
                          )}
                          <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-[#1FD8B8]' : 'text-white/30 group-hover:text-white/60'}`} />
                          <span className="text-[12.5px] truncate flex-1">{session.title}</span>
                          <button
                            type="button"
                            onClick={(e) => onDeleteSession(session.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-white/[0.06] transition-all cursor-pointer shrink-0"
                            title="Delete chat"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {isCollapsed && (
            <div className="flex flex-col items-center gap-1 pt-1">
              {modeSessions.slice(0, 6).map((session) => {
                const active = activeSessionId === session.id;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      onSelectSession(session.id);
                      onCloseMobile?.();
                    }}
                    title={session.title}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                      active ? 'bg-white/[0.08] text-[#1FD8B8]' : 'text-white/35 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bottom: balance + user ── */}
        <div className={`${isCollapsed ? 'px-2' : 'px-3'} pb-3 shrink-0`}>
          {user ? (
            <>
              {!isCollapsed ? (
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm mb-2">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30">Balance</span>
                    <CreditCard className="h-3.5 w-3.5 text-white/25" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-mono font-semibold text-white">
                      {balance.toLocaleString()}
                      <span className="text-[10px] text-[#1FD8B8] ms-1.5">PTS</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => openTopUpModal()}
                      className="px-2.5 py-1.5 rounded-lg bg-[#1FD8B8]/10 border border-[#1FD8B8]/25 text-[#1FD8B8] text-[11px] font-semibold hover:bg-[#1FD8B8]/20 transition-colors cursor-pointer"
                    >
                      Top up
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openTopUpModal()}
                  title={`${balance.toLocaleString()} PTS — Top up`}
                  className="w-10 h-10 mx-auto mb-2 flex items-center justify-center rounded-xl bg-[#1FD8B8]/10 text-[#1FD8B8] hover:bg-[#1FD8B8]/20 transition-colors cursor-pointer"
                >
                  <CreditCard className="h-4 w-4" />
                </button>
              )}

              <div className={`flex items-center rounded-xl hover:bg-white/[0.04] transition-colors ${isCollapsed ? 'justify-center p-1' : 'gap-2.5 p-2'}`}>
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#1FD8B8] to-[#0EA98E] flex items-center justify-center font-bold text-[#050506] text-[13px] shrink-0 shadow-inner">
                  {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                {!isCollapsed && (
                  <>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[12px] font-medium text-white/90 truncate">
                        {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                      </span>
                      <span className="text-[10px] text-white/35">Pay-as-you-go</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="p-1.5 text-white/30 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Log out"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className={`flex items-center gap-2 h-10 rounded-xl bg-[#1FD8B8]/[0.08] border border-[#1FD8B8]/25 text-[#1FD8B8] text-[12.5px] font-semibold hover:bg-[#1FD8B8]/[0.15] transition-colors cursor-pointer ${
                isCollapsed ? 'w-10 justify-center mx-auto' : 'w-full justify-center'
              }`}
              title="Sign in"
            >
              <LogIn className="h-4 w-4" />
              {!isCollapsed && 'Sign in'}
            </button>
          )}

          {isMobileOpen && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden w-full mt-2 flex items-center justify-center gap-2 h-9 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.05] text-[12px] transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Close menu
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
