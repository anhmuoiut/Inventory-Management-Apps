'use client';

/**
 * Chi tiết thiết bị — Spec v0.9 mục 49.
 * Mở dưới dạng popup (modal) ở giữa màn hình. Mobile: full màn hình.
 *
 * Mỗi thao tác đổi cấu trúc (Change Location / Move / Swap) đều phải hiện
 * SỐ DESCENDANTS SẼ BỊ ẢNH HƯỞNG trước khi user bấm đồng ý (mục 49) — đây là
 * chỗ người dùng dễ gây hậu quả ngoài ý muốn nhất.
 *
 * Ngôn ngữ: toàn bộ chữ trong panel theo NGÔN NGỮ ĐANG CHỌN (Preferences),
 * không trộn EN và VI cùng lúc.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api, ApiError, formatTime,
  type AuditEntry, type ContextNode, type Equipment,
  type FieldDefinition, type LocationRef,
} from '@/lib/client/api';
import { Button, Modal, Notice, Spinner, Tag } from '@/components/ui';
import { usePreferences } from '@/components/Preferences';
import { fieldLabel, optionLabelL } from '@/lib/i18n/equipment';
import { DynamicForm, changedFields, type FormValues } from './DynamicForm';
import { HierarchyChain } from './HierarchyChain';

export type Me = {
  id: string; role: 'admin' | 'user' | 'viewer';
  can_create: boolean; can_move: boolean; can_detach: boolean; can_archive: boolean;
  editable_fields: string[] | null;
};

type Props = {
  id: string;
  me: Me;
  fields: FieldDefinition[];
  locations: LocationRef[];
  onClose: () => void;
  onChanged: () => void;
  onOpenOther: (id: string) => void;
};

const BUSINESS_KEYS = ['jabil_id', 'part_number', 'serial_number', 'asset',
  'types', 'level', 'status', 'remark', 'current_location_id'] as const;

function toValues(e: Equipment): FormValues {
  const v: FormValues = {};
  for (const k of BUSINESS_KEYS) v[k] = (e as unknown as Record<string, string | null>)[k] ?? '';
  return v;
}

export function DetailDrawer({
  id, me, fields, locations, onClose, onChanged, onOpenOther,
}: Props) {
  const { t } = usePreferences();
  const [eq, setEq] = useState<Equipment | null>(null);
  const [ctx, setCtx] = useState<{ ancestors: ContextNode[]; descendants: ContextNode[] } | null>(null);
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [tab, setTab] = useState<'info' | 'chain' | 'history'>('info');

  const [values, setValues] = useState<FormValues>({});
  const [original, setOriginal] = useState<FormValues>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'move' | 'location' | 'detach' | 'archive' | 'restore'>(null);

  const isViewer = me.role === 'viewer';
  const isArchived = !!eq?.archived_at;
  const hasParent = !!eq?.parent_id;
  const liveDescendants = (ctx?.descendants ?? []).filter((d) => !d.archived_at).length;

  // Esc đóng popup — nhưng nếu đang mở một dialog thao tác thì để dialog tự đóng trước.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !dialog) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, onClose]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [e, c] = await Promise.all([
        api.get<Equipment>(`/api/equipment/${id}`),
        api.get<{ ancestors: ContextNode[]; descendants: ContextNode[] }>(`/api/equipment/${id}/context`),
      ]);
      setEq(e.data);
      setCtx(c.data);
      setValues(toValues(e.data));
      setOriginal(toValues(e.data));
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (tab !== 'history' || history) return;
    void api.get<AuditEntry[]>(`/api/equipment/${id}/history`).then((r) => setHistory(r.data));
  }, [tab, history, id]);

  const dirty = useMemo(
    () => Object.keys(changedFields(original, values, me.editable_fields)).length > 0,
    [original, values, me.editable_fields],
  );

  async function run<T>(fn: () => Promise<T>, successMsg: string) {
    setBusy(true); setError(null); setFlash(null);
    try {
      await fn();
      setFlash(successMsg);
      setHistory(null);
      await load();
      onChanged();
    } catch (err) {
      if (err instanceof ApiError) setError(err); else throw err;
    } finally {
      setBusy(false);
      setDialog(null);
    }
  }

  const save = () =>
    run(
      () => api.put(`/api/equipment/${id}`, {
        version: eq!.version,
        fields: changedFields(original, values, me.editable_fields),
      }),
      t('Changes saved.', 'Đã lưu thay đổi.'),
    );

  if (!eq) {
    return (
      <div className="flex h-full flex-col">
        {error ? (
          <div className="p-5"><Notice tone="alert" dismissLabel={t('Close', 'Đóng')}>{error.message}</Notice></div>
        ) : <Spinner label={t('Loading equipment', 'Đang tải thiết bị')} />}
      </div>
    );
  }

  const canEditAnything = !isViewer && !isArchived &&
    (me.editable_fields === null || me.editable_fields.length > 0);

  return (
    <div className="flex h-full flex-col">
      {/* đầu popup */}
      <header className="flex items-start gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--rule)' }}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="ident truncate text-[17px] font-semibold">{eq.serial_number}</h2>
            {isArchived && <Tag text={t('Archived', 'Đã lưu trữ')} tone="warn" />}
            {hasParent && <Tag text={t('Has parent', 'Có thiết bị cha')} />}
          </div>
          <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-3)' }}>
            {eq.current_location?.code ?? '—'} · {t('updated', 'cập nhật')} {formatTime(eq.updated_at)} · {t('version', 'phiên bản')} {eq.version}
          </p>
        </div>
        <Button size="sm" onClick={onClose} aria-label={t('Close', 'Đóng')}>{t('Close', 'Đóng')}</Button>
      </header>

      {/* tab */}
      <nav className="flex gap-4 border-b px-5" style={{ borderColor: 'var(--rule)' }}>
        {([['info', t('Information', 'Thông tin')], ['chain', t('Hierarchy', 'Phân cấp')], ['history', t('History', 'Lịch sử')]] as const).map(([k, label]) => (
          <button
            key={k} onClick={() => setTab(k)}
            className="border-b-2 py-2 text-[13px] font-medium"
            style={{
              borderColor: tab === k ? 'var(--machine)' : 'transparent',
              color: tab === k ? 'var(--ink)' : 'var(--ink-3)',
            }}
          >
            {label}
            {k === 'chain' && liveDescendants > 0 && (
              <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ink-3)' }}>{liveDescendants}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {flash && <div className="mb-4"><Notice tone="info" dismissLabel={t('Close', 'Đóng')} onDismiss={() => setFlash(null)}>{flash}</Notice></div>}

        {error && (
          <div className="mb-4">
            <Notice tone={error.isConflict ? 'warn' : 'alert'} dismissLabel={t('Close', 'Đóng')} onDismiss={() => setError(null)}>
              <p>{error.message}</p>
              {error.isConflict && (
                <button onClick={() => void load()} className="mt-1 underline">{t('Reload latest data', 'Tải lại dữ liệu mới nhất')}</button>
              )}
              {!error.isConflict && error.requestId !== '-' && (
                <p className="ident mt-1 text-[11px]">{t('Request ID', 'Mã yêu cầu')}: {error.requestId}</p>
              )}
            </Notice>
          </div>
        )}

        {tab === 'info' && (
          <>
            <DynamicForm
              fields={fields}
              values={values}
              onChange={setValues}
              editableFields={me.editable_fields}
              locations={locations}
              fieldErrors={error?.fieldErrors}
              mode="edit"
              disabled={isViewer || isArchived}
              locationLockedReason={
                hasParent
                  ? t(
                      'Location follows the parent automatically. Use Change location, Change parent or Detach to change it.',
                      'Vị trí tự động theo thiết bị cha. Dùng Chuyển vị trí, Đổi cha hoặc Tách ra để thay đổi.',
                    )
                  : null
              }
            />

            {canEditAnything && (
              <div className="mt-5 flex items-center gap-2">
                <Button variant="primary" disabled={!dirty || busy} onClick={() => void save()}>
                  {busy ? t('Saving', 'Đang lưu') : t('Save changes', 'Lưu thay đổi')}
                </Button>
                {dirty && (
                  <Button disabled={busy} onClick={() => setValues(original)}>{t('Undo', 'Hoàn tác')}</Button>
                )}
              </div>
            )}

            {/* Thao tác cấu trúc */}
            {!isViewer && (
              <section className="mt-8 border-t pt-4" style={{ borderColor: 'var(--rule-soft)' }}>
                <h3 className="text-[13px] font-semibold">{t('Actions', 'Thao tác')}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!isArchived && !hasParent && (
                    <Button size="sm" onClick={() => setDialog('location')}>{t('Change location', 'Chuyển vị trí')}</Button>
                  )}
                  {!isArchived && me.can_move && (
                    <Button size="sm" onClick={() => setDialog('move')}>{t('Change parent', 'Đổi thiết bị cha')}</Button>
                  )}
                  {!isArchived && hasParent && me.can_detach && (
                    <Button size="sm" onClick={() => setDialog('detach')}>{t('Detach from parent', 'Tách khỏi cha')}</Button>
                  )}
                  {!isArchived && me.can_archive && (
                    <Button size="sm" variant="danger" onClick={() => setDialog('archive')}>{t('Archive', 'Lưu trữ')}</Button>
                  )}
                  {isArchived && me.role === 'admin' && (
                    <Button size="sm" onClick={() => setDialog('restore')}>{t('Restore', 'Khôi phục')}</Button>
                  )}
                </div>
                {isArchived && me.role !== 'admin' && (
                  <p className="mt-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    {t('This equipment is archived. Only an administrator can restore it.', 'Thiết bị đã được lưu trữ. Chỉ quản trị viên mới có thể khôi phục.')}
                  </p>
                )}
              </section>
            )}
          </>
        )}

        {tab === 'chain' && ctx && (
          <HierarchyChain
            current={eq}
            ancestors={ctx.ancestors}
            descendants={ctx.descendants}
            locations={locations}
            fields={fields}
            onOpen={onOpenOther}
          />
        )}

        {tab === 'history' && (
          history === null ? <Spinner label={t('Loading history', 'Đang tải lịch sử')} /> : <HistoryList entries={history} fields={fields} />
        )}
      </div>

      <ActionDialogs
        dialog={dialog}
        eq={eq}
        locations={locations}
        liveDescendants={liveDescendants}
        busy={busy}
        onCancel={() => setDialog(null)}
        onRun={run}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function actionLabel(action: string, t: (en: string, vi: string) => string): string {
  const map: Record<string, [string, string]> = {
    CREATE: ['Created', 'Tạo mới'],
    UPDATE: ['Updated fields', 'Sửa thông tin'],
    CHANGE_LOCATION: ['Changed location', 'Chuyển vị trí'],
    MOVE: ['Changed parent', 'Đổi thiết bị cha'],
    MOVE_CASCADE: ['Location changed with parent', 'Đổi vị trí theo thiết bị cha'],
    SWAP: ['Swapped', 'Hoán đổi'],
    DETACH: ['Detached from parent', 'Tách khỏi cha'],
    ARCHIVE: ['Archived', 'Đã lưu trữ'],
    RESTORE: ['Restored', 'Khôi phục'],
  };
  const pair = map[action];
  return pair ? t(pair[0], pair[1]) : action;
}

function HistoryList({ entries, fields }: { entries: AuditEntry[]; fields: FieldDefinition[] }) {
  const { t, language } = usePreferences();
  const defByKey = new Map(fields.map((f) => [f.field_key, f]));

  if (entries.length === 0) {
    return <p className="py-6 text-[13px]" style={{ color: 'var(--ink-3)' }}>{t('No changes have been recorded yet.', 'Chưa có thay đổi nào được ghi lại.')}</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li key={e.id} className="border-l-2 pl-3" style={{ borderColor: 'var(--rule)' }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium">{actionLabel(e.action, t)}</span>
            <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>{formatTime(e.created_at)}</span>
          </div>

          {e.action !== 'CREATE' && (
            <ul className="mt-1 space-y-0.5">
              {Object.entries(e.changes).map(([key, diff]) => {
                const def = defByKey.get(key);
                const label = def ? fieldLabel(def, language) : key;
                const fmt = (v: unknown) =>
                  v === null || v === undefined || v === ''
                    ? '—'
                    : def?.input_type === 'dropdown'
                      ? optionLabelL(def, String(v), language)
                      : String(v);
                return (
                  <li key={key} className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                    {label}: <span style={{ color: 'var(--ink-3)' }}>{fmt(diff.old)}</span>
                    {' → '}
                    <span>{fmt(diff.new)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {e.source === 'migration' && (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>{t('Imported from legacy Excel data', 'Nhập từ dữ liệu Excel cũ')}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------

function ActionDialogs({
  dialog, eq, locations, liveDescendants, busy, onCancel, onRun,
}: {
  dialog: null | 'move' | 'location' | 'detach' | 'archive' | 'restore';
  eq: Equipment;
  locations: LocationRef[];
  liveDescendants: number;
  busy: boolean;
  onCancel: () => void;
  onRun: <T>(fn: () => Promise<T>, msg: string) => Promise<void>;
}) {
  const { t } = usePreferences();
  const [locationId, setLocationId] = useState('');
  const [parentQuery, setParentQuery] = useState('');
  const [parentResults, setParentResults] = useState<Equipment[]>([]);
  const [parentId, setParentId] = useState('');

  useEffect(() => {
    if (dialog !== 'move') return;
    const timer = setTimeout(() => {
      // Backend loại sẵn chính nó + toàn bộ subtree + thiết bị đã archive,
      // nên UI không bao giờ mời chọn giá trị chắc chắn bị từ chối (mục 19).
      void api
        .get<Equipment[]>(
          `/api/equipment?parentPickerFor=${eq.id}&pageSize=20&search=${encodeURIComponent(parentQuery)}`,
        )
        .then((r) => setParentResults(r.data));
    }, 250);
    return () => clearTimeout(timer);
  }, [dialog, parentQuery, eq.id]);

  const affected = liveDescendants > 0
    ? t(
        `This action will change the location of ${liveDescendants} child equipment.`,
        `Thao tác này sẽ đổi vị trí của ${liveDescendants} thiết bị con.`,
      )
    : null;

  return (
    <>
      <Modal open={dialog === 'location'} title={t('Change location', 'Chuyển vị trí')} onClose={onCancel}>
        <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
          {t('Choose a new location for', 'Chọn vị trí mới cho')} <span className="ident">{eq.serial_number}</span>.
        </p>
        <select
          value={locationId} onChange={(e) => setLocationId(e.target.value)}
          className="mt-3 w-full border px-2 py-1.5 text-[13px]"
          style={{ borderColor: 'var(--rule)' }}
        >
          <option value="">{t('— select a location —', '— chọn vị trí —')}</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
        </select>
        {affected && <p className="mt-3 text-[12px]" style={{ color: 'var(--warn)' }}>{affected}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel}>{t('Cancel', 'Huỷ')}</Button>
          <Button
            variant="primary" disabled={!locationId || busy}
            onClick={() => void onRun(
              () => api.post(`/api/equipment/${eq.id}/change-location`,
                { version: eq.version, new_location_id: locationId }),
              t('Location changed.', 'Đã chuyển vị trí.'),
            )}
          >
            {t('Change location', 'Chuyển vị trí')}
          </Button>
        </div>
      </Modal>

      <Modal open={dialog === 'move'} title={t('Change parent', 'Đổi thiết bị cha')} onClose={onCancel}>
        <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
          {t('Search by serial number. This equipment’s own descendants are not shown here.', 'Tìm theo số sê-ri. Thiết bị con của thiết bị này không hiển thị ở đây.')}
        </p>
        <input
          autoFocus value={parentQuery} onChange={(e) => setParentQuery(e.target.value)}
          placeholder={t('Enter serial number', 'Nhập số sê-ri')}
          className="ident mt-3 w-full border px-2 py-1.5 text-[13px]"
          style={{ borderColor: 'var(--rule)' }}
        />
        <ul className="mt-2 max-h-52 overflow-y-auto border" style={{ borderColor: 'var(--rule-soft)' }}>
          {parentResults.length === 0 && (
            <li className="px-2.5 py-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
              {t('No matching equipment.', 'Không có thiết bị nào phù hợp.')}
            </li>
          )}
          {parentResults.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setParentId(r.id)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px]"
                style={{ background: parentId === r.id ? 'var(--machine-tint)' : 'transparent' }}
              >
                <span className="ident font-medium">{r.serial_number}</span>
                <span style={{ color: 'var(--ink-3)' }}>{r.part_number ?? ''}</span>
                <span className="ml-auto" style={{ color: 'var(--ink-3)' }}>
                  {r.current_location?.code ?? ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px]" style={{ color: 'var(--warn)' }}>
          {liveDescendants > 0
            ? t(
                `This equipment carries ${liveDescendants} child equipment and all of them will move to the new parent’s location.`,
                `Thiết bị này mang theo ${liveDescendants} thiết bị con và tất cả sẽ chuyển sang vị trí của thiết bị cha mới.`,
              )
            : t('The location will follow the new parent.', 'Vị trí sẽ đổi theo thiết bị cha mới.')}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel}>{t('Cancel', 'Huỷ')}</Button>
          <Button
            variant="primary" disabled={!parentId || busy}
            onClick={() => void onRun(
              () => api.post(`/api/equipment/${eq.id}/move`,
                { version: eq.version, new_parent_id: parentId }),
              t('Parent changed.', 'Đã đổi thiết bị cha.'),
            )}
          >
            {t('Change parent', 'Đổi thiết bị cha')}
          </Button>
        </div>
      </Modal>

      <Modal open={dialog === 'detach'} title={t('Detach from parent', 'Tách khỏi thiết bị cha')} onClose={onCancel}>
        <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
          <span className="ident">{eq.serial_number}</span> {t(
            'will become a standalone equipment and keep its current location. Its own children are not affected.',
            'sẽ thành thiết bị độc lập và giữ nguyên vị trí hiện tại. Thiết bị con của nó không bị ảnh hưởng.',
          )}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel}>{t('Cancel', 'Huỷ')}</Button>
          <Button
            variant="primary" disabled={busy}
            onClick={() => void onRun(
              () => api.post(`/api/equipment/${eq.id}/detach`, { version: eq.version }),
              t('Detached from parent.', 'Đã tách khỏi thiết bị cha.'),
            )}
          >
            {t('Detach', 'Tách ra')}
          </Button>
        </div>
      </Modal>

      <Modal open={dialog === 'archive'} title={t('Archive equipment', 'Lưu trữ thiết bị')} onClose={onCancel}>
        <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
          {t(
            'The equipment will be hidden from the default list. Its data and history are kept. Only an administrator can restore it.',
            'Thiết bị sẽ ẩn khỏi danh sách mặc định. Dữ liệu và lịch sử vẫn giữ nguyên. Chỉ quản trị viên khôi phục lại được.',
          )}
        </p>
        {liveDescendants > 0 && (
          <p className="mt-3 text-[12px]" style={{ color: 'var(--warn)' }}>
            {t(
              `There are still ${liveDescendants} child equipment not archived. Archive or detach them first.`,
              `Còn ${liveDescendants} thiết bị con chưa được lưu trữ. Hãy lưu trữ hoặc tách chúng ra trước.`,
            )}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel}>{t('Cancel', 'Huỷ')}</Button>
          <Button
            variant="danger" disabled={busy || liveDescendants > 0}
            onClick={() => void onRun(
              () => api.post(`/api/equipment/${eq.id}/archive`, { version: eq.version }),
              t('Equipment archived.', 'Đã lưu trữ thiết bị.'),
            )}
          >
            {t('Archive', 'Lưu trữ')}
          </Button>
        </div>
      </Modal>

      <Modal open={dialog === 'restore'} title={t('Restore equipment', 'Khôi phục thiết bị')} onClose={onCancel}>
        <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
          {t(
            'The equipment will reappear in the list. If its parent is archived, restore the parent first.',
            'Thiết bị sẽ hiện lại trong danh sách. Nếu thiết bị cha của nó đang được lưu trữ thì phải khôi phục thiết bị cha trước.',
          )}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onCancel}>{t('Cancel', 'Huỷ')}</Button>
          <Button
            variant="primary" disabled={busy}
            onClick={() => void onRun(
              () => api.post(`/api/equipment/${eq.id}/restore`, { version: eq.version }),
              t('Equipment restored.', 'Đã khôi phục thiết bị.'),
            )}
          >
            {t('Restore', 'Khôi phục')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
