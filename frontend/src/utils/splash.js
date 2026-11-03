/**
 * Écran de démarrage joué juste après chaque connexion (Login, Inscription).
 * Le drapeau vit dans sessionStorage, comme le token : posé au moment où la
 * connexion réussit, puis consommé par SplashConnexion dès qu'il s'affiche —
 * un simple rechargement de page ne le rejoue donc pas.
 *
 * Le tour de bienvenue (OnboardingTour) attend la fin du splash avant de
 * lancer ses animations, sinon elles se joueraient cachées dessous.
 */
const CLE_SPLASH = 'splash_connexion'
const EVENEMENT_FIN = 'splash-termine'

let enCours = false
// Lu une seule fois par chargement de page : React (StrictMode) peut appeler
// deux fois l'initialiseur de useState, et le second appel trouverait le
// drapeau déjà effacé.
let demandeLue = null

export function demanderSplash() {
  sessionStorage.setItem(CLE_SPLASH, '1')
}

export function consommerSplash() {
  if (demandeLue === null) {
    demandeLue = sessionStorage.getItem(CLE_SPLASH) === '1'
    sessionStorage.removeItem(CLE_SPLASH)
    enCours = demandeLue
  }
  return demandeLue
}

export function splashEnCours() {
  return enCours
}

export function terminerSplash() {
  enCours = false
  window.dispatchEvent(new Event(EVENEMENT_FIN))
}

export function surFinSplash(callback) {
  window.addEventListener(EVENEMENT_FIN, callback)
  return () => window.removeEventListener(EVENEMENT_FIN, callback)
}
