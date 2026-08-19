import React, { useEffect, useState } from 'react'
import { LuPlus, LuTrash2, LuPencilLine } from 'react-icons/lu'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { getCategorie, createCategorie, deleteCategorieById, updateCatgory } from '../../api/routes/categorie'
import { useConfirm } from '../../contexts/ConfirmDialogContext'

function Categorie() {
    const { t } = useTranslation()
    const confirm = useConfirm();
    const [categories, setCategories] = useState([])
    const [label, setLabel] = useState('')
    const [labelEn, setLabelEn] = useState('')
    const [categorieEnEdition, setCategorieEnEdition] = useState(null)
    const [editLabel, setEditLabel] = useState('')
    const [editLabelEn, setEditLabelEn] = useState('')
    const [enregistrementEnCours, setEnregistrementEnCours] = useState(false)

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
            const res = await createCategorie({ label, label_en: labelEn || undefined })
            if (res.status === 201) {
                toast.success(t('categoriesSettings.categorieCreee'))
                setLabel('')
                setLabelEn('')
                document.getElementById('add_cat').close()
                fetchCategories()
            } else {
                toast.error(t('commun.erreurGenerique'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        }
    }

    async function removeCategorie(id) {
        if (!await confirm({ message: t('categoriesSettings.confirmerSuppression'), danger: true })) return
        deleteCategorieById(id).then((res) => {
            if (res.status === 200) {
                toast.success(t('categoriesSettings.categorieSupprimee'))
                fetchCategories()
            } else {
                toast.error(t('commun.erreurGenerique'))
            }
        }).catch((err) => {
            console.log(err)
            toast.error(t('commun.erreurGenerique'))
        })
    }

    function ouvrirEdition(categorie) {
        setCategorieEnEdition(categorie)
        setEditLabel(categorie.libelle_cat || '')
        setEditLabelEn(categorie.libelle_cat_en || '')
        document.getElementById('edit_cat').showModal()
    }

    async function submitEdition(e) {
        e.preventDefault()
        try {
            setEnregistrementEnCours(true)
            const res = await updateCatgory({ label: editLabel, label_en: editLabelEn }, categorieEnEdition.id)
            if (res.status === 200) {
                toast.success(t('categoriesSettings.categorieModifiee'))
                document.getElementById('edit_cat').close()
                fetchCategories()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error || t('commun.erreurGenerique'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setEnregistrementEnCours(false)
        }
    }

    return (
        <div>
            <div className="flex items-center justify-end mb-4">
                <button
                    onClick={() => document.getElementById('add_cat').showModal()}
                    className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors'
                >
                    <LuPlus size={16}/>
                    {t('categoriesSettings.nouvelleCategorie')}
                </button>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr className='border-b border-border'>
                                <th></th>
                                <th>{t('categoriesSettings.nomFrancais')}</th>
                                <th>{t('categoriesSettings.nomAnglais')}</th>
                                <th>{t('categoriesSettings.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((categorie, k) => (
                                <tr key={categorie.id}>
                                    <th className='text-muted-foreground'>{k + 1}</th>
                                    <td className='font-medium'>{categorie.libelle_cat}</td>
                                    <td className={categorie.libelle_cat_en ? 'text-foreground' : 'text-muted-foreground italic'}>
                                        {categorie.libelle_cat_en || t('categoriesSettings.nonTraduit')}
                                    </td>
                                    <td>
                                        <div className='flex items-center gap-1'>
                                            <button
                                                onClick={() => ouvrirEdition(categorie)}
                                                title={t('categoriesSettings.modifier')}
                                                className='flex items-center justify-center w-8 h-8 rounded-lg text-primary hover:bg-primary/10 transition-colors'
                                            >
                                                <LuPencilLine size={15} />
                                            </button>
                                            <button
                                                onClick={() => removeCategorie(categorie.id)}
                                                title={t('categoriesSettings.supprimer')}
                                                className='flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 transition-colors'
                                            >
                                                <LuTrash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {categories.length === 0 && (
                                <tr>
                                    <td colSpan="4" className='text-center py-8 text-muted-foreground'>{t('categoriesSettings.aucuneCategorie')}</td>
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
                            {t('categoriesSettings.ajouterCategorie')}
                        </h1>
                        <form onSubmit={submitCategorie}>
                            <div className="mb-4">
                                <label htmlFor="name" className='block text-sm font-medium mb-1.5'>{t('categoriesSettings.categorieFr')} <span className='text-red-500'>*</span></label>
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
                            <div className="mb-4">
                                <label htmlFor="name_en" className='block text-sm font-medium mb-1.5'>{t('categoriesSettings.categorieEn')}</label>
                                <input
                                    type="text"
                                    id='name_en'
                                    value={labelEn}
                                    onChange={(e) => setLabelEn(e.target.value)}
                                    placeholder="Recruitment & Onboarding"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <p className='text-xs text-muted-foreground mt-1'>{t('categoriesSettings.indicationTraduction')}</p>
                            </div>
                            <div className='modal-action'>
                                <button type='submit' className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>{t('categoriesSettings.enregistrer')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            </dialog>

            <dialog id="edit_cat" className="modal">
                <div className="modal-box rounded-2xl">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <div>
                        <h1 className='text-lg font-semibold mb-4'>
                            {t('categoriesSettings.modifierCategorie')}
                        </h1>
                        <form onSubmit={submitEdition}>
                            <div className="mb-4">
                                <label htmlFor="edit_name" className='block text-sm font-medium mb-1.5'>{t('categoriesSettings.categorieFr')} <span className='text-red-500'>*</span></label>
                                <input
                                    type="text"
                                    id='edit_name'
                                    value={editLabel}
                                    onChange={(e) => setEditLabel(e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="edit_name_en" className='block text-sm font-medium mb-1.5'>{t('categoriesSettings.categorieEn')}</label>
                                <input
                                    type="text"
                                    id='edit_name_en'
                                    value={editLabelEn}
                                    onChange={(e) => setEditLabelEn(e.target.value)}
                                    placeholder="Recruitment & Onboarding"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <p className='text-xs text-muted-foreground mt-1'>{t('categoriesSettings.indicationTraduction')}</p>
                            </div>
                            <div className='modal-action'>
                                <button type='submit' disabled={enregistrementEnCours} className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                                    {enregistrementEnCours ? t('categoriesSettings.enregistrementEnCours') : t('categoriesSettings.enregistrer')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </dialog>
        </div>
    )
}

export default Categorie
