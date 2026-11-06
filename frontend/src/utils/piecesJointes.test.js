import {
  TYPES_PIECE,
  devinerTypePiece,
  extensionCourte,
  formaterTaille,
  libelleTypePiece,
  nomAjoutePar,
  nomUtilisateur,
  optionsTypePiece,
} from './piecesJointes'

// Faux t() : renvoie la clé, ce qui suffit à vérifier QUELLE clé est demandée.
const t = (cle) => cle

describe('libelleTypePiece', () => {
  test('chaque type connu a sa clé', () => {
    expect(libelleTypePiece(t, 'paiement')).toBe('piecesJointes.type_paiement')
    expect(libelleTypePiece(t, 'facture')).toBe('piecesJointes.type_facture')
  })

  test("un type inconnu retombe sur « Autre » plutôt que d'afficher une clé crue", () => {
    // Cas réel : les pièces déposées avant l'existence du champ type_piece.
    expect(libelleTypePiece(t, null)).toBe('piecesJointes.type_autre')
    expect(libelleTypePiece(t, 'nimportequoi')).toBe('piecesJointes.type_autre')
  })
})

describe('optionsTypePiece', () => {
  test('propose tous les types, dans l ordre du catalogue', () => {
    expect(optionsTypePiece(t).map((o) => o.value)).toEqual(TYPES_PIECE)
  })
})

describe('devinerTypePiece', () => {
  test('reconnaît une facture, un reçu, un scan', () => {
    expect(devinerTypePiece('Facture_octobre.pdf')).toBe('facture')
    expect(devinerTypePiece('invoice-2026.pdf')).toBe('facture')
    expect(devinerTypePiece('quittance_loyer.pdf')).toBe('recu')
    expect(devinerTypePiece('scan_lettre_ars.pdf')).toBe('courrier')
  })

  test('par défaut une preuve de paiement, le cas le plus courant', () => {
    expect(devinerTypePiece('capture.png')).toBe('paiement')
    expect(devinerTypePiece('')).toBe('paiement')
  })

  test('ne propose jamais un type refusé par le serveur', () => {
    const noms = ['facture.pdf', 'recu.pdf', 'scan.pdf', 'autre-chose.pdf', '']
    noms.forEach((nom) => expect(TYPES_PIECE).toContain(devinerTypePiece(nom)))
  })
})

describe('formaterTaille', () => {
  test('passe en mégaoctets au-delà du mégaoctet', () => {
    expect(formaterTaille(1_258_291)).toBe('1,2 Mo')
  })

  test('arrondit en kilooctets en dessous', () => {
    expect(formaterTaille(184_320)).toBe('180 Ko')
  })

  test('un fichier minuscule affiche 1 Ko, pas 0', () => {
    expect(formaterTaille(120)).toBe('1 Ko')
  })

  test('une taille absente ou absurde ne produit pas « NaN »', () => {
    expect(formaterTaille(null)).toBe('—')
    expect(formaterTaille(0)).toBe('—')
    expect(formaterTaille('abc')).toBe('—')
  })
})

describe('extensionCourte', () => {
  test("prend la DERNIÈRE extension, pas la première", () => {
    expect(extensionCourte('virement.loyer.pdf')).toBe('PDF')
  })

  test('tronque une extension interminable', () => {
    expect(extensionCourte('fichier.numbersheet')).toBe('NUMB')
  })

  test('un nom sans extension ne casse rien', () => {
    expect(extensionCourte('fichier')).toBe('?')
    expect(extensionCourte(null)).toBe('?')
  })
})

describe('nomAjoutePar', () => {
  test('préfère le nom du salarié à l identifiant de connexion', () => {
    const piece = { ajoute_par: { nom: 'jnono', personnels: [{ prenom: 'Jordan', nom: 'NONO' }] } }
    expect(nomAjoutePar(piece)).toBe('Jordan NONO')
  })

  test('retombe sur l identifiant quand aucune fiche personnel n est liée', () => {
    expect(nomAjoutePar({ ajoute_par: { nom: 'jnono', personnels: [] } })).toBe('jnono')
  })

  test('une pièce d avant ce champ renvoie le repli, pas « undefined »', () => {
    expect(nomAjoutePar({ ajoute_par: null }, 'Inconnu')).toBe('Inconnu')
    expect(nomAjoutePar({})).toBe('')
  })

  test("nomUtilisateur sert aussi à l'auteur d'une décision, pas qu'aux pièces", () => {
    expect(nomUtilisateur({ nom: 'mkone', personnels: [{ prenom: 'Marie', nom: 'KONE' }] })).toBe('Marie KONE')
    expect(nomUtilisateur(null, 'Utilisateur')).toBe('Utilisateur')
  })
})
