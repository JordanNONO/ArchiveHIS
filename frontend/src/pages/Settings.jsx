import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import Role from './_Partials/Role'
import Bureau from './_Partials/Bureau'
import Categorie from './_Partials/Categorie'
import ServiceMetier from './_Partials/ServiceMetier'
import UtilisateursConnectes from './_Partials/UtilisateursConnectes'
import JetonsApi from './_Partials/JetonsApi'
import Breadcrumbs from '../components/Breadcrumbs'
import { getBureaux } from '../api/routes/bureau'
import { getRoles } from '../api/routes/role'
import { toast } from 'react-toastify'
import { usePermissions } from '../hooks/usePermissions'
import { LuShieldAlert } from 'react-icons/lu'

const PERMISSIONS_ADMIN = ['gerer_roles', 'gerer_permissions', 'gerer_categories', 'gerer_services_metier', 'gerer_utilisateurs'];

function Settings() {
    const { t } = useTranslation()
    const TABS = [
        { key: 'roles', label: t('sidebar.rolesPermissions') },
        { key: 'categories', label: t('sidebar.categories') },
        { key: 'bureaux', label: t('sidebar.bureaux') },
        { key: 'services', label: t('sidebar.servicesMetier') },
        { key: 'connectes', label: t('settings.utilisateursConnectes') },
    ]
    const [Roles, setRoles] = useState([])
    const [Bureaux, setBureaux] = useState([])
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = searchParams.get('tab') || 'roles'
    const { isAdministrator, hasPermission } = usePermissions()
    const peutVoirAdministration = isAdministrator || PERMISSIONS_ADMIN.some(hasPermission)
    // Onglet réservé au vrai rôle Administrator (pas aux permissions
    // "administratives" au sens large) — un jeton donne un accès complet aux
    // données, ce n'est pas une décision à la portée d'un Éditeur quelconque.
    const tabs = isAdministrator ? [...TABS, { key: 'jetons', label: t('settings.jetonsApi') }] : TABS

    function fetchRole() {
        getRoles().then(async function (res) {
            if (res.status === 200) {
                const data = await res.json()
                setRoles(data)
            }
        }).catch(function (err) {
            console.log(err)
        })
    }
    function fetchBureau() {
        getBureaux().then(async function (res) {
            if (res.status === 200) {
                const data = await res.json()
                setBureaux(data)
            } else {
                toast.error(t('commun.erreurGenerique'))
            }
        }).catch(function (err) {
            toast.error(t('commun.erreurGenerique'))
            console.log(err)
        })
    }
    useEffect(() => {
        if (!peutVoirAdministration) return;
        fetchBureau();
        fetchRole();
    }, [peutVoirAdministration])

    if (!peutVoirAdministration) {
        return (
            <div className='flex flex-grow flex-col items-center justify-center py-20 gap-3 text-center'>
                <LuShieldAlert size={40} className='text-muted-foreground' />
                <h2 className='text-lg font-semibold text-foreground'>{t('settings.accesRefuse')}</h2>
                <p className='text-sm text-muted-foreground max-w-sm'>
                    {t('settings.pasLesDroits')}
                </p>
            </div>
        )
    }

    return (
        <div className='flex flex-grow flex-col py-6 w-full'>
            <Breadcrumbs where={t('sidebar.administration')} />
            <h2 className='text-2xl font-semibold text-foreground mt-1 mb-6'>{t('sidebar.administration')}</h2>
            <div className="w-full">
                <div className='inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1 mb-4'>
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setSearchParams({ tab: tab.key })}
                            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'roles' && <Role Roles={Roles} onChanged={fetchRole} />}
                {activeTab === 'categories' && <Categorie />}
                {activeTab === 'bureaux' && <Bureau Bureaux={Bureaux} onChanged={fetchBureau} />}
                {activeTab === 'services' && <ServiceMetier />}
                {activeTab === 'connectes' && <UtilisateursConnectes />}
                {activeTab === 'jetons' && isAdministrator && <JetonsApi />}
            </div>
        </div>
    )
}

export default Settings
