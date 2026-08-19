import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiLock } from 'react-icons/fi'
import { IoMailOutline } from 'react-icons/io5'
import { LuLoader2, LuUser, LuPhone, LuMessageSquare, LuMail, LuEye, LuEyeOff } from 'react-icons/lu'
import { toast } from 'react-toastify'
import { Trans, useTranslation } from 'react-i18next'
import { envoyerCodeInscription, verifierInscription } from '../api/routes/auth'
import hisLogo from '../assets/his-badge.png'
import LanguageSwitcher from '../components/LanguageSwitcher'

// text-base (16px) sur mobile : en dessous, les navigateurs mobiles zooment
// automatiquement la page au focus d'un champ — text-sm (14px) le déclenchait
// à chaque champ. text-base seulement en dessous de sm: pour garder le même
// rendu qu'avant sur desktop. Cadre wizard (bordure 1.5px, halo bleu au
// focus) plutôt que le style resserré d'origine — cohérent avec Login.jsx.
const inputClass = 'w-full rounded-2xl border-[1.5px] border-border bg-background pl-10 pr-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow'

const CANAUX = [
	{ id: 'email', labelKey: 'inscription.canalEmail', icon: LuMail, disponible: true },
	{ id: 'sms', labelKey: 'inscription.canalSms', icon: LuMessageSquare, disponible: false },
]

