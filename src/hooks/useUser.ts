'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
export type BalanceStatus = 'loading' | 'ready' | 'unavailable';
export type PlanStatus = 'loading' | 'ready' | 'unavailable';

interface UserSnapshot {
  user: User | null;
  session: Session | null;
  status: AuthStatus;
  balance: number | null;
  balanceStatus: BalanceStatus;
  planName: string | null;
  planStatus: PlanStatus;
}

export interface UseUserReturn extends UserSnapshot {
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
  signOut: () => Promise<void>;
}

export interface UseUserOptions {
  loadBalance?: boolean;
  loadPlan?: boolean;
}

const listeners = new Set<() => void>();
const serverSnapshot: UserSnapshot = {
  user: null,
  session: null,
  status: 'loading',
  balance: null,
  balanceStatus: 'loading',
  planName: null,
  planStatus: 'loading',
};

let snapshot: UserSnapshot = serverSnapshot;
let authStarted = false;
let balanceRevision = 0;
let balanceFetchUserId: string | null = null;
let planRevision = 0;
let planFetchUserId: string | null = null;

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

async function fetchCurrentPlan(userId: string) {
  if (planFetchUserId === userId) return;
  planFetchUserId = userId;
  const requestRevision = ++planRevision;
  emit({ ...snapshot, planName: null, planStatus: 'loading' });

  try {
    const { data, error } = await supabase
      .rpc('get_current_user_entitlement')
      .returns<{ plan_name: string }[]>()
      .maybeSingle();

    if (requestRevision !== planRevision || snapshot.user?.id !== userId) return;
    if (error) {
      emit({ ...snapshot, planName: null, planStatus: 'unavailable' });
      return;
    }

    emit({ ...snapshot, planName: data?.plan_name ?? null, planStatus: 'ready' });
  } catch {
    if (requestRevision === planRevision && snapshot.user?.id === userId) {
      emit({ ...snapshot, planName: null, planStatus: 'unavailable' });
    }
  } finally {
    if (planFetchUserId === userId) planFetchUserId = null;
  }
}

function applySession(session: Session | null) {
  const nextUser = session?.user ?? null;

  if (!nextUser) {
    balanceRevision += 1;
    planRevision += 1;
    emit({
      user: null,
      session: null,
      status: 'unauthenticated',
      balance: null,
      balanceStatus: 'unavailable',
      planName: null,
      planStatus: 'unavailable',
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
    planName: isSameUser ? snapshot.planName : null,
    planStatus: isSameUser ? snapshot.planStatus : 'loading',
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

export function useUser({ loadBalance = false, loadPlan = false }: UseUserOptions = {}): UseUserReturn {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (loadBalance && state.user && state.balanceStatus === 'loading') {
      void fetchVerifiedBalance(state.user.id);
    }
  }, [loadBalance, state.balanceStatus, state.user]);

  useEffect(() => {
    if (loadPlan && state.user && state.planStatus === 'loading') {
      void fetchCurrentPlan(state.user.id);
    }
  }, [loadPlan, state.planStatus, state.user]);

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
