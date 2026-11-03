import { NOM_PIECE_JOINTE_PROTOCOLE } from './protocolePaiPdf'

/**
 * « Importer un PDF » de l'éditeur de protocole PAI (ProtocolePai.jsx) :
 * remplit le formulaire depuis un PAI existant pour le continuer.
 *
 * 1. PDF exporté par HisDocs : le protocole complet y est joint en JSON
 *    (voir NOM_PIECE_JOINTE_PROTOCOLE) — restitution à l'identique.
 * 2. Sinon, PAI au gabarit papier HIS (Word → PDF) : lecture du texte,
 *    rubrique par rubrique, à partir des libellés du gabarit ("Nom(s) :",
 *    "IDENTITE DU TUTEUR", "Lundi 9H – 11H"...). Ce qui n'est pas reconnu
 *    reste vide et apparaît dans la vérification avant enregistrement.
 *
 * Renvoie { protocole, source: 'hisdocs' | 'gabarit', nbChamps }. Le
 * protocole est partiel : à fusionner dans protocoleVide().
 */

const JOURS_TEXTE = { lundi: 'LUN', mardi: 'MAR', mercredi: 'MER', jeudi: 'JEU', vendredi: 'VEN', samedi: 'SAM', dimanche: 'DIM' }

const INTERVENTIONS_CONNUES = [
  [/toilette/i, 'Aide à la toilette'],
  [/m[ée]nage/i, 'Aide au ménage'],
  [/actes? (de la vie )?(du )?quotidien/i, 'Actes du quotidien'],
  [/repas/i, 'Aide au repas'],
  [/courses/i, 'Courses'],
  [/lever|coucher/i, 'Aide au lever / coucher'],
  [/accompagnement/i, 'Accompagnement extérieur'],
  [/nuit/i, 'Garde de nuit'],
]

// Titres de rubrique du gabarit, dans l'ordre où on les rencontre.
const RUBRIQUES = [
  ['beneficiaire', /^IDENTIT[EÉ] DU B[EÉ]N[EÉ]FICIAIRE/i],
  ['tuteur', /^IDENTIT[EÉ] DU TUTEUR/i],
  ['historique', /^Historique de la pathologie/i],
  ['planning', /^Organisation des prestations/i],
  ['interventions', /^Description des interventions/i],
  ['objectifs', /^Objectifs de la prise en charge/i],
  ['dispositif', /^Dispositif [àa] mettre en place/i],
  ['decision', /^Le b[ée]n[ée]ficiaire (accepte|refuse)/i],
]

// En-têtes et pieds de page répétés sur chaque page du gabarit : ignorés.
const LIGNES_IGNOREES = [
  /^_{5,}$/, /Georges Braque/i, /^Sarl au Capital/i, /^APE \d/i,
  /^HETEP[- ]IAOUT SERVICES/i, /chemin de la s[ée]r[ée]nit[ée]/i,
  /^PROJET INDIVIDUALIS/i, /^Jours\s+Horaires$/i, /^Signature du/i,
]

const LIBELLES = {
  beneficiaire: [
    ['nom', 'Nom\\(s\\)'], ['prenom', 'Pr[ée]nom\\(s\\)'], ['dateNaissance', 'Date de naissance'],
    ['telephone', 'Num[ée]ro de t[ée]l[ée]phone'], ['adresse', 'Adresse'], ['pathologie', 'Pathologie'],
    ['traitements', 'Traitement\\(s\\)'], ['medecinTraitant', 'M[ée]decin traitant'],
  ],
  tuteur: [
    ['nom', 'Nom\\(s\\)'], ['prenom', 'Pr[ée]nom\\(s\\)'], ['lien', 'Lien avec le b[ée]n[ée]ficiaire'],
    ['telephoneFixe', 'Num[ée]ro de t[ée]l[ée]phone fixe'], ['telephone', 'Num[ée]ro de t[ée]l[ée]phone'],
    ['mail', 'E-?mail'], ['adresse', 'Adresse'],
  ],
}

async function chargerPdfjs() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  return pdfjsLib
}

