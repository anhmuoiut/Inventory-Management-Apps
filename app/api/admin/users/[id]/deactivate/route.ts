import { withAuth, ok } from '@/lib/auth/withAuth';
import { setUserActive } from '@/lib/services/admin';

/** Tài khoản bị deactivate không thao tác được dù session cũ còn hạn (mục 29a). */
export const POST = withAuth(
  async (_req, { requestId, profile, params }) =>
    ok(await setUserActive(params.id!, false, profile.id, requestId), requestId),
  { role: ['admin'] },
);
