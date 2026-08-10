import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import { FaFilePdf, FaFileWord, FaFileExcel, FaFilePowerpoint, FaFileImage, FaFileLines, FaFileZipper, FaFile } from 'react-icons/fa6';
import { LuArrowLeft, LuFolder, LuBookOpen, LuFileEdit, LuTrash2, LuUploadCloud, LuUsers2, LuFolderPlus, LuMoreVertical, LuDownload, LuLock } from 'react-icons/lu';
import { IoClose } from 'react-icons/io5';
import { getCategorieById, downloadCategorie, favoriCategorie, defavoriCategorie, verrouillerCategorie, deverrouillerCategorie } from '../api/routes/categorie';
import { createDocument } from '../api/routes/document';
import { createTypeDocument, updateTypeDocument, deleteTypeDocument, downloadTypeDocument } from '../api/routes/typeDocument';
import DocumentList from '../components/DocumentList';
import DocumentGrid from '../components/DocumentGrid';
import DossierToolbar from '../components/DossierToolbar';
import ShareFolderModal from '../components/ShareFolderModal';
import InfoDossierModal from '../components/InfoDossierModal';
import DocumentApercuPanel from '../components/DocumentApercuPanel';
import Breadcrumbs from '../components/Breadcrumbs';
import Pagination from '../components/Pagination';
import FilePreviewCard from '../components/FilePreviewCard';
import FileContentPreview from '../components/FileContentPreview';
import PersonnelConcerneField from '../components/PersonnelConcerneField';
import FiligraneHIS from '../components/FiligraneHIS';
import { getFileTypeVisual } from '../utils/fileTypeIcons';
import { getDisplayName } from '../utils/common';
import { correspondARequete } from '../utils/recherche';
import { toneDossier, compterParGroupeStatut, groupeDeStatut } from '../utils/statutGroupe';
import { DENSITE_HAUTEUR, DENSITE_COLS } from '../utils/densite';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../contexts/ConfirmDialogContext';

/**
 * Dossiers "mère" pour les documents déposés par des comptes externes : voir
 * roleDuDocument() ci-dessous. Toujours affichés tous les deux, même vides,
 * pour rester un repère fixe côté RH.
 */
const GROUPES_ROLE_DOSSIER = [
    { cle: 'Beneficiaire', libelle: 'Bénéficiaire' },
    { cle: 'Intervenant', libelle: 'Intervenant' },
];

/**
 * Contenu visuel commun à toute tuile "dossier" de cette page (sous-dossier
 * TypeDocument, groupe Bénéficiaire/Intervenant/Autre, ou personne) — même
 * traitement que les cases dossier de Home.jsx : bordure de couleur (statut
 * agrégé façon feu tricolore, voir toneDossier()) plutôt qu'un simple badge
 * à décoder, compteur en toutes lettres. `avecMenu` réserve la place du
 * bouton "⋮" en haut à droite (menu contextuel tactile, positionné en
 * absolu par l'appelant) pour que le compteur ne parte pas dessous.
 */
function ContenuTuile({ label, count, tone, avecMenu }) {
    return (
        <>
            <div className={`flex items-start justify-between gap-2 ${avecMenu ? 'pr-6' : ''}`}>
                <span className='flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0'>
                    <LuFolder size={17} strokeWidth={1.75} />
                </span>
                <span className='text-[11px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0'>
                    {count} document{count !== 1 ? 's' : ''}
                </span>
            </div>
            <span className='text-sm font-semibold text-foreground line-clamp-3'>{label}</span>
            <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${tone.texte}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.point}`} />
                <span className='truncate'>{tone.label}</span>
            </span>
        </>
    );
}

/**
 * Tuile d'un sous-dossier (TypeDocument) — utilisée à la fois pour la racine
 * d'une catégorie et pour les sous-dossiers imbriqués à l'intérieur d'un
 * autre (voir `typePath` dans OpenFolder) : c'est exactement la même tuile,
 * peu importe la profondeur.
 */
function TypeTile({ type, vue = 'grid', hauteurClasse = 'h-[172px]', onOpen, onDownload, onRename, onDelete, canManage }) {
    const tone = toneDossier({
        enAttente: type.documents_attention_count ?? 0,
        enCours: type.documents_en_cours_count ?? 0,
        traites: type.documents_traites_count ?? 0,
    });
    const count = type.document_archives_count ?? 0;
    return (
        <div className='relative group'>
            {vue === 'grid' ? (
                <button
                    onClick={onOpen}
                    className={`relative flex flex-col gap-2.5 ${hauteurClasse} overflow-hidden rounded-2xl border border-border border-l-4 ${tone.bordure} bg-card p-4 text-left hover:shadow-md transition-all duration-200 w-full`}
                >
                    <ContenuTuile label={type.libelle} count={count} tone={tone} avecMenu />
                </button>
            ) : (
                <button onClick={onOpen} className='flex items-center gap-3 pr-11 pl-3.5 py-3 hover:bg-muted/40 transition-colors w-full text-left'>
                    <span className='flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0'>
                        <LuFolder size={16} strokeWidth={1.75} />
                    </span>
                    <div className='min-w-0 flex-1'>
                        <p className='text-sm font-medium text-foreground truncate'>{type.libelle}</p>
                        <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${tone.texte}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.point}`} />
                            <span className='truncate'>{count} document{count !== 1 ? 's' : ''} · {tone.label}</span>
                        </p>
                    </div>
                </button>
            )}

            <div className={`dropdown dropdown-end absolute right-1.5 z-10 ${vue === 'grid' ? 'top-1.5' : 'top-1/2 -translate-y-1/2'}`}>
                <button
                    tabIndex={0}
                    onClick={(e) => e.stopPropagation()}
                    className='flex items-center justify-center w-7 h-7 rounded-lg bg-card/90 text-muted-foreground opacity-70 hover:opacity-100 hover:bg-muted hover:text-foreground transition-all'
                >
                    <LuMoreVertical size={14} />
                </button>
                <div tabIndex={0} className='dropdown-content flex items-center gap-1 bg-card border border-border rounded-xl z-20 p-1.5 shadow-lg mt-1'>
                    <button title="Ouvrir le dossier" onClick={onOpen} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
                        <LuBookOpen size={15} />
                    </button>
                    <button title="Télécharger le dossier" onClick={onDownload} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
                        <LuDownload size={15} />
                    </button>
                    <button title="Renommer le dossier" disabled={!canManage} onClick={onRename} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
                        <LuFileEdit size={15} />
                    </button>
                    <button title="Supprimer le dossier" disabled={!canManage} onClick={onDelete} className='flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
                        <LuTrash2 size={15} />
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Tuile "simple" sans menu de gestion (groupe Bénéficiaire/Intervenant/Autre,
 * ou personne précise à l'intérieur d'un groupe) — mêmes deux formes que
 * TypeTile (carte / ligne), juste sans le dropdown de renommage/suppression
 * qui n'a pas de sens ici (ce ne sont pas de vrais TypeDocument).
 */
