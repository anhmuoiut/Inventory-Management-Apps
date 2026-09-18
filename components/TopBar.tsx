'use client';

import type { RefObject } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LogOut, LayoutList, Menu, UserRound } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { PreferenceControls, usePreferences } from '@/components/Preferences';

type TopBarProps = {
  username: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  toggleRef: RefObject<HTMLButtonElement>;
};

export function TopBar({ username, sidebarOpen, onToggleSidebar, toggleRef }: TopBarProps) {
  const router = useRouter();
  const { t } = usePreferences();
  async function signOut() {
    const { error } = await supabaseBrowser().auth.signOut();
    if (error) return;
    router.push('/login');
    router.refresh();
  }
  const toggleLabel = sidebarOpen ? t('Hide menu', 'Ẩn menu') : t('Open menu', 'Mở menu');
  return (
    <header className="app-topbar">
      <div className="app-brand">
        <div className="app-brand-row">
          <span className="jabil-wordmark">JABIL</span>
          <button ref={toggleRef} type="button" className="sidebar-toggle"
            onClick={onToggleSidebar} aria-expanded={sidebarOpen} aria-controls="app-sidebar-panel"
            aria-label={toggleLabel} title={toggleLabel}>
            {sidebarOpen ? <ChevronLeft size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
        <span className="app-brand-title">{t('Equipment Management', 'Quản lý thiết bị')}</span>
      </div>
      <div className="topbar-actions"><PreferenceControls />
        <span className="user-chip"><UserRound size={15} /><span>{username}</span></span>
        <button className="logout-button" onClick={() => void signOut()} aria-label={t('Sign out', 'Đăng xuất')} title={t('Sign out', 'Đăng xuất')}><LogOut size={18} /></button>
      </div>
    </header>
  );
}

export function AppSidebar({ onNavigate }: { onNavigate: () => void }) {
  const { t } = usePreferences();
  return <aside className="app-sidebar" aria-label={t('Sidebar menu', 'Menu bên trái')}>
    <p className="sidebar-caption">{t('WORKSPACE', 'KHÔNG GIAN LÀM VIỆC')}</p>
    <nav aria-label={t('Main navigation', 'Điều hướng chính')}>
      <Link href="/" className="sidebar-link" aria-current="page" onClick={onNavigate}><LayoutList size={18} /><span>{t('Equipment masterlist', 'Danh sách thiết bị')}</span></Link>
    </nav>
    <div className="sidebar-note"><span className="sidebar-status" />{t('Equipment Control System', 'Hệ thống quản lý thiết bị')}</div>
  </aside>;
}
