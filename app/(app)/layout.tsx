import { redirect } from 'next/navigation';
import { supabaseAuthClient } from '@/lib/supabase/server';
import { getProfileIdentity } from '@/lib/services/profile';
import { AppShell } from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await supabaseAuthClient();
  const { data } = await auth.auth.getUser();
  if (!data.user) redirect('/login');
  const profile = await getProfileIdentity(data.user.id);
  if (!profile?.is_active) redirect('/login');
  return <AppShell username={profile.username}>{children}</AppShell>;
}
