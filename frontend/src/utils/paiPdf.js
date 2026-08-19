import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import hisLogoUrl from '../assets/his-logo.png'
import badgeUrl from '../assets/logo-services-a-la-personne.jpg'
import badgeHandeoUrl from '../assets/logo-cap-handeo.jpg'

/**
 * Génère un rapport PDF d'un dossier PAI — pas de gabarit officiel ici
 * (contrairement à reclamationPdf.js/congesPdf.js, qui superposent du texte
 * sur un vrai formulaire HIS) : un PAI n'a pas d'équivalent papier
 * préexistant, le document est entièrement composé. L'en-tête (logo, titre
 * souligné) et le pied de page (coordonnées de l'entreprise, badges
 * "Cap'Handéo" et "Services à la personne") reprennent néanmoins exactement
 * la même identité que messagePdf.js, pour que ce PDF ne détonne pas à côté
 * des autres documents de l'archive.
 */

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGE = 50
const COULEUR_TEXTE = rgb(0.12, 0.14, 0.17)
const COULEUR_MUTED = rgb(0.45, 0.48, 0.53)
const COULEUR_BORDURE = rgb(0.85, 0.86, 0.89)
const COULEUR_ENTETE_FOND = rgb(0.106, 0.212, 0.365)
const COULEUR_RETARD = rgb(0.72, 0.11, 0.11)
const COULEUR_FAIT = rgb(0.11, 0.5, 0.32)

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

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR')
}

