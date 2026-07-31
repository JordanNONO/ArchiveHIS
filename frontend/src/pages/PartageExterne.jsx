import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { LuLock, LuMail, LuDownload, LuShieldCheck, LuLoader2 } from 'react-icons/lu'
import { getInfosPartage, demanderCode, verifierCode, getDocumentPartage, lienTelechargementPartage } from '../api/routes/partageExterne'
import hisLogo from '../assets/his-badge.png'

function getFileIcon(extension) {
  return String(extension || '').toUpperCase() || 'FICHIER'
}

function PartageExterne() {
  const { token } = useParams()
  const sessionKey = `partage_session_${token}`

  const [loading, setLoading] = useState(true)
  const [invalide, setInvalide] = useState(false)
  const [emailMasque, setEmailMasque] = useState('')
  const [expediteur, setExpediteur] = useState('')
  const [codeEnvoye, setCodeEnvoye] = useState(false)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [code, setCode] = useState('')
  const [verificationEnCours, setVerificationEnCours] = useState(false)
  const [session, setSession] = useState(() => sessionStorage.getItem(sessionKey) || null)
  const [document, setDocument] = useState(null)

  useEffect(() => {
    getInfosPartage(token).then(async (res) => {
      if (res.status === 200) {
        const data = await res.json()
        setEmailMasque(data.email_masque)
        setExpediteur(data.expediteur)
        if (data.session_active && session) {
          chargerDocument(session)
        }
      } else {
        setInvalide(true)
      }
      setLoading(false)
    }).catch(() => {
      setInvalide(true)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function chargerDocument(sessionToken) {
    const res = await getDocumentPartage(token, sessionToken)
    if (res.status === 200) {
      setDocument(await res.json())
    } else {
      sessionStorage.removeItem(sessionKey)
      setSession(null)
    }
  }

  async function onDemanderCode() {
    try {
      setEnvoiEnCours(true)
      const res = await demanderCode(token)
      const data = await res.json()
      if (res.status === 200) {
        toast.success(data.message)
        setCodeEnvoye(true)
      } else {
        toast.error(data?.error || "Impossible d'envoyer le code")
      }
    } catch (error) {
      toast.error('Une erreur est survenue')
    } finally {
      setEnvoiEnCours(false)
    }
  }

  async function onVerifierCode(e) {
    e.preventDefault()
    try {
      setVerificationEnCours(true)
      const res = await verifierCode(token, code)
      const data = await res.json()
      if (res.status === 200) {
        sessionStorage.setItem(sessionKey, data.session_token)
        setSession(data.session_token)
        await chargerDocument(data.session_token)
      } else {
        toast.error(data?.error || 'Code incorrect')
      }
    } catch (error) {
      toast.error('Une erreur est survenue')
    } finally {
      setVerificationEnCours(false)
    }
  }

  if (loading) {
    return (
      <div className='min-h-screen w-full flex items-center justify-center bg-background'>
        <LuLoader2 className='animate-spin text-primary' size={28} />
      </div>
    )
  }

  return (
    <div className='min-h-screen w-full flex items-center justify-center bg-background px-4 py-10'>
      <div className='w-full max-w-md'>
        <div className='flex flex-col items-center text-center gap-3 mb-6'>
          <div className='w-16 h-16 rounded-full bg-white shadow-lg ring-4 ring-primary/5 overflow-hidden'>
            <img src={hisLogo} alt="Hetep Iaout Services" className='w-full h-full object-cover' />
          </div>
          <h1 className='text-lg font-semibold text-foreground'>Espace de consultation sécurisé</h1>
          <p className='text-xs text-muted-foreground'>Hetep Iaout Services</p>
        </div>

        <div className='rounded-2xl border border-border bg-card p-6'>
          {invalide ? (
            <div className='text-center py-4'>
              <LuLock className='mx-auto mb-3 text-muted-foreground' size={28} />
              <p className='text-sm font-medium text-foreground'>Ce lien est invalide ou a expiré</p>
              <p className='text-xs text-muted-foreground mt-1.5'>Demandez à l'expéditeur de vous renvoyer un partage.</p>
            </div>
          ) : document ? (
            <div className='flex flex-col gap-4'>
              <div className='flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2'>
                <LuShieldCheck size={14} />
                Identité confirmée
              </div>
              <div className='flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4'>
                <div className='w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold'>
                  {getFileIcon(document.extension)}
                </div>
                <div className='min-w-0'>
                  <div className='font-medium text-sm truncate'>{document.titre_document}</div>
                  <div className='text-xs text-muted-foreground truncate'>Référence : {document.code_reference}</div>
                </div>
              </div>
              <a
                href={lienTelechargementPartage(token, session)}
                className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors'
              >
                <LuDownload size={15} />
                Télécharger le document
              </a>
            </div>
          ) : codeEnvoye ? (
            <form onSubmit={onVerifierCode} className='flex flex-col gap-4'>
              <p className='text-sm text-muted-foreground'>
                Entrez le code à 6 chiffres envoyé à <strong className='text-foreground'>{emailMasque}</strong>.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className='w-full text-center text-2xl tracking-[0.5em] rounded-lg border border-border bg-background px-3 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30'
              />
              <button
                type="submit"
                disabled={verificationEnCours || code.length !== 6}
                className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'
              >
                {verificationEnCours ? <LuLoader2 className='animate-spin' size={15} /> : <LuLock size={15} />}
                Vérifier
              </button>
              <button type="button" onClick={onDemanderCode} disabled={envoiEnCours} className='text-xs text-muted-foreground hover:text-foreground transition-colors'>
                Renvoyer le code
              </button>
            </form>
          ) : (
            <div className='flex flex-col gap-4 text-center'>
              <LuMail className='mx-auto text-primary' size={28} />
              <div>
                <p className='text-sm font-medium text-foreground'>
                  {expediteur ? `${expediteur} vous a transmis un document` : 'Un document vous a été transmis'}
                </p>
                <p className='text-xs text-muted-foreground mt-1.5'>
                  Pour votre sécurité, un code d'accès sera envoyé à <strong className='text-foreground'>{emailMasque}</strong>.
                </p>
              </div>
              <button
                onClick={onDemanderCode}
                disabled={envoiEnCours}
                className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'
              >
                {envoiEnCours ? <LuLoader2 className='animate-spin' size={15} /> : <LuMail size={15} />}
                Recevoir le code d'accès
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PartageExterne
