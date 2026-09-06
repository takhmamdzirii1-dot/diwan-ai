'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
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

export interface UseUserOptions {
  loadBalance?: boolean;
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
let balanceRevision = 0;
let balanceFetchUserId: string | null = null;

function emit(next: UserSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

async function fetchVerifiedBalance(userId: string, force = false) {
  if (!force && balanceFetchUserId === userId) return;
  balanceFetchUserId = userId;
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
  } finally {
    if (balanceFetchUserId === userId) balanceFetchUserId = null;
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

}

function startAuth() {
  if (authStarted) return;
  authStarted = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    applySession(session);
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

export function useUser({ loadBalance = false }: UseUserOptions = {}): UseUserReturn {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (loadBalance && state.user && state.balanceStatus === 'loading') {
      void fetchVerifiedBalance(state.user.id);
    }
  }, [loadBalance, state.balanceStatus, state.user]);

  const refreshBalance = useCallback(async () => {
    if (snapshot.user) await fetchVerifiedBalance(snapshot.user.id, true);
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
