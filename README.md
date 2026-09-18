# Equipment Management

Web app nội bộ quản lý Machine / Base / Fixture / Equipment, thay cách ghi chép bằng Excel.

Triển khai theo **Spec v0.9**. Mọi quyết định kiến trúc trong code đều có chú thích trỏ về số mục trong spec — khi sửa code, sửa spec trước.

**Quy mô mục tiêu (mục 1a):** pilot 10–20 người, 1.000–2.000 thiết bị, Excel vẫn chạy song song.

---

## Tình trạng hiện tại

| Phase | Nội dung | Trạng thái |
|---|---|---|
| 0 | Scaffold, config, portability (`output: standalone`) | ✅ Xong |
| 1 | Toàn bộ bảng, index, trigger, RLS lockdown, RPC + grants, seed | ✅ Xong, **59/59 test pass** |
| 2 | `withAuth`, session, User Management API | ✅ API xong |
| 3 | Field Config, Preset, Location Config API | ✅ API xong |
| 4 | Form engine sinh từ `field_definitions` | ✅ Xong |
| 5 | Dashboard: search/filter/sort/pagination server-side | ✅ Xong |
| 6 | Chuỗi phân cấp, drawer chi tiết, thao tác cấu trúc | ✅ Xong |
| 7 | (RPC — đã xong ở Phase 1) | ✅ Xong |
| 8 | Lịch sử thay đổi | ✅ Xong |
| 8b | **Giao diện Quản trị** (users, preset, location, field, lỗi) | ⬜ API xong, UI chưa |
| 9 | Migration script từ Excel + reconcile.sql | ⬜ Chưa làm |
| 10 | Backup workflow + keepalive | ✅ Xong |

Backend, database và giao diện vận hành chính đã hoàn chỉnh: `tsc --noEmit` 0 lỗi, `next build` sạch, 27 route + 2 trang.
Còn lại: giao diện Quản trị (API đã sẵn, gọi bằng curl được) và script nhập liệu từ Excel.

---

## Chạy lần đầu

```bash
npm install
cp .env.example .env.local     # điền giá trị từ Supabase → Settings → API
```

### 1. Database

Chạy lần lượt trên Supabase SQL Editor (**dev project trước**, mục 47e):

```
database/migrations/001_tables.sql
database/migrations/002_indexes.sql
database/migrations/003_rls_lockdown.sql
database/migrations/004_functions.sql
database/migrations/005_usernames.sql
database/seed/001_seed.sql        ← SỬA TRƯỚC KHI CHẠY
```

`001_seed.sql` chứa danh sách location và dropdown option **mẫu**. Đây là 2 trong 6 thứ mục 54 nói phải chốt trước khi code — thay bằng dữ liệu thật của nhà máy.

### 2. Admin đầu tiên

```bash
npx tsx scripts/seed-first-admin.ts admin@congty.com "Nguyen Van A"
```

Bắt buộc. `POST /api/admin/users` yêu cầu role admin, mà chưa có admin nào tồn tại — vòng lặp chicken-and-egg (mục 55.2).

### 3. Chạy

```bash
npm run dev
curl localhost:3000/api/health
```

---

## Test

```bash
supabase start                 # Postgres local qua Docker
bash database/test/run.sh
```

Chạy trên **Supabase local**, không phải project dev: free tier giới hạn 2 active project/org, đã dùng hết cho dev + production (mục 47c).

59 assertion phủ: cascade location, cycle, optimistic concurrency, whitelist PUT, change-location, detach, swap subtree, archive/restore, archived descendant không bị cascade, depth limit, natural sort, ràng buộc DB.

---

## Bốn thứ không được phá

Đây là những quyết định mà vi phạm sẽ không báo lỗi ngay nhưng sẽ hỏng về sau.

### 1. Không route nào export handler trần

```ts
export const POST = withAuth(handler, { role: ['admin','user'], action: 'move' });
```

`service_role` bypass RLS hoàn toàn, nên RLS **không** bảo vệ được rủi ro "quên check quyền trong một route". `withAuth` là lớp bảo vệ thật (mục 3c). Kiểm tra:

```bash
grep -rLn "withAuth" app/api --include=route.ts     # phải rỗng
```

### 2. `service_role` key chỉ đọc ở đúng một file

`lib/supabase/admin.ts`. Ba lớp chặn, đều đã được kiểm chứng là hoạt động:
`import 'server-only'` (build fail nếu lọt vào client bundle) → ESLint `no-restricted-imports` → không có tiền tố `NEXT_PUBLIC_`.

### 3. Mọi RPC phải có `revoke` + `grant`

PostgreSQL mặc định `GRANT EXECUTE` cho `PUBLIC`. Không có khối grant ở cuối `004_functions.sql`, bất kỳ ai có anon key (nằm công khai trong bundle frontend) đều gọi được `archive_equipment` và bypass toàn bộ tầng permission.

Đã kiểm chứng: anon và authenticated bị chặn 10/10 trên cả bảng lẫn function.

### 4. Không dùng API riêng của Vercel

Nguyên tắc portability (mục 3a). Không `Vercel KV / Blob / Postgres / Cron`, không Edge Runtime cho business logic. Cron đặt ở GitHub Actions.

