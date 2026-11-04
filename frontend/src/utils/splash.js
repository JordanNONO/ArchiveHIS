/**
 * Écran de démarrage joué juste après chaque connexion (Login, Inscription).
 * Le drapeau vit dans sessionStorage, comme le token : posé au moment où la
 * connexion réussit, puis consommé par SplashConnexion dès qu'il s'affiche —
 * un simple rechargement de page ne le rejoue donc pas.
 *
 * Deux modes :
 * - 'fin' : le splash animé (et son son) s'est déjà joué sur la page de
 *   connexion, dans la foulée du toucher — seule façon d'avoir le son sur
 *   mobile. Après le rechargement, on n'affiche que sa dernière image le
 *   temps que l'appli se charge, puis un fondu : pas de flash entre les deux.
 * - 'complet' : l'animation entière se joue après le rechargement.
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

export const MODE_SPLASH_COMPLET = 'complet'
export const MODE_SPLASH_FIN = 'fin'

export function demanderSplash(mode = MODE_SPLASH_COMPLET) {
  sessionStorage.setItem(CLE_SPLASH, mode)
}

/** Mode demandé ('complet' ou 'fin'), ou null s'il n'y a pas de splash à jouer. */
export function consommerSplash() {
  if (demandeLue === null) {
    const valeur = sessionStorage.getItem(CLE_SPLASH)
    sessionStorage.removeItem(CLE_SPLASH)
    demandeLue = [MODE_SPLASH_COMPLET, MODE_SPLASH_FIN].includes(valeur) ? valeur : null
    enCours = demandeLue !== null
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
