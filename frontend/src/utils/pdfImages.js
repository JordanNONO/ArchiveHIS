// Chargement d'image partagé par les générateurs de PDF (messagePdf.js,
// exportCourriers.js, exportAppels.js...) — mis en cache par source : dans
// une même session, plusieurs PDF peuvent être générés successivement sans
// avoir à recharger/redimensionner l'image à chaque fois.
//
// Les fichiers sources sont bien plus grands que leur taille d'affichage dans
// le document (his-logo.png fait 2755×1767 pour quelques centaines de pt
// affichés). jsPDF embarque une image en pixels bruts (RGBA non compressé) :
// non redimensionnée, elle alourdirait le PDF de plusieurs Mo pour rien. On
// la redessine donc sur un <canvas> à une taille raisonnable avant de
// l'embarquer.
const imagesDataUrlCache = new Map()

export function chargerImageDataUrl(src, largeurCiblePx, format = 'image/png') {
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
