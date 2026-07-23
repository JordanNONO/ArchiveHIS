import React from 'react'
import { LuPlus } from 'react-icons/lu'

function Role({Roles}) {
    return (
        <div>
            <div className="flex items-center justify-end">
                {/* <button onClick={() => document.getElementById('add_role').showModal()} className='btn btn-sm bg-primary text-white hover:bg-primary'>
                    <LuPlus/>
                    Nouvau Role
                </button> */}
            </div>
            <div className="overflow-x-auto">
                <table className="table">
                    {/* head */}
                    <thead>
                        <tr>
                            <th></th>
                            <th>Nom du role</th>
                            <th>Accréditation</th>
                        </tr>
                    </thead>
                    <tbody>
                        
                        {Roles.map((role,k)=>(
                            <tr key={k}>
                            <th></th>
                            <td>{role.label}</td>
                            <td>{role.acreditation}</td>
                        </tr>
                        ))}
                        
                    </tbody>
                </table>
            </div>
            {/* You can open the modal using document.getElementById('ID').showModal() method */}
            <dialog id="add_role" className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        {/* if there is a button in form, it will close the modal */}
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <div>
                        <h1 className='text-xl font-bold mb-5'>
                            Ajouter un role
                        </h1>
                        <form action="" method="post">
                            <div className="form-control mb-3">
                                <label htmlFor="name" className='mb-1'>Nom du role</label>
                                <input type="text" id='name' placeholder="Bureau Informatique" class="input input-bordered w-full" />
                            </div>
                        </form>
                    </div>
                    <div className='modal-action'>
                        <form method='dialog'>
                            <button className='btn bg-secondary hover:bg-secondary'>
                                Fermer
                            </button>
                        </form>
                        <button className='btn bg-primary text-white hover:bg-primary'>Enregistrer</button>
                    </div>
                </div>
            </dialog>
        </div>
    )
}

export default Role