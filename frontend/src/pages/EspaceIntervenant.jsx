import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LuInbox, LuChevronRight, LuCheckCircle2, LuFileText, LuClock } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'
import ViewToggleButtons from '../components/ViewToggleButtons'
import { getDocument, getPartagesRecus } from '../api/routes/document'
import { getCategorie } from '../api/routes/categorie'
import { getTypeDocuments } from '../api/routes/typeDocument'
import { getDisplayName, bordureStatutClass, infoDelaiCorrection } from '../utils/common'
import { getFileTypeVisual } from '../utils/fileTypeIcons'
import { TYPES_DE_DEMANDE, typeDemandeDuDocument, tuilesDuTableauDeBord } from '../constants/typesDemande'
import StatutBadge from '../components/StatutBadge'
import echo from '../utils/echo'

/**
 * Vue d'ensemble pour les comptes "dépôt" (intervenants de terrain,
 * bénéficiaires) : pas d'accès à l'archive générale, seulement un tableau de
 * bord de leurs dossiers (comme les catégories admin, voir Home.jsx) et ce qui
 * leur a été explicitement partagé. Le dépôt lui-même se fait depuis un dossier
 * précis — voir EspaceDossier.jsx, ouvert depuis la sidebar ou une carte ci-dessous.
 */
function EspaceIntervenant() {
  const { t } = useTranslation()
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const currentUserName = getDisplayName(user)

  const [categories, setCategories] = useState([])
  const [typesParCategorie, setTypesParCategorie] = useState({})
  const [mesDepots, setMesDepots] = useState([])
  const [partages, setPartages] = useState([])
  // Grille (cartes) ou liste (lignes compactes à filets fins) — même bascule
  // que sur les pages de dossiers internes (voir ViewToggleButtons.jsx),
  // maintenant disponible partout où une collection de "dossiers" s'affiche.
  const [view, setView] = useState('grid')

  function fetchPartages() {
    getPartagesRecus(20).then(async (res) => {
      if (res.status === 200) setPartages(await res.json())
    }).catch(() => {})
  }

  function fetchMesDepots() {
    getDocument().then(async (res) => {
      if (res.status === 200) {
        const data = await res.json()
        setMesDepots(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      }
    }).catch(() => {})
  }

  useEffect(() => {
    getCategorie().then(async (res) => res.ok && setCategories(await res.json())).catch(() => {})
    fetchPartages()
    fetchMesDepots()
  }, [])

  // Jusqu'ici, "Documents partagés avec moi", les compteurs et "Traités
  // récemment" ne se chargeaient qu'une fois au montage — un partage ou un
  // traitement arrivant pendant que la page reste ouverte n'apparaissait
  // qu'après un rechargement manuel. Le même canal temps réel que la cloche
  // de notifications (voir NotificationBell.jsx) permet de les rafraîchir
  // dès que l'évènement arrive, sans polling dédié.
  useEffect(() => {
    if (!user?.id) return
    let monte = true
    const channel = echo.private(`App.Models.Utilisateurs.${user.id}`)
    channel.notification((notification) => {
      if (!monte) return
      if (notification.type === 'partage' || notification.type === 'transmission_service') {
        fetchPartages()
      }
      if (notification.type === 'statut') {
        fetchMesDepots()
      }
    })
    return () => {
      monte = false
      // Pas de echo.leave() ici : la cloche de notifications (toujours montée
      // dans la Navbar) réutilise ce même canal — le quitter romprait aussi
      // son flux temps réel dès qu'on change de page.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

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

  // `tuile` représente soit un seul dossier (ids: [un id]), soit un groupe
  // fusionné comme "Prestation" (ids: [demander, modifier, annuler]) — voir
  // tuilesDuTableauDeBord() dans typesDemande.js.
  function documentsDuDossier(tuile) {
    if (categories.length === 0 || Object.keys(typesParCategorie).length === 0) return []
    return mesDepots.filter((d) => tuile.ids.includes(typeDemandeDuDocument(d, categories, typesParCategorie)?.id))
  }

  function compterParDossier(tuile) {
    return documentsDuDossier(tuile).length
  }

  // Signale directement sur la carte du dossier (sans avoir à l'ouvrir) qu'une
  // pièce à l'intérieur a été rejetée et attend d'être complétée/corrigée.
  function dossierAUneAlerte(tuile) {
    return documentsDuDossier(tuile).some((d) => d.status_doc === 'INCOMPLET_REJETE')
  }

  // Une fois le délai de correction de 3 jours dépassé, la carte bascule en
  // noir (plus le même niveau d'urgence qu'un rejet tout frais) — voir
  // DocumentStatusService/corrections:relancer côté backend.
  function dossierEnRetard(tuile) {
    return documentsDuDossier(tuile).some((d) => d.status_doc === 'INCOMPLET_REJETE' && infoDelaiCorrection(d)?.enRetard)
  }

  // Visible directement sur le tableau de bord : pas besoin d'ouvrir un
  // dossier pour savoir ce qui a déjà été traité.
  const documentsTraites = mesDepots
    .filter((d) => ['VALIDE_ET_TRAITE', 'ARCHIVE'].includes(d.status_doc))
    .slice(0, 8)

  return (
    <div className='flex flex-col w-full gap-5 py-4 max-w-2xl mx-auto'>
      <div>
        <h1 className='text-xl font-bold'>{t('espaceIntervenant.bonjour', { nom: currentUserName || '' })}</h1>
        <p className='text-sm text-muted-foreground mt-1'>{t('espaceIntervenant.choisissezDossier')}</p>
      </div>

      {/* Même carte icône+chiffre que les stats de Home.jsx (côté interne) —
          juste de la couleur là où il n'y en avait pas, sans rien ajouter
          d'autre à l'écran. */}
      <div className='grid grid-cols-3 gap-2 sm:gap-3'>
        <div className='flex items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 sm:p-3.5'>
          <span className='flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-primary/10 text-primary'>
            <LuFileText size={17} />
          </span>
          <div className='min-w-0'>
            <p className='text-base sm:text-lg font-bold text-foreground leading-none'>{compteurs.total}</p>
            <p className='text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate'>{t('espaceIntervenant.deposes')}</p>
          </div>
        </div>
        <div className='flex items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 sm:p-3.5'>
          <span className='flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-accent/10 text-accent'>
            <LuClock size={17} />
          </span>
          <div className='min-w-0'>
            <p className='text-base sm:text-lg font-bold text-foreground leading-none'>{compteurs.enAttente}</p>
            <p className='text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate'>{t('espaceIntervenant.enAttente')}</p>
          </div>
        </div>
        <div className='flex items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 sm:p-3.5'>
          <span className='flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-green-500/10 text-green-600'>
            <LuCheckCircle2 size={17} />
          </span>
          <div className='min-w-0'>
            <p className='text-base sm:text-lg font-bold text-foreground leading-none'>{compteurs.traites}</p>
            <p className='text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate'>{t('espaceIntervenant.traites')}</p>
          </div>
        </div>
      </div>

      <div>
        <div className='flex items-center justify-between mb-3'>
          <h2 className='text-sm font-semibold'>{t('espaceIntervenant.mesDossiers')}</h2>
          <ViewToggleButtons view={view} setView={setView} />
        </div>

        {view === 'grid' ? (
          <div className='grid sm:grid-cols-2 gap-3'>
            {tuilesDuTableauDeBord(user?.role).map((tuile) => {
              if (tuile.groupe) {
                // 3 parcours autonomes (Créer/Annuler/Qualité de la prestation),
                // regroupés dans un même bloc en surbrillance bleue — même style
                // que le choix d'objet de Réclamation (WizardChoiceCard).
                return (
                  <div key={tuile.id} className='sm:col-span-2 rounded-2xl border border-border bg-card p-4'>
                    <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5'>{t(tuile.label)}</p>
                    <div className='grid grid-cols-3 gap-3'>
                      {tuile.membres.map((membre) => {
                        const MembreIcon = membre.icon
                        return (
                          <Link
                            key={membre.id}
                            to={membre.to}
                            className='flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(27,54,93,0.12)] px-2 py-3 text-center hover:bg-primary/10 transition-colors'
                          >
                            <MembreIcon size={18} className='text-primary' />
                            <span className='text-[11px] font-semibold text-foreground leading-tight'>{t(membre.label)}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              }

              const Icon = tuile.icon
              const nombre = compterParDossier(tuile)
              const alerte = dossierAUneAlerte(tuile)
              const enRetard = dossierEnRetard(tuile)
              return (
                <Link
                  key={tuile.id}
                  to={tuile.to}
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
                    <p className='text-sm font-medium text-foreground truncate'>{t(tuile.label)}</p>
                    <p className={`text-xs mt-0.5 ${enRetard ? 'text-neutral-800 dark:text-neutral-300 font-medium' : alerte ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {enRetard ? t('espaceIntervenant.enRetard') : alerte ? t('espaceIntervenant.aCompleter') : t('espaceIntervenant.nDocuments', { count: nombre })}
                    </p>
                  </div>
                  <LuChevronRight size={16} className='text-muted-foreground shrink-0' />
                </Link>
              )
            })}
          </div>
        ) : (
          // Vue liste : lignes compactes à filets fins plutôt que des cartes —
          // la couleur ne reste qu'un signal (rouge/noir seulement s'il y a
          // vraiment quelque chose à traiter), jamais une décoration systématique.
          <div className='flex flex-col rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden'>
            {tuilesDuTableauDeBord(user?.role).map((tuile) => {
              if (tuile.groupe) {
                // Une tuile groupée (voir tuilesDuTableauDeBord) n'a pas sa propre
                // icône — seuls ses membres en ont une — d'où le crash "Element
                // type is invalid" si on essaie de rendre `tuile.icon` (undefined)
                // directement : on reprend l'icône du premier membre à la place.
                const IconGroupe = tuile.membres[0]?.icon
                // Mêmes mini-cartes (bordure bleue, icône + libellé) que le bloc
                // "Prestation" déjà en place en vue grille — juste redimensionnées
                // pour une ligne de liste — plutôt que des pastilles de texte
                // tassées qui débordaient sur mobile.
                return (
                  <div key={tuile.id} className='flex flex-col gap-2.5 px-3.5 py-3'>
                    <div className='flex items-center gap-3'>
                      <span className='flex items-center justify-center w-9 h-9 rounded-lg bg-primary/5 text-primary shrink-0'>
                        {IconGroupe && <IconGroupe size={16} />}
                      </span>
                      <span className='text-sm font-medium text-foreground'>{t(tuile.label)}</span>
                    </div>
                    <div className='grid grid-cols-3 gap-2'>
                      {tuile.membres.map((membre) => {
                        const MembreIcon = membre.icon
                        return (
                          <Link
                            key={membre.id}
                            to={membre.to}
                            className='flex flex-col items-center gap-1 rounded-xl border-[1.5px] border-primary bg-primary/5 px-1.5 py-2.5 text-center hover:bg-primary/10 transition-colors'
                          >
                            <MembreIcon size={16} className='text-primary' />
                            <span className='text-[10px] font-semibold text-foreground leading-tight'>{t(membre.label)}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              }

              const Icon = tuile.icon
              const nombre = compterParDossier(tuile)
              const alerte = dossierAUneAlerte(tuile)
              const enRetard = dossierEnRetard(tuile)
              return (
                <Link
                  key={tuile.id}
                  to={tuile.to}
                  className='flex items-center gap-3 px-3.5 py-3 hover:bg-muted/40 transition-colors'
                >
                  <span className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                    enRetard ? 'bg-neutral-800/10 text-neutral-800 dark:text-neutral-300' : alerte ? 'bg-destructive/10 text-destructive' : 'bg-primary/5 text-primary'
                  }`}>
                    <Icon size={16} />
                  </span>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium text-foreground truncate'>{t(tuile.label)}</p>
                    <p className={`text-xs mt-0.5 ${enRetard ? 'text-neutral-800 dark:text-neutral-300 font-semibold' : alerte ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                      {enRetard ? t('espaceIntervenant.enRetard') : alerte ? t('espaceIntervenant.aCompleter') : t('espaceIntervenant.nDocuments', { count: nombre })}
                    </p>
                  </div>
                  <LuChevronRight size={15} className='text-muted-foreground/50 shrink-0 ml-auto' />
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <div className='rounded-2xl border border-border bg-card p-5'>
        <h2 className='text-sm font-semibold mb-3 flex items-center gap-1.5'>
          <LuCheckCircle2 size={15} /> {t('espaceIntervenant.traitesRecemment')}
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
          {documentsTraites.length === 0 && <li className='text-sm text-muted-foreground'>{t('espaceIntervenant.rienTraite')}</li>}
        </ul>
      </div>

      <div className='rounded-2xl border border-border bg-card p-5'>
        <h2 className='text-sm font-semibold mb-3 flex items-center gap-1.5'>
          <LuInbox size={15} /> {t('espaceIntervenant.documentsPartages')}
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
                  <div className='font-medium truncate'>{p.shareable?.titre_document || t('espaceIntervenant.document')}</div>
                  <div className='text-xs text-muted-foreground'>{t('espaceIntervenant.partagePar', { nom: p.user?.nom, date: new Date(p.created_at).toLocaleDateString() })}</div>
                </div>
              </li>
            )
          })}
          {partages.length === 0 && <li className='text-sm text-muted-foreground'>{t('espaceIntervenant.aucunPartage')}</li>}
        </ul>
      </div>
    </div>
  )
}

export default EspaceIntervenant
