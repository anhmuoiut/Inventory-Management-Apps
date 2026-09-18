'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppSidebar, TopBar } from '@/components/TopBar';
import { usePreferences } from '@/components/Preferences';

const STORAGE_KEY = 'equipment-sidebar-open';
const MOBILE_QUERY = '(max-width: 800px)';

export function AppShell({ username, children }: { username: string; children: React.ReactNode }) {
  const { t } = usePreferences();
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const sidebarOpen = isMobile ? mobileOpen : desktopOpen;

  useEffect(() => {
    try { setDesktopOpen(localStorage.getItem(STORAGE_KEY) !== 'false'); } catch {}
    const media = window.matchMedia(MOBILE_QUERY);
    function syncViewport() {
      setIsMobile(media.matches);
      setMobileOpen(false);
      if (panelRef.current?.contains(document.activeElement)) toggleRef.current?.focus();
    }
    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    toggleRef.current?.focus();
  }, []);

  function toggleSidebar() {
    if (isMobile) {
      if (mobileOpen) closeMobile();
      else setMobileOpen(true);
    } else {
      const next = !desktopOpen;
      setDesktopOpen(next);
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
    }
  }

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const content = contentRef.current;
    const actions = shellRef.current?.querySelector<HTMLElement>('.topbar-actions');
    const previousOverflow = document.body.style.overflow;
    if (content) content.inert = true;
    if (actions) actions.inert = true;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobile();
      } else if (event.key === 'Tab') {
        // Keep keyboard navigation in the open menu and its header toggle.
        const items = [
          toggleRef.current,
          ...Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex="0"]',
          ) ?? []),
        ].filter((item): item is HTMLElement => item !== null);
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      if (content) content.inert = false;
      if (actions) actions.inert = false;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobile, mobileOpen, closeMobile]);

  return (
    <div ref={shellRef} className="app-shell" data-mobile-open={mobileOpen}>
      <TopBar username={username} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} toggleRef={toggleRef} />
      <div className="app-body">
        {isMobile && mobileOpen && <button
          type="button" className="sidebar-backdrop" tabIndex={-1}
          aria-label={t('Close menu', 'Đóng menu')} onClick={closeMobile}
        />}
        <div id="app-sidebar-panel" ref={panelRef} className="sidebar-region" hidden={!sidebarOpen}>
          <AppSidebar onNavigate={() => { if (isMobile) closeMobile(); }} />
        </div>
        <main ref={contentRef} className="app-content">{children}</main>
      </div>
    </div>
  );
}
