import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuPlus, LuTrash2, LuArchive } from 'react-icons/lu'
import { toast } from 'react-toastify'
import { getServicesMetier, createServiceMetier, deleteServiceMetier, getServiceMetierArchives } from '../../api/routes/serviceMetier'
import { useConfirm } from '../../contexts/ConfirmDialogContext'

function ServiceMetier() {
    const { t } = useTranslation();
    const confirm = useConfirm();
    const [services, setServices] = useState([])
    const [formData, setFormData] = useState({ code_service: '', nom_service: '' })
    const [archives, setArchives] = useState(null)
    const [selectedService, setSelectedService] = useState(null)

    function fetchServices() {
        getServicesMetier().then(async (res) => {
            if (res.status === 200) setServices(await res.json())
        }).catch((err) => console.log(err))
    }

    useEffect(() => {
        fetchServices()
    }, [])

    async function submitService(e) {
        e.preventDefault()
        try {
            const res = await createServiceMetier(formData)
            if (res.status === 201) {
                toast.success(t('serviceMetierSettings.serviceCree'))
                setFormData({ code_service: '', nom_service: '' })
                document.getElementById('add_service').close()
                fetchServices()
            } else {
                const data = await res.json()
                toast.error(data?.error || t('commun.erreurGenerique'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        }
    }

    async function removeService(id) {
        if (!await confirm({ message: t('serviceMetierSettings.confirmSupprimerService'), danger: true })) return
        deleteServiceMetier(id).then((res) => {
            if (res.status === 200) {
                toast.success(t('serviceMetierSettings.serviceSupprime'))
                fetchServices()
            } else {
                toast.error(t('commun.erreurGenerique'))
            }
        }).catch((err) => {
            console.log(err)
            toast.error(t('commun.erreurGenerique'))
        })
    }

    function voirArchives(service) {
        setSelectedService(service)
        setArchives(null)
        document.getElementById('service_archives').showModal()
        getServiceMetierArchives(service.id).then(async (res) => {
            if (res.status === 200) setArchives(await res.json())
        }).catch((err) => console.log(err))
    }

    return (
        <div>
            <div className="flex items-center justify-end mb-4">
                <button
                    onClick={() => document.getElementById('add_service').showModal()}
                    className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors'
                >
                    <LuPlus size={16} />
                    {t('serviceMetierSettings.nouveauService')}
                </button>
            </div>
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr className='border-b border-border'>
                                <th></th>
                                <th>{t('serviceMetierSettings.code')}</th>
                                <th>{t('serviceMetierSettings.nomDuService')}</th>
                                <th>{t('serviceMetierSettings.rolesRattaches')}</th>
                                <th>{t('bureauSettings.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.map((service, k) => (
                                <tr key={service.id}>
                                    <th className='text-muted-foreground'>{k + 1}</th>
                                    <td><span className='inline-flex rounded-md bg-secondary/10 text-secondary px-2 py-1 text-xs font-medium'>{service.code_service}</span></td>
                                    <td className='font-medium'>{service.nom_service}</td>
                                    <td>{service.roles_count ?? 0}</td>
                                    <td>
                                        <div className='flex items-center gap-2'>
                                            <button onClick={() => voirArchives(service)} className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors'>
                                                <LuArchive size={14} />
                                                {t('serviceMetierSettings.archivesBtn')}
                                            </button>
                                            <button onClick={() => removeService(service.id)} className='flex items-center justify-center w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 transition-colors'>
                                                <LuTrash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {services.length === 0 && (
                                <tr>
                                    <td colSpan="5" className='text-center py-8 text-muted-foreground'>{t('serviceMetierSettings.aucunService')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <dialog id="add_service" className="modal">
                <div className="modal-box rounded-2xl">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <h1 className='text-lg font-semibold mb-4'>{t('serviceMetierSettings.ajouterService')}</h1>
                    <form onSubmit={submitService}>
                        <div className="mb-4">
                            <label className='block text-sm font-medium mb-1.5'>{t('serviceMetierSettings.code')} <span className='text-red-500'>*</span></label>
                            <input
                                type="text"
                                value={formData.code_service}
                                onChange={(e) => setFormData({ ...formData, code_service: e.target.value })}
                                placeholder={t('serviceMetierSettings.placeholderCode')}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                required
                            />
                        </div>
                        <div className="mb-4">
                            <label className='block text-sm font-medium mb-1.5'>{t('serviceMetierSettings.nomDuService')} <span className='text-red-500'>*</span></label>
                            <input
                                type="text"
                                value={formData.nom_service}
                                onChange={(e) => setFormData({ ...formData, nom_service: e.target.value })}
                                placeholder={t('serviceMetierSettings.placeholderNomService')}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                required
                            />
                        </div>
                        <div className='modal-action'>
                            <button type='submit' className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>{t('personnel.enregistrer')}</button>
                        </div>
                    </form>
                </div>
            </dialog>

            <dialog id="service_archives" className="modal">
                <div className="modal-box rounded-2xl">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <h1 className='text-lg font-semibold mb-4'>{t('serviceMetierSettings.archivesTitre', { nom: selectedService?.nom_service })}</h1>
                    {archives === null ? (
                        <p className='text-sm text-muted-foreground'>{t('openFolder.chargement')}</p>
                    ) : archives.length === 0 ? (
                        <p className='text-sm text-muted-foreground'>{t('serviceMetierSettings.aucunDocumentArchive')}</p>
                    ) : (
                        <ul className='flex flex-col gap-2 max-h-80 overflow-y-auto'>
                            {archives.map((doc) => (
                                <li key={doc.id} className='text-sm border-b border-border pb-2'>{doc.titre_document}</li>
                            ))}
                        </ul>
                    )}
                </div>
            </dialog>
        </div>
    )
}

export default ServiceMetier
