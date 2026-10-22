import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuMail, LuLock, LuEye, LuEyeOff, LuShieldCheck } from 'react-icons/lu';
import { updateLoginAPI } from '../../api/routes/auth';
import { toast } from 'react-toastify';
import { getFormData } from '../../utils/common';

const inputClass = "w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
const labelClass = "block text-sm font-medium mb-1.5";

function AuthInfo({ user }) {
    const { t } = useTranslation();
    const [emailInitial, setEmailInitial] = useState(user?.mail || '');
    const [authData, setAuthData] = useState({
        email: user?.mail || '',
        password: '',
        current_password: '',
    });
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Changer l'e-mail (l'identifiant de connexion) ou le mot de passe exige
    // le mot de passe actuel — voir AuthController::update().
    const changeIdentifiants = authData.password !== '' || authData.email !== emailInitial;

    function updateAuth(e) {
        e.preventDefault();
        setSaving(true);
        updateLoginAPI(authData)
            .then(async (res) => {
                setSaving(false);
                if (res.status === 200) {
                    toast.success(t('profile.connexionMiseAJour'));
                    setEmailInitial(authData.email);
                    setAuthData({ ...authData, password: '', current_password: '' });
                } else {
                    // 422 : message précis du serveur (mot de passe actuel
                    // incorrect, mot de passe trop court ou trop courant...).
                    const data = await res.json().catch(() => ({}));
                    const premiereErreur = data?.errors && Object.values(data.errors)[0]?.[0];
                    toast.error(premiereErreur || data?.error || t('commun.erreurGenerique'));
                }
            })
            .catch(() => {
                setSaving(false);
                toast.error(t('commun.erreurGenerique'));
            });
    }

    return (
        <div className='max-w-md'>
            <form onSubmit={updateAuth}>
                <div className='mb-4'>
                    <label htmlFor='auth-email' className={labelClass}>{t('profile.adresseEmail')} <span className='text-red-500'>*</span></label>
                    <div className='relative'>
                        <LuMail className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
                        <input
                            id='auth-email'
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
                    <label htmlFor='auth-password' className={labelClass}>{t('profile.nouveauMotDePasse')}</label>
                    <div className='relative'>
                        <LuLock className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
                        <input
                            id='auth-password'
                            type={showPassword ? "text" : "password"}
                            onChange={(e) => getFormData(e, setAuthData)}
                            name='password'
                            value={authData.password}
                            placeholder={t('profile.laisserVidePourNePasChanger')}
                            className={`${inputClass} pr-10`}
                            minLength={12}
                            autoComplete='new-password'
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
                            tabIndex={-1}
                            aria-label={showPassword ? t('profile.masquerMotDePasse', 'Masquer le mot de passe') : t('profile.afficherMotDePasse', 'Afficher le mot de passe')}
                        >
                            {showPassword ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                        </button>
                    </div>
                </div>
                <p className='text-xs text-muted-foreground mb-5'>{t('profile.huitCaracteresMinimum')}</p>
                {changeIdentifiants && (
                    <div className='mb-5'>
                        <label htmlFor='auth-current-password' className={labelClass}>{t('profile.motDePasseActuel')} <span className='text-red-500'>*</span></label>
                        <div className='relative'>
                            <LuShieldCheck className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
                            <input
                                id='auth-current-password'
                                type="password"
                                onChange={(e) => getFormData(e, setAuthData)}
                                name='current_password'
                                value={authData.current_password}
                                className={inputClass}
                                autoComplete='current-password'
                                required
                            />
                        </div>
                        <p className='text-xs text-muted-foreground mt-1'>{t('profile.motDePasseActuelIndication')}</p>
                    </div>
                )}
                <button
                    type="submit"
                    disabled={saving}
                    className='inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-60'
                >
                    {saving ? t('profile.enregistrementEnCours') : t('profile.mettreAJour')}
                </button>
            </form>
        </div>
    );
}

export default AuthInfo;
