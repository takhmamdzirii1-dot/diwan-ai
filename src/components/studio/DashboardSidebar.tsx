'use client';

import React from 'react';
import {
  MessageSquareText,
  Palette,
  Clapperboard,
  Settings,
  LogOut,
  LogIn,
  Crown,
} from 'lucide-react';
import { VantraLogo } from '../VantraLogo';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import { cn } from '@/lib/utils';

export type DashboardView = 'models' | 'chat' | 'arena' | 'datahub' | 'settings';
export type Workspace = 'chat' | 'image' | 'video';

interface DashboardSidebarProps {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  activeWorkspace?: Workspace;
  onWorkspaceChange?: (w: Workspace) => void;
  onOpenSettings?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const WORKSPACES: { id: Workspace; label: string; icon: React.ElementType }[] = [
  { id: 'chat', label: 'Text Studio', icon: MessageSquareText },
  { id: 'image', label: 'Image Canvas', icon: Palette },
  { id: 'video', label: 'Motion Studio', icon: Clapperboard },
];

export default function DashboardSidebar({
  activeWorkspace = 'chat',
  onWorkspaceChange,
  onOpenSettings,
  isMobileOpen = false,
  onCloseMobile,
}: DashboardSidebarProps) {
  const { user, signOut } = useUser();
  const { openAuthModal, openTopUpModal } = useModal();

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest';

  return (
    <>
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md lg:hidden cursor-pointer"
        />
      )}

      <aside
        className={`studio-sidebar flex flex-col fixed lg:static top-0 bottom-0 start-0 z-50 w-[252px] h-full bg-[#08090C]/95 backdrop-blur-xl border-r border-white/[0.06] transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0'
        }`}
      >
        {/* ── Logo badge with metallic glow ── */}
        <div className="flex items-center gap-3 h-[68px] shrink-0 px-5 border-b border-white/[0.05]">
          <div className="relative">
            <div className="absolute -inset-1 bg-[radial-gradient(circle,rgba(255,255,255,0.35),transparent_70%)] blur-md" />
            <div className="relative border border-white/10 w-9 h-9 rounded-xl flex items-center justify-center">
              <VantraLogo className="w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-heading font-bold text-[14px] tracking-[0.2em] text-white/95">
              VANTRA
            </span>
            <span className="text-[9px] font-mono tracking-[0.3em] text-gray-400 mt-1 uppercase">
              Studio v6.1 GOLD
            </span>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar-thin px-3 pt-5 space-y-1">
          {/* Workspaces */}
          <p className="px-3 pb-2 text-[9.5px] font-mono font-semibold tracking-[0.22em] uppercase text-white/25">
            Workspaces
          </p>
          {WORKSPACES.map((ws) => {
            const active = activeWorkspace === ws.id;
            const Icon = ws.icon;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  onWorkspaceChange?.(ws.id);
                  onCloseMobile?.();
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3.5 h-11 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer active:scale-[0.98]',
                  active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    active ? 'text-white' : 'text-white/40'
                  )}
                />
                <span className="truncate">{ws.label}</span>
                {active && (
                  <span className="ms-auto w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Bottom: Settings + profile ── */}
        <div className="p-3 shrink-0 space-y-1">
          <button
            type="button"
            onClick={() => {
              onOpenSettings?.();
              onCloseMobile?.();
            }}
            className="w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-[13px] font-medium text-white/45 hover:text-white/90 hover:bg-white/[0.04] border border-transparent transition-all duration-200 cursor-pointer active:scale-[0.98]"
          >
            <Settings className="h-4 w-4 shrink-0 text-white/35" />
            <span className="truncate">Settings</span>
          </button>
          {user ? (
            <div className="border border-white/10 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#9CA3AF] to-[#6B7280] flex items-center justify-center font-bold text-white text-[13px] shadow-[0_0_16px_-4px_rgba(0,180,216,0.6)]">
                  {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[12.5px] font-semibold text-white/95 truncate">
                    {displayName}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold tracking-[0.18em] uppercase text-gray-400">
                    <Crown className="h-2.5 w-2.5 text-[#D1D5DB]" />
                    Vantra Pro
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="p-1.5 text-white/30 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Log out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => openTopUpModal()}
                className="w-full h-9 rounded-xl bg-gradient-to-r from-[#9CA3AF]/15 via-transparent to-[#6B7280]/15 border border-white/[0.08] text-[11.5px] font-semibold text-white/75 hover:text-white hover:border-[#D1D5DB]/40 transition-all cursor-pointer active:scale-[0.98]"
              >
                Manage Credits
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-white/10 text-[#FFFFFF] text-[12.5px] font-semibold hover:brightness-125 transition-all cursor-pointer active:scale-[0.98]"
            >
              <LogIn className="h-4 w-4" />
              Sign in to Studio
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
