import { LuMessageSquare, LuWallet, LuCalendarClock, LuFileStack, LuFileQuestion, LuPlusCircle, LuMegaphone, LuHeartPulse, LuShieldAlert, LuUserX, LuStar, LuCalendarX2, LuClock4, LuUserX2 } from 'react-icons/lu'

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
 *
 * `profils` restreint l'entrée à certains rôles (Intervenant/Beneficiaire) —
 * absent = visible des deux (ex: Réclamation, Autres). Un bénéficiaire n'étant
 * pas salarié, Congés/Fiche de paie ne lui sont pas proposés.
 */
export const TYPES_DE_DEMANDE = [
  // La fiche papier (FICHE DE RECLAMATION) sert aux deux profils — case
  // "Client"/"Salarié" cochée automatiquement selon le compte connecté, voir
  // ReclamationForm.jsx.
  { id: 'reclamation', label: 'Réclamation', code: 'REC', icon: LuMessageSquare, categorieCode: 'GestionbenSecteur', typeLibelle: 'Réclamation', profils: ['Intervenant', 'Beneficiaire'] },
  // Point d'entrée unique — le choix du type précis (Incident, Maltraitance,
  // Retard/Absence, Qualité, Annulation) se fait comme première étape du
  // parcours séquentiel lui-même, pas via une page de choix intermédiaire —
  // voir SignalementForm.jsx et SOUS_TYPES_SIGNALEMENT ci-dessous.
  { id: 'signalement', label: 'Signalement', code: 'SIG', icon: LuMegaphone, categorieCode: 'GestionbenSecteur', profils: ['Beneficiaire'] },
  { id: 'paie', label: 'Fiche de paie', code: 'FP', icon: LuWallet, categorieCode: 'ContratDossier', typeLibelle: 'Fiche de paie (dépôt)', profils: ['Intervenant'] },
  { id: 'conges', label: 'Congés', code: 'CNG', icon: LuCalendarClock, categorieCode: 'CongesAbsences', typeLibelle: 'Demande de congés', profils: ['Intervenant'] },
  { id: 'administratif', label: 'Document administratif', code: 'DA', icon: LuFileStack, categorieCode: 'ContratDossier', typeLibelle: 'Document administratif', profils: ['Intervenant'] },
  { id: 'document', label: 'Document', code: 'DOC', icon: LuFileStack, categorieCode: 'ContratDossier', typeLibelle: 'Document administratif', profils: ['Beneficiaire'] },
  // Trois parcours autonomes distincts (chacun son propre écran/route), mais
  // regroupés visuellement sur le tableau de bord dans un seul bloc à 3
  // cases en surbrillance bleue — même style que le choix d'objet de
  // Réclamation (voir `groupeTuile`/tuilesDuTableauDeBord ci-dessous et le
  // rendu dans EspaceIntervenant.jsx). Modifier/supprimer une prestation déjà
  // envoyée se fait par glissement sur sa ligne dans "Déjà envoyés dans ce
  // dossier" (façon messagerie) — voir EspaceDossier.jsx / SwipeActions.jsx.
  {
    id: 'prestation', label: 'Créer une prestation', code: 'PR', icon: LuPlusCircle,
    categorieCode: 'GestionbenSecteur', typeLibelle: 'Demande de prestation', profils: ['Beneficiaire'],
    groupeTuile: 'prestation',
  },
  {
    id: 'prestation-annulation', label: 'Annuler une prestation', code: 'ANN', icon: LuCalendarX2,
    categorieCode: 'GestionbenSecteur', typeLibelle: 'Annulation de prestation', profils: ['Beneficiaire'],
    groupeTuile: 'prestation',
  },
  {
    id: 'prestation-qualite', label: 'Qualité de la prestation', code: 'SIQ', icon: LuStar,
    categorieCode: 'GestionbenSecteur', typeLibelle: 'Signalement de qualité de la prestation', profils: ['Beneficiaire'],
    groupeTuile: 'prestation',
  },
  { id: 'autres', label: 'Autres', code: 'AUT', icon: LuFileQuestion, categorieCode: 'ContratDossier', typeLibelle: 'Autre document', messageObligatoire: true },
]

/** Libellé affiché en tête du bloc regroupant plusieurs tuiles (voir `groupeTuile` ci-dessus). */
const LIBELLES_GROUPE_TUILE = {
  prestation: 'Prestation',
}

/**
 * Sous-types de Signalement — chacun garde son propre categorie/typeLibelle
 * réel (mêmes TypeDocument déjà en base), mais n'apparaît plus comme une
 * entrée séparée du tableau de bord : c'est SignalementForm.jsx qui les
 * propose comme première étape de son parcours. `capturePhotoDirecte`,
 * `choixSousType` et `notation` pilotent la vue intermédiaire propre à
 * chaque sous-type (voir SignalementForm.jsx).
 */