function Inscription() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const [form, setForm] = useState({ nom: '', prenom: '', telephone: '', email: '', password: '', type: 'Intervenant', canal: 'email' })
	const [etape, setEtape] = useState('formulaire') // formulaire | code
	const [code, setCode] = useState('')
	const [loading, setLoading] = useState(false)
	const [showPassword, setShowPassword] = useState(false)

	function onChange(e) {
		const { id, value } = e.target
		setForm((f) => ({ ...f, [id]: value }))
	}

	async function onEnvoyerCode(e) {
		e.preventDefault()
		if (Object.entries(form).some(([k, v]) => k !== 'canal' && v === '')) {
			toast.warning(t('commun.champsObligatoires'))
			return
		}
		try {
			setLoading(true)
			const res = await envoyerCodeInscription(form)
			const data = await res.json()
			if (res.status === 200) {
				toast.success(data.message)
				setEtape('code')
			} else {
				toast.error(data?.error || Object.values(data?.errors || {})[0]?.[0] || t('inscription.envoiCodeEchoue'))
			}
		} catch (error) {
			console.log(error)
			toast.error(t('commun.erreurGenerique'))
		} finally {
			setLoading(false)
		}
	}

	async function onVerifier(e) {
		e.preventDefault()
		try {
			setLoading(true)
			const res = await verifierInscription(form.email, code)
			const data = await res.json()
			if (res.status === 201) {
				sessionStorage.setItem('token', data.token)
				toast.success(t('inscription.compteCree'))
				navigate('/')
				window.location.reload()
			} else {
				toast.error(data?.error || t('inscription.codeIncorrect'))
			}
		} catch (error) {
			console.log(error)
			toast.error(t('commun.erreurGenerique'))
		} finally {
			setLoading(false)
		}
	}

	// "Carte suspendue" — traitement réservé à cet écran (et à Login.jsx dans
	// sa version "vivante") : contrairement à Login, partagé par tous les
	// profils (RH, admin, intervenant, bénéficiaire), l'inscription ne sert
	// QUE les comptes externes — elle peut se permettre une identité un peu
	// plus marquée sans détonner ailleurs dans l'appli.
	return (
		<div className='min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-[#274873] via-[#1B365D] to-[#0A0F16] flex items-center justify-center px-4 py-10'>
			<div className='absolute top-4 right-4 z-10'>
				<LanguageSwitcher variant='dark' />
			</div>
			<div className='absolute -top-20 -right-16 w-80 h-80 rounded-full bg-accent/20 blur-3xl animate-wizard-drift-a' />
			<div className='absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-primary/40 blur-3xl animate-wizard-drift-b' />

			<div className='relative w-full max-w-md rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl p-6 sm:p-8'>
				<div className='flex flex-col items-center gap-2 mb-6'>
					<div className='w-16 h-16 rounded-full shadow-md ring-4 ring-primary/5 overflow-hidden'>
						<img src={hisLogo} alt="Hetep Iaout Services" className='w-full h-full object-cover' />
					</div>
					<span className='text-[11px] font-bold text-primary tracking-wide'>HETEP IAOUT SERVICES</span>
				</div>

				{etape === 'formulaire' ? (
						<>
							<h2 className='text-2xl font-semibold text-foreground'>{t('inscription.titre')}</h2>
							<p className='text-sm text-muted-foreground mt-1.5 mb-6'>{t('inscription.sousTitre')}</p>

							<form onSubmit={onEnvoyerCode} className='flex flex-col gap-4'>
								<div>
									<label className='block text-sm font-medium mb-1.5 text-foreground'>{t('inscription.jeSuis')}</label>
									<select
										value={form.type}
										onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
										className='select select-bordered select-sm w-full rounded-2xl text-base sm:text-sm'
									>
										<option value='Intervenant'>{t('inscription.intervenant')}</option>
										<option value='Beneficiaire'>{t('inscription.beneficiaire')}</option>
									</select>
								</div>

								<div className='grid grid-cols-2 gap-3'>
									<div>
										<label htmlFor='prenom' className='block text-sm font-medium mb-1.5 text-foreground'>{t('inscription.prenom')} <span className='text-red-500'>*</span></label>
										<div className='relative'>
											<LuUser className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
											<input id='prenom' value={form.prenom} onChange={onChange} className={inputClass} placeholder={t('inscription.prenom')} />
										</div>
									</div>
									<div>
										<label htmlFor='nom' className='block text-sm font-medium mb-1.5 text-foreground'>{t('inscription.nom')} <span className='text-red-500'>*</span></label>
										<input id='nom' value={form.nom} onChange={onChange} className='w-full rounded-2xl border-[1.5px] border-border bg-background px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow' placeholder={t('inscription.nom')} />
									</div>
								</div>

								<div>
									<label htmlFor='telephone' className='block text-sm font-medium mb-1.5 text-foreground'>{t('inscription.telephone')} <span className='text-red-500'>*</span></label>
									<div className='relative'>
										<LuPhone className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
										<input id='telephone' value={form.telephone} onChange={onChange} className={inputClass} placeholder='06 12 34 56 78' />
									</div>
								</div>

								<div>
									<label htmlFor='email' className='block text-sm font-medium mb-1.5 text-foreground'>{t('inscription.email')} <span className='text-red-500'>*</span></label>
									<div className='relative'>
										<IoMailOutline className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={17} />
										<input id='email' type='text' value={form.email} onChange={onChange} className={inputClass} placeholder='vous@exemple.com' />
									</div>
								</div>

								<div>
									<label htmlFor='password' className='block text-sm font-medium mb-1.5 text-foreground'>{t('inscription.motDePasse')} <span className='text-red-500'>*</span></label>
									<div className='relative'>
										<FiLock className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
										<input
											id='password'
											type={showPassword ? 'text' : 'password'}
											value={form.password}
											onChange={onChange}
											placeholder={t('inscription.motDePasseIndication')}
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

								<div>
									<label className='block text-sm font-medium mb-1.5 text-foreground'>{t('inscription.recevoirCodePar')}</label>
									<div className='grid grid-cols-2 gap-2'>
										{CANAUX.map(({ id, labelKey, icon: Icon, disponible }) => (
											<button
												type='button'
												key={id}
												disabled={!disponible}
												onClick={() => setForm((f) => ({ ...f, canal: id }))}
												className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
													form.canal === id ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
												} ${!disponible ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'}`}
											>
												<Icon size={14} />
												{t(labelKey)}
												{!disponible && <span className='text-[10px]'>{t('inscription.bientot')}</span>}
											</button>
										))}
									</div>
								</div>

								<button
									type='submit'
									disabled={loading}
									className='inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-60 disabled:shadow-none mt-2'
								>
									{loading && <LuLoader2 size={16} className='animate-spin' />}
									{loading ? t('inscription.envoiEnCours') : t('inscription.recevoirMonCode')}
								</button>
							</form>

							<p className='text-center text-xs text-muted-foreground mt-6'>
								{t('inscription.dejaUnCompte')} <Link to='/login' className='text-primary hover:underline'>{t('inscription.seConnecter')}</Link>
							</p>
						</>
					) : (
						<>
							<h2 className='text-2xl font-semibold text-foreground'>{t('inscription.verification')}</h2>
							<p className='text-sm text-muted-foreground mt-1.5 mb-6'>
								<Trans i18nKey='inscription.codeEnvoyeA' values={{ email: form.email }} components={{ strong: <strong className='text-foreground' /> }} />
							</p>

							<form onSubmit={onVerifier} className='flex flex-col gap-4'>
								<input
									type='text'
									inputMode='numeric'
									autoComplete='one-time-code'
									maxLength={6}
									autoFocus
									value={code}
									onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
									placeholder='••••••'
									className='w-full text-center text-2xl tracking-[0.5em] rounded-2xl border-[1.5px] border-border bg-background px-3 py-3 focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow'
								/>
								<button
									type='submit'
									disabled={loading || code.length !== 6}
									className='inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-60 disabled:shadow-none'
								>
									{loading && <LuLoader2 size={16} className='animate-spin' />}
									{loading ? t('inscription.verificationEnCours') : t('inscription.creerMonCompte')}
								</button>
								<button type='button' onClick={() => setEtape('formulaire')} className='text-xs text-muted-foreground hover:text-foreground transition-colors'>
									{t('inscription.revenirFormulaire')}
								</button>
							</form>
						</>
					)}
			</div>
		</div>
	)
}

export default Inscription
