import { withAuth, ok } from '@/lib/auth/withAuth';
import { getFieldDefinitions } from '@/lib/services/equipment';

export const GET = withAuth(async (_req, { requestId }) =>
  ok(await getFieldDefinitions(true), requestId), { role: ['admin'] });
