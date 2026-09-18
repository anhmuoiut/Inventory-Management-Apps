'use client';

/**
 * API client — Spec v0.9 mục 35, 36.
 *
 * Mọi lỗi từ server đều có { code, message, request_id }. ApiError giữ nguyên
 * request_id để user đọc cho Admin khi báo lỗi — log Vercel chỉ giữ ~1 giờ nên
 * đây là sợi dây duy nhất nối báo cáo của user với error_log trong DB.
 */

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown>,
    readonly requestId: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Lỗi do người khác vừa sửa dữ liệu — UI cần mời tải lại thay vì báo đỏ. */
  get isConflict() {
    return this.code === 'OPTIMISTIC_CONFLICT' || this.code === 'LOCK_TIMEOUT';
  }

  /** Lỗi theo từng trường, để gắn vào ô nhập tương ứng. */
  get fieldErrors(): Record<string, string> {
    const f = this.details.fields;
    return f && typeof f === 'object' ? (f as Record<string, string>) : {};
  }
}

type Envelope<T> =
  | { success: true; data: T; meta: Record<string, unknown> }
  | { success: false; error: { code: string; message: string; details: Record<string, unknown>; request_id: string } };

export type Result<T> = { data: T; meta: Record<string, unknown> };

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError('SERVER_ERROR', 'Máy chủ trả về dữ liệu không đọc được.', {}, '-', res.status);
  }

  if (!body.success) {
    throw new ApiError(
      body.error.code, body.error.message, body.error.details,
      body.error.request_id, res.status,
    );
  }
  return { data: body.data, meta: body.meta };
}

export const api = {
  get: <T>(path: string) => call<T>(path),
  post: <T>(path: string, body?: unknown) =>
    call<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body: unknown) =>
    call<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
};

// --------------------------------------------------------------------------
// Kiểu dữ liệu dùng chung
// --------------------------------------------------------------------------

export type LocationRef = { id: string; code: string; name: string | null; sort_order: number };

export type Equipment = {
  id: string;
  jabil_id: string | null;
  part_number: string | null;
  serial_number: string;
  asset: string | null;
  types: string | null;
  level: string | null;
  status: string | null;
  remark: string | null;
  current_location_id: string;
  current_location: LocationRef | null;
  parent_id: string | null;
  has_children?: boolean;
  version: number;
  archived_at: string | null;
  updated_at: string;
};

export type DropdownOption = { value: string; label: string; is_active: boolean };

export type FieldDefinition = {
  field_key: string;
  display_label: string;
  data_type: 'text' | 'number' | 'date';
  input_type: 'text' | 'textarea' | 'number' | 'date' | 'dropdown' | 'location_ref';
  is_required: boolean;
  dropdown_options: DropdownOption[] | null;
  is_visible: boolean;
  display_order: number;
  max_length: number | null;
  help_text: string | null;
  placeholder: string | null;
};

export type ContextNode = {
  id: string; serial_number: string; part_number: string | null;
  types: string | null; status: string | null;
  current_location_id: string; parent_id: string | null;
  archived_at: string | null; depth: number;
};

export type AuditEntry = {
  id: string; action: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  changed_by: string | null; created_at: string;
  note: string | null; source: string; request_id: string | null;
};

/** Hiển thị giờ Việt Nam (mục 43). Dữ liệu lưu timestamptz. */
export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso));
}

/** Đổi value đã lưu sang label người dùng đọc; giữ nguyên nếu option đã bị gỡ. */
export function optionLabel(def: FieldDefinition | undefined, value: string | null): string {
  if (!value) return '—';
  const opt = def?.dropdown_options?.find((o) => o.value === value);
  return opt?.label ?? value;
}
