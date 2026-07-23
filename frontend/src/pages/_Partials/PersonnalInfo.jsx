import React, { useState, useEffect } from 'react';
import { updatePersonnels } from '../../api/routes/personnel';
import { toast } from 'react-toastify';
import { getFormData } from '../../utils/common';

function PersonnalInfo({ user }) {
    const [personnel, setPersonnel] = useState({
        nom: '',
        prenom: '',
        sexe: '',
        date_naissance: '',
        lieu_naissance: '',
        statut_mat: '',
        lieu_residence: '',
        first_phone: '',
        second_phone: '',
        cni: '',
        lang: '',
        bibliographie: '',
        nb_enfant: 0,
    });

    useEffect(() => {
        if (user) {
            setPersonnel(user.personnel);
        }
    }, [user]);

    function putPersonnalData(e) {
        e.preventDefault();
        try {
            updatePersonnels(personnel).then(async (res) => {
                if (res.status === 200) {
                    const data = await res.json();
                    setPersonnel(data.personnel);
                    toast.success("Votre profile a été bien modifié");
                } else {
                    toast.error("Une erreur s'est produite");
                }
            }).catch(() => {
                toast.error("Une erreur s'est produite");
            });
        } catch (error) {
            toast.error("Une erreur s'est produite");
        }
    }

    return (
        <div className='max-h-[50vh] overflow-auto px-8 relative'>
            <form onSubmit={putPersonnalData} method="post">
                <div className='flex items-end justify-end sticky top-0'>
                    <button className='btn btn-sm bg-primary text-white hover:bg-primary'>Mettre à jour</button>
                </div>
                <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
                    <div className="form-control mb-3">
                        <label htmlFor="nom" className='mb-1'>Nom</label>
                        <input type="text" id='nom' name='nom' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.nom} className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control mb-3">
                        <label htmlFor="prenom" className='mb-1'>Prénom</label>
                        <input type="text" id='prenom' name='prenom' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.prenom} className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control mb-3">
                        <label htmlFor="resi" className='mb-1'>Lieu de résidence</label>
                        <input type="text" id='resi' name='lieu_residence' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.lieu_residence} className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control mb-3">
                        <label htmlFor="date_naissance" className='mb-1'>Date de naissance</label>
                        <input type="date" id='date_naissance' name='date_naissance' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.date_naissance} className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control mb-3">
                        <label htmlFor="lieu_naissance" className='mb-1'>Lieu de naissance</label>
                        <input type="text" id='lieu_naissance' name='lieu_naissance' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.lieu_naissance} className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control mb-3">
                        <label htmlFor="cni" className='mb-1'>CNI</label>
                        <input type="text" id='cni' name='cni' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.cni} className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control mb-3">
                        <label htmlFor="first_phone" className='mb-1'>Numéro de téléphone principal</label>
                        <input type="text" id='first_phone' name='first_phone' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.first_phone} className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control mb-3">
                        <label htmlFor="second_phone" className='mb-1'>Numéro secondaire</label>
                        <input type="text" id='second_phone' name='second_phone' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.second_phone} className="input input-bordered w-full" />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Status matrimonial</span>
                        </label>
                        <select
                            name="statut_mat"
                            value={personnel?.statut_mat}
                            onChange={(e) => getFormData(e, setPersonnel)}
                            className="select select-bordered"
                            required
                        >
                            <option value="">Sélectionner votre statut matrimonial</option>
                            <option value="Célibataire">Célibataire</option>
                            <option value="Marié">Marié</option>
                            <option value="Divorcé">Divorcé</option>
                        </select>
                    </div>
                    <div className="form-control mb-3">
                        <label htmlFor="nb_enfant" className='mb-1'>Nombre d'enfant</label>
                        <input type="number" id='nb_enfant' name='nb_enfant' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.nb_enfant} className="input input-bordered w-full" />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Sélectionner un genre</span>
                        </label>
                        <select
                            name="sexe"
                            value={personnel?.sexe}
                            onChange={(e) => getFormData(e, setPersonnel)}
                            className="select select-bordered"
                            required
                        >
                            <option value="">Sélectionner votre genre</option>
                            <option value="Homme">Homme</option>
                            <option value="Femme">Femme</option>
                        </select>
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Votre langue</span>
                        </label>
                        <select
                            name="lang"
                            value={personnel?.lang}
                            onChange={(e) => getFormData(e, setPersonnel)}
                            className="select select-bordered"
                        >
                            <option value="">Sélectionner une langue</option>
                            <option value="Anglais">Anglais</option>
                            <option value="Français">Français</option>
                        </select>
                    </div>
                </div>
                <div className="form-control mb-3">
                    <label htmlFor="biographie" className='mb-1'>Biographie</label>
                    <textarea id='biographie' name='biographie' onChange={(e) => getFormData(e, setPersonnel)} className="textarea textarea-bordered w-full" />
                </div>
            </form>
        </div>
    );
}

export default PersonnalInfo;
