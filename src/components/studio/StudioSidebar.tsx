'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Image as ImageIcon,
  Video,
  Plus,
  ArrowLeft,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  LogOut,
  FolderKanban,
  Settings,
  Command,
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

// ---------------------------------------------------------------------------
// Reusable NavItem Component
// ---------------------------------------------------------------------------
type NavItemData = {
  id: string;
  title: string;
  icon: React.ElementType;
  shortcut?: string;
  badge?: number;
  children?: NavItemData[];
  onSelect?: () => void;
  onActionClick?: (e: React.MouseEvent) => void;
  ActionIcon?: React.ElementType;
};

function NavItem({
  item,
  activeId,
  level = 0,
}: {
  item: NavItemData;
  activeId: string | null;
  level?: number;
}) {
  const isActive = activeId === item.id;
  const hasChildren = !!item.children;
  const [isOpen, setIsOpen] = useState(true); // Default open for history

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    } else if (item.onSelect) {
      item.onSelect();
    }
  };

  return (
    <div className="flex flex-col w-full">
      <div
        className={`group flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-300 select-none
          ${
            isActive
              ? 'bg-gradient-to-r from-[#1FD8B8]/20 to-transparent text-white font-bold shadow-[inset_2px_0_10px_rgba(31,216,184,0.15)] border-l-[3px] border-[#1FD8B8]'
              : 'text-[#94A3B8] hover:bg-white/5 hover:text-white border-l-[3px] border-transparent'
          }
        `}
        style={{ paddingLeft: `${level * 12 + 10}px` }}
        onClick={handleClick}
      >
        <div className="flex items-center gap-2.5 truncate">
          <item.icon
            className={`w-[16px] h-[16px] transition-colors shrink-0
              ${isActive ? 'text-[#1FD8B8]' : 'text-[#64748B] group-hover:text-white'}
            `}
            strokeWidth={2}
          />
          <span className="text-xs tracking-wide truncate">{item.title}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {item.shortcut && (
            <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium font-mono text-[#64748B] bg-white/[0.04] border border-white/[0.08] rounded-[4px]">
              {item.shortcut}
            </kbd>
          )}
          {item.badge !== undefined && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-[#1FD8B8]/10 text-[#1FD8B8]">
              {item.badge}
            </span>
          )}
          {item.ActionIcon && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                item.onActionClick?.(e);
              }}
              className="opacity-0 group-hover:opacity-100 text-[#64748B] hover:text-red-400 p-1 transition"
            >
              <item.ActionIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {hasChildren && (
            <ChevronRight
              className={`w-3.5 h-3.5 text-[#64748B] transition-transform duration-200 ${
                isOpen ? 'rotate-90' : ''
              }`}
              strokeWidth={2}
            />
          )}
        </div>
      </div>

      {hasChildren && (
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
            isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden min-h-0 relative flex flex-col gap-0.5 mt-0.5">
            <div
              className="absolute top-0 bottom-0 border-l border-white/5"
              style={{ left: `${level * 12 + 17.5}px` }}
            />
            {item.children!.map((child) => (
              <NavItem
                key={child.id}
                item={child}
                activeId={activeId}
                level={level + 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace Switcher Component
// ---------------------------------------------------------------------------
function WorkspaceSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative z-50">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-2.5 py-2.5 mb-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors select-none group border border-transparent hover:border-white/[0.06]"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#1FD8B8] to-[#0EA98E] flex items-center justify-center text-[#050506] shadow-inner font-bold text-lg">
            <img src="/brandmark.svg" alt="V" className="h-4 w-4 mix-blend-difference opacity-80" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[13px] font-bold leading-none mb-1 text-white tracking-wide">
              VANTRA STUDIO
            </span>
            <span className="text-[10px] text-[#1FD8B8] font-mono leading-none font-bold">
              PRO ACCESS
            </span>
          </div>
        </div>
        <ChevronDown
          className="w-4 h-4 text-[#64748B] group-hover:text-white transition-colors shrink-0"
          strokeWidth={2}
        />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-[56px] left-0 w-full bg-[#0A0B0D]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl z-50 py-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
            <div
              className="px-3 py-2 mx-1.5 text-[12px] rounded-lg cursor-pointer transition-colors bg-[#1FD8B8]/10 text-white font-bold flex items-center gap-2"
              onClick={() => setIsOpen(false)}
            >
              <div className="h-2 w-2 rounded-full bg-[#1FD8B8] animate-pulse" />
              Main Workspace
            </div>
            <Link
              href="/"
              className="px-3 py-2 mx-1.5 text-[12px] text-[#94A3B8] hover:bg-white/5 hover:text-white rounded-lg cursor-pointer flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Exit to Landing Page
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar Component
// ---------------------------------------------------------------------------
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

  // Map history sessions to NavItemData
  const historyNavItems: NavItemData[] = filteredSessions.map((session) => ({
    id: session.id,
    title: session.title,
    icon: Sparkles,
    ActionIcon: Trash2,
    onSelect: () => {
      onSelectSession(session.id);
      onCloseMobile?.();
    },
    onActionClick: (e) => onDeleteSession(session.id, e),
  }));

  // Build the unified Navigation structure
  const navigationGroups = [
    {
      heading: 'Create',
      items: [
        {
          id: 'new-session',
          title: 'New Session',
          icon: Plus,
          shortcut: '⌘N',
          onSelect: () => {
            onNewSession();
            onCloseMobile?.();
          },
        },
      ],
    },
    {
      heading: 'Studios',
      items: [
        {
          id: 'chat',
          title: 'AI Chat Studio',
          icon: MessageSquare,
          onSelect: () => {
            onSelectMode('chat');
            onCloseMobile?.();
          },
        },
        {
          id: 'image',
          title: 'Image Generation',
          icon: ImageIcon,
          onSelect: () => {
            onSelectMode('image');
            onCloseMobile?.();
          },
        },
        {
          id: 'video',
          title: 'Video Generation',
          icon: Video,
          onSelect: () => {
            onSelectMode('video');
            onCloseMobile?.();
          },
        },
      ],
    },
    {
      heading: 'Workspace',
      items: [
        {
          id: 'history-folder',
          title: 'Recent Sessions',
          icon: FolderKanban,
          badge: filteredSessions.length,
          children: historyNavItems.length > 0 ? historyNavItems : [
            {
              id: 'empty-history',
              title: 'No previous sessions',
              icon: Command,
              onSelect: () => {}, // No-op
            }
          ],
        },
      ],
    },
  ];

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
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-[280px] flex flex-col justify-between border-r border-white/5 bg-[#0A0B0D]/80 backdrop-blur-xl p-3 font-sans transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex-1 flex flex-col min-h-0">
          <WorkspaceSwitcher />

          {/* Search Placeholder / Quick Action */}
          <div className="px-1 mb-4 mt-1">
            <div className="group flex items-center justify-between px-3 py-2 bg-white/[0.03] border border-white/[0.08] hover:border-[#1FD8B8]/30 hover:bg-white/[0.05] rounded-xl cursor-text transition-colors select-none">
              <div className="flex items-center gap-2.5">
                <Command className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#1FD8B8] transition-colors" />
                <span className="text-[12px] text-[#64748B] group-hover:text-white/80 transition-colors">Search or jump to...</span>
              </div>
              <kbd className="inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium font-mono text-[#64748B] bg-white/[0.04] border border-white/[0.08] rounded-[4px]">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-5 px-1 pb-4">
            {navigationGroups.map((group, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                {group.heading && (
                  <span className="px-2.5 mb-1 text-[10px] font-bold tracking-wider text-[#64748B] uppercase font-heading">
                    {group.heading}
                  </span>
                )}
                {group.items.map((item) => {
                  // Determine active state manually since modes are special
                  let isItemActive = false;
                  if (item.id === currentMode) isItemActive = true;
                  else if (item.id === 'history-folder') {
                     // The folder itself is not the active session, its children are.
                     // But we can let NavItem handle child active state.
                     isItemActive = false;
                  }

                  return (
                    <NavItem
                      key={item.id}
                      item={item}
                      activeId={isItemActive ? item.id : activeSessionId}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Profile & Top-Up Section */}
        <div className="pt-4 mt-2 border-t border-white/5 space-y-2 relative z-10 px-1">
          
          {/* Top Up Card */}
          <div 
            onClick={() => openTopUpModal()}
            className="group flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer hover:bg-white/[0.02] hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1FD8B8] opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#1FD8B8]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-[#64748B] uppercase font-mono leading-none tracking-wider mb-1">
                  Credits Balance
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono font-bold text-sm text-white leading-none">
                    {balance.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#1FD8B8] font-bold">PTS</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-[#1FD8B8]/10 group-hover:bg-[#1FD8B8]/20 border border-[#1FD8B8]/30 text-[#1FD8B8] transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* User Details */}
          {user && (
            <div className="flex flex-col gap-0.5 pt-2">
              <div 
                className="group flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2.5 truncate max-w-[180px]">
                  <Settings className="w-[16px] h-[16px] text-[#64748B] group-hover:text-white transition-colors" strokeWidth={2} />
                  <span className="text-xs text-[#94A3B8] group-hover:text-white tracking-wide">Settings</span>
                </div>
              </div>
              
              <div 
                onClick={() => signOut()}
                className="group flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-colors"
              >
                <div className="flex items-center gap-2.5 truncate max-w-[180px]">
                  <LogOut className="w-[16px] h-[16px] text-[#64748B] group-hover:text-red-400 transition-colors" strokeWidth={2} />
                  <span className="text-xs text-[#94A3B8] group-hover:text-red-400 tracking-wide">Log Out</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
