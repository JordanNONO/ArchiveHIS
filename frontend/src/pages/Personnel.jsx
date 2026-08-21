import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuFileEdit, LuLoader, LuPlus, LuTrash2, LuCircle, LuKeyRound } from 'react-icons/lu';
import { toast } from 'react-toastify';
import Breadcrumbs from '../components/Breadcrumbs';
import PersonnelModal from '../components/PersonnelModal';
import { getPersonnels, getPersonnelsConnectes, updatePersonnelById, deletePersonnelById, regenererMotDePassePersonnel } from '../api/routes/personnel';
import { getRoles } from '../api/routes/role';
import { getBureaux } from '../api/routes/bureau';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../contexts/ConfirmDialogContext';
import echo from '../utils/echo';

// Filet de sécurité si le WebSocket est coupé (réseau, Reverb hors ligne...) —
// le canal de présence ci-dessous reste la voie normale, instantanée.
const INTERVALLE_SONDAGE_CONNECTES_MS = 30000;

function Personnel() {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [personnels, setPersonnels] = useState([]);
    const [tableLoading, setTableLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10; // Nombre d'éléments par page
    const [roles, setRoles] = useState([]);
    const [bureaux, setBureaux] = useState([]);
    const [editingPersonnel, setEditingPersonnel] = useState(null);
    const [editForm, setEditForm] = useState({ email: '', first_phone: '', bureau_id: '', role_id: '' });
    const [regenerationEnCours, setRegenerationEnCours] = useState(false);
    // Confirmation intégrée au modal (pas via useConfirm : <dialog>.showModal()
    // place ce modal dans le "top layer" du navigateur, qui passe toujours
    // au-dessus d'une simple div en z-[100] — la boîte de confirmation
    // partagée resterait invisible/inatteignable derrière lui.
    const [confirmationRegenVisible, setConfirmationRegenVisible] = useState(false);
    const { hasPermission, isAdministrator } = usePermissions();
    const canManageUsers = isAdministrator || hasPermission('gerer_utilisateurs');
    // Le compte administrateur fondateur (id 1) ne peut être modifié/supprimé
    // que par lui-même — voir PersonnelController::bloquerSiCiblageAdminProtege().
    const currentUserId = JSON.parse(sessionStorage.getItem('user') || '{}')?.id;
    // Personnel interne et comptes dépôt (intervenant, bénéficiaire) confondus.
    // Identifié par id UTILISATEUR (pas id personnel) — c'est ce que le canal
    // de présence connaît (voir routes/channels.php côté backend, MainLayout.jsx
    // qui y adhère pour toute la session). "Statut" se met donc à jour dès
    // qu'un compte se connecte/quitte l'appli, sans attendre le prochain
    // sondage (celui-ci ne sert plus que de secours, voir plus bas).
    const [connectesIds, setConnectesIds] = useState(new Set());

    const fetchConnectes = useCallback(() => {
        getPersonnelsConnectes().then(async (res) => {
            if (res.status === 200) {
                const data = await res.json();
                const idsSondes = data.map((p) => p.user?.id).filter(Boolean);
                // Ajoute seulement — ne remplace jamais tout l'ensemble : sinon un
                // sondage arrivant juste après une reconnexion WebSocket (ou tout
                // léger désaccord passager entre les deux sources) repasserait à
                // tort quelqu'un de "En ligne" à "Hors ligne" alors que le canal de
                // présence dit toujours présent. Seul l'évènement `leaving` du
                // canal (ci-dessous) doit pouvoir retirer quelqu'un.
                setConnectesIds((prev) => new Set([...prev, ...idsSondes]));
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        fetchConnectes();
        const interval = setInterval(fetchConnectes, INTERVALLE_SONDAGE_CONNECTES_MS);
        return () => clearInterval(interval);
    }, [fetchConnectes]);

    useEffect(() => {
        let monte = true;
        const canal = echo.join('presence-connectes');
        canal.here((utilisateurs) => {
            if (monte) setConnectesIds(new Set(utilisateurs.map((u) => u.id)));
        });
        canal.joining((utilisateur) => {
            if (monte) setConnectesIds((prev) => new Set(prev).add(utilisateur.id));
        });
        canal.leaving((utilisateur) => {
            if (monte) {
                setConnectesIds((prev) => {
                    const suivant = new Set(prev);
                    suivant.delete(utilisateur.id);
                    return suivant;
                });
            }
        });
        return () => {
            monte = false;
            // Pas de echo.leave() ici : MainLayout.jsx (toujours monté pendant
            // la session) adhère au même canal pour signaler sa propre présence
            // — le quitter romprait ça dès qu'on change de page.
        };
    }, []);

    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    useEffect(() => {
        fetchPersonnels(); // Charge les personnels de la première page lors du premier rendu
        getRoles().then(async (res) => {
            if (res.status === 200) setRoles(await res.json());
        }).catch((err) => console.log(err));
        getBureaux().then(async (res) => {
            if (res.status === 200) setBureaux(await res.json());
        }).catch((err) => console.log(err));
    }, []); // Ne déclenche qu'une seule fois

    const fetchPersonnels = () => {
        try {
            setTableLoading(true);
            getPersonnels().then(async (res) => {
                if (res.status === 200) {
                    const data = await res.json();
                    setPersonnels(data); // Met à jour les personnels avec toutes les données reçues
                }
                setTableLoading(false);
            }).catch((err) => {
                console.log(err);
                setTableLoading(false);
            });
        } catch (error) {
            console.log(error);
            setTableLoading(false);
        }
    };

    const handleSubmit = (data) => {
        handleCloseModal();
        fetchPersonnels(); // Recharge tous les personnels après ajout
    };

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    function openEditModal(personnel) {
        setEditingPersonnel(personnel);
        setEditForm({
            email: personnel?.user?.mail || '',
            first_phone: personnel?.first_phone || '',
            bureau_id: personnel?.bureau_id || '',
            role_id: personnel?.user?.roles?.[0]?.id || '',
        });
        setConfirmationRegenVisible(false);
        document.getElementById('edit_personnel').showModal();
    }

    async function saveEdit(e) {
        e.preventDefault();
        try {
            const res = await updatePersonnelById(editingPersonnel.id, editForm);
            if (res.status === 200) {
                toast.success(t('personnel.personnelMisAJour'));
                document.getElementById('edit_personnel').close();
                fetchPersonnels();
            } else {
                toast.error(t('commun.erreurGenerique'));
            }
        } catch (error) {
            console.log(error);
            toast.error(t('commun.erreurGenerique'));
        }
    }

    async function regenererMotDePasse() {
        if (regenerationEnCours) return;
        if (!confirmationRegenVisible) {
            setConfirmationRegenVisible(true);
            return;
        }
        setConfirmationRegenVisible(false);
        try {
            setRegenerationEnCours(true);
            const res = await regenererMotDePassePersonnel(editingPersonnel.id);
            if (res.status === 200) {
                toast.success(t('personnel.nouveauMdpEnvoye'));
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || t('commun.erreurGenerique'));
            }
        } catch (error) {
            console.log(error);
            toast.error(t('commun.erreurGenerique'));
        } finally {
            setRegenerationEnCours(false);
        }
    }

    async function removePersonnel(id) {
        if (!await confirm({ message: t('personnel.confirmerSuppression'), danger: true })) return;
        deletePersonnelById(id).then((res) => {
            if (res.status === 200) {
                toast.success(t('personnel.personnelSupprime'));
                fetchPersonnels();
            } else {
                toast.error(t('commun.erreurGenerique'));
            }
        }).catch((err) => {
            console.log(err);
            toast.error(t('commun.erreurGenerique'));
        });
    }

    // Calcul des personnels à afficher sur la page courante
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = personnels?.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="flex flex-col flex-grow py-6">
            <Breadcrumbs where={t('sidebar.personnel')} />
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 mt-1">
                <h2 className='text-2xl font-semibold text-foreground'>{t('sidebar.personnel')}</h2>
                <button onClick={handleOpenModal} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors shrink-0">
                    <LuPlus size={16} />
                    {t('personnel.ajouterPersonnel')}
                </button>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr className='border-b border-border'>
                                <th></th>
                                <th>{t('personnel.nom')}</th>
                                <th>{t('personnel.prenom')}</th>
                                <th>{t('personnel.bureau')}</th>
                                <th>{t('personnel.role')}</th>
                                <th>{t('personnel.statut')}</th>
                            </tr>
                        </thead>
                        <tbody className={currentItems.length === 0 ? 'relative h-[62vh] overflow-auto' : ''}>
                            {tableLoading ? (
                                <tr>
                                    <td colSpan="6" className="text-center">
                                        <LuLoader className="animate-spin duration-1000" />
                                    </td>
                                </tr>
                            ) : currentItems.length > 0 ? (
                                currentItems.map((personnel, index) => {
                                  const estAdminProtege = personnel?.user?.id === 1 && currentUserId !== 1;
                                  return (
                                    <tr key={index}>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(personnel)}
                                                    disabled={!canManageUsers || estAdminProtege}
                                                    title={estAdminProtege ? t('personnel.adminProtegeModifier') : undefined}
                                                    className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    <LuFileEdit size={15} />
                                                </button>
                                                <button
                                                    onClick={() => removePersonnel(personnel.id)}
                                                    disabled={!canManageUsers || estAdminProtege}
                                                    title={estAdminProtege ? t('personnel.adminProtegeSupprimer') : undefined}
                                                    className="flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    <LuTrash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                        <td>{personnel.nom}</td>
                                        <td>{personnel.prenom}</td>
                                        <td>{personnel?.bureau?.name}</td>
                                        <td>
                                            {personnel?.user?.roles?.[0]?.nom
                                                ? <span className='inline-flex rounded-md bg-secondary/10 text-secondary px-2 py-1 text-xs font-medium'>{personnel.user.roles[0].nom}</span>
                                                : <span className='text-muted-foreground'>—</span>}
                                        </td>
                                        <td>
                                            {connectesIds.has(personnel.user?.id) ? (
                                                <span className='inline-flex items-center gap-1.5 text-xs font-medium text-green-600'>
                                                    <LuCircle size={9} className='fill-green-500 text-green-500' />
                                                    {t('personnel.enLigne')}
                                                </span>
                                            ) : (
                                                <span className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
                                                    <LuCircle size={9} className='fill-muted-foreground/30 text-muted-foreground/30' />
                                                    {t('personnel.horsLigne')}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                  );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" className="text-center py-8 text-muted-foreground">
                                        {t('personnel.pasDePersonnel')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <PersonnelModal isOpen={isModalOpen} onClose={handleCloseModal} onSaveSuccess={handleSubmit} />

            <dialog id="edit_personnel" className="modal">
                <div className="modal-box rounded-2xl">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <h1 className="text-lg font-semibold mb-4">
                        {t('personnel.modifierTitre', { nom: editingPersonnel?.nom, prenom: editingPersonnel?.prenom })}
                    </h1>
                    <form onSubmit={saveEdit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1.5">{t('personnel.email')} <span className="text-red-500">*</span></label>
                            <input
                                type="email"
                                required
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                placeholder="prenom.nom@entreprise.com"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <p className="text-xs text-muted-foreground mt-1">{t('personnel.identifiantConnexion')}</p>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1.5">{t('personnel.numeroTelephone')} <span className="text-red-500">*</span></label>
                            <input
                                type="tel"
                                required
                                value={editForm.first_phone}
                                onChange={(e) => setEditForm({ ...editForm, first_phone: e.target.value })}
                                placeholder="06 12 34 56 78"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1.5">{t('personnel.bureau')}</label>
                            <select
                                value={editForm.bureau_id}
                                onChange={(e) => setEditForm({ ...editForm, bureau_id: e.target.value })}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                <option value="">{t('personnel.selectionnerBureau')}</option>
                                {bureaux.map((bureau) => (
                                    <option key={bureau.id} value={bureau.id}>{bureau.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1.5">{t('personnel.role')}</label>
                            <select
                                value={editForm.role_id}
                                onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                <option value="">{t('personnel.selectionnerRole')}</option>
                                {roles.map((role) => (
                                    <option key={role.id} value={role.id}>{role.nom}</option>
                                ))}
                            </select>
                        </div>
                        <div className="modal-action items-center justify-between sm:justify-between">
                            {confirmationRegenVisible ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{t('personnel.envoyerNouveauMdp')}</span>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmationRegenVisible(false)}
                                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                    >
                                        {t('personnel.annuler')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={regenererMotDePasse}
                                        disabled={regenerationEnCours}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
                                    >
                                        {regenerationEnCours ? t('personnel.envoiEnCours') : t('personnel.confirmer')}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={regenererMotDePasse}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                                >
                                    <LuKeyRound size={15} />
                                    {t('personnel.regenererMotDePasse')}
                                </button>
                            )}
                            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors">{t('personnel.enregistrer')}</button>
                        </div>
                    </form>
                </div>
            </dialog>

            {/* Pagination */}
            {personnels?.length > 0 && (
                <div className="flex justify-center gap-2 mt-6">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${currentPage === 1 ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/90'}`}
                    >
                        {t('personnel.precedent')}
                    </button>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={indexOfLastItem >= personnels.length}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${indexOfLastItem >= personnels.length ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/90'}`}
                    >
                        {t('personnel.suivant')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default Personnel;
