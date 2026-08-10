import React, { useRef, useState } from 'react';
import { LuPlus, LuChevronDown, LuSearch, LuArrowUpDown, LuFilter, LuPin, LuPinOff, LuShare2, LuDownload, LuRefreshCw, LuMinimize2, LuLayoutGrid, LuMaximize2, LuEye, LuEyeOff, LuLock, LuUnlock, LuInfo, LuPanelRight, LuMoreHorizontal } from 'react-icons/lu';
import Breadcrumbs from './Breadcrumbs';
import ViewToggleButtons from './ViewToggleButtons';

const DENSITES = [
  { valeur: 'compact', icon: LuMinimize2, titre: 'Tuiles compactes' },
  { valeur: 'normal', icon: LuLayoutGrid, titre: 'Tuiles normales' },
  { valeur: 'grand', icon: LuMaximize2, titre: 'Grandes tuiles' },
];

/**
 * Barre d'outils unique sous la navbar, réutilisée par Home.jsx et
 * OpenFolder.jsx (racine et à l'intérieur d'un dossier) plutôt que chaque
 * page ne redéfinisse sa propre rangée de boutons à un endroit différent.
 * Chaque section n'apparaît que si l'appelant fournit les props
 * correspondantes — c'est ce qui donne naturellement une version "allégée"
 * à Home.jsx (pas d'Épingler/Partager, pas de dossier courant à cibler) et
 * une version complète à OpenFolder.jsx.
 *
 * Deux rendus distincts plutôt qu'un seul redimensionné : au-delà d'une
 * poignée d'icônes, tout finissait par passer à la ligne sur mobile (liste
 * de courses illisible). En dessous du seuil `sm`, seuls Nouveau/Recherche/
 * "⋯"/grille-liste restent visibles ; le reste (Trier, Filtrer, Épingler...)
 * part dans une feuille qui remonte du bas, avec de vraies étiquettes.
 */
