import { lazy } from 'react';

/**
 * Après un déploiement, une application restée ouverte (surtout le raccourci
 * sur l'écran d'accueil d'un iPhone, qui garde la page en mémoire) connaît
 * encore les noms des anciens fichiers JavaScript. Ces fichiers n'existent
 * plus dans le nouveau build : « Loading chunk 932 failed ».
 *
 * Dans ce cas on recharge la page UNE fois pour récupérer la nouvelle
 * version. La clé en sessionStorage empêche une boucle de rechargements si
 * le fichier manque vraiment (serveur en panne, build incomplet).
 */
const CLE = 'his_rechargement_version';

export function estErreurDeVersion(erreur) {
  const message = String(erreur?.message || erreur || '');
  return erreur?.name === 'ChunkLoadError'
    || /Loading (CSS )?chunk [\w-]+ failed/i.test(message)
    || /Failed to fetch dynamically imported module/i.test(message)
    || /Importing a module script failed/i.test(message);
}

/** Recharge la page si ce n'est pas déjà fait il y a moins d'une minute. Renvoie true si un rechargement part. */
export function rechargerPourNouvelleVersion() {
  let dernier = 0;
  try { dernier = Number(sessionStorage.getItem(CLE)) || 0; } catch { /* stockage indisponible */ }
  if (Date.now() - dernier < 60000) return false;
  try { sessionStorage.setItem(CLE, String(Date.now())); } catch { /* stockage indisponible */ }
  window.location.reload();
  return true;
}

/** Remplace React.lazy : en cas de fichier introuvable, recharge la page au lieu d'afficher une erreur. */
export function chargerPage(importer) {
  return lazy(() => importer().catch((erreur) => {
    if (estErreurDeVersion(erreur) && rechargerPourNouvelleVersion()) {
      // La page se recharge : on attend sans rien afficher d'autre.
      return new Promise(() => {});
    }
    throw erreur;
  }));
}
