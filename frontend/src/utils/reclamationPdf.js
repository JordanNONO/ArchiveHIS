import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { ecrireMultiligne } from './pdfTexte'

/**
 * Superpose les réponses de la fiche de réclamation directement sur le vrai
 * gabarit PDF fourni par HIS (frontend/public/templates/reclamation_template.pdf)
 * — même principe que congesPdf.js. Coordonnées en points, repère natif de
 * pdf-lib (origine bas-gauche), calées sur les positions réelles du texte du
 * gabarit (extraites via pdfjs-dist getTextContent()).
 *
 * "Objet"/"Réclamation" sont remplis par le déposant (intervenant ou
 * bénéficiaire — voir COORDS.cocheClient/cocheSalarie) au moment du dépôt ;
 * "Suivi par"/"Délai de réclamation"/"Actions correctives" sont réservés au
 * traitement interne, remplis ensuite par RH (voir genererPdfCompletionReclamation,
 * appelé depuis DocView.jsx) — jamais par le déposant lui-même.
 */
const COORDS = {
  nomPrenom: { x: 155, y: 649.6 },
  cocheClient: { x: 470.4, y: 649.6 },
  cocheSalarie: { x: 468.2, y: 622 },
  date: { x: 102, y: 622 },

  objet: { x: 115, y: 515.7 },
  // Bloc "Réclamation" du gabarit : x 72.3→523.1, y 294.3→473.9 (label à
  // y=448.94) — largeur/maxLignes calés sur ces vraies limites pour que le
  // texte remplisse le bloc sans le déborder (voir ecrireMultiligne).
  reclamation: { x: 77, y: 427, ligneHauteur: 13.5, maxLignes: 9, largeur: 430 },

  // Section interne — voir genererPdfCompletionReclamation ci-dessous.
  suiviPar: { x: 125, y: 594.4 },
  delaiReclamation: { x: 182, y: 566.8 },
  // Bloc "Actions correctives" : x 72.3→523.1, y 98.2→263.8 (label à y=238.87).
  actionsCorrectives: { x: 77, y: 217, ligneHauteur: 13.5, maxLignes: 8, largeur: 430 },
}

async function chargerGabarit() {
  const reponse = await fetch('/templates/reclamation_template.pdf')
  if (!reponse.ok) {
    throw new Error('Gabarit de fiche de réclamation introuvable')
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
 * nomPrenom, profil ('Client'|'Salarié'), date (Date), objet, reclamation
 */
export async function genererPdfReclamation(valeurs) {
  const gabaritBytes = await chargerGabarit()
  const pdfDoc = await PDFDocument.load(gabaritBytes)
  const page = pdfDoc.getPage(0)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  ecrire(page, font, valeurs.nomPrenom, COORDS.nomPrenom)

  if (valeurs.profil === 'Client') {
    ecrireCoche(page, font, COORDS.cocheClient)
  } else if (valeurs.profil === 'Salarié') {
    ecrireCoche(page, font, COORDS.cocheSalarie)
  }

  if (valeurs.date) {
    const jj = String(valeurs.date.getDate()).padStart(2, '0')
    const mm = String(valeurs.date.getMonth() + 1).padStart(2, '0')
    const aaaa = valeurs.date.getFullYear()
    ecrire(page, font, `${jj}/${mm}/${aaaa}`, COORDS.date)
  }

  ecrire(page, font, valeurs.objet, COORDS.objet, 9.5)
  ecrireMultiligne(page, font, valeurs.reclamation, COORDS.reclamation, 9.5)

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

/**
 * Complète un PDF de réclamation DÉJÀ déposé (celui généré par
 * genererPdfReclamation ci-dessus, récupéré via son lien signé) avec le
 * traitement interne — appelé côté RH (voir DocView.jsx). `pdfBytes` :
 * ArrayBuffer du fichier existant.
 *
 * `valeurs` attend : suiviPar, delaiReclamation, actionsCorrectives
 */
export async function genererPdfCompletionReclamation(pdfBytes, valeurs) {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const page = pdfDoc.getPage(0)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  ecrire(page, font, valeurs.suiviPar, COORDS.suiviPar, 9.5)
  ecrire(page, font, valeurs.delaiReclamation, COORDS.delaiReclamation, 9.5)
  ecrireMultiligne(page, font, valeurs.actionsCorrectives, COORDS.actionsCorrectives, 9.5)

  const pdfBytesFinal = await pdfDoc.save()
  return new Blob([pdfBytesFinal], { type: 'application/pdf' })
}
