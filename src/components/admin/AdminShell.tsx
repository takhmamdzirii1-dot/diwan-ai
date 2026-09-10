'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Activity, Boxes, CreditCard, ExternalLink, LayoutDashboard, Server, Tags, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VantraLogo } from '@/src/components/VantraLogo';

const NAV_GROUPS = [
  { key: null, items: [{ href: '/admin', key: 'overview', icon: LayoutDashboard }] },
  { key: 'aiOperations', items: [
    { href: '/admin/providers', key: 'providers', icon: Server },
    { href: '/admin/models', key: 'models', icon: Boxes },
    { href: '/admin/jobs', key: 'jobs', icon: Activity },
  ] },
  { key: 'business', items: [
    { href: '/admin/payments?view=plans', key: 'plans', icon: Tags },
    { href: '/admin/payments?view=payments', key: 'payments', icon: CreditCard },
    { href: '/admin/users', key: 'users', icon: Users },
  ] },
] as const;

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('Admin');

  return (
    <div className="studio-overlay-root min-h-screen bg-[var(--studio-bg)] text-[var(--studio-text-primary)] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-e">
        <div className="flex h-16 items-center justify-between gap-3 border-b border-[var(--studio-border-subtle)] px-4 lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--studio-border)] bg-white/[0.04]">
              <VantraLogo className="h-5 w-5" />
            </span>
            <div className="min-w-0 text-start">
              <p className="truncate text-[13px] font-semibold text-white">{t('brand')}</p>
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">{t('internal')}</p>
            </div>
          </div>
        </div>

        <nav aria-label={t('brand')} className="flex gap-1 overflow-x-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:gap-4 lg:p-3">
          {NAV_GROUPS.map((group) => <div key={group.key ?? 'overview'} className="flex shrink-0 gap-1 lg:flex-col">
            {group.key && <p className="hidden px-3 pb-1 text-start text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28 lg:block">{t(`navGroups.${group.key}`)}</p>}
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
                  'flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-[12.5px] font-medium transition-[color,background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none',
                  active
                    ? 'border border-white/10 bg-white/[0.09] text-white'
                    : 'border border-transparent text-white/50 hover:bg-white/[0.05] hover:text-white/80'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t(`nav.${key}`)}</span>
              </Link>
              );
            })}
          </div>)}
        </nav>

        <div className="hidden p-3 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <Link
            href="/studio/chat"
            prefetch={false}
            className="flex h-10 items-center justify-between rounded-xl border border-[var(--studio-border)] px-3 text-[12px] text-white/55 transition-[color,background-color] duration-150 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none"
          >
            {t('backToStudio')}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </aside>

      <main className="min-w-0">
        <div className="mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
