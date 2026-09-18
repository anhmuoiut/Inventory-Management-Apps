import { withAuth, ok } from '@/lib/auth/withAuth';
import { AppError } from '@/lib/errors';
import {
  listEquipment, createEquipment, getFieldDefinitions,
  getEditableFieldKeys, findDuplicates,
} from '@/lib/services/equipment';
import { assertFields, isAdmin } from '@/lib/permissions';
import { createSchema, parseBody, validateFields } from '@/lib/validators/equipment';

const MAX_PAGE_SIZE = 200;

export const GET = withAuth(async (req, { requestId }) => {
  const sp = new URL(req.url).searchParams;
  const pageSize = Math.min(Number(sp.get('pageSize') ?? 50) || 50, MAX_PAGE_SIZE);
  const page = Math.max(Number(sp.get('page') ?? 1) || 1, 1);

  const { rows, total } = await listEquipment({
    search: sp.get('search') ?? undefined,
    page,
    pageSize,
    showArchived: sp.get('showArchived') === 'true',
    parentPickerFor: sp.get('parentPickerFor') ?? undefined,
    filters: {
      status: sp.get('filters[status]') ?? undefined,
      types: sp.get('filters[types]') ?? undefined,
      level: sp.get('filters[level]') ?? undefined,
      current_location_id: sp.get('filters[current_location_id]') ?? undefined,
    },
  });

  return ok(rows, requestId, { page, pageSize, total });
});

export const POST = withAuth(
  async (req, { requestId, profile }) => {
    const body = parseBody(createSchema, await req.json());
    const defs = await getFieldDefinitions(true);

    const clean = validateFields(body.fields, defs, 'create');

    // parent_id không nằm trong field_definitions (mục 6.4) — nhận riêng.
    const parentId = body.fields.parent_id;
    if (parentId !== undefined && parentId !== null && typeof parentId !== 'string') {
      throw new AppError('VALIDATION_ERROR', { parent_id: 'phải là uuid' });
    }

    const editable = isAdmin(profile) ? [] : await getEditableFieldKeys(profile.id);
    assertFields(profile, Object.keys(clean), isAdmin(profile) ? Object.keys(clean) : editable);

    const payload = { ...clean, parent_id: parentId ?? null };
    const created = await createEquipment(payload, profile.id, requestId);

    // Cảnh báo duplicate, KHÔNG block (mục 9).
    const dup = await findDuplicates(
      clean.part_number as string | null,
      clean.serial_number as string | null,
    );

    return ok(created, requestId, {
      duplicate_warning: dup.length > 1 ? { code: 'DUPLICATE_WARNING', matches: dup } : null,
    });
  },
  { role: ['admin', 'user'], action: 'create' },
);
