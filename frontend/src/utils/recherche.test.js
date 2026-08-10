import { correspondARequete } from './recherche'

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
})
