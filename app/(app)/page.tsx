'use client';

/**
 * Dashboard — Spec v0.9 mục 15, 17, 18, 38.
 *
 * Flat list, KHÔNG chèn duplicate child row (mục 16). Quan hệ cha–con nằm ở
 * popup chi tiết. Ở đây chỉ hiện một cột dấu hiệu nhỏ cho biết thiết bị có cha
 * hay có con — đủ để biết nên mở ra xem, không đủ để rối mắt.
 *
 * Search/filter/sort/pagination đều server-side. Ở 2.000 record thì client-side
 * cũng chạy được, nhưng đó là thứ đắt để sửa sau khi UI đã viết xong (mục 45).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api, ApiError,
  type Equipment, type FieldDefinition, type LocationRef,
} from '@/lib/client/api';
import { Button, Notice, Spinner, Tag } from '@/components/ui';
import { usePreferences } from '@/components/Preferences';
import { optionLabelL } from '@/lib/i18n/equipment';
import { DetailDrawer, type Me } from '@/components/equipment/DetailDrawer';

const PAGE_SIZE = 50;

type Filters = { status: string; types: string; level: string; current_location_id: string };
const EMPTY: Filters = { status: '', types: '', level: '', current_location_id: '' };

export default function Dashboard() {
  const { t, language } = usePreferences();
  const [me, setMe] = useState<Me | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [locations, setLocations] = useState<LocationRef[]>([]);

  const [rows, setRows] = useState<Equipment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [showArchived, setShowArchived] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openId || !me) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const content = contentRef.current;
    document.body.style.overflow = 'hidden';
    if (content) content.inert = true;
    detailRef.current?.focus();

    function keepFocusInside(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !detailRef.current) return;
      // A confirmation dialog manages its own focus while it is open.
      if (event.target instanceof HTMLElement && event.target.closest('[data-action-dialog]')) return;
      const focusable = Array.from(detailRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      )).filter(element => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === detailRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === detailRef.current)) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', keepFocusInside);
    return () => {
      document.removeEventListener('keydown', keepFocusInside);
      if (content) content.inert = false;
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [openId, me]);

  const defBy = useMemo(() => new Map(fields.map((f) => [f.field_key, f])), [fields]);

  // Bootstrap: metadata tải một lần, không tải lại theo từng lần lọc.
  useEffect(() => {
    void (async () => {
      try {
        const [meRes, fieldRes, locRes] = await Promise.all([
          api.get<Me>('/api/me'),
          api.get<{ fields: FieldDefinition[]; editable_fields: string[] }>('/api/fields'),
          api.get<LocationRef[]>('/api/locations'),
        ]);
        setMe({ ...meRes.data, editable_fields: meRes.data.editable_fields });
        setFields(fieldRes.data.fields);
        setLocations(locRes.data);
      } catch (e) {
        if (e instanceof ApiError) setError(e);
      }
    })();
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        showArchived: String(showArchived),
      });
      if (search.trim()) q.set('search', search.trim());
      for (const [k, v] of Object.entries(filters)) if (v) q.set(`filters[${k}]`, v);

      const res = await api.get<Equipment[]>(`/api/equipment?${q}`);
      setRows(res.data);
      setTotal(Number(res.meta.total ?? 0));
    } catch (e) {
      if (e instanceof ApiError) setError(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, filters, showArchived]);

  useEffect(() => {
    const timer = setTimeout(() => void fetchRows(), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [fetchRows, search]);

  useEffect(() => { setPage(1); }, [search, filters, showArchived]);

  // "/" nhảy vào ô tìm kiếm — người dùng gõ serial cả ngày.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Esc đóng popup được xử lý trong DetailDrawer (nó biết có dialog con đang mở
  // hay không, tránh đóng nhầm nhiều lớp cùng lúc).

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilter = search.trim() !== '' || Object.values(filters).some(Boolean);

  function dropdown(key: keyof Filters, label: string) {
    const def = defBy.get(key);
    const opts = key === 'current_location_id'
      ? locations.map((l) => ({ value: l.id, label: l.code }))
      : (def?.dropdown_options ?? []).map((o) => ({ value: o.value, label: optionLabelL(def, o.value, language) }));

    return (
      <select
        aria-label={label} value={filters[key]}
        onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
        className="border px-2 py-1 text-[12px]"
        style={{
          borderColor: filters[key] ? 'var(--machine)' : 'var(--rule)',
          background: 'var(--panel)',
          color: filters[key] ? 'var(--ok)' : 'var(--ink-2)',
        }}
      >
        <option value="">{label}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <div className="dashboard">
      <section ref={contentRef} className="flex min-w-0 flex-1 flex-col">
        <div className="dashboard-heading"><div>
          <h1>{t('Site Equipment Masterlist', 'Danh sách thiết bị nhà máy')}</h1>
          <p>{t('Find, track and manage your equipment in one place.', 'Tra cứu, theo dõi và quản lý thiết bị tại một nơi.')}</p></div>
          <div className="dashboard-count"><strong>{loading ? '—' : total}</strong><span>{t('Equipment', 'Thiết bị')}</span></div>
        </div><div className="equipment-panel">
        <div
          className="equipment-filters"
        >
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('Search equipment', 'Tìm thiết bị')} placeholder={t('Search serial, part, asset or location…', 'Tìm serial, part, asset hoặc vị trí…')}
            className="w-72 max-w-full border px-2.5 py-1 text-[13px]"
            style={{ borderColor: 'var(--rule)' }}
          />
          {dropdown('current_location_id', t('All locations', 'Mọi vị trí'))}
          {dropdown('types', t('All types', 'Mọi loại'))}
          {dropdown('level', t('All levels', 'Mọi level'))}
          {dropdown('status', t('All statuses', 'Mọi trạng thái'))}

          <label className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink-2)' }}>
            <input type="checkbox" checked={showArchived}
                   onChange={(e) => setShowArchived(e.target.checked)} />
            {t('Include archived', 'Hiện cả đã lưu trữ')}
          </label>

          {hasFilter && (
            <Button size="sm" onClick={() => { setSearch(''); setFilters(EMPTY); }}>
              {t('Clear filters', 'Xoá bộ lọc')}
            </Button>
          )}

          <span className="ml-auto text-[12px]" style={{ color: 'var(--ink-3)' }}>
            {loading ? t('Loading…', 'Đang tải…') : total + ' ' + t('records', 'thiết bị')}
          </span>
        </div>

        {error && <div className="px-4 pt-3"><Notice tone="alert">{error.message}</Notice></div>}

        {/* bảng */}
        <div className="equipment-scroll">
          {loading && rows.length === 0 ? (
            <Spinner label={t('Loading equipment…', 'Đang tải danh sách…')} />
          ) : rows.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="text-[14px]">
                {hasFilter ? t('No equipment matches your filters.', 'Không có thiết bị nào khớp bộ lọc.') : t('No equipment yet.', 'Chưa có thiết bị nào.')}
              </p>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-3)' }}>
                {hasFilter ? t('Try clearing a filter.', 'Thử bỏ bớt điều kiện lọc.') : t('Equipment will appear here once it is added.', 'Dữ liệu sẽ xuất hiện sau khi nhập từ Excel.')}
              </p>
            </div>
          ) : (
            <table className="grid-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }} aria-label={t('Relationships', 'Quan hệ')} />
                  <th>Serial</th>
                  <th>Part number</th>
                  <th>{t('Location', 'Vị trí')}</th>
                  <th>{t('Type', 'Loại')}</th>
                  <th>Level</th>
                  <th>{t('Status', 'Trạng thái')}</th>
                  <th>Asset</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    data-archived={!!r.archived_at}
                    onClick={(e) => { e.currentTarget.focus(); setOpenId(r.id); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpenId(r.id);
                      }
                    }}
                    tabIndex={0}
                    aria-label={t('Open equipment details for', 'Mở chi tiết thiết bị') + ' ' + r.serial_number}
                    className="cursor-pointer"
                    style={openId === r.id ? { background: 'var(--machine-tint)' } : undefined}
                  >
                    {/* Dấu hiệu quan hệ: ┬ có con, └ có cha, ├ cả hai. Mã hoá
                        thông tin bằng hình dạng chứ không bằng màu. */}
                    <td className="text-center" style={{ color: 'var(--ink-3)' }}>
                      <span className="ident text-[12px]" title={
                        r.parent_id && r.has_children ? t('Has parent and children', 'Có thiết bị cha và thiết bị con')
                          : r.has_children ? t('Has children', 'Có thiết bị con')
                          : r.parent_id ? t('Has parent', 'Có thiết bị cha') : t('Standalone', 'Độc lập')
                      }>
                        {r.parent_id && r.has_children ? '├' : r.has_children ? '┬' : r.parent_id ? '└' : ''}
                      </span>
                    </td>
                    <td className="ident font-medium">{r.serial_number}</td>
                    <td className="ident" style={{ color: 'var(--ink-2)' }}>{r.part_number ?? '—'}</td>
                    <td>{r.current_location?.code ?? '—'}</td>
                    <td style={{ color: 'var(--ink-2)' }}>{optionLabelL(defBy.get('types'), r.types, language)}</td>
                    <td style={{ color: 'var(--ink-2)' }}>{optionLabelL(defBy.get('level'), r.level, language)}</td>
                    <td>
                      {r.archived_at
                        ? <Tag text={t('Archived', 'Đã lưu trữ')} tone="warn" />
                        : r.status
                          ? <Tag text={optionLabelL(defBy.get('status'), r.status, language)} />
                          : <span style={{ color: 'var(--ink-3)' }}>—</span>}
                    </td>
                    <td className="ident" style={{ color: 'var(--ink-2)' }}>{r.asset ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="dashboard-footer">
          <span>{t('Showing', 'Hiển thị')} {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t('of', 'trên')} {total} {t('records', 'thiết bị')}</span>
          <div className="flex items-center gap-3">
            <Button size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('Previous', 'Trang trước')}</Button>
            <span>{t('Page', 'Trang')} {page} / {lastPage}</span>
            <Button size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>{t('Next', 'Trang sau')}</Button>
          </div>
        </div></div>
      </section>

      {openId && me && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 max-sm:p-0"
          style={{ background: 'rgba(18,25,26,0.45)' }}
          onClick={() => setOpenId(null)}
          role="presentation"
        >
          <div
            ref={detailRef}
            tabIndex={-1}
            className="flex h-[90vh] max-h-[760px] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-xl border shadow-xl outline-none max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none"
            style={{ background: 'var(--panel)', borderColor: 'var(--rule)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('Equipment details', 'Chi tiết thiết bị') + ': ' + (rows.find(row => row.id === openId)?.serial_number ?? '')}
          >
            <DetailDrawer
              key={openId}
              id={openId}
              me={me}
              fields={fields}
              locations={locations}
              onClose={() => setOpenId(null)}
              onChanged={() => void fetchRows()}
              onOpenOther={(id) => setOpenId(id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
