import { withAuth, ok } from '@/lib/auth/withAuth';
import { getFieldDefinitions, getEditableFieldKeys } from '@/lib/services/equipment';
import { isAdmin } from '@/lib/permissions';

/**
 * BẮT BUỘC cho mọi role (mục 37): mục 3c cấm frontend query thẳng Supabase,
 * nên không có endpoint này thì không render nổi một form nào.
 *
 * editable_fields cho biết user được SỬA field nào. Mọi user vẫn XEM được mọi
 * field is_visible (mục 30) — permission chỉ gate quyền sửa.
 */
export const GET = withAuth(async (_req, { requestId, profile }) => {
  const [defs, editable] = await Promise.all([
    getFieldDefinitions(false),
    isAdmin(profile) ? Promise.resolve<string[]>([]) : getEditableFieldKeys(profile.id),
  ]);

  return ok(
    {
      fields: defs,
      editable_fields: isAdmin(profile) ? defs.map((d) => d.field_key) : editable,
    },
    requestId,
  );
});
