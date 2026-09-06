'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bot,
  Check,
  ChevronDown,
  CreditCard,
  Settings2,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import useUser from '../../hooks/useUser';
import {
  CHAT_MODELS,
  DEFAULT_IMAGE_MODEL,
  isModelSelectable,
} from '@/src/config/studio-registry';

type TabId = 'general' | 'models' | 'credits';
type StartScreen = 'chat' | 'image' | 'video' | 'library';

const TABS: { id: TabId; key: 'general' | 'aiPreferences' | 'planCredits'; icon: React.ElementType }[] = [
  { id: 'general', key: 'general', icon: Settings2 },
  { id: 'models', key: 'aiPreferences', icon: Bot },
  { id: 'credits', key: 'planCredits', icon: CreditCard },
];

const START_SCREENS: StartScreen[] = ['chat', 'image', 'video', 'library'];
const LOCALES = ['en', 'fr', 'ar'] as const;

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

function GeneralPanel() {
  const t = useTranslations('studio.settings');
  const locale = useLocale();
  const router = useRouter();
  const { user } = useUser();
  const [startScreen, setStartScreen] = useState<StartScreen>('chat');
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('guest');

  useEffect(() => {
    const saved = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith('vantra_studio_start='))
      ?.split('=')[1];
    if (START_SCREENS.includes(saved as StartScreen)) setStartScreen(saved as StartScreen);
  }, []);

  const selectLocale = (nextLocale: (typeof LOCALES)[number]) => {
    if (nextLocale === locale) return;
    document.cookie = `vantra_locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.refresh();
  };

  const selectStartScreen = (screen: StartScreen) => {
    setStartScreen(screen);
    document.cookie = `vantra_studio_start=${screen}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

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
      <div className="space-y-5 rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface-raised)] p-5">
        <fieldset>
          <legend className="text-[12px] font-medium text-white/85">{t('language')}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {LOCALES.map((value) => (
              <button key={value} type="button" aria-pressed={locale === value} onClick={() => selectLocale(value)} className={cn('h-9 min-w-12 rounded-lg border px-3 text-[12px] font-semibold uppercase transition-[color,background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none', locale === value ? 'border-[var(--studio-border-strong)] bg-[var(--studio-selected)] text-white' : 'border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-white')}>
                {value}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[12px] font-medium text-white/85">{t('startScreen')}</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {START_SCREENS.map((screen) => (
              <button key={screen} type="button" aria-pressed={startScreen === screen} onClick={() => selectStartScreen(screen)} className={cn('h-9 rounded-lg border px-3 text-[12px] font-medium transition-[color,background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none', startScreen === screen ? 'border-[var(--studio-border-strong)] bg-[var(--studio-selected)] text-white' : 'border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-white')}>
                {t(screen)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-[var(--studio-text-muted)]">{t('startScreenDescription')}</p>
        </fieldset>
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
      <SectionHeader title={t('aiPreferences')} description={t('modelDescription')} />
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
                      <span className="block text-[11px] text-[var(--studio-text-muted)]">{modelT(model.availability)}</span>
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
        <StaticRow
          label={t('defaultImageModel')}
          value={`${DEFAULT_IMAGE_MODEL.displayName} · ${modelT(DEFAULT_IMAGE_MODEL.availability)}`}
        />
      </div>
      <p className="text-[11.5px] leading-relaxed text-[var(--studio-text-muted)]">{t('modelPickerNote')}</p>
    </div>
  );
}

function CreditsPanel() {
  const t = useTranslations('studio.settings');
  const { user, balance, balanceStatus } = useUser({ loadBalance: true });
  return (
    <div className="space-y-6">
      <SectionHeader title={t('planCredits')} description={t('creditsDescription')} />
      <div className="rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-surface-raised)] px-5">
        <StaticRow label={t('currentPlan')} value={user ? t('freePlan') : t('guest')} />
        <StaticRow
          label={t('unifiedCreditsBalance')}
          value={user && balanceStatus === 'ready' && balance !== null ? balance.toLocaleString() : t('balanceUnavailable')}
        />
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
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden border-[var(--studio-border)] bg-[var(--studio-surface-elevated)] shadow-[var(--studio-shadow)] sm:h-[min(640px,86vh)] sm:max-w-4xl sm:flex-row sm:rounded-2xl sm:border"
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
            {tab === 'credits' && <CreditsPanel />}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
