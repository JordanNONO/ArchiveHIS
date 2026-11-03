import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuArrowRight } from 'react-icons/lu'
import { splashEnCours, surFinSplash } from '../utils/splash'
import {
  IllusClassement, IllusScan, IllusSuivi, IllusRegroupement, IllusNotifications,
} from './accueil/IllustrationsBienvenue'
import monogrammeHis from '../assets/his-monogramme.png'
import './accueil/accueil.css'

/**
 * Tour de bienvenue plein écran, affiché une seule fois par compte et par
 * appareil (voir utils/onboarding.js), juste après le splash de connexion.
 * Quatre écrans, une illustration animée chacun. Le contenu diffère selon le
 * profil : un compte "dépôt" (intervenant/bénéficiaire) et un compte
 * personnel interne n'utilisent pas du tout les mêmes écrans.
 */
const ECRANS = {
  depot: [IllusClassement, IllusScan, IllusSuivi, IllusNotifications],
  personnel: [IllusClassement, IllusRegroupement, IllusSuivi, IllusNotifications],
}

const SEUIL_GLISSER_PX = 40

function OnboardingTour({ profil = 'personnel', onTermine }) {
  const { t } = useTranslation()
  const prefixe = profil === 'depot' ? 'depot' : 'personnel'
  const illustrations = ECRANS[prefixe]
  const [etape, setEtape] = useState(0)
  // Rien ne démarre tant que le splash recouvre l'écran : les animations du
  // premier écran se joueraient cachées dessous.
  const [pret, setPret] = useState(() => !splashEnCours())
  const departGlisser = useRef(null)
  const derniere = etape === illustrations.length - 1

  useEffect(() => (pret ? undefined : surFinSplash(() => setPret(true))), [pret])

  function aller(i) {
    setEtape(Math.max(0, Math.min(illustrations.length - 1, i)))
  }

  useEffect(() => {
    if (!pret) return undefined
    function surTouche(e) {
      if (e.key === 'ArrowRight') setEtape((n) => Math.min(illustrations.length - 1, n + 1))
      if (e.key === 'ArrowLeft') setEtape((n) => Math.max(0, n - 1))
      if (e.key === 'Escape') onTermine()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [pret, illustrations.length, onTermine])

  if (!pret) return null

  return (
    <div className='hd-ob' role='dialog' aria-modal='true' aria-label={t('onboarding.titreTour')}>
      <div className='hd-col'>
        <div className='hd-top'>
          <div className='hd-logo'><img src={monogrammeHis} alt='' /><span>His<span className='hd-or'>Docs</span></span></div>
          <button type='button' className='hd-passer' onClick={onTermine}>{t('onboarding.passer')}</button>
        </div>

        <div
          className='hd-viewport'
          onPointerDown={(e) => { departGlisser.current = e.clientX }}
          onPointerUp={(e) => {
            if (departGlisser.current === null) return
            const dx = e.clientX - departGlisser.current
            departGlisser.current = null
            if (Math.abs(dx) > SEUIL_GLISSER_PX) aller(etape + (dx < 0 ? 1 : -1))
          }}
        >
          <div className='hd-track' style={{ transform: `translateX(${-etape * 100}%)` }}>
            {illustrations.map((Illustration, i) => (
              <section
                key={i}
                className={`hd-slide${i === etape ? ' hd-on' : ''}`}
                aria-hidden={i !== etape}
                aria-label={t('onboarding.etapeSur', { n: i + 1, total: illustrations.length })}
              >
                <Illustration profil={prefixe} actif={i === etape} />
                <div className='hd-txt'>
                  <h2>{t(`onboarding.${prefixe}${i + 1}Titre`)}</h2>
                  <p className='hd-desc'>{t(`onboarding.${prefixe}${i + 1}Description`)}</p>
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className='hd-bottom'>
          <div className='hd-dots'>
            {illustrations.map((_, i) => (
              <button
                key={i}
                type='button'
                aria-label={t('onboarding.etapeSur', { n: i + 1, total: illustrations.length })}
                aria-current={i === etape}
                onClick={() => aller(i)}
              />
            ))}
          </div>
          <button
            type='button'
            className={`hd-suivant${derniere ? ' hd-dernier' : ''}`}
            aria-label={derniere ? t('onboarding.commencer') : t('onboarding.suivant')}
            onClick={() => (derniere ? onTermine() : aller(etape + 1))}
          >
            <span className='hd-lbl'>{t('onboarding.commencer')}</span>
            <LuArrowRight size={20} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default OnboardingTour
