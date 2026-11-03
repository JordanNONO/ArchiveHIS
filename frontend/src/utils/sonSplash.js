/**
 * Signature sonore du splash de connexion, synthétisée avec Web Audio (aucun
 * fichier à charger) et calée sur les animations d'accueil.css :
 *  - 0,05 s : souffle léger pendant que les feuilles montent ;
 *  - 1,15 s : carillon à l'apparition du badge HIS ;
 *  - 1,60 s : note plus haute quand le nom « HisDocs » s'écrit.
 *
 * Les navigateurs peuvent refuser un son qui ne suit pas un geste de
 * l'utilisateur (Safari iOS notamment) : dans ce cas on reste silencieux,
 * sans erreur. Chrome l'autorise ici, car la page vient d'être ouverte par
 * le clic sur « Se connecter ».
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

export function jouerSonSplash() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return () => {}
  let ctx
  try {
    ctx = new AudioCtx()
  } catch {
    return () => {}
  }

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
  return () => { ctx.close().catch(() => {}) }
}
