import { withAuth, ok } from '@/lib/auth/withAuth';
import { restoreEquipment } from '@/lib/services/equipment';
import { versionOnlySchema, parseBody } from '@/lib/validators/equipment';

/**
 * Admin-only (mục 25, 32).
 * Có trong V1 vì archive nhầm sẽ xảy ra trong tuần đầu, và không có Restore
 * thì cách khắc phục duy nhất là dev chạy SQL trên production.
 */
export const POST = withAuth(
  async (req, { requestId, profile, params }) => {
    const body = parseBody(versionOnlySchema, await req.json());
    return ok(await restoreEquipment(params.id!, body.version, profile.id, requestId), requestId);
  },
  { role: ['admin'] },
);
