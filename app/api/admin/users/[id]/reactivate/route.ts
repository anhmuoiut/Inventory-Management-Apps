import { withAuth, ok } from '@/lib/auth/withAuth';
import { setUserActive } from '@/lib/services/admin';

export const POST = withAuth(
  async (_req, { requestId, profile, params }) =>
    ok(await setUserActive(params.id!, true, profile.id, requestId), requestId),
  { role: ['admin'] },
);
