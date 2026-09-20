'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { normalizeModelPlanCode, type ModelPlanCode } from '@/lib/models/plan-entitlements';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
export type BalanceStatus = 'loading' | 'ready' | 'unavailable';
export type PlanStatus = 'loading' | 'ready' | 'unavailable';
export type PlanAccessState = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | null;

interface UserSnapshot {
  user: User | null;
  session: Session | null;
  status: AuthStatus;
  balance: number | null;
  balanceStatus: BalanceStatus;
  subscriptionBalance: number | null;
  purchasedBalance: number | null;
  freeImageRemaining: number | null;
  freeVideoRemaining: number | null;
  liteVideoRemaining: number | null;
  planName: string | null;
  planCode: ModelPlanCode;
  paidPlanCode: ModelPlanCode | null;
  planEndsAt: string | null;
  planAccessState: PlanAccessState;
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
  subscriptionBalance: null,
  purchasedBalance: null,
  freeImageRemaining: null,
  freeVideoRemaining: null,
  liteVideoRemaining: null,
  planName: null,
  planCode: 'free',
  paidPlanCode: null,
  planEndsAt: null,
  planAccessState: null,
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
      .select('balance,subscription_balance,purchased_balance,free_image_remaining,free_video_remaining,lite_video_remaining')
      .eq('user_id', userId)
      .maybeSingle();

    if (requestRevision !== balanceRevision || snapshot.user?.id !== userId) return;

    const value = data?.balance;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (error || value == null || !Number.isFinite(parsed)) {
      emit({
        ...snapshot,
        balance: null,
        balanceStatus: 'unavailable',
        subscriptionBalance: null,
        purchasedBalance: null,
        freeImageRemaining: null,
        freeVideoRemaining: null,
        liteVideoRemaining: null,
      });
      return;
    }

    emit({
      ...snapshot,
      balance: parsed,
      balanceStatus: 'ready',
      subscriptionBalance: Number(data.subscription_balance ?? 0),
      purchasedBalance: Number(data.purchased_balance ?? 0),
      freeImageRemaining: Number(data.free_image_remaining ?? 0),
      freeVideoRemaining: Number(data.free_video_remaining ?? 0),
      liteVideoRemaining: Number(data.lite_video_remaining ?? 0),
    });
  } catch {
    if (requestRevision === balanceRevision && snapshot.user?.id === userId) {
      emit({
        ...snapshot,
        balance: null,
        balanceStatus: 'unavailable',
        subscriptionBalance: null,
        purchasedBalance: null,
        freeImageRemaining: null,
        freeVideoRemaining: null,
        liteVideoRemaining: null,
      });
    }
  } finally {
    if (balanceFetchUserId === userId) balanceFetchUserId = null;
  }
}

async function fetchCurrentPlan(userId: string) {
  if (planFetchUserId === userId) return;
  planFetchUserId = userId;
  const requestRevision = ++planRevision;
  emit({
    ...snapshot,
    planName: null,
    planCode: 'free',
    paidPlanCode: null,
    planEndsAt: null,
    planAccessState: null,
    planStatus: 'loading',
  });

  try {
    const { data, error } = await supabase
      .rpc('get_user_plan_access')
      .returns<{ plan_code: string; plan_name: string; ends_at: string | null; access_state: string }[]>()
      .maybeSingle();

    if (requestRevision !== planRevision || snapshot.user?.id !== userId) return;
    if (error) {
      emit({ ...snapshot, planName: null, planCode: 'free', paidPlanCode: null, planEndsAt: null, planAccessState: null, planStatus: 'unavailable' });
      return;
    }

    const accessState = data?.access_state === 'ACTIVE' || data?.access_state === 'EXPIRING_SOON' || data?.access_state === 'EXPIRED'
      ? data.access_state
      : null;
    const paidPlanCode = data ? normalizeModelPlanCode(data.plan_code) : null;
    emit({
      ...snapshot,
      planName: data && accessState !== 'EXPIRED' ? data.plan_name : null,
      planCode: data && accessState !== 'EXPIRED' ? paidPlanCode ?? 'free' : 'free',
      paidPlanCode,
      planEndsAt: data?.ends_at ?? null,
      planAccessState: accessState,
      planStatus: 'ready',
    });
  } catch {
    if (requestRevision === planRevision && snapshot.user?.id === userId) {
      emit({ ...snapshot, planName: null, planCode: 'free', paidPlanCode: null, planEndsAt: null, planAccessState: null, planStatus: 'unavailable' });
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
      subscriptionBalance: null,
      purchasedBalance: null,
      freeImageRemaining: null,
      freeVideoRemaining: null,
      liteVideoRemaining: null,
      planName: null,
      planCode: 'free',
      paidPlanCode: null,
      planEndsAt: null,
      planAccessState: null,
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
    subscriptionBalance: isSameUser ? snapshot.subscriptionBalance : null,
    purchasedBalance: isSameUser ? snapshot.purchasedBalance : null,
    freeImageRemaining: isSameUser ? snapshot.freeImageRemaining : null,
    freeVideoRemaining: isSameUser ? snapshot.freeVideoRemaining : null,
    liteVideoRemaining: isSameUser ? snapshot.liteVideoRemaining : null,
    planName: isSameUser ? snapshot.planName : null,
    planCode: isSameUser ? snapshot.planCode : 'free',
    paidPlanCode: isSameUser ? snapshot.paidPlanCode : null,
    planEndsAt: isSameUser ? snapshot.planEndsAt : null,
    planAccessState: isSameUser ? snapshot.planAccessState : null,
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
