import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/**
 * Contrairement à congesPdf.js/reclamationPdf.js, un courrier sortant n'a pas
 * de justificatif papier existant à overlayer (voir CourrierForm.jsx) — ce
 * PDF est entièrement dessiné, comme fiche récapitulative de l'envoi.
 */
export async function genererPdfCourrierSortant(valeurs) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 portrait, en points
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const marge = 50
  let y = 780

  page.drawText('HIS Archivage — Courrier sortant', {
    x: marge, y, size: 16, font: fontBold, color: rgb(0.11, 0.21, 0.36),
  })
  y -= 28
  page.drawLine({ start: { x: marge, y }, end: { x: 595.28 - marge, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) })
  y -= 30

  function ligne(label, valeur) {
    if (!valeur) return
    page.drawText(`${label} :`, { x: marge, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(String(valeur), { x: marge + 160, y, size: 10, font: fontRegular, color: rgb(0.07, 0.07, 0.07) })
    y -= 22
  }

  ligne('Référence', valeurs.reference)
  ligne('Type', valeurs.typeEnvoi)
  ligne('N° du recommandé', valeurs.numeroRecommande)
  ligne('Nombre de documents', valeurs.nombreDocuments)
  ligne('Date d’envoi', valeurs.dateEnvoi)
  ligne('Auteur du courrier', valeurs.auteur)
  ligne('Destinataire', valeurs.destinataire)
  ligne('Adresse', valeurs.adresse)
  ligne('Objet', valeurs.objet)

  if (valeurs.contenu) {
    y -= 10
    page.drawText('Contenu / Commentaire :', { x: marge, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
    y -= 18
    const mots = String(valeurs.contenu).split(/\s+/)
    let ligneTexte = ''
    const largeurMax = 595.28 - marge * 2
    for (const mot of mots) {
      const essai = ligneTexte ? `${ligneTexte} ${mot}` : mot
      if (fontRegular.widthOfTextAtSize(essai, 10) > largeurMax) {
        page.drawText(ligneTexte, { x: marge, y, size: 10, font: fontRegular, color: rgb(0.07, 0.07, 0.07) })
        y -= 16
        ligneTexte = mot
      } else {
        ligneTexte = essai
      }
    }
    if (ligneTexte) page.drawText(ligneTexte, { x: marge, y, size: 10, font: fontRegular, color: rgb(0.07, 0.07, 0.07) })
  }

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}
