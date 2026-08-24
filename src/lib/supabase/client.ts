import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
    'https://tkvhumsxksxlnhsenuly.supabase.co';

  const supabaseAnonKey =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdmh1bXN4a3N4bG5oc2VudWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxODM2OTUsImV4cCI6MjEwMjc1OTY5NX0.kwkAFTaQf-vERRai8X3iq7nUQptfnDBKnhb-t3wBB7w';

  try {
    return createBrowserClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-anon-key'
    );
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return createBrowserClient('https://placeholder.supabase.co', 'placeholder-anon-key');
  }
}

export const supabase = createClient();
