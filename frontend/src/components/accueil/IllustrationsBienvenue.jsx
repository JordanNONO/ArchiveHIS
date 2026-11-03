import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuSearch, LuCheck, LuFileText, LuCalendarDays, LuMic, LuBell, LuUsers2, LuArchive } from 'react-icons/lu'

/**
 * Illustrations animées du tour de bienvenue (OnboardingTour.jsx). Chacune
 * montre le geste plutôt que de le décrire ; les animations sont en CSS
 * (accueil.css) et ne démarrent que lorsque l'écran parent porte .hd-on.
 * `profil` adapte les textes : 'depot' (intervenant/bénéficiaire) ou
 * 'personnel' (compte interne).
 */

const Coche = ({ taille = 12 }) => <LuCheck size={taille} strokeWidth={3.2} />

export function IllusClassement({ profil }) {
  const { t } = useTranslation()
  const p = `onboarding.illus.${profil}`
  return (
    <div className='hd-illus'>
      <div className='hd-search'>
        <LuSearch size={16} />
        <span className='hd-typed'>{t(`${p}.recherche`)}</span>
      </div>
      <div className='hd-folder'>
        <div className='hd-folder-back' />
        <div className='hd-doc hd-fd hd-f1'>
          <span className='hd-tag hd-tag-jaune'>{t('onboarding.illus.tagContrat')}</span>
          <div className='hd-ln' style={{ width: '80%' }} /><div className='hd-ln' style={{ width: '60%' }} /><div className='hd-ln' style={{ width: '70%' }} />
        </div>
        <div className='hd-doc hd-fd hd-f2'>
          <span className='hd-tag hd-tag-bleu'>{t('onboarding.illus.tagAttestation')}</span>
          <div className='hd-ln' style={{ width: '75%' }} /><div className='hd-ln' style={{ width: '85%' }} /><div className='hd-ln' style={{ width: '50%' }} />
        </div>
        <div className='hd-doc hd-fd hd-f3'>
          <span className='hd-tag hd-tag-vert'>{t('onboarding.illus.tagFichePaie')}</span>
          <div className='hd-ln' style={{ width: '90%' }} /><div className='hd-ln' style={{ width: '65%' }} /><div className='hd-ln' style={{ width: '75%' }} />
        </div>
        <div className='hd-folder-front'>
          <LuCheck size={18} color='#FACC15' strokeWidth={2.6} />
          <span>{t(`${p}.dossier`)}</span>
          <em>{t('onboarding.illus.nbDocuments', { count: 3 })}</em>
        </div>
      </div>
    </div>
  )
}

export function IllusScan() {
  const { t } = useTranslation()
  return (
    <div className='hd-illus'>
      <div className='hd-cam'>
        <span className='hd-c hd-tl' /><span className='hd-c hd-tr' /><span className='hd-c hd-bl' /><span className='hd-c hd-br' />
        <div className='hd-doc hd-scan-doc'>
          <h4>{t('onboarding.illus.demandeConge')}</h4>
          <div className='hd-ln' style={{ width: '85%' }} /><div className='hd-ln' style={{ width: '70%' }} />
          <div className='hd-ln' style={{ width: '90%' }} /><div className='hd-ln' style={{ width: '55%' }} />
          <div className='hd-sig'>
            <small>{t('onboarding.illus.signature')}</small>
            <svg viewBox='0 0 160 50' preserveAspectRatio='none' aria-hidden='true'>
              <path d='M4 34 C 14 10, 22 8, 20 30 S 30 44, 38 24 C 44 12, 48 30, 54 28 C 62 24, 60 12, 70 18 C 78 24, 74 36, 86 30 C 98 24, 104 20, 112 26 C 118 30, 126 34, 156 22' />
            </svg>
          </div>
          <span className='hd-beam' />
        </div>
      </div>
      <div className='hd-pastille'><Coche taille={14} />{t('onboarding.illus.signeEnvoye')}</div>
    </div>
  )
}

const MOMENTS_ETAPES_MS = [450, 1250, 2050]

