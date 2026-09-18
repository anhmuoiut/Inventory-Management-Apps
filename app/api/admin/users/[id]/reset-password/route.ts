import { withAuth, ok } from '@/lib/auth/withAuth';
import { resetPassword } from '@/lib/services/admin';

/** Sinh lại mật khẩu tạm, hiển thị một lần (mục 27). */
export const POST = withAuth(
  async (_req, { requestId, profile, params }) =>
    ok(await resetPassword(params.id!, profile.id, requestId), requestId, {
      notice: 'Mật khẩu tạm chỉ hiển thị một lần.',
    }),
  { role: ['admin'] },
);
