import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '@/lib/client/api';
import { FIELD_LABELS, FIELD_HELP, fieldLabel, fieldHelp, optionLabelL } from './equipment';

function definition(field_key: string): FieldDefinition {
  return {
    field_key, display_label: 'Database label', help_text: 'Database help',
    data_type: 'text', input_type: 'dropdown', is_required: false,
    dropdown_options: [{ value: 'custom', label: 'Custom database option', is_active: true }],
    is_visible: true, display_order: 1, max_length: null, placeholder: null,
  };
}

describe('equipment language mappings', () => {
  it('provides separate label and help translations for all nine seeded fields', () => {
    expect(Object.keys(FIELD_LABELS)).toHaveLength(9);
    expect(Object.keys(FIELD_HELP).sort()).toEqual(Object.keys(FIELD_LABELS).sort());
    for (const key of Object.keys(FIELD_LABELS)) {
      const field = definition(key);
      const enLabel = fieldLabel(field, 'en');
      const viLabel = fieldLabel(field, 'vi');
      const enHelp = fieldHelp(field, 'en');
      const viHelp = fieldHelp(field, 'vi');
      expect(enLabel).not.toBe(viLabel);
      expect(enHelp).toBeTruthy();
      expect(viHelp).toBeTruthy();
      expect(enHelp).not.toBe(viHelp);
      expect(enLabel + enHelp).not.toMatch(/[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i);
    }
  });
  it('translates the stored status values without changing their values', () => {
    const status = definition('status');
    expect(optionLabelL(status, 'repair', 'en')).toBe('Under Repair');
    expect(optionLabelL(status, 'repair', 'vi')).toBe('Đang sửa chữa');
    expect(optionLabelL(definition('types'), 'fixture', 'vi')).toBe('Đồ gá');
  });
  it('preserves admin-defined fields and options as database text', () => {
    const custom = definition('custom_field');
    expect(fieldLabel(custom, 'en')).toBe('Database label');
    expect(fieldHelp(custom, 'vi')).toBe('Database help');
    expect(optionLabelL(custom, 'custom', 'vi')).toBe('Custom database option');
  });
}
);
