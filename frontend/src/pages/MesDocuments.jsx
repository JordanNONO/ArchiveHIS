import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LuArrowLeft, LuChevronRight, LuFolderOpen, LuLoader2 } from 'react-icons/lu'
import { getMesPapiers } from '../api/routes/monEspace'
import { libelleDate, pastilleEcheance } from '../utils/mesPapiers'

// Ordre d'affichage des rubriques (voir MonEspaceController::rubrique()).
const RUBRIQUES = ['identite', 'sante', 'contrat', 'attestations', 'autres']

function normaliser(texte) {
  return String(texte || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * « Mes documents » — tout ce qui est classé au nom du salarié (choix
 * explicite 2026-11-22 : tout son dossier), rangé par rubrique, avec la
 * validité des papiers qui expirent.
 */
function MesDocuments() {
  const { t, i18n } = useTranslation()
  const [documents, setDocuments] = useState(null)
  const [recherche, setRecherche] = useState('')

  useEffect(() => {
    getMesPapiers().then(async (res) => {
      setDocuments(res.ok ? (await res.json()).documents : [])
    }).catch(() => setDocuments([]))
  }, [])

  const groupes = useMemo(() => {
    const q = normaliser(recherche.trim())
    const filtres = (documents || []).filter((d) => !q || normaliser(d.titre).includes(q))
    return RUBRIQUES
      .map((r) => ({ rubrique: r, docs: filtres.filter((d) => d.rubrique === r) }))
      .filter((g) => g.docs.length > 0)
  }, [documents, recherche])

  return (
    <div className='flex flex-col w-full gap-5 py-4 max-w-2xl mx-auto'>
      <div>
        <Link to='/' className='inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3'>
          <LuArrowLeft size={13} /> {t('espaceDossier.retourTableauDeBord')}
        </Link>
        <h1 className='text-xl font-bold text-foreground'>{t('mesPapiers.documentsTitre')}</h1>
      </div>

      {documents?.length > 0 && (
        <div className='flex flex-col gap-1.5'>
          <label htmlFor='recherche-mes-documents' className='text-[13px] font-medium text-muted-foreground'>{t('mesPapiers.rechercher')}</label>
          <input
            id='recherche-mes-documents'
            type='search'
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('mesPapiers.rechercherExemple')}
            className='h-11 px-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
          />
        </div>
      )}

      {documents === null && (
        <div className='flex justify-center py-10'><LuLoader2 className='animate-spin text-muted-foreground' size={22} /></div>
      )}

      {documents?.length === 0 && (
        <div className='rounded-2xl border border-border bg-card p-6 flex flex-col items-center text-center gap-2'>
          <LuFolderOpen size={22} className='text-muted-foreground' />
          <p className='text-sm font-medium'>{t('mesPapiers.aucunDocument')}</p>
          <p className='text-[13px] text-muted-foreground'>{t('mesPapiers.aucunDocumentTexte')}</p>
        </div>
      )}

      {documents?.length > 0 && groupes.length === 0 && (
        <p className='text-sm text-muted-foreground'>{t('mesPapiers.aucunResultat')}</p>
      )}

      {groupes.map(({ rubrique, docs }) => (
        <section key={rubrique} aria-labelledby={`rubrique-${rubrique}`} className='flex flex-col gap-2'>
          <h2 id={`rubrique-${rubrique}`} className='text-[13px] font-semibold text-muted-foreground'>{t(`mesPapiers.rubriques.${rubrique}`)}</h2>
          <ul className='flex flex-col rounded-2xl border border-border bg-card divide-y divide-border'>
            {docs.map((d) => {
              const pastille = pastilleEcheance(d)
              return (
                <li key={d.id}>
                  <Link to={`/view/${d.id}/${d.extension}`} className='min-h-[60px] flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/40 transition-colors'>
                    <span className='min-w-0 flex-1'>
                      <span className='block text-sm font-medium text-foreground truncate'>{d.titre}</span>
                      <span className='block text-xs text-muted-foreground mt-0.5'>{t('mesPapiers.classeLe', { date: libelleDate(d.date, i18n.language) })}</span>
                    </span>
                    {pastille && (
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${pastille.classes}`}>{t(pastille.cle, pastille.params)}</span>
                    )}
                    <LuChevronRight size={16} className='text-muted-foreground shrink-0' />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {documents?.length > 0 && (
        <p className='text-xs text-muted-foreground'>{t('mesPapiers.documentsNote')}</p>
      )}
    </div>
  )
}

export default MesDocuments
