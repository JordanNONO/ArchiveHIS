import { correspondARequete, filtrerParRequete } from './recherche'

describe('correspondARequete', () => {
  test('une requête vide correspond toujours', () => {
    expect(correspondARequete(['Fiche de paie'], '')).toBe(true)
    expect(correspondARequete(['Fiche de paie'], '   ')).toBe(true)
  })

  test('correspondance simple, insensible à la casse', () => {
    expect(correspondARequete(['Fiche de paie'], 'PAIE')).toBe(true)
    expect(correspondARequete(['Fiche de paie'], 'contrat')).toBe(false)
  })

  test('plusieurs mots sans opérateur = ET implicite', () => {
    expect(correspondARequete(['Jean Dupont — Contrat de travail'], 'jean contrat')).toBe(true)
    expect(correspondARequete(['Jean Dupont — Contrat de travail'], 'jean avenant')).toBe(false)
  })

  test('opérateur OU (français et anglais)', () => {
    expect(correspondARequete(['Avenant signé'], 'contrat OU avenant')).toBe(true)
    expect(correspondARequete(['Avenant signé'], 'contrat OR avenant')).toBe(true)
    expect(correspondARequete(['Avenant signé'], 'contrat OU facture')).toBe(false)
  })

  test('phrase exacte entre guillemets : pas de tolérance aux fautes, ordre respecté', () => {
    expect(correspondARequete(['Fiche de paie de janvier'], '"fiche de paie"')).toBe(true)
    expect(correspondARequete(['Fiche de paie de janvier'], '"paie de fiche"')).toBe(false)
    // Une faute de frappe dans une phrase exacte ne doit PAS être tolérée,
    // contrairement à un mot seul.
    expect(correspondARequete(['Fiche de paie de janvier'], '"fiche de paye"')).toBe(false)
  })

  test('combinaison OU + phrase exacte', () => {
    expect(correspondARequete(['Avenant signé le 3 mars'], 'contrat OU "avenant signé"')).toBe(true)
  })

  test('tolère une faute de frappe sur un mot assez long', () => {
    expect(correspondARequete(['Réclamation de Jordan'], 'reclamaton')).toBe(true)
  })

  test('un mot très court (<3 lettres) exige une correspondance exacte, pas de tolérance', () => {
    expect(correspondARequete(['CV de Jordan'], 'cv')).toBe(true)
    expect(correspondARequete(['CV de Jordan'], 'cx')).toBe(false)
  })

  test('des champs vides/absents sont ignorés sans planter', () => {
    expect(correspondARequete([null, undefined, '', 'Congés'], 'congés')).toBe(true)
    expect(correspondARequete([null, undefined, ''], 'congés')).toBe(false)
  })

  test('les accents sont ignorés dans les deux sens', () => {
    expect(correspondARequete(['Réclamation'], 'reclamation')).toBe(true)
    expect(correspondARequete(['Elodie Martin'], 'élodie')).toBe(true)
  })

  test('un mot de 3 lettres ne tolère pas de faute', () => {
    expect(correspondARequete(['Dossier RH'], 'rhx')).toBe(false)
  })
})

describe('filtrerParRequete', () => {
  const personnes = ['Jean Martin', 'Jeanne Morel', 'Dean Martin', 'Paul Durand']

  test('privilégie les correspondances exactes : pas de faute tolérée si un résultat exact existe', () => {
    // "jean" est contenu dans "Jean Martin" et "Jeanne Morel" ; "Dean Martin"
    // (une lettre d'écart) ne doit pas remonter à côté.
    expect(filtrerParRequete(personnes, (p) => [p], 'jean')).toEqual(['Jean Martin', 'Jeanne Morel'])
  })

  test('se replie sur la tolérance aux fautes quand rien ne correspond exactement', () => {
    expect(filtrerParRequete(personnes, (p) => [p], 'durant')).toEqual(['Paul Durand'])
  })

  test('tri par pertinence : mot identique avant morceau de mot', () => {
    const liste = ['Jeanne Morel', 'Jean Martin']
    expect(filtrerParRequete(liste, (p) => [p], 'jean', { trierParPertinence: true })).toEqual(['Jean Martin', 'Jeanne Morel'])
  })

  test('conserve l\'ordre d\'origine sans tri par pertinence', () => {
    const liste = ['Jeanne Morel', 'Jean Martin']
    expect(filtrerParRequete(liste, (p) => [p], 'jean')).toEqual(['Jeanne Morel', 'Jean Martin'])
  })

  test('requête vide : liste inchangée', () => {
    expect(filtrerParRequete(personnes, (p) => [p], '  ')).toBe(personnes)
  })
})
