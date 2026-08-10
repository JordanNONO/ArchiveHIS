import { getDisplayName, getInitials, bordureStatutClass, bordureDocumentClass, infoDelaiCorrection, pourcentageTempsRestant } from './common'

describe('getDisplayName', () => {
  test('utilise le nom/prénom de la fiche Personnel quand il existe', () => {
    expect(getDisplayName({ nom: 'compte-technique', personnel: { prenom: 'Jordan', nom: 'Nono' } })).toBe('Jordan Nono')
  })

  test('retombe sur le champ nom du compte si aucune fiche Personnel', () => {
    expect(getDisplayName({ nom: 'Jordan Nono' })).toBe('Jordan Nono')
  })

  test('gère un utilisateur absent sans lever d\'erreur', () => {
    expect(getDisplayName(null)).toBe('')
    expect(getDisplayName(undefined)).toBe('')
  })
})

describe('getInitials', () => {
  test('prend la première lettre du prénom et du nom, en majuscules', () => {
    expect(getInitials('Jordan Nono')).toBe('JN')
  })

  test('gère un seul mot', () => {
    expect(getInitials('Jordan')).toBe('J')
  })

  test('gère les espaces multiples entre les mots', () => {
    expect(getInitials('Jordan   Nono')).toBe('JN')
  })

  test('retourne une chaîne vide pour une valeur vide', () => {
    expect(getInitials('')).toBe('')
    expect(getInitials(null)).toBe('')
  })
})

describe('bordureStatutClass', () => {
  test('ARCHIVE prend sa propre couleur côté interne', () => {
    expect(bordureStatutClass('ARCHIVE', false)).toContain('border-l-neutral-800')
  })

  // Côté externe (intervenant/bénéficiaire), ARCHIVE et VALIDE_ET_TRAITE se
  // confondent visuellement — le circuit d'archivage interne ne le regarde pas.
  test('ARCHIVE prend la couleur de VALIDE_ET_TRAITE côté externe', () => {
    expect(bordureStatutClass('ARCHIVE', true)).toBe(bordureStatutClass('VALIDE_ET_TRAITE', true))
  })

  test('un statut inconnu retombe sur une bordure transparente', () => {
    expect(bordureStatutClass('STATUT_INEXISTANT')).toContain('border-l-transparent')
  })
})

describe('infoDelaiCorrection', () => {
  test('retourne null sans date limite', () => {
    expect(infoDelaiCorrection({})).toBeNull()
    expect(infoDelaiCorrection(null)).toBeNull()
  })

  test('détecte un délai encore valide (dans le futur)', () => {
    const dansDeuxJours = new Date(Date.now() + 2 * 86400000).toISOString()
    const info = infoDelaiCorrection({ date_limite_correction: dansDeuxJours })
    expect(info.enRetard).toBe(false)
    expect(info.jours).toBeGreaterThanOrEqual(1)
  })

  test('détecte un délai dépassé (dans le passé)', () => {
    const hierEtDemi = new Date(Date.now() - 1.5 * 86400000).toISOString()
    const info = infoDelaiCorrection({ date_limite_correction: hierEtDemi })
    expect(info.enRetard).toBe(true)
    expect(info.texte).toMatch(/^En retard/)
  })
})

describe('bordureDocumentClass', () => {
  // Un rejet dont le délai de correction (3 jours) est dépassé bascule en noir
  // fixe — il reste "à traiter" mais sans le même niveau d'urgence visuelle
  // qu'un rejet tout frais (voir le commentaire de la fonction).
  test('un rejet avec délai dépassé bascule en bordure noire fixe', () => {
    const hier = new Date(Date.now() - 86400000).toISOString()
    const classe = bordureDocumentClass({ status_doc: 'INCOMPLET_REJETE', date_limite_correction: hier })
    expect(classe).toBe('border-l-4 border-l-neutral-800')
  })

  test('un rejet encore dans les temps garde le scintillement d\'alerte', () => {
    const demain = new Date(Date.now() + 86400000).toISOString()
    const classe = bordureDocumentClass({ status_doc: 'INCOMPLET_REJETE', date_limite_correction: demain })
    expect(classe).toContain('animate-scintille-rejet')
  })
})

describe('pourcentageTempsRestant', () => {
  test('retourne null sans dates de suivi', () => {
    expect(pourcentageTempsRestant(null)).toBeNull()
    expect(pourcentageTempsRestant({})).toBeNull()
  })

  test('retourne 0 si l\'échéance est déjà dépassée', () => {
    const suivi = {
      etape_demarree_le: new Date(Date.now() - 10 * 86400000).toISOString(),
      echeance_le: new Date(Date.now() - 1000).toISOString(),
    }
    expect(pourcentageTempsRestant(suivi)).toBe(0)
  })

  test('retourne une valeur entre 0 et 1 à mi-parcours', () => {
    const suivi = {
      etape_demarree_le: new Date(Date.now() - 5000).toISOString(),
      echeance_le: new Date(Date.now() + 5000).toISOString(),
    }
    const ratio = pourcentageTempsRestant(suivi)
    expect(ratio).toBeGreaterThan(0)
    expect(ratio).toBeLessThanOrEqual(1)
  })
})
