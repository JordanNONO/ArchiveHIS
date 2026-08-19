import React, { useState } from 'react'
import { FiLock } from "react-icons/fi"
import { IoMailOutline } from "react-icons/io5"
import { LuLoader2, LuEye, LuEyeOff } from "react-icons/lu"
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { loginAPI } from '../api/routes/auth'
import hisLogo from '../assets/his-badge.png'
import LanguageSwitcher from '../components/LanguageSwitcher'

function Login() {
	const { t } = useTranslation()
	const [user, setUser] = useState({ email: "", password: "" })
	const [loading, setLoading] = useState(false)
	const [showPassword, setShowPassword] = useState(false)

	function onChangeData(e) {
		setUser((prevData) => ((
			{
				...prevData,
				[e.target.id]: e.target.value
			}
		)))
	}

	function handSubmit(e) {
		e.preventDefault()
		if (Object.keys(user).filter((u) => user[u] === "").length === 0) {
			setLoading(true)
			const { email, password } = user
			loginAPI({ login: email, password }).then(async function (response) {
				setLoading(false)
				if (response.status === 200) {
					const { token } = await response.json()
					sessionStorage.setItem("token", token)
					toast.success(t('login.bienvenue'))
					window.location.href = "/"
					return;
				} else {
					toast.error(t('login.identifiantsIncorrects'))
					return;
				}
			}).catch((err) => {
				setLoading(false)
				console.log(err)
				toast.error(t('commun.erreurGenerique'))
			})
		} else {
			toast.warning(t('commun.champsObligatoires'))
		}
	}

	return (
		<div className='min-h-screen w-full flex flex-col lg:flex-row bg-background relative'>
			<div className='absolute top-4 right-4 z-10'>
				<LanguageSwitcher variant='light' />
			</div>
			<div className='hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center bg-gradient-to-b from-[#1B365D] to-[#0A0F16] p-12 overflow-hidden'>
				{/* Même mesh animé que les wizards (animate-wizard-drift-a/b, définis
				    globalement dans index.css/tailwind.config.js) — la page de
				    connexion était le seul écran principal resté totalement statique. */}
				<div className='absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/30 blur-3xl animate-wizard-drift-a' />
				<div className='absolute bottom-0 right-0 w-96 h-96 rounded-full bg-accent/10 blur-3xl animate-wizard-drift-b' />
				<div className='relative flex flex-col items-center text-center gap-5 max-w-sm'>
					<div className='relative'>
						<div className='absolute inset-0 rounded-full bg-accent/25 blur-xl scale-125' />
						<div className='relative w-28 h-28 rounded-full bg-white shadow-lg ring-4 ring-white/5 overflow-hidden'>
							<img src={hisLogo} alt="Hetep Iaout Services" className='w-full h-full object-cover' />
						</div>
					</div>
					<div>
						<h1 className='text-white text-xl font-semibold tracking-wide'>{t('commun.entreprise')}</h1>
						<p className='text-white/40 text-sm mt-2 leading-relaxed'>
							{t('login.descriptionEntreprise')}
						</p>
					</div>
					<div className='h-px w-16 bg-white/10' />
					<p className='text-white/30 text-xs italic'>{t('commun.slogan')}</p>
				</div>
			</div>

			<div className='flex flex-1 items-center justify-center px-5 py-10 sm:px-8'>
				<div className='w-full max-w-sm'>
					<div className='lg:hidden flex flex-col items-center gap-3 mb-8'>
						<div className='w-16 h-16 rounded-full bg-primary/10 ring-1 ring-primary/15 overflow-hidden'>
							<img src={hisLogo} alt="Hetep Iaout Services" className='w-full h-full object-cover' />
						</div>
						<div className='text-center'>
							<h1 className='text-foreground text-sm font-semibold'>{t('commun.entreprise')}</h1>
							<p className='text-muted-foreground text-xs mt-0.5'>{t('commun.sousTitreArchive')}</p>
						</div>
					</div>

					<h2 className='text-2xl font-semibold text-foreground'>{t('login.titre')}</h2>
					<p className='text-sm text-muted-foreground mt-1.5 mb-8'>{t('login.sousTitre')}</p>

					<form onSubmit={handSubmit} className='flex flex-col gap-5'>
						<div>
							<label htmlFor='email' className='block text-sm font-medium mb-1.5 text-foreground'>{t('login.email')}</label>
							<div className='relative'>
								<IoMailOutline className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={17} />
								<input
									type='text'
									placeholder='vous@hisvie.com'
									onChange={onChangeData}
									id='email'
									className='w-full rounded-2xl border-[1.5px] border-border bg-background pl-10 pr-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow'
								/>
							</div>
						</div>

						<div>
							<div className='flex items-center justify-between mb-1.5'>
								<label htmlFor='password' className='block text-sm font-medium text-foreground'>{t('login.motDePasse')}</label>
								<Link to='/mot-de-passe-oublie' className='text-xs text-primary hover:underline'>{t('login.motDePasseOublie')}</Link>
							</div>
							<div className='relative'>
								<FiLock className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
								<input
									type={showPassword ? 'text' : 'password'}
									onChange={onChangeData}
									id='password'
									placeholder='••••••••'
									className='w-full rounded-2xl border-[1.5px] border-border bg-background pl-10 pr-10 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow'
								/>
								<button
									type='button'
									onClick={() => setShowPassword((v) => !v)}
									className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
									tabIndex={-1}
								>
									{showPassword ? <LuEyeOff size={16} /> : <LuEye size={16} />}
								</button>
							</div>
						</div>

						<button
							type='submit'
							disabled={loading}
							className='inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-60 disabled:shadow-none mt-2'
						>
							{loading && <LuLoader2 size={16} className='animate-spin' />}
							{loading ? t('login.connexionEnCours') : t('login.seConnecter')}
						</button>
					</form>

					<p className='text-center text-xs text-muted-foreground mt-8'>
						{t('login.pasDeCompte')} <Link to='/inscription' className='text-primary hover:underline'>{t('login.creerCompte')}</Link>
					</p>
				</div>
			</div>
		</div>
	)
}

export default Login
