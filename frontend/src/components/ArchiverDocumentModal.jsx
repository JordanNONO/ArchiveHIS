import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuUploadCloud, LuClock, LuCheckCircle2, LuCheck } from 'react-icons/lu';
import { getCategorieById } from '../api/routes/categorie';
import { createDocument } from '../api/routes/document';
import { getDisplayName, genererReferenceAuto } from '../utils/common';
import { nomCategorie, nomType } from '../utils/libelleLocalise';
import FilePreviewCard from './FilePreviewCard';
import FileContentPreview from './FileContentPreview';
import DestinatairesNotificationField from './DestinatairesNotificationField';

const ACCEPT_FICHIER = {
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
};


const DOC_DATA_VIDE = {
    titre: '', resume: '', auteur: '', file_create_date: '', reference: '',
    deja_traite: false, delai_jours: '', destinataires_mode: 'tous', destinataires_ids: [],
};

/**
 * Archivage "à froid" — utilisable aussi bien depuis l'accueil (aucun
 * contexte, catégorie ET sous-dossier à choisir) que depuis l'intérieur d'une
 * catégorie sur OpenFolder.jsx (`categoriePreselectionnee`, verrouillée —
 * seul le sous-dossier reste à choisir). Toujours un palier catégorie →
 * sous-dossier avant de retrouver le même formulaire — voir "Nouveau" dans
 * DossierToolbar (actionsNouveau), partout où ce bouton apparaît.
 */
