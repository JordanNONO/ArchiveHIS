import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { LuArrowLeft, LuEye, LuDownload, LuLoader2, LuWallet } from 'react-icons/lu'
import { getMesPapiers, telechargerBulletinsAnnee } from '../api/routes/monEspace'
import { libelleMois, libelleDate, telechargerDocument } from '../utils/mesPapiers'

const NOUVEAU_JOURS = 30

/**
 * « Mes bulletins de paie » — chaque bulletin déposé par la comptabilité au
 * nom du salarié apparaît ici, sans demande (voir MonEspaceController).
 */
function MesBulletins() {
  const { t, i18n } = useTranslation()
  const [bulletins, setBulletins] = useState(null)
  const [anneesOuvertes, setAnneesOuvertes] = useState({})
  const [zipEnCours, setZipEnCours] = useState(null)

  useEffect(() => {
    getMesPapiers().then(async (res) => {
      setBulletins(res.ok ? (await res.json()).bulletins : [])
    }).catch(() => setBulletins([]))
  }, [])

  const parAnnee = useMemo(() => {
    const groupes = {}
    ;(bulletins || []).forEach((b) => {
      const annee = (b.mois_concerne || b.date || '').slice(0, 4)
      if (!groupes[annee]) groupes[annee] = []
      groupes[annee].push(b)
    })
    return Object.entries(groupes).sort(([a], [b]) => b.localeCompare(a))
  }, [bulletins])

  async function telecharger(id) {
    try {
      await telechargerDocument(id)
    } catch {
      toast.error(t('mesPapiers.telechargementEchoue'))
    }
  }

  async function telechargerAnnee(annee) {
    setZipEnCours(annee)
    try {
      const res = await telechargerBulletinsAnnee(annee)
      if (!res.ok) throw new Error()
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `bulletins-de-paie-${annee}.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch {
      toast.error(t('mesPapiers.telechargementEchoue'))
    } finally {
      setZipEnCours(null)
    }
  }

  function estNouveau(b) {
    return b.date && (Date.now() - new Date(b.date).getTime()) < NOUVEAU_JOURS * 86400000
  }

  return (
    <div className='flex flex-col w-full gap-5 py-4 max-w-2xl mx-auto'>
      <div>
        <Link to='/' className='inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3'>
          <LuArrowLeft size={13} /> {t('espaceDossier.retourTableauDeBord')}
        </Link>
        <h1 className='text-xl font-bold text-foreground'>{t('mesPapiers.bulletinsTitre')}</h1>
        <p className='text-sm text-muted-foreground mt-1'>{t('mesPapiers.bulletinsIntro')}</p>
      </div>

      {bulletins === null && (
        <div className='flex justify-center py-10'><LuLoader2 className='animate-spin text-muted-foreground' size={22} /></div>
      )}

      {bulletins?.length === 0 && (
        <div className='rounded-2xl border border-border bg-card p-6 flex flex-col items-center text-center gap-2'>
          <LuWallet size={22} className='text-muted-foreground' />
          <p className='text-sm font-medium'>{t('mesPapiers.aucunBulletin')}</p>
          <p className='text-[13px] text-muted-foreground'>{t('mesPapiers.aucunBulletinTexte')}</p>
        </div>
      )}

      {parAnnee.map(([annee, liste], index) => {
        const ouverte = anneesOuvertes[annee] ?? index === 0
        return (
          <section key={annee} aria-labelledby={`annee-${annee}`} className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-2'>
              <h2 id={`annee-${annee}`} className='text-[13px] font-semibold text-muted-foreground'>{annee}</h2>
              <button
                type='button'
                onClick={() => telechargerAnnee(annee)}
                disabled={zipEnCours === annee}
                className='min-h-[36px] inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline disabled:opacity-50'
              >
                {zipEnCours === annee ? <LuLoader2 size={14} className='animate-spin' /> : <LuDownload size={14} />}
                {t('mesPapiers.toutTelecharger')}
              </button>
            </div>
            {ouverte ? (
              <ul className='flex flex-col rounded-2xl border border-border bg-card divide-y divide-border'>
                {liste.map((b) => (
                  <li key={b.id} className='flex items-center gap-3 pl-3.5 pr-1.5 py-2'>
                    <span className='w-9 h-9 rounded-lg bg-red-500/10 text-red-600 text-[10px] font-bold flex items-center justify-center shrink-0'>
                      {(b.extension || 'pdf').toUpperCase()}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <p className='text-sm font-medium flex items-center gap-1.5 flex-wrap'>
                        {b.mois_concerne ? libelleMois(b.mois_concerne, i18n.language) : b.titre}
                        {estNouveau(b) && <span className='px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-semibold'>{t('mesPapiers.nouveau')}</span>}
                      </p>
                      <p className='text-xs text-muted-foreground mt-0.5'>{t('mesPapiers.recuLe', { date: libelleDate(b.date, i18n.language) })}</p>
                    </div>
                    <Link to={`/view/${b.id}/${b.extension}`} aria-label={t('mesPapiers.voir')} className='w-11 h-11 flex items-center justify-center rounded-lg text-primary hover:bg-muted'>
                      <LuEye size={18} />
                    </Link>
                    <button type='button' onClick={() => telecharger(b.id)} aria-label={t('mesPapiers.telecharger')} className='w-11 h-11 flex items-center justify-center rounded-lg text-primary hover:bg-muted'>
                      <LuDownload size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <button
                type='button'
                onClick={() => setAnneesOuvertes((o) => ({ ...o, [annee]: true }))}
                className='min-h-[52px] px-3.5 rounded-2xl border border-border bg-card text-left text-sm font-medium hover:bg-muted/40 transition-colors'
              >
                {t('mesPapiers.nBulletins', { count: liste.length })}
              </button>
            )}
          </section>
        )
      })}

      <section className='rounded-2xl border border-dashed border-border p-4 flex flex-col gap-2 items-start'>
        <p className='text-sm font-semibold'>{t('mesPapiers.bulletinManque')}</p>
        <p className='text-[13px] text-muted-foreground'>{t('mesPapiers.bulletinManqueTexte')}</p>
        <Link to='/espace/paie' className='min-h-[44px] px-4 rounded-xl border border-primary text-primary text-sm font-semibold flex items-center hover:bg-primary/5 transition-colors'>
          {t('mesPapiers.demanderBulletin')}
        </Link>
      </section>
    </div>
  )
}

export default MesBulletins
