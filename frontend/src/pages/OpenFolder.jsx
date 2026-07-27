import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import { FaFilePdf, FaFileWord, FaFileExcel, FaFilePowerpoint, FaFileImage, FaFileLines, FaFileZipper, FaFile } from 'react-icons/fa6';
import { LuArrowLeft, LuFolder, LuBookOpen, LuFileEdit, LuTrash2, LuUploadCloud, LuUsers2, LuPlus, LuSearch, LuMoreVertical, LuDownload } from 'react-icons/lu';
import { IoClose } from 'react-icons/io5';
import { getCategorieById, downloadCategorie } from '../api/routes/categorie';
import { createDocument } from '../api/routes/document';
import { createTypeDocument, updateTypeDocument, deleteTypeDocument, downloadTypeDocument } from '../api/routes/typeDocument';
import DocumentList from '../components/DocumentList';
import DocumentGrid from '../components/DocumentGrid';
import ViewToggleButtons from '../components/ViewToggleButtons';
import Breadcrumbs from '../components/Breadcrumbs';
import Pagination from '../components/Pagination';
import FilePreviewCard from '../components/FilePreviewCard';
import FileContentPreview from '../components/FileContentPreview';
import PersonnelConcerneField from '../components/PersonnelConcerneField';
import { getFileTypeVisual } from '../utils/fileTypeIcons';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../contexts/ConfirmDialogContext';

