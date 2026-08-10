import React, { useState } from 'react'
import { FiLock } from 'react-icons/fi'
import { IoMailOutline } from 'react-icons/io5'
import { LuLoader2, LuEye, LuEyeOff, LuKeyRound, LuArrowLeft } from 'react-icons/lu'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { envoyerCodeMotDePasseOublie, reinitialiserMotDePasse } from '../api/routes/auth'
import hisLogo from '../assets/his-badge.png'

/**
 * Réinitialisation de mot de passe par code à usage unique — même flux en
 * deux temps que l'inscription (envoi du code, puis vérification), universel
 * à tout type de compte (personnel interne, intervenant, bénéficiaire).
 */
function MotDePasseOublie() {
  const navigate = useNavigate()
  const [etape, setEtape] = useState('email') // email | reinitialisation
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onEnvoyerCode(e) {
    e.preventDefault()
    if (!email.trim()) {
      toast.warning("Renseignez votre adresse email")
      return
    }
    try {
      setLoading(true)
      const res = await envoyerCodeMotDePasseOublie(email.trim())
      const data = await res.json()
      if (res.status === 200) {
        toast.success(data?.message || 'Code envoyé si un compte existe pour cette adresse')
        setEtape('reinitialisation')
      } else {
        toast.error(data?.error || "L'envoi du code a échoué")
      }
    } catch (error) {
      console.log(error)
      toast.error('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  async function onReinitialiser(e) {
    e.preventDefault()
    if (!code.trim() || !password) {
      toast.warning('Renseignez le code reçu et votre nouveau mot de passe')
      return
    }
    if (password.length < 8) {
      toast.warning('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    try {
      setLoading(true)
      const res = await reinitialiserMotDePasse(email.trim(), code.trim(), password)
      const data = await res.json()
      if (res.status === 200) {
        toast.success(data?.message || 'Mot de passe réinitialisé avec succès')
        navigate('/login')
      } else {
        toast.error(data?.error || 'La réinitialisation a échoué')
      }
    } catch (error) {
      console.log(error)
      toast.error('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  // Même traitement "vivant" que Login.jsx (panneau navy animé + champs façon
  // wizard) — cette page est sa suite directe dans le même flux d'accès, elle
  // ne doit pas détonner en restant à l'ancien style statique.
  return (
    <div className='min-h-screen w-full flex flex-col lg:flex-row bg-background'>
      <div className='hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center bg-gradient-to-b from-[#1B365D] to-[#0A0F16] p-12 overflow-hidden'>
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
            <h1 className='text-white text-xl font-semibold tracking-wide'>Hetep Iaout Services</h1>
            <p className='text-white/40 text-sm mt-2 leading-relaxed'>
              Un code à usage unique vous sera envoyé par email pour réinitialiser votre mot de passe en toute sécurité.
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

        {etape === 'email' ? (
          <>
            <h2 className='text-2xl font-semibold text-foreground'>Mot de passe oublié</h2>
            <p className='text-sm text-muted-foreground mt-1.5 mb-8'>
              Indiquez votre adresse email, un code de réinitialisation vous sera envoyé.
            </p>

            <form onSubmit={onEnvoyerCode} className='flex flex-col gap-5'>
              <div>
                <label htmlFor='email' className='block text-sm font-medium mb-1.5 text-foreground'>Email</label>
                <div className='relative'>
                  <IoMailOutline className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={17} />
                  <input
                    type='email'
                    placeholder='vous@hisvie.com'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    id='email'
                    className='w-full rounded-2xl border-[1.5px] border-border bg-background pl-10 pr-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow'
                  />
                </div>
              </div>

              <button
                type='submit'
                disabled={loading}
                className='inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-60 disabled:shadow-none mt-2'
              >
                {loading && <LuLoader2 size={16} className='animate-spin' />}
                {loading ? 'Envoi...' : 'Recevoir mon code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className='text-2xl font-semibold text-foreground'>Nouveau mot de passe</h2>
            <p className='text-sm text-muted-foreground mt-1.5 mb-8'>
              Entrez le code reçu par email et choisissez un nouveau mot de passe.
            </p>

            <form onSubmit={onReinitialiser} className='flex flex-col gap-5'>
              <div>
                <label htmlFor='code' className='block text-sm font-medium mb-1.5 text-foreground'>Code reçu</label>
                <div className='relative'>
                  <LuKeyRound className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
                  <input
                    type='text'
                    inputMode='numeric'
                    autoComplete='one-time-code'
                    placeholder='123456'
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    id='code'
                    className='w-full rounded-2xl border-[1.5px] border-border bg-background pl-10 pr-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow'
                  />
                </div>
              </div>

              <div>
                <label htmlFor='password' className='block text-sm font-medium mb-1.5 text-foreground'>Nouveau mot de passe</label>
                <div className='relative'>
                  <FiLock className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                {loading ? 'Réinitialisation...' : 'Réinitialiser mon mot de passe'}
              </button>

              <button
                type='button'
                onClick={() => setEtape('email')}
                className='text-xs text-muted-foreground hover:text-foreground transition-colors self-center'
              >
                Redemander un code
              </button>
            </form>
          </>
        )}

        <p className='text-center text-xs text-muted-foreground mt-8'>
          <Link to='/login' className='text-primary hover:underline inline-flex items-center gap-1'>
            <LuArrowLeft size={12} /> Retour à la connexion
          </Link>
        </p>
      </div>
      </div>
    </div>
  )
}

export default MotDePasseOublie
