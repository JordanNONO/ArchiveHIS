import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { ecrireMultiligne } from './pdfTexte'

/**
 * Superpose les réponses du formulaire de demande de congés directement sur le
 * vrai gabarit PDF fourni par HIS (frontend/public/templates/demande_conges_template.pdf)
 * plutôt que de recréer la mise en page — le rendu final reste donc identique au
 * document officiel papier, seules les valeurs saisies s'y ajoutent.
 *
 * Coordonnées en points, repère natif de pdf-lib (origine bas-gauche, y croît
 * vers le haut) — calées précisément sur les positions réelles du texte du
 * gabarit (extraites via pdfjs-dist `getTextContent()`), pas estimées à l'œil.
 */
const COORDS = {
  nomPrenom: { x: 185, y: 642.3 },
  fonction: { x: 155, y: 628.7 },
  adresse: { x: 150, y: 614.9 },
  telephone: { x: 210, y: 601.2 },
  email: { x: 145, y: 587.5 },

  duJour: { x: 127, y: 508.9 },
  duMois: { x: 161, y: 508.9 },
  duAnnee: { x: 195, y: 508.9 },
  auJour: { x: 127, y: 495.7 },
  auMois: { x: 161, y: 495.7 },
  auAnnee: { x: 195, y: 495.7 },

  nombreJours: { x: 114, y: 455.6 },

  dernierJour: { x: 109, y: 415.6 },
  dernierMois: { x: 143, y: 415.6 },
  dernierAnnee: { x: 178, y: 415.6 },

  repriseJour: { x: 109, y: 375.5 },
  repriseMois: { x: 143, y: 375.5 },
  repriseAnnee: { x: 178, y: 375.5 },

  // Coche dessinée juste devant chaque case ☐ de la colonne "Nature du congé"
  // (le rectangle de la case elle-même appartient au gabarit)
  cochePaye: { x: 353, y: 480.2 },
  cocheSansSolde: { x: 353, y: 465.6 },
  cocheEvenementFamilial: { x: 353, y: 451 },
  cochePaternite: { x: 353, y: 423.4 },
  cocheAutre: { x: 353, y: 395.7 },
  // Ligne pointillée du gabarit : x 351.4→523.9 (largeur ~171pt) — largeur
  // calée dessus pour que le texte ne parte pas se superposer à la colonne
  // voisine (voir ecrireMultiligne).
  autreTexte: { x: 353, y: 382.4, ligneHauteur: 13.2, maxLignes: 6, largeur: 165 },

  lieu: { x: 380, y: 289.6 },
  date: { x: 382, y: 275.9 },
  // Zone où vient s'incruster l'image de la signature dessinée (ou le nom tapé),
  // entre le libellé "Signature du demandeur :" (y=262.3) et la section suivante
  signature: { x: 380, y: 188, largeur: 150, hauteur: 55 },
  signatureTexte: { x: 380, y: 215 },

  // Section 3 "Décision de l'employeur" — remplie par le responsable secteur
  // au moment de valider/rejeter, jamais par le demandeur (voir DocView.jsx).
  cocheAccord: { x: 109, y: 215.1 },
  cocheRefus: { x: 109, y: 200.3 },
  // Zone libre avant la colonne "Date de la décision" qui démarre à x=333.4
  // — largeur bornée pour ne pas empiéter dessus.
  motifRefus: { x: 106.8, y: 157, ligneHauteur: 13, maxLignes: 7, largeur: 210 },
  dateDecisionJour: { x: 354, y: 156.3 },
  dateDecisionMois: { x: 388, y: 156.3 },
  dateDecisionAnnee: { x: 423, y: 156.3 },
  nomSignataire: { x: 353, y: 129.4 },
  // Zone de signature du signataire RH, sous le libellé "Signature" (y=116.2)
  // et au-dessus du filet de pied de page (~y=71) — espace plus restreint que
  // celui du demandeur, d'où une image plus petite.
  signatureRH: { x: 353, y: 82, largeur: 140, hauteur: 32 },
  signatureRHTexte: { x: 353, y: 95 },
}

async function chargerGabarit() {
  const reponse = await fetch('/templates/demande_conges_template.pdf')
  if (!reponse.ok) {
    throw new Error('Gabarit de demande de congés introuvable')
  }
  return reponse.arrayBuffer()
}

function ecrire(page, font, texte, coord, taille = 10) {
  if (!texte) return
  page.drawText(String(texte), {
    x: coord.x,
    y: coord.y,
    size: taille,
    font,
    color: rgb(0.07, 0.07, 0.07),
  })
}

function ecrireCoche(page, font, coord) {
  ecrire(page, font, 'X', coord, 11)
}

/**
 * `valeurs` attend :
 * nomPrenom, fonction, adresse, telephone, email,
 * du (Date), au (Date), nombreJours, dernierJour (Date), reprise (Date),
 * nature ('Payé'|'Sans solde'|'Évènement familial'|'Paternité'|'Autre'), autreTexte,
 * lieu, date (Date), signatureDataUrl (PNG dataURL) OU signatureTexte (nom tapé + certifié)
 */
