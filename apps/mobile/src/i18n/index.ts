import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import hi from './locales/hi.json';
import te from './locales/te.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';
import ta from './locales/ta.json';
import or from './locales/or.json';
import mr from './locales/mr.json';
import bn from './locales/bn.json';
import gu from './locales/gu.json';
import pa from './locales/pa.json';

const LANGUAGE_KEY = 'app_language';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

export async function loadSavedLanguage() {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
      await i18n.changeLanguage(saved);
    }
  } catch {}
}

export async function setLanguage(code: LanguageCode) {
  await i18n.changeLanguage(code);
  await AsyncStorage.setItem(LANGUAGE_KEY, code);
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, te: { translation: te }, kn: { translation: kn }, ml: { translation: ml }, ta: { translation: ta }, or: { translation: or }, mr: { translation: mr }, bn: { translation: bn }, gu: { translation: gu }, pa: { translation: pa } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
