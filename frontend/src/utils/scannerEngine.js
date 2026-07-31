import jscanify from 'jscanify/client'

let cvReadyPromise = null
let scannerInstance = null

/**
 * Charge OpenCV.js (auto-hébergé dans public/vendor, jamais un CDN — l'appli doit
 * fonctionner sur le réseau local sans accès internet) une seule fois, à la
 * demande (pas au chargement de l'appli : ~9 Mo, inutile tant que personne
 * n'ouvre le scanner).
 */
export function chargerOpenCv() {
  if (cvReadyPromise) return cvReadyPromise

  cvReadyPromise = new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = '/vendor/opencv.js'
    script.async = true

    const attendrePret = (tentatives = 0) => {
      if (window.cv && window.cv.Mat) {
        resolve()
      } else if (tentatives > 100) {
        reject(new Error("OpenCV n'a pas pu être initialisé"))
      } else {
        setTimeout(() => attendrePret(tentatives + 1), 100)
      }
    }

    script.onload = () => attendrePret()
    script.onerror = () => reject(new Error("Le chargement d'OpenCV a échoué"))
    document.body.appendChild(script)
  })

  return cvReadyPromise
}

function getScanner() {
  if (!scannerInstance) scannerInstance = new jscanify()
  return scannerInstance
}

function distance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y)
}

/**
 * Convertit une source vidéo en direct en canvas figé. cv.imread() (OpenCV.js)
 * refuse un <video> en direct ("Please input the valid canvas or img id.").
 */
export function figerFrame(source) {
  const estVideo = typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement
  if (!estVideo) return source
  const largeur = source.videoWidth || source.width
  const hauteur = source.videoHeight || source.height
  const snapshot = document.createElement('canvas')
  snapshot.width = largeur
  snapshot.height = hauteur
  snapshot.getContext('2d').drawImage(source, 0, 0, largeur, hauteur)
  return snapshot
}

/**
 * Essaie de détecter automatiquement les 4 coins du document dans un canvas.
 * Renvoie `null` si aucun contour exploitable n'est trouvé — dans ce cas
 * l'appelant doit proposer un cadrage par défaut ajustable à la main (voir
 * `coinsParDefaut` et RognageEditor.jsx) plutôt que de bloquer avec une
 * erreur : jscanify (contour le plus grand + coin le plus éloigné par
 * quadrant) échoue souvent sur une vraie photo — fond texturé, objet qui ne
 * remplit pas tout le cadre (carte, petit document), ombre... ça n'a rien à
 * voir avec l'éclairage.
 */
export function detecterCoins(canvas) {
  const cv = window.cv
  const scanner = getScanner()
  try {
    const img = cv.imread(canvas)
    const contour = scanner.findPaperContour(img)
    img.delete()
    if (!contour) return null

    const corners = scanner.getCornerPoints(contour)
    contour.delete()
    const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = corners
    if (!topLeftCorner || !topRightCorner || !bottomLeftCorner || !bottomRightCorner) return null

    const largeurDoc = (distance(topLeftCorner, topRightCorner) + distance(bottomLeftCorner, bottomRightCorner)) / 2
    const hauteurDoc = (distance(topLeftCorner, bottomLeftCorner) + distance(topRightCorner, bottomRightCorner)) / 2
    if (largeurDoc < 10 || hauteurDoc < 10) return null

    return { corners, largeurDoc, hauteurDoc }
  } catch (error) {
    console.log('Détection auto du contour impossible :', error)
    return null
  }
}

/**
 * Coins par défaut (léger retrait des bords) utilisés comme point de départ
 * de l'ajustement manuel quand la détection automatique n'a rien trouvé
 * d'exploitable (objet petit dans le cadre, comme une carte).
 */
export function coinsParDefaut(canvas) {
  const mx = canvas.width * 0.08
  const my = canvas.height * 0.08
  return {
    topLeftCorner: { x: mx, y: my },
    topRightCorner: { x: canvas.width - mx, y: my },
    bottomLeftCorner: { x: mx, y: canvas.height - my },
    bottomRightCorner: { x: canvas.width - mx, y: canvas.height - my },
  }
}

