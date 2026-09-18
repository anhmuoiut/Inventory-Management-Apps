import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseAuthClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors';
import { normalizeUsername } from '@/lib/auth/username';

// A bounded per-instance guard supplements Supabase Auth's own rate limits.
// It is not a shared, deployment-wide rate limiter.
const attempts = new Map<string, { count: number; expires: number }>();
function limitAttempts(username: string) {
  const now = Date.now();
  const previous = attempts.get(username);
  if (!previous || previous.expires <= now) {
    if (attempts.size >= 2000) attempts.delete(attempts.keys().next().value!);
    attempts.set(username, { count: 1, expires: now + 60_000 });
  } else {
    previous.count++;
    if (previous.count > 10) throw new AppError('LOGIN_RATE_LIMITED');
  }
}

export async function loginWithUsername(input: { username?: unknown; password?: unknown }) {
  const username = normalizeUsername(input.username);
  if (!username || typeof input.password !== 'string' ||
      !input.password || input.password.length > 256) throw new AppError('INVALID_CREDENTIALS');
  limitAttempts(username);

  // Never send the resolved email, service key or session tokens in a JSON response.
  const { data, error } = await supabaseAdmin().from('user_profiles')
    .select('id,email,is_active')
    .eq('username', username)
    .limit(2);
  if (error) throw new AppError('SERVER_ERROR');
  // Fail closed if the stored username is missing, inactive or ambiguous.
  if (data?.length !== 1 || !data[0]?.is_active) throw new AppError('INVALID_CREDENTIALS');

  const auth = await supabaseAuthClient();
  const result = await auth.auth.signInWithPassword({ email: data[0].email, password: input.password });
  if (result.error) {
    if (result.error.status === 429) throw new AppError('LOGIN_RATE_LIMITED');
    throw new AppError('INVALID_CREDENTIALS');
  }
  if (result.data.user?.id !== data[0].id) {
    await auth.auth.signOut();
    throw new AppError('INVALID_CREDENTIALS');
  }
  attempts.delete(username);
}
