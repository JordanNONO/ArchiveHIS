import React, { useEffect, useState } from 'react';
import { LuFileEdit, LuLoader, LuPlus, LuTrash2 } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import PersonnelModal from '../components/PersonnelModal';
import { getPersonnels } from '../api/routes/personnel';

function Personnel() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [personnels, setPersonnels] = useState([]);
    const [tableLoading, setTableLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10; // Nombre d'éléments par page

    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    useEffect(() => {
        fetchPersonnels(); // Charge les personnels de la première page lors du premier rendu
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
        console.log('Form data:', data);
        handleCloseModal();
        fetchPersonnels(); // Recharge tous les personnels après ajout
    };

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

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
                        </tr>
                    </thead>
                    <tbody className={currentItems.length === 0 ? 'relative h-[62vh] overflow-auto' : ''}>
                        {tableLoading ? (
                            <tr>
                                <td colSpan="4" className="text-center">
                                    <LuLoader className="animate-spin duration-1000" />
                                </td>
                            </tr>
                        ) : currentItems.length > 0 ? (
                            currentItems.map((personnel, index) => (
                                <tr key={index}>
                                    <td>
                                        <div className="flex items-center gap-1 w-1/3">
                                            <button className="btn btn-sm btn-warning btn-square">
                                                <LuFileEdit />
                                            </button>
                                            <button className="btn btn-sm btn-error btn-square">
                                                <LuTrash2 />
                                            </button>
                                        </div>
                                    </td>
                                    <td>{personnel.nom}</td>
                                    <td>{personnel.prenom}</td>
                                    <td>{personnel?.bureau?.name}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" className="text-center">
                                    <h1>Pas de personnel</h1>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <PersonnelModal isOpen={isModalOpen} onClose={handleCloseModal} onSaveSuccess={handleSubmit} />

            {/* Pagination */}
            {personnels?.length > 0 && (
                <div className="flex justify-center mt-4">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`btn ${currentPage === 1 ? 'bg-gray-300 cursor-not-allowed' : 'bg-primary  hover:bg-primary'} btn-sm text-white mr-2`}
                    >
                        Précédent
                    </button>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={indexOfLastItem >= personnels.length}
                        className={`btn ${indexOfLastItem >= personnels.length ? 'bg-gray-300 btn-sm cursor-not-allowed' : 'bg-primary btn-sm hover:bg-primary'} text-white`}
                    >
                        Suivant
                    </button>
                </div>
            )}
        </div>
    );
}

export default Personnel;
