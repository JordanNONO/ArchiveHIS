import React, { useRef, useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import { createBureaux } from '../../api/routes/bureau';
import { toast } from 'react-toastify';

function Bureau({Bureaux}) {
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
    /**
     * 
     * @param {Event} e 
     */
    function handleSubmit(e){
        e.preventDefault()
        try {
            createBureaux(formData).then(async function(res){
                if (res.status===201) {
                    toast.success("Bureau créé avec succès")
                    if (modalRef.current) {
                        modalRef.current.close()
                    }
                    return
                }else{
                    toast.error("Une erreur s'est produite")
                }
            })
        } catch (error) {
            toast.error("Une erreur s'est produite")
        }
    }
    return (
        <div>
            <div className="flex items-center justify-end">
                <button onClick={() => document.getElementById('add_bureau').showModal()} className='btn btn-sm bg-primary text-white hover:bg-primary'>
                    <LuPlus />
                    Nouveau bureau
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="table">
                    {/* head */}
                    <thead>
                        <tr>
                            <th></th>
                            <th>Nom du bureau</th>
                        </tr>
                    </thead>
                    <tbody>
                        {
                            Bureaux.map((bureau, k) => (

                                < tr key={k}>
                                    <th>1</th>
                                    <td>{bureau?.name}</td>
                                </tr>
                            ))
                        }

                    </tbody>
                </table>
            </div>
            {/* You can open the modal using document.getElementById('ID').showModal() method */}
            <dialog id="add_bureau" ref={modalRef} className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        {/* if there is a button in form, it will close the modal */}
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
                    <div>
                        <h1 className='text-xl font-bold mb-5'>
                            Ajouter un bureau
                        </h1>
                        <form action="" method="post" onSubmit={handleSubmit}>
                            <div className="form-control mb-3">
                                <label htmlFor="name" className='mb-1'>Nom du bureau</label>
                                <input type="text" id='name' name='name' onChange={handleChange} placeholder="Bureau Informatique" class="input input-bordered w-full" />
                            </div>
                            <button className='btn bg-primary text-white hover:bg-primary'>Enregistrer</button>
                        </form>
                    </div>
                   
                </div>
            </dialog>
        </div >
    )
}

export default Bureau