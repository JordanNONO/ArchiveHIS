import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LuArrowLeft, LuCheck, LuLoader2, LuFileText } from 'react-icons/lu'
import { getDocumentMeta, getDocumentHistorique } from '../api/routes/document'
import StatutBadge, { STATUT_LABELS_EXTERNE } from '../components/StatutBadge'
import { getFileTypeVisual } from '../utils/fileTypeIcons'

const STATUTS_TERMINES = ['VALIDE_ET_TRAITE', 'ARCHIVE', 'EXPIRE_A_PURGER']

/**
 * Suivi clair d'une demande pour l'intervenant — demande explicite
 * 2026-11-22 : chaque étape avec sa date et son heure, en mots simples (les
 * mêmes libellés « externes » que StatutBadge : le circuit interne
 * transmis/en cours/validé/archivé ne le concerne pas). Construit sur
 * l'historique des statuts déjà enregistré (HistoriqueStatut).
 */
function SuiviDemande() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const [meta, setMeta] = useState(null)
  const [historique, setHistorique] = useState([])
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    getDocumentMeta(id).then(async (res) => {
      if (!res.ok) { setErreur(true); return }
      setMeta(await res.json())
    }).catch(() => setErreur(true))
    getDocumentHistorique(id).then(async (res) => res.ok && setHistorique(await res.json())).catch(() => {})
  }, [id])

  function quand(date) {
    if (!date) return ''
    return new Date(date).toLocaleString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  }

  // Étapes vues de l'extérieur : l'envoi, puis chaque changement de statut
  // (deux statuts internes qui se lisent pareil, ex. « transmis » puis « en
  // cours », ne font qu'une étape), puis la réponse attendue si ce n'est pas fini.
  const etapes = []
  if (meta) {
    etapes.push({ cle: 'envoi', titre: t('suivi.envoyee'), date: meta.created_at, fait: true })
    let dernierLibelle = null
    historique
      .filter((h) => (h.type_evenement || 'statut') === 'statut' && h.nouveau_statut)
      .sort((a, b) => new Date(a.date_changement) - new Date(b.date_changement))
      .forEach((h) => {
        const cle = STATUT_LABELS_EXTERNE[h.nouveau_statut]
        if (!cle || cle === dernierLibelle) return
        dernierLibelle = cle
        etapes.push({
          cle: `${h.id}`,
          titre: t(cle),
          date: h.date_changement,
          fait: true,
          motif: h.nouveau_statut === 'INCOMPLET_REJETE' ? h.motif_changement : null,
          alerte: h.nouveau_statut === 'INCOMPLET_REJETE',
        })
      })
    if (!STATUTS_TERMINES.includes(meta.status_doc)) {
      etapes.push({ cle: 'reponse', titre: t('suivi.reponseAttendue'), texte: t('suivi.reponsePrevenu'), fait: false })
    }
  }

  const extension = String(meta?.chemin_stockage_serveur || '').split('.').pop()
  const { icon: IconeFichier, tint } = getFileTypeVisual(meta?.chemin_stockage_serveur)

  return (
    <div className='flex flex-col w-full gap-5 py-4 max-w-2xl mx-auto'>
      <Link to='/' className='inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors'>
        <LuArrowLeft size={13} /> {t('espaceDossier.retourTableauDeBord')}
      </Link>

      {erreur && <p className='text-sm text-muted-foreground'>{t('suivi.introuvable')}</p>}
      {!meta && !erreur && (
        <div className='flex justify-center py-10'><LuLoader2 className='animate-spin text-muted-foreground' size={22} /></div>
      )}

      {meta && (
        <>
          <section className='rounded-2xl border border-border bg-card p-4 flex flex-col gap-2.5 items-start'>
            <h1 className='text-lg font-bold text-foreground'>{meta.titre_document}</h1>
            <StatutBadge statut={meta.status_doc} externe />
          </section>

          <section aria-labelledby='titre-etapes' className='flex flex-col gap-2.5'>
            <h2 id='titre-etapes' className='text-sm font-semibold'>{t('suivi.etapes')}</h2>
            <ol className='rounded-2xl border border-border bg-card p-4 flex flex-col'>
              {etapes.map((e, i) => {
                const derniere = i === etapes.length - 1
                const actuelle = e.fait && (etapes[i + 1]?.fait === false || derniere)
                return (
                  <li key={e.cle} className='flex gap-3'>
                    <div className='flex flex-col items-center w-5 shrink-0'>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        e.fait
                          ? (e.alerte ? 'bg-destructive text-white' : 'bg-primary text-white')
                          : 'border-2 border-border bg-card'
                      } ${actuelle && !e.alerte ? 'ring-4 ring-primary/15' : ''}`}>
                        {e.fait && <LuCheck size={12} strokeWidth={3} />}
                      </span>
                      {!derniere && <span className={`flex-1 w-0.5 min-h-[28px] ${etapes[i + 1]?.fait ? 'bg-primary' : 'bg-border'}`} />}
                    </div>
                    <div className={`min-w-0 ${derniere ? '' : 'pb-4'}`}>
                      <p className={`text-sm font-semibold ${e.alerte ? 'text-destructive' : e.fait ? 'text-foreground' : 'text-muted-foreground'}`}>{e.titre}</p>
                      <p className='text-xs text-muted-foreground mt-0.5 first-letter:uppercase'>{e.date ? quand(e.date) : e.texte}</p>
                      {e.motif && <p className='text-[13px] text-foreground mt-1.5 rounded-lg bg-destructive/5 border border-destructive/20 px-2.5 py-1.5'>{e.motif}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <section aria-labelledby='titre-envoi' className='flex flex-col gap-2.5'>
            <h2 id='titre-envoi' className='text-sm font-semibold'>{t('suivi.ceQueVousAvezEnvoye')}</h2>
            <div className='rounded-2xl border border-border bg-card p-4 flex flex-col gap-3'>
              {meta.resume && (
                <div>
                  <p className='text-xs text-muted-foreground'>{t('suivi.votreMessage')}</p>
                  <p className='text-sm mt-0.5 whitespace-pre-line'>{meta.resume}</p>
                </div>
              )}
              <Link to={`/view/${meta.id}/${extension}`} className='min-h-[44px] px-3 rounded-xl border border-border flex items-center gap-2.5 text-sm hover:bg-muted/40 transition-colors'>
                <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${tint}`}>{IconeFichier ? <IconeFichier size={13} /> : <LuFileText size={13} />}</span>
                <span className='truncate'>{t('suivi.voirLeDocument')}</span>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default SuiviDemande
