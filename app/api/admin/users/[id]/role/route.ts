import { withAuth, ok } from '@/lib/auth/withAuth';
import { setUserRole } from '@/lib/services/admin';
import { parseBody } from '@/lib/validators/equipment';
import { z } from 'zod';

export const PUT = withAuth(
  async (req, { requestId, profile, params }) => {
    const { role } = parseBody(z.object({ role: z.enum(['admin', 'user', 'viewer']) }),
      await req.json());
    return ok(await setUserRole(params.id!, role, profile.id, requestId), requestId);
  },
  { role: ['admin'] },
);