function ArchiverDocumentModal({ categories, categoriePreselectionnee, dialogId = 'archiverDocumentModal', onArchive }) {
    const { t, i18n } = useTranslation();
    const currentUserName = getDisplayName(JSON.parse(sessionStorage.getItem('user') || '{}'));
    const [categorieId, setCategorieId] = useState(categoriePreselectionnee || '');
    const [types, setTypes] = useState([]);
    const [typeId, setTypeId] = useState('');
    const [chargementTypes, setChargementTypes] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [docData, setDocData] = useState({ ...DOC_DATA_VIDE, auteur: currentUserName });
    const [archivageEnCours, setArchivageEnCours] = useState(false);

    useEffect(() => {
        if (categoriePreselectionnee) setCategorieId(categoriePreselectionnee);
    }, [categoriePreselectionnee]);

    useEffect(() => {
        if (!categorieId) { setTypes([]); setTypeId(''); return; }
        setChargementTypes(true);
        getCategorieById(categorieId).then(async (res) => {
            if (res.status === 200) {
                const data = await res.json();
                setTypes(data.types || []);
            }
        }).catch(() => {}).finally(() => setChargementTypes(false));
    }, [categorieId]);

    const onDrop = useCallback((acceptedFiles) => {
        if (acceptedFiles.length === 0) return;
        // Accumule plutôt que remplace : glisser un 2e lot de fichiers sur la
        // zone (qui reste active tant que des fichiers sont sélectionnés,
        // voir plus bas) les ajoute au lot au lieu d'écraser la sélection
        // précédente — c'est ce qui permet justement d'archiver plusieurs
        // fichiers en une fois.
        setSelectedFiles((prev) => [...prev, ...acceptedFiles]);
        // Ne préremplit titre/date qu'à la toute première sélection : une fois
        // qu'un lot de plusieurs fichiers est en cours, titre/référence sont
        // de toute façon générés par fichier à l'envoi (voir archiver()).
        setDocData((prev) => (prev.titre ? prev : {
            ...prev,
            file_create_date: acceptedFiles[0].lastModified,
            titre: acceptedFiles[0].name.split('.')[0],
        }));
    }, []);

    function retirerFichier(index) {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    }

    const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: ACCEPT_FICHIER, multiple: true });

    function getFormData(e, callback) {
        callback((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    }

    function reinitialiser() {
        setCategorieId(categoriePreselectionnee || '');
        setTypes([]);
        setTypeId('');
        setSelectedFiles([]);
        setDocData({ ...DOC_DATA_VIDE, auteur: currentUserName });
    }

    async function archiver() {
        if (archivageEnCours) return;
        if (!categorieId || !typeId) {
            toast.error(t('openFolder.choisirDossierDestination'));
            return;
        }
        if (selectedFiles.length === 0) {
            toast.error(t('openFolder.selectionnerFichier'));
            return;
        }
        try {
            setArchivageEnCours(true);
            if (selectedFiles.length === 1) {
                const res = await createDocument({ ...docData, category_id: categorieId, type_document_id: typeId }, selectedFiles[0]);
                if (res.status === 201) {
                    toast.success(t('openFolder.documentArchive'));
                    reinitialiser();
                    document.getElementById(dialogId).close();
                    onArchive && onArchive();
                } else {
                    const data = await res.json().catch(() => ({}));
                    toast.error(data?.error || t('commun.erreurGenerique'));
                }
                return;
            }

            // Lot de plusieurs fichiers : un document par fichier, titre et
            // référence générés automatiquement (voir genererReferenceAuto)
            // plutôt que de demander une référence par fichier — seuls les
            // champs communs (auteur, résumé, statut, destinataires) restent
            // partagés entre tous les documents du lot.
            const categorieChoisie = (categories || []).find((c) => String(c?.id) === String(categorieId));
            let reussis = 0;
            for (let i = 0; i < selectedFiles.length; i++) {
                const fichier = selectedFiles[i];
                const donneesFichier = {
                    ...docData,
                    category_id: categorieId,
                    type_document_id: typeId,
                    titre: fichier.name.split('.')[0],
                    reference: genererReferenceAuto(categorieChoisie?.code, i),
                    file_create_date: fichier.lastModified,
                };
                try {
                    const res = await createDocument(donneesFichier, fichier);
                    if (res.status === 201) reussis++;
                } catch (error) {
                    console.log(error);
                }
            }
            if (reussis > 0) toast.success(t('openFolder.documentsArchives', { count: reussis }));
            if (reussis < selectedFiles.length) toast.error(t('openFolder.certainsDocumentsEchoues', { count: selectedFiles.length - reussis }));
            if (reussis > 0) {
                reinitialiser();
                document.getElementById(dialogId).close();
                onArchive && onArchive();
            }
        } catch (error) {
            console.log(error);
            toast.error(t('commun.erreurGenerique'));
        } finally {
            setArchivageEnCours(false);
        }
    }

    const categoriesTriees = (categories || []).filter(Boolean).sort((a, b) => (a.libelle_cat || '').localeCompare(b.libelle_cat || ''));

    return (
        <dialog id={dialogId} className='modal'>
            <div className='modal-box w-3/4 max-w-xl rounded-2xl max-h-[85vh] overflow-y-auto'>
                <div className='flex items-center justify-between mb-2'>
                    <h3 className='text-lg font-semibold'>{t('home.archiverDocument')}</h3>
                    <form method='dialog'>
                        <button onClick={reinitialiser} className='btn btn-sm btn-ghost btn-circle'>✕</button>
                    </form>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 py-2'>
                    <div>
                        <label className='block text-sm font-medium mb-1.5'>{t('openFolder.dossierLabel')} <span className='text-red-500'>*</span></label>
                        <select
                            value={categorieId}
                            onChange={(e) => setCategorieId(e.target.value)}
                            disabled={!!categoriePreselectionnee}
                            className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-70'
                        >
                            <option value=''>{t('openFolder.selectionner')}</option>
                            {categoriesTriees.map((c) => (
                                <option key={c.id} value={c.id} disabled={c.verrouille_par_utilisateur_id != null}>
                                    {nomCategorie(c, i18n.language)}{c.verrouille_par_utilisateur_id != null ? t('openFolder.suffixeVerrouille') : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className='block text-sm font-medium mb-1.5'>{t('openFolder.sousDossierLabel')} <span className='text-red-500'>*</span></label>
                        <select
                            value={typeId}
                            onChange={(e) => setTypeId(e.target.value)}
                            disabled={!categorieId || chargementTypes}
                            className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50'
                        >
                            <option value=''>{chargementTypes ? t('openFolder.chargement') : t('openFolder.selectionner')}</option>
                            {types.map((tp) => (
                                <option key={tp.id} value={tp.id}>{nomType(tp, i18n.language)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {categorieId && typeId && (
                    <div className='py-3 flex flex-col gap-3'>
                        {selectedFiles.length === 1 ? (
                            <div {...getRootProps()} className='relative border-2 border-dashed border-primary/30 hover:border-primary/50 p-3 rounded-xl transition-colors cursor-pointer flex flex-col gap-2'>
                                <input {...getInputProps()} />
                                <FilePreviewCard file={selectedFiles[0]} onRemove={(e) => { e.stopPropagation(); retirerFichier(0); }} />
                                <FileContentPreview file={selectedFiles[0]} />
                            </div>
                        ) : selectedFiles.length > 1 ? (
                            <div className='flex flex-col gap-1.5'>
                                <p className='text-xs font-medium text-muted-foreground'>
                                    {t('openFolder.nFichiersSelectionnes', { count: selectedFiles.length })}
                                </p>
                                <div className='flex flex-col gap-1 max-h-48 overflow-y-auto pr-1'>
                                    {selectedFiles.map((fichier, i) => (
                                        <FilePreviewCard key={i} file={fichier} compact onRemove={() => retirerFichier(i)} />
                                    ))}
                                </div>
                                <div {...getRootProps()} className='relative border-2 border-dashed border-primary/30 hover:border-primary/50 rounded-xl transition-colors cursor-pointer py-2.5 text-center'>
                                    <input {...getInputProps()} />
                                    <p className='text-xs text-muted-foreground'>{t('openFolder.ajouterDAutresFichiers')}</p>
                                </div>
                            </div>
                        ) : (
                            <div {...getRootProps()} className='relative border-2 border-dashed border-primary/30 hover:border-primary/50 p-2 h-32 rounded-xl transition-colors cursor-pointer'>
                                <input {...getInputProps()} />
                                <div className='flex items-center flex-col gap-2 justify-center h-full text-center'>
                                    <LuUploadCloud className='text-primary' size={32} />
                                    <p className='text-sm font-medium'>{t('openFolder.glisserDeposer')}</p>
                                </div>
                            </div>
                        )}

                        {selectedFiles.length > 1 ? (
                            <p className='text-xs text-muted-foreground rounded-lg bg-muted/60 px-3 py-2'>
                                {t('openFolder.titreEtReferenceAuto')}
                            </p>
                        ) : (
                            <>
                                <div>
                                    <label className='block text-sm font-medium mb-1.5'>{t('openFolder.titre')} <span className='text-red-500'>*</span></label>
                                    <input type='text' name='titre' value={docData.titre} onChange={(e) => getFormData(e, setDocData)} placeholder={t('openFolder.titre')} required className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium mb-1.5'>{t('openFolder.reference')} <span className='text-red-500'>*</span></label>
                                    <input type='text' name='reference' value={docData.reference} onChange={(e) => getFormData(e, setDocData)} placeholder='CM-0166' required className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
                                </div>
                            </>
                        )}
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>{t('openFolder.auteur')} <span className='text-red-500'>*</span></label>
                            <input type='text' name='auteur' value={docData.auteur} onChange={(e) => getFormData(e, setDocData)} placeholder={t('openFolder.auteur')} required className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
                        </div>
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>{t('openFolder.resumeDocument')}</label>
                            <textarea placeholder={t('openFolder.resumeDocument')} name='resume' value={docData.resume} onChange={(e) => getFormData(e, setDocData)} rows={3} className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
                        </div>

                        <DestinatairesNotificationField
                            mode={docData.destinataires_mode}
                            selectionIds={docData.destinataires_ids}
                            onChange={(patch) => setDocData((prev) => ({ ...prev, ...patch }))}
                        />

                        <div>
                            <label className='block text-sm font-medium mb-1.5'>{t('openFolder.statutArchivage')}</label>
                            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5'>
                                <button
                                    type='button'
                                    onClick={() => setDocData((prev) => ({ ...prev, deja_traite: false }))}
                                    className={`relative flex flex-col gap-2.5 rounded-xl border-[1.5px] px-3.5 py-3 text-left transition-all duration-150 ${!docData.deja_traite ? 'border-accent bg-accent/10 shadow-[0_0_0_3px_rgba(250,204,21,0.15)]' : 'border-border hover:border-accent/40'}`}
                                >
                                    <div className='flex items-center gap-2.5'>
                                        <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-accent/20 text-accent-foreground shrink-0'>
                                            <LuClock size={15} />
                                        </span>
                                        <span className='flex-1 min-w-0 text-sm font-semibold text-foreground'>{t('openFolder.necessiteTraitement')}</span>
                                        <span className={`flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 ${!docData.deja_traite ? 'border-accent bg-accent' : 'border-border'}`}>
                                            {!docData.deja_traite && <LuCheck size={11} className='text-accent-foreground' strokeWidth={3} />}
                                        </span>
                                    </div>
                                    {!docData.deja_traite && (
                                        <div className='flex items-center gap-2 pl-[42px]' onClick={(e) => e.stopPropagation()}>
                                            <span className='text-xs text-muted-foreground shrink-0'>{t('openFolder.joursNecessaires')}</span>
                                            <input
                                                type='number' min='1' max='365' name='delai_jours' value={docData.delai_jours}
                                                onChange={(e) => getFormData(e, setDocData)} placeholder='ex: 7'
                                                className='w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                                            />
                                        </div>
                                    )}
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setDocData((prev) => ({ ...prev, deja_traite: true }))}
                                    className={`relative flex items-center gap-2.5 rounded-xl border-[1.5px] px-3.5 py-3 text-left transition-all duration-150 ${docData.deja_traite ? 'border-green-600 bg-green-600/10 shadow-[0_0_0_3px_rgba(22,163,74,0.15)]' : 'border-border hover:border-green-600/40'}`}
                                >
                                    <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-green-600/15 text-green-700 shrink-0'>
                                        <LuCheckCircle2 size={15} />
                                    </span>
                                    <span className='flex-1 min-w-0 text-sm font-semibold text-foreground'>{t('openFolder.dejaTraite')}</span>
                                    <span className={`flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 ${docData.deja_traite ? 'border-green-600 bg-green-600' : 'border-border'}`}>
                                        {docData.deja_traite && <LuCheck size={11} className='text-white' strokeWidth={3} />}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className='modal-action'>
                    <form method='dialog'>
                        <button onClick={reinitialiser} className='rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors'>{t('openFolder.fermer')}</button>
                    </form>
                    <button
                        onClick={archiver}
                        disabled={archivageEnCours || !categorieId || !typeId}
                        className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                    >
                        {archivageEnCours ? t('openFolder.archivageEnCours') : t('openFolder.archiverMaintenant')}
                    </button>
                </div>
            </div>
        </dialog>
    );
}

export default ArchiverDocumentModal;
