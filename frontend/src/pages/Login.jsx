import React, { useState } from 'react'
import { FiLock } from "react-icons/fi"
import { IoMailOutline } from "react-icons/io5"
import { LuLoader2, LuEye, LuEyeOff } from "react-icons/lu"
import { toast } from 'react-toastify'
import { loginAPI } from '../api/routes/auth'
import hisLogo from '../assets/his-badge.png'

function Login() {
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
					toast.success("Bienvenue")
					window.location.href = "/"
					return;
				} else {
					toast.error("Information de connexion incorrect")
					return;
				}
			}).catch((err) => {
				setLoading(false)
				console.log(err)
				toast.error("Une erreur est survenue")
			})
		} else {
			toast.warning("Veuillez remplir tous les champs...")
		}
	}

	return (
		<div className='min-h-screen w-full flex flex-col lg:flex-row bg-background'>
			<div className='hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center bg-gradient-to-b from-[#1B365D] to-[#0A0F16] p-12 overflow-hidden'>
				<div className='absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/30 blur-3xl' />
				<div className='absolute bottom-0 right-0 w-96 h-96 rounded-full bg-accent/10 blur-3xl' />
				<div className='relative flex flex-col items-center text-center gap-5 max-w-sm'>
					<div className='relative'>
						<div className='absolute inset-0 rounded-full bg-accent/25 blur-xl scale-125' />
						<div className='relative w-28 h-28 rounded-full bg-white shadow-lg ring-4 ring-white/5 overflow-hidden'>
							<img src={hisLogo} alt="Hetep Iaout Services" className='w-full h-full object-cover' />
						</div>
					</div>
					<div>
						<h1 className='text-white text-xl font-semibold tracking-wide'>Hetep Iaout Services</h1>
						<p className='text-white/40 text-sm mt-2 leading-relaxed'>
							Aide à domicile, garde d'enfants, accompagnement du handicap et transport PMR en Île-de-France.
						</p>
					</div>
					<div className='h-px w-16 bg-white/10' />
					<p className='text-white/30 text-xs italic'>« L'utilité sur le chemin de la sérénité »</p>
				</div>
			</div>

			<div className='flex flex-1 items-center justify-center px-5 py-10 sm:px-8'>
				<div className='w-full max-w-sm'>
					<div className='lg:hidden flex flex-col items-center gap-3 mb-8'>
						<div className='w-16 h-16 rounded-full bg-primary/10 ring-1 ring-primary/15 overflow-hidden'>
							<img src={hisLogo} alt="Hetep Iaout Services" className='w-full h-full object-cover' />
						</div>
						<div className='text-center'>
							<h1 className='text-foreground text-sm font-semibold'>Hetep Iaout Services</h1>
							<p className='text-muted-foreground text-xs mt-0.5'>Archivage documentaire</p>
						</div>
					</div>

					<h2 className='text-2xl font-semibold text-foreground'>Bon retour</h2>
					<p className='text-sm text-muted-foreground mt-1.5 mb-8'>Connectez-vous à HIS Archivage pour continuer.</p>

					<form onSubmit={handSubmit} className='flex flex-col gap-5'>
						<div>
							<label htmlFor='email' className='block text-sm font-medium mb-1.5 text-foreground'>Email</label>
							<div className='relative'>
								<IoMailOutline className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={17} />
								<input
									type='text'
									placeholder='vous@hisvie.com'
									onChange={onChangeData}
									id='email'
									className='w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow'
								/>
							</div>
						</div>

						<div>
							<div className='flex items-center justify-between mb-1.5'>
								<label htmlFor='password' className='block text-sm font-medium text-foreground'>Mot de passe</label>
								<a href='#' className='text-xs text-primary hover:underline'>Mot de passe oublié</a>
							</div>
							<div className='relative'>
								<FiLock className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
								<input
									type={showPassword ? 'text' : 'password'}
									onChange={onChangeData}
									id='password'
									placeholder='••••••••'
									className='w-full rounded-lg border border-border bg-background pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow'
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
							className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-60 mt-2'
						>
							{loading && <LuLoader2 size={16} className='animate-spin' />}
							{loading ? 'Connexion...' : 'Se connecter'}
						</button>
					</form>

					<p className='text-center text-xs text-muted-foreground mt-8'>
						Plateforme d'archivage interne réservée au personnel Hetep Iaout Services.
					</p>
				</div>
			</div>
		</div>
	)
}

export default Login
