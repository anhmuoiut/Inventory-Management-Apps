import { withAuth, ok } from '@/lib/auth/withAuth';
import { getEditableFieldKeys } from '@/lib/services/equipment';
import { isAdmin } from '@/lib/permissions';

/**
 * Hồ sơ của chính user đang đăng nhập — UI dùng để quyết định hiện nút nào.
 * Backend vẫn check lại mọi thứ; đây chỉ để không hiện nút chắc chắn bị từ chối.
 */
export const GET = withAuth(async (_req, { requestId, profile }) => {
  const editable = isAdmin(profile) ? null : await getEditableFieldKeys(profile.id);
  return ok({ ...profile, editable_fields: editable }, requestId);
});
