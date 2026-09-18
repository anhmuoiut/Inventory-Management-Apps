import 'server-only';

/**
 * Equipment service — Spec v0.9 mục 34, 38.
 *
 * Tầng duy nhất được phép chạm supabaseAdmin(). Route handler gọi xuống đây,
 * không bao giờ tự query.
 *
 * Mọi thao tác ghi đều đi qua RPC: supabase-js không có transaction phía client,
 * nên multi-row atomic bắt buộc phải là plpgsql.
 */
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AppError, mapRpcError } from '@/lib/errors';
import type { FieldDefinition } from '@/lib/validators/equipment';

const EQUIPMENT_COLUMNS = `
  id, jabil_id, part_number, serial_number, asset, types, level, status,
  current_location_id, remark, parent_id, version, archived_at,
  created_at, updated_at,
  current_location:locations!equipment_current_location_id_fkey ( id, code, name, sort_order )
`;

export type ListParams = {
  search?: string;
  page: number;
  pageSize: number;
  showArchived: boolean;
  filters: Partial<Record<'status' | 'types' | 'level' | 'current_location_id', string>>;
  /** Loại chính nó + toàn bộ subtree khỏi kết quả (parent picker, mục 19). */
  parentPickerFor?: string;
};

/** Gọi RPC và map lỗi. Mọi RPC raise exception '<ERROR_CODE>'. */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin().rpc(fn, args);
  if (error) throw mapRpcError(error);
  return data as T;
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

