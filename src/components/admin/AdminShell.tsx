'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Activity, Bell, Boxes, ChevronDown, CreditCard, ExternalLink, LayoutDashboard, ScrollText, Search, Server, Settings2, Tags, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VantraLogo } from '@/src/components/VantraLogo';
import AdminRealtime from './AdminRealtime';

const NAV_GROUPS = [
  { key: null, items: [{ href: '/admin', key: 'overview', icon: LayoutDashboard }] },
  { key: 'business', items: [
    { href: '/admin/payments?view=payments', key: 'payments', icon: CreditCard },
    { href: '/admin/payments?view=plans', key: 'plans', icon: Tags },
    { href: '/admin/users', key: 'users', icon: Users },
  ] },
  { key: 'aiOperations', items: [
    { href: '/admin/models', key: 'models', icon: Boxes },
    { href: '/admin/providers', key: 'providers', icon: Server },
    { href: '/admin/jobs', key: 'jobs', icon: Activity },
  ] },
  { key: 'system', items: [
    { href: '/admin/runtime', key: 'runtime', icon: Settings2 },
    { href: '/admin/audit', key: 'audit', icon: ScrollText },
  ] },
] as const;

export default function AdminShell({ children, realtimeOwner, ownerName, ownerEmail }: {
  children: React.ReactNode;
  realtimeOwner: boolean;
  ownerName: string;
  ownerEmail: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('Admin');
  const initials = ownerName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'VA';

  return (
    <div className="admin-root min-h-screen bg-[var(--studio-canvas)] text-[var(--studio-text-primary)] [--section-padding:0px] lg:grid lg:items-start lg:grid-cols-[224px_minmax(0,1fr)]">
      <AdminRealtime canSubscribe={realtimeOwner} />
      <aside className="border-b border-[var(--studio-border)] bg-[var(--studio-sidebar)] lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-e">
        <div className="flex h-[60px] items-center justify-between gap-3 border-b border-[var(--studio-border-subtle)] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--studio-border)] bg-white/[0.04]">
              <VantraLogo className="h-5 w-5" />
            </span>
            <div className="min-w-0 text-start">
              <p className="truncate text-[13px] font-semibold text-[var(--studio-text-primary)]">{t('brand')}</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--studio-text-muted)]">{t('internal')}</p>
            </div>
          </div>
        </div>

        <nav aria-label={t('brand')} className="flex gap-1 overflow-x-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:gap-4 lg:px-2.5 lg:py-3">
          {NAV_GROUPS.map((group) => <div key={group.key ?? 'overview'} className="flex shrink-0 gap-1 lg:flex-col">
            {group.key && <p className="hidden px-3 pb-1 pt-1 text-start text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[var(--studio-text-muted)] lg:block">{t(`navGroups.${group.key}`)}</p>}
            {group.items.map(({ href, key, icon: Icon }) => {
              const [path, query] = href.split('?');
              const requestedView = new URLSearchParams(query ?? '').get('view');
              const currentView = searchParams.get('view') ?? 'payments';
              const active = path === '/admin' ? pathname === path : pathname === path && (!requestedView || requestedView === currentView);
              return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-[12.5px] font-medium transition-[color,background-color,border-color] duration-150 motion-reduce:transition-none',
                  active
                    ? 'border border-[var(--studio-border-strong)] bg-[var(--studio-selected)] font-semibold text-[var(--studio-text-primary)]'
                    : 'border border-transparent text-[var(--studio-text-secondary)] hover:border-[var(--studio-border)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)]'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{key === 'runtime' ? 'Limits & Fallback' : t(`nav.${key}`)}</span>
              </Link>
              );
            })}
          </div>)}
        </nav>

        <div className="hidden p-2.5 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <Link
            href="/studio/chat"
            prefetch={false}
            className="flex h-10 items-center justify-between rounded-xl border border-[var(--studio-border)] px-3 text-[12.5px] font-medium text-[var(--studio-text-secondary)] transition-[color,background-color,border-color] duration-150 hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] motion-reduce:transition-none"
          >
            {t('backToStudio')}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </aside>

      <main className="min-w-0">
        <div className="flex h-[60px] items-center justify-between gap-3 border-b border-[var(--studio-border-subtle)] px-4 sm:px-5 lg:px-7">
          <form action="/admin/users" method="get" className="relative w-full max-w-[438px]">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--studio-text-secondary)]" aria-hidden="true" />
            <label htmlFor="admin-global-search" className="sr-only">Search users, models, jobs</label>
            <input
              id="admin-global-search"
              name="q"
              defaultValue={pathname === '/admin/users' ? searchParams.get('q') ?? '' : ''}
              placeholder="Search users, models, jobs..."
              className="h-10 w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-card)] ps-10 pe-3 text-[12px] text-[var(--studio-text-primary)] outline-none placeholder:text-[var(--studio-text-secondary)] focus:border-[var(--studio-border-strong)]"
            />
          </form>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/admin/audit" prefetch={false} aria-label="Open Audit Log" className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)]">
              <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            <span className="hidden h-7 w-px bg-[var(--studio-border-subtle)] sm:block" aria-hidden="true" />
            <details className="group relative hidden sm:block">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg px-1.5 py-1 text-start hover:bg-[var(--studio-hover)] [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--studio-selected)] text-[10px] font-semibold text-[var(--studio-text-primary)]">{initials}</span>
                <span className="hidden min-w-0 lg:block"><strong className="block max-w-32 truncate text-[11.5px] font-semibold text-[var(--studio-text-primary)]">{ownerName}</strong><span className="block text-[9.5px] text-[var(--studio-text-secondary)]">Owner</span></span>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--studio-text-secondary)] transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="absolute end-0 z-30 mt-2 w-56 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-2 text-start">
                <p className="truncate px-2 py-1 text-[11px] text-[var(--studio-text-secondary)]">{ownerEmail}</p>
                <Link href="/studio/chat" prefetch={false} className="mt-1 flex h-9 items-center justify-between rounded-lg px-2 text-[11.5px] font-medium text-white hover:bg-white/[0.06]">Back to Studio<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></Link>
              </div>
            </details>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-5 lg:px-7 lg:py-7">{children}</div>
      </main>
    </div>
  );
}
