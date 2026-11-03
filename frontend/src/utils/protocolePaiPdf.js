import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import hisLogoUrl from '../assets/his-logo.png'
import badgeUrl from '../assets/logo-services-a-la-personne.jpg'
import badgeHandeoUrl from '../assets/logo-cap-handeo.jpg'
import photoCouvertureUrl from '../assets/pai-couverture.jpg'

/**
 * Génère le PDF du "Projet Individualisé d'Aide et d'Accompagnement" (PIAA)
 * rédigé depuis ProtocolePai.jsx, à l'identique du modèle Word utilisé par
 * HIS (voir les PAI papier existants) : en-tête logo + raison sociale sur
 * chaque page, rubriques en rouge italique souligné, champs "Libellé :
 * valeur" sur deux colonnes, tableau Jours/Horaires, tableau du dispositif,
 * "PS :", accepte/refuse, signatures, pied de page avec les deux labels.
 * Le contenu qui dépasse passe sur les pages suivantes.
 */

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGE = 56
const LARGEUR = PAGE_W - 2 * MARGE
const BAS_CONTENU = 92
const NOIR = rgb(0.067, 0.067, 0.067)
const ROUGE = rgb(0.698, 0.227, 0.18)
const ROUGE_PALE = rgb(0.89, 0.761, 0.745)
const GRIS = rgb(0.55, 0.55, 0.55)
const GRIS_BORDURE = rgb(0.6, 0.6, 0.6)
const GRIS_LIGNE = rgb(0.8, 0.8, 0.8)
const GRIS_TEXTE = rgb(0.45, 0.45, 0.45)
const TAILLE = 11
const INTERLIGNE = 14.5

const JOURS_LABEL = { LUN: 'Lundi', MAR: 'Mardi', MER: 'Mercredi', JEU: 'Jeudi', VEN: 'Vendredi', SAM: 'Samedi', DIM: 'Dimanche' }

function decouperEnLignes(font, texte, taille, largeurMax) {
  const mots = String(texte || '').split(/\s+/).filter(Boolean)
  const lignes = []
  let ligne = ''
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot
    if (font.widthOfTextAtSize(essai, taille) > largeurMax && ligne) {
      lignes.push(ligne)
      ligne = mot
    } else {
      ligne = essai
    }
  }
  if (ligne) lignes.push(ligne)
  return lignes.length ? lignes : ['']
}

function etapeAContenu(e) {
  return !!(e?.texte?.trim() || e?.label?.trim() || (e?.sous || []).some((s) => s?.texte?.trim()))
}

function formatDateFr(iso) {
  if (!iso) return ''
  const p = iso.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso
}

/**
 * Nom de la pièce jointe glissée dans chaque PDF exporté : le protocole
 * complet en JSON, pour que « Importer un PDF » (voir importPaiPdf.js)
 * restitue le formulaire à l'identique au lieu de le deviner depuis le texte.
 */
export const NOM_PIECE_JOINTE_PROTOCOLE = 'protocole-pai.json'

// L'aperçu en direct régénère le PDF à chaque frappe : les images ne sont
// téléchargées qu'une fois.
let imagesEnCache = null
function chargerImages() {
  if (!imagesEnCache) {
    imagesEnCache = Promise.all([hisLogoUrl, badgeUrl, badgeHandeoUrl, photoCouvertureUrl].map((u) => fetch(u).then((r) => r.arrayBuffer())))
    imagesEnCache.catch(() => { imagesEnCache = null })
  }
  return imagesEnCache
}

/**
 * Adresse sur une ligne : rue, puis code postal et ville quand ils sont
 * saisis (champs séparés dans le formulaire, une seule ligne dans le PDF
 * comme sur le gabarit papier).
 */
export function adresseComplete(b) {
  const villeLigne = [b?.codePostal, b?.ville].map((v) => (v || '').trim()).filter(Boolean).join(' ')
  return [(b?.adresse || '').trim(), villeLigne].filter(Boolean).join(', ')
}

