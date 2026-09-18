import 'server-only';

/**
 * Admin service — Spec v0.9 mục 27, 29a, 30.
 *
 * V1 KHÔNG có Account Request workflow: Admin tạo user trực tiếp.
 * Với 10–20 người onboard một lần, form request + hàng đợi review + rate limit
 * + chống enumeration là bộ máy không tương xứng. Cắt đi còn xoá luôn endpoint
 * public duy nhất của hệ thống.
 */
import { randomBytes } from 'node:crypto';
import { normalizeUsername } from '@/lib/auth/username';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AppError, mapRpcError } from '@/lib/errors';
import { PRESETS, type PresetKey } from '@/lib/permissions/presets';
import type { Role } from '@/lib/permissions';

/** Mật khẩu tạm 12 ký tự, bỏ các ký tự dễ đọc nhầm (0/O, 1/l/I). */
function tempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
  const bytes = randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function audit(
  entityType: 'user' | 'field' | 'location',
  entityId: string | null,
  action: string,
  changes: Record<string, unknown>,
  actor: string,
  reqId: string,
) {
  const { error } = await supabaseAdmin().from('audit_log').insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    changes,
    changed_by: actor,
    request_id: reqId,
  });
  if (error) throw mapRpcError(error);
}

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------

export async function listUsers() {
  const { data, error } = await supabaseAdmin()
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw mapRpcError(error);
  return data ?? [];
}

export type CreateUserInput = {
  full_name: string;
  email: string;
  username: string;
  employee_id?: string | null;
  department?: string | null;
  role: Role;
  preset: PresetKey;
};

/**
 * Tạo user + apply preset. Trả mật khẩu tạm MỘT LẦN DUY NHẤT.
 * Không lưu plaintext, không hiển thị lại. Admin gửi cho user qua kênh nội bộ.
 */
export async function createUser(input: CreateUserInput, actor: string, reqId: string) {
  const db = supabaseAdmin();
  const email = input.email.trim().toLowerCase();

  const { data: existing, error: emailError } = await db
    .from('user_profiles')
    .select('id')
    .ilike('email', email.replace(/[%_\\]/g, char => '\\' + char))
    .maybeSingle();
  if (emailError) throw new AppError('SERVER_ERROR');
  if (existing) throw new AppError('EMAIL_ALREADY_EXISTS');

  const username = normalizeUsername(input.username);
  if (!username) throw new AppError('VALIDATION_ERROR');
  const { data: conflicts, error: lookupError } = await db.from('user_profiles')
    .select('id').eq('username', username).limit(1);
  if (lookupError) throw new AppError('SERVER_ERROR');
  if (conflicts?.length) throw new AppError('USERNAME_ALREADY_EXISTS');

  const password = tempPassword();
  const { data: created, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !created.user) {
    if (authErr?.message?.toLowerCase().includes('already')) {
      throw new AppError('EMAIL_ALREADY_EXISTS');
    }
    throw new AppError('SERVER_ERROR', { stage: 'create_auth_user' });
  }

  const userId = created.user.id;
  const preset = PRESETS[input.preset];

  const { error: profErr } = await db.from('user_profiles').insert({
    id: userId,
    full_name: input.full_name.trim(),
    username,
    email,
    employee_id: input.employee_id ?? null,
    department: input.department ?? null,
    role: input.role,
    is_active: true,
    must_change_password: true,
    can_create: preset.can_create,
    can_move: preset.can_move,
    can_detach: preset.can_detach,
    can_archive: preset.can_archive,
  });
  if (profErr) {
    // Không để lại auth user mồ côi không có profile — withAuth sẽ trả
    // UNAUTHORIZED và không ai gỡ được ngoài SQL tay.
    await db.auth.admin.deleteUser(userId).catch(() => {});
    if (profErr.code === '23505' && profErr.message.includes('uq_user_profiles_username')) {
      throw new AppError('USERNAME_ALREADY_EXISTS');
    }
    throw mapRpcError(profErr);
  }

  await applyPreset(userId, input.preset, actor, reqId);
  await audit('user', userId, 'USER_CREATE',
    { role: { old: null, new: input.role }, preset: { old: null, new: input.preset } },
    actor, reqId);

  return { user_id: userId, email, username, temp_password: password };
}

