import {
  RACCOURCIS,
  estAutorise,
  estToucheSimple,
  etatRaccourci,
  morceauxSignature,
  normaliserTouche,
  raccourciEnConflit,
  refusDeTouche,
  signatureEffective,
  signatureEvenement,
  touchesPhysiques,
} from './raccourcis'

const TOUT = { hasPermission: () => true, isAdministrator: true }
const RIEN = { hasPermission: () => false, isAdministrator: false }

/** Faux évènement clavier, juste ce que lit signatureEvenement(). */
function touche(key, { ctrl = false, shift = false, meta = false } = {}) {
  return { key, ctrlKey: ctrl, shiftKey: shift, metaKey: meta }
}

describe('catalogue', () => {
  test('aucune signature en double dans un même contexte', () => {
    const vus = new Map()
    RACCOURCIS.forEach((r) => {
      const cle = `${r.contexte}:${r.signature}`
      expect(vus.has(cle)).toBe(false)
      vus.set(cle, r.id)
    })
  })

  test("les contextes toujours actifs ne se marchent pas sur les pieds", () => {
    // 'global' et 'navigation' répondent partout : leurs signatures ne
    // peuvent donc pas être reprises par un contexte plus étroit.
    const partout = RACCOURCIS.filter((r) => ['global', 'navigation'].includes(r.contexte)).map((r) => r.signature)
    const ailleurs = RACCOURCIS.filter((r) => !['global', 'navigation'].includes(r.contexte)).map((r) => r.signature)
    expect(partout.filter((s) => ailleurs.includes(s))).toEqual([])
  })

  test('chaque identifiant est unique', () => {
    const ids = RACCOURCIS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('signatureEvenement', () => {
  test('une lettre seule est minuscule', () => {
    expect(signatureEvenement(touche('T'))).toBe('t')
  })

  test('Ctrl et Cmd donnent la même signature', () => {
    expect(signatureEvenement(touche('k', { ctrl: true }))).toBe('ctrl+k')
    expect(signatureEvenement(touche('k', { meta: true }))).toBe('ctrl+k')
  })

  test("Maj n'est pas noté pour un caractère : en AZERTY, « ? » EST Maj+,", () => {
    expect(signatureEvenement(touche('?', { shift: true }))).toBe('?')
  })

  test('Maj est noté pour une touche nommée', () => {
    expect(signatureEvenement(touche('ArrowUp', { shift: true }))).toBe('maj+ArrowUp')
  })

  test('la barre d espace a un nom lisible', () => {
    expect(normaliserTouche(' ')).toBe('Espace')
    expect(signatureEvenement(touche(' '))).toBe('Espace')
  })
})

describe('morceauxSignature', () => {
  test('une combinaison se lit avec un +', () => {
    expect(morceauxSignature('ctrl+Backspace')).toEqual({ liaison: '+', touches: ['Ctrl', '⌫'] })
  })

  test('un accord se lit avec « puis »', () => {
    expect(morceauxSignature('g d')).toEqual({ liaison: 'puis', touches: ['G', 'D'] })
  })
})

describe('touchesPhysiques', () => {
  test('« ? » montre Maj et la virgule, les deux touches sur lesquelles appuyer', () => {
    expect(touchesPhysiques('?')).toEqual(['Shift', ','])
  })

  test('une combinaison montre la touche de modification', () => {
    expect(touchesPhysiques('ctrl+a')).toEqual(['Control', 'a'])
  })

  test('un accord montre ses deux lettres', () => {
    expect(touchesPhysiques('g r')).toEqual(['g', 'r'])
  })
})

describe('estToucheSimple', () => {
  test('une lettre seule et un accord en sont', () => {
    expect(estToucheSimple('t')).toBe(true)
    expect(estToucheSimple('g d')).toBe(true)
  })

  test('une combinaison et une touche nommée n en sont pas', () => {
    expect(estToucheSimple('ctrl+k')).toBe(false)
    expect(estToucheSimple('Escape')).toBe(false)
    expect(estToucheSimple('ArrowUp')).toBe(false)
  })
})

describe('estAutorise', () => {
  test('un raccourci sans condition est ouvert à tout le monde', () => {
    expect(estAutorise({ id: 'x' }, RIEN)).toBe(true)
  })

  test('une permission manquante ferme le raccourci', () => {
    const rh = RACCOURCIS.find((r) => r.id === 'allerRh')
    expect(estAutorise(rh, RIEN)).toBe(false)
    expect(estAutorise(rh, TOUT)).toBe(true)
  })

  test("l'un des deux droits suffit pour Fluctuation RH, comme pour l'entrée de menu", () => {
    const rh = RACCOURCIS.find((r) => r.id === 'allerRh')
    const lecteur = { hasPermission: (c) => c === 'consulter_fluctuation_rh', isAdministrator: false }
    expect(estAutorise(rh, lecteur)).toBe(true)
  })

  test('une action d écriture exige le droit d archiver', () => {
    const corbeille = RACCOURCIS.find((r) => r.id === 'docCorbeille')
    expect(estAutorise(corbeille, RIEN)).toBe(false)
    const archiviste = { hasPermission: (c) => c === 'archiver_documents', isAdministrator: false }
    expect(estAutorise(corbeille, archiviste)).toBe(true)
  })
})

describe('signatureEffective', () => {
  test('la surcharge personnelle remplace la touche d origine', () => {
    const r = RACCOURCIS.find((x) => x.id === 'docTelecharger')
    expect(signatureEffective(r, { docTelecharger: 'y' })).toBe('y')
  })

  test('une surcharge sur un raccourci non modifiable est ignorée', () => {
    const r = RACCOURCIS.find((x) => x.id === 'recherche')
    expect(signatureEffective(r, { recherche: 'z' })).toBe('ctrl+k')
  })
})

describe('raccourciEnConflit', () => {
  test('la touche déjà prise par une autre action est détectée', () => {
    const conflit = raccourciEnConflit('n', 'docTelecharger', TOUT, {})
    expect(conflit?.id).toBe('dossierNouveau')
  })

  test('sa propre touche n est pas un conflit', () => {
    expect(raccourciEnConflit('t', 'docTelecharger', TOUT, {})).toBeNull()
  })

  test('une touche libre ne déclenche aucun conflit', () => {
    expect(raccourciEnConflit('q', 'docTelecharger', TOUT, {})).toBeNull()
  })

  test('la surcharge compte : si T est devenu Y, Y est pris', () => {
    const conflit = raccourciEnConflit('y', 'dossierNouveau', TOUT, { docTelecharger: 'y' })
    expect(conflit?.id).toBe('docTelecharger')
  })

  test('un raccourci écarté ne bloque pas sa touche', () => {
    // 'v' est listé comme volontairement écarté : il n'écoute rien, donc il
    // n'a aucune raison d'interdire la lettre à quelqu'un d'autre.
    expect(raccourciEnConflit('v', 'docTelecharger', TOUT, {})).toBeNull()
  })

  test("ce qu'on n'a pas le droit de faire ne bloque pas non plus", () => {
    expect(raccourciEnConflit('n', 'docTelecharger', RIEN, {})).toBeNull()
  })
})

describe('refusDeTouche', () => {
  test('une lettre ou un chiffre est acceptée', () => {
    expect(refusDeTouche('y')).toBeNull()
    expect(refusDeTouche('4')).toBeNull()
    expect(refusDeTouche('ctrl+y')).toBeNull()
  })

  test('les touches réservées à la saisie ou au navigateur sont refusées', () => {
    expect(refusDeTouche('Enter')).toBe('raccourcis.refusLettre')
    expect(refusDeTouche('Escape')).toBe('raccourcis.refusLettre')
    expect(refusDeTouche('ArrowUp')).toBe('raccourcis.refusLettre')
    expect(refusDeTouche('Delete')).toBe('raccourcis.refusLettre')
    expect(refusDeTouche('Espace')).toBe('raccourcis.refusLettre')
  })

  test('la lettre qui ouvre les accords est refusée seule, mais pas avec Ctrl', () => {
    expect(refusDeTouche('g')).toBe('raccourcis.refusPrefixe')
    expect(refusDeTouche('ctrl+g')).toBeNull()
  })
})

describe('etatRaccourci', () => {
  test('ce qui est déjà écouté ailleurs est dit « en service »', () => {
    expect(etatRaccourci(RACCOURCIS.find((r) => r.id === 'recherche'))).toBe('service')
    expect(etatRaccourci(RACCOURCIS.find((r) => r.id === 'docRenommer'))).toBe('service')
  })

  test('la mise à la corbeille annonce sa confirmation', () => {
    expect(etatRaccourci(RACCOURCIS.find((r) => r.id === 'docCorbeille'))).toBe('confirmation')
  })

  test('les touches écartées gardent leur propre état', () => {
    expect(etatRaccourci(RACCOURCIS.find((r) => r.id === 'ecarteSuppr'))).toBe('ecarte')
    expect(etatRaccourci(RACCOURCIS.find((r) => r.id === 'ecarteValider'))).toBe('decider')
  })
})
