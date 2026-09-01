import React, { createContext, useContext, useState, useEffect } from 'react';
import { Idioma, DICCIONARIO, TranslationKey } from '../lib/i18n';
import { trackEvent } from '../lib/analytics';

interface LanguageContextType {
  idioma: Idioma;
  setIdioma: (lang: Idioma) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_LANG_KEY = 'clipforge_preferred_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [idioma, setIdiomaState] = useState<Idioma>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_LANG_KEY) as Idioma;
      if (saved === 'es' || saved === 'en') return saved;
      const browserLang = navigator.language?.toLowerCase() || '';
      return browserLang.startsWith('es') ? 'es' : 'es'; // default español
    }
    return 'es';
  });

  const setIdioma = (nuevo: Idioma) => {
    setIdiomaState(nuevo);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_LANG_KEY, nuevo);
    }
    trackEvent('cambio_idioma', { idioma: nuevo });
  };

  const t = (key: TranslationKey): string => {
    const dict = DICCIONARIO[idioma] || DICCIONARIO.es;
    return (dict as any)[key] || DICCIONARIO.es[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ idioma, setIdioma, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage debe ser usado dentro de un LanguageProvider');
  }
  return context;
};
