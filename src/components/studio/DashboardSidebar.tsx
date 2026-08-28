'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  MessageSquare,
  Image as ImageIcon,
  Video,
  FolderOpen,
  Settings,
  LogOut,
  LogIn,
  Trash2,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { VantraLogo } from '../VantraLogo';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import { cn } from '@/lib/utils';
import { PanelLabel, ScrollArea } from './AppShell';

export type Workspace = 'chat' | 'image' | 'video' | 'library';

export interface SidebarSession {
  id: string;
  title: string;
}

interface DashboardSidebarProps {
  activeWorkspace?: Workspace;
  onWorkspaceChange?: (w: Workspace) => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  sessions?: SidebarSession[];
  activeSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenMobile?: () => void;
}

const WORKSPACES: { id: Workspace; label: string; icon: React.ElementType }[] = [
  { id: 'chat', label: 'Chat Studio', icon: MessageSquare },
  { id: 'image', label: 'Image Canvas', icon: ImageIcon },
  { id: 'video', label: 'Motion Studio', icon: Video },
  { id: 'library', label: 'Library', icon: FolderOpen },
];

export default function DashboardSidebar({
  activeWorkspace = 'chat',
  onWorkspaceChange,
  onNewChat,
  onOpenSettings,
  sessions = [],
  activeSessionId = null,
  onSelectSession,
  onDeleteSession,
  isMobileOpen = false,
  onCloseMobile,
  onOpenMobile,
}: DashboardSidebarProps) {
  const { user, signOut } = useUser();
  const { openAuthModal } = useModal();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest';

  const messagesLeft = 12;
  const usagePercent = 80;

  // Profile menu dismissal
  useEffect(() => {
    if (!profileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setProfileOpen(false);
    const onDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [profileOpen]);

  // Mobile drawer: Escape to close + focus trap entry
  useEffect(() => {
    if (!isMobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseMobile?.();
    window.addEventListener('keydown', onKey);
    asideRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileOpen, onCloseMobile]);

  const renderHistory = () => {
    if (sessions.length === 0) {
      return (
        <p className="px-2 text-[11px] text-white/40 italic">No recent chats</p>
      );
    }
    return (
      <div className="space-y-1">
        {sessions.map((session) => {
          const active = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              className={cn(
                'group relative flex items-center rounded-lg transition-colors',
                active ? 'bg-white/[0.10]' : 'hover:bg-white/[0.05]'
              )}
            >
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  onSelectSession?.(session.id);
                  onCloseMobile?.();
                }}
                className={cn(
                  'flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-start text-[13px] cursor-pointer transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                  active ? 'text-white font-medium' : 'text-white/70 hover:text-white'
                )}
              >
                <MessageSquare className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-white/40')} />
                <span className="truncate">{session.title}</span>
              </button>
              {onDeleteSession && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  aria-label={`Delete chat: ${session.title}`}
                  className="shrink-0 me-1.5 p-1.5 rounded-md text-white/25 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden cursor-pointer"
        />
      )}

      <aside
        ref={asideRef}
        aria-label="Studio navigation"
        aria-hidden={!isMobileOpen ? undefined : false}
        className={cn(
          'flex flex-col fixed lg:static top-0 bottom-0 start-0 z-50 w-[280px] h-full bg-[#0D0D0D] border-e border-white/[0.08] transition-transform duration-300',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand — matches 56px top bar height */}
        <div className="flex items-center justify-between h-14 shrink-0 px-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg border border-white/10 flex items-center justify-center">
              <VantraLogo className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-semibold tracking-[0.14em] text-white">VANTRA</span>
            <span className="text-[9.5px] font-mono uppercase tracking-[0.2em] text-white/30 mt-0.5">Studio</span>
          </div>
          {isMobileOpen && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="lg:hidden p-1.5 rounded-lg bg-transparent border-none text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <ScrollArea className="flex-1 px-3 pt-4 pb-4 space-y-6">
          {/* Primary action */}
          <button
            type="button"
            onClick={() => {
              onNewChat?.();
              onCloseMobile?.();
            }}
            className="w-full h-11 rounded-xl bg-white text-black font-semibold text-[13.5px] flex items-center justify-center gap-2 transition-colors hover:bg-white/90 active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]"
          >
            <Plus className="h-4.5 w-4.5 shrink-0" style={{ height: 18, width: 18 }} />
            New Chat
          </button>

          {/* Workspaces */}
          <nav aria-label="Workspaces" className="space-y-1">
            <PanelLabel className="px-2 mb-3">Workspaces</PanelLabel>
            {WORKSPACES.map((ws) => {
              const active = activeWorkspace === ws.id;
              const Icon = ws.icon;
              return (
                <button
                  key={ws.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    onWorkspaceChange?.(ws.id);
                    onCloseMobile?.();
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3.5 h-10 rounded-xl text-[13px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                    active
                      ? 'bg-white/[0.10] text-white'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
                  )}
                >
                  <Icon className={cn('h-4.5 w-4.5 shrink-0', active ? 'text-white' : 'text-white/40')} style={{ height: 18, width: 18 }} />
                  <span className="truncate">{ws.label}</span>
                </button>
              );
            })}
          </nav>

          {/* History */}
          <section aria-label="Recent chats" className="space-y-2">
            <PanelLabel className="px-2 mb-3">Recent</PanelLabel>
            {renderHistory()}
          </section>
        </ScrollArea>

        {/* Usage + profile */}
        <div className="shrink-0 p-3 space-y-3 border-t border-white/[0.08]">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <PanelLabel className="px-0 mb-0">Usage</PanelLabel>
              <span className="text-[11px] text-white/50">{messagesLeft} left</span>
            </div>
            <div
              role="progressbar"
              aria-label="Monthly usage"
              aria-valuenow={usagePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 rounded-full bg-white/10 overflow-hidden"
            >
              <div className="h-full rounded-full bg-white/35 transition-all duration-500" style={{ width: usagePercent + '%' }} />
            </div>
          </div>

          {user ? (
            <div ref={profileRef} className="relative">
              <button
                type="button"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                onClick={() => setProfileOpen((v) => !v)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <span className="h-8 w-8 shrink-0 rounded-lg bg-white/[0.10] border border-white/10 flex items-center justify-center text-[12px] font-semibold text-white">
                  {displayName[0].toUpperCase()}
                </span>
                <span className="flex-1 min-w-0 text-start">
                  <span className="block text-[12.5px] font-medium text-white truncate">{displayName}</span>
                  <span className="block text-[10.5px] text-white/40">Free plan</span>
                </span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/40 transition-transform', profileOpen && 'rotate-180')} />
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  aria-label="Profile menu"
                  className="absolute bottom-full start-0 end-0 mb-2 rounded-xl border border-white/10 bg-[#171717] p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]"
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenSettings?.();
                      onCloseMobile?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12.5px] text-white/80 hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12.5px] text-white/60 hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-white/10 text-[12.5px] font-medium text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
