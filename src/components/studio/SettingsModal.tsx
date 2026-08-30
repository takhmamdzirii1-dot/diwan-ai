'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  User,
  Sparkles,
  CreditCard,
  ShieldCheck,
  Download,
  Trash2,
  ChevronDown,
  Check,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import useUser from '../../hooks/useUser';

type TabId = 'profile' | 'behavior' | 'billing' | 'privacy';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile & General', icon: User },
  { id: 'behavior', label: 'AI Behavior', icon: Sparkles },
  { id: 'billing', label: 'Billing & Plans', icon: CreditCard },
  { id: 'privacy', label: 'Data & Privacy', icon: ShieldCheck },
];

const TEXT_MODELS = ['Nemotron 3 Ultra', 'GLM 5.2', 'Laguna S 2.1', 'MiniMax M3'];
const IMAGE_MODELS = ['Flux.1 Pro', 'Midjourney v6.1', 'SDXL Turbo'];

const TEXT_MODEL_HINTS: Record<string, string> = {
  'Nemotron 3 Ultra': 'Best for deep reasoning and long documents',
  'GLM 5.2': 'Balanced speed and quality for everyday chat',
  'Laguna S 2.1': 'Tuned for code and technical answers',
  'MiniMax M3': 'Fastest replies for quick questions',
};

const IMAGE_MODEL_HINTS: Record<string, string> = {
  'Flux.1 Pro': 'Best for high-realism generation',
  'Midjourney v6.1': 'Best for artistic and stylized visuals',
  'SDXL Turbo': 'Fastest drafts and quick iterations',
};

const INSTRUCTION_SUGGESTIONS = [
  'Be concise',
  'Speak in Arabic',
  'Professional tone',
];

/* â”€â”€ Primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer shrink-0',
        enabled ? 'bg-white' : 'bg-white/10 border border-white/15'
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 -translate-y-1/2 h-4.5 w-4.5 rounded-full transition-all duration-200',
          enabled ? 'left-[26px] bg-black' : 'left-[3px] bg-white/70'
        )}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-full appearance-none h-10 ps-3.5 pe-9 rounded-xl bg-white/[0.05] border border-white/10 text-[13px] font-medium text-white/90 outline-none cursor-pointer hover:bg-white/[0.07] transition-colors focus:border-white/30"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#1A1C20] text-white">
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
    </div>
  );
}

function Row({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 border-b border-white/[0.06] last:border-0">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-white/90">{title}</p>
        {desc && <p className="text-[12px] text-white/40 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-medium text-white/50">{label}</p>
      {children}
    </div>
  );
}

/* â”€â”€ Panels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function ProfilePanel() {
  const { user } = useUser();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [textModel, setTextModel] = useState(TEXT_MODELS[0]);
  const [imageModel, setImageModel] = useState(IMAGE_MODELS[0]);

  const fullName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest';
  const email = user?.email || 'Not signed in';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-semibold text-white">Profile & General</h3>
        <p className="text-[12.5px] text-white/40 mt-1">
          Appearance and defaults across your workspace.
        </p>
      </div>

      {/* User profile card */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 flex items-center gap-4">
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center font-bold text-white text-[16px]">
          {fullName[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-white/95 truncate">{fullName}</p>
          <p className="text-[12px] text-white/40 truncate">{email}</p>
        </div>
        <button
          type="button"
          className="shrink-0 h-8 px-3.5 rounded-lg border border-white/10 text-[12px] font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.98]"
        >
          Edit
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5">
        <Row title="Dark Theme" desc="Pure black surfaces, high contrast.">
          <Toggle enabled={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} />
        </Row>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Default Text Model">
          <Select value={textModel} onChange={setTextModel} options={TEXT_MODELS} label="Default text model" />
          <p className="text-[11px] text-white/40 mt-1.5">{TEXT_MODEL_HINTS[textModel]}</p>
        </Field>
        <Field label="Default Image Model">
          <Select value={imageModel} onChange={setImageModel} options={IMAGE_MODELS} label="Default image model" />
          <p className="text-[11px] text-white/40 mt-1.5">{IMAGE_MODEL_HINTS[imageModel]}</p>
        </Field>
      </div>

      {/* Connected providers â€” official BYOP flow */}
      <ProviderConnections />
    </div>
  );
}

/** Pollinations BYOP — official OAuth Authorization Code + PKCE flow.
 *  Connect launches /authorize (server 302 to enter.pollinations.ai);
 *  the callback exchanges the code server-side and stores the encrypted
 *  scoped sk_ key. The token never reaches the browser. */
