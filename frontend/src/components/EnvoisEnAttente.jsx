import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { LuClock, LuAlertTriangle } from 'react-icons/lu'
import { listerEnAttente, annulerEnvoi, envoyerEnAttente, EVENEMENT_FILE } from '../utils/fileEnvoiHorsLigne'
import { useConfirm } from '../contexts/ConfirmDialogContext'

/**
 * « En attente d'envoi » sur le tableau de bord intervenant : les dépôts
 * gardés sans réseau (voir fileEnvoiHorsLigne.js), avec de quoi réessayer
 * tout de suite ou annuler. Rien ne s'affiche quand la file est vide.
 */
function EnvoisEnAttente({ userId }) {
  const { t, i18n } = useTranslation()
  const confirm = useConfirm()
  const [lots, setLots] = useState([])
  const [envoi, setEnvoi] = useState(false)

  const charger = useCallback(() => {
    listerEnAttente(userId).then(setLots)
  }, [userId])

  useEffect(() => {
    charger()
    window.addEventListener(EVENEMENT_FILE, charger)
    return () => window.removeEventListener(EVENEMENT_FILE, charger)
  }, [charger])

  if (lots.length === 0) return null

  async function reessayer() {
    if (!navigator.onLine) {
      toast.info(t('horsLigne.toujoursPasDeReseau'))
      return
    }
    setEnvoi(true)
    await envoyerEnAttente(userId)
    setEnvoi(false)
    charger()
  }

  async function annuler(lot) {
    if (!await confirm({ message: t('horsLigne.confirmerAnnulation', { titre: lot.titre }), danger: true, confirmLabel: t('horsLigne.annulerEnvoi') })) return
    await annulerEnvoi(lot.id)
  }

  return (
    <section aria-labelledby='titre-envois-attente' className='flex flex-col gap-2.5'>
      <h2 id='titre-envois-attente' className='text-sm font-semibold'>{t('horsLigne.enAttenteTitre', { count: lots.length })}</h2>
      <p className='text-[13px] text-muted-foreground -mt-1'>{t('horsLigne.enAttenteTexte')}</p>
      <div className='flex flex-col rounded-2xl border border-border bg-card divide-y divide-border'>
        {lots.map((lot) => (
          <div key={lot.id} className='flex flex-col gap-2.5 px-3.5 py-3'>
            <div className='flex items-center gap-3'>
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${lot.erreur ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                {lot.erreur ? <LuAlertTriangle size={16} /> : <LuClock size={16} />}
              </span>
              <div className='min-w-0'>
                <p className='text-sm font-medium truncate'>{lot.titre}</p>
                <p className={`text-xs mt-0.5 ${lot.erreur ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {lot.erreur
                    ? t('horsLigne.refuse')
                    : t('horsLigne.enregistreLe', {
                      count: lot.envois.length,
                      heure: new Date(lot.creeLe).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
                    })}
                </p>
              </div>
            </div>
            <div className='flex flex-wrap gap-2'>
              <button type='button' onClick={reessayer} disabled={envoi} className='min-h-[44px] px-3.5 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors disabled:opacity-50'>
                {t('horsLigne.reessayer')}
              </button>
              <button type='button' onClick={() => annuler(lot)} className='min-h-[44px] px-3.5 rounded-xl text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors'>
                {t('horsLigne.annulerEnvoi')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default EnvoisEnAttente
