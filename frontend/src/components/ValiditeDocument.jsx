import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { LuAlarmClock } from 'react-icons/lu'
import { definirValiditeDocument } from '../api/routes/monEspace'

// Même liste que EcheancesDocuments::FAMILLES_COCHEES_DOFFICE (backend) :
// pour ces documents, la case est cochée d'office tant qu'aucune date n'est
// saisie — il ne reste qu'à taper la date.
const MOTS_COCHES_DOFFICE = ['titre de sejour', 'carte de sejour', 'recepisse', 'autorisation de travail', 'visite medicale', 'medecine du travail', 'permis', 'psc1', 'sst', 'sauveteur secouriste', 'formation', 'habilitation']

function normaliser(texte) {
  return ` ${String(texte || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
}

export function estCocheDoffice(meta) {
  const texte = normaliser(`${meta?.titre_document || ''} ${meta?.type_document?.libelle || ''}`)
  return MOTS_COCHES_DOFFICE.some((mot) => texte.includes(` ${mot} `))
}

/**
 * « Ce document a une date de fin de validité » — saisie RH (demande
 * explicite 2026-11-22). La date déclenche les rappels 60/30/7 jours avant
 * au salarié et à la RH, et l'alerte de son espace (voir
 * DocumentController::definirValidite, documents:rappeler-validite).
 */
function ValiditeDocument({ meta, peutModifier, onMisAJour }) {
  const { t, i18n } = useTranslation()
  const dateEnregistree = meta?.date_fin_validite || ''
  const [coche, setCoche] = useState(() => !!dateEnregistree || estCocheDoffice(meta))
  const [date, setDate] = useState(dateEnregistree)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    setDate(meta?.date_fin_validite || '')
    setCoche(!!meta?.date_fin_validite || estCocheDoffice(meta))
  }, [meta?.id, meta?.date_fin_validite]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!peutModifier) {
    if (!dateEnregistree) return null
    return (
      <div className='pb-4 mb-4 border-b border-border'>
        <p className='text-xs text-muted-foreground mb-1'>{t('validite.valableJusquau')}</p>
        <p className='text-sm font-medium'>{new Date(`${dateEnregistree}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
    )
  }

  const modifie = (coche ? date : '') !== dateEnregistree

  async function enregistrer() {
    if (coche && !date) {
      toast.warning(t('validite.saisirDate'))
      return
    }
    setEnCours(true)
    try {
      const res = await definirValiditeDocument(meta.id, coche ? date : null)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || data?.message || t('validite.echec'))
        return
      }
      toast.success(coche ? t('validite.enregistree') : t('validite.retiree'))
      onMisAJour?.(data)
    } catch {
      toast.error(t('commun.erreurGenerique'))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className='pb-4 mb-4 border-b border-border flex flex-col gap-2.5'>
      <label className='flex items-start gap-2.5 text-sm font-medium cursor-pointer'>
        <input
          type='checkbox'
          checked={coche}
          onChange={(e) => setCoche(e.target.checked)}
          className='mt-0.5 w-4 h-4 accent-[#1B365D]'
        />
        <span className='flex items-center gap-1.5'><LuAlarmClock size={14} className='text-muted-foreground' /> {t('validite.caseLibelle')}</span>
      </label>
      {coche && (
        <div className='flex flex-col gap-1.5 pl-6'>
          <label htmlFor={`fin-validite-${meta.id}`} className='text-xs text-muted-foreground'>{t('validite.valableJusquau')}</label>
          <input
            id={`fin-validite-${meta.id}`}
            type='date'
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className='h-10 px-2.5 rounded-lg border border-border bg-background text-sm'
          />
          <p className='text-[11px] text-muted-foreground'>{t('validite.aideRappels')}</p>
        </div>
      )}
      {modifie && (
        <button
          type='button'
          onClick={enregistrer}
          disabled={enCours}
          className='self-start min-h-[36px] px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50'
        >
          {t('validite.enregistrer')}
        </button>
      )}
    </div>
  )
}

export default ValiditeDocument
