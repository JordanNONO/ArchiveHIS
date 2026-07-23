import React, { useEffect, useState } from 'react'
import Role from './_Partials/Role'
import Bureau from './_Partials/Bureau'
import Categorie from './_Partials/Categorie'
import { getBureaux } from '../api/routes/bureau'
import { getRoles } from '../api/routes/role'
import { toast } from 'react-toastify'
import Loading from '../components/Loading'

function Settings() {
    const [Roles, setRoles] = useState([])
    const [Bureaux, setBureaux] = useState([])
    const [load, setLoading] = useState(false)
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
        setLoading(true)
        getBureaux().then(async function (res) {
            if (res.status === 200) {
                const data = await res.json()
                setBureaux(data)
                setLoading(false)
            } else {
                setLoading(false)
                toast.error("Une erreur est survenue ")
            }
        }).catch(function (err) {
            toast.error("Une erreur est survenue ")
            console.log(err)
            setLoading(false)
        })
    }
    useEffect(() => {
        fetchBureau();
        fetchRole();
    }, [])

    return load ? <Loading /> : (
        <div className='flex flex-grow'>
            <div className="mt-5 w-full">
                <div role="tablist" className="tabs tabs-lifted w-full">
                    <input
                        type="radio"
                        defaultChecked
                        name="my_tabs_2"
                        role="tab"
                        className="tab"
                        aria-label="Roles & Permissions"
                    />
                    <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                        <Role Roles={Roles} onChanged={fetchRole} />
                    </div>

                    <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="Bureaux" />
                    <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                        <Bureau Bureaux={Bureaux} />
                    </div>

                    <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="Catégories" />
                    <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                        <Categorie />
                    </div>

                    <input
                        type="radio"
                        name="my_tabs_2"
                        role="tab"
                        className="tab"
                        aria-label="Stockage"
                    />
                    <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                        Stockage
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Settings
