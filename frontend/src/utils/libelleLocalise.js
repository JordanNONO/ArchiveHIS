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
