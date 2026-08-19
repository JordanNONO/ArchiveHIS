import hisLogo from '../assets/his-logo.png'
import badgeServicesPersonne from '../assets/logo-services-a-la-personne.jpg'
import badgeCapHandeo from '../assets/logo-cap-handeo.jpg'

// Chargées une seule fois puis mises en cache : plusieurs dépôts (signalements,
// réclamations sans pièce jointe...) peuvent générer un PDF dans la même
// session, pas la peine de recharger/redimensionner ces images à chaque fois.
//
// Les fichiers sources sont bien plus grands que leur taille d'affichage dans
// le document (his-logo.png fait 2755×1767 pour ~140pt affichés). jsPDF
// embarque une image en pixels bruts (RGBA non compressé) : au premier essai,
// un logo source non redimensionné produisait à lui seul un PDF de ~19 Mo pour
// un simple message d'une ligne. On les redessine donc sur un <canvas> à une
// taille raisonnable avant de les embarquer — réencodées à cette résolution,
// elles ne pèsent plus que quelques dizaines de Ko.
const imagesDataUrlCache = new Map()
function chargerImageDataUrl(src, largeurCiblePx, format = 'image/png') {
  if (!imagesDataUrlCache.has(src)) {
    imagesDataUrlCache.set(src, new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const ratio = img.naturalHeight / img.naturalWidth
        const canvas = document.createElement('canvas')
        canvas.width = largeurCiblePx
        canvas.height = Math.round(largeurCiblePx * ratio)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL(format))
      }
      img.onerror = () => resolve(null) // image indisponible : le PDF reste généré, juste sans elle
      img.src = src
    }))
  }
  return imagesDataUrlCache.get(src)
}

/**
 * Génère un PDF simple (titre + message) pour un dépôt qui n'a ni pièce
 * jointe ni message vocal — ex: un signalement rédigé seulement en texte.
 * Le modèle de document (DocumentArchive) exige toujours un fichier ; plutôt
 * qu'un .txt brut, un PDF propre reste cohérent avec le reste de l'archive.
 * jsPDF est importé dynamiquement pour ne pas alourdir le bundle initial
 * d'un cas d'usage marginal.
 *
 * Reprend la même mise en page que les vrais gabarits HIS (voir
 * frontend/public/templates/reclamation_template.pdf, chargé par
 * reclamationPdf.js) : logo en haut à gauche, police serif, titre souligné
 * centré, champs "Nom et prénom"/"Date", encadré noir pour le contenu, pied
 * de page avec les coordonnées de l'entreprise — plutôt qu'une identité
 * inventée qui détonnait à côté des autres documents de l'archive.
 */
export async function genererPdfMessage({ titre, message, auteur, date = new Date() }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margeGauche = 56
  const margeDroite = pageWidth - 56

  const [logoDataUrl, badgeDataUrl, badgeHandeoDataUrl] = await Promise.all([
    chargerImageDataUrl(hisLogo, 480),
    chargerImageDataUrl(badgeServicesPersonne, 300, 'image/jpeg'),
    chargerImageDataUrl(badgeCapHandeo, 300, 'image/jpeg'),
  ])
  if (logoDataUrl) {
    const largeurLogo = 140
    const hauteurLogo = largeurLogo * (1767 / 2755)
    doc.addImage(logoDataUrl, 'PNG', margeGauche, 40, largeurLogo, hauteurLogo)
  }

  let y = 190

  doc.setFont('times', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(0, 0, 0)
  const largeurTitre = doc.getTextWidth(titre)
  doc.text(titre, pageWidth / 2, y, { align: 'center' })
  doc.setLineWidth(0.75)
  doc.line((pageWidth - largeurTitre) / 2, y + 3, (pageWidth + largeurTitre) / 2, y + 3)
  y += 40

  doc.setFont('times', 'normal')
  doc.setFontSize(11)
  doc.text(`Nom et prénom : ${auteur}`, margeGauche, y)
  y += 22
  doc.text(`Date : ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, margeGauche, y)
  y += 32

  doc.setFont('times', 'italic')
  doc.setFontSize(10.5)
  doc.text('Message :', margeGauche + 10, y)
  y += 8

  const hauteurEncadre = 380
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(1)
  doc.rect(margeGauche, y, margeDroite - margeGauche, hauteurEncadre)
  y += 26

  doc.setFont('times', 'normal')
  doc.setFontSize(11)
  const lignes = doc.splitTextToSize(message, margeDroite - margeGauche - 24)
  doc.text(lignes, margeGauche + 12, y)

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(margeGauche, pageHeight - 56, margeDroite, pageHeight - 56)
  doc.setFont('times', 'normal')
  doc.setFontSize(8)
  doc.text(
    ['8 place Georges Braque, 93120 La Courneuve  Tél: 01 43 52 64 23  Fax: 01 43 11 09 67',
      'Sarl au Capital de 840 000 euros, Siret : 493 761 175 00030 R.C.S.Bobigny',
      'APE 9609Z. Agrément Qualité Préfectorale : SAP493761175'],
    pageWidth / 2,
    pageHeight - 44,
    { align: 'center' },
  )

  // Même bandeau bas que le gabarit officiel (voir reclamation_template.pdf) :
  // le badge "Cap'Handéo" à gauche, le badge "Services à la personne" à droite.
  if (badgeHandeoDataUrl) {
    const largeurBadge = 50
    const hauteurBadge = largeurBadge * (129 / 216)
    doc.addImage(badgeHandeoDataUrl, 'JPEG', margeGauche, pageHeight - 58, largeurBadge, hauteurBadge)
  }
  if (badgeDataUrl) {
    const largeurBadge = 50
    const hauteurBadge = largeurBadge * (112 / 188)
    doc.addImage(badgeDataUrl, 'JPEG', margeDroite - largeurBadge, pageHeight - 58, largeurBadge, hauteurBadge)
  }

  return doc.output('blob')
}
