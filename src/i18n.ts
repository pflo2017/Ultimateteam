import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import ro from './locales/ro.json';

const resources = {
  en: { translation: en },
  ro: { translation: ro },
};

// Function to get the stored language preference
const getStoredLanguage = async () => {
  try {
    const storedLanguage = await AsyncStorage.getItem('userLanguage');
    return storedLanguage;
  } catch (error) {
    console.log('Error getting stored language:', error);
    return null;
  }
};

// Function to initialize i18n
const initializeI18n = async () => {
  const storedLanguage = await getStoredLanguage();
  
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: storedLanguage || (getLocales()[0]?.languageCode === 'ro' ? 'ro' : 'en'),
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      react: {
        useSuspense: false,
      },
    });
};

// Initialize i18n
initializeI18n();

// Function to change language
export const changeLanguage = async (language: 'en' | 'ro') => {
  try {
    await AsyncStorage.setItem('userLanguage', language);
    await i18n.changeLanguage(language);
  } catch (error) {
    console.log('Error changing language:', error);
  }
};

// Function to get current language
export const getCurrentLanguage = () => {
  return i18n.language;
};

export default i18n; 