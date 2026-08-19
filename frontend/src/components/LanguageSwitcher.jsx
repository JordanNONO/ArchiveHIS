import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuGlobe, LuCheck, LuChevronDown } from 'react-icons/lu'
import { LANGUES_DISPONIBLES } from '../i18n'

/**
 * Sélecteur de langue façon "site institutionnel" : visible dès l'arrivée
 * (avant même la connexion), change immédiatement toute l'interface, et le
 * choix est mémorisé (voir i18n/index.js — persisté en localStorage) pour ne
 * plus jamais être redemandé sur cet appareil.
 *
 * `variant="dark"` s'utilise sur un fond sombre (ex: le panneau navy de
 * Login.jsx) ; "light" (par défaut) sur un fond clair/blanc.
 * `compact` masque le libellé sous le breakpoint sm (icône + chevron
 * seulement) — pour la Navbar, déjà chargée en icônes sur mobile.
 */
function LanguageSwitcher({ variant = 'light', className = '', compact = false }) {
  const { i18n } = useTranslation()
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickDehors(e) {
      if (ref.current && !ref.current.contains(e.target)) setOuvert(false)
    }
    document.addEventListener('mousedown', onClickDehors)
    return () => document.removeEventListener('mousedown', onClickDehors)
  }, [])

  const langueActuelle = LANGUES_DISPONIBLES.find((l) => l.code === i18n.resolvedLanguage) || LANGUES_DISPONIBLES[0]
  const surFondSombre = variant === 'dark'

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type='button'
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          surFondSombre
            ? 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
            : 'border-border bg-background text-foreground hover:bg-muted'
        }`}
      >
        <LuGlobe size={13} />
        <span className={compact ? 'hidden sm:inline' : ''}>{langueActuelle.label}</span>
        <LuChevronDown size={12} className={`transition-transform ${ouvert ? 'rotate-180' : ''}`} />
      </button>

      {ouvert && (
        <div className='absolute right-0 mt-1.5 w-40 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50'>
          {LANGUES_DISPONIBLES.map((langue) => (
            <button
              key={langue.code}
              type='button'
              onClick={() => {
                i18n.changeLanguage(langue.code)
                setOuvert(false)
              }}
              className='w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-foreground hover:bg-muted transition-colors'
            >
              {langue.label}
              {langue.code === langueActuelle.code && <LuCheck size={14} className='text-primary' />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default LanguageSwitcher