export const SOUS_TYPES_SIGNALEMENT = [
  {
    // Photo seulement (pas de vidéo, voir DocumentController::store()) —
    // proposée en capture caméra directe plutôt qu'un simple choix de
    // fichier, voir SignalementForm.jsx.
    id: 'signalement-incident', label: 'Incident ou accident', code: 'SIA', icon: LuHeartPulse,
    categorieCode: 'GestionbenSecteur', typeLibelle: "Signalement d'incident ou accident",
    capturePhotoDirecte: true,
  },
  {
    // Pas de pièce jointe ici (contrairement à Incident) — message ou vocal
    // uniquement.
    id: 'signalement-maltraitance', label: 'Maltraitance ou comportement inapproprié', code: 'SIM', icon: LuShieldAlert,
    categorieCode: 'GestionbenSecteur', typeLibelle: 'Signalement de maltraitance ou comportement inapproprié',
  },
  {
    // Purement factuel (qui, quand) — juste le choix retard/absence puis un
    // message/vocal.
    id: 'signalement-retard', label: "Retard ou absence de l'intervenant", code: 'SIR', icon: LuUserX,
    categorieCode: 'GestionbenSecteur', typeLibelle: "Signalement de retard ou absence de l'intervenant",
    choixSousType: {
      question: "De quoi s'agit-il ?",
      options: [
        { valeur: 'retard', label: 'Retard', libelleLong: "Retard de l'intervenant", icon: LuClock4 },
        { valeur: 'absence', label: 'Absence', libelleLong: "Absence de l'intervenant", icon: LuUserX2 },
      ],
    },
  },
]

export function trouverTypeDemande(id) {
  return TYPES_DE_DEMANDE.find((t) => t.id === id) || null
}

/** Les entrées visibles pour un rôle donné (Intervenant/Beneficiaire). */
export function demandesPourProfil(role) {
  return TYPES_DE_DEMANDE.filter((t) => !t.profils || t.profils.includes(role))
}

/**
 * Tuiles à afficher sur le tableau de bord / la barre latérale pour un rôle
 * donné. Les entrées partageant un `groupeTuile` (voir "Créer/Annuler/Qualité
 * de la prestation" ci-dessus) sont regroupées en une seule tuile `groupe`
 * avec ses `membres` — chacun garde sa propre route/écran, seule la
 * présentation les rassemble (voir EspaceIntervenant.jsx).
 */
export function tuilesDuTableauDeBord(role) {
  const visibles = demandesPourProfil(role)
  const tuiles = []
  const groupesVus = new Set()
  for (const demande of visibles) {
    if (demande.groupeTuile) {
      if (groupesVus.has(demande.groupeTuile)) continue
      groupesVus.add(demande.groupeTuile)
      const membres = visibles.filter((d) => d.groupeTuile === demande.groupeTuile)
      tuiles.push({
        id: demande.groupeTuile,
        groupe: true,
        label: LIBELLES_GROUPE_TUILE[demande.groupeTuile] || demande.groupeTuile,
        membres: membres.map((m) => ({ id: m.id, label: m.label, icon: m.icon, to: `/espace/${m.id}` })),
      })
    } else {
      tuiles.push({ id: demande.id, label: demande.label, icon: demande.icon, ids: [demande.id], to: `/espace/${demande.id}` })
    }
  }
  return tuiles
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

function correspond(entree, document, categories, typesParCategorie) {
  const categorie = categories.find((c) => c.code === entree.categorieCode)
  const type = typesParCategorie[entree.categorieCode]?.find((t) => t.libelle === entree.typeLibelle)
  return !!categorie && !!type && document.categorie_id === categorie.id && document.type_document_id === type.id
}

/**
 * Un document déposé appartient à quel type de demande, à partir de ses
 * categorie_id/type_document_id réels (pour filtrer "mes dépôts" par dossier).
 * Un document issu d'un sous-type de Signalement remonte à l'entrée chapeau
 * 'signalement' (voir SOUS_TYPES_SIGNALEMENT ci-dessus) — Prestation n'en a
 * pas besoin, ses 3 parcours sont des entrées TYPES_DE_DEMANDE normales.
 */
export function typeDemandeDuDocument(document, categories, typesParCategorie) {
  const trouve = TYPES_DE_DEMANDE.find((demande) => demande.typeLibelle && correspond(demande, document, categories, typesParCategorie))
  if (trouve) return trouve
  const sousType = SOUS_TYPES_SIGNALEMENT.find((st) => correspond(st, document, categories, typesParCategorie))
  return sousType ? { id: 'signalement' } : null
}