export async function listEquipment(p: ListParams) {
  const db = supabaseAdmin();

  let excludeIds: string[] = [];
  if (p.parentPickerFor) {
    // Không mời user chọn giá trị chắc chắn bị reject bởi PARENT_CYCLE_DETECTED.
    const { data, error } = await db.rpc('internal_subtree_ids', { p_root: p.parentPickerFor });
    if (error) throw mapRpcError(error);
    excludeIds = (data as string[]) ?? [];
  }

  let q = db.from('equipment').select(EQUIPMENT_COLUMNS, { count: 'exact' });

  if (!p.showArchived || p.parentPickerFor) q = q.is('archived_at', null);
  if (excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`);

  for (const [k, v] of Object.entries(p.filters)) {
    if (v) q = q.eq(k, v);
  }

  if (p.search?.trim()) {
    // ILIKE '%term%' — chấp nhận sequential scan (mục 12). Ở 2.000 record
    // Postgres quét toàn bảng dưới 5ms. Btree index KHÔNG phục vụ được
    // leading-wildcard; chúng tồn tại cho filter và join.
    const t = `%${p.search.trim()}%`;
    q = q.or(
      [
        `serial_number.ilike.${t}`,
        `part_number.ilike.${t}`,
        `jabil_id.ilike.${t}`,
        `asset.ilike.${t}`,
        `remark.ilike.${t}`,
      ].join(','),
    );
  }

  // Default sort (mục 18): locations.sort_order → code → serial_sort → id.
  // `id` là tiebreaker BẮT BUỘC: thiếu nó, OFFSET pagination sẽ lặp/bỏ sót
  // record khi giá trị sort trùng.
  q = q
    .order('sort_order', { referencedTable: 'locations', ascending: true })
    .order('serial_sort', { ascending: true })
    .order('id', { ascending: true });

  const from = (p.page - 1) * p.pageSize;
  q = q.range(from, from + p.pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw mapRpcError(error);

  const rows = data ?? [];
  const ids = rows.map((r) => (r as { id: string }).id);

  // has_children: EXISTS qua idx_equipment_parent_id — đủ nhanh ở quy mô này,
  // không cần cột children_count (mục 38).
  let childParents = new Set<string>();
  if (ids.length > 0) {
    const { data: kids } = await db
      .from('equipment')
      .select('parent_id')
      .in('parent_id', ids)
      .is('archived_at', null);
    childParents = new Set((kids ?? []).map((k) => (k as { parent_id: string }).parent_id));
  }

  return {
    rows: rows.map((r) => ({ ...r, has_children: childParents.has((r as { id: string }).id) })),
    total: count ?? 0,
  };
}

export async function getEquipment(id: string) {
  const { data, error } = await supabaseAdmin()
    .from('equipment')
    .select(EQUIPMENT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapRpcError(error);
  if (!data) throw new AppError('EQUIPMENT_NOT_FOUND');
  return data;
}

export async function getContext(id: string) {
  await getEquipment(id); // 404 sớm thay vì trả context rỗng
  const [anc, desc] = await Promise.all([
    rpc<unknown[]>('get_equipment_ancestors', { p_id: id }),
    rpc<unknown[]>('get_equipment_descendants', { p_id: id }),
  ]);
  return { ancestors: anc ?? [], descendants: desc ?? [] };
}

export async function getHistory(id: string, limit = 100) {
  // Chỉ entity_type = 'equipment' — log phân quyền và tài khoản KHÔNG đi qua
  // đường này (mục 29).
  const { data, error } = await supabaseAdmin()
    .from('audit_log')
    .select('id, action, changes, changed_by, created_at, note, source, request_id')
    .eq('entity_type', 'equipment')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw mapRpcError(error);
  return data ?? [];
}

export async function getFieldDefinitions(includeHidden = false): Promise<FieldDefinition[]> {
  let q = supabaseAdmin()
    .from('field_definitions')
    .select(
      'field_key, display_label, data_type, input_type, is_required, dropdown_options, is_visible, display_order, max_length, help_text, placeholder',
    )
    .order('display_order', { ascending: true });
  if (!includeHidden) q = q.eq('is_visible', true);

  const { data, error } = await q;
  if (error) throw mapRpcError(error);
  return (data ?? []) as FieldDefinition[];
}

export async function getEditableFieldKeys(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from('field_permissions')
    .select('field_key')
    .eq('user_id', userId)
    .eq('can_edit', true);
  if (error) throw mapRpcError(error);
  return (data ?? []).map((r) => (r as { field_key: string }).field_key);
}

/** Cảnh báo duplicate, KHÔNG block (mục 9). */
export async function findDuplicates(partNumber?: string | null, serialNumber?: string | null) {
  if (!partNumber || !serialNumber) return [];
  const { data } = await supabaseAdmin()
    .from('equipment')
    .select('id, serial_number, part_number')
    .eq('part_number', partNumber)
    .eq('serial_number', serialNumber)
    .is('archived_at', null)
    .limit(5);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// WRITE — tất cả qua RPC
// ---------------------------------------------------------------------------

export const createEquipment = (data: Record<string, unknown>, actor: string, reqId: string) =>
  rpc('create_equipment_with_audit', {
    p_data: data, p_actor: actor, p_request_id: reqId, p_source: 'ui',
  });

export const updateEquipment = (
  id: string, version: number, changes: Record<string, unknown>, actor: string, reqId: string,
) =>
  rpc('update_equipment_with_audit', {
    p_id: id, p_version: version, p_changes: changes, p_actor: actor, p_request_id: reqId,
  });

export const changeLocation = (
  id: string, locationId: string, version: number, actor: string, reqId: string,
) =>
  rpc('change_location_equipment', {
    p_id: id, p_new_location_id: locationId, p_version: version,
    p_actor: actor, p_request_id: reqId,
  });

export const moveEquipment = (
  id: string, newParentId: string, version: number, actor: string, reqId: string,
) =>
  rpc('move_equipment', {
    p_id: id, p_new_parent_id: newParentId, p_version: version,
    p_actor: actor, p_request_id: reqId,
  });

export const detachEquipment = (id: string, version: number, actor: string, reqId: string) =>
  rpc('detach_equipment', { p_id: id, p_version: version, p_actor: actor, p_request_id: reqId });

export const swapEquipment = (
  a: string, b: string, va: number, vb: number, actor: string, reqId: string,
) =>
  rpc('swap_equipment', {
    p_a: a, p_b: b, p_version_a: va, p_version_b: vb, p_actor: actor, p_request_id: reqId,
  });

export const archiveEquipment = (id: string, version: number, actor: string, reqId: string) =>
  rpc('archive_equipment', { p_id: id, p_version: version, p_actor: actor, p_request_id: reqId });

export const restoreEquipment = (id: string, version: number, actor: string, reqId: string) =>
  rpc('restore_equipment', { p_id: id, p_version: version, p_actor: actor, p_request_id: reqId });
