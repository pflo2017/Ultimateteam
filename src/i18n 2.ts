import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ro from './locales/ro.json';

const resources = {
  en: { translation: en },
  ro: { translation: ro },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default to English for now
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n; 