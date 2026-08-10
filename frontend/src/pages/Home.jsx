import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuBookOpen, LuFileEdit, LuFolder, LuFolderSearch, LuShare2, LuTrash2, LuMoreVertical, LuFileText, LuAlertCircle, LuCheckCircle2, LuClock, LuArchive, LuDownload, LuPin, LuPinOff, LuLock, LuUnlock, LuInfo, LuCheck } from 'react-icons/lu';
import { IoClose } from 'react-icons/io5';
import { toast } from 'react-toastify';
import Cards from '../components/fragments/Cards';
import Breadcrumbs from '../components/Breadcrumbs';
import DossierToolbar from '../components/DossierToolbar';
import ShareFolderModal from '../components/ShareFolderModal';
import InfoDossierModal from '../components/InfoDossierModal';
import BulkFolderActionBar from '../components/BulkFolderActionBar';
import { createCategorie, deleteCategorieById, downloadCategorie, favoriCategorie, defavoriCategorie, verrouillerCategorie, deverrouillerCategorie, getCategorie, updateCatgory } from '../api/routes/categorie';
import { getDocument, getDocumentsATraiter } from '../api/routes/document';
import { getFileTypeVisual } from '../utils/fileTypeIcons';
import { getDisplayName } from '../utils/common';
import { correspondARequete } from '../utils/recherche';
import { toneDossier } from '../utils/statutGroupe';
import { DENSITE_HAUTEUR, DENSITE_COLS } from '../utils/densite';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuShortcut } from '../ui/ui/context-menu';
import { useConfirm } from '../contexts/ConfirmDialogContext';

/**
 * Le statut agrégé d'un dossier, façon feu tricolore — même règle de
 * priorité que toneDossier() (partagée avec OpenFolder.jsx), juste
 * alimentée par les compteurs déjà renvoyés par l'API catégories.
 */
function getFolderBadgeTone(dossier) {
  return toneDossier({
    enAttente: dossier.documents_attention_count ?? 0,
    enCours: dossier.documents_en_cours_count ?? 0,
    traites: dossier.documents_traites_count ?? 0,
  });
}

/**
 * Une case dossier, en grille (carte) ou en liste (ligne à filet fin) — même
 * bascule que sur les pages de dossiers (voir ViewToggleButtons.jsx). Le
 * menu contextuel (clic droit), le menu "⋮" tactile et la boîte de
 * renommage restent identiques quelle que soit la vue : seule la carte
 * cliquable elle-même change de forme.
 */