export async function setUserActive(
  userId: string, active: boolean, actor: string, reqId: string,
) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('user_profiles')
    .update({ is_active: active })
    .eq('id', userId)
    .select('id, is_active')
    .maybeSingle();
  if (error) throw mapRpcError(error);
  if (!data) throw new AppError('VALIDATION_ERROR', { user_id: 'không tồn tại' });

  await audit('user', userId, active ? 'USER_REACTIVATE' : 'USER_DEACTIVATE',
    { is_active: { old: !active, new: active } }, actor, reqId);
  return data;
}

export async function setUserRole(userId: string, role: Role, actor: string, reqId: string) {
  const db = supabaseAdmin();
  const { data: before } = await db
    .from('user_profiles').select('role').eq('id', userId).maybeSingle();
  if (!before) throw new AppError('VALIDATION_ERROR', { user_id: 'không tồn tại' });

  const { error } = await db.from('user_profiles').update({ role }).eq('id', userId);
  if (error) throw mapRpcError(error);

  await audit('user', userId, 'FIELD_PERMISSION_UPDATE',
    { role: { old: (before as { role: string }).role, new: role } }, actor, reqId);
  return { user_id: userId, role };
}

export async function resetPassword(userId: string, actor: string, reqId: string) {
  const db = supabaseAdmin();
  const password = tempPassword();

  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) throw new AppError('SERVER_ERROR', { stage: 'reset_password' });

  await db.from('user_profiles').update({ must_change_password: true }).eq('id', userId);
  await audit('user', userId, 'USER_REACTIVATE', { password_reset: { old: null, new: true } },
    actor, reqId);

  return { user_id: userId, temp_password: password };
}

// ---------------------------------------------------------------------------
// PRESET  (mục 30)
// ---------------------------------------------------------------------------

export async function applyPreset(
  userId: string, presetKey: PresetKey, actor: string, reqId: string,
) {
  const db = supabaseAdmin();
  const preset = PRESETS[presetKey];

  const { data: defs, error: defErr } = await db
    .from('field_definitions').select('field_key');
  if (defErr) throw mapRpcError(defErr);

  const allKeys = (defs ?? []).map((d) => (d as { field_key: string }).field_key);
  const granted = preset.fields === 'ALL' ? allKeys : allKeys.filter((k) =>
    (preset.fields as readonly string[]).includes(k));

  const { error: delErr } = await db.from('field_permissions').delete().eq('user_id', userId);
  if (delErr) throw mapRpcError(delErr);

  if (granted.length > 0) {
    const { error: insErr } = await db.from('field_permissions').insert(
      granted.map((field_key) => ({
        user_id: userId, field_key, can_edit: true, updated_by: actor,
      })),
    );
    if (insErr) throw mapRpcError(insErr);
  }

  const { error: upErr } = await db.from('user_profiles').update({
    can_create: preset.can_create,
    can_move: preset.can_move,
    can_detach: preset.can_detach,
    can_archive: preset.can_archive,
  }).eq('id', userId);
  if (upErr) throw mapRpcError(upErr);

  await audit('user', userId, 'FIELD_PERMISSION_UPDATE',
    { preset: { old: null, new: presetKey } }, actor, reqId);

  // Cảnh báo bẫy Required × Permission (mục 30): nếu user không có quyền nhập
  // field đang Required thì sẽ không tạo được equipment nào.
  const { data: requiredDefs } = await db
    .from('field_definitions').select('field_key, display_label').eq('is_required', true);
  const blocking = (requiredDefs ?? [])
    .filter((d) => !granted.includes((d as { field_key: string }).field_key))
    .map((d) => (d as { display_label: string }).display_label);

  return {
    user_id: userId,
    preset: presetKey,
    granted_fields: granted,
    warning: preset.can_create && blocking.length > 0
      ? `Preset này không cấp quyền nhập ${blocking.length} trường đang Required (${blocking.join(', ')}) → user sẽ không tạo được thiết bị.`
      : null,
  };
}

