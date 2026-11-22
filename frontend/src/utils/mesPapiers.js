import { getDocumentLienFichier } from '../api/routes/document'

/** "2026-10-01" → "Octobre 2026" dans la langue de l'interface (sans décalage de fuseau). */
export function libelleMois(dateIso, langue) {
  if (!dateIso) return ''
  const [a, m] = dateIso.split('-').map(Number)
  const texte = new Date(a, (m || 1) - 1, 1).toLocaleDateString(langue, { month: 'long', year: 'numeric' })
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

/** "2027-01-14" → "14 janvier 2027". */
export function libelleDate(dateIso, langue) {
  if (!dateIso) return ''
  const [a, m, j] = dateIso.split('-').map(Number)
  return new Date(a, (m || 1) - 1, j || 1).toLocaleDateString(langue, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Télécharge un document par son lien signé (voir DocumentController::lienFichier). */
export async function telechargerDocument(id) {
  const res = await getDocumentLienFichier(id)
  if (!res.ok) throw new Error('lien indisponible')
  const { telechargement } = await res.json()
  window.location.href = telechargement
}

/**
 * Pastille d'échéance d'un document : { cle, params, classes } ou null.
 * Mêmes seuils que le serveur (EcheancesDocuments) : alerte à 60 jours.
 */
export function pastilleEcheance(doc) {
  if (!doc.date_fin_validite || doc.remplace) return null
  const j = doc.jours_restants
  if (j < 0) return { cle: 'mesPapiers.expire', params: {}, classes: 'bg-destructive/10 text-destructive' }
  if (j <= 60) return { cle: 'mesPapiers.expireDans', params: { count: j }, classes: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' }
  return { cle: 'mesPapiers.valideJusqua', params: { annee: doc.date_fin_validite.slice(0, 4) }, classes: 'bg-green-600/10 text-green-700 dark:text-green-400' }
}
