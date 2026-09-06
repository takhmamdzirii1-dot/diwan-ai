'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
export type BalanceStatus = 'loading' | 'ready' | 'unavailable';

interface UserSnapshot {
  user: User | null;
  session: Session | null;
  status: AuthStatus;
  balance: number | null;
  balanceStatus: BalanceStatus;
}

export interface UseUserReturn extends UserSnapshot {
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
  signOut: () => Promise<void>;
}

const listeners = new Set<() => void>();
const serverSnapshot: UserSnapshot = {
  user: null,
  session: null,
  status: 'loading',
  balance: null,
  balanceStatus: 'loading',
};

let snapshot: UserSnapshot = serverSnapshot;
let authStarted = false;
let authRevision = 0;
let balanceRevision = 0;

function emit(next: UserSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

async function fetchVerifiedBalance(userId: string) {
  const requestRevision = ++balanceRevision;
  emit({ ...snapshot, balance: null, balanceStatus: 'loading' });

  try {
    const { data, error } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (requestRevision !== balanceRevision || snapshot.user?.id !== userId) return;

    const value = data?.balance;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (error || value == null || !Number.isFinite(parsed)) {
      emit({ ...snapshot, balance: null, balanceStatus: 'unavailable' });
      return;
    }

    emit({ ...snapshot, balance: parsed, balanceStatus: 'ready' });
  } catch {
    if (requestRevision === balanceRevision && snapshot.user?.id === userId) {
      emit({ ...snapshot, balance: null, balanceStatus: 'unavailable' });
    }
  }
}

function applySession(session: Session | null) {
  const nextUser = session?.user ?? null;

  if (!nextUser) {
    balanceRevision += 1;
    emit({
      user: null,
      session: null,
      status: 'unauthenticated',
      balance: null,
      balanceStatus: 'unavailable',
    });
    return;
  }

  const isSameUser = snapshot.user?.id === nextUser.id;
  emit({
    user: nextUser,
    session,
    status: 'authenticated',
    balance: isSameUser ? snapshot.balance : null,
    balanceStatus: isSameUser ? snapshot.balanceStatus : 'loading',
  });

  if (!isSameUser || snapshot.balanceStatus !== 'ready') {
    void fetchVerifiedBalance(nextUser.id);
  }
}

function startAuth() {
  if (authStarted) return;
  authStarted = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    authRevision += 1;
    applySession(session);
  });

  const initialRevision = authRevision;
  void supabase.auth.getSession().then(({ data, error }) => {
    if (error || initialRevision !== authRevision) return;
    applySession(data.session);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startAuth();
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return serverSnapshot;
}

export function useUser(): UseUserReturn {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const refreshBalance = useCallback(async () => {
    if (snapshot.user) await fetchVerifiedBalance(snapshot.user.id);
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    applySession(null);
  }, []);

  return {
    ...state,
    isLoading: state.status === 'loading',
    refreshBalance,
    signOut,
  };
}

export default useUser;
