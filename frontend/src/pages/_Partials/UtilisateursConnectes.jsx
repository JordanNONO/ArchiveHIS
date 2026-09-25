import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getPersonnelsConnectes } from '../../api/routes/personnel'
import { timeAgo } from '../../utils/fileTypeIcons'
import { getInitials } from '../../utils/common'
import { SERVER_URL } from '../../api'

/**
 * Comptes actuellement en ligne (activité authentifiée dans les 5 dernières
 * minutes — voir AuthPersonnelMiddleware/PersonnelController::connectes()),
 * personnel interne et comptes dépôt (intervenant, bénéficiaire) confondus.
 */
function UtilisateursConnectes() {
    const { t } = useTranslation()
    const [personnels, setPersonnels] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchConnectes = useCallback(() => {
        getPersonnelsConnectes().then(async (res) => {
            if (res.status === 200) setPersonnels(await res.json())
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [])

    useEffect(() => {
        fetchConnectes()
        const interval = setInterval(fetchConnectes, 30000)
        return () => clearInterval(interval)
    }, [fetchConnectes])

    return (
        <div>
            <div className='flex items-center justify-between mb-4'>
                <p className='text-sm text-muted-foreground'>
                    {t('utilisateursConnectesSettings.personneConnectee', { count: personnels.length })}
                </p>
            </div>

            <div className='rounded-2xl border border-border bg-card overflow-hidden'>
                <div className='overflow-x-auto'>
                    <table className='table'>
                        <thead>
                            <tr className='border-b border-border'>
                                <th></th>
                                <th>{t('personnel.nom')}</th>
                                <th>{t('personnel.role')}</th>
                                <th>{t('utilisateursConnectesSettings.derniereActivite')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {personnels.map((p) => {
                                const nomComplet = `${p.prenom || ''} ${p.nom || ''}`.trim();
                                return (
                                <tr key={p.id} className='hover:bg-muted/60 transition-colors'>
                                    <td className='w-10'>
                                        {p.photo_url ? (
                                            <div className='avatar online'>
                                                <div className='w-8 rounded-full ring-2 ring-primary/20'>
                                                    <img src={SERVER_URL + p.photo_url} alt='' />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className='avatar placeholder online'>
                                                <div className='bg-primary text-white w-8 rounded-full ring-2 ring-primary/20'>
                                                    <span className='text-[11px] font-semibold'>{getInitials(nomComplet)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className='font-medium'>{nomComplet}</td>
                                    <td>
                                        <span className='inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium'>
                                            {p.user?.roles?.[0]?.nom || '—'}
                                        </span>
                                    </td>
                                    <td className='text-muted-foreground text-sm'>{timeAgo(p.user?.dernier_vu_le)}</td>
                                </tr>
                                );
                            })}
                            {!loading && personnels.length === 0 && (
                                <tr>
                                    <td colSpan={4} className='text-center text-sm text-muted-foreground py-6'>{t('utilisateursConnectesSettings.aucunePersonneConnectee')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default UtilisateursConnectes
