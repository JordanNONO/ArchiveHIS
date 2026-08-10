import React, { useEffect, useRef, useState } from 'react'
import { LuMic, LuSquare, LuTrash2, LuPlay, LuPause } from 'react-icons/lu'

const SpeechRecognitionImpl = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

const DUREE_MAX_SECONDES = 180 // 3 min — au-delà, on termine et on envoie automatiquement.

// Langues proposées pour la reconnaissance vocale — les bénéficiaires ne
// parlent pas tous français, la transcription doit pouvoir suivre. Codes
// BCP-47 reconnus par la Web Speech API (voir demarrerReconnaissance()).
const LANGUES_TRANSCRIPTION = [
  { code: 'fr-FR', label: 'Français' },
  { code: 'ar-SA', label: 'العربية' },
  { code: 'en-US', label: 'English' },
  { code: 'pt-PT', label: 'Português' },
  { code: 'es-ES', label: 'Español' },
]
const CLE_LANGUE_STOCKEE = 'his_archive_langue_vocal'

function formatDuree(secondes) {
  const m = Math.floor(secondes / 60)
  const s = Math.floor(secondes % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Composeur de message façon WhatsApp : un champ texte avec, à L'EXTÉRIEUR
 * (pas dedans), un bouton rond qui change de rôle selon l'état — micro pour
 * démarrer, carré rouge pour terminer un enregistrement en cours, poubelle
 * pour supprimer un vocal déjà enregistré. Une seule ligne, jamais deux zones
 * séparées.
 *
 * Enregistrement plafonné à 3 minutes — au-delà, termine et transmet
 * automatiquement (comme si on avait appuyé sur le bouton d'arrêt soi-même).
 *
 * La transcription se fait en direct via la reconnaissance vocale du
 * navigateur (Web Speech API) — plus simple à mettre en place qu'un modèle
 * auto-hébergé, mais l'audio transite par le service du navigateur (Google
 * sur Chrome/Edge) — compromis assumé. Les bénéficiaires ne parlant pas
 * tous français, la langue de reconnaissance est choisie via un petit menu
 * au-dessus du champ (LANGUES_TRANSCRIPTION) et retenue d'un message à
 * l'autre (localStorage).
 *
 * `onChangeVocal(fichierAudio, transcription)` est appelé une fois
 * l'enregistrement terminé (auto ou manuel) ; `fichierAudio` est `null` après
 * suppression.
 *
 * `variante` accorde le cadre à son contexte : 'compact' (par défaut) pour le
 * formulaire générique d'EspaceDossier.jsx, où il doit rester cohérent avec
 * les autres champs (Titre...) qui utilisent ce même style resserré ;
 * 'wizard' pour un parcours séquentiel (SignalementForm.jsx...), où il doit
 * reprendre exactement le même cadre que les autres champs texte du wizard
 * (voir WIZARD_TEXTAREA_CLS dans wizard/Wizard.jsx) — sans ça, le champ
 * "Écrivez ici" détonne au milieu des cartes plus arrondies du wizard.
 */
function VoiceRecorder({ valeurTexte, onChangeTexte, placeholder, requis, onChangeVocal, className = '', variante = 'compact' }) {
  const [etat, setEtat] = useState('idle') // idle | recording | pause | pret
  const [duree, setDuree] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [audioUrl, setAudioUrl] = useState(null)
  const [lecture, setLecture] = useState(false)
  const [dureeFinale, setDureeFinale] = useState(0)
  const [nonSupporte, setNonSupporte] = useState(false)
  const [langue, setLangue] = useState(() => {
    try { return localStorage.getItem(CLE_LANGUE_STOCKEE) || 'fr-FR' } catch { return 'fr-FR' }
  })

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const recognitionRef = useRef(null)
  const minuteurRef = useRef(null)
  const audioElRef = useRef(null)
  const transcriptFigeRef = useRef('')

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNonSupporte(true)
    }
    return () => {
      clearInterval(minuteurRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      try { recognitionRef.current?.stop() } catch { /* déjà arrêté */ }
    }
  }, [])

  function changerLangue(code) {
    setLangue(code)
    try { localStorage.setItem(CLE_LANGUE_STOCKEE, code) } catch { /* stockage indisponible, tant pis */ }
  }

  function demarrerReconnaissance() {
    if (!SpeechRecognitionImpl) return
    const reco = new SpeechRecognitionImpl()
    reco.lang = langue
    reco.continuous = true
    reco.interimResults = true
    reco.onresult = (e) => {
      let texteSession = ''
      for (let i = 0; i < e.results.length; i++) texteSession += e.results[i][0].transcript
      const prefixe = transcriptFigeRef.current
      setTranscript(prefixe ? `${prefixe} ${texteSession}` : texteSession)
    }
    reco.onerror = () => {}
    try { reco.start() } catch { /* déjà démarré */ }
    recognitionRef.current = reco
  }

  async function demarrer() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      transcriptFigeRef.current = ''
      setTranscript('')

      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start()
      mediaRecorderRef.current = recorder

      demarrerReconnaissance()

      setDuree(0)
      setEtat('recording')
      minuteurRef.current = setInterval(() => {
        setDuree((d) => {
          if (d + 1 >= DUREE_MAX_SECONDES) {
            // Limite atteinte : on termine tout seul, comme un appui sur "arrêter".
            setTimeout(() => arreter(), 0)
            return DUREE_MAX_SECONDES
          }
          return d + 1
        })
      }, 1000)
    } catch (error) {
      console.log(error)
    }
  }

  function mettreEnPause() {
    clearInterval(minuteurRef.current)
    mediaRecorderRef.current?.pause()
    try { recognitionRef.current?.stop() } catch { /* déjà arrêté */ }
    transcriptFigeRef.current = transcript
    setEtat('pause')
  }

  function reprendre() {
    mediaRecorderRef.current?.resume()
    demarrerReconnaissance()
    minuteurRef.current = setInterval(() => {
      setDuree((d) => {
        if (d + 1 >= DUREE_MAX_SECONDES) {
          setTimeout(() => arreter(), 0)
          return DUREE_MAX_SECONDES
        }
        return d + 1
      })
    }, 1000)
    setEtat('recording')
  }

  function arreter() {
    clearInterval(minuteurRef.current)
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const fichier = new File([blob], 'Message vocal.webm', { type: 'audio/webm' })
      setAudioUrl(URL.createObjectURL(blob))
      setDureeFinale((d) => d) // duree courante déjà à jour
      setEtat('pret')
      onChangeVocal(fichier, transcript.trim())
    }
    setDureeFinale(duree)
    recorder.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    try { recognitionRef.current?.stop() } catch { /* déjà arrêté */ }
  }

  function supprimer() {
    setEtat('idle')
    setAudioUrl(null)
    setLecture(false)
    setTranscript('')
    setDuree(0)
    onChangeVocal(null, '')
  }

  function toggleLecture() {
    if (!audioElRef.current) return
    if (lecture) {
      audioElRef.current.pause()
    } else {
      audioElRef.current.play()
    }
  }

  const estWizard = variante === 'wizard'
  const rayon = estWizard ? 'rounded-2xl' : 'rounded-lg'
  const champCls = estWizard
    ? 'w-full rounded-2xl border-[1.5px] border-border bg-background px-3.5 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow resize-none'
    : 'w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  // Dans un wizard, le champ doit occuper autant de place que les autres
  // <textarea> du même parcours (ex: la Description de ReclamationForm.jsx),
  // pas rester riquiqui à 2 lignes à côté du micro.
  const rangees = estWizard ? 6 : 2
  const boutonExterieurCls = 'flex items-center justify-center w-11 h-11 rounded-full shrink-0 transition-colors'

  // Pas de micro supporté : simple champ texte, comme avant cette fonctionnalité.
  if (nonSupporte || !onChangeVocal) {
    return (
      <textarea
        value={valeurTexte}
        onChange={(e) => onChangeTexte(e.target.value)}
        rows={rangees}
        required={requis}
        className={`${champCls} ${className}`}
        placeholder={placeholder}
      />
    )
  }

  if (etat === 'recording' || etat === 'pause') {
    const enPause = etat === 'pause'
    return (
      <div className={`flex items-end gap-2 ${className}`}>
        <div className={`flex-1 flex items-center gap-2.5 ${rayon} border px-3 py-2 min-h-[42px] ${enPause ? 'border-border bg-muted/50' : 'border-destructive/30 bg-destructive/5'}`}>
          <button
            type='button'
            onClick={enPause ? reprendre : mettreEnPause}
            title={enPause ? 'Reprendre' : 'Mettre en pause'}
            className='flex items-center justify-center w-6 h-6 rounded-full border border-current text-muted-foreground shrink-0'
          >
            {enPause ? <LuPlay size={11} className='ml-0.5' /> : <LuPause size={11} />}
          </button>
          <div className='flex-1 min-w-0'>
            <div className={`text-sm font-medium tabular-nums ${enPause ? 'text-muted-foreground' : 'text-destructive'}`}>
              {formatDuree(duree)} <span className='text-xs font-normal text-muted-foreground'>/ {formatDuree(DUREE_MAX_SECONDES)}</span>
            </div>
            {transcript && <div className='text-xs text-muted-foreground truncate'>{transcript}</div>}
          </div>
          {!enPause && <span className='w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0' />}
        </div>
        <button type='button' onClick={arreter} title="Terminer et envoyer" className={`${boutonExterieurCls} bg-destructive text-white hover:bg-destructive/90`}>
          <LuSquare size={16} />
        </button>
      </div>
    )
  }

  if (etat === 'pret') {
    return (
      <div className={`flex items-end gap-2 ${className}`}>
        <audio
          ref={audioElRef}
          src={audioUrl}
          onPlay={() => setLecture(true)}
          onPause={() => setLecture(false)}
          onEnded={() => setLecture(false)}
          className='hidden'
        />
        <div className={`flex-1 flex items-center gap-2.5 ${rayon} border border-border bg-primary/5 px-3 py-2 min-h-[42px]`}>
          <button type='button' onClick={toggleLecture} className='flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white shrink-0'>
            {lecture ? <LuPause size={12} /> : <LuPlay size={12} className='ml-0.5' />}
          </button>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-1 h-4'>
              {Array.from({ length: 20 }).map((_, i) => (
                <span key={i} className='flex-1 min-w-[2px] rounded-full bg-primary/40' style={{ height: `${20 + Math.sin(i * 1.3) * 15}%` }} />
              ))}
            </div>
            {transcript && <div className='text-xs text-muted-foreground truncate mt-0.5'>{transcript}</div>}
          </div>
          <span className='text-xs text-muted-foreground tabular-nums shrink-0'>{formatDuree(dureeFinale)}</span>
        </div>
        <button type='button' onClick={supprimer} title='Supprimer le message vocal' className={`${boutonExterieurCls} border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive`}>
          <LuTrash2 size={16} />
        </button>
      </div>
    )
  }

  // En wizard, le <textarea> doit grandir jusqu'à toucher les boutons
  // Retour/Suivant, exactement comme le champ direct de ReclamationForm.jsx —
  // et le micro reste à sa place naturelle, à droite du champ (pas superposé
  // dessus). Un flex-1 imbriqué sur plusieurs niveaux ne suffisait pas : par
  // défaut, un enfant flex refuse de descendre sous la taille de son contenu
  // (`min-height: auto`) — d'où le `min-h-0` explicite à chaque niveau. La
  // ligne texte+micro passe en grid (colonne flexible + colonne fixe) plutôt
  // qu'en flex : le dimensionnement d'une piste grid `1fr` est sans ambiguïté,
  // contrairement à un flex-grow imbriqué dans un conteneur de hauteur `auto`.
  if (estWizard) {
    return (
      <div className={`flex min-h-0 flex-col ${className}`}>
        {SpeechRecognitionImpl && (
          <div className='flex justify-end mb-1 shrink-0'>
            <select
              value={langue}
              onChange={(e) => changerLangue(e.target.value)}
              title='Langue du message vocal'
              className='text-[11px] font-medium text-muted-foreground bg-transparent border-none py-0 pl-0 pr-4 focus:outline-none cursor-pointer hover:text-foreground'
            >
              {LANGUES_TRANSCRIPTION.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className='grid grid-cols-[1fr_auto] items-stretch gap-2 flex-1 min-h-0'>
          <textarea
            value={valeurTexte}
            onChange={(e) => onChangeTexte(e.target.value)}
            rows={rangees}
            required={requis}
            className={`h-full min-h-0 ${champCls}`}
            placeholder={placeholder}
          />
          <button type='button' onClick={demarrer} title='Message vocal' className={`${boutonExterieurCls} self-end border border-border text-primary hover:bg-primary/10`}>
            <LuMic size={17} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {SpeechRecognitionImpl && (
        <div className='flex justify-end mb-1'>
          <select
            value={langue}
            onChange={(e) => changerLangue(e.target.value)}
            title='Langue du message vocal'
            className='text-[11px] font-medium text-muted-foreground bg-transparent border-none py-0 pl-0 pr-4 focus:outline-none cursor-pointer hover:text-foreground'
          >
            {LANGUES_TRANSCRIPTION.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      )}
      <div className='flex items-end gap-2'>
        <textarea
          value={valeurTexte}
          onChange={(e) => onChangeTexte(e.target.value)}
          rows={rangees}
          required={requis}
          className={`flex-1 ${champCls}`}
          placeholder={placeholder}
        />
        <button type='button' onClick={demarrer} title='Message vocal' className={`${boutonExterieurCls} border border-border text-primary hover:bg-primary/10`}>
          <LuMic size={17} />
        </button>
      </div>
    </div>
  )
}

export default VoiceRecorder
