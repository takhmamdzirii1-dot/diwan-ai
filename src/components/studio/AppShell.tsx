'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { VantraLogo } from '../VantraLogo';

/* ── Design tokens (monochrome only) ───────────────────────
   #090909  canvas
   #101010  surface
   #171717  raised surface
   white/…  neutral text + active states
   ───────────────────────────────────────────────────────── */
export const SHELL_TOKENS = {
  canvas: 'var(--studio-bg)',
  surface: 'var(--studio-surface)',
  raised: 'var(--studio-surface-raised)',
  border: 'var(--studio-border)',
  topBarHeight: 56,
  sidebarWidth: 280,
} as const;

/** Fixed-height top bar shared by every workspace. */
export function TopBar({
  title,
  subtitle,
  onOpenNav,
  actions,
}: {
  title: string;
  subtitle?: string;
  onOpenNav?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <header
      className="shrink-0 flex items-center gap-3 px-4 border-b border-[var(--studio-border-subtle)] bg-[var(--studio-surface)]/90 backdrop-blur-xl"
      style={{ height: SHELL_TOKENS.topBarHeight }}
    >
      {onOpenNav && (
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="lg:hidden shrink-0 h-9 w-9 -ms-1 flex items-center justify-center rounded-lg bg-transparent border-none text-white/80 hover:text-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-colors cursor-pointer active:scale-95"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      )}

      <div className="min-w-0 flex-1 flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg border border-white/10 flex items-center justify-center bg-white/[0.04] lg:hidden shrink-0">
          <VantraLogo className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[14px] font-semibold text-white truncate leading-tight">{title}</h1>
          {subtitle && <p className="text-[11.5px] text-white/55 truncate leading-tight mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Workspace frame: top bar + scroll-safe body. */
export function WorkspaceShell({
  title,
  subtitle,
  onOpenNav,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  onOpenNav?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col h-full min-h-0 bg-[var(--studio-bg)]', className)}>
      <TopBar title={title} subtitle={subtitle} onOpenNav={onOpenNav} actions={actions} />
      <div className="flex-1 min-h-0 relative">{children}</div>
    </div>
  );
}

/** Scroll container with hidden native scrollbars. */
export const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function ScrollArea({ children, className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        {...rest}
        className={cn(
          'overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          className
        )}
      >
        {children}
      </div>
    );
  }
);

/** Section label used across panels and popovers. */
export function PanelLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('px-1 mb-2 text-[11px] font-semibold tracking-widest uppercase text-white/50', className)}>
      {children}
    </p>
  );
}

/** Accessible segmented control with a sliding white indicator. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  layoutId,
  label,
  size = 'md',
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  layoutId: string;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(options[(i + 1) % options.length].value);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(options[(i - 1 + options.length) % options.length].value);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.07]',
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative rounded-full font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none',
              size === 'sm' ? 'h-7 px-3 text-[11.5px]' : 'h-8 px-4 text-[12.5px]',
              active ? 'text-black' : 'text-white/50 hover:text-white/80'
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                data-indicator={layoutId}
                className="absolute inset-0 z-0 bg-white rounded-full"
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Primary action button — pure white, monochrome only. */
export function PrimaryButton({
  children,
  disabled,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={cn(
        'h-11 rounded-xl text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--studio-bg)] motion-reduce:transition-none',
        disabled
          ? 'bg-white/10 text-white/50 border border-white/10 cursor-not-allowed'
          : 'bg-white text-black hover:bg-white/90 active:scale-[0.99] cursor-pointer',
        className
      )}
    >
      {children}
    </button>
  );
}

/** Secondary / ghost button. */
export function GhostButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        'h-9 px-3.5 rounded-xl border border-[var(--studio-border)] text-[12.5px] font-medium text-[var(--studio-text-secondary)] hover:text-white hover:bg-[var(--studio-hover)] transition-colors duration-150 cursor-pointer inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:text-[var(--studio-text-disabled)] disabled:cursor-not-allowed motion-reduce:transition-none',
        className
      )}
    >
      {children}
    </button>
  );
}

/** Empty / error / loading state block. */
export function StateBlock({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6', className)}>
      {icon && (
        <div className="h-16 w-16 rounded-2xl border border-white/[0.08] bg-white/[0.025] flex items-center justify-center text-white/20">
          {icon}
        </div>
      )}
      <p className="mt-5 text-[14.5px] font-medium text-white/80">{title}</p>
      {description && <p className="mt-1.5 text-xs text-white/50 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
