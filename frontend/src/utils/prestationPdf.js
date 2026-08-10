import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

/**
 * "Fiche de demande de prestation" — recycle littéralement le gabarit PDF de
 * la fiche réclamation (frontend/public/templates/reclamation_template.pdf,
 * voir reclamationPdf.js) comme base : sa page est copiée telle quelle, puis
 * seul le bloc central propre à la réclamation (titre + champs) est effacé
 * et remplacé. L'en-tête (logo HIS + "HETEP-IAOUT SERVICES" + slogan) et le
 * pied de page (adresse/Fax/Siret/agrément + les deux logos de certification)
 * restent donc les mêmes octets que sur la fiche réclamation — identiques par
 * construction, plutôt qu'une tentative de les reproduire à la main avec des
 * polices/couleurs/logos qui finissent toujours par légèrement diverger.
 *
 * Coordonnées du bloc à effacer et du titre calées sur celles réellement
 * extraites du gabarit (voir reclamationPdf.js pour "Nom et prénom" etc., et
 * la même méthode — pdfjs-dist getTextContent()/getOperatorList() — pour le
 * titre "FICHE DE RECLAMATION" à y=686.6 et le repère bas de zone à y≈90,
 * juste au-dessus de la ligne de séparation du pied de page à y=71.1).
 */
const PAGE_WIDTH = 595.2
const MARGE_GAUCHE = 70.8
const LARGEUR_UTILE = PAGE_WIDTH - MARGE_GAUCHE * 2
const Y_HAUT_ZONE_EFFACEE = 715
const Y_BAS_ZONE_EFFACEE = 90
const Y_TITRE = 686.6

const PRESTATIONS = [
  'Ménage, courses, repassage + Cuisine',
  'Aide Toilette / habillage',
  'Animation de vie',
  'Accompagnement en extérieur ou malades',
  "Garde d'enfants +3 ans",
  'Surveillance de nuit',
  'Assistance 24/24',
]

async function chargerGabarit() {
  const reponse = await fetch('/templates/reclamation_template.pdf')
  if (!reponse.ok) {
    throw new Error('Gabarit de fiche réclamation introuvable')
  }
  return reponse.arrayBuffer()
}

function texteCentre(page, font, texte, y, taille = 10, couleur = rgb(0, 0, 0)) {
  const largeur = font.widthOfTextAtSize(texte, taille)
  page.drawText(texte, { x: (PAGE_WIDTH - largeur) / 2, y, size: taille, font, color: couleur })
}

// Gras noir, sans soulignement — comme "Objet :"/"Réclamation :" sur le
// gabarit (seul le TITRE de la fiche, dessiné à part, est souligné).
function etiquette(page, fontTitre, texte, y) {
  page.drawText(texte, { x: MARGE_GAUCHE, y, size: 11, font: fontTitre, color: rgb(0, 0, 0) })
}

function champ(page, font, fontTitre, label, valeur, y) {
  const prefixe = `${label} : `
  page.drawText(prefixe, { x: MARGE_GAUCHE, y, size: 10, font: fontTitre, color: rgb(0, 0, 0) })
  page.drawText(String(valeur ?? ''), { x: MARGE_GAUCHE + fontTitre.widthOfTextAtSize(prefixe, 10), y, size: 10, font, color: rgb(0.07, 0.07, 0.07) })
}

function boiteRectangle(page, yHaut, yBas) {
  page.drawRectangle({
    x: MARGE_GAUCHE - 10,
    y: yBas,
    width: LARGEUR_UTILE + 20,
    height: yHaut - yBas,
    borderColor: rgb(0.1, 0.1, 0.1),
    borderWidth: 1,
  })
}

function ecrireMultiligne(page, font, texte, x, yDepart, ligneHauteur, maxLignes, taille = 10) {
  if (!texte) return
  const mots = String(texte).split(/\s+/)
  let ligne = ''
  const lignes = []
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot
    if (font.widthOfTextAtSize(essai, taille) > LARGEUR_UTILE - 20) {
      lignes.push(ligne)
      ligne = mot
    } else {
      ligne = essai
    }
  }
  if (ligne) lignes.push(ligne)
  lignes.slice(0, maxLignes).forEach((l, i) => {
    page.drawText(l, { x, y: yDepart - i * ligneHauteur, size: taille, font, color: rgb(0.07, 0.07, 0.07) })
  })
}

