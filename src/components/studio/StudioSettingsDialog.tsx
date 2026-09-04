'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bot,
  Check,
  ChevronDown,
  CircleUserRound,
  CreditCard,
  KeyRound,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import useUser from '../../hooks/useUser';
import { CHAT_MODELS, isModelSelectable } from '@/src/config/studio-registry';

type TabId = 'general' | 'models' | 'personalization' | 'credits' | 'connections' | 'privacy';

const TABS: { id: TabId; key: 'general' | 'modelsRouting' | 'personalization' | 'creditsBilling' | 'connections' | 'dataPrivacy'; icon: React.ElementType }[] = [
  { id: 'general', key: 'general', icon: Settings2 },
  { id: 'models', key: 'modelsRouting', icon: Bot },
  { id: 'personalization', key: 'personalization', icon: CircleUserRound },
  { id: 'credits', key: 'creditsBilling', icon: CreditCard },
  { id: 'connections', key: 'connections', icon: KeyRound },
  { id: 'privacy', key: 'dataPrivacy', icon: ShieldCheck },
];

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-[16px] font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--studio-text-secondary)]">{description}</p>
    </div>
  );
}

function StaticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-5 border-b border-[var(--studio-border-subtle)] py-3 last:border-0">
      <span className="text-[13px] font-medium text-white/85">{label}</span>
      <span className="text-end text-[12.5px] text-[var(--studio-text-secondary)]">{value}</span>
    </div>
  );
}

function PreviewState({ children, badge }: { children: React.ReactNode; badge: string }) {
  return (
    <div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface-raised)] p-5">
      <span className="rounded-full border border-[var(--studio-border)] bg-white/[0.04] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">
        {badge}
      </span>
      <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--studio-text-secondary)]">{children}</p>
    </div>
  );
}

function GeneralPanel() {
  const t = useTranslations('studio.settings');
  const { user } = useUser();
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('guest');
  return (
    <div className="space-y-6">
      <SectionHeader title={t('general')} description={t('generalDescription')} />
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface-raised)] p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--studio-border)] bg-[var(--studio-selected)] text-[14px] font-semibold text-white">
          {name[0].toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-white">{name}</p>
          <p className="truncate text-[11.5px] text-[var(--studio-text-muted)]">{user?.email ?? t('notSignedIn')}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface-raised)] px-5">
        <StaticRow label={t('language')} value={t('english')} />
        <StaticRow label={t('appearance')} value={t('dark')} />
        <StaticRow label={t('startScreen')} value={t('chat')} />
      </div>
    </div>
  );
}

