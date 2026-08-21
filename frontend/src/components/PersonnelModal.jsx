import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRoles } from '../api/routes/role';
import { getBureaux } from '../api/routes/bureau';
import { createPersonnel } from '../api/routes/personnel';
import { toast } from 'react-toastify';
import Loading from './Loading';

function PersonnelModal({ isOpen, onClose, onSaveSuccess }) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        nom_pers: '',
        prenom_pers: '',
        email: '',
        role_id: '',
        first_phone_pers:'',
        bureau_id: '',
    });
    const [Roles, setRoles] = useState([])
    const [Bureaux, setBureaux] = useState([])
    const [load,setLoading] = useState(false)
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

   

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
            }else{
                toast.error(t('personnel.erreurCreationPersonnel'))
            }
        }).catch(function (err) {
            toast.error(t('personnel.erreurCreationPersonnel'))
            console.log(err)
        })
    }

    useEffect(() => {
        fetchRole()
        fetchBureau()
        
        return () => {
            fetchRole()
            fetchBureau()

        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[])


    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true)
            const response = await createPersonnel(formData)
            if (response.status ===201) {
                const data = await response.json()
                toast.success(
                    data.identifiants_envoyes
                        ? t('personnel.personnelCreeIdentifiantsEnvoyes')
                        : t('personnel.personnelCreeEmailEchoue')
                )
                onSaveSuccess(data); // Assuming response.data contains the saved personnel data
                onClose(); // Close the modal on successful save
                setLoading(false)
            } else {
                const data = await response.json().catch(() => ({}))
                toast.error(data?.error || t('personnel.erreurCreationPersonnel'))
                setLoading(false)
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du personnel:', error);
            toast.error(t('personnel.erreurCreationPersonnel'))
            setLoading(false)
        }
    };

    if (!isOpen) return null;

    return load?<Loading/>: (
        <div className="modal modal-open">
            <div className="modal-box">
                <h2 className="font-bold text-lg">{t('personnel.ajouterTitre')}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t('personnel.nom')} <span className="text-red-500">*</span></span>
                        </label>
                        <input
                            type="text"
                            name="nom_pers"
                            value={formData.nom_pers}
                            onChange={handleChange}
                            className="input input-bordered"
                            placeholder={t('personnel.entrerNom')}
                            required
                        />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t('personnel.prenom')} <span className="text-red-500">*</span></span>
                        </label>
                        <input
                            type="text"
                            name="prenom_pers"
                            value={formData.prenom_pers}
                            onChange={handleChange}
                            className="input input-bordered"
                            placeholder={t('personnel.entrerPrenom')}
                            required
                        />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t('personnel.email')} <span className="text-red-500">*</span></span>
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="input input-bordered"
                            placeholder={t('personnel.entrerEmail')}
                            required
                        />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t('personnel.numeroTelephone')} <span className="text-red-500">*</span></span>
                        </label>
                        <input
                            type="tel"
                            name="first_phone_pers"
                            value={formData.first_phone_pers}
                            onChange={handleChange}
                            className="input input-bordered"
                            placeholder={t('personnel.entrerTelephone')}
                            required
                        />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t('personnel.role')} <span className="text-red-500">*</span></span>
                        </label>
                        <select
                            name="role_id"
                            value={formData.role_id}
                            onChange={handleChange}
                            className="select select-bordered"
                            required
                        >
                            <option value="">{t('personnel.selectionnerRole')}</option>
                            {Roles.map((role)=>(
                                <option key={role?.id} value={role?.id}>{role?.nom}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">{t('personnel.bureau')} <span className="text-red-500">*</span></span>
                        </label>
                        <select
                            name="bureau_id"
                            value={formData.bureau_id}
                            onChange={handleChange}
                            className="select select-bordered"
                            required
                        >
                            <option value="">{t('personnel.selectionnerBureau')}</option>
                            {Bureaux.map((bureau)=>(
                                <option key={bureau?.id} value={bureau?.id}>{bureau?.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="modal-action">
                        <button type="button" className="btn" onClick={onClose}>
                            {t('personnel.annuler')}
                        </button>
                        <button type="submit" className="btn text-white hover:bg-primary bg-primary">
                            {t('personnel.sauvegarder')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default PersonnelModal;
