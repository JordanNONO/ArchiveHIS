import React, { useEffect, useRef, useState } from 'react'
import { LuSparkles, LuPlayCircle, LuDownload, LuCompass, LuLoader, LuUpload, LuSend } from 'react-icons/lu'
import { toast } from 'react-toastify'
import Breadcrumbs from '../components/Breadcrumbs'
import OnboardingTour from '../components/OnboardingTour'
import { getFormation, updateFormation } from '../api/routes/formation'
import { envoyerMessageAssistant } from '../api/routes/assistant'
import { usePermissions } from '../hooks/usePermissions'

/**
 * Suggestions de départ — mêmes thèmes que les fiches d'aide côté serveur
 * (voir AssistantIAService::fichesAide()), pour donner tout de suite une
 * idée concrète de ce qu'on peut demander plutôt qu'un champ vide intimidant.
 */
const SUGGESTIONS = [
  'Comment créer un sous-dossier ?',
  'Qui peut voir mes documents ?',
  'Comment ajouter un nouveau salarié ?',
  'À quoi servent les rôles et permissions ?',
]

/**
 * Centre d'aide — refonte complète (demande explicite, plusieurs itérations
 * de maquette) : remplace l'ancienne page "une vidéo à regarder en entier"
 * par un point d'entrée conversationnel. On pose sa question en langage
 * naturel, l'assistant IA déjà présent dans l'appli (voir AssistantChat.jsx,
 * même endpoint) répond en s'appuyant sur de vraies fiches d'aide — jamais
 * de mémoire. La vidéo/le PDF (contenu existant, modifiable par un
 * administrateur) restent disponibles en ressource secondaire, pas supprimés.
 */