function OpenFolder() {
    const {id} = useParams()
    const navigate = useNavigate()
    const confirm = useConfirm();
    const { isAdministrator, hasPermission } = usePermissions();
    const canManageDossiers = isAdministrator || hasPermission('gerer_categories');
    const [documents, setDocuments] = useState([]);
    const [types, setTypes] = useState([]);
    const [categorie, setCategorie] = useState({});
    const [selectedType, setSelectedType] = useState(null);
    const [view,setView] = useState('grid')
    const [groupByEmployee, setGroupByEmployee] = useState(false);
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
        auteur: "",
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
            const res = await createTypeDocument({ categorie_id: id, libelle: newTypeLabel });
            setCreatingType(false);
            if (res.status === 201) {
                toast.success('Dossier créé avec succès');
                setNewTypeLabel('');
                document.getElementById('createSousDossier').close();
                fetchDocuments();
            } else {
                toast.error("Une erreur s'est produite");
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
                toast.error("Une erreur s'est produite");
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

    function demanderTelechargementType(typeId){
        downloadTypeDocument(typeId).then(async (res) => {
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
        deleteTypeDocument(type.id).then((res) => {
            if (res.status === 200) {
                toast.success('Dossier supprimé avec succès');
                fetchDocuments();
            } else {
                toast.error("Une erreur s'est produite");
            }
        }).catch((err) => {
            console.log(err);
            toast.error("Une erreur s'est produite");
        });
    }

    const fetchDocuments = () => {
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
    };

    useEffect(() => {
        fetchDocuments();
    }, [id]);

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
                setDocData({ titre: "", resume: "", auteur: "", file_create_date: "", reference: "", personnel_concerne_id: '', nom_personne_concernee: '' });
                setSelectedFiles([]);
                fetchDocuments();
                if (uploadFileRef.current) uploadFileRef.current.close();
            } else {
                toast.error("Une erreur s'est produite");
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

    const terme = searchTerm.trim().toLocaleLowerCase();

    /**
     * Recherche élargie : titre, référence, auteur et résumé, pas seulement le titre.
     */
    function correspondAuTerme(d) {
        return String(d.titre_document).toLocaleLowerCase().includes(terme)
            || String(d.code_reference).toLocaleLowerCase().includes(terme)
            || String(d.auteur).toLocaleLowerCase().includes(terme)
            || String(d.resume).toLocaleLowerCase().includes(terme);
    }

    const documentsDuType = selectedType
        ? documents.filter((d) => d.type_document_id === selectedType.id)
            .filter((d) => terme === '' || correspondAuTerme(d))
        : [];

    // Vue "sous-dossiers" (types) : la recherche filtre les sous-dossiers par nom,
    // et remonte aussi les documents qui matchent à l'intérieur, quel que soit leur type.
    const typesFiltres = terme === ''
        ? types
        : types.filter((t) => String(t.libelle).toLocaleLowerCase().includes(terme));
    const documentsTrouvesDansLaCategorie = terme === ''
        ? []
        : documents.filter(correspondAuTerme);

    /**
     * Regroupe les documents d'un type par salarié concerné (ex: tous les CV
     * de Jean Dupont ensemble), plutôt que par simple ordre d'archivage —
     * utile pour un dossier comme "Contrat & Dossier salarié" où chaque type
     * contient les documents de plusieurs employés mélangés.
     */
    function grouperParEmploye(docs) {
        const groupes = new Map();
        docs.forEach((doc) => {
            const nom = doc.personnel_concerne
                ? `${doc.personnel_concerne.prenom || ''} ${doc.personnel_concerne.nom || ''}`.trim()
                : (doc.nom_personne_concernee || 'Non renseigné');
            if (!groupes.has(nom)) groupes.set(nom, []);
            groupes.get(nom).push(doc);
        });
        return Array.from(groupes.entries()).sort(([a], [b]) => a.localeCompare(b));
    }

    const indexOfLastDocument = currentPage * documentsPerPage;
    const indexOfFirstDocument = indexOfLastDocument - documentsPerPage;
    const currentDocuments = documentsDuType.slice(indexOfFirstDocument, indexOfLastDocument);

    return (
        <div className='w-full py-6'>
            <Breadcrumbs where={selectedType ? `${categorie?.libelle_cat} / ${selectedType.libelle}` : categorie?.libelle_cat} backTo="/" />

            {!selectedType ? (
                <>
                    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1 mb-4'>
                        <h2 className='text-2xl font-semibold text-foreground'>{categorie?.libelle_cat}</h2>
                        <div className='flex items-center gap-2 shrink-0'>
                            <button
                                onClick={demanderTelechargementCategorie}
                                className='inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors'
                            >
                                <LuDownload size={16} />
                                Télécharger
                            </button>
                            <button
                                onClick={() => document.getElementById('createSousDossier').showModal()}
                                className='inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors'
                            >
                                <LuPlus size={16} />
                                Nouveau dossier
                            </button>
                        </div>
                    </div>
                    <div className='relative w-full sm:w-64 mb-6'>
                        <LuSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={onSearchChange}
                            className="w-full rounded-lg bg-muted border-none pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                            placeholder="Rechercher un dossier ou un document..."
                        />
                    </div>
                    <div className='grid lg:grid-cols-6 md:grid-cols-4 sm:grid-cols-3 grid-cols-2 gap-4 w-full'>
                        {typesFiltres.map((type) => (
                            <div key={type.id} className='relative group'>
                                <button
                                    onClick={() => { setSelectedType(type); setCurrentPage(1); }}
                                    className='relative flex flex-col items-center justify-center gap-2 h-[150px] rounded-2xl border border-border bg-card p-5 text-center hover:border-primary/40 hover:shadow-md transition-all duration-200 w-full'
                                >
                                    <span className='absolute top-2.5 left-2.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-secondary/10 text-secondary text-xs font-semibold flex items-center justify-center'>
                                        {type.document_archives_count ?? 0}
                                    </span>
                                    <LuFolder size={40} className='text-secondary' strokeWidth={1.5} />
                                    <span className='text-sm font-medium text-foreground line-clamp-2'>{type.libelle}</span>
                                    {type.code && <span className='text-[11px] text-muted-foreground'>{type.code}</span>}
                                </button>

                                <div className='dropdown dropdown-end absolute top-1.5 right-1.5 z-10'>
                                    <button
                                        tabIndex={0}
                                        onClick={(e) => e.stopPropagation()}
                                        className='flex items-center justify-center w-7 h-7 rounded-lg bg-card/90 text-muted-foreground opacity-70 hover:opacity-100 hover:bg-muted hover:text-foreground transition-all'
                                    >
                                        <LuMoreVertical size={14} />
                                    </button>
                                    <div tabIndex={0} className='dropdown-content flex items-center gap-1 bg-card border border-border rounded-xl z-20 p-1.5 shadow-lg mt-1'>
                                        <button title="Ouvrir le dossier" onClick={() => { setSelectedType(type); setCurrentPage(1); }} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
                                            <LuBookOpen size={15} />
                                        </button>
                                        <button title="Télécharger le dossier" onClick={() => demanderTelechargementType(type.id)} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
                                            <LuDownload size={15} />
                                        </button>
                                        <button title="Renommer le dossier" disabled={!canManageDossiers} onClick={() => openRenameType(type)} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
                                            <LuFileEdit size={15} />
                                        </button>
                                        <button title="Supprimer le dossier" disabled={!canManageDossiers} onClick={() => removeSousDossier(type)} className='flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'>
                                            <LuTrash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {typesFiltres.length === 0 && (
                            <p className='text-muted-foreground col-span-full'>
                                {types.length === 0 ? 'Aucune sous-catégorie définie pour ce dossier.' : 'Aucun dossier ne correspond à votre recherche.'}
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
                                onClick={() => setSelectedType(null)}
                                className='flex items-center justify-center w-9 h-9 rounded-lg border border-border hover:bg-muted transition-colors shrink-0'
                            >
                                <LuArrowLeft size={16} />
                            </button>
                            <h2 className='text-2xl font-semibold text-foreground truncate'>{selectedType.libelle}</h2>
                        </div>
                        <div className='flex items-center gap-3 shrink-0'>
                            <button
                                onClick={() => document.getElementById('uploadFileType').showModal()}
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors"
                            >
                                <LuUploadCloud size={17} />
                                Archiver un document
                            </button>
                            <button
                                onClick={() => setGroupByEmployee((v) => !v)}
                                title="Grouper les documents par salarié concerné"
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${groupByEmployee ? 'bg-primary/10 text-primary' : 'border border-border text-muted-foreground hover:bg-muted'}`}
                            >
                                <LuUsers2 size={15} />
                                Grouper par salarié
                            </button>
                            <ViewToggleButtons view={view} setView={setView} />
                        </div>
                    </div>
                    <div className='relative w-full sm:w-64 mb-6'>
                        <LuSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={onSearchChange}
                            className="w-full rounded-lg bg-muted border-none pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                            placeholder="Rechercher un document..."
                        />
                    </div>
                    {groupByEmployee ? (
                        <div className='flex flex-col gap-8'>
                            {grouperParEmploye(documentsDuType).map(([nom, docsGroupe]) => (
                                <div key={nom}>
                                    <div className='flex items-center gap-2 mb-3'>
                                        <div className='flex items-center justify-center w-7 h-7 rounded-full bg-secondary/10 text-secondary text-xs font-semibold shrink-0'>
                                            {nom.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                                        </div>
                                        <h3 className='text-sm font-semibold text-foreground'>{nom}</h3>
                                        <span className='text-xs text-muted-foreground'>({docsGroupe.length} document{docsGroupe.length > 1 ? 's' : ''})</span>
                                    </div>
                                    {view === 'grid' ? (
                                        <DocumentGrid documents={docsGroupe} getFileIcon={getFileIcon} onChanged={fetchDocuments} />
                                    ) : (
                                        <DocumentList documents={docsGroupe} getFileIcon={getFileIcon} onChanged={fetchDocuments} />
                                    )}
                                </div>
                            ))}
                            {documentsDuType.length === 0 && (
                                <p className='text-muted-foreground text-center py-8'>Aucun document dans ce type.</p>
                            )}
                        </div>
                    ) : (
                        <>
                            {view === 'grid' ? (
                                <DocumentGrid documents={currentDocuments} getFileIcon={getFileIcon} onChanged={fetchDocuments} />
                            ) : (
                                <DocumentList documents={currentDocuments} getFileIcon={getFileIcon} onChanged={fetchDocuments} />
                            )}
                            <Pagination
                                currentPage={currentPage}
                                totalPages={Math.ceil(documentsDuType.length / documentsPerPage)}
                                onPageChange={setCurrentPage}
                            />
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
                            Dans « {categorie?.libelle_cat} » — utile par exemple pour regrouper tous les documents d'un salarié ou d'un client dans un seul dossier.
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
        </div>
    );
}

export default OpenFolder
