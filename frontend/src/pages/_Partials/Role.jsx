import React, { useEffect, useState } from 'react'
import { LuPlus, LuSettings2 } from 'react-icons/lu'
import { toast } from 'react-toastify'
import { createRole, attachRolePermissions } from '../../api/routes/role'
import { getPermissions } from '../../api/routes/permission'

function Role({ Roles, onChanged }) {
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

    async function savePermissions(e) {
        e.preventDefault()
        try {
            setSaving(true)
            const res = await attachRolePermissions(selectedRole.id, selectedPermissionIds)
            if (res.status === 200) {
                toast.success('Permissions mises à jour')
                document.getElementById('edit_permissions').close()
                onChanged && onChanged()
            } else {
                toast.error('Une erreur est survenue')
            }
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
        } finally {
            setSaving(false)
        }
    }

    async function submitNewRole(e) {
        e.preventDefault()
        try {
            const res = await createRole(newRole)
            if (res.status === 200) {
                toast.success('Rôle créé avec succès')
                setNewRole({ nom: '', code_role: '' })
                document.getElementById('add_role').close()
                onChanged && onChanged()
            } else {
                toast.error('Une erreur est survenue')
            }
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
        }
    }

    return (
        <div>
            <div className="flex items-center justify-end">
                <button onClick={() => document.getElementById('add_role').showModal()} className='btn btn-sm bg-primary text-white hover:bg-primary'>
                    <LuPlus />
                    Nouveau rôle
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Nom du rôle</th>
                            <th>Permissions</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Roles.map((role, k) => (
                            <tr key={k}>
                                <th></th>
                                <td>{role.nom}</td>
                                <td>
                                    <div className='flex flex-wrap gap-1'>
                                        {(role.permissions || []).map((p) => (
                                            <span key={p.id} className='badge badge-sm bg-secondary text-white border-none'>{p.label_perm}</span>
                                        ))}
                                        {(role.permissions || []).length === 0 && <span className='text-muted-foreground text-sm'>Aucune permission</span>}
                                    </div>
                                </td>
                                <td>
                                    <button onClick={() => openPermissionsModal(role)} className='btn btn-sm btn-ghost'>
                                        <LuSettings2 />
                                        Gérer
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <dialog id="add_role" className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <div>
                        <h1 className='text-xl font-bold mb-5'>
                            Ajouter un rôle
                        </h1>
                        <form onSubmit={submitNewRole}>
                            <div className="form-control mb-3">
                                <label htmlFor="nom" className='mb-1'>Nom du rôle</label>
                                <input
                                    type="text"
                                    id='nom'
                                    value={newRole.nom}
                                    onChange={(e) => setNewRole({ ...newRole, nom: e.target.value })}
                                    placeholder="Comptable"
                                    className="input input-bordered w-full"
                                    required
                                />
                            </div>
                            <div className="form-control mb-3">
                                <label htmlFor="code_role" className='mb-1'>Code du rôle</label>
                                <input
                                    type="text"
                                    id='code_role'
                                    value={newRole.code_role}
                                    onChange={(e) => setNewRole({ ...newRole, code_role: e.target.value })}
                                    placeholder="COMPTABLE"
                                    className="input input-bordered w-full"
                                />
                            </div>
                            <div className="modal-action">
                                <button type="submit" className='btn bg-primary text-white hover:bg-primary'>Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            </dialog>

            <dialog id="edit_permissions" className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <h1 className='text-xl font-bold mb-5'>
                        Permissions — {selectedRole?.nom}
                    </h1>
                    <form onSubmit={savePermissions}>
                        <div className='flex flex-col gap-2 mb-5 max-h-80 overflow-y-auto'>
                            {permissions.map((permission) => (
                                <label key={permission.id} className='flex items-center gap-2 cursor-pointer'>
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={selectedPermissionIds.includes(permission.id)}
                                        onChange={() => togglePermission(permission.id)}
                                    />
                                    {permission.label_perm}
                                </label>
                            ))}
                        </div>
                        <div className='modal-action'>
                            <button type='submit' disabled={saving} className='btn bg-primary text-white hover:bg-primary'>
                                {saving ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                        </div>
                    </form>
                </div>
            </dialog>
        </div>
    )
}

export default Role
