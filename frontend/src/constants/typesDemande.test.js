import {
  TYPES_DE_DEMANDE,
  SOUS_TYPES_SIGNALEMENT,
  trouverTypeDemande,
  demandesPourProfil,
  tuilesDuTableauDeBord,
  resoudreDestinationDemande,
  typeDemandeDuDocument,
} from './typesDemande'

const CATEGORIES = [
  { id: 1, code: 'GestionbenSecteur' },
  { id: 2, code: 'ContratDossier' },
]

const TYPES_PAR_CATEGORIE = {
  GestionbenSecteur: [
    { id: 10, libelle: 'Réclamation' },
    { id: 11, libelle: "Signalement d'incident ou accident" },
    { id: 12, libelle: 'Demande de prestation' },
  ],
  ContratDossier: [
    { id: 20, libelle: 'Fiche de paie (dépôt)' },
  ],
}

describe('trouverTypeDemande', () => {
  test('retrouve une entrée par son id', () => {
    expect(trouverTypeDemande('reclamation')?.id).toBe('reclamation')
  })

  test('retourne null pour un id inconnu', () => {
    expect(trouverTypeDemande('n-existe-pas')).toBeNull()
  })
})

describe('demandesPourProfil', () => {
  test('un bénéficiaire ne voit pas les congés (réservés aux salariés)', () => {
    const ids = demandesPourProfil('Beneficiaire').map((d) => d.id)
    expect(ids).not.toContain('conges')
    expect(ids).toContain('signalement')
  })

  test('un intervenant ne voit pas le signalement (réservé au bénéficiaire)', () => {
    const ids = demandesPourProfil('Intervenant').map((d) => d.id)
    expect(ids).not.toContain('signalement')
    expect(ids).toContain('conges')
  })

  test('réclamation est visible des deux profils', () => {
    expect(demandesPourProfil('Intervenant').some((d) => d.id === 'reclamation')).toBe(true)
    expect(demandesPourProfil('Beneficiaire').some((d) => d.id === 'reclamation')).toBe(true)
  })
})

describe('tuilesDuTableauDeBord', () => {
  test('une tuile par entrée visible, sans regroupement (signalement est un point d\'entrée unique)', () => {
    const tuiles = tuilesDuTableauDeBord('Beneficiaire')
    const signalement = tuiles.find((t) => t.id === 'signalement')
    expect(signalement).toBeDefined()
    expect(signalement.to).toBe('/espace/signalement')
    expect(signalement.ids).toEqual(['signalement'])
  })

  // Créer/Annuler/Qualité de la prestation sont 3 parcours autonomes (chacun
  // sa propre route), mais regroupés en une seule tuile "groupe" sur le
  // tableau de bord — voir EspaceIntervenant.jsx.
  test('Créer/Annuler/Qualité de la prestation sont regroupées en une seule tuile "groupe"', () => {
    const tuiles = tuilesDuTableauDeBord('Beneficiaire')
    const prestationTuiles = tuiles.filter((t) => t.id === 'prestation' || t.membres?.some((m) => m.id.startsWith('prestation')))
    expect(prestationTuiles).toHaveLength(1)
    const groupe = prestationTuiles[0]
    expect(groupe.groupe).toBe(true)
    expect(groupe.membres.map((m) => m.id)).toEqual(['prestation', 'prestation-annulation', 'prestation-qualite'])
    groupe.membres.forEach((m) => expect(m.to).toBe(`/espace/${m.id}`))
  })

  test('ne regroupe pas des entrées sans groupeTuile en commun', () => {
    const tuiles = tuilesDuTableauDeBord('Beneficiaire')
    expect(tuiles.filter((t) => t.groupe)).toHaveLength(1)
  })
})

describe('resoudreDestinationDemande', () => {
  test('résout vers le vrai categorie_id/type_document_id via categorieCode/typeLibelle', () => {
    const demande = trouverTypeDemande('reclamation')
    const destination = resoudreDestinationDemande(demande, CATEGORIES, TYPES_PAR_CATEGORIE)
    expect(destination).toEqual({ categorie_id: 1, type_document_id: 10 })
  })

  test('retourne null si la catégorie ou le type n\'est pas encore chargé', () => {
    const demande = trouverTypeDemande('reclamation')
    expect(resoudreDestinationDemande(demande, [], {})).toBeNull()
  })

  test('retourne null sans demande', () => {
    expect(resoudreDestinationDemande(null, CATEGORIES, TYPES_PAR_CATEGORIE)).toBeNull()
  })

  test('résout aussi un sous-type de signalement (pas seulement une entrée de TYPES_DE_DEMANDE)', () => {
    const sousType = SOUS_TYPES_SIGNALEMENT.find((s) => s.id === 'signalement-incident')
    const destination = resoudreDestinationDemande(sousType, CATEGORIES, TYPES_PAR_CATEGORIE)
    expect(destination).toEqual({ categorie_id: 1, type_document_id: 11 })
  })
})

describe('typeDemandeDuDocument', () => {
  test('retrouve le type de demande à partir des categorie_id/type_document_id réels', () => {
    const document = { categorie_id: 1, type_document_id: 10 }
    expect(typeDemandeDuDocument(document, CATEGORIES, TYPES_PAR_CATEGORIE)?.id).toBe('reclamation')
  })

  // Régression directe : un document issu d'un sous-type de signalement (ex:
  // "Signalement d'incident ou accident") doit remonter au point d'entrée
  // chapeau 'signalement' pour que les compteurs du tableau de bord
  // (EspaceIntervenant.jsx) le comptent dans la bonne tuile.
  test('un document de sous-type signalement remonte à l\'entrée chapeau "signalement"', () => {
    const document = { categorie_id: 1, type_document_id: 11 }
    expect(typeDemandeDuDocument(document, CATEGORIES, TYPES_PAR_CATEGORIE)?.id).toBe('signalement')
  })

  test('retourne null pour un document qui ne correspond à aucun type de demande connu', () => {
    const document = { categorie_id: 99, type_document_id: 99 }
    expect(typeDemandeDuDocument(document, CATEGORIES, TYPES_PAR_CATEGORIE)).toBeNull()
  })
})

test('chaque type de demande référence une catégorie/type existants (garde-fou de cohérence des données)', () => {
  expect(TYPES_DE_DEMANDE.length).toBeGreaterThan(0)
  TYPES_DE_DEMANDE.forEach((demande) => {
    expect(demande.id).toBeTruthy()
    expect(demande.categorieCode).toBeTruthy()
  })
})