export async function genererPdfConges(valeurs) {
  const gabaritBytes = await chargerGabarit()
  const pdfDoc = await PDFDocument.load(gabaritBytes)
  const page = pdfDoc.getPage(0)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const jj = (d) => String(d.getDate()).padStart(2, '0')
  const mm = (d) => String(d.getMonth() + 1).padStart(2, '0')
  const aaaa = (d) => String(d.getFullYear())

  ecrire(page, font, valeurs.nomPrenom, COORDS.nomPrenom)
  ecrire(page, font, valeurs.fonction, COORDS.fonction)
  ecrire(page, font, valeurs.adresse, COORDS.adresse, 9)
  ecrire(page, font, valeurs.telephone, COORDS.telephone)
  ecrire(page, font, valeurs.email, COORDS.email, 9)

  if (valeurs.du) {
    ecrire(page, font, jj(valeurs.du), COORDS.duJour)
    ecrire(page, font, mm(valeurs.du), COORDS.duMois)
    ecrire(page, font, aaaa(valeurs.du), COORDS.duAnnee)
  }
  if (valeurs.au) {
    ecrire(page, font, jj(valeurs.au), COORDS.auJour)
    ecrire(page, font, mm(valeurs.au), COORDS.auMois)
    ecrire(page, font, aaaa(valeurs.au), COORDS.auAnnee)
  }

  ecrire(page, font, valeurs.nombreJours, COORDS.nombreJours, 9)

  if (valeurs.dernierJour) {
    ecrire(page, font, jj(valeurs.dernierJour), COORDS.dernierJour)
    ecrire(page, font, mm(valeurs.dernierJour), COORDS.dernierMois)
    ecrire(page, font, aaaa(valeurs.dernierJour), COORDS.dernierAnnee)
  }
  if (valeurs.reprise) {
    ecrire(page, font, jj(valeurs.reprise), COORDS.repriseJour)
    ecrire(page, font, mm(valeurs.reprise), COORDS.repriseMois)
    ecrire(page, font, aaaa(valeurs.reprise), COORDS.repriseAnnee)
  }

  const casesParNature = {
    'Payé': COORDS.cochePaye,
    'Sans solde': COORDS.cocheSansSolde,
    'Évènement familial': COORDS.cocheEvenementFamilial,
    'Paternité': COORDS.cochePaternite,
    'Autre': COORDS.cocheAutre,
  }
  if (casesParNature[valeurs.nature]) {
    ecrireCoche(page, font, casesParNature[valeurs.nature])
  }
  if (valeurs.nature === 'Autre' && valeurs.autreTexte) {
    ecrireMultiligne(page, font, valeurs.autreTexte, COORDS.autreTexte, 9)
  }

  ecrire(page, font, valeurs.lieu, COORDS.lieu, 10)
  if (valeurs.date) {
    const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
    const texteDate = `${joursSemaine[valeurs.date.getDay()]} ${valeurs.date.getDate()} ${mois[valeurs.date.getMonth()]} ${valeurs.date.getFullYear()}`
    ecrire(page, font, texteDate, COORDS.date, 9)
  }

  if (valeurs.signatureDataUrl) {
    const image = await pdfDoc.embedPng(valeurs.signatureDataUrl)
    page.drawImage(image, {
      x: COORDS.signature.x,
      y: COORDS.signature.y,
      width: COORDS.signature.largeur,
      height: COORDS.signature.hauteur,
    })
  } else if (valeurs.signatureTexte) {
    const italique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
    page.drawText(valeurs.signatureTexte, {
      x: COORDS.signatureTexte.x,
      y: COORDS.signatureTexte.y,
      size: 11,
      font: italique,
      color: rgb(0.07, 0.07, 0.07),
    })
  }

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

/**
 * Complète un PDF de demande de congés DÉJÀ déposé (celui généré par
 * genererPdfConges ci-dessus, récupéré via son lien signé) avec la section 3
 * "Décision de l'employeur" — appelé côté RH au moment de valider/rejeter
 * (voir DocView.jsx). `pdfBytes` : ArrayBuffer du fichier existant.
 *
 * `valeurs` attend :
 * reponse ('Accord'|'Refus'), motif (si Refus), dateDecision (Date),
 * nomSignataire (string, "Prénom Nom — Fonction"),
 * signatureDataUrl (PNG dataURL) OU signatureTexte (nom tapé + certifié)
 */
export async function genererPdfDecisionConges(pdfBytes, valeurs) {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const page = pdfDoc.getPage(0)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const jj = (d) => String(d.getDate()).padStart(2, '0')
  const mm = (d) => String(d.getMonth() + 1).padStart(2, '0')
  const aaaa = (d) => String(d.getFullYear())

  if (valeurs.reponse === 'Accord') {
    ecrireCoche(page, font, COORDS.cocheAccord)
  } else if (valeurs.reponse === 'Refus') {
    ecrireCoche(page, font, COORDS.cocheRefus)
    if (valeurs.motif) ecrireMultiligne(page, font, valeurs.motif, COORDS.motifRefus, 9)
  }

  if (valeurs.dateDecision) {
    ecrire(page, font, jj(valeurs.dateDecision), COORDS.dateDecisionJour)
    ecrire(page, font, mm(valeurs.dateDecision), COORDS.dateDecisionMois)
    ecrire(page, font, aaaa(valeurs.dateDecision), COORDS.dateDecisionAnnee)
  }

  ecrire(page, font, valeurs.nomSignataire, COORDS.nomSignataire, 9)

  if (valeurs.signatureDataUrl) {
    const image = await pdfDoc.embedPng(valeurs.signatureDataUrl)
    page.drawImage(image, {
      x: COORDS.signatureRH.x,
      y: COORDS.signatureRH.y,
      width: COORDS.signatureRH.largeur,
      height: COORDS.signatureRH.hauteur,
    })
  } else if (valeurs.signatureTexte) {
    const italique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
    page.drawText(valeurs.signatureTexte, {
      x: COORDS.signatureRHTexte.x,
      y: COORDS.signatureRHTexte.y,
      size: 10,
      font: italique,
      color: rgb(0.07, 0.07, 0.07),
    })
  }

  const pdfBytesFinal = await pdfDoc.save()
  return new Blob([pdfBytesFinal], { type: 'application/pdf' })
}
