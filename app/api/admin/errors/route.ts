import { withAuth, ok } from '@/lib/auth/withAuth';
import { listRecentErrors } from '@/lib/services/admin';

/** Tra cứu lỗi theo request_id — log Vercel Hobby chỉ giữ ~1 giờ (mục 47d). */
export const GET = withAuth(async (req, { requestId }) => {
  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 50) || 50, 200);
  return ok(await listRecentErrors(limit), requestId);
}, { role: ['admin'] });
