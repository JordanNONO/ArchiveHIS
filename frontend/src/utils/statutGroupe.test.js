import { compterParGroupeStatut, toneDossier } from './statutGroupe'

describe('compterParGroupeStatut', () => {
  test('répartit correctement chaque statut dans son groupe', () => {
    const docs = [
      { status_doc: 'INCOMPLET_REJETE' },
      { status_doc: 'EXPIRE_A_PURGER' },
      { status_doc: 'SOUMIS' },
      { status_doc: 'TRANSMIS_AU_SERVICE' },
      { status_doc: 'VALIDE_ET_TRAITE' },
      { status_doc: 'ARCHIVE' },
    ]
    expect(compterParGroupeStatut(docs)).toEqual({ enAttente: 2, enCours: 2, traites: 2 })
  })

  test('une liste vide retourne des compteurs à zéro', () => {
    expect(compterParGroupeStatut([])).toEqual({ enAttente: 0, enCours: 0, traites: 0 })
  })
})

describe('toneDossier', () => {
  // Priorité façon feu tricolore : un seul document "à traiter" suffit à
  // faire passer tout le dossier au rouge, même si la majorité est traitée.
  test('priorité au rouge (attention) dès qu\'il y en a un', () => {
    const tone = toneDossier({ enAttente: 1, enCours: 5, traites: 10 })
    expect(tone.bordure).toBe('border-l-destructive')
    expect(tone.label).toContain('à traiter')
  })

  test('orange (en cours) si aucun en attente mais au moins un pas traité', () => {
    const tone = toneDossier({ enAttente: 0, enCours: 2, traites: 3 })
    expect(tone.bordure).toBe('border-l-accent')
  })

  test('vert (traité) uniquement si tout est traité', () => {
    const tone = toneDossier({ enAttente: 0, enCours: 0, traites: 4 })
    expect(tone.bordure).toBe('border-l-green-500')
  })

  test('neutre si le dossier est vide', () => {
    const tone = toneDossier({ enAttente: 0, enCours: 0, traites: 0 })
    expect(tone.bordure).toBe('border-l-border')
    expect(tone.label).toBe('Aucun document')
  })

  test('fonctionne sans argument (tous les compteurs par défaut à 0)', () => {
    expect(toneDossier({}).label).toBe('Aucun document')
  })
})
