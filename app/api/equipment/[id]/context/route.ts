import { withAuth, ok } from '@/lib/auth/withAuth';
import { getContext } from '@/lib/services/equipment';

/** Parent / Ancestors / Descendants cho context panel (mục 16). */
export const GET = withAuth(async (_req, { requestId, params }) =>
  ok(await getContext(params.id!), requestId),
);