function ModelsPanel({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const t = useTranslations('studio.settings');
  const modelT = useTranslations('studio.models');
  const [open, setOpen] = useState(false);
  const current = CHAT_MODELS.find((model) => model.id === selectedId) ?? CHAT_MODELS[0];
  return (
    <div className="space-y-6">
      <SectionHeader title={t('modelsRouting')} description={t('modelDescription')} />
      <div className="space-y-2">
        <label className="text-[12px] font-medium text-[var(--studio-text-secondary)]">{t('defaultChatModel')}</label>
        <div className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex h-11 w-full items-center justify-between rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3.5 text-[13px] text-white transition-[background-color,border-color] duration-150 hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <span>{current.displayName}</span>
            <ChevronDown className={cn('h-4 w-4 text-white/45 transition-transform duration-150', open && 'rotate-180')} />
          </button>
          {open && (
            <div role="listbox" className="studio-menu-enter absolute start-0 end-0 top-full z-20 mt-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-elevated)] p-1.5 shadow-[var(--studio-shadow)]">
              {CHAT_MODELS.map((model) => {
                const selectable = isModelSelectable(model);
                return (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={model.id === selectedId}
                    disabled={!selectable}
                    onClick={() => {
                      if (!selectable) return;
                      onSelect(model.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-start transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                      selectable ? 'hover:bg-[var(--studio-hover)]' : 'cursor-not-allowed opacity-45',
                      model.id === selectedId ? 'border-[var(--studio-border-strong)] bg-[var(--studio-selected)]' : 'border-transparent'
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-white">{model.displayName}</span>
                      <span className="block text-[11px] text-[var(--studio-text-muted)]">{model.provider} · {modelT(model.availability)}</span>
                    </span>
                    {model.id === selectedId && <Check className="h-4 w-4 text-white" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface-raised)] px-5">
        <StaticRow label={t('videoModel')} value={t('notConnected')} />
      </div>
      <p className="text-[11.5px] leading-relaxed text-[var(--studio-text-muted)]">{t('routingNote')}</p>
    </div>
  );
}

function CreditsPanel() {
  const t = useTranslations('studio.settings');
  const { user, balance, isLoading } = useUser();
  return (
    <div className="space-y-6">
      <SectionHeader title={t('creditsBilling')} description={t('creditsDescription')} />
      <div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface-raised)] px-5">
        <StaticRow label={t('currentPlan')} value={user ? t('freePlan') : t('guest')} />
        <StaticRow
          label={t('unifiedCreditsBalance')}
          value={user && !isLoading ? balance.toLocaleString() : t('balanceUnavailable')}
        />
      </div>
      <p className="text-[11.5px] text-[var(--studio-text-muted)]">{t('renewalUnavailable')}</p>
    </div>
  );
}

function ConnectionsPanel() {
  const t = useTranslations('studio.settings');
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected' | 'expired'>('loading');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/provider-connections/pollinations');
      if (response.status === 401) {
        setStatus('disconnected');
        return;
      }
      const data = await response.json();
      setStatus(data.connected ? (data.expired ? 'expired' : 'connected') : 'disconnected');
      setExpiresAt(data.expiresAt ?? null);
    } catch {
      setStatus('disconnected');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const providerError = params.get('provider_error');
    if (connected === 'pollinations') {
      setMessage(t('connectionSuccess'));
      setError(false);
    } else if (providerError) {
      setMessage(t('connectionFailed'));
      setError(true);
    }
    if (connected || providerError) {
      params.delete('connected');
      params.delete('provider_error');
      const query = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }
  }, [t]);

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch('/api/provider-connections/pollinations', { method: 'DELETE' });
      await refresh();
    } catch {
      setMessage(t('disconnectFailed'));
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title={t('connections')} description={t('connectionsDescription')} />
      <div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface-raised)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[13.5px] font-medium text-white">Pollinations</p>
              {(status === 'connected' || status === 'expired') && (
                <span className="rounded-full border border-[var(--studio-border)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/65">
                  {status === 'connected' ? t('connected') : t('expired')}
                </span>
              )}
            </div>
            <p className="mt-1 max-w-md text-[12px] leading-relaxed text-[var(--studio-text-secondary)]">{t('pollinationsDescription')}</p>
          </div>
          {status === 'connected' && expiresAt && (
            <span className="text-[10.5px] font-mono text-[var(--studio-text-muted)]">{t('renews', { date: new Date(expiresAt).toLocaleDateString() })}</span>
          )}
        </div>
        {message && <p role={error ? 'alert' : 'status'} className={cn('mt-3 text-[11.5px]', error ? 'text-red-300' : 'text-white/65')}>{message}</p>}
        <div className="mt-4">
          {status === 'connected' ? (
            <button type="button" onClick={disconnect} disabled={busy} className="h-9 rounded-xl border border-[var(--studio-border)] px-3.5 text-[12px] font-medium text-[var(--studio-text-secondary)] transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-40">
              {t('disconnect')}
            </button>
          ) : (
            <button type="button" onClick={() => { setBusy(true); window.location.href = '/api/provider-connections/pollinations/authorize'; }} disabled={busy || status === 'loading'} className="h-10 rounded-xl bg-white px-5 text-[12.5px] font-semibold text-black transition-[background-color,transform] duration-150 hover:bg-gray-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40">
              {status === 'loading' ? t('checking') : t('connectPollinations')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudioSettingsDialog({
  open,
  onClose,
  selectedChatModelId,
  onSelectChatModel,
}: {
  open: boolean;
  onClose: () => void;
  selectedChatModelId: string;
  onSelectChatModel: (id: string) => void;
}) {
  const t = useTranslations('studio.settings');
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<TabId>('general');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--studio-overlay)] p-0 backdrop-blur-md sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-settings-title"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden border-[var(--studio-border)] bg-[var(--studio-surface-elevated)] shadow-[var(--studio-shadow)] sm:h-auto sm:max-h-[86vh] sm:max-w-4xl sm:flex-row sm:rounded-2xl sm:border"
      >
        <div className="shrink-0 overflow-x-auto border-b border-[var(--studio-border-subtle)] bg-[var(--studio-surface)] p-3 sm:w-60 sm:overflow-visible sm:border-b-0 sm:border-e">
          <p id="studio-settings-title" className="hidden px-3 pb-3 pt-2 text-[10px] font-mono font-semibold uppercase tracking-[0.22em] text-[var(--studio-text-muted)] sm:block">{t('title')}</p>
          <div className="flex gap-1 sm:flex-col">
            {TABS.map(({ id, key, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
                className={cn(
                  'flex h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg border px-3.5 text-[12.5px] font-medium transition-[color,background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                  tab === id
                    ? 'border-[var(--studio-border-strong)] bg-[var(--studio-selected)] text-white'
                    : 'border-transparent text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {t(key)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--studio-border-subtle)] px-5 sm:hidden">
            <span className="text-[13px] font-semibold text-white">{t('title')}</span>
            <button type="button" onClick={onClose} aria-label={t('close')} className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--studio-text-secondary)] transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
              <X className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label={t('close')} className="absolute end-4 top-4 hidden h-8 w-8 items-center justify-center rounded-lg text-[var(--studio-text-muted)] transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:flex">
            <X className="h-4 w-4" />
          </button>
          <div className="flex-1 overflow-y-auto p-5 sm:p-7">
            {tab === 'general' && <GeneralPanel />}
            {tab === 'models' && <ModelsPanel selectedId={selectedChatModelId} onSelect={onSelectChatModel} />}
            {tab === 'personalization' && (
              <div className="space-y-6"><SectionHeader title={t('personalization')} description={t('personalizationDescription')} /><PreviewState badge={t('preview')}>{t('personalizationUnavailable')}</PreviewState></div>
            )}
            {tab === 'credits' && <CreditsPanel />}
            {tab === 'connections' && <ConnectionsPanel />}
            {tab === 'privacy' && (
              <div className="space-y-6"><SectionHeader title={t('dataPrivacy')} description={t('dataDescription')} /><PreviewState badge={t('preview')}>{t('dataUnavailable')}</PreviewState></div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
