import React, { useEffect, useState, useCallback } from 'react';
import MenuDeroulant from '../components/MenuDeroulant';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuLoader, LuPlus, LuAlertTriangle, LuCheck, LuTrash2, LuArchive, LuRotateCcw, LuPencil, LuX, LuDownload, LuRefreshCw, LuLock, LuClipboardList, LuChevronRight } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import { useConfirm } from '../contexts/ConfirmDialogContext';
import { getPaiDossier, createPaiObjectif, togglePaiObjectif, deletePaiObjectif, updatePaiObjectif, updatePaiDossier, cloturerPaiDossier, reouvrirPaiDossier, resynchroniserPaiDossier } from '../api/routes/pai';
import { getPersonnels } from '../api/routes/personnel';
import { genererPdfPai } from '../utils/paiPdf';
import { usePermissions } from '../hooks/usePermissions';

// Préfixe plutôt que nom exact : "RS" (générique) et ses déclinaisons par
// spécialité (RS_QUALITE, RS_EXPLOITATION, RS_COORDINATION) partagent toutes
// le même accès — voir la migration creer_roles_specialises_responsable_secteur.
const PREFIXE_CODE_ROLE_RESPONSABLE_SECTEUR = 'RS';

// Libellés des consignes reçues de HisSAP (clés de hisdocs_pai.php).
const LIBELLES_CONSIGNES = {
    particularites: 'Particularités',
    organisation_des_prestations: 'Organisation des prestations',
    description_des_interventions: 'Description des interventions',
    moyens: 'Moyens',
    dispositifs_a_mettre_en_place: 'Dispositifs à mettre en place',
    coordination_partenaires: 'Coordination avec les partenaires',
    consignes_speciales: 'Consignes spéciales',
    cahier_de_courses: 'Cahier de courses',
    cahier_de_liaison: 'Cahier de liaison',
    remise_de_cle: 'Remise de clé',
    absence_ou_retard: "En cas d'absence ou de retard",
    niveau_de_remplacement: 'Niveau de remplacement',
    comportements_particuliers: 'Comportements particuliers',
};

const LIBELLES_SANTE = {
    pathologie: 'Pathologie',
    traitement: 'Traitement',
    medecin: 'Médecin',
    historique_pathologie: 'Historique de la pathologie',
};

function Champ({ label, valeur }) {
    if (!valeur) return null;
    return (
        <div>
            <dt className='text-[11px] font-medium text-muted-foreground'>{label}</dt>
            <dd className='text-sm text-foreground whitespace-pre-line'>{valeur}</dd>
        </div>
    );
}

function PaiDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const confirm = useConfirm();
    // Dossier visible par tout le personnel interne, mais modifier/clôturer/
    // réouvrir le dossier et gérer ses objectifs (ajouter/cocher/modifier/
    // supprimer) reste réservé à gerer_pai.
    const { hasPermission, isAdministrator } = usePermissions();
    const peutGererPai = isAdministrator || hasPermission('gerer_pai');
    const [dossier, setDossier] = useState(null);
    const [loading, setLoading] = useState(true);
    const [nouvelObjectif, setNouvelObjectif] = useState({ description: '', echeance: '' });
    const [ajoutEnCours, setAjoutEnCours] = useState(false);
    const [editionId, setEditionId] = useState(null);
    const [editionForm, setEditionForm] = useState({ description: '', echeance: '' });
    const [editionEnCours, setEditionEnCours] = useState(false);
    // Filet contre le double-clic sur la coche : sans ça, deux clics rapprochés
    // cochent puis décochent aussitôt (deux bascules), ce qui donne l'impression
    // que rien ne s'est passé — même défaut que le double-archivage.
    const [toggleEnCoursId, setToggleEnCoursId] = useState(null);
    const [responsables, setResponsables] = useState([]);
    const [editionDossier, setEditionDossier] = useState({ titre: '', nom_beneficiaire: '', responsable_secteur_id: '', description: '' });
    const [editionDossierEnCours, setEditionDossierEnCours] = useState(false);
    const [exportEnCours, setExportEnCours] = useState(false);
    const [synchroEnCours, setSynchroEnCours] = useState(false);

    const fetchDossier = useCallback(() => {
        setLoading(true);
        getPaiDossier(id)
            .then(async (res) => {
                if (res.status === 200) setDossier(await res.json());
                else toast.error("Ce dossier n'est pas accessible");
            })
            .catch(() => toast.error('Erreur de chargement'))
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => { fetchDossier(); }, [fetchDossier]);

    useEffect(() => {
        getPersonnels().then(async (res) => {
            if (res.status === 200) {
                const data = await res.json();
                setResponsables(data.filter((p) => p.user?.roles?.some((r) => r.code_role?.startsWith(PREFIXE_CODE_ROLE_RESPONSABLE_SECTEUR))));
            }
        }).catch(() => {});
    }, []);

    function ouvrirEditionDossier() {
        setEditionDossier({
            titre: dossier.titre,
            nom_beneficiaire: dossier.nom_beneficiaire,
            responsable_secteur_id: dossier.responsable_secteur?.id || '',
            description: dossier.description || '',
        });
        document.getElementById('edition_pai').showModal();
    }

    async function enregistrerEditionDossier(e) {
        e.preventDefault();
        try {
            setEditionDossierEnCours(true);
            const res = await updatePaiDossier(id, editionDossier);
            if (res.status === 200) {
                toast.success('Dossier mis à jour');
                document.getElementById('edition_pai').close();
                fetchDossier();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || Object.values(data?.errors || {})[0]?.[0] || 'La modification a échoué');
            }
        } finally {
            setEditionDossierEnCours(false);
        }
    }

    async function exporterPdf() {
        try {
            setExportEnCours(true);
            const blob = await genererPdfPai(dossier);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${dossier.titre}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("L'export a échoué");
        } finally {
            setExportEnCours(false);
        }
    }

    async function resynchroniser() {
        try {
            setSynchroEnCours(true);
            const res = await resynchroniserPaiDossier(id);
            const data = await res.json().catch(() => ({}));
            if (res.status === 200) {
                toast.success(data.modifie ? 'Dossier mis à jour depuis HisSAP' : 'Déjà à jour avec HisSAP');
                if (data.modifie) fetchDossier();
            } else {
                toast.error(data?.error || 'La synchronisation a échoué');
            }
        } catch {
            toast.error('La synchronisation a échoué');
        } finally {
            setSynchroEnCours(false);
        }
    }

    async function ajouterObjectif(e) {
        e.preventDefault();
        if (!nouvelObjectif.description.trim() || !nouvelObjectif.echeance) return;
        try {
            setAjoutEnCours(true);
            const res = await createPaiObjectif(id, nouvelObjectif);
            if (res.status === 201) {
                setNouvelObjectif({ description: '', echeance: '' });
                fetchDossier();
            } else {
                toast.error("L'ajout a échoué");
            }
        } finally {
            setAjoutEnCours(false);
        }
    }

    async function toggle(objectifId) {
        if (toggleEnCoursId) return;
        try {
            setToggleEnCoursId(objectifId);
            const res = await togglePaiObjectif(objectifId);
            if (res.status === 200) fetchDossier();
            else toast.error('Une erreur est survenue');
        } finally {
            setToggleEnCoursId(null);
        }
    }

    function commencerEdition(o) {
        setEditionId(o.id);
        setEditionForm({ description: o.description, echeance: o.echeance });
    }

    function annulerEdition() {
        setEditionId(null);
    }

    async function enregistrerEdition(objectifId) {
        if (!editionForm.description.trim() || !editionForm.echeance) return;
        try {
            setEditionEnCours(true);
            const res = await updatePaiObjectif(objectifId, editionForm);
            if (res.status === 200) {
                setEditionId(null);
                fetchDossier();
            } else {
                toast.error('La modification a échoué');
            }
        } finally {
            setEditionEnCours(false);
        }
    }

    async function supprimer(objectifId) {
        if (!await confirm({ message: 'Supprimer cet objectif ?', danger: true })) return;
        const res = await deletePaiObjectif(objectifId);
        if (res.status === 200) fetchDossier();
        else toast.error('Une erreur est survenue');
    }

    async function basculerCloture() {
        const action = dossier.date_cloture ? reouvrirPaiDossier : cloturerPaiDossier;
        const res = await action(id);
        if (res.status === 200) {
            toast.success(dossier.date_cloture ? 'Dossier réouvert' : 'Dossier clôturé');
            fetchDossier();
        } else {
            toast.error('Une erreur est survenue');
        }
    }

    if (loading) {
        return <div className='flex items-center justify-center py-16 text-muted-foreground'><LuLoader className='animate-spin' size={22} /></div>;
    }
    if (!dossier) return null;

    return (
        <div className='flex flex-col w-full gap-5 py-4 max-w-2xl mx-auto'>
            {/* Pas de backTo="/pai" (retombait sur un chemin fixe, sans les
                paramètres de recherche/filtre de la liste) — navigate(-1) par
                défaut restaure l'URL exacte quittée, recherche comprise
                (retour utilisateur : "c'est comme ça partout"). */}
            <Breadcrumbs where={dossier.titre} />

            <div className='rounded-2xl border border-border bg-card p-5'>
                <div className='flex items-start justify-between gap-3'>
                    <div>
                        <div className='flex items-center gap-2'>
                            <h1 className='text-xl font-bold text-foreground'>{dossier.titre}</h1>
                            <span className={`inline-flex items-center gap-1 rounded-full text-[11px] font-semibold px-2 py-0.5 ${dossier.date_cloture ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dossier.date_cloture ? 'bg-muted-foreground' : 'bg-primary animate-pulse'}`} />
                                {dossier.date_cloture ? 'Clôturé' : 'En cours'}
                            </span>
                        </div>
                        <p className='text-sm text-muted-foreground mt-0.5'>{dossier.nom_beneficiaire}</p>
                    </div>
                    <div className='shrink-0 flex flex-wrap items-center justify-end gap-2'>
                        <button
                            onClick={exporterPdf}
                            disabled={exportEnCours}
                            className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50'
                        >
                            <LuDownload size={13} /> {exportEnCours ? 'Export...' : 'Exporter'}
                        </button>
                        {peutGererPai && (
                            <>
                                <button
                                    onClick={ouvrirEditionDossier}
                                    className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors'
                                >
                                    <LuPencil size={13} /> Modifier
                                </button>
                                <button
                                    onClick={basculerCloture}
                                    className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors'
                                >
                                    {dossier.date_cloture ? <><LuRotateCcw size={13} /> Réouvrir</> : <><LuArchive size={13} /> Clôturer</>}
                                </button>
                            </>
                        )}
                    </div>
                </div>
                {dossier.description && <p className='text-sm text-muted-foreground mt-3'>{dossier.description}</p>}
                <div className='flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground'>
                    <span>Responsable : <span className='font-medium text-foreground'>{dossier.responsable_secteur?.nom}</span></span>
                    <span>Ouvert le {new Date(dossier.date_ouverture).toLocaleDateString('fr-FR')}</span>
                    {dossier.date_cloture && <span className='text-destructive'>Clôturé le {new Date(dossier.date_cloture).toLocaleDateString('fr-FR')}</span>}
                </div>
            </div>

            <button
                type='button'
                onClick={() => navigate(`/pai/${id}/protocole`)}
                className='rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-3 text-left hover:border-primary/40 hover:shadow-sm transition-all'
            >
                <div className='flex items-center gap-3'>
                    <span className='shrink-0 w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center'>
                        <LuClipboardList size={18} />
                    </span>
                    <div>
                        <h2 className='text-sm font-semibold text-foreground'>Protocole de prise en charge</h2>
                        <p className='text-xs text-muted-foreground mt-0.5'>
                            {dossier.protocole_maj_le
                                ? `Mis à jour le ${new Date(dossier.protocole_maj_le).toLocaleDateString('fr-FR')}${dossier.protocole_maj_par ? ' par ' + dossier.protocole_maj_par : ''}`
                                : (peutGererPai ? 'Pas encore rédigé — cliquez pour le créer' : 'Pas encore rédigé')}
                        </p>
                    </div>
                </div>
                <LuChevronRight size={16} className='text-muted-foreground shrink-0' />
            </button>

            {dossier.hissap && (
                <div className='rounded-2xl border border-border bg-card overflow-hidden'>
                    <div className='px-5 py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-2'>
                        <div>
                            <h2 className='text-sm font-semibold text-foreground'>Informations HisSAP</h2>
                            {dossier.synchronise_le && (
                                <p className='text-[11px] text-muted-foreground'>Synchronisé le {new Date(dossier.synchronise_le).toLocaleString('fr-FR')} · à modifier dans HisSAP</p>
                            )}
                        </div>
                        {peutGererPai && (
                            <button
                                onClick={resynchroniser}
                                disabled={synchroEnCours}
                                className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50'
                            >
                                <LuRefreshCw size={13} className={synchroEnCours ? 'animate-spin' : ''} /> Resynchroniser
                            </button>
                        )}
                    </div>
                    <div className='p-5 flex flex-col gap-5'>
                        <dl className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                            <Champ label='Né(e) le' valeur={dossier.hissap.beneficiaire?.date_naissance && new Date(dossier.hissap.beneficiaire.date_naissance).toLocaleDateString('fr-FR')} />
                            <Champ label='Téléphone' valeur={dossier.hissap.beneficiaire?.telephone} />
                            <Champ label='Adresse' valeur={dossier.hissap.beneficiaire?.adresse} />
                            <Champ label='Responsable secteur (HisSAP)' valeur={dossier.hissap.responsable_secteur} />
                        </dl>

                        {(dossier.hissap.tuteur?.nom || dossier.hissap.tuteur?.prenom) && (
                            <div>
                                <h3 className='text-xs font-semibold text-foreground mb-2'>Tuteur</h3>
                                <dl className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                                    <Champ label='Nom' valeur={[dossier.hissap.tuteur.prenom, dossier.hissap.tuteur.nom].filter(Boolean).join(' ')} />
                                    <Champ label='Lien' valeur={dossier.hissap.tuteur.lien} />
                                    <Champ label='Téléphone' valeur={[dossier.hissap.tuteur.telephone, dossier.hissap.tuteur.telephone_fixe].filter(Boolean).join(' · ')} />
                                    <Champ label='E-mail' valeur={dossier.hissap.tuteur.email} />
                                    <Champ label='Adresse' valeur={dossier.hissap.tuteur.adresse} />
                                </dl>
                            </div>
                        )}

                        {Object.keys(dossier.hissap.consignes || {}).length > 0 && (
                            <div>
                                <h3 className='text-xs font-semibold text-foreground mb-2'>Consignes d'intervention</h3>
                                <dl className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                                    {Object.entries(dossier.hissap.consignes).map(([cle, valeur]) => (
                                        <Champ key={cle} label={LIBELLES_CONSIGNES[cle] || cle} valeur={valeur} />
                                    ))}
                                </dl>
                            </div>
                        )}

                        {dossier.hissap.sante && Object.values(dossier.hissap.sante).some(Boolean) && (
                            <div className='rounded-xl border border-border bg-muted/30 p-4'>
                                <h3 className='text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5'><LuLock size={12} /> Données de santé</h3>
                                <dl className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                                    {Object.entries(dossier.hissap.sante).map(([cle, valeur]) => (
                                        <Champ key={cle} label={LIBELLES_SANTE[cle] || cle} valeur={valeur} />
                                    ))}
                                </dl>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className='rounded-2xl border border-border bg-card overflow-hidden'>
                <div className='px-5 py-3.5 border-b border-border flex items-center justify-between'>
                    <h2 className='text-sm font-semibold text-foreground'>Objectifs</h2>
                    <span className='text-xs text-muted-foreground tabular-nums'>{dossier.objectifs.filter((o) => o.fait).length}/{dossier.objectifs.length} réalisés</span>
                </div>
                {dossier.objectifs.length === 0 ? (
                    <p className='text-sm text-muted-foreground text-center py-8'>Aucun objectif pour l'instant</p>
                ) : (
                    <div className='divide-y divide-border'>
                        {dossier.objectifs.map((o) => (
                            editionId === o.id ? (
                                <div key={o.id} className='flex items-center gap-2 px-5 py-3 bg-muted/20'>
                                    <input
                                        type='text'
                                        value={editionForm.description}
                                        onChange={(e) => setEditionForm({ ...editionForm, description: e.target.value })}
                                        className='flex-1 min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                                    />
                                    <input
                                        type='date'
                                        value={editionForm.echeance}
                                        onChange={(e) => setEditionForm({ ...editionForm, echeance: e.target.value })}
                                        className='shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                                    />
                                    <button
                                        onClick={() => enregistrerEdition(o.id)}
                                        disabled={editionEnCours || !editionForm.description.trim() || !editionForm.echeance}
                                        className='shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-colors'
                                    >
                                        <LuCheck size={14} />
                                    </button>
                                    <button onClick={annulerEdition} className='shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors'>
                                        <LuX size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div key={o.id} className='flex items-center gap-3 px-5 py-3'>
                                    {peutGererPai ? (
                                        <button
                                            onClick={() => toggle(o.id)}
                                            disabled={toggleEnCoursId === o.id}
                                            className={`flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-colors disabled:opacity-50 ${o.fait ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'}`}
                                        >
                                            {toggleEnCoursId === o.id ? <LuLoader size={10} className='animate-spin text-primary' /> : (o.fait && <LuCheck size={11} className='text-white' strokeWidth={3} />)}
                                        </button>
                                    ) : (
                                        <span className={`flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 ${o.fait ? 'bg-primary border-primary' : 'border-border'}`}>
                                            {o.fait && <LuCheck size={11} className='text-white' strokeWidth={3} />}
                                        </span>
                                    )}
                                    <div className='flex-1 min-w-0'>
                                        <p className={`text-sm ${o.fait ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{o.description}</p>
                                        <p className='text-[11px] text-muted-foreground mt-0.5'>
                                            {o.fait
                                                ? `Réalisé le ${new Date(o.date_realisation).toLocaleDateString('fr-FR')}${o.realise_par ? ' par ' + o.realise_par : ''}`
                                                : `Échéance : ${new Date(o.echeance).toLocaleDateString('fr-FR')}`}
                                        </p>
                                    </div>
                                    {o.en_retard && (
                                        <span className='shrink-0 inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold px-2 py-0.5'>
                                            <LuAlertTriangle size={11} /> En retard
                                        </span>
                                    )}
                                    {peutGererPai && (
                                        <>
                                            <button onClick={() => commencerEdition(o)} className='shrink-0 text-muted-foreground hover:text-primary transition-colors'>
                                                <LuPencil size={14} />
                                            </button>
                                            <button onClick={() => supprimer(o.id)} className='shrink-0 text-muted-foreground hover:text-destructive transition-colors'>
                                                <LuTrash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            )
                        ))}
                    </div>
                )}
                {peutGererPai && (
                <form onSubmit={ajouterObjectif} className='flex items-center gap-2 px-5 py-3 border-t border-border bg-muted/30'>
                    <input
                        type='text'
                        value={nouvelObjectif.description}
                        onChange={(e) => setNouvelObjectif({ ...nouvelObjectif, description: e.target.value })}
                        placeholder='Nouvel objectif...'
                        className='flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                    />
                    <input
                        type='date'
                        value={nouvelObjectif.echeance}
                        onChange={(e) => setNouvelObjectif({ ...nouvelObjectif, echeance: e.target.value })}
                        className='shrink-0 rounded-lg border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                    />
                    <button
                        type='submit'
                        disabled={ajoutEnCours || !nouvelObjectif.description.trim() || !nouvelObjectif.echeance}
                        className='shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-colors'
                    >
                        <LuPlus size={16} />
                    </button>
                </form>
                )}
            </div>

            <dialog id='edition_pai' className='modal'>
                <div className='modal-box rounded-2xl'>
                    <form method='dialog'>
                        <button className='btn btn-sm btn-circle btn-ghost absolute right-2 top-2'>✕</button>
                    </form>
                    <h1 className='text-lg font-semibold mb-4'>Modifier le dossier</h1>
                    <form onSubmit={enregistrerEditionDossier} className='flex flex-col gap-3'>
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>Titre <span className='text-red-500'>*</span></label>
                            <input
                                type='text'
                                required
                                value={editionDossier.titre}
                                onChange={(e) => setEditionDossier({ ...editionDossier, titre: e.target.value })}
                                className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                            />
                        </div>
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>Bénéficiaire <span className='text-red-500'>*</span></label>
                            <input
                                type='text'
                                required
                                value={editionDossier.nom_beneficiaire}
                                onChange={(e) => setEditionDossier({ ...editionDossier, nom_beneficiaire: e.target.value })}
                                className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                            />
                        </div>
                        <div>
                            {/* Réaffectation : transférer le dossier à un autre responsable
                                (absence, changement d'affectation...) sans passer par
                                supprimer/recréer. */}
                            <label className='block text-sm font-medium mb-1.5'>Responsable secteur <span className='text-red-500'>*</span></label>
                            <MenuDeroulant
                                className='w-full'
                                boutonClassName='w-full'
                                value={editionDossier.responsable_secteur_id}
                                onChange={(v) => setEditionDossier({ ...editionDossier, responsable_secteur_id: v })}
                                placeholder='Sélectionner...'
                                options={responsables.map((p) => ({ value: p.user?.id, label: `${p.prenom} ${p.nom}` }))}
                            />
                        </div>
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>Description</label>
                            <textarea
                                value={editionDossier.description}
                                onChange={(e) => setEditionDossier({ ...editionDossier, description: e.target.value })}
                                rows={3}
                                className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                            />
                        </div>
                        <div className='modal-action'>
                            <button type='submit' disabled={editionDossierEnCours} className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                                {editionDossierEnCours ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                        </div>
                    </form>
                </div>
            </dialog>
        </div>
    );
}

export default PaiDetail;
