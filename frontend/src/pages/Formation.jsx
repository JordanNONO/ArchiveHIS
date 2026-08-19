import React, { useEffect, useState } from 'react'
import { LuPlayCircle, LuFileText, LuDownload, LuLoader, LuUpload, LuGraduationCap, LuListChecks, LuClock, LuUsers, LuBookOpen, LuMessageCircle } from 'react-icons/lu'
import { toast } from 'react-toastify'
import Breadcrumbs from '../components/Breadcrumbs'
import { getFormation, updateFormation } from '../api/routes/formation'
import { usePermissions } from '../hooks/usePermissions'

/**
 * Plan de la formation affiché en sommaire (façon page de cours) — reflète les
 * chapitres du script de formation rédigé pour la vidéo/le support PDF. Purement
 * indicatif : la vidéo n'a pas de chapitrage exploitable automatiquement.
 */
const SOMMAIRE = [
  'Connexion à l\'application',
  'Le tableau de bord',
  'Notifications',
  'Naviguer dans les dossiers',
  'Créer un sous-dossier',
  'Rechercher un document',
  'Gestion du personnel',
  'Rôles & permissions',
  'Catégories, bureaux, services métier',
  'Corbeille et activité',
  'Mon profil',
]

const OBJECTIFS = [
  { emoji: '🗂️', texte: 'Organiser et retrouver les dossiers et documents de l\'entreprise' },
  { emoji: '👥', texte: 'Créer et gérer les comptes du personnel, leurs rôles et leurs accès' },
  { emoji: '🔔', texte: 'Comprendre qui voit un document, et qui peut le traiter' },
  { emoji: '⚙️', texte: 'Utiliser les écrans d\'administration : catégories, bureaux, services métier' },
]

function formatDuree(secondes) {
  if (!secondes || !Number.isFinite(secondes)) return null
  const minutes = Math.round(secondes / 60)
  if (minutes < 1) return '< 1 min'
  return `${minutes} min`
}

function Formation() {
  const [formation, setFormation] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [editionOuverte, setEditionOuverte] = useState(false)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [dureeVideo, setDureeVideo] = useState(null)
  const { isAdministrator } = usePermissions()

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
      <Breadcrumbs where="Formation" />

      <div className='flex items-center gap-3 mt-1 mb-1'>
        <span className='flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0'>
          <LuGraduationCap size={20} />
        </span>
        <h2 className='text-2xl font-semibold text-foreground'>{formation?.titre || 'Formation du personnel'}</h2>
      </div>
      {formation?.description && (
        <p className='text-sm text-muted-foreground mb-6 max-w-2xl'>{formation.description}</p>
      )}
      {!formation?.description && <div className='mb-4' />}

      <div className='flex flex-wrap gap-3 mb-6'>
        <div className='flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5'>
          <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0'>
            <LuClock size={15} />
          </span>
          <div>
            <p className='text-sm font-semibold text-foreground leading-tight'>{formatDuree(dureeVideo) || '—'}</p>
            <p className='text-xs text-muted-foreground leading-tight'>⏱️ Durée</p>
          </div>
        </div>
        <div className='flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5'>
          <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0'>
            <LuBookOpen size={15} />
          </span>
          <div>
            <p className='text-sm font-semibold text-foreground leading-tight'>{SOMMAIRE.length} chapitres</p>
            <p className='text-xs text-muted-foreground leading-tight'>📖 Programme</p>
          </div>
        </div>
        <div className='flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5'>
          <span className='flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0'>
            <LuUsers size={15} />
          </span>
          <div>
            <p className='text-sm font-semibold text-foreground leading-tight'>Personnel interne</p>
            <p className='text-xs text-muted-foreground leading-tight'>👥 Public concerné</p>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='lg:col-span-2 flex flex-col gap-6'>
          <div className='rounded-2xl border border-border bg-card overflow-hidden'>
            {formation?.video_disponible ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                controls
                preload="metadata"
                className='w-full bg-black aspect-video'
                src={formation.video_url}
                onLoadedMetadata={(e) => setDureeVideo(e.currentTarget.duration)}
              >
                Votre navigateur ne prend pas en charge la lecture vidéo.
              </video>
            ) : (
              <div className='aspect-video w-full flex flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground'>
                <LuPlayCircle size={32} />
                <p className='text-sm'>Aucune vidéo de formation pour le moment.</p>
              </div>
            )}
          </div>

          <div className='rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-4'>
            <div className='flex items-center gap-3 min-w-0'>
              <span className='flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0'>
                <LuFileText size={18} />
              </span>
              <div className='min-w-0'>
                <p className='text-sm font-medium text-foreground truncate'>
                  {formation?.pdf_disponible ? (formation.pdf_nom_original || 'Support de formation.pdf') : 'Aucun support PDF pour le moment'}
                </p>
                <p className='text-xs text-muted-foreground'>Support de cours téléchargeable</p>
              </div>
            </div>
            {formation?.pdf_disponible && (
              <a
                href={formation.pdf_url}
                download
                className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors shrink-0'
              >
                <LuDownload size={15} />
                Télécharger
              </a>
            )}
          </div>
        </div>

        <div className='rounded-2xl border border-border bg-card p-5 h-fit'>
          <div className='flex items-center gap-2 mb-4'>
            <LuListChecks size={17} className='text-primary' />
            <h3 className='text-sm font-semibold text-foreground'>Plan de la formation</h3>
          </div>
          <ol className='flex flex-col gap-2.5'>
            {SOMMAIRE.map((chapitre, index) => (
              <li key={chapitre} className='flex items-start gap-2.5 text-sm text-muted-foreground'>
                <span className='flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold shrink-0 mt-0.5'>
                  {index + 1}
                </span>
                {chapitre}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6'>
        <div className='lg:col-span-2 rounded-2xl border border-border bg-card p-6'>
          <h3 className='text-base font-semibold text-foreground mb-4'>🎯 Ce que vous allez apprendre</h3>
          <ul className='flex flex-col gap-3'>
            {OBJECTIFS.map((objectif) => (
              <li key={objectif.texte} className='flex items-start gap-3 text-sm text-foreground/90'>
                <span className='text-base leading-none mt-0.5 shrink-0'>{objectif.emoji}</span>
                {objectif.texte}
              </li>
            ))}
          </ul>
        </div>

        <div className='rounded-2xl border border-border bg-primary/5 p-6 flex flex-col gap-3'>
          <div className='flex items-center gap-2'>
            <LuMessageCircle size={17} className='text-primary' />
            <h3 className='text-sm font-semibold text-foreground'>💬 Une question ?</h3>
          </div>
          <p className='text-sm text-muted-foreground'>
            Cette formation couvre l'essentiel des usages quotidiens de HIS Archivage.
            Pour toute question sur une fonctionnalité, rapprochez-vous de votre administrateur.
          </p>
        </div>
      </div>

      {isAdministrator && (
        <div className='rounded-2xl border border-border bg-card p-6 mt-6'>
          <button
            onClick={() => setEditionOuverte((v) => !v)}
            className='flex items-center gap-2 text-sm font-medium text-foreground'
          >
            <LuUpload size={16} className='text-primary' />
            Gérer le contenu de formation
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
