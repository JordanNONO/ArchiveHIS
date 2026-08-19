import React, { useState } from 'react';
import { LuMail, LuLock, LuEye, LuEyeOff } from 'react-icons/lu';
import { updateLoginAPI } from '../../api/routes/auth';
import { toast } from 'react-toastify';
import { getFormData } from '../../utils/common';

const inputClass = "w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
const labelClass = "block text-sm font-medium mb-1.5";

function AuthInfo({ user }) {
    const [authData, setAuthData] = useState({
        email: user?.mail || '',
        password: ''
    });
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    function updateAuth(e) {
        e.preventDefault();
        setSaving(true);
        updateLoginAPI(authData)
            .then((res) => {
                setSaving(false);
                if (res.status === 200) {
                    toast.success("Informations de connexion mises à jour");
                    setAuthData({ ...authData, password: '' });
                } else {
                    toast.error("Une erreur s'est produite");
                }
            })
            .catch(() => {
                setSaving(false);
                toast.error("Une erreur s'est produite");
            });
    }

    return (
        <div className='max-w-md'>
            <form onSubmit={updateAuth}>
                <div className='mb-4'>
                    <label className={labelClass}>Adresse email <span className='text-red-500'>*</span></label>
                    <div className='relative'>
                        <LuMail className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
                        <input
                            type="email"
                            name='email'
                            onChange={(e) => getFormData(e, setAuthData)}
                            placeholder="vous@hisvie.com"
                            value={authData.email}
                            className={inputClass}
                            required
                        />
                    </div>
                </div>
                <div className='mb-1'>
                    <label className={labelClass}>Nouveau mot de passe</label>
                    <div className='relative'>
                        <LuLock className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
                        <input
                            type={showPassword ? "text" : "password"}
                            onChange={(e) => getFormData(e, setAuthData)}
                            name='password'
                            value={authData.password}
                            placeholder='Laisser vide pour ne pas changer'
                            className={`${inputClass} pr-10`}
                            minLength={8}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
                            tabIndex={-1}
                        >
                            {showPassword ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                        </button>
                    </div>
                </div>
                <p className='text-xs text-muted-foreground mb-5'>8 caractères minimum.</p>
                <button
                    type="submit"
                    disabled={saving}
                    className='inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-60'
                >
                    {saving ? 'Enregistrement...' : 'Mettre à jour'}
                </button>
            </form>
        </div>
    );
}

export default AuthInfo;
