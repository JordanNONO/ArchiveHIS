import React, { useEffect, useState } from 'react';
import { LuFileEdit, LuLoader, LuPlus, LuTrash2 } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import PersonnelModal from '../components/PersonnelModal';
import { getPersonnels, updatePersonnelById, deletePersonnelById } from '../api/routes/personnel';
import { getRoles } from '../api/routes/role';
import { getBureaux } from '../api/routes/bureau';
import { usePermissions } from '../hooks/usePermissions';

function Personnel() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [personnels, setPersonnels] = useState([]);
    const [tableLoading, setTableLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10; // Nombre d'éléments par page
    const [roles, setRoles] = useState([]);
    const [bureaux, setBureaux] = useState([]);
    const [editingPersonnel, setEditingPersonnel] = useState(null);
    const [editForm, setEditForm] = useState({ bureau_id: '', role_id: '' });
    const { hasPermission, isAdministrator } = usePermissions();
    const canManageUsers = isAdministrator || hasPermission('gerer_utilisateurs');

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
            bureau_id: personnel?.bureau_id || '',
            role_id: personnel?.user?.roles?.[0]?.id || '',
        });
        document.getElementById('edit_personnel').showModal();
    }

    async function saveEdit(e) {
        e.preventDefault();
        try {
            const res = await updatePersonnelById(editingPersonnel.id, editForm);
            if (res.status === 200) {
                toast.success('Personnel mis à jour avec succès');
                document.getElementById('edit_personnel').close();
                fetchPersonnels();
            } else {
                toast.error('Une erreur est survenue');
            }
        } catch (error) {
            console.log(error);
            toast.error('Une erreur est survenue');
        }
    }

    function removePersonnel(id) {
        if (!window.confirm("Cette action n'est pas rétroactive")) return;
        deletePersonnelById(id).then((res) => {
            if (res.status === 200) {
                toast.success('Personnel supprimé avec succès');
                fetchPersonnels();
            } else {
                toast.error('Une erreur est survenue');
            }
        }).catch((err) => {
            console.log(err);
            toast.error('Une erreur est survenue');
        });
    }

    // Calcul des personnels à afficher sur la page courante
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = personnels?.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="flex flex-col flex-grow py-2">
            <div className="breadcrumbs text-sm">
                <ul>
                    <li>
                        <Link to={'/'}>Sige Archive</Link>
                    </li>
                    <li>Personnel</li>
                </ul>
            </div>
            <div className="flex items-end justify-end mb-3">
                <button onClick={handleOpenModal} className="btn bg-primary hover:bg-primary text-white">
                    <LuPlus />
                    Ajouter un personnel
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Nom</th>
                            <th>Prénom</th>
                            <th>Bureau</th>
                            <th>Rôle</th>
                        </tr>
                    </thead>
                    <tbody className={currentItems.length === 0 ? 'relative h-[62vh] overflow-auto' : ''}>
                        {tableLoading ? (
                            <tr>
                                <td colSpan="5" className="text-center">
                                    <LuLoader className="animate-spin duration-1000" />
                                </td>
                            </tr>
                        ) : currentItems.length > 0 ? (
                            currentItems.map((personnel, index) => (
                                <tr key={index}>
                                    <td>
                                        <div className="flex items-center gap-1 w-1/3">
                                            <button
                                                onClick={() => openEditModal(personnel)}
                                                disabled={!canManageUsers}
                                                className="btn btn-sm btn-warning btn-square"
                                            >
                                                <LuFileEdit />
                                            </button>
                                            <button
                                                onClick={() => removePersonnel(personnel.id)}
                                                disabled={!canManageUsers}
                                                className="btn btn-sm btn-error btn-square"
                                            >
                                                <LuTrash2 />
                                            </button>
                                        </div>
                                    </td>
                                    <td>{personnel.nom}</td>
                                    <td>{personnel.prenom}</td>
                                    <td>{personnel?.bureau?.name}</td>
                                    <td>{personnel?.user?.roles?.[0]?.nom || '—'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="text-center">
                                    <h1>Pas de personnel</h1>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <PersonnelModal isOpen={isModalOpen} onClose={handleCloseModal} onSaveSuccess={handleSubmit} />

            <dialog id="edit_personnel" className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <h1 className="text-xl font-bold mb-5">
                        Modifier {editingPersonnel?.nom} {editingPersonnel?.prenom}
                    </h1>
                    <form onSubmit={saveEdit}>
                        <div className="form-control mb-3">
                            <label className="label">
                                <span className="label-text">Bureau</span>
                            </label>
                            <select
                                value={editForm.bureau_id}
                                onChange={(e) => setEditForm({ ...editForm, bureau_id: e.target.value })}
                                className="select select-bordered"
                            >
                                <option value="">Sélectionner un bureau</option>
                                {bureaux.map((bureau) => (
                                    <option key={bureau.id} value={bureau.id}>{bureau.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-control mb-3">
                            <label className="label">
                                <span className="label-text">Rôle</span>
                            </label>
                            <select
                                value={editForm.role_id}
                                onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}
                                className="select select-bordered"
                            >
                                <option value="">Sélectionner un rôle</option>
                                {roles.map((role) => (
                                    <option key={role.id} value={role.id}>{role.nom}</option>
                                ))}
                            </select>
                        </div>
                        <div className="modal-action">
                            <button type="submit" className="btn bg-primary text-white hover:bg-primary">Enregistrer</button>
                        </div>
                    </form>
                </div>
            </dialog>

            {/* Pagination */}
            {personnels?.length > 0 && (
                <div className="flex justify-center mt-4">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`btn ${currentPage === 1 ? 'bg-muted cursor-not-allowed' : 'bg-primary  hover:bg-primary'} btn-sm text-white mr-2`}
                    >
                        Précédent
                    </button>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={indexOfLastItem >= personnels.length}
                        className={`btn ${indexOfLastItem >= personnels.length ? 'bg-muted btn-sm cursor-not-allowed' : 'bg-primary btn-sm hover:bg-primary'} text-white`}
                    >
                        Suivant
                    </button>
                </div>
            )}
        </div>
    );
}

export default Personnel;
