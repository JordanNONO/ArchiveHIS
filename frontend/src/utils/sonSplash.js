/**
 * Signature sonore du splash de connexion, synthétisée avec Web Audio (aucun
 * fichier à charger) et calée sur les animations d'accueil.css :
 *  - 0,05 s : souffle léger pendant que les feuilles montent ;
 *  - 1,15 s : carillon à l'apparition du badge HIS ;
 *  - 1,60 s : note plus haute quand le nom « HisDocs » s'écrit.
 *
 * Les navigateurs mobiles refusent un son qui ne suit pas immédiatement un
 * geste de l'utilisateur, et un rechargement de page fait perdre ce geste :
 * le splash se joue donc sur la page de connexion elle-même (voir
 * Login.jsx), avec un contexte audio ouvert pendant le toucher sur « Se
 * connecter » (deverrouillerAudio). Si le son reste refusé malgré tout, on
 * reste silencieux, sans erreur. Sur iPhone, le bouton silencieux coupe
 * aussi ce son, comme celui de toutes les pages web.
 */
const VOLUME = 0.18

function souffle(ctx, sortie, debut) {
  const duree = 0.9
  const tampon = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duree), ctx.sampleRate)
  const donnees = tampon.getChannelData(0)
  for (let i = 0; i < donnees.length; i++) donnees[i] = Math.random() * 2 - 1
  const bruit = ctx.createBufferSource()
  bruit.buffer = tampon

  const filtre = ctx.createBiquadFilter()
  filtre.type = 'bandpass'
  filtre.Q.value = 0.8
  filtre.frequency.setValueAtTime(400, debut)
  filtre.frequency.exponentialRampToValueAtTime(2400, debut + duree)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, debut)
  gain.gain.exponentialRampToValueAtTime(0.22, debut + 0.35)
  gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree)

  bruit.connect(filtre).connect(gain).connect(sortie)
  bruit.start(debut)
  bruit.stop(debut + duree)
}

// Note de cloche : une fondamentale et deux partiels qui s'éteignent plus vite.
function cloche(ctx, sortie, debut, frequence, force = 1, duree = 1.8) {
  ;[[1, 1], [2.01, 0.35], [3.98, 0.12]].forEach(([multiple, niveau]) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = frequence * multiple
    const gain = ctx.createGain()
    const fin = debut + duree / multiple
    gain.gain.setValueAtTime(0.0001, debut)
    gain.gain.exponentialRampToValueAtTime(niveau * force, debut + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, fin)
    osc.connect(gain).connect(sortie)
    osc.start(debut)
    osc.stop(fin + 0.05)
  })
}

// Contexte audio ouvert pendant le toucher sur « Se connecter » (voir
// deverrouillerAudio) — les navigateurs mobiles n'autorisent le son que dans
// la foulée immédiate d'un geste, et la réponse du serveur arrive trop tard.
let ctxDeverrouille = null

function creerContexte() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  try {
    return new AudioCtx()
  } catch {
    return null
  }
}

/**
 * À appeler DIRECTEMENT dans le gestionnaire du geste (clic, Entrée, envoi
 * du formulaire), avant tout await : ouvre le contexte audio et joue un
 * échantillon muet, ce qui suffit à Safari iOS et Chrome Android pour
 * autoriser le carillon quelques secondes plus tard.
 */
export function deverrouillerAudio() {
  if (ctxDeverrouille && ctxDeverrouille.state !== 'closed') return
  const ctx = creerContexte()
  if (!ctx) return
  try {
    ctx.resume().catch(() => {})
    const silence = ctx.createBufferSource()
    silence.buffer = ctx.createBuffer(1, 1, 22050)
    silence.connect(ctx.destination)
    silence.start(0)
  } catch {
    // Pas de son possible ici : le splash restera simplement silencieux.
  }
  ctxDeverrouille = ctx
}

export function jouerSonSplash() {
  const ctx = ctxDeverrouille && ctxDeverrouille.state !== 'closed' ? ctxDeverrouille : creerContexte()
  ctxDeverrouille = null
  if (!ctx) return () => {}

  const programmer = () => {
    const t0 = ctx.currentTime + 0.05
    const sortie = ctx.createGain()
    sortie.gain.value = VOLUME
    // Un peu d'écho pour donner de l'espace au carillon.
    const delai = ctx.createDelay()
    delai.delayTime.value = 0.18
    const retour = ctx.createGain()
    retour.gain.value = 0.25
    sortie.connect(ctx.destination)
    sortie.connect(delai).connect(retour).connect(ctx.destination)
    retour.connect(delai)

    souffle(ctx, sortie, t0)
    cloche(ctx, sortie, t0 + 1.1, 659.25, 0.9)        // mi
    cloche(ctx, sortie, t0 + 1.16, 987.77, 0.55)      // si
    cloche(ctx, sortie, t0 + 1.55, 1318.51, 0.4, 1.4) // mi aigu
  }

  if (ctx.state === 'running') programmer()
  else ctx.resume().then(() => { if (ctx.state === 'running') programmer() }).catch(() => {})

  // Appelé quand le splash disparaît : le son est fini à ce moment-là, sauf
  // si la personne l'a passé d'un toucher, et alors il s'arrête avec lui.
  // Un léger délai laisse retomber l'écho du dernier carillon.
  return () => { setTimeout(() => ctx.close().catch(() => {}), 400) }
}