export function civiliteBeneficiaire(p) {
  return p.beneficiaire?.civilite === 'M.' ? 'M.' : 'Mme'
}

/** Phrase reprise dans le PDF quand le paragraphe "Description des interventions" est laissé vide. */
export function phraseInterventions(p) {
  const tags = (p.interventions?.tags || []).map((t) => t.trim()).filter(Boolean).map((t) => t.toLowerCase())
  if (!tags.length) return ''
  const liste = tags.length === 1 ? tags[0] : `${tags.slice(0, -1).join(', ')} et ${tags[tags.length - 1]}`
  const nom = (p.beneficiaire?.nom || '').toUpperCase()
  return `Les prestations chez ${nom ? `${civiliteBeneficiaire(p)} ${nom}` : 'le/la bénéficiaire'} consistent en : ${liste}.`
}

/** Le PDF à télécharger, avec le protocole joint pour pouvoir le réimporter. */
export async function genererPdfProtocolePai(p, extra = {}) {
  const { bytes } = await construirePdf(p, extra, true)
  return new Blob([bytes], { type: 'application/pdf' })
}

/**
 * Pour l'aperçu en direct : les octets du PDF, et la page où commence chaque
 * rubrique — le nombre de pages varie avec le contenu.
 */
export async function genererPdfProtocolePaiAvecPlan(p, extra = {}) {
  return construirePdf(p, extra, false)
}

function civiliteLongue(p) {
  return civiliteBeneficiaire(p) === 'M.' ? 'Monsieur' : 'Madame'
}

/** "09:00" → "9H", "09:30" → "9H30" — l'écriture des horaires du modèle HIS. */
function heureHis(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  return `${parseInt(h, 10)}H${m && m !== '00' ? m : ''}`
}

/** Phrase d'introduction du tableau des horaires, comme sur le modèle HIS. */
export function phrasePlanning(p) {
  const n = (p.planning?.creneaux || []).length
  const nom = (p.beneficiaire?.nom || '').toUpperCase()
  return `HIS intervient ${n} fois par semaine chez ${nom ? `${civiliteLongue(p)} ${nom}` : 'le/la bénéficiaire'} comme suit :`
}

