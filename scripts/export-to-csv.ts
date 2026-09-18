/**
 * export-to-csv — Spec v0.9 mục 55.3.
 *
 * Dev-only, KHÔNG phải tính năng UI (Export UI nằm ở v1.1).
 * Đây là điều kiện rollback: không có script này thì V1 không có đường lấy
 * dữ liệu ra, và pilot bị khoá chân vào hệ thống.
 *
 * Chạy: npx tsx scripts/export-to-csv.ts > backup-$(date +%F).csv
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const COLS = ['id', 'jabil_id', 'part_number', 'serial_number', 'asset', 'types',
  'level', 'status', 'remark', 'parent_serial', 'location_code',
  'archived_at', 'created_at', 'updated_at'] as const;

function csv(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

const { data, error } = await db
  .from('equipment')
  .select(`id, jabil_id, part_number, serial_number, asset, types, level, status,
           remark, archived_at, created_at, updated_at,
           parent:equipment!equipment_parent_id_fkey ( serial_number ),
           location:locations!equipment_current_location_id_fkey ( code )`)
  .order('serial_sort');

if (error) { console.error(error.message); process.exit(1); }

console.log(COLS.join(','));
/**
 * PostgREST trả embedded relation dưới dạng object cho FK to-one, nhưng type
 * sinh ra lại là array. Chuẩn hoá cả hai dạng thay vì ép kiểu mù.
 */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
  const parent = one(r.parent as { serial_number?: string } | { serial_number?: string }[] | null);
  const location = one(r.location as { code?: string } | { code?: string }[] | null);
  console.log([
    r.id, r.jabil_id, r.part_number, r.serial_number, r.asset,
    r.types, r.level, r.status, r.remark,
    parent?.serial_number ?? '', location?.code ?? '',
    r.archived_at, r.created_at, r.updated_at,
  ].map(csv).join(','));
}
