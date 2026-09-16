// Mêmes clés i18n que DocView.jsx (panneau de détail) — un seul jeu de
// libellés pour ce enum dans toute l'appli, pas un texte différent par écran.
export const NIVEAU_CONFIDENTIALITE_KEYS = {
  PUBLIC: 'docView.niveauPublic',
  INTERNE: 'docView.niveauInterne',
  CONFIDENTIEL: 'docView.niveauConfidentiel',
  STRICTEMENT_CONFIDENTIEL: 'docView.niveauStrictementConfidentiel',
};

// INTERNE volontairement absent : c'est la valeur par défaut de l'immense
// majorité des documents — lui donner une pastille comme aux autres noierait
// les niveaux qui méritent vraiment d'attirer l'œil dans une liste.
const TEINTES = {
  PUBLIC: { badge: 'bg-sky-500/10 text-sky-700', pastille: 'bg-sky-600' },
  CONFIDENTIEL: { badge: 'bg-amber-500/10 text-amber-700', pastille: 'bg-amber-600' },
  STRICTEMENT_CONFIDENTIEL: { badge: 'bg-destructive/10 text-destructive', pastille: 'bg-destructive' },
};

/** Classes Tailwind pour un badge texte, ou null si ce niveau ne doit pas en afficher un (INTERNE, absent). */
export function teinteConfidentialite(niveau) {
  return TEINTES[niveau]?.badge || null;
}

/** Classe Tailwind (fond uni) pour une simple pastille de couleur, même règle que teinteConfidentialite(). */
export function pastilleConfidentialite(niveau) {
  return TEINTES[niveau]?.pastille || null;
}
