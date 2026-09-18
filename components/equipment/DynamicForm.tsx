'use client';

/**
 * Form engine sinh từ field_definitions — Spec v0.9 mục 11, 30, 31.
 *
 * Đây không phải "CRUD form": nó render input, áp validation, áp field
 * permission và xử lý input_type đặc biệt hoàn toàn từ metadata trong DB.
 * Admin đổi cấu hình field → form đổi theo, không cần deploy.
 *
 * Ba quy tắc dễ làm sai:
 *  1. current_location_id có input_type 'location_ref' → option lấy từ
 *     /api/locations, KHÔNG phải dropdown_options.
 *  2. Field không có quyền sửa là READ-ONLY, không phải ẩn (mục 30).
 *     Mọi user xem được mọi field is_visible.
 *  3. Required validate theo payload, không theo record (mục 11) — record cũ
 *     thiếu giá trị vẫn sửa được field khác.
 *
 * Ngôn ngữ: label / help / option đều hiển thị theo NGÔN NGỮ ĐANG CHỌN
 * (Preferences) — không trộn EN và VI cùng lúc.
 */

import { useMemo, useState } from 'react';
import type { DropdownOption, FieldDefinition, LocationRef } from '@/lib/client/api';
import { usePreferences } from '@/components/Preferences';
import { fieldHelp, fieldLabel, optionLabelL } from '@/lib/i18n/equipment';

export type FormValues = Record<string, string>;

type Props = {
  fields: FieldDefinition[];
  values: FormValues;
  onChange: (next: FormValues) => void;
  /** null = admin, toàn quyền. Mảng = danh sách field_key được sửa. */
  editableFields: string[] | null;
  locations: LocationRef[];
  /** Lỗi theo từng trường do server trả về (details.fields). */
  fieldErrors?: Record<string, string>;
  mode: 'create' | 'edit';
  /** Location là read-only khi thiết bị đang có Parent (mục 21). */
  locationLockedReason?: string | null;
  disabled?: boolean;
};

function canEdit(key: string, editableFields: string[] | null): boolean {
  return editableFields === null || editableFields.includes(key);
}

/** Option đã gỡ vẫn phải hiện nếu record đang giữ giá trị đó, nếu không user
 *  sẽ thấy ô trống và vô tình xoá dữ liệu khi lưu (mục 11). */
function optionsFor(def: FieldDefinition, current: string): DropdownOption[] {
  const opts = (def.dropdown_options ?? []).filter((o) => o.is_active);
  if (current && !opts.some((o) => o.value === current)) {
    const gone = def.dropdown_options?.find((o) => o.value === current);
    return [{ value: current, label: gone?.label ?? current, is_active: false }, ...opts];
  }
  return opts;
}

export function DynamicForm({
  fields, values, onChange, editableFields, locations,
  fieldErrors = {}, mode, locationLockedReason, disabled,
}: Props) {
  const { language, t } = usePreferences();
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => fields.filter((f) => f.is_visible).sort((a, b) => a.display_order - b.display_order),
    [fields],
  );

  function set(key: string, value: string) {
    setTouched((tset) => new Set(tset).add(key));
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {visible.map((def) => {
        const key = def.field_key;
        const value = values[key] ?? '';
        const isLocation = def.input_type === 'location_ref';
        const label = fieldLabel(def, language);
        const help = fieldHelp(def, language);

        const lockedByPermission = !canEdit(key, editableFields);
        const lockedByInheritance = isLocation && !!locationLockedReason;
        const readOnly = disabled || lockedByPermission || lockedByInheritance;

        // Required rỗng chỉ báo khi user đã chạm vào, hoặc khi tạo mới —
        // tránh bôi đỏ cả form ngay lúc mở ra sửa một record cũ.
        const emptyRequired =
          def.is_required && !value.trim() && (mode === 'create' || touched.has(key));
        const error = fieldErrors[key] ??
          (emptyRequired ? t(`${label} is required.`, `${label} là bắt buộc.`) : null);

        const wide = def.input_type === 'textarea';
        const inputStyle = {
          borderColor: error ? 'var(--alert)' : 'var(--rule)',
          background: readOnly ? 'var(--surface)' : 'var(--panel)',
          color: readOnly ? 'var(--ink-2)' : 'var(--ink)',
        };
        const identClass =
          ['serial_number', 'part_number', 'asset', 'jabil_id'].includes(key) ? 'ident' : '';

        return (
          <div key={key} className={wide ? 'sm:col-span-2' : ''}>
            <label className="block text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>
              {label}
              {def.is_required && <span style={{ color: 'var(--alert)' }}> *</span>}
            </label>

            {isLocation ? (
              <select
                value={value} disabled={readOnly}
                onChange={(e) => set(key, e.target.value)}
                className="mt-1 w-full border px-2 py-1.5 text-[13px]"
                style={inputStyle}
              >
                <option value="">{t('— select —', '— chọn —')}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code}{l.name && l.name !== l.code ? ` · ${l.name}` : ''}
                  </option>
                ))}
              </select>
            ) : def.input_type === 'dropdown' ? (
              <select
                value={value} disabled={readOnly}
                onChange={(e) => set(key, e.target.value)}
                className="mt-1 w-full border px-2 py-1.5 text-[13px]"
                style={inputStyle}
              >
                <option value="">{t('— select —', '— chọn —')}</option>
                {optionsFor(def, value).map((o) => (
                  <option key={o.value} value={o.value}>
                    {optionLabelL(def, o.value, language)}
                    {!o.is_active ? t(' (discontinued)', ' (đã ngừng dùng)') : ''}
                  </option>
                ))}
              </select>
            ) : def.input_type === 'textarea' ? (
              <textarea
                value={value} readOnly={readOnly} rows={3}
                maxLength={def.max_length ?? undefined}
                placeholder={def.placeholder ?? undefined}
                onChange={(e) => set(key, e.target.value)}
                className="mt-1 w-full resize-y border px-2 py-1.5 text-[13px]"
                style={inputStyle}
              />
            ) : (
              <input
                type={def.input_type === 'number' ? 'number' : def.input_type === 'date' ? 'date' : 'text'}
                value={value} readOnly={readOnly}
                maxLength={def.max_length ?? undefined}
                placeholder={def.placeholder ?? undefined}
                onChange={(e) => set(key, e.target.value)}
                className={`mt-1 w-full border px-2 py-1.5 text-[13px] ${identClass}`}
                style={inputStyle}
              />
            )}

            {error ? (
              <p className="mt-1 text-[11px]" style={{ color: 'var(--alert)' }}>{error}</p>
            ) : lockedByInheritance ? (
              <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
                {locationLockedReason}
              </p>
            ) : lockedByPermission ? (
              <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
                {t('You do not have permission to edit this field.', 'Bạn không có quyền sửa trường này.')}
              </p>
            ) : help ? (
              <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>{help}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Chỉ gửi lên những field user thực sự đổi — PUT là single-row, không cascade. */
export function changedFields(
  original: FormValues, current: FormValues, editableFields: string[] | null,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(current)) {
    if (k === 'current_location_id' || k === 'parent_id') continue; // có endpoint riêng
    if (!canEdit(k, editableFields)) continue;
    if ((original[k] ?? '') === v) continue;
    out[k] = v.trim() === '' ? null : v;
  }
  return out;
}