async function construirePdf(p, extra, joindreProtocole) {
  const pdfDoc = await PDFDocument.create()
  const fontTexte = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const fontGras = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
  const fontItalique = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)
  const fontGrasItalique = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic)

  const [logoBytes, badgeBytes, badgeHandeoBytes, photoBytes] = await chargerImages()
  const logoImage = await pdfDoc.embedPng(logoBytes)
  const badgeImage = await pdfDoc.embedJpg(badgeBytes)
  const badgeHandeoImage = await pdfDoc.embedJpg(badgeHandeoBytes)
  // Photo de couverture : celle choisie dans le formulaire (dataURL) si elle
  // existe, sinon celle du modèle HIS.
  const photoImage = p.photoCouverture
    ? await (p.photoCouverture.startsWith('data:image/png') ? pdfDoc.embedPng(p.photoCouverture) : pdfDoc.embedJpg(p.photoCouverture))
    : await pdfDoc.embedJpg(photoBytes)

  // Les polices standard ne savent écrire que le jeu WinAnsi : un caractère
  // hors de ce jeu (emoji, symbole collé depuis Word...) ferait échouer tout
  // le PDF — et l'aperçu en direct avec. Il est remplacé par "?".
  const jeuCaracteres = new Set(fontTexte.getCharacterSet())
  function sur(texte) {
    return Array.from(String(texte ?? '').replace(/[^\S\n]/g, ' ')).map((c) => (c === '\n' || jeuCaracteres.has(c.codePointAt(0)) ? c : '?')).join('')
  }

  let page, y
  const pages = []
  const sections = []
  const civ = civiliteBeneficiaire(p)
  const b = p.beneficiaire || {}
  const tuteur = p.aTuteur === false ? {} : (p.tuteur || {})
  const nomMaj = (b.nom || '').toUpperCase()
  const prenomMaj = (b.prenom || '').toUpperCase()

  function ecrire(texte, x, yy, { font = fontTexte, taille = TAILLE, couleur = NOIR } = {}) {
    page.drawText(sur(texte), { x, y: yy, size: taille, font, color: couleur })
  }
  function largeurTexte(texte, font = fontTexte, taille = TAILLE) {
    return font.widthOfTextAtSize(sur(texte), taille)
  }
  function ecrireCentre(texte, yy, opts = {}) {
    const l = largeurTexte(texte, opts.font, opts.taille)
    ecrire(texte, (PAGE_W - l) / 2, yy, opts)
  }
  function lignes(texte, largeur, font = fontTexte, taille = TAILLE) {
    // Les retours à la ligne saisis dans le formulaire sont conservés.
    return String(texte || '').split('\n').flatMap((para) => decouperEnLignes(font, sur(para), taille, largeur))
  }

  function entete() {
    const logoH = 58
    const logoL = logoH * (logoImage.width / logoImage.height)
    page.drawImage(logoImage, { x: MARGE, y: PAGE_H - 30 - logoH, width: logoL, height: logoH })
    const milieu = PAGE_H - 30 - logoH / 2
    ecrireCentre('HETEP-IAOUT SERVICES', milieu + 3, { font: fontGrasItalique, taille: 13 })
    ecrireCentre('« L’utilité sur le chemin de la sérénité ».', milieu - 11, { font: fontItalique, taille: 10.5 })
    y = PAGE_H - 30 - logoH - 22
  }

  function piedDePage(pg, numero, total) {
    pg.drawLine({ start: { x: MARGE, y: 66 }, end: { x: PAGE_W - MARGE, y: 66 }, thickness: 0.8, color: NOIR })
    const badgeH = 34
    const handeoL = badgeH * (badgeHandeoImage.width / badgeHandeoImage.height)
    pg.drawImage(badgeHandeoImage, { x: MARGE, y: 24, width: handeoL, height: badgeH })
    const sapH = 32
    const sapL = sapH * (badgeImage.width / badgeImage.height)
    pg.drawImage(badgeImage, { x: PAGE_W - MARGE - sapL, y: 25, width: sapL, height: sapH })
    ;[
      '8 place Georges Braque, 93120 La Courneuve Tél: 01 43 52 64 23 Fax: 01 43 11 09 67',
      'Sarl au Capital de 6000 euros, Siret : 493 761 175 00030 R.C.S.Bobigny',
      'APE 9609Z. Agrément Qualité Préfectorale : SAP493761175',
    ].forEach((l, i) => {
      const larg = fontGrasItalique.widthOfTextAtSize(l, 7.5)
      pg.drawText(l, { x: (PAGE_W - larg) / 2, y: 54 - i * 10, size: 7.5, font: fontGrasItalique, color: NOIR })
    })
    // Numéro de page discret : le PAI peut compter bien plus de 4 pages.
    if (total > 1) {
      const t = `${numero} / ${total}`
      pg.drawText(t, { x: PAGE_W - MARGE - fontTexte.widthOfTextAtSize(t, 8), y: PAGE_H - 22, size: 8, font: fontTexte, color: GRIS_TEXTE })
    }
  }

  function nouvellePage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H])
    pages.push(page)
    entete()
  }

  function assurerEspace(hauteur) { if (y - hauteur < BAS_CONTENU) nouvellePage() }

  // Titre de rubrique du modèle : rouge, gras italique souligné, barre grise
  // à gauche et filet rouge sur toute la largeur.
  function titreSection(titre, affiche = titre) {
    assurerEspace(TAILLE + 40)
    sections.push({ titre, page: pages.length })
    const taille = 12
    page.drawRectangle({ x: MARGE, y: y - 4, width: 3.5, height: taille + 4, color: GRIS })
    ecrire(affiche, MARGE + 10, y, { font: fontGrasItalique, taille, couleur: ROUGE })
    const l = largeurTexte(affiche, fontGrasItalique, taille)
    page.drawLine({ start: { x: MARGE + 10, y: y - 1.5 }, end: { x: MARGE + 10 + l, y: y - 1.5 }, thickness: 0.7, color: ROUGE })
    page.drawLine({ start: { x: MARGE, y: y - 5 }, end: { x: PAGE_W - MARGE, y: y - 5 }, thickness: 0.8, color: ROUGE })
    y -= 5 + INTERLIGNE + 3
  }

  function paragraphe(texte) {
    lignes(texte, LARGEUR).forEach((l) => {
      assurerEspace(INTERLIGNE)
      ecrire(l, MARGE, y)
      y -= INTERLIGNE
    })
    y -= 6
  }

  // Champs "Libellé : valeur" sur deux colonnes ; null = cellule vide,
  // [libellé, valeur, true] = toute la largeur.
  function grilleChamps(rangees) {
    const ecart = 18
    const largeurCol = (LARGEUR - ecart) / 2
    rangees.forEach((rangee) => {
      const cellules = rangee.map((c) => {
        if (!c) return []
        const [libelle, valeur, pleine] = c
        const texte = libelle ? `${libelle} : ${valeur || ''}` : (valeur || '')
        return lignes(texte, pleine ? LARGEUR : largeurCol)
      })
      const hauteur = Math.max(1, ...cellules.map((c) => c.length)) * INTERLIGNE
      assurerEspace(hauteur)
      cellules.forEach((cl, i) => cl.forEach((l, li) => ecrire(l, MARGE + i * (largeurCol + ecart), y - li * INTERLIGNE)))
      y -= hauteur + 2
    })
    y -= 6
  }

  function tableauHoraires(creneaux) {
    const x0 = MARGE + 40
    const largeur = LARGEUR - 80
    const demi = largeur / 2
    const hLigne = 17
    function bordsLaterauxRangee(haut) {
      page.drawLine({ start: { x: x0, y: haut }, end: { x: x0, y: haut - hLigne }, thickness: 0.8, color: ROUGE })
      page.drawLine({ start: { x: x0 + largeur, y: haut }, end: { x: x0 + largeur, y: haut - hLigne }, thickness: 0.8, color: ROUGE })
    }
    function entetes() {
      const haut = y
      page.drawLine({ start: { x: x0, y: haut }, end: { x: x0 + largeur, y: haut }, thickness: 0.8, color: ROUGE })
      bordsLaterauxRangee(haut)
      ;['Jours', 'Horaires'].forEach((t, i) => {
        const l = largeurTexte(t, fontItalique)
        ecrire(t, x0 + i * demi + (demi - l) / 2, haut - 12.5, { font: fontItalique, couleur: ROUGE })
      })
      page.drawLine({ start: { x: x0, y: haut - hLigne }, end: { x: x0 + largeur, y: haut - hLigne }, thickness: 0.8, color: ROUGE })
      y -= hLigne
    }
    assurerEspace(hLigne * 2)
    entetes()
    const rangees = creneaux.length ? creneaux : [null]
    rangees.forEach((c, i) => {
      if (y - hLigne < BAS_CONTENU) { nouvellePage(); entetes() }
      const haut = y
      bordsLaterauxRangee(haut)
      if (c) {
        const jour = JOURS_LABEL[c.jour] || c.jour
        const horaire = `${heureHis(c.debut)} – ${heureHis(c.fin)}${c.label ? ` (${c.label})` : ''}`
        ;[jour, horaire].forEach((t, k) => {
          const txt = lignes(t, demi - 8)[0]
          ecrire(txt, x0 + k * demi + (demi - largeurTexte(txt)) / 2, haut - 12.5)
        })
      }
      const derniere = i === rangees.length - 1
      page.drawLine({ start: { x: x0, y: haut - hLigne }, end: { x: x0 + largeur, y: haut - hLigne }, thickness: derniere ? 0.8 : 0.6, color: derniere ? ROUGE : ROUGE_PALE })
      y -= hLigne
    })
    y -= 12
  }

  function tableauDispositif(rangees) {
    const largeurCle = LARGEUR * 0.45
    const pad = 5
    rangees.forEach(([cle, valeur]) => {
      const lc = lignes(cle, largeurCle - 2 * pad)
      const lv = lignes(valeur, LARGEUR - largeurCle - 2 * pad)
      const hauteur = Math.max(lc.length, lv.length, 1) * INTERLIGNE + 2 * pad - 2
      assurerEspace(hauteur)
      page.drawRectangle({ x: MARGE, y: y - hauteur, width: LARGEUR, height: hauteur, borderColor: GRIS_BORDURE, borderWidth: 0.7 })
      page.drawLine({ start: { x: MARGE + largeurCle, y }, end: { x: MARGE + largeurCle, y: y - hauteur }, thickness: 0.6, color: GRIS_LIGNE })
      lc.forEach((l, i) => ecrire(l, MARGE + pad, y - pad - 9 - i * INTERLIGNE))
      lv.forEach((l, i) => ecrire(l, MARGE + largeurCle + pad, y - pad - 9 - i * INTERLIGNE))
      y -= hauteur
    })
    y -= 12
  }

  function listeEtapes(etapes, numerote) {
    const items = (etapes || []).filter(etapeAContenu)
    items.forEach((e, i) => {
      const puce = numerote ? `${i + 1}.` : '•'
      const texteComplet = `${e.label ? e.label + (e.texte ? ' : ' : '') : ''}${e.texte}`
      lignes(texteComplet, LARGEUR - 18).forEach((l, li) => {
        assurerEspace(INTERLIGNE)
        if (li === 0) ecrire(puce, MARGE + 2, y, { font: fontGras })
        ecrire(l, MARGE + 18, y)
        y -= INTERLIGNE
      })
      ;(e.sous || []).filter((s) => s?.texte?.trim()).forEach((s) => {
        lignes(s.texte, LARGEUR - 46).forEach((l, li) => {
          assurerEspace(INTERLIGNE)
          if (li === 0) ecrire('o', MARGE + 30, y)
          ecrire(l, MARGE + 42, y)
          y -= INTERLIGNE
        })
      })
    })
    y -= 4
  }

  // ---- page 1 : page de garde ----
  nouvellePage()
  sections.push({ titre: 'Page de garde', page: 1 })
  const photoL = PAGE_W * 0.62
  const photoH = Math.min(photoL * (photoImage.height / photoImage.width), 360)
  const photoLReel = photoH * (photoImage.width / photoImage.height)
  const hautBloc = 16 + 26 + photoH + 40
  let yc = (y + BAS_CONTENU + 90) / 2 + hautBloc / 2
  ecrireCentre('PROJET INDIVIDUALISE D’AIDE ET D’ACCOMPAGNEMENT', yc, { font: fontGras, taille: 15 })
  yc -= 30
  ecrireCentre(`${civ === 'M.' ? 'M.' : 'MME'} ${nomMaj} ${prenomMaj}`.replace(/\s+/g, ' ').trim(), yc, { font: fontGras, taille: 14 })
  yc -= 24
  page.drawImage(photoImage, { x: (PAGE_W - photoLReel) / 2, y: yc - photoH, width: photoLReel, height: photoH })
  yc -= photoH + 30
  ecrireCentre('HETEP IAOUT SERVICES (HIS)', yc, { taille: 12.5 })
  const lignesRealisation = [
    `Réalisé le : ${p.meta?.realiseLe || ''}`,
    `Réalisé par : ${p.meta?.realisePar || ''}`,
    ...(extra.responsableSecteur ? [`Responsable de secteur : ${extra.responsableSecteur}`] : []),
  ]
  const largeurBloc = Math.max(...lignesRealisation.map((l) => largeurTexte(l)))
  lignesRealisation.forEach((l, i) => ecrire(l, PAGE_W - MARGE - Math.max(largeurBloc, 150), BAS_CONTENU + 20 + (lignesRealisation.length - 1 - i) * 20))

  // ---- page 2 : identités, historique, planning, interventions ----
  nouvellePage()
  titreSection('Identité du bénéficiaire', 'IDENTITE DU BENEFICIAIRE')
  const villeLigne = [b.codePostal, (b.ville || '').toUpperCase()].map((v) => (v || '').trim()).filter(Boolean).join(' ')
  grilleChamps([
    [['Nom(s)', nomMaj], ['Prénom(s)', prenomMaj]],
    [['Date de naissance', formatDateFr(b.dateNaissance)], ['Numéro de téléphone', b.telephone]],
    [['Adresse', (b.adresse || '').trim()], null],
    [villeLigne ? ['', villeLigne] : null, ['Pathologie', b.pathologie]],
    [['Traitement(s)', b.traitements], ['Médecin traitant', b.medecinTraitant]],
  ])
  titreSection('Identité du tuteur', 'IDENTITE DU TUTEUR')
  grilleChamps([
    [['Nom(s)', (tuteur.nom || '').toUpperCase()], ['Prénom(s)', tuteur.prenom]],
    [['Lien avec le bénéficiaire', tuteur.lien], ['Numéro de téléphone', tuteur.telephone]],
    [['Numéro de téléphone fixe', tuteur.telephoneFixe], ['E-mail', tuteur.mail]],
    [['Adresse', tuteur.adresse, true]],
  ])
  titreSection('Historique de la pathologie ou de sa survenance')
  paragraphe(p.historique)

  titreSection('Organisation des prestations')
  paragraphe(phrasePlanning(p))
  tableauHoraires(p.planning?.creneaux || [])

  titreSection('Description des interventions')
  paragraphe(p.interventions?.description || phraseInterventions(p))

  const moments = p.moments || [], procedures = p.procedures || []
  if (moments.length || procedures.length) {
    titreSection('Programme détaillé')
    moments.forEach((m) => {
      assurerEspace(INTERLIGNE * 2)
      ecrire(`${m.titre || 'Moment'} :`, MARGE, y, { font: fontGras })
      y -= INTERLIGNE
      listeEtapes(m.etapes, m.type !== 'puces')
    })
    if (procedures.length && p.procSpecifiquesTitre) {
      assurerEspace(INTERLIGNE * 2)
      ecrire(`${p.procSpecifiquesTitre} :`, MARGE, y, { font: fontGras })
      y -= INTERLIGNE + 2
    }
    procedures.forEach((pr) => {
      assurerEspace(INTERLIGNE * 2)
      ecrire(`${pr.nom || 'Procédure'} :`, MARGE, y, { font: fontGras })
      y -= INTERLIGNE
      listeEtapes(pr.etapes, pr.type !== 'puces')
    })
  }

  // ---- page 3 : objectifs, dispositif, PS ----
  nouvellePage()
  titreSection('Objectifs de la prise en charge')
  paragraphe(p.objectifs)

  titreSection('Dispositif à mettre en place')
  const d = p.dispositif || {}
  const ouiNon = (v) => (v ? 'Oui' : 'Non')
  tableauDispositif([
    ['Cahier de courses', ouiNon(d.cahierCourses)],
    ['Cahier de liaison', ouiNon(d.cahierLiaison)],
    ['Remise de clé', ouiNon(d.remiseCle)],
    ['En cas d’absence ou de retard', d.absenceRetard],
    ['Niveau de remplacement', d.niveauRemplacement],
    ['Comportements particuliers du bénéficiaire, comportement à adopter par l’intervenant', d.comportements],
    ['Autres', d.autres],
  ])

  const ps = [p.aSavoir, p.auxiliaires?.trim() && `Auxiliaires attitrées : ${p.auxiliaires.trim()}.`].filter(Boolean).join(' ')
  if (ps) {
    lignes(`PS : ${ps}`, LARGEUR).forEach((l, i) => {
      assurerEspace(INTERLIGNE)
      if (i === 0) {
        ecrire('PS :', MARGE, y, { font: fontGras })
        ecrire(l.slice(4), MARGE + largeurTexte('PS :', fontGras), y)
      } else {
        ecrire(l, MARGE, y)
      }
      y -= INTERLIGNE
    })
  }

  // ---- page 4 : décision et signatures ----
  nouvellePage()
  sections.push({ titre: 'Décision et signatures', page: pages.length })
  y -= 20
  function caseACocher(x, coche) {
    page.drawRectangle({ x, y: y - 1, width: 9, height: 9, borderColor: NOIR, borderWidth: 0.8 })
    if (coche) {
      page.drawLine({ start: { x: x + 1.5, y: y + 0.5 }, end: { x: x + 7.5, y: y + 6.5 }, thickness: 1, color: NOIR })
      page.drawLine({ start: { x: x + 1.5, y: y + 6.5 }, end: { x: x + 7.5, y: y + 0.5 }, thickness: 1, color: NOIR })
    }
  }
  const tAccepte = 'Le bénéficiaire accepte le projet'
  const tRefuse = 'Le bénéficiaire refuse le projet'
  ecrire(tAccepte, MARGE, y)
  caseACocher(MARGE + largeurTexte(tAccepte) + 6, p.decision === 'accepte')
  const xRefuse = PAGE_W - MARGE - largeurTexte(tRefuse) - 15
  ecrire(tRefuse, xRefuse, y)
  caseACocher(xRefuse + largeurTexte(tRefuse) + 6, p.decision === 'refuse')
  y -= 44

  const faitLe = p.faitLe ? formatDateFr(p.faitLe) : ''
  ecrire(p.faitA ? `Fait à ${p.faitA}${faitLe ? `, le ${faitLe}` : ''}` : 'Fait à …………………….', MARGE, y)
  y -= 44

  const tSignHis = 'Signature du représentant du prestataire'
  const tSignBenef = 'Signature du bénéficiaire'
  ecrire(tSignHis, MARGE, y)
  const xSignBenef = PAGE_W - MARGE - largeurTexte(tSignBenef)
  ecrire(tSignBenef, xSignBenef, y)

  // Tracés signés à l'écran (SignaturePad) : sous leur libellé. Sans tracé,
  // l'espace reste libre pour une signature à la main sur le document imprimé.
  const imagesSignature = await Promise.all(['his', 'beneficiaire'].map(async (cle) => {
    const data = p.signatures?.[cle]
    if (!data) return null
    try {
      return data.startsWith('data:image/png') ? await pdfDoc.embedPng(data) : await pdfDoc.embedJpg(data)
    } catch {
      return null
    }
  }))
  imagesSignature.forEach((sig, i) => {
    if (!sig) return
    const echelle = Math.min(180 / sig.width, 70 / sig.height)
    const largeur = sig.width * echelle
    page.drawImage(sig, { x: i === 0 ? MARGE : PAGE_W - MARGE - largeur, y: y - 14 - sig.height * echelle, width: largeur, height: sig.height * echelle })
  })

  pages.forEach((pg, i) => piedDePage(pg, i + 1, pages.length))

  if (joindreProtocole) {
    await pdfDoc.attach(new TextEncoder().encode(JSON.stringify({ version: 1, protocole: p })), NOM_PIECE_JOINTE_PROTOCOLE, {
      mimeType: 'application/json',
      description: 'Protocole PAI HisDocs (réimportable)',
    })
  }

  const bytes = await pdfDoc.save()
  return { bytes, sections, nbPages: pages.length }
}