function ProviderConnections() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected' | 'expired'>('loading');
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<'ok' | 'err'>('ok');

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/provider-connections/pollinations');
      if (res.status === 401) {
        setStatus('disconnected');
        return;
      }
      const data = await res.json();
      if (data.connected && data.expired) {
        setStatus('expired');
      } else if (data.connected) {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
      setConnectedAt(data.connectedAt ?? null);
      setExpiresAt(data.expiresAt ?? null);
    } catch {
      setStatus('disconnected');
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // Flash result of the OAuth redirect, then clean the URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const providerError = params.get('provider_error');
    if (connected === 'pollinations') {
      setMsg('Pollinations connected — your scoped key is active for 7 days');
      setMsgTone('ok');
    } else if (providerError) {
      const map: Record<string, string> = {
        state_mismatch: 'Security check failed (state mismatch) — please retry',
        token_exchange_failed: 'Could not complete the connection with Pollinations',
        sign_in_required: 'Sign in to VANTRA first, then reconnect',
        unexpected_token_type: 'Pollinations returned an unexpected key type',
        storage_failed: 'Could not save the connection — try again',
        access_denied: 'Authorization was declined on Pollinations',
      };
      setMsg(map[providerError] || 'Connection failed — please retry');
      setMsgTone('err');
    }
    if (connected || providerError) {
      params.delete('connected');
      params.delete('provider_error');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : ''));
    }
  }, []);

  const connect = () => {
    setBusy(true);
    // Server route validates the session, sets PKCE cookies, and 302s to Pollinations
    window.location.href = '/api/provider-connections/pollinations/authorize';
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch('/api/provider-connections/pollinations', { method: 'DELETE' });
      await refresh();
    } catch {
      setMsg('Failed to disconnect');
      setMsgTone('err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-white/90 flex items-center gap-2">
            Pollinations
            {status === 'connected' && (
              <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded-full border border-white/20 text-white/70">
                CONNECTED
              </span>
            )}
            {status === 'expired' && (
              <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded-full border border-white/20 text-white/50">
                EXPIRED
              </span>
            )}
          </p>
          <p className="text-[12px] text-white/40 mt-0.5 leading-relaxed">
            Connect your own Pollinations account — higher limits, no watermark. One click, official authorization.
          </p>
        </div>
        {status === 'connected' && expiresAt && (
          <span className="text-[10.5px] font-mono text-white/30 shrink-0">
            renews {new Date(expiresAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {msg && (
        <p className={cn('text-[11.5px]', msgTone === 'err' ? 'text-red-400/90' : 'text-white/60')}>
          {msg}
        </p>
      )}

      {status === 'connected' ? (
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-white/10 text-[12px] font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          onClick={connect}
          disabled={busy || status === 'loading'}
          className="h-10 px-5 rounded-xl bg-white text-black text-[12.5px] font-semibold hover:bg-gray-200 transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {status === 'loading' ? 'Checking…' : 'Connect Pollinations'}
        </button>
      )}
    </div>
  );
}

function BehaviorPanel() {
  const [instructions, setInstructions] = useState('');
  const [tts, setTts] = useState(false);

  const appendSuggestion = (text: string) => {
    setInstructions((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return text + '.';
      if (trimmed.toLowerCase().includes(text.toLowerCase())) return prev;
      const sep = /[.!?]$/.test(trimmed) ? ' ' : '. ';
      return trimmed + sep + text + '.';
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-semibold text-white">AI Behavior</h3>
        <p className="text-[12.5px] text-white/40 mt-1">
          Shape how the assistant thinks and sounds.
        </p>
      </div>

      <Field label="Custom Instructions">
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="How should the AI respond? e.g. 'Always answer in Algerian Darja, be concise, show code examples.'"
          dir="auto"
          rows={5}
          maxLength={2000}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13.5px] text-white placeholder:text-white/25 outline-none resize-none leading-relaxed focus:border-white/30 transition-colors [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        />

        {/* Suggestion pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {INSTRUCTION_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => appendSuggestion(s)}
              className="border border-white/10 hover:bg-white/5 rounded-full px-2 py-1 text-xs text-white/60 hover:text-white/90 transition-colors cursor-pointer active:scale-[0.97]"
            >
              {s}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-white/30 text-end">{instructions.length} / 2000</p>
      </Field>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5">
        <Row title="Text-to-Speech (Voice)" desc="Read responses aloud automatically.">
          <Toggle enabled={tts} onChange={setTts} />
        </Row>
      </div>
    </div>
  );
}

function BillingPanel() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const used = 85;
  const quota = 100;
  const pct = Math.min(100, Math.round((used / quota) * 100));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-semibold text-white">Billing & Plans</h3>
        <p className="text-[12.5px] text-white/40 mt-1">
          Manage your plan, usage, and billing cycle.
        </p>
      </div>

      {/* Current plan card */}
      <div className="rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/40">
              Current Plan
            </p>
            <p className="text-[19px] font-semibold text-white mt-1.5">Free Tier</p>
            <p className="text-[12px] text-white/40 mt-0.5">
              {cycle === 'monthly' ? 'Billed monthly Â· cancel anytime' : 'Billed yearly Â· 20% saved'}
            </p>
          </div>

          {/* Billing cycle toggle */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.05] border border-white/10">
            {(['monthly', 'yearly'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={cn(
                  'relative h-7 px-3 rounded-lg text-[11.5px] font-medium capitalize transition-colors cursor-pointer',
                  cycle === c ? 'bg-white text-black' : 'text-white/50 hover:text-white/80'
                )}
              >
                {c}
                {c === 'yearly' && cycle !== 'yearly' && (
                  <span className="absolute -top-2.5 -right-2 px-1.5 h-4 rounded-full bg-white text-black text-[9px] font-bold flex items-center">
                    âˆ’20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Usage progress */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-white/60">Image Generations</span>
            <span className="font-mono text-white/85">
              {used} / {quota} used this month
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className={cn('h-full rounded-full', pct > 90 ? 'bg-white' : 'bg-white/80')}
            />
          </div>
          {pct >= 80 && (
            <p className="text-[11px] text-white/45 flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              You're close to the monthly limit.
            </p>
          )}
        </div>
      </div>

      {/* Upgrade CTA */}
      <button
        type="button"
        className="w-full h-12 rounded-xl bg-white text-black font-semibold text-[14px] hover:bg-gray-200 transition-colors cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
      >
        <Check className="h-4 w-4" />
        Upgrade to Pro
      </button>
      <p className="text-center text-[11.5px] text-white/35 -mt-3">
        Unlimited generations Â· Priority rendering Â· Early access models
      </p>
    </div>
  );
}

function PrivacyPanel() {
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-semibold text-white">Data & Privacy</h3>
        <p className="text-[12.5px] text-white/40 mt-1">
          Your data belongs to you. Take it or erase it.
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
        <div>
          <p className="text-[13.5px] font-medium text-white/90">Export Workspace Data</p>
          <p className="text-[12px] text-white/40 mt-0.5">
            Download all chats, settings, and generated assets as a .zip archive.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] font-medium text-white/85 hover:bg-white/[0.1] transition-colors cursor-pointer active:scale-[0.98]"
        >
          <Download className="h-4 w-4" />
          Export Data
        </button>
      </div>

      <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-5 space-y-4">
        <div>
          <p className="text-[13.5px] font-medium text-red-300/90">Clear All Chat History</p>
          <p className="text-[12px] text-white/40 mt-0.5">
            Permanently deletes every conversation. This cannot be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirmClear) {
              setConfirmClear(false);
              return;
            }
            setConfirmClear(true);
          }}
          className={cn(
            'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-medium border transition-colors cursor-pointer active:scale-[0.98]',
            confirmClear
              ? 'bg-red-500 text-white border-red-400'
              : 'bg-red-500/10 border-red-500/25 text-red-400/90 hover:bg-red-500/20'
          )}
        >
          <Trash2 className="h-4 w-4" />
          {confirmClear ? 'Click again to confirm' : 'Clear All Chat History'}
        </button>
      </div>
    </div>
  );
}

/* â”€â”€ Modal shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>('profile');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[86vh] flex flex-col sm:flex-row bg-[#1A1C20] rounded-2xl border border-white/10 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        {/* Left nav */}
        <div className="sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-white/[0.07] p-3 flex sm:flex-col gap-1 overflow-x-auto custom-scrollbar-thin">
          <p className="hidden sm:block px-3 pt-2 pb-3 text-[10px] font-mono font-semibold tracking-[0.22em] uppercase text-white/30">
            Settings
          </p>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2.5 shrink-0 h-10 px-3.5 rounded-lg text-[13px] font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap',
                tab === id
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between px-6 pt-5 pb-1 sm:hidden">
            <span className="text-[13px] font-semibold text-white">Settings</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar-thin p-6">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="hidden sm:flex absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              style={{ position: 'absolute' }}
            >
              <X style={{ height: 16, width: 16 }} />
            </button>
            {tab === 'profile' && <ProfilePanel />}
            {tab === 'behavior' && <BehaviorPanel />}
            {tab === 'billing' && <BillingPanel />}
            {tab === 'privacy' && <PrivacyPanel />}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