/**
 * Redresse/recadre `canvas` (correction de perspective) à partir de 4 coins
 * donnés — issus de la détection automatique ou ajustés manuellement par
 * l'utilisateur. On calcule nous-mêmes les dimensions de sortie à partir des
 * coins (au lieu de reprendre bêtement la résolution de la caméra comme le
 * ferait scanner.extractPaper() par défaut) : sans ça, un document portrait
 * capturé dans une frame caméra paysage ressort étiré/déformé.
 */
export function redresserAvecCoins(canvas, corners, largeurDocConnue, hauteurDocConnue) {
  const scanner = getScanner()
  const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = corners
  const largeurDoc = largeurDocConnue || (distance(topLeftCorner, topRightCorner) + distance(bottomLeftCorner, bottomRightCorner)) / 2
  const hauteurDoc = hauteurDocConnue || (distance(topLeftCorner, bottomLeftCorner) + distance(topRightCorner, bottomRightCorner)) / 2

  // Résolution de sortie nette : on garde la résolution native de la zone
  // recadrée (pas d'upscale artificiel flou) avec un plancher pour rester
  // net même si le document/objet occupait une petite partie du cadre.
  const coteLePlusLong = Math.max(largeurDoc, hauteurDoc)
  const echelle = coteLePlusLong < 1600 ? 1600 / coteLePlusLong : 1
  const resultWidth = Math.max(1, Math.round(largeurDoc * echelle))
  const resultHeight = Math.max(1, Math.round(hauteurDoc * echelle))

  try {
    return scanner.extractPaper(canvas, resultWidth, resultHeight, corners) || canvas
  } catch (error) {
    console.log('Recadrage impossible, image brute conservée :', error)
    return canvas
  }
}

/**
 * Améliore le rendu façon "scan" : étirement de contraste automatique
 * (auto-levels, basé sur l'histogramme réel de la photo) + légère netteté,
 * pour un rendu net et lisible plutôt qu'une photo brute.
 *
 * Ne doit jamais faire échouer la capture : si l'amélioration échoue pour
 * une raison quelconque, on renvoie l'image telle quelle plutôt que de
 * bloquer l'utilisateur avec une erreur.
 */
export function ameliorerScan(canvasSource) {
  try {
    const w = canvasSource.width
    const h = canvasSource.height

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(canvasSource, 0, 0)

    const imageData = ctx.getImageData(0, 0, w, h)
    etirerNiveaux(imageData)
    appliquerNettete(imageData)
    ctx.putImageData(imageData, 0, 0)
    return canvas
  } catch (error) {
    console.log("Amélioration de l'image impossible, image brute conservée :", error)
    return canvasSource
  }
}

/**
 * Étirement de contraste automatique (auto-levels) : pousse le fond du
 * document vers le blanc pur et le texte vers le noir en se basant sur les
 * vrais percentiles de luminance de la photo (1,5% de pixels extrêmes
 * ignorés de chaque côté), plutôt qu'un filtre à réglage fixe qui sur- ou
 * sous-corrige selon l'éclairage réel de la prise de vue — c'est ce qui
 * donne un rendu "document scanné" propre et constant.
 */
function etirerNiveaux(imageData) {
  const { data } = imageData
  const total = data.length / 4
  const histogramme = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000 | 0
    histogramme[luminance]++
  }

  const marge = total * 0.015

  let bas = 0
  let cumulBas = 0
  while (bas < 255 && cumulBas + histogramme[bas] < marge) {
    cumulBas += histogramme[bas]
    bas++
  }

  let haut = 255
  let cumulHaut = 0
  while (haut > 0 && cumulHaut + histogramme[haut] < marge) {
    cumulHaut += histogramme[haut]
    haut--
  }

  // Plafond sur le facteur d'étirement : sur une photo à faible contraste
  // (reflet, éclairage inégal), haut-bas peut être très petit et produire un
  // facteur énorme qui crame l'image en noir/blanc quasi pur — rendu
  // catastrophique. On limite l'intensité de la correction plutôt que de
  // l'appliquer intégralement dans ce cas.
  if (haut - bas < 40) return
  const echelle = Math.min(255 / (haut - bas), 3)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, (data[i] - bas) * echelle))
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - bas) * echelle))
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - bas) * echelle))
  }
}