/** Les polices standard du PDF exporté (WinAnsi) refusent certains caractères du gabarit Word. */
function nettoyer(texte) {
  return String(texte || '')
    .replace(/[□☐☒■]/g, '')
    .replace(/[​­]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function lireLignes(pdf) {
  const lignes = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const contenu = await page.getTextContent()
    let ligne = ''
    let yPrec = null
    contenu.items.forEach((it) => {
      if (!('str' in it)) return
      const y = Math.round(it.transform[5])
      if (yPrec !== null && Math.abs(y - yPrec) > 2) {
        lignes.push({ texte: ligne, page: n })
        ligne = ''
      }
      ligne += it.str
      yPrec = y
    })
    if (ligne) lignes.push({ texte: ligne, page: n })
  }
  return lignes
    .map((l) => ({ ...l, texte: l.texte.replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.texte && !LIGNES_IGNOREES.some((re) => re.test(l.texte)))
}

/** "Nom(s) : X Prénom(s) : Y" (sur une ou plusieurs lignes) → { nom: 'X', prenom: 'Y' } */
function decouperChamps(texte, libelles) {
  const alternance = libelles.map(([, re]) => re).join('|')
  const re = new RegExp(`(${alternance})\\s*:`, 'gi')
  const reperes = []
  let m
  while ((m = re.exec(texte))) reperes.push({ libelle: m[1], debut: m.index, fin: re.lastIndex })
  const champs = {}
  reperes.forEach((r, i) => {
    const valeur = nettoyer(texte.slice(r.fin, i + 1 < reperes.length ? reperes[i + 1].debut : undefined)).replace(/,$/, '')
    const cle = libelles.find(([, lre]) => new RegExp(`^${lre}$`, 'i').test(r.libelle))?.[0]
    if (cle && valeur && !champs[cle]) champs[cle] = valeur
  })
  return champs
}

function dateFrVersIso(texte) {
  const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(texte || '')
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}

function heure(h, min) { return `${String(h).padStart(2, '0')}:${(min || '00').padStart(2, '0')}` }

function lireGabarit(lignes) {
  const p = { beneficiaire: {}, tuteur: {}, planning: { creneaux: [] }, interventions: { description: '', tags: [] }, dispositif: {}, meta: {} }
  const parRubrique = { garde: [] }
  let courante = 'garde'
  lignes.forEach((l) => {
    const r = RUBRIQUES.find(([, re]) => re.test(l.texte))
    if (r) {
      courante = r[0]
      parRubrique[courante] = parRubrique[courante] || []
      // La ligne accepte/refuse porte elle-même l'information.
      if (courante === 'decision') parRubrique.decision.push(l.texte)
      return
    }
    ;(parRubrique[courante] = parRubrique[courante] || []).push(l.texte)
  })

  // Page de garde : "MME NOM PRÉNOM", "Réalisé le : …", "Réalisé par : …"
  ;(parRubrique.garde || []).forEach((t) => {
    if (/^(MME|MADAME)\s/i.test(t)) p.beneficiaire.civilite = 'Mme'
    else if (/^(M\.|MR|MONSIEUR)\s/i.test(t)) p.beneficiaire.civilite = 'M.'
    const le = /R[ée]alis[ée] le\s*:\s*(.+)/i.exec(t)
    if (le && nettoyer(le[1])) p.meta.realiseLe = nettoyer(le[1])
    const par = /R[ée]alis[ée] par\s*:\s*(.+)/i.exec(t)
    if (par && nettoyer(par[1])) p.meta.realisePar = nettoyer(par[1])
  })

  const benef = decouperChamps((parRubrique.beneficiaire || []).join(' '), LIBELLES.beneficiaire)
  if (benef.dateNaissance) benef.dateNaissance = dateFrVersIso(benef.dateNaissance)
  if (benef.prenom) benef.prenom = benef.prenom.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase())
  Object.assign(p.beneficiaire, benef)

  const tuteur = decouperChamps((parRubrique.tuteur || []).join(' '), LIBELLES.tuteur)
  Object.assign(p.tuteur, tuteur)
  p.aTuteur = Object.values(tuteur).some(Boolean)

  p.historique = nettoyer((parRubrique.historique || []).join(' '))

  ;(parRubrique.planning || []).forEach((t) => {
    const m = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s*[hH:](\d{2})?\s*[–—-]\s*(\d{1,2})\s*[hH:](\d{2})?/i.exec(t)
    if (m) p.planning.creneaux.push({ jour: JOURS_TEXTE[m[1].toLowerCase()], debut: heure(m[2], m[3]), fin: heure(m[4], m[5]), label: '' })
  })

  const descInterventions = nettoyer((parRubrique.interventions || []).join(' '))
  p.interventions.description = descInterventions
  p.interventions.tags = INTERVENTIONS_CONNUES.filter(([re]) => re.test(descInterventions)).map(([, tag]) => tag)

  p.objectifs = nettoyer((parRubrique.objectifs || []).join(' '))

  // Dispositif : tableau à deux colonnes, plus le "PS :" qui peut s'étendre sur plusieurs lignes.
  const ps = []
  let dansPs = false
  ;(parRubrique.dispositif || []).forEach((t) => {
    const oui = (re) => { const m = new RegExp(`^${re}\\s+(Oui|Non)\\b`, 'i').exec(t); return m ? m[1].toLowerCase() === 'oui' : null }
    const courses = oui('Cahier de courses'), liaison = oui('Cahier de liaison'), cle = oui('Remise de cl[ée]')
    if (courses !== null) { p.dispositif.cahierCourses = courses; dansPs = false; return }
    if (liaison !== null) { p.dispositif.cahierLiaison = liaison; dansPs = false; return }
    if (cle !== null) { p.dispositif.remiseCle = cle; dansPs = false; return }
    const absence = /^En cas d[’']absence ou de retard\s*(.*)$/i.exec(t)
    if (absence) { p.dispositif.absenceRetard = nettoyer(absence[1]); dansPs = false; return }
    const cotation = /cotation\s*(\d)/i.exec(t)
    if (/^Niveau de remplacement/i.test(t)) { if (cotation) p.dispositif.niveauRemplacement = `Application de la cotation ${cotation[1]}`; dansPs = false; return }
    const debutPs = /^PS\s*:\s*(.*)$/i.exec(t)
    if (debutPs) { dansPs = true; ps.push(debutPs[1]); return }
    // Le reste du tableau (Comportements, Autres) est surtout le texte du gabarit : on ne l'importe pas.
    if (/^(Comportements?|Autres)\b/i.test(t)) { dansPs = false; return }
    if (dansPs) ps.push(t)
  })
  p.aSavoir = nettoyer(ps.join(' '))

  ;(parRubrique.decision || []).forEach((t) => {
    if (/accepte le projet\s*[☒■xX✓]/.test(t)) p.decision = 'accepte'
    else if (/refuse le projet\s*[☒■xX✓]/.test(t)) p.decision = 'refuse'
    const fait = /Fait [àa]\s*([^.…]+?)(?:,?\s*le\s+(\d{1,2}\/\d{1,2}\/\d{4}))?\s*$/i.exec(t)
    if (fait && nettoyer(fait[1])) {
      p.faitA = nettoyer(fait[1])
      if (fait[2]) p.faitLe = dateFrVersIso(fait[2])
    }
  })

  return p
}

function compterChamps(objet) {
  if (Array.isArray(objet)) return objet.length
  if (objet && typeof objet === 'object') return Object.values(objet).reduce((s, v) => s + compterChamps(v), 0)
  return objet ? 1 : 0
}

export async function importerPaiDepuisPdf(fichier) {
  const pdfjsLib = await chargerPdfjs()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()) }).promise

  const pieces = await pdf.getAttachments().catch(() => null)
  const piece = pieces && Object.values(pieces).find((a) => a.filename === NOM_PIECE_JOINTE_PROTOCOLE)
  if (piece) {
    try {
      const { protocole } = JSON.parse(new TextDecoder().decode(piece.content))
      if (protocole && typeof protocole === 'object') return { protocole, source: 'hisdocs', nbChamps: compterChamps(protocole) }
    } catch {
      // Pièce jointe illisible : on retombe sur la lecture du texte.
    }
  }

  const lignes = await lireLignes(pdf)
  if (!lignes.length) {
    throw new Error("Ce PDF ne contient pas de texte lisible (document scanné ?). Seuls les PAI exportés par HisDocs ou issus du modèle Word HIS peuvent être importés.")
  }
  const protocole = lireGabarit(lignes)
  const nbChamps = compterChamps({ ...protocole, aTuteur: undefined })
  if (!nbChamps) throw new Error("Aucune rubrique du PAI n'a été reconnue dans ce PDF.")
  return { protocole, source: 'gabarit', nbChamps }
}
