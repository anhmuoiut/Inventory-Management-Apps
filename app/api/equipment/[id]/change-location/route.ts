import { withAuth, ok } from '@/lib/auth/withAuth';
import { changeLocation, getEditableFieldKeys } from '@/lib/services/equipment';
import { assertFields, isAdmin } from '@/lib/permissions';
import { changeLocationSchema, parseBody } from '@/lib/validators/equipment';

/**
 * Đổi Location của root là thao tác CASCADE multi-row, không phải Edit thường
 * (mục 21a). RPC lock subtree, update descendants chưa archive, ghi MOVE_CASCADE.
 *
 * Permission: can_edit trên field current_location_id (mục 32).
 */
export const POST = withAuth(
  async (req, { requestId, profile, params }) => {
    const body = parseBody(changeLocationSchema, await req.json());

    const editable = isAdmin(profile)
      ? ['current_location_id']
      : await getEditableFieldKeys(profile.id);
    assertFields(profile, ['current_location_id'], editable);

    const result = await changeLocation(
      params.id!, body.new_location_id, body.version, profile.id, requestId,
    );
    return ok(result, requestId);
  },
  { role: ['admin', 'user'] },
);
