import React, { useEffect, useState } from 'react'
import { LuPlus, LuTrash2 } from 'react-icons/lu'
import { toast } from 'react-toastify'
import { getCategorie, createCategorie, deleteCategorieById } from '../../api/routes/categorie'

function Categorie() {
    const [categories, setCategories] = useState([])
    const [label, setLabel] = useState('')

    function fetchCategories() {
        getCategorie().then(async (res) => {
            if (res.status === 200) {
                setCategories(await res.json())
            }
        }).catch((err) => console.log(err))
    }

    useEffect(() => {
        fetchCategories()
    }, [])

    async function submitCategorie(e) {
        e.preventDefault()
        try {
            const res = await createCategorie({ label })
            if (res.status === 201) {
                toast.success('Catégorie créée avec succès')
                setLabel('')
                document.getElementById('add_cat').close()
                fetchCategories()
            } else {
                toast.error('Une erreur est survenue')
            }
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
        }
    }

    function removeCategorie(id) {
        if (!window.confirm("Cette action n'est pas rétroactive")) return
        deleteCategorieById(id).then((res) => {
            if (res.status === 200) {
                toast.success('Catégorie supprimée avec succès')
                fetchCategories()
            } else {
                toast.error('Une erreur est survenue')
            }
        }).catch((err) => {
            console.log(err)
            toast.error('Une erreur est survenue')
        })
    }

    return (
        <div>
            <div className="flex items-center justify-end">
                <button onClick={() => document.getElementById('add_cat').showModal()} className='btn btn-sm bg-primary text-white hover:bg-primary'>
                    <LuPlus/>
                    Nouvelle catégorie
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Nom</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((categorie, k) => (
                            <tr key={categorie.id}>
                                <th>{k + 1}</th>
                                <td>{categorie.libelle_cat}</td>
                                <td>
                                    <button onClick={() => removeCategorie(categorie.id)} className='btn btn-sm btn-error btn-square'>
                                        <LuTrash2 />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {categories.length === 0 && (
                            <tr>
                                <td colSpan="3" className='text-center'>Aucune catégorie</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <dialog id="add_cat" className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <div>
                        <h1 className='text-xl font-bold mb-5'>
                            Ajouter une nouvelle catégorie
                        </h1>
                        <form onSubmit={submitCategorie}>
                            <div className="form-control mb-3">
                                <label htmlFor="name" className='mb-1'>Catégorie</label>
                                <input
                                    type="text"
                                    id='name'
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder="Recrutement & Intégration"
                                    className="input input-bordered w-full"
                                    required
                                />
                            </div>
                            <div className='modal-action'>
                                <button type='submit' className='btn bg-primary text-white hover:bg-primary'>Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            </dialog>
        </div>
    )
}

export default Categorie
