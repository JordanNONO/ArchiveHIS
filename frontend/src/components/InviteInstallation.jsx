import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuShare } from 'react-icons/lu'
import { sAbonnerInstallation, lancerInstallation, estDejaInstallee, estIos } from '../utils/installation'

const CLE_PLUS_TARD = 'his_installation_plus_tard'
const DELAI_PLUS_TARD_JOURS = 30

function reporteeRecemment() {
  try {
    const le = Number(localStorage.getItem(CLE_PLUS_TARD) || 0)
    return le && Date.now() - le < DELAI_PLUS_TARD_JOURS * 86400000
  } catch {
    return false
  }
}

/**
 * Carte « Ajoutez HIS à votre écran d'accueil » du tableau de bord
 * intervenant (voir utils/installation.js). N'apparaît pas si l'application
 * est déjà installée, ni pendant 30 jours après « Plus tard ».
 */
function InviteInstallation() {
  const { t } = useTranslation()
  const [invitation, setInvitation] = useState(null)
  const [masquee, setMasquee] = useState(() => estDejaInstallee() || reporteeRecemment())
  const [aideIos, setAideIos] = useState(false)
  const ios = estIos()

  useEffect(() => sAbonnerInstallation(setInvitation), [])

  if (masquee || (!invitation && !ios)) return null

  function plusTard() {
    try { localStorage.setItem(CLE_PLUS_TARD, String(Date.now())) } catch { /* navigation privée */ }
    setMasquee(true)
  }

  async function installer() {
    if (ios) {
      setAideIos(true)
      return
    }
    if (await lancerInstallation()) setMasquee(true)
  }

  return (
    <section aria-label={t('installation.titre')} className='rounded-2xl bg-primary text-white p-4 flex flex-col gap-3'>
      <div className='flex items-center gap-3'>
        <span className='flex items-center justify-center w-10 h-10 rounded-xl bg-[#FACC15] text-primary text-xs font-bold shrink-0'>HIS</span>
        <div className='min-w-0'>
          <p className='text-sm font-semibold'>{t('installation.titre')}</p>
          <p className='text-[13px] text-white/80 mt-0.5'>{t('installation.texte')}</p>
        </div>
      </div>
      {aideIos ? (
        <p className='text-[13px] text-white/90 flex items-center gap-1.5 flex-wrap'>
          {t('installation.aideIosAvant')} <LuShare size={15} aria-label={t('installation.partager')} /> {t('installation.aideIosApres')}
        </p>
      ) : (
        <div className='flex gap-2'>
          <button type='button' onClick={installer} className='min-h-[44px] px-4 rounded-xl bg-[#FACC15] text-primary text-sm font-semibold hover:bg-[#FACC15]/90 transition-colors'>
            {t('installation.installer')}
          </button>
          <button type='button' onClick={plusTard} className='min-h-[44px] px-4 rounded-xl border border-white/30 text-sm font-medium hover:bg-white/10 transition-colors'>
            {t('installation.plusTard')}
          </button>
        </div>
      )}
    </section>
  )
}

export default InviteInstallation