function FolderTile({
  dossier, vue, canManage, hauteurClasse,
  onDownload, onRename, onDelete, onEditChange, onEditSubmit, onToggleFavori, onPartager, onToggleVerrouille, onInfos,
  selectionActive, selected, onToggleSelect,
}) {
  const navigate = useNavigate();
  const tone = getFolderBadgeTone(dossier);
  const count = dossier.document_archives_count ?? 0;
  const estVerrouille = dossier.verrouille_par_utilisateur_id != null;
  const clicTuile = (e) => {
    if (selectionActive) {
      e.preventDefault();
      onToggleSelect();
    }
  };
  const caseSelection = selectionActive && (
    <span
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(); }}
      className={`absolute top-1.5 left-1.5 z-10 flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors ${selected ? 'bg-primary border-primary' : 'bg-card border-border'}`}
    >
      {selected && <LuCheck size={12} className='text-white' />}
    </span>
  );
  return (
    <div className='relative group'>
      <ContextMenu>
        <ContextMenuTrigger>
          {vue === 'grid' ? (
            <Link
              to={'folder/' + dossier.id}
              onClick={clicTuile}
              className={`relative flex flex-col gap-2.5 ${hauteurClasse} overflow-hidden rounded-2xl border border-border border-l-4 ${tone.bordure} bg-card p-4 text-left hover:shadow-md transition-all duration-200`}
            >
              {caseSelection}
              {/* pr-6 : dégage la place du bouton "⋮" (menu contextuel tactile),
                  positionné en absolu dans ce même coin — sans ça le badge
                  passe dessous et le texte se fait couper par l'icône. */}
              <div className='flex items-start justify-between gap-2 pr-6'>
                <span className='flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0'>
                  <LuFolder size={17} strokeWidth={1.75} />
                </span>
                <span className='text-[11px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0'>
                  {count} document{count !== 1 ? 's' : ''}
                </span>
              </div>
              <span className='flex items-center gap-1.5 text-sm font-semibold text-foreground'>
                {estVerrouille && <LuLock size={12} className='text-destructive shrink-0' />}
                {dossier.is_favorite && <LuPin size={12} className='text-accent shrink-0' />}
                <span className='line-clamp-3'>{dossier.libelle_cat}</span>
              </span>
              <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${tone.texte}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.point}`} />
                <span className='truncate'>{tone.label}</span>
              </span>
            </Link>
          ) : (
            <Link
              to={'folder/' + dossier.id}
              onClick={clicTuile}
              className='relative flex items-center gap-3 pr-11 pl-3.5 py-3 hover:bg-muted/40 transition-colors'
            >
              {selectionActive && <span className='shrink-0'>{caseSelection}</span>}
              <span className={`flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0 ${selectionActive ? 'ml-5' : ''}`}>
                <LuFolder size={16} strokeWidth={1.75} />
              </span>
              <div className='min-w-0 flex-1'>
                <p className='flex items-center gap-1.5 text-sm font-medium text-foreground truncate'>
                  {estVerrouille && <LuLock size={12} className='text-destructive shrink-0' />}
                  {dossier.is_favorite && <LuPin size={12} className='text-accent shrink-0' />}
                  <span className='truncate'>{dossier.libelle_cat}</span>
                </p>
                <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${tone.texte}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.point}`} />
                  <span className='truncate'>{count} document{count !== 1 ? 's' : ''} · {tone.label}</span>
                </p>
              </div>
            </Link>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuItem inset className="cursor-pointer" onClick={() => navigate('folder/' + dossier.id)}>
            Ouvrir le dossier
            <ContextMenuShortcut><LuBookOpen /></ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onInfos}>
            Informations
            <ContextMenuShortcut><LuInfo /></ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onDownload}>
            Télécharger le dossier
            <ContextMenuShortcut><LuDownload /></ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onToggleFavori}>
            {dossier.is_favorite ? 'Retirer des favoris' : 'Épingler en favori'}
            <ContextMenuShortcut>{dossier.is_favorite ? <LuPinOff /> : <LuPin />}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onPartager}>
            Partager le dossier
            <ContextMenuShortcut><LuShare2 /></ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onToggleVerrouille} disabled={!canManage}>
            {estVerrouille ? 'Déverrouiller le dossier' : 'Verrouiller le dossier'}
            <ContextMenuShortcut>{estVerrouille ? <LuUnlock /> : <LuLock />}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onRename} disabled={!canManage || estVerrouille}>
            Renommer le dossier
            <ContextMenuShortcut><LuFileEdit /></ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem disabled={!canManage || estVerrouille} onClick={onDelete} inset className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer">
            <div>
              Supprimer le dossier
            </div>
            <ContextMenuShortcut><LuTrash2 /></ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Menu d'actions toujours accessible (le clic-droit ne fonctionne pas au toucher) */}
      <div className='dropdown dropdown-end absolute top-1.5 right-1.5 z-10'>
        <button
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          className='flex items-center justify-center w-7 h-7 rounded-lg bg-card/90 text-muted-foreground opacity-70 hover:opacity-100 hover:bg-muted hover:text-foreground transition-all'
        >
          <LuMoreVertical size={14} />
        </button>
        <div tabIndex={0} className='dropdown-content flex items-center gap-1 bg-card border border-border rounded-xl z-20 p-1.5 shadow-lg mt-1'>
          <Link to={'folder/' + dossier.id} title="Ouvrir le dossier" className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
            <LuBookOpen size={15} />
          </Link>
          <button title="Informations" onClick={onInfos} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
            <LuInfo size={15} />
          </button>
          <button title="Partager le dossier" onClick={onPartager} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
            <LuShare2 size={15} />
          </button>
          <button title={estVerrouille ? 'Déverrouiller le dossier' : 'Verrouiller le dossier'} disabled={!canManage} onClick={onToggleVerrouille} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
            {estVerrouille ? <LuUnlock size={15} /> : <LuLock size={15} />}
          </button>
          <button title="Renommer le dossier" disabled={!canManage || estVerrouille} onClick={onRename} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
            <LuFileEdit size={15} />
          </button>
          <button
            title="Supprimer le dossier"
            disabled={!canManage || estVerrouille}
            onClick={onDelete}
            className='flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
          >
            <LuTrash2 size={15} />
          </button>
        </div>
      </div>

      <dialog id={"edit_folder" + dossier.id} className="modal">
        <div className="modal-box rounded-2xl">
          <form method="dialog" className='flex justify-end'>
            <button className="btn btn-sm btn-ghost btn-circle">✕</button>
          </form>
          <h1 className='text-lg font-semibold mb-4'>
            Modifier le nom du dossier ({dossier.libelle_cat})
          </h1>
          <form onSubmit={onEditSubmit}>
            <div className="mb-4">
              <label htmlFor={"name" + dossier.id} className='block text-sm font-medium mb-1.5'>Nom du dossier</label>
              <input
                type="text"
                id={"name" + dossier.id}
                name='label'
                onChange={onEditChange}
                placeholder={dossier.libelle_cat}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="modal-action">
              <button className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>Modifier</button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}

