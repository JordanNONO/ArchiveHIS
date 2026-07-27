import React, { useEffect, useState } from 'react'
import { LuPlus, LuTrash2 } from 'react-icons/lu'
import { toast } from 'react-toastify'
import { getCategorie, createCategorie, deleteCategorieById } from '../../api/routes/categorie'
import { useConfirm } from '../../contexts/ConfirmDialogContext'

function Categorie() {
    const confirm = useConfirm();
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

    async function removeCategorie(id) {
        if (!await confirm({ message: "Supprimer cette catégorie ? Cette action n'est pas rétroactive.", danger: true })) return
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
            <div className="flex items-center justify-end mb-4">
                <button
                    onClick={() => document.getElementById('add_cat').showModal()}
                    className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors'
                >
                    <LuPlus size={16}/>
                    Nouvelle catégorie
                </button>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr className='border-b border-border'>
                                <th></th>
                                <th>Nom</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((categorie, k) => (
                                <tr key={categorie.id}>
                                    <th className='text-muted-foreground'>{k + 1}</th>
                                    <td className='font-medium'>{categorie.libelle_cat}</td>
                                    <td>
                                        <button
                                            onClick={() => removeCategorie(categorie.id)}
                                            className='flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 transition-colors'
                                        >
                                            <LuTrash2 size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {categories.length === 0 && (
                                <tr>
                                    <td colSpan="3" className='text-center py-8 text-muted-foreground'>Aucune catégorie</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <dialog id="add_cat" className="modal">
                <div className="modal-box rounded-2xl">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <div>
                        <h1 className='text-lg font-semibold mb-4'>
                            Ajouter une nouvelle catégorie
                        </h1>
                        <form onSubmit={submitCategorie}>
                            <div className="mb-4">
                                <label htmlFor="name" className='block text-sm font-medium mb-1.5'>Catégorie</label>
                                <input
                                    type="text"
                                    id='name'
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder="Recrutement & Intégration"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    required
                                />
                            </div>
                            <div className='modal-action'>
                                <button type='submit' className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            </dialog>
        </div>
    )
}

export default Categorie
