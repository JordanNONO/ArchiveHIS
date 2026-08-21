import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { updatePersonnels } from '../../api/routes/personnel';
import { toast } from 'react-toastify';
import { getFormData } from '../../utils/common';

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
const labelClass = "block text-sm font-medium mb-1.5";

function PersonnalInfo({ user, onUpdated }) {
    const { t } = useTranslation();
    const [personnel, setPersonnel] = useState({
        nom: '',
        prenom: '',
        first_phone: '',
        lieu_residence: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user?.personnel) {
            setPersonnel(user.personnel);
        }
    }, [user]);

    function putPersonnalData(e) {
        e.preventDefault();
        setSaving(true);
        updatePersonnels(personnel).then(async (res) => {
            setSaving(false);
            if (res.status === 200) {
                const data = await res.json();
                setPersonnel(data.personnel);
                onUpdated && onUpdated(data.personnel);
                toast.success(t('profile.profilMisAJour'));
            } else {
                toast.error(t('commun.erreurGenerique'));
            }
        }).catch(() => {
            setSaving(false);
            toast.error(t('commun.erreurGenerique'));
        });
    }

    return (
        <form onSubmit={putPersonnalData}>
            <div className='grid md:grid-cols-2 grid-cols-1 gap-4 mb-6'>
                <div>
                    <label htmlFor="nom" className={labelClass}>{t('personnel.nom')} <span className='text-red-500'>*</span></label>
                    <input type="text" id='nom' name='nom' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.nom || ''} className={inputClass} required />
                </div>
                <div>
                    <label htmlFor="prenom" className={labelClass}>{t('personnel.prenom')} <span className='text-red-500'>*</span></label>
                    <input type="text" id='prenom' name='prenom' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.prenom || ''} className={inputClass} required />
                </div>
                <div>
                    <label htmlFor="first_phone" className={labelClass}>{t('profile.telephone')} <span className='text-red-500'>*</span></label>
                    <input type="text" id='first_phone' name='first_phone' onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.first_phone || ''} className={inputClass} required />
                </div>
                <div>
                    <label htmlFor="lieu_residence" className={labelClass}>{t('profile.adresse')} <span className='text-red-500'>*</span></label>
                    <input type="text" id='lieu_residence' name='lieu_residence' placeholder={t('profile.placeholderAdresse')} onChange={(e) => getFormData(e, setPersonnel)} value={personnel?.lieu_residence || ''} className={inputClass} required />
                </div>
            </div>

            <div className='flex justify-end'>
                <button
                    type="submit"
                    disabled={saving}
                    className='inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-60'
                >
                    {saving ? t('profile.enregistrementEnCours') : t('profile.enregistrerModifications')}
                </button>
            </div>
        </form>
    );
}

export default PersonnalInfo;