Tuân thủ đúng thì rời Vercel = viết một Dockerfile + đổi env ≈ 1 ngày công. Vi phạm thì con số đó thành vài tuần. `output: 'standalone'` đã bật sẵn.

---

## Ba điều dễ hiểu nhầm trong code

**Descendants không bump version khi Move/Change Location.** Có chủ đích (mục 23). Location của child đã là read-only nên không có kịch bản save đè; bump chỉ tạo `OPTIMISTIC_CONFLICT` giả khiến user mất nội dung đang gõ. Vẫn cascade location và vẫn ghi `MOVE_CASCADE` để audit.

**PUT không nhận `current_location_id` và `parent_id`.** Đổi location của root là thao tác cascade multi-row, không phải Edit thường — nó có endpoint riêng `/change-location` (mục 21a). Parent chỉ đổi qua move/detach/swap. Chặn ở 3 tầng: validator, whitelist trong RPC, và không có trong `field_definitions`.

**Swap không có RPC riêng.** Swap = 2 lần `internal_move` trong cùng transaction (mục 24). Bug fix trong logic cascade chỉ phải sửa một chỗ.

---

## Vận hành

| Việc | Ở đâu |
|---|---|
| Backup | `.github/workflows/backup.yml` — cần secret `SUPABASE_DB_URL` |
| Chống Supabase pause | `.github/workflows/keepalive.yml` — cần variable `APP_URL` |
| Tra lỗi user báo lại | `GET /api/admin/errors`, tìm theo `request_id` |
| Lấy dữ liệu ra (rollback) | `npx tsx scripts/export-to-csv.ts` |
| Quy trình sự cố | `RUNBOOK.md` |

Log Vercel Hobby chỉ giữ ~1 giờ, nên `error_log` trong DB mới là nơi điều tra lỗi cũ (mục 47d).

**Backup chưa restore thử là backup chưa tồn tại.** Phải test restore ít nhất 1 lần trước khi cho user vào (mục 55.8).

---

## Giao diện

| Màn hình | Đường dẫn |
|---|---|
| Đăng nhập | `/login` |
| Danh sách thiết bị + drawer chi tiết | `/` |

Hướng thiết kế lấy từ vernacular xưởng máy: nền xám ngả lục, màu chính là sơn men máy công cụ `#0E5245`, chữ IBM Plex Sans + Plex Mono. Mono **chỉ** dùng cho định danh (serial, part, asset) với tabular figures — trên sàn xưởng `1089` và `l089` là hai thứ khác nhau.

Bảng dữ liệu dày, không card bo góc, không shadow. Điểm nhấn duy nhất là chuỗi phân cấp dạng dây xích trong tab Phân cấp.

Phím tắt: `/` nhảy vào ô tìm kiếm.

---

## Việc còn lại trước khi mở pilot

1. Giao diện Quản trị — API đã xong, chỉ thiếu màn hình
2. Migration script từ Excel + `reconcile.sql` (mục 46, 55.4)
3. Điền `help_text` cho **mọi** field — cột đã có trong schema, đừng để trống (mục 55.5)
4. Chạy hết checklist mục 55.8

## UI and username login (2026-09-18)

Login and the equipment list support EN/VIE and persistent light/dark theme.
The navy/blue design follows the supplied Jabil reference with softly rounded borders.
Username is stored independently in user_profiles after migration 005 (see below).
The existing admin signs in as academy.mantranqp2507 with the unchanged password.
Email resolution stays on the server. Inactive accounts are denied.
The bounded per-instance attempt guard supplements Supabase Auth limits;
it is not a deployment-wide shared rate limiter.

## Independent usernames (migration 005)

Before starting this version, open the Supabase project used by your .env.local,
then run database/migrations/005_usernames.sql in SQL Editor. Existing projects
only need this new migration; do not rerun the initial tables or sample seed.
The migration is transactional and may be safely rerun. It backfills lowercase
email prefixes as usernames, preserves email/password/permissions, and rejects
invalid or duplicate usernames instead of silently renaming accounts.

After success, verify in SQL Editor:

```sql
select full_name, username, email from public.user_profiles order by full_name;
```

The existing Man Tran account keeps username academy.mantranqp2507.
Login and the header now use the stored username. Supabase Auth continues to use
email internally. Usernames allow 1-64 lowercase letters, numbers, dots,
underscores, plus signs and hyphens, beginning with a letter or number. Login and
account creation normalize entered names to lowercase.

POST /api/admin/users now requires username separately from email, for example:

```json
{"full_name":"Example User","username":"example.user","email":"contact@example.com","role":"viewer","preset":"read_only"}
```

For a new installation, seed-first-admin.ts accepts an optional final username:

```bash
npx tsx scripts/seed-first-admin.ts admin@company.com "Admin Name" admin.name
```

If omitted, the script uses the email prefix. Do not rerun it for an existing admin.
After applying the migration and starting localhost:3000, run
`node scripts/test-username-login.mjs` with Node 24 and the configured .env.local.
It creates a temporary viewer whose username differs from the email prefix,
verifies login, profile and header, then removes that temporary account.
