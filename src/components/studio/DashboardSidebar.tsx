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
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
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
}

const CREATE_ITEMS: { id: Workspace; label: 'chat' | 'image' | 'video'; icon: React.ElementType }[] = [
  { id: 'chat', label: 'chat', icon: MessageSquare },
  { id: 'image', label: 'image', icon: ImageIcon },
  { id: 'video', label: 'video', icon: Video },
];

const WORKSPACE_ITEMS: { id: Workspace; label: 'library'; icon: React.ElementType }[] = [
  { id: 'library', label: 'library', icon: FolderOpen },
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
}: DashboardSidebarProps) {
  const t = useTranslations('studio.sidebar');
  const { user, signOut, balance, isLoading } = useUser();
  const { openAuthModal } = useModal();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('guest');
  const historyCopy = {
    chat: { label: t('recentChats'), empty: t('noRecentChats') },
    image: { label: t('recentGenerations'), empty: t('noRecentGenerations') },
    video: { label: t('recentRenders'), empty: t('noRecentRenders') },
    library: { label: t('recentCreations'), empty: t('noRecentCreations') },
  }[activeWorkspace];

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
    if (activeWorkspace !== 'chat' || sessions.length === 0) {
      return (
        <p className="px-2 py-1 text-[11px] text-white/45 italic">{historyCopy.empty}</p>
      );
    }
    return (
      <div className="space-y-0.5">
        {sessions.map((session) => {
          const active = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              className={cn(
                'group relative flex items-center rounded-lg transition-colors',
                active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
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
                  'flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-2 text-start text-[12.5px] cursor-pointer transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                  active ? 'text-white font-medium' : 'text-white/60 hover:text-white'
                )}
              >
                <MessageSquare className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-white' : 'text-white/40')} />
                <span className="truncate">{session.title}</span>
              </button>
              {onDeleteSession && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  aria-label={t('deleteChat', { title: session.title })}
                  className="shrink-0 me-1 p-1 rounded-md text-white/25 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <Trash2 className="h-3 w-3" />
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
        aria-label={t('navigation')}
        aria-hidden={!isMobileOpen ? undefined : false}
        className={cn(
          'flex flex-col fixed lg:static top-0 bottom-0 start-0 z-50 w-64 h-full bg-[var(--studio-surface)] border-e border-[var(--studio-border-subtle)] transition-transform duration-250 motion-reduce:transition-none',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand — matches 56px top bar height */}
        <div className="flex items-center justify-between h-14 shrink-0 px-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg border border-white/10 flex items-center justify-center bg-white/[0.03]">
              <VantraLogo className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-semibold tracking-[0.14em] text-white">VANTRA</span>
            <span className="text-[9.5px] font-mono uppercase tracking-[0.2em] text-white/30 mt-0.5">Studio</span>
          </div>
          {isMobileOpen && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label={t('closeNavigation')}
              className="lg:hidden p-1.5 rounded-lg bg-transparent border-none text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <ScrollArea className="flex-1 px-3 pt-3 pb-4 space-y-5">
          {/* Primary action */}
          <button
            type="button"
            onClick={() => {
              onNewChat?.();
              onCloseMobile?.();
            }}
            className="w-full h-9 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-white font-medium text-[13px] flex items-center justify-center gap-2 transition-colors active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {t('newChat')}
          </button>

          {/* Group 1: CREATE */}
          <nav aria-label="Create tools" className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/35 font-medium mb-1.5 px-2">
              {t('create')}
            </p>
            {CREATE_ITEMS.map((ws) => {
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
                    'w-full flex items-center gap-2.5 px-2.5 h-8.5 rounded-lg text-[12.5px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                    active
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-white/40')} />
                  <span className="truncate">{t(ws.label)}</span>
                </button>
              );
            })}
          </nav>

          {/* Group 2: WORKSPACE */}
          <nav aria-label="Workspace tools" className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/35 font-medium mb-1.5 px-2">
              {t('workspace')}
            </p>
            {WORKSPACE_ITEMS.map((ws) => {
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
                    'w-full flex items-center gap-2.5 px-2.5 h-8.5 rounded-lg text-[12.5px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                    active
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-white/40')} />
                  <span className="truncate">{t(ws.label)}</span>
                </button>
              );
            })}
          </nav>

          <nav aria-label={t('system')} className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/35 font-medium mb-1.5 px-2">
              {t('system')}
            </p>
            <button
              type="button"
              onClick={() => {
                onOpenSettings?.();
                onCloseMobile?.();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 h-8.5 rounded-lg text-[12.5px] font-medium text-white/65 hover:text-white hover:bg-white/[0.05] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <Settings className="h-4 w-4 shrink-0 text-white/45" />
              <span className="truncate">{t('settings')}</span>
            </button>
          </nav>

          {/* Group 3: RECENT */}
          <section aria-label={historyCopy.label} className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/35 font-medium mb-1.5 px-2">
              {historyCopy.label}
            </p>
            {renderHistory()}
          </section>
        </ScrollArea>

        {/* Verified credits + profile */}
        <div className="shrink-0 p-3 space-y-3 border-t border-white/[0.08]">
          <div className="rounded-xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface-raised)] px-3 py-2.5">
            <PanelLabel className="px-0 mb-1">{t('unifiedCredits')}</PanelLabel>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] text-[var(--studio-text-muted)]">{t('balance')}</span>
              <span className="font-mono text-[12px] font-semibold text-white" aria-live="polite">
                {user && !isLoading ? balance.toLocaleString() : '—'}
              </span>
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
                  <span className="block text-[10.5px] text-white/40">{t('freePlan')}</span>
                </span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-white/40 transition-transform', profileOpen && 'rotate-180')} />
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  aria-label={t('profileMenu')}
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
                    {t('settings')}
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
                    {t('signOut')}
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
              {t('signIn')}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
