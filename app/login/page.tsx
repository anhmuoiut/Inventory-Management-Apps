'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Box, Eye, EyeOff, LockKeyhole, Network, ShieldCheck, UserRound } from 'lucide-react';
import { PreferenceControls, usePreferences } from '@/components/Preferences';
import { safeLoginDestination } from '@/lib/auth/username';

function LoginForm() {
  const router = useRouter();
  const destination = safeLoginDestination(useSearchParams().get('next'));
  const { t } = usePreferences();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<'credentials' | 'network' | 'limit' | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? 'limit' : response.status >= 500 ? 'network' : 'credentials');
        return;
      }
      router.replace(destination);
      router.refresh();
    } catch { setError('network'); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="login-form">
      <div className="login-icon"><LockKeyhole size={24} aria-hidden="true" /></div>
      <p className="eyebrow">{t('YOUR EQUIPMENT WORKSPACE', 'KHÔNG GIAN QUẢN LÝ THIẾT BỊ')}</p>
      <h1>{t('Welcome back', 'Chào mừng trở lại')}</h1>
      <p className="login-description">{t('Sign in to manage your equipment and keep operations moving.', 'Đăng nhập để quản lý thiết bị và theo dõi hoạt động của nhà máy.')}</p>

      <label htmlFor="username">{t('Username', 'Tên đăng nhập')}</label>
      <div className="login-input">
        <UserRound size={18} aria-hidden="true" />
        <input id="username" name="username" type="text" required autoComplete="username" autoCapitalize="none"
          spellCheck={false} maxLength={64} value={username} onChange={e => setUsername(e.target.value)}
          placeholder={t('Enter your username', 'Nhập tên đăng nhập')} aria-describedby={error ? 'login-error' : undefined} />
      </div>
      <label htmlFor="password">{t('Password', 'Mật khẩu')}</label>
      <div className="login-input">
        <LockKeyhole size={18} aria-hidden="true" />
        <input id="password" name="password" type={visible ? 'text' : 'password'} required autoComplete="current-password"
          maxLength={256} value={password} onChange={e => setPassword(e.target.value)}
          placeholder={t('Enter your password', 'Nhập mật khẩu')} aria-describedby={error ? 'login-error' : undefined} />
        <button type="button" className="password-toggle" aria-label={visible ? t('Hide password', 'Ẩn mật khẩu') : t('Show password', 'Hiện mật khẩu')}
          aria-pressed={visible} onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p id="login-error" className="login-error" role="alert">{
        error === 'credentials' ? t('Username or password is incorrect.', 'Tên đăng nhập hoặc mật khẩu không đúng.') :
        error === 'limit' ? t('Too many attempts. Please try again shortly.', 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.') :
        t('Unable to connect. Please try again.', 'Không thể kết nối. Vui lòng thử lại.')
      }</p>}
      <button className="sign-in-button" type="submit" disabled={busy}>
        {busy ? t('Signing in…', 'Đang đăng nhập…') : t('Sign in', 'Đăng nhập')}
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="login-help">{t('Need access or a password reset?', 'Cần tài khoản hoặc đặt lại mật khẩu?')}<br />
        <span>{t('Contact your system administrator.', 'Liên hệ quản trị viên hệ thống.')}</span>
      </p>
      <div className="login-security"><ShieldCheck size={15} aria-hidden="true" />{t('Authorized personnel only', 'Chỉ dành cho nhân viên được cấp quyền')}</div>
    </form>
  );
}

export default function LoginPage() {
  const { t } = usePreferences();
  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-lockup"><span className="jabil-wordmark">JABIL</span><span className="brand-divider" /><span>{t('Equipment Management', 'Quản lý thiết bị')}</span></div>
        <div className="brand-content">
          <p className="brand-kicker">{t('CONNECTED OPERATIONS', 'VẬN HÀNH KẾT NỐI')}</p>
          <h2>{t('Every asset.', 'Mỗi thiết bị.')}<br />{t('One clear view.', 'Một góc nhìn toàn diện.')}</h2>
          <p>{t('Keep your machines, fixtures and equipment organized. From the production floor to the bigger picture.', 'Quản lý máy móc, đồ gá và thiết bị một cách rõ ràng. Từ từng vị trí sản xuất đến toàn bộ nhà máy.')}</p>
          <div className="equipment-illustration" aria-hidden="true">
            <div className="diagram-node diagram-root"><Box size={28} /><div><strong>{t('MACHINE', 'MÁY')}</strong><span>{t('Production floor', 'Khu vực sản xuất')}</span></div><i /></div>
            <div className="diagram-connector" />
            <div className="diagram-children">
              <div className="diagram-node"><Network size={22} /><div><strong>{t('BASE', 'ĐẾ')}</strong><span>{t('Connected', 'Đã liên kết')}</span></div></div>
              <div className="diagram-node"><Box size={22} /><div><strong>{t('FIXTURE', 'ĐỒ GÁ')}</strong><span>{t('Connected', 'Đã liên kết')}</span></div></div>
            </div>
          </div>
          <div className="brand-points"><span><ShieldCheck size={16} />{t('Controlled access', 'Phân quyền truy cập')}</span><span><Network size={16} />{t('Connected equipment', 'Liên kết thiết bị')}</span></div>
        </div>
        <p className="brand-footer">{t('Built for the people who keep production moving.', 'Dành cho những người giữ nhịp sản xuất.')}</p>
      </section>
      <section className="login-main">
        <div className="login-toolbar"><PreferenceControls /></div>
        <div className="login-form-area"><Suspense fallback={<p>{t('Loading…', 'Đang tải…')}</p>}><LoginForm /></Suspense></div>
        <footer className="login-footer">JABIL <span>·</span> {t('Equipment Control System', 'Hệ thống quản lý thiết bị')}</footer>
      </section>
    </main>
  );
}
