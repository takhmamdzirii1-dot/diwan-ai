'use client';

import React from 'react';
import {
  LayoutGrid,
  MessageSquarePlus,
  Swords,
  Database,
  Settings,
  LogOut,
  LogIn,
  Crown,
} from 'lucide-react';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import { cn } from '@/lib/utils';

export type DashboardView = 'models' | 'chat' | 'arena' | 'datahub' | 'settings';

interface DashboardSidebarProps {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  onNewChat: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS: { id: DashboardView; label: string; icon: React.ElementType; action?: boolean }[] = [
  { id: 'models', label: 'All Models', icon: LayoutGrid },
  { id: 'chat', label: 'New Studio Chat', icon: MessageSquarePlus, action: true },
  { id: 'arena', label: 'Model Arena', icon: Swords },
  { id: 'datahub', label: 'Data Hub', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function DashboardSidebar({
  activeView,
  onViewChange,
  onNewChat,
  isMobileOpen = false,
  onCloseMobile,
}: DashboardSidebarProps) {
  const { user, signOut } = useUser();
  const { openAuthModal, openTopUpModal } = useModal();

  const handleNav = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.action) {
      onViewChange('chat');
      onNewChat();
    } else {
      onViewChange(item.id);
    }
    onCloseMobile?.();
  };

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
        className={`studio-sidebar flex flex-col fixed lg:static top-0 bottom-0 left-0 z-50 w-[252px] h-full bg-[#08090C]/95 backdrop-blur-xl border-r border-white/[0.06] transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* ── Logo badge with metallic glow ── */}
        <div className="flex items-center gap-3 h-[68px] shrink-0 px-5 border-b border-white/[0.05]">
          <div className="relative">
            <div className="absolute -inset-1 bg-[radial-gradient(circle,rgba(197,160,89,0.35),transparent_70%)] blur-md" />
            <div className="relative bronze-border w-9 h-9 rounded-xl flex items-center justify-center shadow-[0_0_20px_-4px_rgba(197,160,89,0.5)]">
              <img src="/brandmark.svg" alt="VANTRA" className="w-5 h-5 object-contain" />
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-heading font-bold text-[14px] tracking-[0.2em] text-white/95">
              VANTRA
            </span>
            <span className="text-[9px] font-mono tracking-[0.3em] bronze-text mt-1 uppercase">
              Studio v5.4 GOLD
            </span>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar-thin px-3 pt-5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.action ? activeView === 'chat' : activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item)}
                className={cn(
                  'w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer active:scale-[0.98]',
                  active
                    ? 'nav-pill-active text-white'
                    : 'text-white/45 hover:text-white/90 hover:bg-white/[0.04] border border-transparent',
                  item.action && !active && 'border-white/[0.07] bg-white/[0.02]'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    active
                      ? 'text-[#E6C27A]'
                      : item.action
                      ? 'text-[#B8934A]'
                      : 'text-white/35 group-hover:text-white/70'
                  )}
                />
                <span className="truncate">{item.label}</span>
                {active && (
                  <span className="ms-auto w-1.5 h-1.5 rounded-full bg-[#E6C27A] shadow-[0_0_8px_#E6C27A]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Bottom profile card ── */}
        <div className="p-3 shrink-0">
          {user ? (
            <div className="bronze-border rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#B8934A] to-[#8A6D3B] flex items-center justify-center font-bold text-white text-[13px] shadow-[0_0_16px_-4px_rgba(0,180,216,0.6)]">
                  {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[12.5px] font-semibold text-white/95 truncate">
                    {displayName}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold tracking-[0.18em] uppercase bronze-text">
                    <Crown className="h-2.5 w-2.5 text-[#C5A059]" />
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
                className="w-full h-9 rounded-xl bg-gradient-to-r from-[#B8934A]/15 via-transparent to-[#8A6D3B]/15 border border-white/[0.08] text-[11.5px] font-semibold text-white/75 hover:text-white hover:border-[#C5A059]/40 transition-all cursor-pointer active:scale-[0.98]"
              >
                Manage Credits
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bronze-border text-[#E6C27A] text-[12.5px] font-semibold hover:brightness-125 transition-all cursor-pointer active:scale-[0.98]"
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
