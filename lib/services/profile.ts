import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors';

/** Call only with the ID returned by verified server-side authentication. */
export async function getProfileIdentity(userId: string) {
  const { data, error } = await supabaseAdmin().from('user_profiles')
    .select('username,is_active').eq('id', userId).maybeSingle();
  if (error) throw new AppError('SERVER_ERROR');
  return data as { username: string; is_active: boolean } | null;
}
