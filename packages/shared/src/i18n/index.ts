import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ar, en } from './locales';
import { featureAr, featureEn } from './features';

const STORAGE_KEY = 'drivemarket-locale';

export type AppLocale = 'en' | 'ar';

function detectLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'ar' || stored === 'en') return stored;
  return 'en';
}

export function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale === 'ar' ? 'ar' : 'en';
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

export function setAppLocale(locale: AppLocale) {
  localStorage.setItem(STORAGE_KEY, locale);
  void i18n.changeLanguage(locale);
  applyDocumentLocale(locale);
}

export function getAppLocale(): AppLocale {
  return (i18n.language === 'ar' ? 'ar' : 'en') as AppLocale;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...en, ...featureEn } },
    ar: { translation: { ...ar, ...featureAr } },
  },
  lng: detectLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

applyDocumentLocale(detectLocale());

export default i18n;
