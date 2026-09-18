/**
 * Permission preset — Spec v0.9 mục 30.
 *
 * V1 CHỈ có preset, không có UI tick từng ô. Ma trận user × field với 9 field
 * và 20 user là ~180 checkbox — phần đắt nhất màn hình Admin mà gần như không
 * ai dùng tới ở quy mô pilot.
 *
 * Bảng field_permissions giữ nguyên schema, nên v1.1 thêm UI per-cell KHÔNG
 * phải migrate dữ liệu.
 */

export type ActionPermission = 'create' | 'move' | 'detach' | 'archive';

export type Preset = {
  label: string;
  description: string;
  /** 'ALL' = mọi field trong field_definitions */
  fields: 'ALL' | readonly string[];
  can_create: boolean;
  can_move: boolean;
  can_detach: boolean;
  can_archive: boolean;
};

export const PRESETS = {
  full_editor: {
    label: 'Full Editor',
    description: 'Sửa mọi trường, tạo mới, move/detach/archive. Dùng cho người phụ trách chính.',
    fields: 'ALL',
    can_create: true, can_move: true, can_detach: true, can_archive: true,
  },
  equipment_ops: {
    label: 'Equipment Ops',
    description: 'Đổi trạng thái, ghi chú và vị trí; move/detach được nhưng không tạo mới, không archive.',
    fields: ['status', 'remark', 'current_location_id'],
    can_create: false, can_move: true, can_detach: true, can_archive: false,
  },
  data_entry: {
    label: 'Data Entry',
    description: 'Nhập và sửa thông tin thiết bị, tạo mới. Không đụng tới cấu trúc cha–con.',
    fields: ['jabil_id', 'part_number', 'serial_number', 'asset',
             'types', 'level', 'status', 'remark', 'current_location_id'],
    can_create: true, can_move: false, can_detach: false, can_archive: false,
  },
  read_only: {
    label: 'Read Only',
    description: 'Chỉ xem. Tương đương Viewer nhưng giữ role User để nâng quyền sau.',
    fields: [],
    can_create: false, can_move: false, can_detach: false, can_archive: false,
  },
} as const satisfies Record<string, Preset>;

export type PresetKey = keyof typeof PRESETS;

export const PRESET_KEYS = Object.keys(PRESETS) as PresetKey[];

export function isPresetKey(v: unknown): v is PresetKey {
  return typeof v === 'string' && v in PRESETS;
}