export async function getPermissionMatrix() {
  const db = supabaseAdmin();
  const [{ data: users }, { data: perms }] = await Promise.all([
    db.from('user_profiles')
      .select('id, full_name, email, username, role, is_active, can_create, can_move, can_detach, can_archive')
      .order('full_name'),
    db.from('field_permissions').select('user_id, field_key').eq('can_edit', true),
  ]);

  const byUser = new Map<string, string[]>();
  for (const p of perms ?? []) {
    const row = p as { user_id: string; field_key: string };
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row.field_key]);
  }

  return (users ?? []).map((u) => {
    const row = u as { id: string };
    return { ...u, editable_fields: byUser.get(row.id) ?? [] };
  });
}

// ---------------------------------------------------------------------------
// LOCATIONS  (mục 10)
// ---------------------------------------------------------------------------

export async function listLocations(onlyActive: boolean) {
  let q = supabaseAdmin()
    .from('locations')
    .select('id, code, name, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true });
  if (onlyActive) q = q.eq('is_active', true);

  const { data, error } = await q;
  if (error) throw mapRpcError(error);
  return data ?? [];
}

export async function createLocation(
  input: { code: string; name?: string | null; sort_order?: number },
  actor: string, reqId: string,
) {
  const { data, error } = await supabaseAdmin().from('locations').insert({
    code: input.code.trim(),
    name: input.name ?? null,
    sort_order: input.sort_order ?? 0,
  }).select().maybeSingle();
  if (error) throw mapRpcError(error);

  await audit('location', (data as { id: string }).id, 'LOCATION_CONFIG_UPDATE',
    { code: { old: null, new: input.code } }, actor, reqId);
  return data;
}

export async function updateLocation(
  id: string,
  patch: { code?: string; name?: string | null; sort_order?: number; is_active?: boolean },
  actor: string, reqId: string,
) {
  const db = supabaseAdmin();
  const { data: before } = await db.from('locations').select('*').eq('id', id).maybeSingle();
  if (!before) throw new AppError('VALIDATION_ERROR', { location_id: 'không tồn tại' });

  const { data, error } = await db.from('locations').update(patch).eq('id', id)
    .select().maybeSingle();
  if (error) throw mapRpcError(error);

  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    changes[k] = { old: (before as Record<string, unknown>)[k], new: v };
  }
  await audit('location', id, 'LOCATION_CONFIG_UPDATE', changes, actor, reqId);
  return data;
}

// ---------------------------------------------------------------------------
// FIELD DEFINITIONS  (mục 11)
// ---------------------------------------------------------------------------

const FIELD_PATCHABLE = [
  'display_label', 'is_required', 'is_visible', 'display_order',
  'max_length', 'help_text', 'placeholder', 'dropdown_options',
] as const;

export async function updateFieldDefinition(
  fieldKey: string, patch: Record<string, unknown>, actor: string, reqId: string,
) {
  const db = supabaseAdmin();

  const clean: Record<string, unknown> = {};
  for (const k of FIELD_PATCHABLE) {
    if (k in patch) clean[k] = patch[k];
  }
  if (Object.keys(clean).length === 0) throw new AppError('VALIDATION_ERROR');

  const { data: before } = await db
    .from('field_definitions').select('*').eq('field_key', fieldKey).maybeSingle();
  if (!before) throw new AppError('VALIDATION_ERROR', { field_key: 'không tồn tại' });

  clean.updated_by = actor;
  const { data, error } = await db.from('field_definitions')
    .update(clean).eq('field_key', fieldKey).select().maybeSingle();
  if (error) throw mapRpcError(error);

  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(clean)) {
    if (k === 'updated_by') continue;
    changes[k] = { old: (before as Record<string, unknown>)[k], new: v };
  }
  await audit('field', (data as { id: string }).id, 'FIELD_CONFIG_UPDATE', changes, actor, reqId);
  return data;
}

/** Số record đang thiếu giá trị — hiển thị trước khi Admin bật Required (mục 11). */
export async function countMissingValues(fieldKey: string) {
  const { count, error } = await supabaseAdmin()
    .from('equipment')
    .select('id', { count: 'exact', head: true })
    .is(fieldKey, null)
    .is('archived_at', null);
  if (error) throw mapRpcError(error);
  return count ?? 0;
}

export async function listRecentErrors(limit = 50) {
  const { data, error } = await supabaseAdmin()
    .from('error_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw mapRpcError(error);
  return data ?? [];
}
