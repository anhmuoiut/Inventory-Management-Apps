import type { FieldDefinition } from '@/lib/client/api';

export type EquipmentLanguage = 'en' | 'vi';
type Pair = readonly [english: string, vietnamese: string];

export const FIELD_LABELS: Record<string, Pair> = {
  serial_number: ['Serial Number', 'Số sê-ri'],
  part_number: ['Part Number', 'Mã linh kiện'],
  jabil_id: ['Jabil ID', 'Mã Jabil'],
  asset: ['Asset', 'Mã tài sản'],
  types: ['Type', 'Loại thiết bị'],
  level: ['Level', 'Cấp'],
  status: ['Status', 'Trạng thái'],
  current_location_id: ['Current Location', 'Vị trí hiện tại'],
  remark: ['Remark', 'Ghi chú'],
};

export const FIELD_HELP: Record<string, Pair> = {
  serial_number: [
    'The serial number printed on the equipment. Use it to find equipment and select a parent.',
    'Số sê-ri in trên thiết bị. Dùng mã này để tìm thiết bị và chọn thiết bị cha.',
  ],
  part_number: ['Equipment part number.', 'Mã linh kiện của thiết bị.'],
  jabil_id: ['Internal Jabil identifier, for example P12316.', 'Mã nội bộ Jabil, ví dụ P12316.'],
  asset: ['Asset identifier used for inventory checks.', 'Mã tài sản dùng để kiểm kê.'],
  types: [
    'Equipment type. Any type can be the parent of another.',
    'Loại thiết bị. Mọi loại đều có thể là thiết bị cha của loại khác.',
  ],
  level: ['Equipment level in the production line.', 'Cấp của thiết bị trong dây chuyền.'],
  status: ['Current operating status.', 'Trạng thái vận hành hiện tại.'],
  current_location_id: [
    'Current location. When the equipment has a parent, this field follows its parent and can only change through Move, Swap or Detach.',
    'Vị trí hiện tại. Nếu có thiết bị cha, vị trí này tự động theo thiết bị cha; chỉ thay đổi qua Di chuyển, Hoán đổi hoặc Tách.',
  ],
  remark: ['Free-form notes.', 'Ghi chú tự do.'],
};

export const OPTION_LABELS: Record<string, Record<string, Pair>> = {
  types: {
    machine: ['Machine', 'Máy'],
    base: ['Base', 'Đế'],
    fixture: ['Fixture', 'Đồ gá'],
    equipment: ['Equipment', 'Thiết bị'],
  },
  level: {
    unified_ft: ['Unified FT', 'Unified FT'],
    ict: ['ICT', 'ICT'],
    fct: ['FCT', 'FCT'],
  },
  status: {
    active: ['Active', 'Đang hoạt động'],
    inactive: ['Inactive', 'Ngừng hoạt động'],
    repair: ['Under Repair', 'Đang sửa chữa'],
    wait_reg: ['Wait for Registration', 'Chờ đăng ký'],
  },
};

function choose(pair: Pair, language: EquipmentLanguage): string {
  return language === 'vi' ? pair[1] : pair[0];
}

export function fieldLabel(def: FieldDefinition, language: EquipmentLanguage): string {
  const pair = FIELD_LABELS[def.field_key];
  return pair ? choose(pair, language) : def.display_label;
}

export function fieldHelp(def: FieldDefinition, language: EquipmentLanguage): string | null {
  const pair = FIELD_HELP[def.field_key];
  return pair ? choose(pair, language) : def.help_text;
}

export function optionLabelL(
  def: FieldDefinition | undefined,
  value: string | null,
  language: EquipmentLanguage,
): string {
  if (!value) return '—';
  const pair = def && OPTION_LABELS[def.field_key]?.[value];
  if (pair) return choose(pair, language);
  return def?.dropdown_options?.find((o) => o.value === value)?.label ?? value;
}