/**
 * `valeurs` attend :
 * nomPrenom, date (Date), prestations (string[] — libellés parmi PRESTATIONS),
 * rythme ('Quotidienne'|'Hebdomadaire'|'Mensuelle'), recurrence ('Récurrente'|'Ponctuelle'),
 * horaires (string)
 */
export async function genererPdfPrestation(valeurs) {
  const gabaritBytes = await chargerGabarit()
  const gabaritDoc = await PDFDocument.load(gabaritBytes)
  const pdfDoc = await PDFDocument.create()
  const [page] = await pdfDoc.copyPages(gabaritDoc, [0])
  pdfDoc.addPage(page)

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontGras = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontTitre = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

  // N'efface que le bloc central (titre + champs) — l'en-tête au-dessus et
  // le pied de page en-dessous restent le gabarit tel quel.
  page.drawRectangle({
    x: 0,
    y: Y_BAS_ZONE_EFFACEE,
    width: PAGE_WIDTH,
    height: Y_HAUT_ZONE_EFFACEE - Y_BAS_ZONE_EFFACEE,
    color: rgb(1, 1, 1),
  })

  let y = Y_TITRE
  texteCentre(page, fontTitre, 'FICHE DE DEMANDE DE PRESTATION', y, 16)
  const largeurTitre = fontTitre.widthOfTextAtSize('FICHE DE DEMANDE DE PRESTATION', 16)
  page.drawLine({ start: { x: (PAGE_WIDTH - largeurTitre) / 2, y: y - 5 }, end: { x: (PAGE_WIDTH + largeurTitre) / 2, y: y - 5 }, thickness: 1, color: rgb(0, 0, 0) })

  y -= 38
  etiquette(page, fontTitre, 'Bénéficiaire', y)
  y -= 22
  champ(page, font, fontTitre, 'Nom et prénom', valeurs.nomPrenom, y)
  y -= 18
  if (valeurs.date) {
    const jj = String(valeurs.date.getDate()).padStart(2, '0')
    const mm = String(valeurs.date.getMonth() + 1).padStart(2, '0')
    champ(page, font, fontTitre, 'Date', `${jj}/${mm}/${valeurs.date.getFullYear()}`, y)
  }

  y -= 34
  etiquette(page, fontTitre, 'Prestation(s) demandée(s)', y)
  y -= 14
  const yHautBoitePrestations = y
  y -= 16
  PRESTATIONS.forEach((libelle) => {
    const cochee = (valeurs.prestations || []).includes(libelle)
    // Case centrée sur la hauteur visuelle du libellé (capitales), pas sur sa
    // ligne de base : drawText positionne le texte par sa base, donc une case
    // calée sur ce même y retomberait ~7pt trop bas par rapport au texte.
    page.drawRectangle({ x: MARGE_GAUCHE, y: y - 1.5, width: 10, height: 10, borderColor: rgb(0.1, 0.1, 0.1), borderWidth: 1 })
    if (cochee) {
      page.drawText('X', { x: MARGE_GAUCHE + 1.8, y: y - 1, size: 9, font: fontGras, color: rgb(0, 0, 0) })
    }
    page.drawText(libelle, { x: MARGE_GAUCHE + 18, y, size: 10, font, color: rgb(0.07, 0.07, 0.07) })
    y -= 20
  })
  boiteRectangle(page, yHautBoitePrestations, y + 6)

  y -= 24
  etiquette(page, fontTitre, 'Fréquence', y)
  y -= 22
  champ(page, font, fontTitre, 'Rythme', valeurs.rythme, y)
  y -= 18
  champ(page, font, fontTitre, 'Type', valeurs.recurrence, y)

  y -= 34
  etiquette(page, fontTitre, 'Horaires souhaités', y)
  y -= 14
  const yHautBoiteHoraires = y
  y -= 20
  ecrireMultiligne(page, font, valeurs.horaires, MARGE_GAUCHE, y, 14, 6)
  const yBasBoiteHoraires = y - 14 * 6 + 6
  boiteRectangle(page, yHautBoiteHoraires, yBasBoiteHoraires)

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

export { PRESTATIONS }
