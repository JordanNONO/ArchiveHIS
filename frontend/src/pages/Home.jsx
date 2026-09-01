import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuBookOpen, LuFileEdit, LuFolder, LuFolderPlus, LuFolderSearch, LuShare2, LuTrash2, LuMoreVertical, LuFileText, LuAlertCircle, LuCheckCircle2, LuClock, LuArchive, LuDownload, LuPin, LuPinOff, LuLock, LuUnlock, LuInfo, LuCheck, LuCalendarClock, LuListChecks, LuUploadCloud, LuMail } from 'react-icons/lu';
import { IoClose } from 'react-icons/io5';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Cards from '../components/fragments/Cards';
import Breadcrumbs from '../components/Breadcrumbs';
import DossierToolbar from '../components/DossierToolbar';
import ShareFolderModal from '../components/ShareFolderModal';
import InfoDossierModal from '../components/InfoDossierModal';
import ArchiverDocumentModal from '../components/ArchiverDocumentModal';
import BulkFolderActionBar from '../components/BulkFolderActionBar';
import { createCategorie, deleteCategorieById, downloadCategorie, favoriCategorie, defavoriCategorie, verrouillerCategorie, deverrouillerCategorie, getCategorie, updateCatgory } from '../api/routes/categorie';
import { getDocument, getDocumentsATraiter, getCourrierCompteurs, rechercheDocuments } from '../api/routes/document';
import { getPaiCompteurs } from '../api/routes/pai';
import { usePermissions } from '../hooks/usePermissions';
import { getFileTypeVisual } from '../utils/fileTypeIcons';
import { getDisplayName } from '../utils/common';
import { correspondARequete } from '../utils/recherche';
import { toneDossier } from '../utils/statutGroupe';
import { DENSITE_HAUTEUR, DENSITE_COLS } from '../utils/densite';
import { nomCategorie } from '../utils/libelleLocalise';
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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const tone = getFolderBadgeTone(dossier);
  const count = dossier.document_archives_count ?? 0;
  const estVerrouille = dossier.verrouille_par_utilisateur_id != null;
  const nom = nomCategorie(dossier, i18n.resolvedLanguage);
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
                  {t('home.nDocuments', { count })}
                </span>
              </div>
              <span className='flex items-center gap-1.5 text-sm font-semibold text-foreground'>
                {estVerrouille && <LuLock size={12} className='text-destructive shrink-0' />}
                {dossier.is_favorite && <LuPin size={12} className='text-accent shrink-0' />}
                <span className='line-clamp-3'>{nom}</span>
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
                  <span className='truncate'>{nom}</span>
                </p>
                <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${tone.texte}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.point}`} />
                  <span className='truncate'>{t('home.nDocuments', { count })} · {tone.label}</span>
                </p>
              </div>
            </Link>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuItem inset className="cursor-pointer" onClick={() => navigate('folder/' + dossier.id)}>
            {t('home.ouvrirDossier')}
            <ContextMenuShortcut><LuBookOpen /></ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onInfos}>
            {t('home.informations')}
            <ContextMenuShortcut><LuInfo /></ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onDownload}>
            {t('dossierToolbar.telechargerDossier')}
            <ContextMenuShortcut><LuDownload /></ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onToggleFavori}>
            {dossier.is_favorite ? t('dossierToolbar.retirerFavoris') : t('home.epinglerEnFavori')}
            <ContextMenuShortcut>{dossier.is_favorite ? <LuPinOff /> : <LuPin />}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onPartager}>
            {t('dossierToolbar.partagerDossier')}
            <ContextMenuShortcut><LuShare2 /></ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onToggleVerrouille} disabled={!canManage}>
            {estVerrouille ? t('dossierToolbar.deverrouillerDossier') : t('dossierToolbar.verrouillerDossier')}
            <ContextMenuShortcut>{estVerrouille ? <LuUnlock /> : <LuLock />}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset className="cursor-pointer" onClick={onRename} disabled={!canManage || estVerrouille}>
            {t('home.renommerDossier')}
            <ContextMenuShortcut><LuFileEdit /></ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem disabled={!canManage || estVerrouille} onClick={onDelete} inset className="text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer">
            <div>
              {t('home.supprimerDossier')}
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
          <Link to={'folder/' + dossier.id} title={t('home.ouvrirDossier')} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
            <LuBookOpen size={15} />
          </Link>
          <button title={t('home.informations')} onClick={onInfos} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
            <LuInfo size={15} />
          </button>
          <button title={t('dossierToolbar.partagerDossier')} onClick={onPartager} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
            <LuShare2 size={15} />
          </button>
          <button title={estVerrouille ? t('dossierToolbar.deverrouillerDossier') : t('dossierToolbar.verrouillerDossier')} disabled={!canManage} onClick={onToggleVerrouille} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
            {estVerrouille ? <LuUnlock size={15} /> : <LuLock size={15} />}
          </button>
          <button title={t('home.renommerDossier')} disabled={!canManage || estVerrouille} onClick={onRename} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
            <LuFileEdit size={15} />
          </button>
          <button
            title={t('home.supprimerDossier')}
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
            {t('home.modifierNomDossier', { nom })}
          </h1>
          <form onSubmit={onEditSubmit}>
            <div className="mb-4">
              <label htmlFor={"name" + dossier.id} className='block text-sm font-medium mb-1.5'>{t('home.nomDuDossier')}</label>
              <input
                type="text"
                id={"name" + dossier.id}
                name='label'
                onChange={onEditChange}
                placeholder={nom}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="modal-action">
              <button className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>{t('categoriesSettings.modifier')}</button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}

function Home() {
  const { t, i18n } = useTranslation();
  const confirm = useConfirm();
  const [dossiers, setDossiers] = useState([]);
  const [tousLesDocuments, setTousLesDocuments] = useState([]);
  const [folderData, setFolderData] = useState({ label: '' });
  const [searchValue, setSearchValue] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [documentsTrouves, setDocumentsTrouves] = useState([]);
  const [user, setUser] = useState();
  const [aTraiter, setATraiter] = useState({ en_attente: [], a_purger: [], echeance_traitement: [] });
  const [paiCompteurs, setPaiCompteurs] = useState({ dossiers_actifs: 0, objectifs_en_retard: 0 });
  const [courrierCompteurs, setCourrierCompteurs] = useState({ en_attente: 0 });
  const { hasPermission } = usePermissions();
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
        toast.success(t('home.dossierSupprime'))
      }
    })
  }

  async function confirmDeleteFolder(dossier){
    if (await confirm({ message: t('home.confirmerSuppressionDossier', { nom: nomCategorie(dossier, i18n.resolvedLanguage) }), danger: true })) {
      deleteFolder(dossier.id)
    }
  }

  function demanderTelechargement(id){
    downloadCategorie(id).then(async (res) => {
      if (res.status === 202) {
        toast.success(t('home.preparationDossier'))
      } else {
        const data = await res.json()
        toast.error(data?.error || t('home.telechargementEchoue'))
      }
    }).catch(() => toast.error(t('commun.erreurGenerique')))
  }

  function toggleFavori(dossier) {
    const appel = dossier.is_favorite ? defavoriCategorie : favoriCategorie;
    appel(dossier.id).then((res) => {
      if (res.status === 200) fetchFolders();
      else toast.error(t('commun.erreurGenerique'));
    }).catch(() => toast.error(t('commun.erreurGenerique')));
  }

  function toggleVerrouille(dossier) {
    const estVerrouille = dossier.verrouille_par_utilisateur_id != null;
    const appel = estVerrouille ? deverrouillerCategorie : verrouillerCategorie;
    appel(dossier.id).then(async (res) => {
      if (res.status === 200) {
        toast.success(estVerrouille ? t('home.dossierDeverrouille') : t('home.dossierVerrouille'));
        fetchFolders();
      } else {
        toast.error(t('commun.erreurGenerique'));
      }
    }).catch(() => toast.error(t('commun.erreurGenerique')));
  }

  /** Construit les infos affichées par InfoDossierModal — aucun appel réseau, tout est déjà en mémoire. */
  function infosPourDossier(dossier) {
    return {
      label: nomCategorie(dossier, i18n.resolvedLanguage),
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
        toast.error(t('commun.erreurGenerique'))
      }
    }).catch(function(err){
      console.log(err)
      toast.error(t('commun.erreurGenerique'))
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

  const fetchPaiCompteurs = async () => {
    try {
      const res = await getPaiCompteurs();
      if (res.status === 200) {
        setPaiCompteurs(await res.json());
      }
    } catch (error) {
      console.log(error);
    }
  };

  const fetchCourrierCompteurs = async () => {
    try {
      const res = await getCourrierCompteurs();
      if (res.status === 200) {
        setCourrierCompteurs(await res.json());
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

    // Les dossiers restent filtrés côté client (liste courte, déjà chargée) —
    // seuls les documents passent par la recherche serveur ci-dessous
    // (voir l'effet debounce sur searchTerm), qui interroge un vrai index
    // plein texte plutôt que la liste déjà chargée en mémoire.
    setSearchValue(dossiers.filter(d => correspondARequete([d.libelle_cat, d.libelle_cat_en], value)));
  }

  // Recherche serveur (plein texte, voir DocumentController::recherche()) pour
  // les documents — remplace l'ancien filtrage client sur tousLesDocuments,
  // qui ne portait jamais sur le texte des PDF/images non scannés (seul le
  // scan caméra alimentait texte_extrait). Débounce pour ne pas interroger le
  // serveur à chaque frappe.
  useEffect(() => {
    if (searchTerm === '') { setDocumentsTrouves([]); return; }
    const minuteur = setTimeout(() => {
      rechercheDocuments(searchTerm).then(async (res) => {
        if (res.status === 200) setDocumentsTrouves(await res.json());
      }).catch((error) => console.log(error));
    }, 300);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const createFolder = async (e) => {
    e.preventDefault();
    try {
      const res = await createCategorie(folderData);
      if (res.status === 201) {
        fetchFolders();
        toast.success(t('home.dossierCree'));
        setFolderData({ label: '' });
        document.getElementById('createFolder').close();
      } else {
        toast.error(t('commun.erreurGenerique'));
      }
    } catch (error) {
      toast.error(t('commun.erreurGenerique'));
      console.log(error);
    }
  };

  const navigate = useNavigate();

  useEffect(() => {
    setUser(JSON.parse(sessionStorage.getItem("user")));
    fetchFolders();
    fetchTousLesDocuments();
    fetchATraiter();
    if (hasPermission('gerer_pai')) fetchPaiCompteurs();
    if (hasPermission('traiter_courrier')) fetchCourrierCompteurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return heure < 18 ? t('home.bonjour') : t('home.bonsoir');
  }

  const totalAttention = dossiers.reduce((sum, d) => sum + (d.documents_attention_count ?? 0), 0);
  const totalTraites = dossiers.reduce((sum, d) => sum + (d.documents_traites_count ?? 0), 0);

  const stats = [
    { label: t('home.dossiers'), value: dossiers.length, icon: LuFolder, tint: 'bg-primary/10 text-primary' },
    { label: t('sidebar.documents'), value: tousLesDocuments.length, icon: LuFileText, tint: 'bg-secondary/10 text-secondary' },
    { label: t('dossierToolbar.aTraiter'), value: totalAttention, icon: LuAlertCircle, tint: 'bg-destructive/10 text-destructive' },
    { label: t('dossierToolbar.traites'), value: totalTraites, icon: LuCheckCircle2, tint: 'bg-green-500/10 text-green-600' },
  ];
  if (hasPermission('gerer_pai')) {
    stats.push({
      label: t('home.paiEnRetard'),
      value: paiCompteurs.objectifs_en_retard,
      icon: LuListChecks,
      tint: paiCompteurs.objectifs_en_retard > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
      to: '/pai',
    });
  }
  if (hasPermission('traiter_courrier')) {
    stats.push({
      label: t('home.courriersEnAttente'),
      value: courrierCompteurs.en_attente,
      icon: LuMail,
      tint: courrierCompteurs.en_attente > 0 ? 'bg-accent/20 text-accent-foreground' : 'bg-muted text-muted-foreground',
    });
  }

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
      <Breadcrumbs where={t('sidebar.tableauDeBord')} />
      <div className='mb-6 mt-1'>
        <div className='flex items-start justify-between flex-wrap gap-3 mb-4'>
          <div>
            <h2 className='text-2xl font-semibold text-foreground'>{saluation()}, {getDisplayName(user) || t('home.bienvenue')}</h2>
            <p className='text-sm text-muted-foreground mt-1'>
              {totalAttention > 0
                ? t('home.documentsVousAttendent', { count: totalAttention })
                : t('home.toutEstAJour')}
            </p>
          </div>
          <p className='text-sm text-muted-foreground capitalize sm:text-right'>
            {new Date().toLocaleDateString(i18n.resolvedLanguage, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {showATraiter && (aTraiter.en_attente.length > 0 || aTraiter.a_purger.length > 0 || (aTraiter.echeance_traitement?.length > 0)) && (
          <div className='rounded-2xl border border-accent/40 bg-accent/5 p-4 mb-4'>
            <div className='flex items-center justify-between mb-3'>
              <h3 className='text-sm font-semibold text-foreground'>{t('home.aTraiterBientot')}</h3>
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
                    <span className='text-muted-foreground'> — {t('home.enAttenteDepuis', { count: joursDepuis(d.depuis) })}</span>
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
                      <span className='text-muted-foreground'> — {jours >= 0 ? t('home.aPurgerDans', { count: jours }) : t('home.echeanceDepasseeDepuis', { count: -jours })}</span>
                    </span>
                  </Link>
                );
              })}
              {(aTraiter.echeance_traitement || []).map((d) => {
                const jours = joursAvant(d.echeance);
                return (
                  <Link key={`ech-${d.id}`} to={`/view/${d.id}/${d.extension || 'pdf'}`} className='flex items-center gap-2.5 text-sm hover:bg-card rounded-lg p-1.5 -m-1.5 transition-colors'>
                    <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${d.depassee ? 'bg-destructive/10 text-destructive' : 'bg-accent/20 text-accent-foreground'}`}>
                      <LuCalendarClock size={15} />
                    </span>
                    <span className='min-w-0 truncate'>
                      <span className='font-medium'>{d.titre}</span>
                      <span className='text-muted-foreground'> — {jours >= 0 ? t('home.aTraiterDans', { count: jours }) : t('home.delaiDepasseDepuis', { count: -jours })}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
          {stats.map((s) => {
            const Wrapper = s.to ? Link : 'div';
            const wrapperProps = s.to ? { to: s.to } : {};
            return (
              <Wrapper key={s.label} {...wrapperProps} className='flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30'>
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${s.tint}`}>
                  <s.icon size={18} />
                </div>
                <div>
                  <p className='text-lg font-semibold text-foreground leading-none'>{s.value}</p>
                  <p className='text-xs text-muted-foreground mt-0.5'>{s.label}</p>
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>
      <Cards />
      <div>
        {favoris.length > 0 && (
          <div className='flex items-center gap-2 flex-wrap mb-4'>
            <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0'>{t('home.favoris')}</span>
            {favoris.map((d) => (
              <Link
                key={d.id}
                to={'folder/' + d.id}
                className='inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors'
              >
                <LuPin size={12} className='text-accent' /> {nomCategorie(d, i18n.resolvedLanguage)}
              </Link>
            ))}
          </div>
        )}
        <DossierToolbar
          searchValue={searchTerm}
          onSearchChange={searchFolder}
          searchPlaceholder={t('home.rechercherDossier')}
          actionsNouveau={[
            { label: t('home.nouveauDossier'), icon: LuFolderPlus, onClick: () => document.getElementById('createFolder').showModal() },
            { label: t('home.archiverDocument'), icon: LuUploadCloud, onClick: () => document.getElementById('archiverDocumentHome').showModal() },
          ]}
          tri={tri}
          setTri={setTri}
          optionsTri={[
            { value: 'nom', label: t('home.triNom') },
            { value: 'documents', label: t('home.triDocuments') },
            { value: 'statut', label: t('home.triStatut') },
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
              title={t('home.selectionMultiple')}
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
              {dossiers.length === 0 ? t('home.aucunDossier') : t('home.aucunDossierRecherche')}
            </p>
            <p className='text-xs text-muted-foreground'>
              {dossiers.length === 0 ? t('home.creezPremierDossier') : t('home.essayezAutreTerme')}
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
              {t('home.documentsN', { count: documentsTrouves.length })}
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
                      <p className='text-xs text-muted-foreground truncate mt-0.5'>{nomCategorie(doc.categorie_document, i18n.resolvedLanguage)}</p>
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
            <h1 className='text-lg font-semibold mb-4'>{t('home.nouveauDossier')}</h1>
            <form onSubmit={createFolder}>
              <div className="mb-4">
                <label htmlFor="name" className='block text-sm font-medium mb-1.5'>{t('home.nomDuDossier')}</label>
                <input
                  type="text"
                  id='name'
                  name='label'
                  onChange={(e) => getFormData(e, setFolderData)}
                  placeholder="Informatique"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="name_en" className='block text-sm font-medium mb-1.5'>{t('categoriesSettings.categorieEn')}</label>
                <input
                  type="text"
                  id='name_en'
                  name='label_en'
                  onChange={(e) => getFormData(e, setFolderData)}
                  placeholder="IT"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className='text-xs text-muted-foreground mt-1'>{t('categoriesSettings.indicationTraduction')}</p>
              </div>
              <div className="modal-action">
                <button className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>{t('home.creer')}</button>
              </div>
            </form>
          </div>
        </div>
      </dialog>

      <ArchiverDocumentModal dialogId='archiverDocumentHome' categories={dossiers} onArchive={() => { fetchFolders(); fetchTousLesDocuments(); fetchATraiter(); }} />

      <ShareFolderModal folder={shareFolder} isOpen={!!shareFolder} onClose={() => setShareFolder(null)} />
      <InfoDossierModal infos={infoDossier} isOpen={!!infoDossier} onClose={() => setInfoDossier(null)} />

    </div>
  );
}

export default Home;
