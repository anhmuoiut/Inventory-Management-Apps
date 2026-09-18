import { withAuth, ok } from '@/lib/auth/withAuth';
import { listLocations } from '@/lib/services/admin';

/** Mọi role đã đăng nhập (mục 37). Chỉ trả location đang active. */
export const GET = withAuth(async (_req, { requestId }) =>
  ok(await listLocations(true), requestId),
);
