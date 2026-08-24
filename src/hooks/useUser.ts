'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';

export interface UseUserReturn {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  balance: number;
  refreshBalance: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [balance, setBalance] = useState<number>(10000);

  const fetchBalance = useCallback(async (userId?: string) => {
    if (!userId) return;
    try {
      // 1. Attempt RPC call
      const { data: rpcBalance, error: rpcError } = await supabase.rpc('get_user_balance');
      if (!rpcError && typeof rpcBalance === 'number') {
        setBalance(rpcBalance);
        return;
      }

      // 2. Fallback attempt to query profile table if RPC doesn't exist
      const { data: profile } = await supabase
        .from('profiles')
        .select('balance, points')
        .eq('id', userId)
        .single();

      if (profile) {
        setBalance(profile.balance ?? profile.points ?? 10000);
      }
    } catch {
      // Keep existing balance if RPC/table is not yet initialized in database
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchBalance(session.user.id);
      }
      setIsLoading(false);
    });

    // Listen for real-time auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchBalance(session.user.id);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchBalance]);

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setBalance(10000);
    setIsLoading(false);
  };

  const refreshBalance = async () => {
    if (user) {
      await fetchBalance(user.id);
    }
  };

  return {
    user,
    session,
    isLoading,
    balance,
    refreshBalance,
    signOut,
  };
}

export default useUser;