function Home() {
  const confirm = useConfirm();
  const [dossiers, setDossiers] = useState([]);
  const [tousLesDocuments, setTousLesDocuments] = useState([]);
  const [folderData, setFolderData] = useState({ label: '' });
  const [searchValue, setSearchValue] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [documentsTrouves, setDocumentsTrouves] = useState([]);
  const [user, setUser] = useState();
  const [aTraiter, setATraiter] = useState({ en_attente: [], a_purger: [] });
  const [showATraiter, setShowATraiter] = useState(true);
  const [view, setView] = useState('grid');
  const [tri, setTri] = useState('nom');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [shareFolder, setShareFolder] = useState(null);
  const [densite, setDensite] = useState('normal');
  const [masquerVides, setMasquerVides] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [infoDossier, setInfoDossier] = useState(null);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function deleteFolder(id){
    deleteCategorieById(id).then(function(res){
      if (res.status===200) {
        fetchFolders()
        toast.success("Dossier supprimer avec succès")
      }
    })
  }

  async function confirmDeleteFolder(dossier){
    if (await confirm({ message: `Supprimer le dossier « ${dossier.libelle_cat} » ? Cette action n'est pas rétroactive.`, danger: true })) {
      deleteFolder(dossier.id)
    }
  }

  function demanderTelechargement(id){
    downloadCategorie(id).then(async (res) => {
      if (res.status === 202) {
        toast.success('Préparation du dossier en cours, vous serez notifié quand il sera prêt.')
      } else {
        const data = await res.json()
        toast.error(data?.error || "Le téléchargement n'a pas pu être lancé")
      }
    }).catch(() => toast.error("Une erreur s'est produite"))
  }

  function toggleFavori(dossier) {
    const appel = dossier.is_favorite ? defavoriCategorie : favoriCategorie;
    appel(dossier.id).then((res) => {
      if (res.status === 200) fetchFolders();
      else toast.error("Une erreur s'est produite");
    }).catch(() => toast.error("Une erreur s'est produite"));
  }

  function toggleVerrouille(dossier) {
    const estVerrouille = dossier.verrouille_par_utilisateur_id != null;
    const appel = estVerrouille ? deverrouillerCategorie : verrouillerCategorie;
    appel(dossier.id).then(async (res) => {
      if (res.status === 200) {
        toast.success(estVerrouille ? 'Dossier déverrouillé' : 'Dossier verrouillé');
        fetchFolders();
      } else {
        toast.error("Une erreur s'est produite");
      }
    }).catch(() => toast.error("Une erreur s'est produite"));
  }

  /** Construit les infos affichées par InfoDossierModal — aucun appel réseau, tout est déjà en mémoire. */
  function infosPourDossier(dossier) {
    return {
      label: dossier.libelle_cat,
      total: dossier.document_archives_count ?? 0,
      attention: dossier.documents_attention_count ?? 0,
      traites: dossier.documents_traites_count ?? 0,
      creeLe: dossier.created_at,
      verrouille: dossier.verrouille_par_utilisateur_id != null,
    };
  }

  function updateFolder(e,id){
    e.preventDefault()
    updateCatgory(folderData,id).then(async function(res){
      if (res.status ===200) {
        fetchFolders()
        document.getElementById('edit_folder' + id)?.close()
      }
      else{
        toast.error("Une erreur est survenue")
      }
    }).catch(function(err){
      console.log(err)
      toast.error("Une erreur est survenue")
    })
  }

  const fetchFolders = async () => {
    try {
      const res = await getCategorie();
      if (res.status === 200) {
        const data = await res.json();
        setDossiers(data);
        setSearchValue(data);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const fetchTousLesDocuments = async () => {
    try {
      const res = await getDocument();
      if (res.status === 200) {
        setTousLesDocuments(await res.json());
      }
    } catch (error) {
      console.log(error);
    }
  };

  const fetchATraiter = async () => {
    try {
      const res = await getDocumentsATraiter();
      if (res.status === 200) {
        setATraiter(await res.json());
      }
    } catch (error) {
      console.log(error);
    }
  };

  const getFormData = (e, callback) => {
    callback(prevData => ({
      ...prevData,
      [e.target.name]: e.target.value
    }));
  };

  function searchFolder(e) {
    e.preventDefault();
    const value = e.target.value;
    setSearchTerm(value);

    if (value === "") {
      setSearchValue(dossiers);
      setDocumentsTrouves([]);
      return;
    }

    setSearchValue(dossiers.filter(d => correspondARequete([d.libelle_cat], value)));
    setDocumentsTrouves(tousLesDocuments.filter(doc => correspondARequete(
      [doc.titre_document, doc.code_reference, doc.auteur, doc.resume, doc.texte_extrait],
      value
    )));
  }

  const createFolder = async (e) => {
    e.preventDefault();
    try {
      const res = await createCategorie(folderData);
      if (res.status === 201) {
        fetchFolders();
        toast.success("Votre dossier a été bien créé");
      } else {
        toast.error("Une erreur s'est produite");
      }
    } catch (error) {
      toast.error("Une erreur s'est produite");
      console.log(error);
    }
  };

  const navigate = useNavigate();

  useEffect(() => {
    setUser(JSON.parse(sessionStorage.getItem("user")));
    fetchFolders();
    fetchTousLesDocuments();
    fetchATraiter();
  }, []);

  function joursDepuis(dateStr) {
    const jours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    return jours;
  }

  function joursAvant(dateStr) {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function saluation() {
    const heure = new Date().getHours();
    return heure < 18 ? 'Bonjour' : 'Bonsoir';
  }

  const totalAttention = dossiers.reduce((sum, d) => sum + (d.documents_attention_count ?? 0), 0);
  const totalTraites = dossiers.reduce((sum, d) => sum + (d.documents_traites_count ?? 0), 0);

  const stats = [
    { label: 'Dossiers', value: dossiers.length, icon: LuFolder, tint: 'bg-primary/10 text-primary' },
    { label: 'Documents', value: tousLesDocuments.length, icon: LuFileText, tint: 'bg-secondary/10 text-secondary' },
    { label: 'À traiter', value: totalAttention, icon: LuAlertCircle, tint: 'bg-destructive/10 text-destructive' },
    { label: 'Traités', value: totalTraites, icon: LuCheckCircle2, tint: 'bg-green-500/10 text-green-600' },
  ];

  const favoris = dossiers.filter((d) => d.is_favorite);

  /** Même ordre de priorité que toneDossier() : à traiter d'abord, jusqu'à "aucun document". */
  function groupeDossier(dossier) {
    if ((dossier.documents_attention_count ?? 0) > 0) return 'attention';
    if ((dossier.documents_en_cours_count ?? 0) > 0) return 'en_cours';
    if ((dossier.documents_traites_count ?? 0) > 0) return 'traite';
    return 'aucun';
  }
  const RANG_GROUPE = { attention: 0, en_cours: 1, traite: 2, aucun: 3 };

  const dossiersAffiches = searchValue
    .filter((d) => filtreStatut === 'tous' || groupeDossier(d) === filtreStatut)
    .filter((d) => !masquerVides || (d.document_archives_count ?? 0) > 0)
    .slice()
    .sort((a, b) => {
      if (tri === 'documents') return (b.document_archives_count ?? 0) - (a.document_archives_count ?? 0);
      if (tri === 'statut') return RANG_GROUPE[groupeDossier(a)] - RANG_GROUPE[groupeDossier(b)];
      return (a.libelle_cat || '').localeCompare(b.libelle_cat || '');
    });

  return (
    <div className='flex flex-col flex-grow py-6 gap-1'>
      <Breadcrumbs where="Tableau de bord" />
      <div className='mb-6 mt-1'>
        <div className='flex items-start justify-between flex-wrap gap-3 mb-4'>
          <div>
            <h2 className='text-2xl font-semibold text-foreground'>{saluation()}, {getDisplayName(user) || 'bienvenue'}</h2>
            <p className='text-sm text-muted-foreground mt-1'>
              {totalAttention > 0
                ? `${totalAttention} document${totalAttention > 1 ? 's' : ''} ${totalAttention > 1 ? 'vous attendent' : 'vous attend'} aujourd'hui.`
                : 'Tout est à jour, aucun document en attente.'}
            </p>
          </div>
          <p className='text-sm text-muted-foreground capitalize sm:text-right'>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {showATraiter && (aTraiter.en_attente.length > 0 || aTraiter.a_purger.length > 0) && (
          <div className='rounded-2xl border border-accent/40 bg-accent/5 p-4 mb-4'>
            <div className='flex items-center justify-between mb-3'>
              <h3 className='text-sm font-semibold text-foreground'>À traiter bientôt</h3>
              <button onClick={() => setShowATraiter(false)} className='text-muted-foreground hover:text-foreground transition-colors'>
                <IoClose size={18} />
              </button>
            </div>
            <div className='flex flex-col gap-2'>
              {aTraiter.en_attente.map((d) => (
                <Link key={`att-${d.id}`} to={`/view/${d.id}/${d.extension || 'pdf'}`} className='flex items-center gap-2.5 text-sm hover:bg-card rounded-lg p-1.5 -m-1.5 transition-colors'>
                  <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-accent/20 text-accent-foreground shrink-0'>
                    <LuClock size={15} />
                  </span>
                  <span className='min-w-0 truncate'>
                    <span className='font-medium'>{d.titre}</span>
                    <span className='text-muted-foreground'> — en attente depuis {joursDepuis(d.depuis)} j</span>
                  </span>
                </Link>
              ))}
              {aTraiter.a_purger.map((d) => {
                const jours = joursAvant(d.echeance);
                return (
                  <Link key={`pur-${d.id}`} to={`/view/${d.id}/${d.extension || 'pdf'}`} className='flex items-center gap-2.5 text-sm hover:bg-card rounded-lg p-1.5 -m-1.5 transition-colors'>
                    <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 text-destructive shrink-0'>
                      <LuArchive size={15} />
                    </span>
                    <span className='min-w-0 truncate'>
                      <span className='font-medium'>{d.titre}</span>
                      <span className='text-muted-foreground'> — {jours >= 0 ? `à purger dans ${jours} j` : `échéance dépassée depuis ${-jours} j`}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
          {stats.map((s) => (
            <div key={s.label} className='flex items-center gap-3 rounded-2xl border border-border bg-card p-4'>
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${s.tint}`}>
                <s.icon size={18} />
              </div>
              <div>
                <p className='text-lg font-semibold text-foreground leading-none'>{s.value}</p>
                <p className='text-xs text-muted-foreground mt-0.5'>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Cards />
      <div>
        {favoris.length > 0 && (
          <div className='flex items-center gap-2 flex-wrap mb-4'>
            <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0'>Favoris</span>
            {favoris.map((d) => (
              <Link
                key={d.id}
                to={'folder/' + d.id}
                className='inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors'
              >
                <LuPin size={12} className='text-accent' /> {d.libelle_cat}
              </Link>
            ))}
          </div>
        )}
        <DossierToolbar
          searchValue={searchTerm}
          onSearchChange={searchFolder}
          searchPlaceholder='Rechercher un dossier...'
          actionsNouveau={[{ label: 'Nouveau dossier', onClick: () => document.getElementById('createFolder').showModal() }]}
          tri={tri}
          setTri={setTri}
          optionsTri={[
            { value: 'nom', label: 'Nom (A→Z)' },
            { value: 'documents', label: 'Nombre de documents' },
            { value: 'statut', label: 'À traiter d\'abord' },
          ]}
          filtreStatut={filtreStatut}
          setFiltreStatut={setFiltreStatut}
          masquerVides={masquerVides}
          setMasquerVides={setMasquerVides}
          densite={densite}
          setDensite={setDensite}
          onActualiser={fetchFolders}
          extra={
            <button
              onClick={toggleSelectMode}
              title='Sélection multiple'
              className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${selectMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              <LuCheck size={16} />
            </button>
          }
          view={view}
          setView={setView}
        />
        <BulkFolderActionBar dossiers={dossiersAffiches} selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} onChanged={fetchFolders} />
        {dossiersAffiches.length === 0 && (
          <div className='flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center'>
            <LuFolderSearch size={32} className='text-muted-foreground' strokeWidth={1.5} />
            <p className='text-sm font-medium text-foreground'>
              {dossiers.length === 0 ? 'Aucun dossier pour le moment' : 'Aucun dossier ne correspond à votre recherche'}
            </p>
            <p className='text-xs text-muted-foreground'>
              {dossiers.length === 0 ? 'Créez votre premier dossier pour commencer à archiver.' : 'Essayez un autre terme de recherche, ou un autre filtre.'}
            </p>
          </div>
        )}
        {/* Le nombre de colonnes s'adapte à la densité choisie (compact/normal/grand) ;
            "normal" garde lg:4 (pas 6) pour que les noms de dossier français (souvent
            longs, ex: "Gestion bénéficiaires & secteurs") s'affichent sans déborder. */}
        <div className={view === 'grid'
          ? DENSITE_COLS[densite]
          : 'flex flex-col rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden'
        }>
          {dossiersAffiches.map((dossier, k) => (
            <FolderTile
              key={k}
              dossier={dossier}
              vue={view}
              hauteurClasse={DENSITE_HAUTEUR[densite]}
              canManage={user?.role === 'Administrator'}
              onDownload={() => demanderTelechargement(dossier.id)}
              onRename={() => document.getElementById('edit_folder' + dossier.id).showModal()}
              onDelete={() => confirmDeleteFolder(dossier)}
              onEditChange={(e) => getFormData(e, setFolderData)}
              onEditSubmit={(e) => updateFolder(e, dossier.id)}
              onToggleFavori={() => toggleFavori(dossier)}
              onPartager={() => setShareFolder(dossier)}
              onToggleVerrouille={() => toggleVerrouille(dossier)}
              onInfos={() => setInfoDossier(infosPourDossier(dossier))}
              selectionActive={selectMode}
              selected={selectedIds.has(dossier.id)}
              onToggleSelect={() => toggleSelect(dossier.id)}
            />
          ))}
        </div>

        {searchTerm !== '' && documentsTrouves.length > 0 && (
          <div className='mt-6'>
            <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3'>
              Documents ({documentsTrouves.length})
            </p>
            <div className='grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3'>
              {documentsTrouves.map((doc) => {
                const { icon: Icon, tint } = getFileTypeVisual(doc.chemin_stockage_serveur);
                const ext = String(doc.chemin_stockage_serveur).split('.').pop();
                return (
                  <button
                    key={doc.id}
                    onClick={() => navigate(`/view/${doc.id}/${ext}`)}
                    className='flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/40 hover:shadow-md transition-all duration-200'
                  >
                    <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${tint}`}>
                      <Icon size={19} />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-foreground truncate'>{doc.titre_document}</p>
                      <p className='text-xs text-muted-foreground truncate mt-0.5'>{doc.categorie_document?.libelle_cat}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <dialog id="createFolder" className="modal">
        <div className="modal-box w-3/4 rounded-2xl">
          <form method="dialog" className='flex justify-end'>
            <button className='btn btn-sm btn-ghost btn-circle'><IoClose /></button>
          </form>
          <div className='py-2'>
            <h1 className='text-lg font-semibold mb-4'>Nouveau dossier</h1>
            <form onSubmit={createFolder}>
              <div className="mb-4">
                <label htmlFor="name" className='block text-sm font-medium mb-1.5'>Nom du dossier</label>
                <input
                  type="text"
                  id='name'
                  name='label'
                  onChange={(e) => getFormData(e, setFolderData)}
                  placeholder="Informatique"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="modal-action">
                <button className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>Créer</button>
              </div>
            </form>
          </div>
        </div>
      </dialog>

      <ShareFolderModal folder={shareFolder} isOpen={!!shareFolder} onClose={() => setShareFolder(null)} />
      <InfoDossierModal infos={infoDossier} isOpen={!!infoDossier} onClose={() => setInfoDossier(null)} />

    </div>
  );
}

export default Home;
