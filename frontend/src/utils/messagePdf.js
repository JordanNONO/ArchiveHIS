/**
 * Génère un PDF simple (titre + message) pour un dépôt qui n'a ni pièce
 * jointe ni message vocal — ex: un signalement rédigé seulement en texte.
 * Le modèle de document (DocumentArchive) exige toujours un fichier ; plutôt
 * qu'un .txt brut, un PDF propre reste cohérent avec le reste de l'archive.
 * jsPDF est importé dynamiquement pour ne pas alourdir le bundle initial
 * d'un cas d'usage marginal.
 */
export async function genererPdfMessage({ titre, message, auteur, date = new Date() }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margeGauche = 56
  let y = 72

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(titre, margeGauche, y)
  y += 26

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(`${auteur} — ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, margeGauche, y)
  y += 24

  doc.setDrawColor(226, 232, 240)
  doc.line(margeGauche, y, 595 - 56, y)
  y += 24

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(31, 41, 55)
  const lignes = doc.splitTextToSize(message, 595 - margeGauche - 56)
  doc.text(lignes, margeGauche, y)

  return doc.output('blob')
}
