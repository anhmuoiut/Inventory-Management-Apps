'use client';

/**
 * Browser client — CHỈ dùng cho login/logout/đổi mật khẩu (mục 3c).
 * Không bao giờ dùng để đọc/ghi bảng nghiệp vụ: RLS deny-all sẽ chặn, và mọi
 * dữ liệu phải đi qua API Routes để được check quyền.
 */
import { createBrowserClient } from '@supabase/ssr';

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}
