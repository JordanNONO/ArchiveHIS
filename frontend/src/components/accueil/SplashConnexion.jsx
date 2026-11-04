import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { consommerSplash, terminerSplash, MODE_SPLASH_FIN } from '../../utils/splash'
import { jouerSonSplash } from '../../utils/sonSplash'
// Rond HIS seul, sans le texte « Hetep Iaout Services » qui déborde sur le
// disque dans his-logo.png / his-badge.png.
import monogrammeHis from '../../assets/his-monogramme.png'
import './accueil.css'

const DUREE_MS = 3100
const DUREE_REDUITE_MS = 900
const FONDU_MS = 600
// Dernière image affichée après le rechargement (mode 'fin') : juste le
// temps que l'appli derrière commence à s'afficher, avant le fondu.
const DUREE_FIN_MS = 500

/**
 * L'écran de démarrage lui-même : des feuilles se rangent, deviennent le
 * badge HIS, puis le nom de l'appli apparaît, avec son carillon.
 * `fige` : n'affiche que la dernière image (animations déjà jouées).
 * `onTermine` : appelé à la fin de l'animation, ou dès qu'on le touche.
 */
export function EcranSplash({ fige = false, sortie = false, avecSon = true, onTermine }) {
  const { t } = useTranslation()
  const termine = useRef(false)

  function terminer() {
    if (termine.current) return
    termine.current = true
    onTermine?.()
  }

  useEffect(() => (avecSon && !fige ? jouerSonSplash() : undefined), [avecSon, fige])

  useEffect(() => {
    if (fige) return undefined
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const minuteur = setTimeout(terminer, reduit ? DUREE_REDUITE_MS : DUREE_MS)
    return () => clearTimeout(minuteur)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fige])

  const lettres = ['H', 'i', 's', 'D', 'o', 'c', 's']

  return (
    <div
      className={`hd-splash${fige ? ' hd-fige' : ''}${sortie ? ' hd-sortie' : ''}`}
      onClick={terminer}
      role='presentation'
    >
      <div className='hd-grain' />
      <div className='hd-mark' aria-hidden='true'>
        <div className='hd-sheet hd-s1' />
        <div className='hd-sheet hd-s2' />
        <div className='hd-sheet hd-s3' />
        <img className='hd-badge' src={monogrammeHis} alt='' />
        <svg className='hd-ring' viewBox='0 0 150 150'><circle cx='75' cy='75' r='70' /></svg>
      </div>
      <div className='hd-word'>
        <h2 aria-label='HisDocs'>
          {lettres.map((l, i) => (
            <span key={i} className={i >= 3 ? 'hd-or' : undefined} style={{ '--i': i }}>{l}</span>
          ))}
        </h2>
        <p>{t('onboarding.splashSlogan')}</p>
      </div>
      <div className='hd-foot'>
        <div className='hd-bar'><i /></div>
        <small>{t('commun.entreprise')}</small>
      </div>
    </div>
  )
}

/**
 * Splash affiché par l'appli juste après une connexion (voir utils/splash.js),
 * pour le personnel comme pour les comptes dépôt. Il recouvre aussi le
 * premier chargement de /auth/me derrière, et le tour de bienvenue attend sa
 * fin (terminerSplash).
 */
function SplashConnexion() {
  const [mode] = useState(() => consommerSplash())
  const [visible, setVisible] = useState(mode !== null)
  const [sortie, setSortie] = useState(false)

  useEffect(() => {
    if (mode !== MODE_SPLASH_FIN) return undefined
    const minuteur = setTimeout(() => setSortie(true), DUREE_FIN_MS)
    return () => clearTimeout(minuteur)
  }, [mode])

  useEffect(() => {
    if (!sortie) return undefined
    terminerSplash()
    const minuteur = setTimeout(() => setVisible(false), FONDU_MS)
    return () => clearTimeout(minuteur)
  }, [sortie])

  if (!visible) return null

  return <EcranSplash fige={mode === MODE_SPLASH_FIN} sortie={sortie} onTermine={() => setSortie(true)} />
}

export default SplashConnexion
