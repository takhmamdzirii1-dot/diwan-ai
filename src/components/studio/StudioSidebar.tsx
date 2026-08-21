'use client';

import React, { useState } from 'react';
import { 
  Search, 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  Settings, 
  LogOut,
  Hash,
  ChevronDown,
  ChevronRight,
  Inbox,
  Calendar,
  Activity,
  CreditCard,
  Globe,
  Terminal,
  Blocks,
  Command,
  MessageSquare,
  Image as ImageIcon,
  Video,
  Sparkles,
  Trash2,
  Plus,
  ArrowLeft
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
  model: string;
}

export type NavItemData = {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: number | string;
  shortcut?: string;
  children?: NavItemData[];
  onSelect?: () => void;
  ActionIcon?: React.ElementType;
  onActionClick?: (e: React.MouseEvent) => void;
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

// ---------------------------------------------------------------------------
// Workspace Switcher (Mimicking Acme Corp exactly)
// ---------------------------------------------------------------------------
function WorkspaceSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative px-3 pt-3 mb-2">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors select-none group"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-[6px] bg-white/[0.08] border border-white/5 flex items-center justify-center font-bold shadow-sm text-white">
            <img src="/brandmark.svg" alt="V" className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[13px] font-medium leading-none mb-1 text-white truncate max-w-[120px]">
              VANTRA STUDIO
            </span>
            <span className="text-[11px] text-white/40 leading-none">Pro Plan</span>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors shrink-0" strokeWidth={1.5} />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-[52px] left-0 w-full bg-[#0E1015] border border-white/10 rounded-lg shadow-xl z-50 py-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
            <div 
              onClick={() => setIsOpen(false)}
              className="px-3 py-2 mx-1 text-[13px] rounded-md cursor-pointer transition-colors bg-[#1FD8B8]/10 text-[#1FD8B8] font-medium"
            >
              VANTRA STUDIO
            </div>
            <div className="h-px bg-white/10 my-1 mx-2" />
            <Link href="/" className="px-3 py-2 mx-1 text-[13px] text-[#94A3B8] hover:bg-white/5 rounded-md cursor-pointer flex items-center gap-2 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Exit to Home
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clean NavItem Component
// ---------------------------------------------------------------------------
function NavItem({ 
  item, 
  activeId, 
  level = 0
}: { 
  item: NavItemData; 
  activeId: string | null; 
  level?: number;
}) {
  const isActive = activeId === item.id;
  const hasChildren = !!item.children;
  const [isOpen, setIsOpen] = useState(true); // Open by default for history

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
        className={`group flex items-center justify-between px-3 py-2.5 mx-2 rounded-xl cursor-pointer transition-all select-none overflow-hidden
          ${isActive 
            ? 'bg-[#1FD8B8]/[0.09] text-white font-medium shadow-sm ring-1 ring-[#1FD8B8]/10' 
            : 'text-sm font-medium text-white/55 hover:text-white hover:bg-white/[0.05]'
          }
        `}
        style={{ paddingLeft: `${level === 0 ? 12 : level * 12 + 12}px` }}
        onClick={handleClick}
      >
        <div className="flex items-center gap-3 truncate w-full">
          <item.icon 
            className={`w-4 h-4 shrink-0 transition-colors
              ${isActive ? 'text-white' : 'text-white/40 group-hover:text-white/70'}
            `} 
            strokeWidth={1.5} 
          />
          <span className="truncate w-full text-left" dir="auto">
            {item.title}
          </span>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {item.shortcut && (
             <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium font-mono text-[#64748B] bg-white/[0.03] border border-white/10 rounded-[4px] shadow-xs">
               {item.shortcut}
             </kbd>
          )}
          {item.badge !== undefined && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium rounded-full bg-white/10 text-white/80">
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
              className={`w-3.5 h-3.5 text-[#64748B] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} 
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
            {item.children!.map(child => (
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
// Main SidebarNav Component
// ---------------------------------------------------------------------------
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

  const historyItems: NavItemData[] = filteredSessions.map(session => ({
    id: session.id,
    title: session.title,
    icon: Hash,
    ActionIcon: Trash2,
    onSelect: () => {
      onSelectSession(session.id);
      onCloseMobile?.();
    },
    onActionClick: (e) => onDeleteSession(session.id, e),
  }));

  const mockNavGroups: NavGroupData[] = [
    {
      items: [
        { 
          id: 'search', 
          title: 'Search', 
          icon: Search, 
          shortcut: '⌘K',
          onSelect: () => {} 
        },
        { 
          id: 'new', 
          title: 'New Session', 
          icon: Plus, 
          shortcut: '⌘N',
          onSelect: () => {
            onNewSession();
            onCloseMobile?.();
          } 
        },
      ]
    },
    {
      heading: 'Create',
      items: [
        { 
          id: 'chat', 
          title: 'AI Chat', 
          icon: MessageSquare,
          onSelect: () => { onSelectMode('chat'); onCloseMobile?.(); }
        },
        { 
          id: 'coding', 
          title: 'Coding & Analysis', 
          icon: Terminal,
          onSelect: () => { onSelectMode('chat'); onCloseMobile?.(); }
        },
        { 
          id: 'image', 
          title: 'Image Generator', 
          icon: ImageIcon,
          onSelect: () => { onSelectMode('image'); onCloseMobile?.(); }
        },
        { 
          id: 'video', 
          title: 'Video Engine', 
          icon: Video,
          onSelect: () => { onSelectMode('video'); onCloseMobile?.(); }
        },
      ]
    },
    {
      heading: 'Build',
      items: [
        { 
          id: 'clone', 
          title: 'Clone UI', 
          icon: ImageIcon,
          onSelect: () => {} 
        },
        { 
          id: 'figma', 
          title: 'Import Figma', 
          icon: Blocks,
          onSelect: () => {} 
        },
      ]
    },
    {
      heading: 'Workspace',
      items: [
        { 
          id: 'models', 
          title: 'Models', 
          icon: Command,
          onSelect: () => {}
        },
        { 
          id: 'projects', 
          title: 'Recent Sessions', 
          icon: FolderKanban,
          badge: filteredSessions.length,
          children: historyItems.length > 0 ? historyItems : [
            { id: 'empty', title: 'No recent activity', icon: Hash }
          ]
        },
        { 
          id: 'wallet', 
          title: 'Credits Balance', 
          icon: CreditCard,
          badge: balance,
          onSelect: () => openTopUpModal()
        },
      ]
    },
    {
      heading: 'Developers',
      items: [
        { id: 'api', title: 'API Keys', icon: Terminal, onSelect: () => {} },
        { id: 'webhooks', title: 'Webhooks', icon: Blocks, onSelect: () => {} },
      ]
    },
    {
      heading: 'Settings',
      items: [
        { id: 'settings', title: 'Settings', icon: Settings, shortcut: '⌘,', onSelect: () => {} },
      ]
    }
  ];

  const mockBottomItems: NavItemData[] = [];

  return (
    <>
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md lg:hidden cursor-pointer"
        />
      )}

      <aside className={`studio-sidebar flex flex-col fixed lg:static top-0 bottom-0 left-0 z-50 w-[292px] h-full bg-[#08080b] border-r border-white/[0.08] font-sans transition-transform duration-300 shadow-2xl shadow-black/20 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <WorkspaceSwitcher />

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col gap-5 mt-4">
          {mockNavGroups.map((group, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              {group.heading && (
                <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest px-3 mb-2 mt-6">
                  {group.heading}
                </span>
              )}
              {group.items.map(item => {
                let isItemActive = false;
                if (item.id === currentMode) isItemActive = true;
                
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

        <div className="mt-auto m-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
             <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#1FD8B8] to-[#0EA98E] flex items-center justify-center font-bold text-[#050506] shadow-inner text-sm">
                  {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-medium text-white/90 truncate max-w-[90px]">
                    {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                  </span>
                  <span className="text-[10px] text-white/40">Free Plan</span>
                </div>
             </div>
             <button
               onClick={() => signOut()}
               className="p-1.5 text-white/40 hover:text-white/90 hover:bg-white/10 rounded-md transition-colors"
               title="Log Out"
             >
               <LogOut className="h-3.5 w-3.5" />
             </button>
          </div>

          <div className="flex items-center justify-between">
             <div className="flex flex-col">
               <span className="text-[10px] text-white/40 font-medium">Balance</span>
               <span className="text-[13px] font-mono font-medium text-white">{balance.toLocaleString()} <span className="text-[10px] text-[#1FD8B8]">PTS</span></span>
             </div>
             <button 
               onClick={() => openTopUpModal()}
               className="px-2.5 py-1.5 rounded-md bg-[#1FD8B8]/10 text-[#1FD8B8] text-[11px] font-medium hover:bg-[#1FD8B8]/20 transition-colors"
             >
               Top up
             </button>
          </div>
        </div>
      </aside>
    </>
  );
}
