/**
 * « Ajouter HIS à l'écran d'accueil » — demande explicite 2026-11-22.
 *
 * Chrome/Edge (Android, ordinateur) proposent l'installation par un
 * évènement `beforeinstallprompt`, qui arrive très tôt, souvent avant que
 * le tableau de bord soit affiché : on le garde ici dès le chargement (voir
 * index.js) pour que InviteInstallation.jsx puisse s'en servir plus tard.
 * iPhone/iPad (Safari) n'ont pas cet évènement : on y explique le geste
 * « Partager → Sur l'écran d'accueil ».
 */

let invitation = null
const abonnes = new Set()

function prevenir() {
  abonnes.forEach((fn) => fn(invitation))
}

export function initialiserInstallation() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    invitation = e
    prevenir()
  })
  window.addEventListener('appinstalled', () => {
    invitation = null
    prevenir()
  })
  // Le service worker (déjà utilisé pour les notifications) fait partie de
  // ce qui rend l'application installable : on l'enregistre d'office, sans
  // pour autant demander l'autorisation des notifications.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}

export function sAbonnerInstallation(fn) {
  abonnes.add(fn)
  fn(invitation)
  return () => abonnes.delete(fn)
}

/** Ouvre la fenêtre d'installation du navigateur. Rend true si acceptée. */
export async function lancerInstallation() {
  if (!invitation) return false
  invitation.prompt()
  const { outcome } = await invitation.userChoice
  invitation = null
  prevenir()
  return outcome === 'accepted'
}

export function estDejaInstallee() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function estIos() {
  const ua = window.navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}
