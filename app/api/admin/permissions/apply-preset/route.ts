import { withAuth, ok } from '@/lib/auth/withAuth';
import { applyPreset } from '@/lib/services/admin';
import { parseBody } from '@/lib/validators/equipment';
import { PRESET_KEYS, type PresetKey } from '@/lib/permissions/presets';
import { z } from 'zod';

/**
 * V1 chỉ có preset, không có UI tick từng ô (mục 30).
 * Schema field_permissions giữ nguyên nên v1.1 thêm per-cell không phải migrate.
 */
export const POST = withAuth(
  async (req, { requestId, profile }) => {
    const body = parseBody(
      z.object({
        user_id: z.string().uuid(),
        preset: z.enum(PRESET_KEYS as [string, ...string[]]),
      }),
      await req.json(),
    );
    const result = await applyPreset(body.user_id, body.preset as PresetKey, profile.id, requestId);
    return ok(result, requestId);
  },
  { role: ['admin'] },
);
