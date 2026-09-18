import { withAuth, ok } from '@/lib/auth/withAuth';
import { listUsers, createUser } from '@/lib/services/admin';
import { parseBody } from '@/lib/validators/equipment';
import { PRESET_KEYS } from '@/lib/permissions/presets';
import { z } from 'zod';
import { normalizeUsername } from '@/lib/auth/username';

const createUserSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email(),
  username: z.string().refine(value => normalizeUsername(value) !== null, {
    message: 'Use 1-64 letters, numbers, dots, underscores, plus signs or hyphens; start with a letter or number.',
  }),
  employee_id: z.string().max(50).nullish(),
  department: z.string().max(100).nullish(),
  role: z.enum(['admin', 'user', 'viewer']),
  preset: z.enum(PRESET_KEYS as [string, ...string[]]),
});

export const GET = withAuth(async (_req, { requestId }) => ok(await listUsers(), requestId),
  { role: ['admin'] });

/**
 * Tạo user trực tiếp — V1 không có Account Request workflow (mục 27).
 *
 * temp_password trả về ĐÚNG MỘT LẦN. Không lưu plaintext, không hiển thị lại.
 * Admin gửi cho user qua kênh nội bộ (Lark/Teams). Không phụ thuộc email:
 * Notification nằm trong Out of Scope và SMTP built-in của Supabase có rate
 * limit quá thấp để dùng thật.
 */
export const POST = withAuth(
  async (req, { requestId, profile }) => {
    const body = parseBody(createUserSchema, await req.json());
    const result = await createUser(body as never, profile.id, requestId);
    return ok(result, requestId, {
      notice: 'Mật khẩu tạm chỉ hiển thị một lần. Sao chép và gửi cho người dùng ngay.',
    });
  },
  { role: ['admin'] },
);
