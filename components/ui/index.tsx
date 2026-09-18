'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function Button({
  children, variant = 'quiet', size = 'md', ...rest
}: {
  children: ReactNode;
  variant?: 'primary' | 'quiet' | 'danger';
  size?: 'sm' | 'md';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]';
  const style =
    variant === 'primary'
      ? { background: 'var(--machine)', color: '#fff', borderColor: 'var(--machine)' }
      : variant === 'danger'
        ? { background: 'transparent', color: 'var(--alert)', borderColor: 'var(--alert)' }
        : { background: 'var(--panel)', color: 'var(--ink)', borderColor: 'var(--rule)' };

  return (
    <button
      {...rest}
      style={{ ...style, ...rest.style }}
      className={`border font-medium disabled:opacity-40 ${pad} ${rest.className ?? ''}`}
    >
      {children}
    </button>
  );
}

/** Trạng thái không bao giờ chỉ bằng màu — sàn xưởng, ánh sáng mạnh, in đen trắng. */
export function Tag({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'warn' | 'ok' }) {
  const c =
    tone === 'warn'
      ? { background: 'var(--warn-tint)', color: 'var(--warn)', borderColor: 'var(--warn)' }
      : tone === 'ok'
        ? { background: 'var(--machine-tint)', color: 'var(--ok)', borderColor: 'var(--ok)' }
        : { background: 'transparent', color: 'var(--ink-2)', borderColor: 'var(--rule)' };
  return (
    <span className="border px-1.5 py-[1px] text-[11px] font-medium" style={c}>
      {text}
    </span>
  );
}

export function Notice({
  tone, children, onDismiss, dismissLabel = 'Đóng',
}: { tone: 'warn' | 'alert' | 'info'; children: ReactNode; onDismiss?: () => void; dismissLabel?: string }) {
  const c =
    tone === 'alert'
      ? { borderColor: 'var(--alert)', background: 'var(--alert-tint)', color: 'var(--alert)' }
      : tone === 'warn'
        ? { borderColor: 'var(--warn)', background: 'var(--warn-tint)', color: 'var(--warn)' }
        : { borderColor: 'var(--machine)', background: 'var(--machine-tint)', color: 'var(--ok)' };
  return (
    <div className="flex items-start gap-3 border-l-2 py-2 pl-3 pr-2 text-[13px]" style={c}>
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-[11px] underline" style={{ color: 'inherit' }}>
          {dismissLabel}
        </button>
      )}
    </div>
  );
}

export function Modal({
  open, title, onClose, children,
}: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && ref.current) {
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        )).filter((element) => element.getClientRects().length > 0);
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         data-action-dialog="true"
         style={{ background: 'rgba(18,25,26,0.35)' }}
         onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div
        ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border p-5 outline-none"
        style={{ background: 'var(--panel)', borderColor: 'var(--rule)' }}
      >
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <p className="py-8 text-center text-[13px]" style={{ color: 'var(--ink-3)' }}>
      {label}
    </p>
  );
}
