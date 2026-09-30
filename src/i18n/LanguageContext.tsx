import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { en, fr, TranslationKey } from './translations';

export type Language = 'fr' | 'en';
type Params = Record<string, string | number>;

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { fr, en };
const STORAGE_KEY = 'tipstreak.language';

type KeyValueStore = { getItemSync(key: string): string | null; setItemSync(key: string, value: string): void };

// expo-sqlite et expo-localization sont des modules natifs : une development build antérieure
// à leur installation ne les contient pas. On les charge prudemment pour ne pas planter
// (on perd alors seulement la mémorisation du choix de langue).
function loadStore(): KeyValueStore | null {
  try {
    // require() et non import : un import qui échoue ferait planter tout le bundle
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-sqlite/kv-store').default as KeyValueStore;
  } catch {
    return null;
  }
}

function deviceLanguage(): Language {
  let code: string | null | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    code = require('expo-localization').getLocales()[0]?.languageCode;
  } catch {
    code = Intl.DateTimeFormat().resolvedOptions().locale;
  }
  return code?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function initialLanguage(store: KeyValueStore | null): Language {
  try {
    const saved = store?.getItemSync(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {}
  return deviceLanguage();
}

export function translate(language: Language, key: TranslationKey, params?: Params): string {
  const text = DICTIONARIES[language][key] ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match)) : text;
}

type LanguageContextType = {
  language: Language;
  locale: string; // pour les dates : 'fr-FR' ou 'en-US'
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
  const [store] = useState(loadStore);
  const [language, setLanguageState] = useState<Language>(() => initialLanguage(store));

  const setLanguage = useCallback(
    (next: Language) => {
      setLanguageState(next);
      try {
        store?.setItemSync(STORAGE_KEY, next);
      } catch {}
    },
    [store]
  );

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

    return { language, locale: language === 'fr' ? 'fr-FR' : 'en-US', setLanguage, t, translateError };
  }, [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage doit être utilisé dans <LanguageProvider>');
  return ctx;
}