/**
 * Noyau de netteté 3x3 modéré, appliqué canal par canal — canvas ne propose
 * pas de filtre "sharpen" natif contrairement à "contrast"/"brightness".
 * Volontairement plus doux qu'un noyau classique (centre 3 au lieu de 5)
 * pour éviter les halos/bruit disgracieux sur une photo de téléphone.
 */
function appliquerNettete(imageData) {
  const { width, height, data } = imageData
  const noyau = [0, -0.5, 0, -0.5, 3, -0.5, 0, -0.5, 0]
  const copie = new Uint8ClampedArray(data)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let somme = 0
        let k = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4 + c
            somme += copie[idx] * noyau[k]
            k++
          }
        }
        data[(y * width + x) * 4 + c] = somme
      }
    }
  }

  return imageData
}

export function canvasVersFichier(canvas, nomFichier) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob], nomFichier, { type: 'image/jpeg', lastModified: Date.now() })),
      'image/jpeg',
      0.95
    )
  })
}

let moteurOcrPromise = null

/**
 * Prépare le moteur de reconnaissance de texte (Tesseract.js, auto-hébergé
 * dans public/vendor — même principe que chargerOpenCv : rien depuis un CDN,
 * l'appli doit fonctionner sur le réseau local sans accès internet). Chargé
 * à la demande seulement (worker + modèle de langue ~1 Mo), une seule fois.
 */
async function chargerMoteurOcr() {
  if (!moteurOcrPromise) {
    moteurOcrPromise = import('tesseract.js').then(({ createWorker }) => createWorker('fra', 1, {
      workerPath: '/vendor/tesseract/worker.min.js',
      corePath: '/vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
      langPath: '/vendor/tessdata',
      gzip: false,
    }))
  }
  return moteurOcrPromise
}

/**
 * Reconnaît le texte visible sur une page scannée (OCR) — sert uniquement à
 * retrouver un document par son contenu plus tard (recherche), jamais montré
 * comme un champ éditable. Ne doit jamais faire échouer le dépôt : en cas
 * d'échec, on renvoie une chaîne vide plutôt que de bloquer l'utilisateur.
 */
export async function extraireTexte(canvas) {
  try {
    const worker = await chargerMoteurOcr()
    const { data } = await worker.recognize(canvas)
    return (data?.text || '').trim()
  } catch (error) {
    console.log('Reconnaissance de texte impossible :', error)
    return ''
  }
}

/**
 * Assemble plusieurs pages scannées en un seul PDF (une page par image) — pour
 * un dépôt multi-pages où un vrai PDF unique est plus adapté qu'une série de
 * fichiers séparés.
 *
 * Chaque page du PDF est dimensionnée exactement sur les proportions réelles
 * de l'image scannée (au lieu d'un A4 fixe avec l'image réduite/centrée avec
 * des marges) : rendu plein cadre, sans bordures blanches parasites, comme un
 * vrai scanner. 150 DPI équivalent : net à l'impression, taille de fichier
 * raisonnable.
 */
export async function pagesVersPdf(canvases, nomFichier) {
  const { jsPDF } = await import('jspdf')
  const DPI = 150
  const ptParPixel = 72 / DPI

  let doc = null
  canvases.forEach((canvas, i) => {
    const largeurPt = canvas.width * ptParPixel
    const hauteurPt = canvas.height * ptParPixel
    const orientation = largeurPt > hauteurPt ? 'landscape' : 'portrait'

    if (i === 0) {
      doc = new jsPDF({ unit: 'pt', format: [largeurPt, hauteurPt], orientation })
    } else {
      doc.addPage([largeurPt, hauteurPt], orientation)
    }
    doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, largeurPt, hauteurPt)
  })

  const blob = doc.output('blob')
  return new File([blob], nomFichier, { type: 'application/pdf', lastModified: Date.now() })
}
