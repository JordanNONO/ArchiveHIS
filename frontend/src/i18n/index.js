import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import fr from './locales/fr.json'
import en from './locales/en.json'
import es from './locales/es.json'
import de from './locales/de.json'
import ar from './locales/ar.json'

// Clé dédiée (pas la même que le token/session) : le choix de langue doit
// survivre à une déconnexion — un intervenant qui se déconnecte ne doit pas
// avoir à re-choisir sa langue à la prochaine connexion sur le même appareil.
export const CLE_LANGUE_STOCKAGE = 'his_langue'

export const LANGUES_DISPONIBLES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ar', label: 'العربية' },
]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      es: { translation: es },
      de: { translation: de },
      ar: { translation: ar },
    },
    fallbackLng: 'fr',
    supportedLngs: LANGUES_DISPONIBLES.map((l) => l.code),
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: CLE_LANGUE_STOCKAGE,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

export default i18n
