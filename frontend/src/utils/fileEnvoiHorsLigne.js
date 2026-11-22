import { createDocument } from '../api/routes/document'

/**
 * Dépôts faits sans réseau (chez un bénéficiaire, dans un sous-sol...) —
 * demande explicite 2026-11-22 : rien ne doit se perdre. Le dépôt est gardé
 * sur le téléphone (IndexedDB, qui sait stocker les fichiers eux-mêmes) et
 * part tout seul dès que la connexion revient, ou à la prochaine ouverture
 * de l'application (voir SynchroEnvoisHorsLigne.jsx).
 *
 * Un « lot » = un dépôt tel que l'intervenant l'a fait (éventuellement
 * plusieurs pages) ; chaque page envoyée est retirée du lot aussitôt, pour ne
 * jamais l'envoyer deux fois si le réseau recoupe au milieu.
 */

const BASE = 'his-envois-hors-ligne'
const MAGASIN = 'lots'
export const EVENEMENT_FILE = 'his-file-envois-change'

function ouvrirBase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB indisponible'))
      return
    }
    const requete = indexedDB.open(BASE, 1)
    requete.onupgradeneeded = () => {
      const db = requete.result
      if (!db.objectStoreNames.contains(MAGASIN)) {
        db.createObjectStore(MAGASIN, { keyPath: 'id' })
      }
    }
    requete.onsuccess = () => resolve(requete.result)
    requete.onerror = () => reject(requete.error)
  })
}

async function transaction(mode, action) {
  const db = await ouvrirBase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MAGASIN, mode)
    const magasin = tx.objectStore(MAGASIN)
    let resultat
    const requete = action(magasin)
    if (requete) requete.onsuccess = () => { resultat = requete.result }
    tx.oncomplete = () => { db.close(); resolve(resultat) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

function signalerChangement() {
  window.dispatchEvent(new CustomEvent(EVENEMENT_FILE))
}

/** Le réseau est-il en cause (plutôt qu'un refus du serveur) ? */
export function estErreurReseau(erreur) {
  return !navigator.onLine || erreur instanceof TypeError
}

/**
 * Garde un dépôt pour plus tard. `envois` = [{ data, fichier }] dans l'ordre
 * des pages, exactement ce qui aurait été passé à createDocument().
 */
export async function mettreEnAttente({ userId, titre, dossier, envois }) {
  const lot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    titre,
    dossier,
    creeLe: new Date().toISOString(),
    nombrePages: envois.length,
    envois: envois.map(({ data, fichier }) => ({
      data,
      fichier,
      nomFichier: fichier.name,
      typeFichier: fichier.type,
      dateFichier: fichier.lastModified || Date.now(),
    })),
  }
  await transaction('readwrite', (m) => m.put(lot))
  signalerChangement()
  return lot
}

export async function listerEnAttente(userId) {
  try {
    const tous = await transaction('readonly', (m) => m.getAll())
    return (tous || [])
      .filter((l) => String(l.userId) === String(userId))
      .sort((a, b) => a.creeLe.localeCompare(b.creeLe))
  } catch {
    return []
  }
}

export async function annulerEnvoi(id) {
  await transaction('readwrite', (m) => m.delete(id))
  signalerChangement()
}

let envoiEnCours = false

/**
 * Envoie tout ce qui attend pour cet utilisateur. Rend la liste des titres
 * partis. S'arrête au premier souci de réseau (le reste réessaiera plus
 * tard) ; un refus du serveur laisse le lot en place, marqué en erreur,
 * pour que l'intervenant le voie au lieu de le perdre en silence.
 */
export async function envoyerEnAttente(userId) {
  if (envoiEnCours || !navigator.onLine || !sessionStorage.getItem('token')) return []
  envoiEnCours = true
  const partis = []
  try {
    const lots = await listerEnAttente(userId)
    for (const lot of lots) {
      let reste = [...lot.envois]
      while (reste.length > 0) {
        const envoi = reste[0]
        const fichier = new File([envoi.fichier], envoi.nomFichier, { type: envoi.typeFichier, lastModified: envoi.dateFichier })
        let res
        try {
          res = await createDocument(envoi.data, fichier)
        } catch (erreur) {
          if (estErreurReseau(erreur)) return partis
          throw erreur
        }
        if (res.status !== 201) {
          const enErreur = { ...lot, envois: reste, erreur: true }
          await transaction('readwrite', (m) => m.put(enErreur))
          signalerChangement()
          break
        }
        reste = reste.slice(1)
        if (reste.length > 0) {
          const aJour = { ...lot, envois: reste, erreur: false }
          await transaction('readwrite', (m) => m.put(aJour))
        } else {
          await transaction('readwrite', (m) => m.delete(lot.id))
          partis.push(lot.titre)
        }
        signalerChangement()
      }
    }
  } catch (erreur) {
    console.log(erreur)
  } finally {
    envoiEnCours = false
  }
  return partis
}
