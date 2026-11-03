import { useCallback, useEffect, useRef, useState } from 'react'

export const SpeechRecognitionImpl = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

export const enregistrementSupporte = () =>
  typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

// Ordre de préférence : AAC en MP4 d'abord, lisible partout (Safari/iOS ne lit
// pas le WebM des anciennes versions, et c'est RH qui réécoute sur un autre
// navigateur), puis Opus en WebM/Ogg. Le format réellement produit est relu
// sur recorder.mimeType, jamais deviné.
const MIME_CANDIDATS = ['audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']

function choisirMime() {
  if (!MediaRecorder.isTypeSupported) return null
  return MIME_CANDIDATS.find((m) => MediaRecorder.isTypeSupported(m)) || null
}

function extensionPourMime(mime) {
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

const INTERVALLE_MESURE_MS = 100
// En dessous, le signal est un zéro numérique : aucune vraie pièce n'est aussi
// silencieuse — c'est que le micro ne nous parvient plus (voir plus bas).
const SEUIL_SILENCE_NUMERIQUE = 0.00002
const DELAI_MICRO_PRIVE_MS = 1500
// Pic sous lequel l'enregistrement entier est considéré vide.
const SEUIL_ENREGISTREMENT_VIDE = 0.003
const RELANCES_RECONNAISSANCE_MAX = 30

function joindre(a, b) {
  return [a, b].map((s) => (s || '').trim()).filter(Boolean).join(' ')
}

/**
 * Texte d'une session de reconnaissance. Chrome Android renvoie des résultats
 * cumulatifs (chaque résultat reprend le précédent) : sans cette déduplication,
 * la transcription répétait tout ("je je voudrais je voudrais un...").
 */
function texteDesResultats(resultats) {
  const morceaux = []
  for (let i = 0; i < resultats.length; i++) {
    const texte = resultats[i][0]?.transcript?.trim()
    if (!texte) continue
    const precedent = morceaux[morceaux.length - 1]
    if (precedent && texte.toLowerCase().startsWith(precedent.toLowerCase())) morceaux[morceaux.length - 1] = texte
    else morceaux.push(texte)
  }
  return morceaux.join(' ')
}

export function cleErreurMicro(erreur) {
  switch (erreur?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'accesMicRefuse'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'aucunMic'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'micDejaUtilise'
    default:
      return 'micInaccessible'
  }
}

/**
 * Enregistrement d'un message vocal + transcription en direct.
 *
 * L'enregistrement (MediaRecorder) est la source de vérité, la transcription
 * (Web Speech API) un bonus qui ne doit jamais le mettre en danger. Sur
 * téléphone, le micro est souvent exclusif : quand la reconnaissance vocale le
 * prend, l'enregistrement reçoit un silence numérique (ou sa piste passe en
 * "muted"). On surveille le niveau réel du signal (AnalyserNode) : si le micro
 * ne nous parvient plus pendant que la reconnaissance tourne, elle est coupée
 * pour la suite de l'enregistrement (transcription = 'coupee'), l'audio reste
 * complet. Un enregistrement entièrement vide n'est jamais transmis.
 *
 * La reconnaissance mobile s'arrête d'elle-même après un silence : elle est
 * relancée tant que l'enregistrement continue, le texte déjà reconnu étant
 * conservé d'une session à l'autre.
 *
 * Toutes les valeurs lues par les minuteurs et rappels passent par des refs :
 * l'ancienne version appelait arreter() depuis un setInterval figé sur le
 * premier rendu — à la limite des 3 min, la transcription et la durée
 * repartaient vides.
 */
export function useEnregistreurVocal({ langue, dureeMaxSecondes, onTermine, onErreur }) {
  const [etat, setEtat] = useState('inactif') // inactif | demarrage | enregistrement | pause | finalisation | pret
  const [duree, setDuree] = useState(0)
  const [niveauxRecents, setNiveauxRecents] = useState([])
  const [transcription, setTranscription] = useState('')
  const [etatTranscription, setEtatTranscription] = useState(null) // active | indisponible | coupee
  const [enregistrement, setEnregistrement] = useState(null) // { fichier, url, duree, niveaux }

  const r = useRef({}).current
  r.etat = etat
  r.langue = langue
  r.dureeMax = dureeMaxSecondes
  r.onTermine = onTermine
  r.onErreur = onErreur

  const changerEtat = useCallback((suivant) => {
    r.etat = suivant
    setEtat(suivant)
  }, [r])

  const changerEtatTranscription = useCallback((suivant) => {
    r.etatTranscription = suivant
    setEtatTranscription(suivant)
  }, [r])

  // --- Reconnaissance vocale ------------------------------------------------

  const arreterReconnaissance = useCallback((brutalement) => {
    const reco = r.reco
    if (!reco) return
    try {
      if (brutalement) reco.abort()
      else reco.stop()
    } catch {
      // déjà arrêtée
    }
  }, [r])

  const couperTranscription = useCallback((raison) => {
    if (r.etatTranscription !== 'active') return
    changerEtatTranscription(raison)
    arreterReconnaissance(true)
  }, [r, changerEtatTranscription, arreterReconnaissance])

  const demarrerReconnaissance = useCallback(() => {
    if (!SpeechRecognitionImpl || r.etatTranscription !== 'active' || r.reco) return
    const reco = new SpeechRecognitionImpl()
    reco.lang = r.langue
    reco.continuous = true
    reco.interimResults = true
    r.texteSession = ''

    reco.onresult = (e) => {
      // Seules les relances sans aucun résultat comptent pour la limite.
      r.relances = 0
      r.texteSession = texteDesResultats(e.results)
      setTranscription(joindre(r.texteFige, r.texteSession))
    }
    reco.onerror = (e) => {
      // 'no-speech' / 'aborted' : fin de session normale, relancée par onend.
      if (e.error === 'no-speech' || e.error === 'aborted') return
      couperTranscription(e.error === 'audio-capture' ? 'coupee' : 'indisponible')
    }
    reco.onend = () => {
      r.texteFige = joindre(r.texteFige, r.texteSession)
      r.texteSession = ''
      r.reco = null
      r.finReconnaissance?.()
      if (r.etat === 'enregistrement' && r.etatTranscription === 'active') {
        r.relances = (r.relances || 0) + 1
        if (r.relances > RELANCES_RECONNAISSANCE_MAX) changerEtatTranscription('indisponible')
        else setTimeout(demarrerReconnaissance, 250)
      }
    }

    try {
      reco.start()
      r.reco = reco
    } catch {
      changerEtatTranscription('indisponible')
    }
  }, [r, couperTranscription, changerEtatTranscription])

  // --- Mesure du signal et minuteur ----------------------------------------

  const mesurer = useCallback(() => {
    if (r.etat !== 'enregistrement') return
    const maintenant = performance.now()
    const ecoule = r.dureeAccumulee + (maintenant - r.debutSegment) / 1000

    let rms = null
    if (r.analyseur) {
      r.analyseur.getFloatTimeDomainData(r.tampon)
      let somme = 0
      for (let i = 0; i < r.tampon.length; i++) somme += r.tampon[i] * r.tampon[i]
      rms = Math.sqrt(somme / r.tampon.length)
      r.niveaux.push(rms)
      r.pic = Math.max(r.pic, rms)
      setNiveauxRecents(r.niveaux.slice(-32))

      // Micro "volé" par la reconnaissance vocale : silence numérique pendant
      // qu'elle est active → on la coupe pour garder l'enregistrement. Le
      // silence est compté en continu, relances comprises (entre deux
      // sessions, r.reco est brièvement vide).
      if (rms < SEUIL_SILENCE_NUMERIQUE) {
        r.silenceDepuis = r.silenceDepuis || maintenant
        if (maintenant - r.silenceDepuis > DELAI_MICRO_PRIVE_MS) couperTranscription('coupee')
      } else {
        r.silenceDepuis = null
      }
    }

    setDuree(ecoule)
    if (ecoule >= r.dureeMax) r.terminer()
  }, [r, couperTranscription])

  // --- Cycle de vie ---------------------------------------------------------

  const libererRessources = useCallback(() => {
    clearInterval(r.minuteur)
    r.minuteur = null
    r.flux?.getTracks().forEach((piste) => piste.stop())
    r.flux = null
    arreterReconnaissance(true)
    r.contexte?.close?.().catch(() => {})
    r.contexte = null
    r.analyseur = null
  }, [r, arreterReconnaissance])

  const demarrer = useCallback(async () => {
    if (r.etat !== 'inactif') return
    changerEtat('demarrage')

    // Contexte audio créé pendant le geste de l'utilisateur : iOS refuse de
    // le démarrer plus tard.
    const ContexteAudio = window.AudioContext || window.webkitAudioContext
    const contexte = ContexteAudio ? new ContexteAudio() : null

    let flux
    try {
      flux = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (erreur) {
      contexte?.close?.().catch(() => {})
      if (r.demonte) return
      changerEtat('inactif')
      r.onErreur?.(cleErreurMicro(erreur))
      return
    }
    // Composant fermé pendant la demande d'autorisation.
    if (r.demonte) {
      flux.getTracks().forEach((piste) => piste.stop())
      contexte?.close?.().catch(() => {})
      return
    }

    r.flux = flux
    r.contexte = contexte
    r.niveaux = []
    r.pic = 0
    r.mesureDisponible = false
    r.morceaux = []
    r.texteFige = ''
    r.texteSession = ''
    r.relances = 0
    r.silenceDepuis = null
    r.dureeAccumulee = 0
    r.debutSegment = performance.now()
    setTranscription('')
    setDuree(0)
    setNiveauxRecents([])

    if (contexte) {
      try {
        await contexte.resume()
        const analyseur = contexte.createAnalyser()
        analyseur.fftSize = 1024
        contexte.createMediaStreamSource(flux).connect(analyseur)
        r.analyseur = analyseur
        r.tampon = new Float32Array(analyseur.fftSize)
        r.mesureDisponible = true
      } catch {
        r.analyseur = null
      }
    }

    const mime = choisirMime()
    const enregistreur = mime ? new MediaRecorder(flux, { mimeType: mime }) : new MediaRecorder(flux)
    r.mime = enregistreur.mimeType || mime || 'audio/webm'
    enregistreur.ondataavailable = (e) => { if (e.data.size > 0) r.morceaux.push(e.data) }
    // Morceaux d'une seconde : rien n'est perdu si le navigateur interrompt
    // brutalement l'enregistrement (appel entrant, écran verrouillé).
    enregistreur.start(1000)
    r.enregistreur = enregistreur

    const [piste] = flux.getAudioTracks()
    if (piste) {
      // Micro coupé par le système (appel, autre appli) : on garde ce qui a
      // été enregistré plutôt que de tout perdre.
      piste.onended = () => r.terminer?.('micCoupe')
      piste.onmute = () => r.reco && couperTranscription('coupee')
    }

    changerEtat('enregistrement')
    changerEtatTranscription(SpeechRecognitionImpl ? 'active' : 'indisponible')
    demarrerReconnaissance()
    r.minuteur = setInterval(mesurer, INTERVALLE_MESURE_MS)
  }, [r, changerEtat, changerEtatTranscription, demarrerReconnaissance, couperTranscription, mesurer])

  const mettreEnPause = useCallback(() => {
    if (r.etat !== 'enregistrement') return
    r.dureeAccumulee += (performance.now() - r.debutSegment) / 1000
    clearInterval(r.minuteur)
    r.enregistreur?.pause()
    changerEtat('pause')
    arreterReconnaissance(false)
  }, [r, changerEtat, arreterReconnaissance])

  const reprendre = useCallback(() => {
    if (r.etat !== 'pause') return
    r.debutSegment = performance.now()
    r.silenceDepuis = null
    r.enregistreur?.resume()
    changerEtat('enregistrement')
    demarrerReconnaissance()
    r.minuteur = setInterval(mesurer, INTERVALLE_MESURE_MS)
  }, [r, changerEtat, demarrerReconnaissance, mesurer])

  const terminer = useCallback(async (motif) => {
    if (r.etat !== 'enregistrement' && r.etat !== 'pause') return
    if (r.etat === 'enregistrement') r.dureeAccumulee += (performance.now() - r.debutSegment) / 1000
    clearInterval(r.minuteur)
    changerEtat('finalisation')

    // Laisse la reconnaissance livrer ses derniers mots (stop() renvoie le
    // résultat final avant onend), sans jamais bloquer plus d'une seconde.
    if (r.reco) {
      await new Promise((resolve) => {
        r.finReconnaissance = resolve
        arreterReconnaissance(false)
        setTimeout(resolve, 1000)
      })
      r.finReconnaissance = null
    }

    const enregistreur = r.enregistreur
    if (enregistreur && enregistreur.state !== 'inactive') {
      await new Promise((resolve) => {
        enregistreur.onstop = resolve
        enregistreur.stop()
      })
    }
    libererRessources()

    if (r.mesureDisponible && r.niveaux.length && r.pic < SEUIL_ENREGISTREMENT_VIDE) {
      changerEtat('inactif')
      r.onErreur?.('aucunSon')
      return
    }

    const mime = r.mime.split(';')[0]
    const blob = new Blob(r.morceaux, { type: mime })
    const fichier = new File([blob], `Message vocal.${extensionPourMime(mime)}`, { type: mime, lastModified: Date.now() })
    const texte = joindre(r.texteFige, r.texteSession)
    setTranscription(texte)
    r.urlEnregistrement = URL.createObjectURL(blob)
    setEnregistrement({ fichier, url: r.urlEnregistrement, duree: r.dureeAccumulee, niveaux: r.niveaux.slice() })
    changerEtat('pret')
    if (motif) r.onErreur?.(motif)
    r.onTermine?.(fichier, texte)
  }, [r, changerEtat, arreterReconnaissance, libererRessources])
  r.terminer = terminer

  const annuler = useCallback(() => {
    if (r.enregistreur && r.enregistreur.state !== 'inactive') {
      r.enregistreur.ondataavailable = null
      r.enregistreur.onstop = null
      try { r.enregistreur.stop() } catch { /* déjà arrêté */ }
    }
    libererRessources()
    setTranscription('')
    setDuree(0)
    changerEtat('inactif')
  }, [r, libererRessources, changerEtat])

  const supprimer = useCallback(() => {
    if (r.urlEnregistrement) URL.revokeObjectURL(r.urlEnregistrement)
    r.urlEnregistrement = null
    setEnregistrement(null)
    setTranscription('')
    setDuree(0)
    changerEtat('inactif')
  }, [r, changerEtat])

  // Téléphone verrouillé ou appli changée pendant l'enregistrement : iOS coupe
  // le micro sans prévenir — on termine proprement avec ce qui a été capté.
  useEffect(() => {
    const surChangementVisibilite = () => {
      if (document.hidden && r.etat === 'enregistrement') r.terminer()
    }
    document.addEventListener('visibilitychange', surChangementVisibilite)
    return () => document.removeEventListener('visibilitychange', surChangementVisibilite)
  }, [r])

  // r.demonte est remis à false au montage : en développement, StrictMode
  // démonte puis remonte chaque composant une fois.
  useEffect(() => {
    r.demonte = false
    return () => {
      r.demonte = true
      if (r.enregistreur && r.enregistreur.state !== 'inactive') {
        r.enregistreur.ondataavailable = null
        try { r.enregistreur.stop() } catch { /* déjà arrêté */ }
      }
      libererRessources()
      if (r.urlEnregistrement) URL.revokeObjectURL(r.urlEnregistrement)
      r.urlEnregistrement = null
    }
  }, [r, libererRessources])

  return {
    etat,
    duree,
    niveauxRecents,
    transcription,
    etatTranscription,
    enregistrement,
    demarrer,
    mettreEnPause,
    reprendre,
    terminer,
    annuler,
    supprimer,
  }
}
