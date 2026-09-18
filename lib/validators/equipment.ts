/**
 * Validation — Spec v0.9 mục 11, 39.
 *
 * Required được validate THEO PAYLOAD, không theo record (mục 11):
 *   Create → mọi field is_required phải có giá trị
 *   Update → chỉ reject nếu field is_required CÓ MẶT trong payload mà rỗng
 * Nhờ vậy record cũ thiếu giá trị vẫn edit được field khác bình thường.
 */
import { z } from 'zod';
import { AppError } from '@/lib/errors';

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

/** Field chỉ đổi qua endpoint riêng, không bao giờ qua PUT (mục 7, 39). */
export const PUT_FORBIDDEN_FIELDS = ['current_location_id', 'parent_id'] as const;

export const uuid = z.string().uuid();

export const versionSchema = z.number().int().nonnegative();

export const putSchema = z.object({
  version: versionSchema,
  fields: z.record(z.union([z.string(), z.number(), z.null()])),
});

export const createSchema = z.object({
  fields: z.record(z.union([z.string(), z.number(), z.null()])),
});

export const moveSchema = z.object({ version: versionSchema, new_parent_id: uuid });
export const changeLocationSchema = z.object({ version: versionSchema, new_location_id: uuid });
export const versionOnlySchema = z.object({ version: versionSchema });
export const swapSchema = z.object({
  equipment_a_id: uuid,
  equipment_b_id: uuid,
  version_a: versionSchema,
  version_b: versionSchema,
});

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new AppError('VALIDATION_ERROR', { issues: r.error.issues.slice(0, 10) });
  }
  return r.data;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/**
 * Validate payload theo field_definitions.
 * mode 'create' → required áp dụng cho TẤT CẢ field required
 * mode 'update' → required chỉ áp dụng cho field có mặt trong payload
 */
export function validateFields(
  fields: Record<string, unknown>,
  defs: FieldDefinition[],
  mode: 'create' | 'update',
): Record<string, unknown> {
  const byKey = new Map(defs.map((d) => [d.field_key, d]));
  const issues: Record<string, string> = {};
  const clean: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(fields)) {
    if (mode === 'update' && (PUT_FORBIDDEN_FIELDS as readonly string[]).includes(key)) {
      issues[key] = 'Trường này chỉ đổi được qua thao tác riêng (Change Location / Move / Detach).';
      continue;
    }

    const def = byKey.get(key);
    if (!def) {
      issues[key] = 'Trường không tồn tại.';
      continue;
    }

    const value = typeof raw === 'string' ? raw.trim() : raw;

    if (isEmpty(value)) {
      if (def.is_required) issues[key] = `${def.display_label} là bắt buộc.`;
      clean[key] = null;
      continue;
    }

    const str = String(value);

    if (def.max_length && str.length > def.max_length) {
      issues[key] = `${def.display_label} tối đa ${def.max_length} ký tự.`;
      continue;
    }

    if (def.input_type === 'number' && Number.isNaN(Number(str))) {
      issues[key] = `${def.display_label} phải là số.`;
      continue;
    }

    if (def.input_type === 'dropdown') {
      const opts = def.dropdown_options ?? [];
      const match = opts.find((o) => o.value === str);
      if (!match) {
        issues[key] = `${def.display_label}: giá trị không hợp lệ.`;
        continue;
      }
      // Option đã deactivate không chọn được cho record mới (mục 11),
      // nhưng record cũ vẫn hiển thị đúng label.
      if (!match.is_active) {
        issues[key] = `${def.display_label}: lựa chọn này đã ngừng sử dụng.`;
        continue;
      }
    }

    clean[key] = str;
  }

  if (mode === 'create') {
    for (const def of defs) {
      if (!def.is_required) continue;
      if (def.field_key === 'current_location_id') continue; // xử lý riêng ở RPC
      if (isEmpty(clean[def.field_key])) {
        issues[def.field_key] = `${def.display_label} là bắt buộc.`;
      }
    }
  }

  if (Object.keys(issues).length > 0) {
    throw new AppError('VALIDATION_ERROR', { fields: issues });
  }
  return clean;
}
