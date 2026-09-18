import { withAuth, ok } from '@/lib/auth/withAuth';

/**
 * Endpoint KHÔNG xác thực duy nhất của hệ thống (mục 44).
 * Không đụng bảng nghiệp vụ, không trả thông tin gì.
 * Dùng cho keepalive chống Supabase pause (mục 47f).
 */
export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_req, { requestId }) => ok({ ok: true, ts: new Date().toISOString() }, requestId),
  { allowAnonymous: true },
);
