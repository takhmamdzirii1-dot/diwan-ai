'use client';

import { supabase } from '../supabase/client';

export type UserLanguage = 'en' | 'fr' | 'ar';

export async function updateUserLanguageIfNeeded(
  user: { user_metadata?: { language?: unknown } } | null | undefined,
  language: UserLanguage
) {
  if (!user || user.user_metadata?.language === language) return false;

  const { error } = await supabase.auth.updateUser({ data: { language } });
  if (error) throw error;
  return true;
}
