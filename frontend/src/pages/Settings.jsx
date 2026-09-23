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
    const { isSuperAdministrator, hasPermission } = usePermissions()
    // Chaque onglet exige sa propre permission — pas juste "fait partie de la
    // rubrique Administration" — pour qu'un Administrateur qui n'a plus
    // gerer_roles/gerer_utilisateurs/gerer_services_metier (voir RoleSeeder,
    // réservé au Super Administrateur) ne voie même pas ces onglets, plutôt
    // que de les voir puis se heurter à un refus du serveur en cliquant dedans.
    const TABS = [
        hasPermission('gerer_roles') && { key: 'roles', label: t('sidebar.rolesPermissions') },
        hasPermission('gerer_categories') && { key: 'categories', label: t('sidebar.categories') },
        hasPermission('gerer_utilisateurs') && { key: 'bureaux', label: t('sidebar.bureaux') },
        hasPermission('gerer_services_metier') && { key: 'services', label: t('sidebar.servicesMetier') },
        hasPermission('gerer_utilisateurs') && { key: 'connectes', label: t('settings.utilisateursConnectes') },
    ].filter(Boolean)
    const [Roles, setRoles] = useState([])
    const [Bureaux, setBureaux] = useState([])
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = searchParams.get('tab') || TABS[0]?.key
    const peutVoirAdministration = PERMISSIONS_ADMIN.some(hasPermission)
    // Onglet réservé au Super Administrateur (pas aux permissions
    // "administratives" au sens large) — un jeton donne un accès complet aux
    // données, ce n'est pas une décision à la portée d'un Administrateur
    // "normal", encore moins d'un Éditeur.
    const tabs = isSuperAdministrator ? [...TABS, { key: 'jetons', label: t('settings.jetonsApi') }] : TABS

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

                {activeTab === 'roles' && hasPermission('gerer_roles') && <Role Roles={Roles} onChanged={fetchRole} />}
                {activeTab === 'categories' && hasPermission('gerer_categories') && <Categorie />}
                {activeTab === 'bureaux' && hasPermission('gerer_utilisateurs') && <Bureau Bureaux={Bureaux} onChanged={fetchBureau} />}
                {activeTab === 'services' && hasPermission('gerer_services_metier') && <ServiceMetier />}
                {activeTab === 'connectes' && hasPermission('gerer_utilisateurs') && <UtilisateursConnectes />}
                {activeTab === 'jetons' && isSuperAdministrator && <JetonsApi />}
            </div>
        </div>
    )
}

export default Settings
