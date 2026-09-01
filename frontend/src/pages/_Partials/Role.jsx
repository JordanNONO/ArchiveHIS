import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuPlus, LuSettings2, LuShieldCheck, LuPencilLine, LuEye, LuUserCog, LuUsers, LuCheck } from 'react-icons/lu'
import { toast } from 'react-toastify'
import { createRole, attachRolePermissions } from '../../api/routes/role'
import { getPermissions } from '../../api/routes/permission'

const ROLE_VISUALS = {
    ADMIN: { icon: LuShieldCheck, tint: 'bg-primary/10 text-primary', ring: 'ring-primary/15' },
    EDITOR: { icon: LuPencilLine, tint: 'bg-accent/20 text-accent-foreground', ring: 'ring-accent/20' },
    VIEWER: { icon: LuEye, tint: 'bg-secondary/10 text-secondary', ring: 'ring-secondary/15' },
}
const DEFAULT_VISUAL = { icon: LuUserCog, tint: 'bg-muted text-muted-foreground', ring: 'ring-border' }

function Role({ Roles, onChanged }) {
    const { t } = useTranslation()
    const PERMISSION_GROUPS = useMemo(() => [
        { label: t('sidebar.administration'), codes: ['gerer_utilisateurs', 'gerer_roles', 'gerer_permissions'] },
        { label: t('roleSettings.organisationDocumentaire'), codes: ['gerer_categories', 'gerer_services_metier'] },
        { label: t('roleSettings.cycleDeVieDocuments'), codes: ['creer_documents', 'valider_documents', 'archiver_documents', 'consulter_archives'] },
        { label: t('roleSettings.gestionCourrier'), codes: ['traiter_courrier'] },
    ], [t])

    const [permissions, setPermissions] = useState([])
    const [selectedRole, setSelectedRole] = useState(null)
    const [selectedPermissionIds, setSelectedPermissionIds] = useState([])
    const [newRole, setNewRole] = useState({ nom: '', code_role: '' })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        getPermissions().then(async (res) => {
            if (res.status === 200) {
                setPermissions(await res.json())
            }
        }).catch((err) => console.log(err))
    }, [])

    const groupedPermissions = useMemo(() => {
        const groups = PERMISSION_GROUPS.map((g) => ({
            ...g,
            items: permissions.filter((p) => g.codes.includes(p.code_perm)),
        }))
        const groupedCodes = PERMISSION_GROUPS.flatMap((g) => g.codes)
        const reste = permissions.filter((p) => !groupedCodes.includes(p.code_perm))
        if (reste.length > 0) groups.push({ label: t('roleSettings.autres'), codes: [], items: reste })
        return groups.filter((g) => g.items.length > 0)
    }, [permissions, PERMISSION_GROUPS, t])

    function openPermissionsModal(role) {
        setSelectedRole(role)
        setSelectedPermissionIds((role.permissions || []).map((p) => p.id))
        document.getElementById('edit_permissions').showModal()
    }

    function togglePermission(id) {
        setSelectedPermissionIds((prev) =>
            prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
        )
    }

    function toggleGroup(items) {
        const ids = items.map((p) => p.id)
        const allChecked = ids.every((id) => selectedPermissionIds.includes(id))
        setSelectedPermissionIds((prev) =>
            allChecked ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
        )
    }

    async function savePermissions(e) {
        e.preventDefault()
        try {
            setSaving(true)
            const res = await attachRolePermissions(selectedRole.id, selectedPermissionIds)
            if (res.status === 200) {
                toast.success(t('roleSettings.permissionsMisesAJour'))
                document.getElementById('edit_permissions').close()
                onChanged && onChanged()
            } else {
                toast.error(t('commun.erreurGenerique'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setSaving(false)
        }
    }

    async function submitNewRole(e) {
        e.preventDefault()
        try {
            const res = await createRole(newRole)
            if (res.status === 200) {
                toast.success(t('roleSettings.roleCree'))
                setNewRole({ nom: '', code_role: '' })
                document.getElementById('add_role').close()
                onChanged && onChanged()
            } else {
                toast.error(t('commun.erreurGenerique'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        }
    }

    return (
        <div>
            <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5'>
                <p className='text-sm text-muted-foreground max-w-md'>
                    {t('roleSettings.description')}
                </p>
                <button
                    onClick={() => document.getElementById('add_role').showModal()}
                    className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors shrink-0'
                >
                    <LuPlus size={16} />
                    {t('roleSettings.nouveauRole')}
                </button>
            </div>

            <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {Roles.map((role) => {
                    const visual = ROLE_VISUALS[role.code_role] || DEFAULT_VISUAL
                    const Icon = visual.icon
                    const rolePermissions = role.permissions || []
                    const totalPermissions = permissions.length
                    const membres = role.utilisateurs_count ?? 0

                    return (
                        <div key={role.id} className={`flex flex-col rounded-2xl border border-border bg-card p-5 ring-1 ${visual.ring} hover:shadow-md transition-shadow`}>
                            <div className='flex items-start justify-between gap-2 mb-4'>
                                <div className='flex items-center gap-3'>
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${visual.tint}`}>
                                        <Icon size={18} />
                                    </div>
                                    <div>
                                        <h3 className='font-semibold text-foreground leading-tight'>{role.nom}</h3>
                                        {role.code_role && <p className='text-xs text-muted-foreground font-mono mt-0.5'>{role.code_role}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className='flex items-center gap-3 mb-4 flex-grow'>
                                <div className='flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground'>
                                    <LuUsers size={13} />
                                    {t('roleSettings.membre', { count: membres })}
                                </div>
                                <div className='flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground'>
                                    <LuShieldCheck size={13} />
                                    {t('roleSettings.permissionsSur', { count: rolePermissions.length, total: totalPermissions || rolePermissions.length })}
                                </div>
                            </div>

                            <button
                                onClick={() => openPermissionsModal(role)}
                                className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors'
                            >
                                <LuSettings2 size={15} />
                                {t('roleSettings.gererPermissions')}
                            </button>
                        </div>
                    )
                })}
                {Roles.length === 0 && (
                    <p className='text-muted-foreground col-span-full text-center py-8'>{t('roleSettings.aucunRoleDefini')}</p>
                )}
            </div>

            <dialog id="add_role" className="modal">
                <div className="modal-box rounded-2xl">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <div>
                        <h1 className='text-lg font-semibold mb-4'>
                            {t('roleSettings.ajouterRole')}
                        </h1>
                        <form onSubmit={submitNewRole}>
                            <div className="mb-4">
                                <label htmlFor="nom" className='block text-sm font-medium mb-1.5'>{t('roleSettings.nomDuRole')} <span className='text-red-500'>*</span></label>
                                <input
                                    type="text"
                                    id='nom'
                                    value={newRole.nom}
                                    onChange={(e) => setNewRole({ ...newRole, nom: e.target.value })}
                                    placeholder={t('roleSettings.placeholderNomRole')}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="code_role" className='block text-sm font-medium mb-1.5'>{t('roleSettings.codeDuRole')}</label>
                                <input
                                    type="text"
                                    id='code_role'
                                    value={newRole.code_role}
                                    onChange={(e) => setNewRole({ ...newRole, code_role: e.target.value.toUpperCase() })}
                                    placeholder="COMPTABLE"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                            <div className="modal-action">
                                <button type="submit" className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>{t('personnel.enregistrer')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            </dialog>

            <dialog id="edit_permissions" className="modal">
                <div className="modal-box rounded-2xl max-w-xl">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <div className='flex items-center gap-3 mb-1'>
                        <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${(ROLE_VISUALS[selectedRole?.code_role] || DEFAULT_VISUAL).tint}`}>
                            {(() => { const I = (ROLE_VISUALS[selectedRole?.code_role] || DEFAULT_VISUAL).icon; return <I size={16} /> })()}
                        </div>
                        <div>
                            <h1 className='text-lg font-semibold leading-tight'>{t('roleSettings.permissionsTitre')}</h1>
                            <p className='text-sm text-muted-foreground'>{selectedRole?.nom}</p>
                        </div>
                        <span className='ml-auto text-xs font-medium text-muted-foreground bg-muted rounded-full px-2.5 py-1'>
                            {t('roleSettings.selectionnees', { count: selectedPermissionIds.length, total: permissions.length })}
                        </span>
                    </div>
                    <form onSubmit={savePermissions}>
                        <div className='mt-4 mb-5 max-h-96 overflow-y-auto pr-1 space-y-4'>
                            {groupedPermissions.map((group) => {
                                const groupIds = group.items.map((p) => p.id)
                                const allChecked = groupIds.every((id) => selectedPermissionIds.includes(id))
                                return (
                                    <div key={group.label} className='rounded-xl border border-border overflow-hidden'>
                                        <div className='flex items-center justify-between bg-muted/60 px-3.5 py-2 border-b border-border'>
                                            <span className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>{group.label}</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(group.items)}
                                                className='inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'
                                            >
                                                <LuCheck size={12} />
                                                {allChecked ? t('roleSettings.toutRetirer') : t('roleSettings.toutSelectionner')}
                                            </button>
                                        </div>
                                        <div className='grid grid-cols-2 gap-2 p-3'>
                                            {group.items.map((permission) => {
                                                const checked = selectedPermissionIds.includes(permission.id)
                                                return (
                                                    <label
                                                        key={permission.id}
                                                        className={`flex items-center gap-2.5 cursor-pointer text-sm rounded-lg border px-3 py-2 transition-colors ${checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted'}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="checkbox checkbox-sm checkbox-primary"
                                                            checked={checked}
                                                            onChange={() => togglePermission(permission.id)}
                                                        />
                                                        {permission.label_perm}
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className='modal-action'>
                            <button type='submit' disabled={saving} className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                                {saving ? t('profile.enregistrementEnCours') : t('personnel.enregistrer')}
                            </button>
                        </div>
                    </form>
                </div>
            </dialog>
        </div>
    )
}

export default Role
