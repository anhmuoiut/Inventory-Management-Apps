'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Globe2, Moon, Sun } from 'lucide-react';

type Language = 'en' | 'vi';
type Theme = 'light' | 'dark';
type Preferences = {
  language: Language;
  theme: Theme;
  setLanguage: (value: Language) => void;
  setTheme: (value: Theme) => void;
  t: (en: string, vi: string) => string;
};
const Context = createContext<Preferences | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<Language>('en');
  const [theme, updateTheme] = useState<Theme>('light');

  useEffect(() => {
    updateLanguage(document.documentElement.lang === 'vi' ? 'vi' : 'en');
    updateTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  function setLanguage(value: Language) {
    updateLanguage(value);
    document.documentElement.lang = value;
    try { localStorage.setItem('equipment-language', value); } catch {}
  }
  function setTheme(value: Theme) {
    updateTheme(value);
    document.documentElement.dataset.theme = value;
    try { localStorage.setItem('equipment-theme', value); } catch {}
  }

  return <Context.Provider value={{ language, theme, setLanguage, setTheme, t: (en, vi) => language === 'vi' ? vi : en }}>{children}</Context.Provider>;
}

export function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error('PreferencesProvider is required');
  return value;
}

export function PreferenceControls() {
  const { language, theme, setLanguage, setTheme, t } = usePreferences();
  return (
    <div className="preference-controls">
      <div className="language-switch" role="group" aria-label={t('Language', 'Ngôn ngữ')}>
        <Globe2 size={15} aria-hidden="true" />
        <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
        <button type="button" lang="vi" aria-label="Tiếng Việt" aria-pressed={language === 'vi'} onClick={() => setLanguage('vi')}>VIE</button>
      </div>
      <button type="button" className="theme-switch" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        aria-label={theme === 'light' ? t('Switch to dark mode', 'Chuyển sang chế độ tối') : t('Switch to light mode', 'Chuyển sang chế độ sáng')}>
        {theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
        <span>{theme === 'light' ? t('Dark', 'Tối') : t('Light', 'Sáng')}</span>
      </button>
    </div>
  );
}
