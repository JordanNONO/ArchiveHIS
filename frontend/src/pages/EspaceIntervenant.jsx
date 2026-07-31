import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LuInbox, LuChevronRight, LuCheckCircle2 } from 'react-icons/lu'
import { getDocument, getPartagesRecus } from '../api/routes/document'
import { getCategorie } from '../api/routes/categorie'
import { getTypeDocuments } from '../api/routes/typeDocument'
import { getDisplayName, bordureStatutClass, infoDelaiCorrection } from '../utils/common'
import { getFileTypeVisual } from '../utils/fileTypeIcons'
import { TYPES_DE_DEMANDE, typeDemandeDuDocument } from '../constants/typesDemande'
import StatutBadge from '../components/StatutBadge'

/**
 * Vue d'ensemble pour les comptes "dépôt" (intervenants de terrain,
 * bénéficiaires) : pas d'accès à l'archive générale, seulement un tableau de
 * bord de leurs dossiers (comme les catégories admin, voir Home.jsx) et ce qui
 * leur a été explicitement partagé. Le dépôt lui-même se fait depuis un dossier
 * précis — voir EspaceDossier.jsx, ouvert depuis la sidebar ou une carte ci-dessous.
 */
function EspaceIntervenant() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const currentUserName = getDisplayName(user)

  const [categories, setCategories] = useState([])
  const [typesParCategorie, setTypesParCategorie] = useState({})
  const [mesDepots, setMesDepots] = useState([])
  const [partages, setPartages] = useState([])

  useEffect(() => {
    getCategorie().then(async (res) => res.ok && setCategories(await res.json())).catch(() => {})
    getPartagesRecus(20).then(async (res) => {
      if (res.status === 200) setPartages(await res.json())
    }).catch(() => {})
    getDocument().then(async (res) => {
      if (res.status === 200) {
        const data = await res.json()
        setMesDepots(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      }
    }).catch(() => {})
  }, [])

  // Précharge les types de chaque catégorie utilisée par TYPES_DE_DEMANDE, une
  // seule fois, pour pouvoir compter les dépôts par dossier.
  useEffect(() => {
    if (categories.length === 0) return
    const codes = [...new Set(TYPES_DE_DEMANDE.map((t) => t.categorieCode))]
    codes.forEach((code) => {
      const categorie = categories.find((c) => c.code === code)
      if (!categorie) return
      getTypeDocuments(categorie.id).then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setTypesParCategorie((prev) => ({ ...prev, [code]: data }))
        }
      }).catch(() => {})
    })
  }, [categories])

  const compteurs = {
    total: mesDepots.length,
    enAttente: mesDepots.filter((d) => ['SOUMIS', 'TRANSMIS_AU_SERVICE', 'EN_COURS_DE_TRAITEMENT'].includes(d.status_doc)).length,
    traites: mesDepots.filter((d) => ['VALIDE_ET_TRAITE', 'ARCHIVE'].includes(d.status_doc)).length,
  }

  function documentsDuDossier(demande) {
    if (categories.length === 0 || Object.keys(typesParCategorie).length === 0) return []
    return mesDepots.filter((d) => typeDemandeDuDocument(d, categories, typesParCategorie)?.id === demande.id)
  }

  function compterParDossier(demande) {
    return documentsDuDossier(demande).length
  }

  // Signale directement sur la carte du dossier (sans avoir à l'ouvrir) qu'une
  // pièce à l'intérieur a été rejetée et attend d'être complétée/corrigée.
  function dossierAUneAlerte(demande) {
    return documentsDuDossier(demande).some((d) => d.status_doc === 'INCOMPLET_REJETE')
  }

  // Une fois le délai de correction de 3 jours dépassé, la carte bascule en
  // noir (plus le même niveau d'urgence qu'un rejet tout frais) — voir
  // DocumentStatusService/corrections:relancer côté backend.
  function dossierEnRetard(demande) {
    return documentsDuDossier(demande).some((d) => d.status_doc === 'INCOMPLET_REJETE' && infoDelaiCorrection(d)?.enRetard)
  }

  // Visible directement sur le tableau de bord : pas besoin d'ouvrir un
  // dossier pour savoir ce qui a déjà été traité.
  const documentsTraites = mesDepots
    .filter((d) => ['VALIDE_ET_TRAITE', 'ARCHIVE'].includes(d.status_doc))
    .slice(0, 8)

  return (
    <div className='flex flex-col w-full gap-5 py-4 max-w-2xl mx-auto'>
      <div>
        <h1 className='text-xl font-bold'>Bonjour {currentUserName || ''}</h1>
        <p className='text-sm text-muted-foreground mt-1'>Choisissez un dossier pour déposer une pièce ou voir ce que vous avez déjà envoyé.</p>
      </div>

      <div className='grid grid-cols-3 gap-2 sm:gap-3'>
        <div className='rounded-xl border border-border bg-card p-2.5 sm:p-3.5 text-center'>
          <div className='text-lg sm:text-xl font-bold text-foreground'>{compteurs.total}</div>
          <div className='text-[11px] sm:text-xs text-muted-foreground mt-0.5'>Déposés</div>
        </div>
        <div className='rounded-xl border border-border bg-card p-2.5 sm:p-3.5 text-center'>
          <div className='text-lg sm:text-xl font-bold text-accent-foreground'>{compteurs.enAttente}</div>
          <div className='text-[11px] sm:text-xs text-muted-foreground mt-0.5'>En attente</div>
        </div>
        <div className='rounded-xl border border-border bg-card p-2.5 sm:p-3.5 text-center'>
          <div className='text-lg sm:text-xl font-bold text-green-600'>{compteurs.traites}</div>
          <div className='text-[11px] sm:text-xs text-muted-foreground mt-0.5'>Traités</div>
        </div>
      </div>

      <div>
        <h2 className='text-sm font-semibold mb-3'>Mes dossiers</h2>
        <div className='grid sm:grid-cols-2 gap-3'>
          {TYPES_DE_DEMANDE.map((demande) => {
            const Icon = demande.icon
            const nombre = compterParDossier(demande)
            const alerte = dossierAUneAlerte(demande)
            const enRetard = dossierEnRetard(demande)
            return (
              <Link
                key={demande.id}
                to={`/espace/${demande.id}`}
                className={`flex items-center gap-3 rounded-2xl border bg-card p-4 hover:shadow-md transition-all duration-200 ${
                  enRetard ? 'border-neutral-800' : alerte ? 'border-destructive animate-scintille-rejet' : 'border-border hover:border-primary/40'
                }`}
              >
                <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${
                  enRetard ? 'bg-neutral-800/10 text-neutral-800 dark:text-neutral-300' : alerte ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                }`}>
                  <Icon size={19} />
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium text-foreground truncate'>{demande.label}</p>
                  <p className={`text-xs mt-0.5 ${enRetard ? 'text-neutral-800 dark:text-neutral-300 font-medium' : alerte ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {enRetard ? 'En retard' : alerte ? 'À compléter' : `${nombre} document${nombre !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <LuChevronRight size={16} className='text-muted-foreground shrink-0' />
              </Link>
            )
          })}
        </div>
      </div>

      <div className='rounded-2xl border border-border bg-card p-5'>
        <h2 className='text-sm font-semibold mb-3 flex items-center gap-1.5'>
          <LuCheckCircle2 size={15} /> Traités récemment
        </h2>
        <ul className='flex flex-col gap-2'>
          {documentsTraites.map((d) => {
            const { icon: Icon, tint } = getFileTypeVisual(d.chemin_stockage_serveur)
            const extension = String(d.chemin_stockage_serveur || '').split('.').pop()
            return (
              <Link
                key={d.id}
                to={`/view/${d.id}/${extension}`}
                className={`flex items-center gap-3 text-sm border border-border rounded-lg px-3 py-2.5 hover:bg-muted/60 transition-colors ${bordureStatutClass(d.status_doc, true)}`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
                  <Icon size={14} />
                </span>
                <div className='min-w-0 flex-1'>
                  <div className='font-medium truncate'>{d.titre_document}</div>
                  <div className='text-xs text-muted-foreground'>{new Date(d.updated_at || d.created_at).toLocaleDateString()}</div>
                </div>
                <StatutBadge statut={d.status_doc} externe className='!px-1.5 !py-0.5 !text-[10px] shrink-0' />
              </Link>
            )
          })}
          {documentsTraites.length === 0 && <li className='text-sm text-muted-foreground'>Rien de traité pour l\'instant</li>}
        </ul>
      </div>

      <div className='rounded-2xl border border-border bg-card p-5'>
        <h2 className='text-sm font-semibold mb-3 flex items-center gap-1.5'>
          <LuInbox size={15} /> Documents partagés avec moi
        </h2>
        <ul className='flex flex-col gap-2'>
          {partages.map((p) => {
            const { icon: Icon, tint } = getFileTypeVisual(p.shareable?.chemin_stockage_serveur)
            return (
              <li key={p.id} className='flex items-center gap-3 text-sm border border-border rounded-lg px-3 py-2.5'>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
                  <Icon size={14} />
                </span>
                <div className='min-w-0'>
                  <div className='font-medium truncate'>{p.shareable?.titre_document || 'Document'}</div>
                  <div className='text-xs text-muted-foreground'>Partagé par {p.user?.nom} — {new Date(p.created_at).toLocaleDateString()}</div>
                </div>
              </li>
            )
          })}
          {partages.length === 0 && <li className='text-sm text-muted-foreground'>Aucun document partagé pour l'instant</li>}
        </ul>
      </div>
    </div>
  )
}

export default EspaceIntervenant