export function IllusSuivi({ profil, actif }) {
  const { t } = useTranslation()
  const p = `onboarding.illus.${profil}`
  const [allumees, setAllumees] = useState(0)

  // Les étapes s'allument une à une à chaque arrivée sur l'écran.
  useEffect(() => {
    setAllumees(0)
    if (!actif) return
    const minuteurs = MOMENTS_ETAPES_MS.map((ms, i) => setTimeout(() => setAllumees(i + 1), ms))
    return () => minuteurs.forEach(clearTimeout)
  }, [actif])

  const termine = allumees === MOMENTS_ETAPES_MS.length
  // Côté personnel, la pastille passe de « À traiter bientôt » à « Traité » une
  // fois le document validé ; côté dépôt, la demande reste « dans les délais ».
  const pastilleOrange = profil === 'personnel' && !termine
  const etapes = [
    { libelle: t(`${p}.etape1`), heure: '09:12' },
    { libelle: t(`${p}.etape2`), heure: '14:30' },
    { libelle: t(`${p}.etape3`), heure: '10:05' },
  ]

  return (
    <div className='hd-illus'>
      <div className='hd-doc hd-req'>
        <div className='hd-req-h'>
          <div><b>{t(`${p}.suiviTitre`)}</b><small>{t(`${p}.suiviSousTitre`)}</small></div>
          <span className={`hd-tag ${pastilleOrange ? 'hd-tag-orange' : 'hd-tag-vert'}`}>
            {pastilleOrange ? t(`${p}.pastilleAvant`) : t(`${p}.pastilleApres`)}
          </span>
        </div>
        <div className='hd-steps'>
          <span className='hd-fill' />
          {etapes.map((e, i) => (
            <div key={i} className={`hd-st${i < allumees ? ' hd-lit' : ''}`}>
              <span className='hd-d'><Coche /></span>
              <b>{e.libelle}</b>
              <time>{e.heure}</time>
            </div>
          ))}
        </div>
      </div>
      <div className='hd-who'>
        <i>{t(`${p}.initiales`)}</i>
        <span><b>{t(`${p}.quiNom`)}</b> {t(`${p}.quiAction`)}</span>
      </div>
    </div>
  )
}

// Trois personnes fictives, une couleur chacune ; chaque pièce de la pile
// rejoint la ligne de sa personne.
const SALARIES = [
  { initiales: 'AD', nom: 'A. Diallo', couleur: '#1C78C2' },
  { initiales: 'MB', nom: 'M. Bernard', couleur: '#B88E00' },
  { initiales: 'SH', nom: 'S. Haddad', couleur: '#16A34A' },
]
const PILE = [0, 1, 2, 0, 1, 0, 2]
// Pour chaque personne, la position de ses pièces dans la pile : la pièce
// apparaît sur sa ligne au rythme où elle quitte la pile.
const RANGS_DANS_PILE = SALARIES.map((_, i) => PILE.flatMap((s, k) => (s === i ? [k] : [])))

export function IllusRegroupement() {
  const { t } = useTranslation()
  return (
    <div className='hd-illus'>
      <div className='hd-grp-btn'><LuUsers2 size={15} />{t('onboarding.illus.grouperParSalarie')}</div>
      <div className='hd-pile' aria-hidden='true'>
        {PILE.map((s, k) => (
          <span
            key={k}
            className='hd-chip'
            style={{
              left: `${k * 11}%`,
              '--c': SALARIES[s].couleur,
              '--k': k,
              '--tx': `${180 - k * 26}px`,
              '--ty': `${110 + s * 52}px`,
            }}
          />
        ))}
      </div>
      <div className='hd-rows'>
        {SALARIES.map((s, i) => (
          <div key={s.initiales} className='hd-row' style={{ '--c': s.couleur }}>
            <i>{s.initiales}</i>
            <b>{s.nom}</b>
            <span>
              {RANGS_DANS_PILE[i].map((k) => <u key={k} style={{ '--k': k }} />)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const HAUTEURS_ONDE = [8, 14, 20, 11, 17, 22, 12, 7, 15, 19, 9, 13]

export function IllusNotifications({ profil }) {
  const { t } = useTranslation()
  const p = `onboarding.illus.${profil}`
  const Icone2 = profil === 'personnel' ? LuArchive : LuCalendarDays
  return (
    <div className='hd-illus'>
      <div className='hd-notifs'>
        <div className='hd-nt'>
          <span className='hd-ic' style={{ background: '#DCFCE7', color: '#15803D' }}><LuFileText size={18} /></span>
          <div><b>{t(`${p}.notif1Titre`)} <span>{t('onboarding.illus.maintenant')}</span></b><p>{t(`${p}.notif1Texte`)}</p></div>
        </div>
        <div className='hd-nt'>
          <span className='hd-ic' style={{ background: '#FEF9C3', color: '#A16207' }}><Icone2 size={18} /></span>
          <div><b>{t(`${p}.notif2Titre`)} <span>{t('onboarding.illus.ilYa', { count: 2 })}</span></b><p>{t(`${p}.notif2Texte`)}</p></div>
        </div>
        <div className='hd-nt'>
          <span className='hd-ic' style={{ background: '#DBEAFE', color: '#1D4ED8' }}><LuMic size={18} /></span>
          <div>
            <b>{t('onboarding.illus.messageVocal')} <span>{t('onboarding.illus.ilYa', { count: 5 })}</span></b>
            <div className='hd-wave' aria-hidden='true'>
              <span className='hd-play'><svg width='8' height='9' viewBox='0 0 8 9' fill='#FACC15'><path d='M0 0l8 4.5L0 9z' /></svg></span>
              {HAUTEURS_ONDE.map((h, k) => <i key={k} style={{ '--h': `${h}px`, '--k': k }} />)}
              <em>0:18</em>
            </div>
          </div>
        </div>
      </div>
      <div className='hd-bell' aria-hidden='true'><LuBell size={24} /><span className='hd-pt' /></div>
    </div>
  )
}
