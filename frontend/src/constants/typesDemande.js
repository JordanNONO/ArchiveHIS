import { LuMessageSquare, LuWallet, LuCalendarClock, LuFileStack, LuFileQuestion } from 'react-icons/lu'

/**
 * Destinations fixes proposées à un intervenant/bénéficiaire, affichées comme des
 * "dossiers" dans la barre latérale et le tableau de bord — plus simple que de
 * naviguer l'arborescence complète des catégories internes, qu'ils ne connaissent
 * pas. Tout remonte à la RH (categorieCode RH uniquement), y compris la paie —
 * c'est à la RH de redistribuer en interne (ex: vers la Comptabilité) une fois le
 * dossier reçu, pas au déposant de deviner le bon service. Chaque entrée est
 * résolue vers une vraie catégorie/type existant par code/libellé, pas par ID en
 * dur (ceux-ci peuvent changer d'un environnement à l'autre) — voir
 * resoudreDestinationDemande().
 */
export const TYPES_DE_DEMANDE = [
  { id: 'reclamation', label: 'Réclamation', code: 'REC', icon: LuMessageSquare, categorieCode: 'GestionbenSecteur', typeLibelle: 'Réclamation' },
  { id: 'paie', label: 'Fiche de paie', code: 'FP', icon: LuWallet, categorieCode: 'ContratDossier', typeLibelle: 'Fiche de paie (dépôt)' },
  { id: 'conges', label: 'Congés', code: 'CNG', icon: LuCalendarClock, categorieCode: 'CongesAbsences', typeLibelle: 'Demande de congés' },
  { id: 'administratif', label: 'Document administratif', code: 'DA', icon: LuFileStack, categorieCode: 'ContratDossier', typeLibelle: 'Document administratif' },
  { id: 'autres', label: 'Autres', code: 'AUT', icon: LuFileQuestion, categorieCode: 'ContratDossier', typeLibelle: 'Autre document', messageObligatoire: true },
]

export function trouverTypeDemande(id) {
  return TYPES_DE_DEMANDE.find((t) => t.id === id) || null
}

/**
 * Résout un type de demande vers son vrai categorie_id/type_document_id, à
 * partir des catégories/types déjà chargés (voir chargerTypesParCategorie ci-dessous).
 */
export function resoudreDestinationDemande(demande, categories, typesParCategorie) {
  if (!demande) return null
  const categorie = categories.find((c) => c.code === demande.categorieCode)
  const type = typesParCategorie[demande.categorieCode]?.find((t) => t.libelle === demande.typeLibelle)
  if (!categorie || !type) return null
  return { categorie_id: categorie.id, type_document_id: type.id }
}

/**
 * Un document déposé appartient à quel type de demande, à partir de ses
 * categorie_id/type_document_id réels (pour filtrer "mes dépôts" par dossier).
 */
export function typeDemandeDuDocument(document, categories, typesParCategorie) {
  return TYPES_DE_DEMANDE.find((demande) => {
    const categorie = categories.find((c) => c.code === demande.categorieCode)
    const type = typesParCategorie[demande.categorieCode]?.find((t) => t.libelle === demande.typeLibelle)
    return categorie && type && document.categorie_id === categorie.id && document.type_document_id === type.id
  }) || null
}
