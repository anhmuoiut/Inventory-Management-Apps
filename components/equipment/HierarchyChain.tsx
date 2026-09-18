'use client';

/**
 * Chuỗi phân cấp — Spec v0.9 mục 16.
 *
 * Đây là điểm nhấn duy nhất của giao diện. Dashboard cố tình là flat list
 * (mục 15), nên đây là chỗ duy nhất người dùng nhìn thấy quan hệ cha–con.
 * Vẽ như một dây xích thẳng đứng: ancestors chạy từ gốc xuống, thiết bị đang
 * xem nằm giữa và được neo bằng thanh dọc màu sơn máy, descendants toả xuống
 * dưới theo độ sâu.
 *
 * Thiết bị đã archive hiển thị mờ và gạch ngang — chúng KHÔNG đi theo khi
 * parent đổi location (mục 20), nên phải nhìn ra ngay.
 */

import type { ContextNode, FieldDefinition, LocationRef } from '@/lib/client/api';
import { usePreferences } from '@/components/Preferences';
import { optionLabelL } from '@/lib/i18n/equipment';

type Props = {
  current: { id: string; serial_number: string; types: string | null; current_location_id: string };
  ancestors: ContextNode[];
  descendants: ContextNode[];
  locations: LocationRef[];
  fields?: FieldDefinition[];
  onOpen: (id: string) => void;
};

function Node({
  serial, meta, location, archived, tone, indent, onClick,
}: {
  serial: string;
  meta: string;
  location: string;
  archived: boolean;
  tone: 'ancestor' | 'current' | 'descendant';
  indent: number;
  onClick?: () => void;
}) {
  const isCurrent = tone === 'current';
  return (
    <div className="relative flex items-center" style={{ paddingLeft: indent * 16 }}>
      {/* đoạn nối ngang */}
      {indent > 0 && (
        <span
          aria-hidden
          className="absolute h-px"
          style={{ left: indent * 16 - 12, width: 10, background: 'var(--rule)' }}
        />
      )}
      <button
        onClick={onClick}
        disabled={isCurrent}
        className="flex flex-1 items-center gap-2 border-l-2 py-1.5 pl-2.5 text-left disabled:cursor-default"
        style={{
          borderColor: isCurrent ? 'var(--machine)' : 'transparent',
          background: isCurrent ? 'var(--machine-tint)' : 'transparent',
        }}
      >
        <span
          className="ident text-[13px] font-medium"
          style={{
            color: archived ? 'var(--ink-3)' : isCurrent ? 'var(--ok)' : 'var(--ink)',
            textDecoration: archived ? 'line-through' : undefined,
          }}
        >
          {serial}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>{meta}</span>
        <span className="ml-auto text-[11px]" style={{ color: 'var(--ink-3)' }}>{location}</span>
      </button>
    </div>
  );
}

export function HierarchyChain({ current, ancestors, descendants, locations, fields = [], onOpen }: Props) {
  const { t, language } = usePreferences();
  const locCode = (id: string) => locations.find((l) => l.id === id)?.code ?? '—';
  const typesDef = fields.find((f) => f.field_key === 'types');
  const typeLabel = (v: string | null) => (v ? optionLabelL(typesDef, v, language) : '');

  // get_equipment_ancestors trả depth tăng dần khi đi lên, nên đảo lại để gốc ở trên.
  const chain = [...ancestors].sort((a, b) => b.depth - a.depth);
  const maxAncestorIndent = chain.length;

  if (chain.length === 0 && descendants.length === 0) {
    return (
      <p className="py-3 text-[13px]" style={{ color: 'var(--ink-3)' }}>
        {t(
          'Standalone equipment — not attached to anything and has no child equipment.',
          'Thiết bị độc lập — chưa gắn vào đâu và chưa có thiết bị con.',
        )}
      </p>
    );
  }

  return (
    <div className="relative">
      {/* trục dọc của dây xích */}
      <span
        aria-hidden
        className="absolute bottom-2 top-2 w-px"
        style={{ left: 3, background: 'var(--rule)' }}
      />

      <div className="relative">
        {chain.map((n, i) => (
          <Node
            key={n.id}
            serial={n.serial_number}
            meta={typeLabel(n.types)}
            location={locCode(n.current_location_id)}
            archived={!!n.archived_at}
            tone="ancestor"
            indent={i}
            onClick={() => onOpen(n.id)}
          />
        ))}

        <Node
          serial={current.serial_number}
          meta={typeLabel(current.types)}
          location={locCode(current.current_location_id)}
          archived={false}
          tone="current"
          indent={maxAncestorIndent}
        />

        {descendants.map((n) => (
          <Node
            key={n.id}
            serial={n.serial_number}
            meta={typeLabel(n.types)}
            location={locCode(n.current_location_id)}
            archived={!!n.archived_at}
            tone="descendant"
            indent={maxAncestorIndent + n.depth}
            onClick={() => onOpen(n.id)}
          />
        ))}
      </div>

      {descendants.some((d) => d.archived_at) && (
        <p className="mt-3 text-[11px]" style={{ color: 'var(--ink-3)' }}>
          {t(
            'Struck-through equipment is archived. It keeps its old location and does not follow when the parent is moved.',
            'Thiết bị gạch ngang đã được lưu trữ. Chúng giữ nguyên vị trí cũ và không đổi theo khi thiết bị cha được chuyển chỗ.',
          )}
        </p>
      )}
    </div>
  );
}
