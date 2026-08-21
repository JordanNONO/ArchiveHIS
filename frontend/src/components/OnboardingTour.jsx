import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LuMessageSquare, LuWallet, LuCalendarClock, LuCamera, LuBell, LuInbox, LuCheck, LuArrowRight,
  LuFolderOpen, LuUsers2, LuClipboardCheck, LuDownload, LuUserPlus,
} from 'react-icons/lu'

/**
 * Tour de bienvenue affiché une seule fois, à la toute première connexion sur
 * un appareil (voir utils/onboarding.js) — explique chaque fonctionnalité
 * principale avant que la personne se retrouve seule devant l'appli, comme
 * le font la plupart des applis grand public. Le contenu diffère selon le
 * profil : un compte "dépôt" (intervenant/bénéficiaire) et un compte
 * personnel interne n'utilisent pas du tout les mêmes écrans.
 */
const ICONES_DEPOT = [LuMessageSquare, LuCamera, LuWallet, LuCalendarClock, LuInbox, LuBell]
const ICONES_PERSONNEL = [LuFolderOpen, LuClipboardCheck, LuUsers2, LuUserPlus, LuDownload, LuBell]

function OnboardingTour({ profil = 'personnel', onTermine }) {
  const { t } = useTranslation()
  const prefixe = profil === 'depot' ? 'depot' : 'personnel'
  const icones = profil === 'depot' ? ICONES_DEPOT : ICONES_PERSONNEL
  const etapes = icones.map((icon, i) => ({
    icon,
    titre: t(`onboarding.${prefixe}${i + 1}Titre`),
    description: t(`onboarding.${prefixe}${i + 1}Description`),
  }))
  const [etape, setEtape] = useState(0)
  const derniere = etape === etapes.length - 1
  const { icon: Icon, titre, description } = etapes[etape]

  return (
    <div className='fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4'>
      <div className='w-full max-w-sm rounded-2xl bg-card border border-border shadow-xl p-6 flex flex-col items-center text-center gap-4'>
        <div className='flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary'>
          <Icon size={28} />
        </div>
        <div>
          <h2 className='text-lg font-semibold text-foreground'>{titre}</h2>
          <p className='text-sm text-muted-foreground mt-2 leading-relaxed'>{description}</p>
        </div>

        <div className='flex items-center gap-1.5 mt-1'>
          {etapes.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === etape ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`}
            />
          ))}
        </div>

        <div className='flex items-center justify-between w-full mt-2'>
          <button
            onClick={onTermine}
            className='text-xs text-muted-foreground hover:text-foreground transition-colors'
          >
            {t('onboarding.passer')}
          </button>
          <button
            onClick={() => (derniere ? onTermine() : setEtape((e) => e + 1))}
            className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'
          >
            {derniere ? (<><LuCheck size={15} /> {t('onboarding.comprisTerminer')}</>) : (<>{t('onboarding.suivant')} <LuArrowRight size={15} /></>)}
          </button>
        </div>
      </div>
    </div>
  )
}

export default OnboardingTour
