import { withAuth, ok } from '@/lib/auth/withAuth';
import { getHistory } from '@/lib/services/equipment';

/**
 * Viewer ĐƯỢC xem History (mục 29). Viewer là role mặc định nên chiếm đa số;
 * history append-only và không chứa dữ liệu nhạy cảm. Chi phí mở quyền: 0.
 */
export const GET = withAuth(async (req, { requestId, params }) => {
  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 100) || 100, 500);
  return ok(await getHistory(params.id!, limit), requestId);
});
