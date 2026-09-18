/**
 * Kiểm tra quyền — Spec v0.9 mục 29–32.
 *
 * Nguyên tắc V1:
 *   - Mọi user đã đăng nhập XEM ĐƯỢC mọi field is_visible.
 *     field_permissions chỉ quyết định quyền SỬA (mục 30).
 *   - Admin toàn quyền, không phụ thuộc field_permissions.
 *   - Viewer chỉ xem.
 *   - Không có record trong field_permissions → deny.
 */
import { AppError } from '@/lib/errors';
import type { ActionPermission } from './presets';

export type Role = 'admin' | 'user' | 'viewer';

export type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  username: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  can_create: boolean;
  can_move: boolean;
  can_detach: boolean;
  can_archive: boolean;
};

const ACTION_COLUMN: Record<ActionPermission, keyof UserProfile> = {
  create: 'can_create',
  move: 'can_move',
  detach: 'can_detach',
  archive: 'can_archive',
};

export function isAdmin(p: UserProfile): boolean {
  return p.role === 'admin';
}

/** Restore là Admin-only, không có cột riêng (mục 32). */
export function canRestore(p: UserProfile): boolean {
  return isAdmin(p);
}

export function canDoAction(p: UserProfile, action: ActionPermission): boolean {
  if (p.role === 'viewer') return false;
  if (isAdmin(p)) return true;
  return p[ACTION_COLUMN[action]] === true;
}

export function assertAction(p: UserProfile, action: ActionPermission): void {
  if (!canDoAction(p, action)) throw new AppError('FORBIDDEN', { action });
}

/**
 * Trả về các field trong payload mà user KHÔNG có quyền sửa.
 * editableFields = danh sách field_key có can_edit = true của user đó.
 */
export function deniedFields(
  p: UserProfile,
  payloadKeys: readonly string[],
  editableFields: readonly string[],
): string[] {
  if (isAdmin(p)) return [];
  if (p.role === 'viewer') return [...payloadKeys];
  const allowed = new Set(editableFields);
  return payloadKeys.filter((k) => !allowed.has(k));
}

export function assertFields(
  p: UserProfile,
  payloadKeys: readonly string[],
  editableFields: readonly string[],
): void {
  const denied = deniedFields(p, payloadKeys, editableFields);
  if (denied.length > 0) {
    throw new AppError('FIELD_PERMISSION_DENIED', { denied_fields: denied });
  }
}

export type { ActionPermission };