export async function genererPdfPai(dossier) {
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontTitre = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
  const fontLegal = await pdfDoc.embedFont(StandardFonts.TimesRoman)

  const [logoBytes, badgeBytes, badgeHandeoBytes] = await Promise.all([
    fetch(hisLogoUrl).then((r) => r.arrayBuffer()),
    fetch(badgeUrl).then((r) => r.arrayBuffer()),
    fetch(badgeHandeoUrl).then((r) => r.arrayBuffer()),
  ])
  const logoImage = await pdfDoc.embedPng(logoBytes)
  const badgeImage = await pdfDoc.embedJpg(badgeBytes)
  const badgeHandeoImage = await pdfDoc.embedJpg(badgeHandeoBytes)

  // Filigrane HIS — même identité que FiligraneHIS.jsx (l'équivalent à l'écran),
  // mais ici réellement incrusté dans le fichier PDF : un seul logo, gros,
  // centré, en transparence, présent sur chaque page.
  const filigraneLargeur = 380
  const filigraneHauteur = (logoImage.height / logoImage.width) * filigraneLargeur

  // En-tête (logo + titre souligné) et pied de page (coordonnées + badge) —
  // mêmes dimensions/positions que messagePdf.js (repère jsPDF, y depuis le
  // haut, converti ici en repère pdf-lib, y depuis le bas).
  const logoHeaderLargeur = 140
  const logoHeaderHauteur = logoHeaderLargeur * (logoImage.height / logoImage.width)
  const LIGNES_PIED_DE_PAGE = [
    '8 place Georges Braque, 93120 La Courneuve  Tél: 01 43 52 64 23  Fax: 01 43 11 09 67',
    'Sarl au Capital de 840 000 euros, Siret : 493 761 175 00030 R.C.S.Bobigny',
    "APE 9609Z. Agrément Qualité Préfectorale : SAP493761175",
  ]

  function dessinerFiligrane(p) {
    p.drawImage(logoImage, {
      x: (PAGE_W - filigraneLargeur) / 2,
      y: (PAGE_H - filigraneHauteur) / 2,
      width: filigraneLargeur,
      height: filigraneHauteur,
      opacity: 0.06,
    })
  }

  function dessinerEnTeteLogo(p) {
    p.drawImage(logoImage, { x: MARGE, y: PAGE_H - 40 - logoHeaderHauteur, width: logoHeaderLargeur, height: logoHeaderHauteur })
  }

  function dessinerPiedDePage(p, numero, total) {
    p.drawLine({ start: { x: MARGE, y: 56 }, end: { x: PAGE_W - MARGE, y: 56 }, thickness: 0.5, color: rgb(0, 0, 0) })
    LIGNES_PIED_DE_PAGE.forEach((ligne, i) => {
      const largeur = fontLegal.widthOfTextAtSize(ligne, 8)
      p.drawText(ligne, { x: (PAGE_W - largeur) / 2, y: 44 - i * 10, size: 8, font: fontLegal, color: rgb(0, 0, 0) })
    })
    const largeurBadge = 50
    const hauteurBadge = largeurBadge * (badgeImage.height / badgeImage.width)
    p.drawImage(badgeImage, { x: PAGE_W - MARGE - largeurBadge, y: 22, width: largeurBadge, height: hauteurBadge })
    const hauteurBadgeHandeo = largeurBadge * (badgeHandeoImage.height / badgeHandeoImage.width)
    p.drawImage(badgeHandeoImage, { x: MARGE, y: 22, width: largeurBadge, height: hauteurBadgeHandeo })

    // Pagination — utile ici (rapport potentiellement multi-pages), sans
    // équivalent dans messagePdf.js (toujours une seule page) : placée en
    // haut, à l'écart du pied de page standardisé pour ne pas l'alourdir.
    const texte = `Page ${numero}/${total}`
    const largeurTexte = fontRegular.widthOfTextAtSize(texte, 8)
    p.drawText(texte, { x: PAGE_W - MARGE - largeurTexte, y: PAGE_H - 24, size: 8, font: fontRegular, color: COULEUR_MUTED })
  }

  const colonnes = [
    { label: 'Objectif', largeur: 235 },
    { label: 'Échéance', largeur: 75 },
    { label: 'Statut', largeur: 75 },
    { label: 'Réalisé le', largeur: 80 },
  ]
  const largeurTableau = colonnes.reduce((s, c) => s + c.largeur, 0)

  let page
  let y

  function nouvellePage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H])
    dessinerFiligrane(page)
    dessinerEnTeteLogo(page)
    y = PAGE_H - 40 - logoHeaderHauteur - 14
    return page
  }

  function enteteTableau() {
    page.drawRectangle({ x: MARGE, y: y - 20, width: largeurTableau, height: 20, color: COULEUR_ENTETE_FOND })
    let x = MARGE
    colonnes.forEach((c) => {
      page.drawText(c.label, { x: x + 6, y: y - 14, size: 9, font: fontBold, color: rgb(1, 1, 1) })
      x += c.largeur
    })
    y -= 20
  }

  // --- Page 1 : en-tête du dossier ---
  nouvellePage()

  // Titre centré et souligné, police serif — même traitement que messagePdf.js.
  const titreLignes = decouperEnLignes(fontTitre, dossier.titre, 15, PAGE_W - 2 * MARGE)
  titreLignes.forEach((l) => {
    const largeurTitre = fontTitre.widthOfTextAtSize(l, 15)
    const xTitre = (PAGE_W - largeurTitre) / 2
    page.drawText(l, { x: xTitre, y, size: 15, font: fontTitre, color: rgb(0, 0, 0) })
    page.drawLine({ start: { x: xTitre, y: y - 3 }, end: { x: xTitre + largeurTitre, y: y - 3 }, thickness: 0.75, color: rgb(0, 0, 0) })
    y -= 26
  })
  y -= 14

  const infos = [
    ['Bénéficiaire', dossier.nom_beneficiaire || '—'],
    ['Responsable secteur', dossier.responsable_secteur?.nom || '—'],
    ['Statut', dossier.date_cloture ? `Clôturé le ${formatDate(dossier.date_cloture)}` : 'En cours'],
    ['Ouvert le', formatDate(dossier.date_ouverture)],
  ]
  infos.forEach(([label, valeur]) => {
    page.drawText(`${label} :`, { x: MARGE, y, size: 10, font: fontBold, color: COULEUR_MUTED })
    page.drawText(String(valeur), { x: MARGE + 130, y, size: 10, font: fontRegular, color: COULEUR_TEXTE })
    y -= 16
  })

  if (dossier.description) {
    y -= 4
    const descLignes = decouperEnLignes(fontRegular, dossier.description, 10, PAGE_W - 2 * MARGE)
    descLignes.forEach((l) => {
      page.drawText(l, { x: MARGE, y, size: 10, font: fontRegular, color: COULEUR_TEXTE })
      y -= 14
    })
  }

  y -= 12
  page.drawText(`Objectifs (${(dossier.objectifs || []).filter((o) => o.fait).length}/${(dossier.objectifs || []).length} réalisés)`, {
    x: MARGE, y, size: 12, font: fontBold, color: COULEUR_TEXTE,
  })
  y -= 18

  enteteTableau()

  // --- Tableau des objectifs, paginé ---
  const objectifs = [...(dossier.objectifs || [])].sort((a, b) => new Date(a.echeance) - new Date(b.echeance))
  const pages = [page]

  objectifs.forEach((o) => {
    const statut = o.fait ? 'Réalisé' : o.en_retard ? 'En retard' : 'À faire'
    const couleurStatut = o.fait ? COULEUR_FAIT : o.en_retard ? COULEUR_RETARD : COULEUR_MUTED
    const descLignes = decouperEnLignes(fontRegular, o.description, 9, colonnes[0].largeur - 12)
    const hauteurLigne = Math.max(descLignes.length * 12, 18) + 6

    if (y - hauteurLigne < MARGE + 20) {
      nouvellePage()
      pages.push(page)
      enteteTableau()
    }

    let x = MARGE
    page.drawRectangle({ x: MARGE, y: y - hauteurLigne, width: largeurTableau, height: hauteurLigne, borderColor: COULEUR_BORDURE, borderWidth: 0.5 })

    descLignes.forEach((l, i) => {
      page.drawText(l, { x: x + 6, y: y - 14 - i * 12, size: 9, font: fontRegular, color: COULEUR_TEXTE })
    })
    x += colonnes[0].largeur
    page.drawText(formatDate(o.echeance), { x: x + 6, y: y - 14, size: 9, font: fontRegular, color: COULEUR_TEXTE })
    x += colonnes[1].largeur
    page.drawText(statut, { x: x + 6, y: y - 14, size: 9, font: fontBold, color: couleurStatut })
    x += colonnes[2].largeur
    page.drawText(o.fait ? formatDate(o.date_realisation) : '—', { x: x + 6, y: y - 14, size: 9, font: fontRegular, color: COULEUR_TEXTE })

    y -= hauteurLigne
  })

  if (objectifs.length === 0) {
    page.drawText('Aucun objectif pour ce dossier.', { x: MARGE + 6, y: y - 14, size: 9, font: fontRegular, color: COULEUR_MUTED })
  }

  pages.forEach((p, i) => {
    dessinerPiedDePage(p, i + 1, pages.length)
  })

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}