function Formation() {
  const [formation, setFormation] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [editionOuverte, setEditionOuverte] = useState(false)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const { isAdministrator } = usePermissions()

  const [question, setQuestion] = useState('')
  const [reponse, setReponse] = useState(null) // { question, texte }
  const [recherche, setRecherche] = useState(false)
  const [videoOuverte, setVideoOuverte] = useState(false)
  const [tourOuvert, setTourOuvert] = useState(false)
  const zoneReponseRef = useRef(null)

  function charger() {
    getFormation().then(async (res) => {
      if (res.status === 200) {
        const data = await res.json()
        setFormation(data)
        setTitre(data.titre || '')
        setDescription(data.description || '')
      }
    }).finally(() => setChargement(false))
  }

  useEffect(() => { charger() }, [])

  useEffect(() => {
    if (reponse) zoneReponseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [reponse])

  async function poserQuestion(texte) {
    const q = (texte ?? question).trim()
    if (!q || recherche) return
    setRecherche(true)
    setQuestion(q)
    try {
      const res = await envoyerMessageAssistant(q)
      const data = await res.json().catch(() => null)
      if (res.status === 200 && data) {
        setReponse({ question: q, texte: data.reponse || "Je n'ai pas trouvé de réponse à cette question." })
      } else {
        setReponse({ question: q, texte: "L'assistant n'est pas disponible pour le moment. Réessayez dans quelques instants." })
      }
    } catch (error) {
      console.log(error)
      setReponse({ question: q, texte: "Une erreur est survenue. Réessayez dans quelques instants." })
    } finally {
      setRecherche(false)
    }
  }

  function onSubmitEdition(e) {
    e.preventDefault()
    setEnvoiEnCours(true)
    updateFormation({ titre, description }, { video: videoFile, pdf: pdfFile }).then(async (res) => {
      setEnvoiEnCours(false)
      if (res.status === 200) {
        const data = await res.json()
        setFormation(data)
        setVideoFile(null)
        setPdfFile(null)
        toast.success('Contenu de formation mis à jour')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || 'Une erreur est survenue')
      }
    }).catch(() => {
      setEnvoiEnCours(false)
      toast.error("Une erreur est survenue pendant l'envoi")
    })
  }

  if (chargement) {
    return (
      <div className='w-full py-24 flex justify-center'>
        <LuLoader className='animate-spin text-muted-foreground' size={24} />
      </div>
    )
  }

  return (
    <div className='w-full py-6'>
      <Breadcrumbs where="Aide" />
      {tourOuvert && <OnboardingTour profil='personnel' onTermine={() => setTourOuvert(false)} />}

      {/* Halo doux dérivé des tokens primary/accent — jamais une couleur
          plaquée à part, pour que la page reste dans la charte même en
          sortant du gabarit "carte blanche" habituel. */}
      <div
        className='relative -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-10 pb-12 flex flex-col items-center text-center rounded-b-3xl'
        style={{
          backgroundImage: 'radial-gradient(640px 360px at 50% -10%, hsl(var(--primary) / 0.09), transparent 65%), radial-gradient(480px 300px at 85% 10%, hsl(var(--accent) / 0.14), transparent 60%)',
        }}
      >
        <span className='flex items-center justify-center w-14 h-14 rounded-full text-accent mb-5 shadow-lg shadow-primary/20' style={{ backgroundImage: 'linear-gradient(145deg, hsl(var(--primary)), hsl(var(--secondary)))' }}>
          <LuSparkles size={24} />
        </span>
        <h1 className='text-2xl sm:text-3xl font-semibold text-foreground max-w-xl leading-tight'>Comment pouvons-nous vous aider ?</h1>
        <p className='text-sm text-muted-foreground mt-2.5 max-w-md'>Posez votre question comme à un collègue — l'assistant cherche la réponse dans les guides de l'application.</p>

        <div className='w-full max-w-xl mt-7'>
          <div className='flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-lg shadow-black/5'>
            <input
              type='text'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') poserQuestion() }}
              placeholder='Ex : comment créer un sous-dossier ?'
              className='flex-1 bg-transparent text-sm focus:outline-none'
            />
            <button
              type='button'
              onClick={() => poserQuestion()}
              disabled={recherche || !question.trim()}
              className='flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-white disabled:opacity-40 transition-opacity shrink-0'
            >
              {recherche ? <LuLoader size={15} className='animate-spin' /> : <LuSend size={15} />}
            </button>
          </div>

          <div className='flex flex-wrap gap-2 justify-center mt-4'>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type='button'
                onClick={() => poserQuestion(s)}
                disabled={recherche}
                className='text-xs font-medium text-primary bg-primary/[0.06] border border-primary/15 rounded-full px-3.5 py-2 hover:bg-primary/[0.12] transition-colors disabled:opacity-50'
              >
                {s}
              </button>
            ))}
          </div>

          {reponse && (
            <div ref={zoneReponseRef} className='text-left mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm animate-wizard-rise-in'>
              <p className='text-xs font-semibold text-muted-foreground mb-2'>{reponse.question}</p>
              <p className='text-sm leading-relaxed whitespace-pre-wrap'>{reponse.texte}</p>
            </div>
          )}
        </div>

        <div className='flex items-center gap-3 w-full max-w-sm mt-9 text-[11px] uppercase tracking-wider text-muted-foreground'>
          <span className='flex-1 h-px bg-border' /> ou <span className='flex-1 h-px bg-border' />
        </div>
        <div className='flex flex-wrap gap-5 justify-center mt-4 text-sm font-medium text-muted-foreground'>
          {formation?.video_disponible && (
            <button type='button' onClick={() => setVideoOuverte((v) => !v)} className='inline-flex items-center gap-1.5 hover:text-foreground transition-colors'>
              <LuPlayCircle size={15} /> Revoir la vidéo complète
            </button>
          )}
          {formation?.pdf_disponible && (
            <a href={formation.pdf_url} download className='inline-flex items-center gap-1.5 hover:text-foreground transition-colors'>
              <LuDownload size={15} /> Télécharger le support PDF
            </a>
          )}
          <button type='button' onClick={() => setTourOuvert(true)} className='inline-flex items-center gap-1.5 hover:text-foreground transition-colors'>
            <LuCompass size={15} /> Visite guidée de l'application
          </button>
        </div>
      </div>

      {videoOuverte && formation?.video_disponible && (
        <div className='mt-6 rounded-2xl border border-border bg-card overflow-hidden'>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls preload="metadata" className='w-full bg-black aspect-video' src={formation.video_url}>
            Votre navigateur ne prend pas en charge la lecture vidéo.
          </video>
        </div>
      )}

      {isAdministrator && (
        <div className='rounded-2xl border border-border bg-card p-6 mt-6'>
          <button
            onClick={() => setEditionOuverte((v) => !v)}
            className='flex items-center gap-2 text-sm font-medium text-foreground'
          >
            <LuUpload size={16} className='text-primary' />
            Gérer la vidéo et le PDF de formation
          </button>

          {editionOuverte && (
            <form onSubmit={onSubmitEdition} className='flex flex-col gap-4 mt-5'>
              <div>
                <label className='block text-sm font-medium mb-1.5 text-foreground'>Titre</label>
                <input
                  type='text'
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow'
                />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1.5 text-foreground'>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow'
                />
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium mb-1.5 text-foreground'>Vidéo (mp4, webm...)</label>
                  <input
                    type='file'
                    accept='video/mp4,video/webm,video/quicktime,video/x-matroska'
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                    className='w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:px-3 file:py-2 file:text-sm file:font-medium'
                  />
                  {formation?.video_disponible && <p className='text-xs text-muted-foreground mt-1'>Remplace la vidéo actuelle ({formation.video_nom_original}).</p>}
                </div>
                <div>
                  <label className='block text-sm font-medium mb-1.5 text-foreground'>Support PDF</label>
                  <input
                    type='file'
                    accept='application/pdf'
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className='w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:px-3 file:py-2 file:text-sm file:font-medium'
                  />
                  {formation?.pdf_disponible && <p className='text-xs text-muted-foreground mt-1'>Remplace le PDF actuel ({formation.pdf_nom_original}).</p>}
                </div>
              </div>
              <div className='flex items-center gap-3'>
                <button
                  type='submit'
                  disabled={envoiEnCours}
                  className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors'
                >
                  {envoiEnCours && <LuLoader size={14} className='animate-spin' />}
                  {envoiEnCours ? 'Envoi en cours...' : 'Enregistrer'}
                </button>
                {envoiEnCours && <span className='text-xs text-muted-foreground'>La vidéo peut prendre quelques minutes à envoyer.</span>}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

export default Formation