function DossierToolbar({
  where,
  backTo,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  actionsNouveau = [],
  tri,
  setTri,
  optionsTri = [],
  filtreStatut,
  setFiltreStatut,
  masquerVides,
  setMasquerVides,
  densite,
  setDensite,
  estEpingle,
  onToggleEpingle,
  estVerrouille,
  onToggleVerrouille,
  onPartager,
  onTelecharger,
  onInfos,
  onActualiser,
  apercuActif,
  onToggleApercu,
  extra,
  view,
  setView,
}) {
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const feuilleRef = useRef(null);

  const aDesActionsSecondaires = !!(
    (setTri && optionsTri.length > 0) || setFiltreStatut || setMasquerVides || (setDensite && view === 'grid')
    || onToggleEpingle || onToggleVerrouille || onPartager || onTelecharger || onInfos || onActualiser || onToggleApercu || extra
  );

  const boutonNouveauUnique = actionsNouveau.length === 1 && (
    <button
      onClick={actionsNouveau[0].onClick}
      className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors shrink-0'
    >
      <LuPlus size={16} /> {actionsNouveau[0].label}
    </button>
  );

  const boutonNouveauMenu = actionsNouveau.length > 1 && (
    <div className='dropdown'>
      <button
        tabIndex={0}
        className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors shrink-0'
      >
        <LuPlus size={16} /> Nouveau <LuChevronDown size={13} className='opacity-70' />
      </button>
      <ul tabIndex={0} className='dropdown-content menu bg-card border border-border rounded-xl z-10 w-56 p-1.5 shadow-lg mt-1'>
        {actionsNouveau.map((action, k) => (
          <li key={k}>
            <button onClick={action.onClick} className='rounded-lg flex items-center gap-2'>
              {action.icon && <action.icon size={15} />} {action.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      {/* Desktop / tablette — toutes les actions sur une seule barre. */}
      <div className='hidden sm:flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-2.5 mb-6'>
        {where && <Breadcrumbs where={where} backTo={backTo} />}

        {boutonNouveauUnique}
        {boutonNouveauMenu}

        <div className='flex-1 min-w-[140px]' />

        {onSearchChange && (
          <div className='relative w-full sm:w-56 order-last sm:order-none'>
            <LuSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={15} />
            <input
              type='text'
              value={searchValue}
              onChange={onSearchChange}
              className='w-full rounded-lg bg-muted border-none pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow'
              placeholder={searchPlaceholder}
              title='Astuce : "phrase exacte" entre guillemets, mot1 OU mot2 — fautes de frappe tolérées'
            />
          </div>
        )}

        {setTri && optionsTri.length > 0 && (
          <div className='flex items-center gap-1.5 text-muted-foreground shrink-0'>
            <LuArrowUpDown size={15} />
            <select
              value={tri}
              onChange={(e) => setTri(e.target.value)}
              className='select select-bordered select-sm rounded-lg text-sm font-normal'
              title='Trier'
            >
              {optionsTri.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {setFiltreStatut && (
          <div className='flex items-center gap-1.5 text-muted-foreground shrink-0'>
            <LuFilter size={15} />
            <select
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value)}
              className='select select-bordered select-sm rounded-lg text-sm font-normal'
              title='Filtrer par statut'
            >
              <option value='tous'>Tous les statuts</option>
              <option value='attention'>À traiter</option>
              <option value='en_cours'>Pas encore traités</option>
              <option value='traite'>Traités</option>
            </select>
          </div>
        )}

        {setMasquerVides && (
          <button
            onClick={() => setMasquerVides((v) => !v)}
            title={masquerVides ? 'Afficher les dossiers vides' : 'Masquer les dossiers vides'}
            className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${masquerVides ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            {masquerVides ? <LuEyeOff size={16} /> : <LuEye size={16} />}
          </button>
        )}

        {setDensite && view === 'grid' && (
          <div className='flex items-center gap-1 rounded-lg bg-muted p-1 shrink-0'>
            {DENSITES.map((d) => (
              <button
                key={d.valeur}
                onClick={() => setDensite(d.valeur)}
                title={d.titre}
                className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${densite === d.valeur ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <d.icon size={14} />
              </button>
            ))}
          </div>
        )}

        {onToggleEpingle && (
          <button
            onClick={onToggleEpingle}
            title={estEpingle ? 'Retirer des favoris' : 'Épingler ce dossier'}
            className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${estEpingle ? 'bg-accent/15 text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            {estEpingle ? <LuPinOff size={16} /> : <LuPin size={16} />}
          </button>
        )}

        {onPartager && (
          <button
            onClick={onPartager}
            title='Partager le dossier'
            className='flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0'
          >
            <LuShare2 size={16} />
          </button>
        )}

        {onTelecharger && (
          <button
            onClick={onTelecharger}
            title='Télécharger le dossier'
            className='flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0'
          >
            <LuDownload size={16} />
          </button>
        )}

        {onToggleVerrouille && (
          <button
            onClick={onToggleVerrouille}
            title={estVerrouille ? 'Déverrouiller le dossier' : 'Verrouiller le dossier (gel administratif)'}
            className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${estVerrouille ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            {estVerrouille ? <LuLock size={16} /> : <LuUnlock size={16} />}
          </button>
        )}

        {onInfos && (
          <button
            onClick={onInfos}
            title='Informations du dossier'
            className='flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0'
          >
            <LuInfo size={16} />
          </button>
        )}

        {onActualiser && (
          <button
            onClick={onActualiser}
            title='Actualiser'
            className='flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0'
          >
            <LuRefreshCw size={16} />
          </button>
        )}

        {onToggleApercu && (
          <button
            onClick={onToggleApercu}
            title="Panneau d'aperçu"
            className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${apercuActif ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <LuPanelRight size={16} />
          </button>
        )}

        {extra}

        {setView && (
          <>
            <div className='w-px h-6 bg-border shrink-0' />
            <ViewToggleButtons view={view} setView={setView} />
          </>
        )}
      </div>

      {/* Mobile — barre compacte (Nouveau, recherche, "⋯", grille/liste) ; le
          reste des actions part dans la feuille du bas ouverte par "⋯". */}
      <div className='sm:hidden rounded-2xl border border-border bg-card px-3 py-2 mb-6'>
        <div className='flex items-center gap-2'>
          {boutonNouveauUnique}
          {boutonNouveauMenu}

          <div className='flex-1' />

          {onSearchChange && (
            <button
              onClick={() => setRechercheOuverte((v) => !v)}
              title='Rechercher'
              className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors ${rechercheOuverte ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <LuSearch size={16} />
            </button>
          )}

          {aDesActionsSecondaires && (
            <button
              onClick={() => feuilleRef.current?.showModal()}
              title="Plus d'actions"
              className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0'
            >
              <LuMoreHorizontal size={17} />
            </button>
          )}

          {setView && <ViewToggleButtons view={view} setView={setView} />}
        </div>

        {onSearchChange && rechercheOuverte && (
          <div className='relative mt-2'>
            <LuSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={15} />
            <input
              type='text'
              value={searchValue}
              onChange={onSearchChange}
              autoFocus
              className='w-full rounded-lg bg-muted border-none pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
              placeholder={searchPlaceholder}
            />
          </div>
        )}
      </div>

      {/* Feuille du bas (mobile uniquement) — mêmes actions que la barre
          desktop, en liste avec étiquettes plutôt qu'en icônes à deviner. */}
      <dialog ref={feuilleRef} className='modal modal-bottom sm:hidden'>
        <div className='modal-box rounded-t-2xl rounded-b-none px-2 pb-4 max-h-[75vh]'>
          <div className='w-9 h-1 rounded-full bg-border mx-auto mb-3 mt-1' />
          <ul className='flex flex-col'>
            {setTri && optionsTri.length > 0 && (
              <li className='flex items-center gap-3 px-2.5 py-2'>
                <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground shrink-0'><LuArrowUpDown size={15} /></span>
                <select
                  value={tri}
                  onChange={(e) => setTri(e.target.value)}
                  className='select select-bordered select-sm rounded-lg text-sm flex-1'
                >
                  {optionsTri.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </li>
            )}
            {setFiltreStatut && (
              <li className='flex items-center gap-3 px-2.5 py-2'>
                <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground shrink-0'><LuFilter size={15} /></span>
                <select
                  value={filtreStatut}
                  onChange={(e) => setFiltreStatut(e.target.value)}
                  className='select select-bordered select-sm rounded-lg text-sm flex-1'
                >
                  <option value='tous'>Tous les statuts</option>
                  <option value='attention'>À traiter</option>
                  <option value='en_cours'>Pas encore traités</option>
                  <option value='traite'>Traités</option>
                </select>
              </li>
            )}
            {setMasquerVides && (
              <li>
                <button onClick={() => setMasquerVides((v) => !v)} className='flex items-center gap-3 px-2.5 py-2.5 w-full text-left'>
                  <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${masquerVides ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {masquerVides ? <LuEyeOff size={15} /> : <LuEye size={15} />}
                  </span>
                  <span className='text-sm font-medium flex-1'>{masquerVides ? 'Afficher les dossiers vides' : 'Masquer les dossiers vides'}</span>
                </button>
              </li>
            )}
            {setDensite && view === 'grid' && (
              <li className='flex items-center gap-3 px-2.5 py-2'>
                <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground shrink-0'><LuLayoutGrid size={15} /></span>
                <span className='text-sm font-medium flex-1'>Taille des tuiles</span>
                <div className='flex items-center gap-1 rounded-lg bg-muted p-1'>
                  {DENSITES.map((d) => (
                    <button
                      key={d.valeur}
                      onClick={() => setDensite(d.valeur)}
                      className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${densite === d.valeur ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
                    >
                      <d.icon size={14} />
                    </button>
                  ))}
                </div>
              </li>
            )}
            {onToggleEpingle && (
              <li>
                <button onClick={onToggleEpingle} className='flex items-center gap-3 px-2.5 py-2.5 w-full text-left'>
                  <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${estEpingle ? 'bg-accent/15 text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {estEpingle ? <LuPinOff size={15} /> : <LuPin size={15} />}
                  </span>
                  <span className='text-sm font-medium'>{estEpingle ? 'Retirer des favoris' : 'Épingler ce dossier'}</span>
                </button>
              </li>
            )}
            {onToggleVerrouille && (
              <li>
                <button onClick={onToggleVerrouille} className='flex items-center gap-3 px-2.5 py-2.5 w-full text-left'>
                  <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${estVerrouille ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                    {estVerrouille ? <LuLock size={15} /> : <LuUnlock size={15} />}
                  </span>
                  <span className='text-sm font-medium'>{estVerrouille ? 'Déverrouiller le dossier' : 'Verrouiller le dossier'}</span>
                </button>
              </li>
            )}
            {onPartager && (
              <li>
                <button onClick={onPartager} className='flex items-center gap-3 px-2.5 py-2.5 w-full text-left'>
                  <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground shrink-0'><LuShare2 size={15} /></span>
                  <span className='text-sm font-medium'>Partager le dossier</span>
                </button>
              </li>
            )}
            {onTelecharger && (
              <li>
                <button onClick={onTelecharger} className='flex items-center gap-3 px-2.5 py-2.5 w-full text-left'>
                  <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground shrink-0'><LuDownload size={15} /></span>
                  <span className='text-sm font-medium'>Télécharger le dossier</span>
                </button>
              </li>
            )}
            {onInfos && (
              <li>
                <button onClick={onInfos} className='flex items-center gap-3 px-2.5 py-2.5 w-full text-left'>
                  <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground shrink-0'><LuInfo size={15} /></span>
                  <span className='text-sm font-medium'>Informations du dossier</span>
                </button>
              </li>
            )}
            {onActualiser && (
              <li>
                <button onClick={onActualiser} className='flex items-center gap-3 px-2.5 py-2.5 w-full text-left'>
                  <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground shrink-0'><LuRefreshCw size={15} /></span>
                  <span className='text-sm font-medium'>Actualiser</span>
                </button>
              </li>
            )}
            {onToggleApercu && (
              <li>
                <button onClick={onToggleApercu} className='flex items-center gap-3 px-2.5 py-2.5 w-full text-left'>
                  <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${apercuActif ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <LuPanelRight size={15} />
                  </span>
                  <span className='text-sm font-medium'>Panneau d&apos;aperçu</span>
                </button>
              </li>
            )}
            {extra && <li className='flex items-center gap-3 px-2.5 py-2'>{extra}</li>}
          </ul>
        </div>
        <form method='dialog' className='modal-backdrop'>
          <button>fermer</button>
        </form>
      </dialog>
    </>
  );
}

export default DossierToolbar;
