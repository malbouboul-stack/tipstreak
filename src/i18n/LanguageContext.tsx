import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { en, es, fr, pt, TranslationKey } from './translations';
import { getItem, setItem } from '../lib/storage';

export type Language = 'fr' | 'en' | 'es' | 'pt';
type Params = Record<string, string | number>;

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { fr, en, es, pt };
const LANGUAGES = Object.keys(DICTIONARIES) as Language[];
// Pour les dates : le portugais suit l'usage brésilien
const LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', pt: 'pt-BR' };

const isLanguage = (code: string | null | undefined): code is Language => LANGUAGES.includes(code as Language);
const STORAGE_KEY = 'tipstreak.language';

// expo-localization est un module natif : une development build antérieure à son installation
// ne le contient pas. On le charge prudemment pour ne pas planter.
function deviceLanguage(): Language {
  let code: string | null | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    code = require('expo-localization').getLocales()[0]?.languageCode;
  } catch {
    code = Intl.DateTimeFormat().resolvedOptions().locale;
  }
  // "pt-BR" → "pt" ; une langue non traduite retombe sur l'anglais
  const base = code?.toLowerCase().slice(0, 2);
  return isLanguage(base) ? base : 'en';
}

function initialLanguage(): Language {
  const saved = getItem(STORAGE_KEY);
  return isLanguage(saved) ? saved : deviceLanguage();
}

export function translate(language: Language, key: TranslationKey, params?: Params): string {
  const text = DICTIONARIES[language][key] ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match)) : text;
}

type LanguageContextType = {
  language: Language;
  locale: string; // pour les dates : 'fr-FR', 'en-US', 'es-ES' ou 'pt-BR'
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: Params) => string;
  translateError: (message: string | null | undefined, fallback?: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

// Messages d'erreur à motif variable renvoyés par les Edge Functions (en français)
const ERROR_PATTERNS: [RegExp, TranslationKey][] = [
  [/a échoué on-chain/, 'error.txFailed'],
  [/ne verse rien au bon destinataire/, 'error.wrongRecipient'],
  [/Impossible d'identifier le signataire/, 'error.signerUnknown'],
  [/ (manquant|invalide)$|entre \d+ et \d+ caractères/, 'error.invalidField'],
];

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<LanguageContextType>(() => {
    const t = (key: TranslationKey, params?: Params) => translate(language, key, params);

    // Les erreurs arrivent soit sous forme de clé (app), soit en texte français (serveur) :
    // on retrouve la clé correspondante pour les afficher dans la langue choisie.
    const translateError = (message: string | null | undefined, fallback: TranslationKey = 'tip.unknownError') => {
      if (!message) return t(fallback);
      if (Object.prototype.hasOwnProperty.call(fr, message)) return t(message as TranslationKey);
      const exact = (Object.keys(fr) as TranslationKey[]).find((key) => fr[key] === message);
      if (exact) return t(exact);
      const pattern = ERROR_PATTERNS.find(([regex]) => regex.test(message));
      return pattern ? t(pattern[1]) : message;
    };

    return { language, locale: LOCALES[language], setLanguage, t, translateError };
  }, [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage doit être utilisé dans <LanguageProvider>');
  return ctx;
}
