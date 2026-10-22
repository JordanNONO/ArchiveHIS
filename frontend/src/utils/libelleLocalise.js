/**
 * Les noms de catégories/sous-dossiers sont des données saisies par l'admin
 * (pas du texte fixe de l'appli) — non traduisibles via i18n statique. Une
 * traduction anglaise optionnelle peut être saisie par dossier (voir
 * Settings > Catégories, et le "Modifier" d'un sous-dossier dans
 * OpenFolder.jsx) et stockée à côté du libellé français
 * (`libelle_cat_en`/`libelle_en`, voir la migration correspondante). Tant
 * qu'aucune traduction n'est saisie, on retombe silencieusement sur le
 * français — jamais de texte manquant à l'écran.
 */
export function nomCategorie(categorie, langue) {
  if (!categorie) return ''
  return langue?.startsWith('en') && categorie.libelle_cat_en ? categorie.libelle_cat_en : (categorie.libelle_cat || '')
}

export function nomType(type, langue) {
  if (!type) return ''
  return langue?.startsWith('en') && type.libelle_en ? type.libelle_en : (type.libelle || '')
}

/**
 * Libellé affiché d'un rôle. Les noms en base ("Administrator", "Editor",
 * "Viewer", "Beneficiaire") servent aussi de clés dans le code (ROLES_DEPOT,
 * estAdministrateur()...) : on ne les renomme pas, on traduit seulement à
 * l'affichage. Un rôle créé par l'admin garde son nom tel quel.
 */
const LIBELLES_ROLES_FR = {
  Administrator: 'Administrateur',
  Editor: 'Éditeur',
  Viewer: 'Lecteur',
  Beneficiaire: 'Bénéficiaire',
}

export function nomRole(role) {
  const nom = typeof role === 'string' ? role : role?.nom
  if (!nom) return ''
  return LIBELLES_ROLES_FR[nom] || nom
}
