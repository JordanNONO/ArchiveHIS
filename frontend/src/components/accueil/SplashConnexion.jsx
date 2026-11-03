import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { consommerSplash, terminerSplash } from '../../utils/splash'
import { jouerSonSplash } from '../../utils/sonSplash'
// Rond HIS seul, sans le texte « Hetep Iaout Services » qui déborde sur le
// disque dans his-logo.png / his-badge.png.
import monogrammeHis from '../../assets/his-monogramme.png'
import './accueil.css'

const DUREE_MS = 3100
const DUREE_REDUITE_MS = 900
const FONDU_MS = 600

/**
 * Écran de démarrage joué après chaque connexion, pour le personnel comme
 * pour les comptes dépôt (voir utils/splash.js) : des feuilles se rangent,
 * deviennent le badge HIS, puis le nom de l'appli apparaît. Un toucher le
 * passe — il recouvre aussi le premier chargement de /auth/me derrière.
 */
function SplashConnexion() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(() => consommerSplash())
  const [sortie, setSortie] = useState(false)

  useEffect(() => {
    if (!visible) return undefined
    return jouerSonSplash()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const minuteur = setTimeout(() => setSortie(true), reduit ? DUREE_REDUITE_MS : DUREE_MS)
    return () => clearTimeout(minuteur)
  }, [visible])

  useEffect(() => {
    if (!sortie) return
    terminerSplash()
    const minuteur = setTimeout(() => setVisible(false), FONDU_MS)
    return () => clearTimeout(minuteur)
  }, [sortie])

  if (!visible) return null

  const lettres = ['H', 'i', 's', 'D', 'o', 'c', 's']

  return (
    <div
      className={`hd-splash${sortie ? ' hd-sortie' : ''}`}
      onClick={() => setSortie(true)}
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

export default SplashConnexion