function TuileDossier({ label, count, tone, onClick, vue = 'grid', hauteurClasse = 'h-[172px]' }) {
    if (vue === 'grid') {
        return (
            <button
                onClick={onClick}
                className={`relative flex flex-col gap-2.5 ${hauteurClasse} overflow-hidden rounded-2xl border border-border border-l-4 ${tone.bordure} bg-card p-4 text-left hover:shadow-md transition-all duration-200 w-full`}
            >
                <ContenuTuile label={label} count={count} tone={tone} />
            </button>
        );
    }
    return (
        <button onClick={onClick} className='flex items-center gap-3 pl-3.5 pr-3.5 py-3 hover:bg-muted/40 transition-colors w-full text-left'>
            <span className='flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0'>
                <LuFolder size={16} strokeWidth={1.75} />
            </span>
            <div className='min-w-0 flex-1'>
                <p className='text-sm font-medium text-foreground truncate'>{label}</p>
                <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${tone.texte}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.point}`} />
                    <span className='truncate'>{count} document{count !== 1 ? 's' : ''} · {tone.label}</span>
                </p>
            </div>
        </button>
    );
}

function OpenFolder() {
    const {id} = useParams()
    const navigate = useNavigate()
    const confirm = useConfirm();
    const { isAdministrator, hasPermission } = usePermissions();
    /**
     * L'auteur d'un document archivé est presque toujours la personne qui le
     * téléverse : on préremplit avec son nom (fiche Personnel) plutôt que de
     * lui faire retaper son propre nom à chaque archivage, tout en le laissant
     * modifiable pour les cas où quelqu'un archive pour le compte d'un tiers.
     */
    const currentUserName = getDisplayName(JSON.parse(sessionStorage.getItem('user') || '{}'));
    const canManageDossiers = isAdministrator || hasPermission('gerer_categories');
    const [documents, setDocuments] = useState([]);
    const [types, setTypes] = useState([]);
    const [categorie, setCategorie] = useState({});
    // Pile des dossiers ouverts, de la racine jusqu'au dossier courant — permet
    // une imbrication à profondeur arbitraire (ex: "Promesse d'embauche" créé
    // depuis l'intérieur de "CV" reste dans "CV", pas remonté à la racine).
    // `selectedType` (le dernier de la pile) est dérivé plutôt que stocké à
    // part, pour ne pas avoir deux sources de vérité qui peuvent diverger.
    const [typePath, setTypePath] = useState([]);
    const selectedType = typePath[typePath.length - 1] || null;
    const [view,setView] = useState('grid')
    const [tri, setTri] = useState('nom');
    const [filtreStatut, setFiltreStatut] = useState('tous');
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [densite, setDensite] = useState('normal');
    const [masquerVides, setMasquerVides] = useState(false);
    const [infoOuvert, setInfoOuvert] = useState(false);
    const [apercuActif, setApercuActif] = useState(false);
    const [docApercu, setDocApercu] = useState(null);

    function toggleApercu() {
        setApercuActif((v) => !v);
        setDocApercu(null);
    }

    function ouvrirApercu(doc) {
        setDocApercu(doc);
        setApercuActif(true);
    }
    // Regroupement par salarié/déposant actif par défaut : chaque personne a
    // ainsi son propre "dossier" dès la première pièce reçue (ex: toutes les
    // réclamations d'un même intervenant ensemble), plutôt qu'une liste plate
    // mélangeant tout le monde.
    const [groupByEmployee, setGroupByEmployee] = useState(true);
    // Niveaux de navigation à l'intérieur d'un sous-dossier groupé par salarié :
    // rôle du déposant (Bénéficiaire/Intervenant/Autre) puis personne précise.
    const [selectedGroupeRole, setSelectedGroupeRole] = useState(null);
    const [selectedPersonne, setSelectedPersonne] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const documentsPerPage = 10;

    function onSearchChange(e) {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    }

    const [docData, setDocData] = useState({
        titre: "",
        resume: "",
        auteur: currentUserName,
        file_create_date: "",
        reference: "",
        personnel_concerne_id: '',
        nom_personne_concernee: '',
    });
    const [selectedFiles, setSelectedFiles] = useState([]);
    const uploadFileRef = useRef(null);
    const [newTypeLabel, setNewTypeLabel] = useState('');
    const [creatingType, setCreatingType] = useState(false);

    async function createSousDossier(e) {
        e.preventDefault();
        try {
            setCreatingType(true);
            // Imbriqué sous le dossier actuellement ouvert (façon explorateur de
            // fichiers) — à la racine de la catégorie si on n'est nulle part.
            const res = await createTypeDocument({ categorie_id: id, parent_id: selectedType?.id || null, libelle: newTypeLabel });
            setCreatingType(false);
            if (res.status === 201) {
                toast.success('Dossier créé avec succès');
                setNewTypeLabel('');
                document.getElementById('createSousDossier').close();
                fetchDocuments();
            } else {
                // Le message précis (ex: "Ce dossier est verrouillé...", voir
                // TypeDocumentController::store) ne remontait pas jusqu'ici —
                // seul un toast générique s'affichait, donnant l'impression
                // trompeuse que la création avait réussi puis "disparu".
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || "Une erreur s'est produite");
            }
        } catch (error) {
            setCreatingType(false);
            console.log(error);
            toast.error("Une erreur s'est produite");
        }
    }

    const [renameType, setRenameType] = useState(null);
    const [renameTypeLabel, setRenameTypeLabel] = useState('');

    function openRenameType(type) {
        setRenameType(type);
        setRenameTypeLabel(type.libelle);
        document.getElementById('renameSousDossier').showModal();
    }

    async function saveRenameType(e) {
        e.preventDefault();
        try {
            const res = await updateTypeDocument(renameType.id, { libelle: renameTypeLabel });
            if (res.status === 200) {
                toast.success('Dossier renommé avec succès');
                document.getElementById('renameSousDossier').close();
                fetchDocuments();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || "Une erreur s'est produite");
            }
        } catch (error) {
            console.log(error);
            toast.error("Une erreur s'est produite");
        }
    }

    function demanderTelechargementCategorie(){
        downloadCategorie(id).then(async (res) => {
            if (res.status === 202) {
                toast.success('Préparation du dossier en cours, vous serez notifié quand il sera prêt.');
            } else {
                const data = await res.json();
                toast.error(data?.error || "Le téléchargement n'a pas pu être lancé");
            }
        }).catch(() => toast.error("Une erreur s'est produite"));
    }

    function toggleFavoriCategorie() {
        const appel = categorie.is_favorite ? defavoriCategorie : favoriCategorie;
        appel(id).then(async (res) => {
            if (res.status === 200) fetchDocuments();
            else {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || "Une erreur s'est produite");
            }
        }).catch(() => toast.error("Une erreur s'est produite"));
    }

    function toggleVerrouilleCategorie() {
        const estVerrouille = categorie.verrouille_par_utilisateur_id != null;
        const appel = estVerrouille ? deverrouillerCategorie : verrouillerCategorie;
        appel(id).then(async (res) => {
            if (res.status === 200) {
                toast.success(estVerrouille ? 'Dossier déverrouillé' : 'Dossier verrouillé');
                fetchDocuments();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || "Une erreur s'est produite");
            }
        }).catch(() => toast.error("Une erreur s'est produite"));
    }

    function demanderTelechargementType(typeId, nomPersonneConcernee){
        downloadTypeDocument(typeId, nomPersonneConcernee).then(async (res) => {
            if (res.status === 202) {
                toast.success('Préparation du dossier en cours, vous serez notifié quand il sera prêt.');
            } else {
                const data = await res.json();
                toast.error(data?.error || "Le téléchargement n'a pas pu être lancé");
            }
        }).catch(() => toast.error("Une erreur s'est produite"));
    }

    async function removeSousDossier(type) {
        if (!await confirm({ message: `Supprimer le dossier « ${type.libelle} » ? Cette action n'est pas rétroactive.`, danger: true })) return;
        deleteTypeDocument(type.id).then(async (res) => {
            if (res.status === 200) {
                toast.success('Dossier supprimé avec succès');
                fetchDocuments();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || "Une erreur s'est produite");
            }
        }).catch((err) => {
            console.log(err);
            toast.error("Une erreur s'est produite");
        });
    }

    const fetchDocuments = useCallback(() => {
        getCategorieById(id)
            .then(async (res) => {
                if (res.status === 200) {
                    const {documents,dossier,types} = await res.json();
                    setDocuments(documents);
                    setCategorie(dossier)
                    setTypes(types || [])
                }
            })
            .catch((err) => console.log(err));
    }, [id]);

    useEffect(() => {
        // Changer de catégorie (navigation directe vers un autre dossier) doit
        // repartir de sa racine — sans ça, la pile de dossiers ouverts de la
        // catégorie précédente resterait affichée à tort ici.
        setTypePath([]);
        setSelectedGroupeRole(null);
        setSelectedPersonne(null);
        setSearchTerm('');
        setCurrentPage(1);
        fetchDocuments();
    }, [id, fetchDocuments]);

    const onDrop = useCallback(acceptedFiles => {
        setSelectedFiles(acceptedFiles);
        const file = acceptedFiles[0];
        setDocData(prevData => ({
            ...prevData,
            file_create_date: file?.lastModified,
            titre: file?.name.split(".")[0]
        }));
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
            'application/vnd.ms-powerpoint': ['.ppt'],
            'application/vnd.oasis.opendocument.text': ['.odt'],
            'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
            'application/vnd.oasis.opendocument.presentation': ['.odp'],
            'text/plain': ['.txt'],
            'application/rtf': ['.rtf'],
            'application/zip': ['.zip'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
        }
    });

    const getFormData = (e, callback) => {
        callback(prevData => ({
            ...prevData,
            [e.target.name]: e.target.value
        }));
    };

    const archiveDoc = async () => {
        try {
            const res = await createDocument({ ...docData, category_id: categorie.id, type_document_id: selectedType.id }, selectedFiles[0]);
            if (res.status === 201) {
                toast.success("Le document a été bien archivé");
                setDocData({ titre: "", resume: "", auteur: currentUserName, file_create_date: "", reference: "", personnel_concerne_id: '', nom_personne_concernee: '' });
                setSelectedFiles([]);
                fetchDocuments();
                if (uploadFileRef.current) uploadFileRef.current.close();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || "Une erreur s'est produite");
            }
        } catch (error) {
            console.log(error);
            toast.error("Une erreur s'est produite");
        }
    };

    const getFileIcon = (filePath) => {
        const fileExtension = filePath.split('.').pop();
        switch (fileExtension) {
            case 'pdf':
                return <FaFilePdf className="text-red-600" />;
            case 'doc':
            case 'docx':
            case 'odt':
                return <FaFileWord className="text-blue-600" />;
            case 'xls':
            case 'xlsx':
            case 'csv':
            case 'ods':
                return <FaFileExcel className="text-green-600" />;
            case 'ppt':
            case 'pptx':
            case 'odp':
                return <FaFilePowerpoint className="text-orange-600" />;
            case 'jpg':
            case 'jpeg':
            case 'png':
                return <FaFileImage className="text-sky-600" />;
            case 'txt':
            case 'rtf':
                return <FaFileLines className="text-slate-500" />;
            case 'zip':
                return <FaFileZipper className="text-amber-600" />;
            default:
                return <FaFile />;
        }
    };

    const requeteBrute = searchTerm.trim();
    const terme = requeteBrute.toLocaleLowerCase();

    /**
     * Recherche élargie (titre, référence, auteur, résumé, contenu OCR),
     * tolérante aux fautes de frappe et aux opérateurs ET/OU/"phrase exacte" —
     * voir utils/recherche.js.
     */
    function correspondAuTerme(d) {
        return correspondARequete(
            [d.titre_document, d.code_reference, d.auteur, d.resume, d.texte_extrait],
            requeteBrute
        );
    }

    const documentsDuType = selectedType
        ? documents.filter((d) => d.type_document_id === selectedType.id)
            .filter((d) => terme === '' || correspondAuTerme(d))
        : [];

    // Vue "sous-dossiers" (types) : uniquement ceux du niveau actuel (racine de
    // la catégorie si `selectedType` est vide, sinon enfants directs du dossier
    // ouvert — imbrication façon explorateur de fichiers). La recherche filtre
    // ensuite ces sous-dossiers par nom, et remonte aussi les documents qui
    // matchent à l'intérieur de la catégorie entière, quel que soit leur type.
    const typesDuNiveau = types.filter((t) => (t.parent_id || null) === (selectedType ? selectedType.id : null));
    const typesFiltres = terme === ''
        ? typesDuNiveau
        : typesDuNiveau.filter((t) => correspondARequete([t.libelle], requeteBrute));
    const documentsTrouvesDansLaCategorie = terme === ''
        ? []
        : documents.filter(correspondAuTerme);

    /**
     * Regroupe les documents d'un type par salarié concerné (ex: tous les CV
     * de Jean Dupont ensemble), plutôt que par simple ordre d'archivage —
     * utile pour un dossier comme "Contrat & Dossier salarié" où chaque type
     * contient les documents de plusieurs employés mélangés.
     */
    function nomConcerneDuDoc(doc) {
        return doc.personnel_concerne
            ? `${doc.personnel_concerne.prenom || ''} ${doc.personnel_concerne.nom || ''}`.trim()
            : (doc.nom_personne_concernee || 'Non renseigné');
    }

    function grouperParEmploye(docs) {
        const groupes = new Map();
        docs.forEach((doc) => {
            const nom = nomConcerneDuDoc(doc);
            if (!groupes.has(nom)) groupes.set(nom, []);
            groupes.get(nom).push(doc);
        });
        return Array.from(groupes.entries()).sort(([a], [b]) => a.localeCompare(b));
    }

    /**
     * Dossier "mère" d'un document, selon le rôle du compte qui l'a déposé —
     * voir GROUPES_ROLE_DOSSIER. Un document archivé directement par le
     * personnel interne (pas un dépôt intervenant/bénéficiaire) tombe dans
     * "Autre" plutôt que d'être rangé à tort sous l'un des deux.
     */
    function roleDuDocument(doc) {
        const roles = (doc.utilisateur?.roles || []).map((r) => r.nom);
        if (roles.includes('Beneficiaire')) return 'Beneficiaire';
        if (roles.includes('Intervenant')) return 'Intervenant';
        return 'Autre';
    }

    function ouvrirType(type) {
        setTypePath((prev) => [...prev, type]);
        setSelectedGroupeRole(null);
        setSelectedPersonne(null);
        setCurrentPage(1);
        setSearchTerm('');
    }

    /** Remonte d'un cran dans la pile de dossiers (vers le parent, ou la racine). */
    function remonterDunNiveau() {
        setTypePath((prev) => prev.slice(0, -1));
        setSelectedGroupeRole(null);
        setSelectedPersonne(null);
        setCurrentPage(1);
        setSearchTerm('');
    }

    // Même bascule grille/liste que pour la liste de documents (`view`), mais
    // appliquée ici aux tuiles de dossiers elles-mêmes : la grille classique
    // ou une liste à filets fins (façon Home.jsx/EspaceIntervenant.jsx).
    // Le nombre de colonnes s'adapte en plus à la densité choisie.
    const classeConteneurTuiles = view === 'grid'
        ? DENSITE_COLS[densite]
        : 'flex flex-col rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden';

    // Le gel (voir CategorieController::verrouiller) porte sur la catégorie
    // racine et vaut pour tout ce qu'elle contient — pas de champ de
    // verrouillage propre à chaque sous-dossier.
    const categorieVerrouillee = categorie.verrouille_par_utilisateur_id != null;

    const RANG_GROUPE = { attention: 0, en_cours: 1, traite: 2, aucun: 3 };

    /** Statut agrégé d'un sous-dossier (TypeDocument), pour Trier/Filtrer — même priorité que toneDossier(). */
    function groupeType(type) {
        if ((type.documents_attention_count ?? 0) > 0) return 'attention';
        if ((type.documents_en_cours_count ?? 0) > 0) return 'en_cours';
        if ((type.documents_traites_count ?? 0) > 0) return 'traite';
        return 'aucun';
    }

    // typesFiltres déjà filtré par la recherche — Trier/Filtrer de la barre
    // d'outils s'appliquent par-dessus, partout où les sous-dossiers
    // apparaissent (racine, groupé par salarié, ou vue à plat).
    const typesTries = typesFiltres
        .filter((t) => filtreStatut === 'tous' || groupeType(t) === filtreStatut)
        .filter((t) => !masquerVides || (t.document_archives_count ?? 0) > 0)
        .slice()
        .sort((a, b) => {
            if (tri === 'documents') return (b.document_archives_count ?? 0) - (a.document_archives_count ?? 0);
            if (tri === 'statut') return RANG_GROUPE[groupeType(a)] - RANG_GROUPE[groupeType(b)];
            return (a.libelle || '').localeCompare(b.libelle || '');
        });

    /** Infos affichées par InfoDossierModal — calculées depuis ce qui est déjà en mémoire. */
    function infosCategorie() {
        const { enAttente, traites } = compterParGroupeStatut(documents);
        const dernierAjout = documents.reduce((max, d) => (!max || new Date(d.created_at) > new Date(max) ? d.created_at : max), null);
        return {
            label: categorie.libelle_cat,
            total: documents.length,
            attention: enAttente,
            traites,
            sousDossiers: types.length,
            creeLe: categorie.created_at,
            dernierAjout,
            verrouille: categorieVerrouillee,
        };
    }

    /** Même filtre/tri, pour une liste de documents (pas des sous-dossiers). */
    function documentsTries(docs) {
        return docs
            .filter((d) => filtreStatut === 'tous' || groupeDeStatut(d.status_doc) === filtreStatut)
            .slice()
            .sort((a, b) => {
                if (tri === 'date') return new Date(b.created_at) - new Date(a.created_at);
                if (tri === 'taille') return (b.taille ?? 0) - (a.taille ?? 0);
                if (tri === 'statut') return RANG_GROUPE[groupeDeStatut(a.status_doc)] - RANG_GROUPE[groupeDeStatut(b.status_doc)];
                return (a.titre_document || '').localeCompare(b.titre_document || '');
            });
    }

    const documentsDuTypeTries = documentsTries(documentsDuType);
    const indexOfLastDocument = currentPage * documentsPerPage;
    const indexOfFirstDocument = indexOfLastDocument - documentsPerPage;
    const currentDocuments = documentsDuTypeTries.slice(indexOfFirstDocument, indexOfLastDocument);

    return (
        <div className='w-full py-6'>
            <FiligraneHIS fixe />
            <Breadcrumbs where={[categorie?.libelle_cat, ...typePath.map((t) => t.libelle)].filter(Boolean).join(' / ')} backTo="/" />

            {!selectedType ? (
                <>
                    <h2 className='text-2xl font-semibold text-foreground mt-1 mb-4'>{categorie?.libelle_cat}</h2>
                    <DossierToolbar
                        searchValue={searchTerm}
                        onSearchChange={onSearchChange}
                        searchPlaceholder='Rechercher un dossier ou un document...'
                        actionsNouveau={[{ label: 'Nouveau dossier', onClick: () => document.getElementById('createSousDossier').showModal() }]}
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
                        estEpingle={categorie.is_favorite}
                        onToggleEpingle={toggleFavoriCategorie}
                        estVerrouille={categorieVerrouillee}
                        onToggleVerrouille={canManageDossiers ? toggleVerrouilleCategorie : undefined}
                        onPartager={() => setShareModalOpen(true)}
                        onTelecharger={demanderTelechargementCategorie}
                        onInfos={() => setInfoOuvert(true)}
                        onActualiser={fetchDocuments}
                        view={view}
                        setView={setView}
                    />
                    <div className={classeConteneurTuiles}>
                        {typesTries.map((type) => (
                            <TypeTile
                                key={type.id}
                                type={type}
                                vue={view}
                                hauteurClasse={DENSITE_HAUTEUR[densite]}
                                canManage={canManageDossiers && !categorieVerrouillee}
                                onOpen={() => ouvrirType(type)}
                                onDownload={() => demanderTelechargementType(type.id)}
                                onRename={() => openRenameType(type)}
                                onDelete={() => removeSousDossier(type)}
                            />
                        ))}
                        {typesTries.length === 0 && (
                            <p className='text-muted-foreground col-span-full'>
                                {typesDuNiveau.length === 0 ? 'Aucune sous-catégorie définie pour ce dossier.' : 'Aucun dossier ne correspond à votre recherche ou à votre filtre.'}
                            </p>
                        )}
                    </div>

                    {documentsTrouvesDansLaCategorie.length > 0 && (
                        <div className='mt-6'>
                            <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3'>
                                Documents ({documentsTrouvesDansLaCategorie.length})
                            </p>
                            <div className='grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3'>
                                {documentsTrouvesDansLaCategorie.map((doc) => {
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
                                                <p className='text-xs text-muted-foreground truncate mt-0.5'>{doc.type_document?.libelle}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1 mb-6'>
                        <div className='flex items-center gap-3 min-w-0'>
                            <button
                                onClick={() => {
                                    if (selectedPersonne) { setSelectedPersonne(null); return; }
                                    if (selectedGroupeRole) { setSelectedGroupeRole(null); return; }
                                    remonterDunNiveau();
                                }}
                                className='flex items-center justify-center w-9 h-9 rounded-lg border border-border hover:bg-muted transition-colors shrink-0'
                            >
                                <LuArrowLeft size={16} />
                            </button>
                            <h2 className='text-2xl font-semibold text-foreground truncate'>
                                {selectedPersonne || (selectedGroupeRole ? (GROUPES_ROLE_DOSSIER.find((g) => g.cle === selectedGroupeRole)?.libelle || selectedGroupeRole) : selectedType.libelle)}
                            </h2>
                            {categorieVerrouillee && (
                                <span className='inline-flex items-center gap-1.5 text-xs font-semibold text-destructive bg-destructive/10 rounded-full px-2.5 py-1 shrink-0'>
                                    <LuLock size={12} /> Verrouillé
                                </span>
                            )}
                        </div>
                    </div>
                    <DossierToolbar
                        searchValue={searchTerm}
                        onSearchChange={onSearchChange}
                        searchPlaceholder='Rechercher un document ou un sous-dossier...'
                        actionsNouveau={categorieVerrouillee ? [] : [
                            /* Toujours possible d'archiver depuis l'intérieur d'un dossier —
                               y compris une fois descendu jusqu'à une personne précise dans
                               Bénéficiaire/Intervenant/Autre (`selectedPersonne`), pas
                               seulement à la racine du type. Seul l'écran de choix
                               intermédiaire (Bénéficiaire/Intervenant/Autre sans personne
                               encore choisie) n'a pas de destination claire pour un dépôt. */
                            ...(!selectedPersonne ? [{
                                label: 'Nouveau dossier',
                                icon: LuFolderPlus,
                                onClick: () => document.getElementById('createSousDossier').showModal(),
                            }] : []),
                            ...((!selectedGroupeRole || selectedPersonne) ? [{
                                label: 'Archiver un document',
                                icon: LuUploadCloud,
                                onClick: () => {
                                    if (selectedPersonne) setDocData((d) => ({ ...d, nom_personne_concernee: selectedPersonne }));
                                    document.getElementById('uploadFileType').showModal();
                                },
                            }] : []),
                        ]}
                        tri={tri}
                        setTri={setTri}
                        optionsTri={[
                            { value: 'nom', label: 'Nom (A→Z)' },
                            { value: 'statut', label: 'À traiter d\'abord' },
                            { value: 'date', label: "Date d'archivage" },
                            { value: 'taille', label: 'Taille du fichier' },
                            { value: 'documents', label: 'Nombre de documents' },
                        ]}
                        filtreStatut={filtreStatut}
                        setFiltreStatut={setFiltreStatut}
                        masquerVides={masquerVides}
                        setMasquerVides={setMasquerVides}
                        densite={densite}
                        setDensite={setDensite}
                        onTelecharger={() => demanderTelechargementType(selectedType.id, selectedPersonne || undefined)}
                        onActualiser={fetchDocuments}
                        apercuActif={apercuActif}
                        onToggleApercu={toggleApercu}
                        extra={!selectedGroupeRole && !selectedType.parent_id && (
                            <button
                                onClick={() => setGroupByEmployee((v) => !v)}
                                title="Grouper les documents par salarié concerné"
                                className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${groupByEmployee ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                            >
                                <LuUsers2 size={16} />
                            </button>
                        )}
                        view={view}
                        setView={setView}
                    />
                    {/* Le regroupement Bénéficiaire/Intervenant/Autre n'a de sens qu'au
                        niveau racine d'un type (ex: "Bulletin de paie" qui mélange les
                        dépôts de tout le monde) — une fois descendu dans un sous-dossier
                        créé manuellement (ex: "Jacob Nyobe"), ce dossier est déjà dédié à
                        une personne/un usage précis : lui réappliquer le même éclatement
                        par rôle n'a plus de sens et créait un "Bénéficiaire"/"Intervenant"
                        vides et déroutants à l'intérieur. */}
                    {groupByEmployee && !selectedType.parent_id ? (
                        !selectedGroupeRole ? (
                            // Sous-dossiers imbriqués (ex: "Promesse d'embauche" dans "CV") dans
                            // la même grille que les dossiers Bénéficiaire/Intervenant, pas dans
                            // une section à part — ce sont tous des dossiers du même niveau.
                            <div className={classeConteneurTuiles}>
                                {typesTries.map((type) => (
                                    <TypeTile
                                        key={type.id}
                                        type={type}
                                        vue={view}
                                        hauteurClasse={DENSITE_HAUTEUR[densite]}
                                        canManage={canManageDossiers && !categorieVerrouillee}
                                        onOpen={() => ouvrirType(type)}
                                        onDownload={() => demanderTelechargementType(type.id)}
                                        onRename={() => openRenameType(type)}
                                        onDelete={() => removeSousDossier(type)}
                                    />
                                ))}
                                {GROUPES_ROLE_DOSSIER.map(({ cle, libelle }) => {
                                    const docsGroupe = documentsDuType.filter((d) => roleDuDocument(d) === cle);
                                    const tone = toneDossier(compterParGroupeStatut(docsGroupe));
                                    return (
                                        <TuileDossier
                                            key={cle}
                                            label={libelle}
                                            count={docsGroupe.length}
                                            tone={tone}
                                            vue={view}
                                            hauteurClasse={DENSITE_HAUTEUR[densite]}
                                            onClick={() => setSelectedGroupeRole(cle)}
                                        />
                                    );
                                })}
                                {documentsDuType.filter((d) => roleDuDocument(d) === 'Autre').length > 0 && (() => {
                                    const docsAutre = documentsDuType.filter((d) => roleDuDocument(d) === 'Autre');
                                    const tone = toneDossier(compterParGroupeStatut(docsAutre));
                                    return (
                                        <TuileDossier
                                            label='Autre'
                                            count={docsAutre.length}
                                            tone={tone}
                                            vue={view}
                                            hauteurClasse={DENSITE_HAUTEUR[densite]}
                                            onClick={() => setSelectedGroupeRole('Autre')}
                                        />
                                    );
                                })()}
                            </div>
                        ) : !selectedPersonne ? (
                            <div className={classeConteneurTuiles}>
                                {/* Sous-dossiers créés manuellement (ex: réserver une place au nom
                                    de quelqu'un avant son premier dépôt) — même tuile, mélangée à
                                    celles calculées à partir des documents déjà déposés. */}
                                {typesTries.map((type) => (
                                    <TypeTile
                                        key={type.id}
                                        type={type}
                                        vue={view}
                                        hauteurClasse={DENSITE_HAUTEUR[densite]}
                                        canManage={canManageDossiers && !categorieVerrouillee}
                                        onOpen={() => ouvrirType(type)}
                                        onDownload={() => demanderTelechargementType(type.id)}
                                        onRename={() => openRenameType(type)}
                                        onDelete={() => removeSousDossier(type)}
                                    />
                                ))}
                                {grouperParEmploye(documentsDuType.filter((d) => roleDuDocument(d) === selectedGroupeRole)).map(([nom, docsGroupe]) => {
                                    const tone = toneDossier(compterParGroupeStatut(docsGroupe));
                                    return (
                                        <TuileDossier
                                            key={nom}
                                            label={nom}
                                            count={docsGroupe.length}
                                            tone={tone}
                                            vue={view}
                                            hauteurClasse={DENSITE_HAUTEUR[densite]}
                                            onClick={() => setSelectedPersonne(nom)}
                                        />
                                    );
                                })}
                                {typesTries.length === 0 && documentsDuType.filter((d) => roleDuDocument(d) === selectedGroupeRole).length === 0 && (
                                    <p className='text-muted-foreground col-span-full'>Aucun dépôt pour l'instant dans ce dossier.</p>
                                )}
                            </div>
                        ) : (() => {
                            const docsPersonne = documentsTries(documentsDuType.filter((d) => roleDuDocument(d) === selectedGroupeRole && nomConcerneDuDoc(d) === selectedPersonne));
                            return (
                                <div className='flex flex-col lg:flex-row gap-4 items-start'>
                                    <div className='flex-1 min-w-0 w-full'>
                                        {view === 'grid' ? (
                                            <DocumentGrid documents={docsPersonne} getFileIcon={getFileIcon} onChanged={fetchDocuments} onApercu={ouvrirApercu} />
                                        ) : (
                                            <DocumentList documents={docsPersonne} getFileIcon={getFileIcon} onChanged={fetchDocuments} onApercu={ouvrirApercu} />
                                        )}
                                    </div>
                                    {apercuActif && (docApercu ? (
                                        <DocumentApercuPanel document={docApercu} onClose={() => setDocApercu(null)} />
                                    ) : (
                                        <div className='w-full lg:w-72 shrink-0 rounded-2xl border border-dashed border-border p-4 flex items-center justify-center text-center text-xs text-muted-foreground lg:sticky lg:top-4 lg:self-start'>
                                            Clic droit sur un document, puis « Aperçu rapide »
                                        </div>
                                    ))}
                                </div>
                            );
                        })()
                    ) : (
                        <>
                            {typesTries.length > 0 && (
                                <div className={`${classeConteneurTuiles} mb-4`}>
                                    {typesTries.map((type) => (
                                        <TypeTile
                                            key={type.id}
                                            type={type}
                                            vue={view}
                                            hauteurClasse={DENSITE_HAUTEUR[densite]}
                                            canManage={canManageDossiers && !categorieVerrouillee}
                                            onOpen={() => ouvrirType(type)}
                                            onDownload={() => demanderTelechargementType(type.id)}
                                            onRename={() => openRenameType(type)}
                                            onDelete={() => removeSousDossier(type)}
                                        />
                                    ))}
                                </div>
                            )}
                            <div className='flex flex-col lg:flex-row gap-4 items-start'>
                                <div className='flex-1 min-w-0 w-full'>
                                    {view === 'grid' ? (
                                        <DocumentGrid documents={currentDocuments} getFileIcon={getFileIcon} onChanged={fetchDocuments} onApercu={ouvrirApercu} />
                                    ) : (
                                        <DocumentList documents={currentDocuments} getFileIcon={getFileIcon} onChanged={fetchDocuments} onApercu={ouvrirApercu} />
                                    )}
                                    <Pagination
                                        currentPage={currentPage}
                                        totalPages={Math.ceil(documentsDuTypeTries.length / documentsPerPage)}
                                        onPageChange={setCurrentPage}
                                    />
                                </div>
                                {apercuActif && (docApercu ? (
                                    <DocumentApercuPanel document={docApercu} onClose={() => setDocApercu(null)} />
                                ) : (
                                    <div className='w-full lg:w-72 shrink-0 rounded-2xl border border-dashed border-border p-4 flex items-center justify-center text-center text-xs text-muted-foreground lg:sticky lg:top-4 lg:self-start'>
                                        Clic droit sur un document, puis « Aperçu rapide »
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            <dialog ref={uploadFileRef} id="uploadFileType" className="modal">
                <div className="modal-box w-3/4 max-w-xl rounded-2xl">
                    <div className='flex items-center justify-between mb-2'>
                        <h3 className="text-lg font-semibold">
                            Archiver — {selectedType?.libelle}
                        </h3>
                        <form method="dialog">
                            <button className='btn btn-sm btn-ghost btn-circle'><IoClose /></button>
                        </form>
                    </div>
                    <div className="py-3">
                        {selectedFiles.length > 0 ? (
                            <div {...getRootProps()} className='relative border-2 border-dashed border-primary/30 hover:border-primary/50 p-3 rounded-xl transition-colors cursor-pointer flex flex-col gap-2'>
                                <input {...getInputProps()} />
                                <FilePreviewCard
                                    file={selectedFiles[0]}
                                    onRemove={(e) => { e.stopPropagation(); setSelectedFiles([]); }}
                                />
                                <FileContentPreview file={selectedFiles[0]} />
                                <p className='text-xs text-muted-foreground text-center'>Cliquez ou glissez un autre fichier pour remplacer</p>
                            </div>
                        ) : (
                            <div {...getRootProps()} className='relative border-2 border-dashed border-primary/30 hover:border-primary/50 p-2 h-40 rounded-xl transition-colors cursor-pointer'>
                                <input {...getInputProps()} />
                                <div className="flex items-center flex-col gap-2 justify-center h-full text-center">
                                    <LuUploadCloud className='text-primary' size={40} />
                                    {isDragActive ?
                                        <div className='absolute top-0 rounded-xl bg-primary/5 flex items-center justify-center text-primary w-full h-full text-center'>
                                            Déposer le fichier ici...
                                        </div> :
                                        <div className='flex items-center flex-col justify-center gap-1'>
                                            <p className='text-sm font-medium'>Glisser et déposer votre document ici</p>
                                            <p className='text-xs text-muted-foreground'>.pdf, .doc(x), .odt, .xls(x), .ods, .csv, .ppt(x), .odp, .txt, .rtf, .zip, .jpg, .png</p>
                                        </div>
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                    <div className='flex flex-col gap-3'>
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>Titre</label>
                            <input type="text" value={docData.titre} name='titre' onChange={(e) => getFormData(e, setDocData)} placeholder="Titre" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>Auteur</label>
                            <input type="text" name='auteur' value={docData.auteur} onChange={(e) => getFormData(e, setDocData)} placeholder="Auteur" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>Référence</label>
                            <input type="text" name='reference' value={docData.reference} onChange={(e) => getFormData(e, setDocData)} placeholder="CM-0166" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                        <PersonnelConcerneField
                            personnelConcerneId={docData.personnel_concerne_id}
                            nomPersonneConcernee={docData.nom_personne_concernee}
                            onChange={(patch) => setDocData((prev) => ({ ...prev, ...patch }))}
                        />
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>Résumé du document</label>
                            <textarea
                                placeholder="Résumé"
                                name='resume'
                                value={docData.resume}
                                onChange={(e) => getFormData(e, setDocData)}
                                rows={3}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            ></textarea>
                        </div>
                    </div>
                    <div className="modal-action">
                        <form method="dialog">
                            <button className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Fermer</button>
                        </form>
                        <button onClick={archiveDoc} className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>
                            Archiver maintenant
                        </button>
                    </div>
                </div>
            </dialog>

            <dialog id="createSousDossier" className="modal">
                <div className="modal-box rounded-2xl">
                    <form method="dialog" className='flex justify-end'>
                        <button className='btn btn-sm btn-ghost btn-circle'><IoClose /></button>
                    </form>
                    <div className='py-2'>
                        <h1 className='text-lg font-semibold mb-1'>Nouveau dossier</h1>
                        <p className='text-sm text-muted-foreground mb-4'>
                            Dans « {selectedType ? selectedType.libelle : categorie?.libelle_cat} » — utile par exemple pour regrouper tous les documents d'un salarié ou d'un client dans un seul dossier.
                        </p>
                        <form onSubmit={createSousDossier}>
                            <div className="mb-4">
                                <label htmlFor="sousDossierLabel" className='block text-sm font-medium mb-1.5'>Nom du dossier</label>
                                <input
                                    type="text"
                                    id='sousDossierLabel'
                                    value={newTypeLabel}
                                    onChange={(e) => setNewTypeLabel(e.target.value)}
                                    placeholder="Jean Dupont"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    required
                                />
                            </div>
                            <div className="modal-action">
                                <button type="submit" disabled={creatingType} className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                                    {creatingType ? 'Création...' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </dialog>

            <dialog id="renameSousDossier" className="modal">
                <div className="modal-box rounded-2xl">
                    <form method="dialog" className='flex justify-end'>
                        <button className='btn btn-sm btn-ghost btn-circle'><IoClose /></button>
                    </form>
                    <h1 className='text-lg font-semibold mb-4'>Modifier le nom du dossier</h1>
                    <form onSubmit={saveRenameType}>
                        <div className="mb-4">
                            <label htmlFor="renameSousDossierLabel" className='block text-sm font-medium mb-1.5'>Nom du dossier</label>
                            <input
                                type="text"
                                id='renameSousDossierLabel'
                                value={renameTypeLabel}
                                onChange={(e) => setRenameTypeLabel(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                required
                            />
                        </div>
                        <div className="modal-action">
                            <button type="submit" className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>Modifier</button>
                        </div>
                    </form>
                </div>
            </dialog>

            <ShareFolderModal folder={categorie} isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} />
            <InfoDossierModal infos={infoOuvert ? infosCategorie() : null} isOpen={infoOuvert} onClose={() => setInfoOuvert(false)} />
        </div>
    );
}

export default OpenFolder
