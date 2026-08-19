import i18n from '../i18n'

// Miroir JS de StatutDocument::groupe() côté backend (voir
// backend/app/Enums/StatutDocument.php) — reste synchronisé à la main, les
// deux listes de statuts changent rarement.
const STATUTS_ATTENTION = ['INCOMPLET_REJETE', 'EXPIRE_A_PURGER']
const STATUTS_TRAITE = ['VALIDE_ET_TRAITE', 'ARCHIVE']

/**
 * Groupe (attention/en_cours/traite) d'un statut de document isolé — utilisé
 * pour filtrer une liste de documents par statut (voir DossierToolbar), même
 * logique que compterParGroupeStatut() mais pour un seul document à la fois.
 */
export function groupeDeStatut(statutDoc) {
  if (STATUTS_ATTENTION.includes(statutDoc)) return 'attention'
  if (STATUTS_TRAITE.includes(statutDoc)) return 'traite'
  return 'en_cours'
}

/**
 * Répartit une liste de documents déjà chargés par groupe de statut — pour
 * les cas où le compte n'arrive pas déjà calculé par le backend (ex: les
 * sous-dossiers "Bénéficiaire/Intervenant/Autre" d'OpenFolder.jsx, qui
 * n'existent pas côté base, seulement recalculés côté client à partir des
 * documents déjà en mémoire).
 */
export function compterParGroupeStatut(documents) {
  let enAttente = 0
  let enCours = 0
  let traites = 0
  for (const d of documents) {
    if (STATUTS_ATTENTION.includes(d.status_doc)) enAttente++
    else if (STATUTS_TRAITE.includes(d.status_doc)) traites++
    else enCours++
  }
  return { enAttente, enCours, traites }
}

/**
 * Le statut agrégé d'un dossier/sous-dossier, façon feu tricolore — même
 * logique de priorité que `getFolderBadgeTone()` (Home.jsx) à l'origine,
 * généralisée pour être réutilisée telle quelle par OpenFolder.jsx (dont les
 * compteurs peuvent venir du backend — categorie/type — ou être recalculés
 * côté client — voir compterParGroupeStatut() ci-dessus).
 */
export function toneDossier({ enAttente = 0, enCours = 0, traites = 0 }) {
  if (enAttente > 0) {
    return {
      bordure: 'border-l-destructive', point: 'bg-destructive', texte: 'text-destructive',
      label: i18n.t('statutGroupe.aTraiterRejeteExpire', { count: enAttente }),
    }
  }
  if (enCours > 0) {
    return {
      bordure: 'border-l-accent', point: 'bg-accent', texte: 'text-accent',
      label: i18n.t('statutGroupe.pasEncoreTraites', { count: enCours }),
    }
  }
  if (traites > 0) {
    return {
      bordure: 'border-l-green-500', point: 'bg-green-500', texte: 'text-green-600',
      label: i18n.t('statutGroupe.tousTraites'),
    }
  }
  return {
    bordure: 'border-l-border', point: 'bg-muted-foreground/40', texte: 'text-muted-foreground',
    label: i18n.t('statutGroupe.aucunDocument'),
  }
}
