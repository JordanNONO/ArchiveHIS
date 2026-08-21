import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuPlus, LuTrash2 } from 'react-icons/lu'
import { createBureaux, deleteBureaux } from '../../api/routes/bureau';
import { toast } from 'react-toastify';
import { useConfirm } from '../../contexts/ConfirmDialogContext';

function Bureau({Bureaux, onChanged}) {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [formData, setFormData] = useState({
        name:''
    })

    const modalRef = useRef();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    function handleSubmit(e){
        e.preventDefault()
        try {
            createBureaux(formData).then(async function(res){
                if (res.status===201) {
                    toast.success(t('bureauSettings.bureauCree'))
                    setFormData({ name: '' })
                    if (modalRef.current) {
                        modalRef.current.close()
                    }
                    onChanged && onChanged()
                }else{
                    toast.error(t('commun.erreurGenerique'))
                }
            })
        } catch (error) {
            toast.error(t('commun.erreurGenerique'))
        }
    }

    async function handleDelete(bureau){
        if (!await confirm({ message: t('bureauSettings.confirmSupprimerBureau', { nom: bureau.name }), danger: true })) return
        deleteBureaux(bureau.id).then(async (res) => {
            if (res.status === 200) {
                toast.success(t('bureauSettings.bureauSupprime'))
                onChanged && onChanged()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error || t('commun.erreurGenerique'))
            }
        }).catch(() => {
            toast.error(t('commun.erreurGenerique'))
        })
    }

    return (
        <div>
            <div className="flex items-center justify-end mb-4">
                <button
                    onClick={() => document.getElementById('add_bureau').showModal()}
                    className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors'
                >
                    <LuPlus size={16} />
                    {t('bureauSettings.nouveauBureau')}
                </button>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr className='border-b border-border'>
                                <th></th>
                                <th>{t('bureauSettings.nomDuBureau')}</th>
                                <th>{t('bureauSettings.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                Bureaux.map((bureau, k) => (
                                    <tr key={bureau.id}>
                                        <th className='text-muted-foreground'>{k + 1}</th>
                                        <td className='font-medium'>{bureau?.name}</td>
                                        <td>
                                            <button
                                                onClick={() => handleDelete(bureau)}
                                                className='flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 transition-colors'
                                            >
                                                <LuTrash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            }
                            {Bureaux.length === 0 && (
                                <tr>
                                    <td colSpan="3" className='text-center py-8 text-muted-foreground'>{t('bureauSettings.aucunBureau')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <dialog id="add_bureau" ref={modalRef} className="modal">
                <div className="modal-box rounded-2xl">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <div>
                        <h1 className='text-lg font-semibold mb-4'>
                            {t('bureauSettings.ajouterBureau')}
                        </h1>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label htmlFor="name" className='block text-sm font-medium mb-1.5'>{t('bureauSettings.nomDuBureau')} <span className='text-red-500'>*</span></label>
                                <input
                                    type="text"
                                    id='name'
                                    name='name'
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder={t('bureauSettings.placeholderNomBureau')}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    required
                                />
                            </div>
                            <button className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>{t('personnel.enregistrer')}</button>
                        </form>
                    </div>

                </div>
            </dialog>
        </div >
    )
}

export default Bureau
