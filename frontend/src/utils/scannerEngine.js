import jscanify from 'jscanify/client'

/**
 * Moteur du scanner de documents (voir components/scanner/) : détection des
 * bords (OpenCV + jscanify), redressement de perspective, rotation, filtres
 * "scan", rendu des pages, OCR et assemblage en un seul PDF.
 *
 * Une page vit sous forme de Blob JPEG, jamais de canvas conservé : Safari iOS
 * plafonne la mémoire cumulée des canvas (quelques photos de 12 Mpx suffisaient
 * à produire des pages blanches ou un toBlob() nul). Les canvas ne servent que
 * le temps d'un traitement et sont libérés aussitôt (libererCanvas).
 */

let cvReadyPromise = null
let scannerInstance = null

/**
 * Plus grand côté (en pixels) d'une photo source ou d'une page rendue. Au-delà,
 * rien ne gagne en lisibilité (≈ 200 DPI sur un A4) mais tout se dégrade sur
 * téléphone : mémoire, lenteur des filtres, envoi en données mobiles.
 */
export const COTE_MAX_PAGE = 2400

// Largeur de travail de la détection des bords : jscanify sur une photo
// pleine résolution est lent et pas plus précis.
const LARGEUR_DETECTION = 800

export const FILTRES = ['auto', 'nb', 'original']

export const CLES_COINS = ['topLeftCorner', 'topRightCorner', 'bottomRightCorner', 'bottomLeftCorner']

/**
 * Charge OpenCV.js (auto-hébergé dans public/vendor, jamais un CDN — l'appli doit
 * fonctionner sur le réseau local sans accès internet) une seule fois, à la
 * demande (pas au chargement de l'appli : ~9 Mo, inutile tant que personne
 * n'ouvre le scanner). En cas d'échec, la promesse n'est pas gardée en cache :
 * une prochaine ouverture du scanner réessaie.
 */
export function chargerOpenCv() {
  if (cvReadyPromise) return cvReadyPromise

  cvReadyPromise = new Promise((resolve, reject) => {
    if (opencvPret()) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = '/vendor/opencv.js'
    script.async = true

    const echouer = (message) => {
      cvReadyPromise = null
      script.remove()
      reject(new Error(message))
    }

    // 30 s : la compilation WASM d'OpenCV prend facilement plus de 10 s sur
    // un téléphone d'entrée de gamme.
    const attendrePret = (tentatives = 0) => {
      if (opencvPret()) resolve()
      else if (tentatives > 300) echouer("OpenCV n'a pas pu être initialisé")
      else setTimeout(() => attendrePret(tentatives + 1), 100)
    }

    script.onload = () => attendrePret()
    script.onerror = () => echouer("Le chargement d'OpenCV a échoué")
    document.body.appendChild(script)
  })

  return cvReadyPromise
}

export function opencvPret() {
  return !!(window.cv && window.cv.Mat)
}

function getScanner() {
  if (!scannerInstance) scannerInstance = new jscanify()
  return scannerInstance
}

function distance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y)
}

function dimensionsDepuisCoins(coins) {
  const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = coins
  return {
    largeur: (distance(topLeftCorner, topRightCorner) + distance(bottomLeftCorner, bottomRightCorner)) / 2,
    hauteur: (distance(topLeftCorner, bottomLeftCorner) + distance(topRightCorner, bottomRightCorner)) / 2,
  }
}

function mettreAEchelleCoins(coins, facteur) {
  const resultat = {}
  for (const c of CLES_COINS) resultat[c] = { x: coins[c].x * facteur, y: coins[c].y * facteur }
  return resultat
}

// ---------------------------------------------------------------------------
// Canvas et Blob
// ---------------------------------------------------------------------------

/**
 * Libère tout de suite la mémoire d'un canvas devenu inutile : Safari iOS ne
 * la rend qu'au ramasse-miettes, souvent trop tard pour sa limite globale.
 */
export function libererCanvas(canvas) {
  if (!canvas) return
  canvas.width = 0
  canvas.height = 0
}

function creerCanvas(largeur, hauteur) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(largeur))
  canvas.height = Math.max(1, Math.round(hauteur))
  return canvas
}

/**
 * Dessine `source` (vidéo, image, canvas) dans un nouveau canvas dont le plus
 * grand côté ne dépasse pas `coteMax`.
 */
export function dessinerReduit(source, largeurSource, hauteurSource, coteMax = COTE_MAX_PAGE) {
  const echelle = Math.min(1, coteMax / Math.max(largeurSource, hauteurSource))
  const canvas = creerCanvas(largeurSource * echelle, hauteurSource * echelle)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Décode une image (Blob/File) dans un canvas réduit à `coteMax`. L'orientation
 * EXIF est appliquée par le navigateur au décodage d'un <img> (comportement par
 * défaut d'image-orientation depuis Chrome 81 / Safari 13.1) : une photo prise
 * en portrait ne ressort pas couchée.
 */
export function blobVersCanvas(blob, coteMax = COTE_MAX_PAGE) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        resolve(dessinerReduit(img, img.naturalWidth, img.naturalHeight, coteMax))
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image-illisible'))
    }
    img.src = url
  })
}

/**
 * toBlob() renvoie null quand le navigateur n'a plus de mémoire pour le canvas
 * (Safari iOS) : on échoue franchement plutôt que de produire une page vide.
 */
export function canvasVersBlob(canvas, qualite = 0.88) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('memoire-insuffisante'))),
      'image/jpeg',
      qualite
    )
  })
}

function miniatureDe(canvas, coteMax = 320) {
  const mini = dessinerReduit(canvas, canvas.width, canvas.height, coteMax)
  const url = mini.toDataURL('image/jpeg', 0.75)
  libererCanvas(mini)
  return url
}

// ---------------------------------------------------------------------------
// Détection des bords et redressement
// ---------------------------------------------------------------------------

/**
 * Essaie de détecter les 4 coins du document dans `canvas`. Travaille sur une
 * copie réduite (LARGEUR_DETECTION) et renvoie des coins dans le repère du
 * canvas d'origine, ou `null` si aucun contour exploitable — ou si OpenCV n'est
 * pas (encore) chargé : la capture ne doit jamais en dépendre.
 *
 * jscanify (contour le plus grand + coin le plus éloigné par quadrant) échoue
 * souvent sur une vraie photo (fond texturé, petit objet, ombre) : l'appelant
 * propose toujours un cadrage ajustable à la main (voir coinsParDefaut).
 */
export function detecterCoins(canvas) {
  if (!opencvPret() || !canvas.width) return null
  const cv = window.cv
  const facteur = Math.min(1, LARGEUR_DETECTION / Math.max(canvas.width, canvas.height))
  const travail = facteur < 1 ? dessinerReduit(canvas, canvas.width, canvas.height, LARGEUR_DETECTION) : canvas
  let img = null
  let contour = null
  try {
    img = cv.imread(travail)
    contour = getScanner().findPaperContour(img)
    if (!contour) return null

    const coins = getScanner().getCornerPoints(contour)
    if (CLES_COINS.some((c) => !coins[c])) return null

    const { largeur, hauteur } = dimensionsDepuisCoins(coins)
    // Un contour minuscule est du bruit de fond, pas un document.
    if (largeur < travail.width * 0.15 || hauteur < travail.height * 0.1) return null

    return {
      coins: mettreAEchelleCoins(coins, 1 / facteur),
      // Part du cadre occupée : sert à décider d'une capture automatique.
      couverture: (largeur * hauteur) / (travail.width * travail.height),
    }
  } catch (error) {
    console.log('Détection auto du contour impossible :', error)
    return null
  } finally {
    img?.delete()
    contour?.delete()
    if (travail !== canvas) libererCanvas(travail)
  }
}

/**
 * Cadrage par défaut (léger retrait des bords) quand la détection n'a rien
 * trouvé : point de départ de l'ajustement manuel.
 */
export function coinsParDefaut(largeur, hauteur) {
  const mx = largeur * 0.05
  const my = hauteur * 0.05
  return {
    topLeftCorner: { x: mx, y: my },
    topRightCorner: { x: largeur - mx, y: my },
    bottomRightCorner: { x: largeur - mx, y: hauteur - my },
    bottomLeftCorner: { x: mx, y: hauteur - my },
  }
}

/**
 * Redresse/recadre `canvas` (correction de perspective) à partir de 4 coins.
 * Les dimensions de sortie viennent des coins (et non de la résolution de la
 * caméra, comme le ferait scanner.extractPaper() par défaut) : sans ça, un
 * document portrait capturé dans une frame paysage ressort étiré. Sans OpenCV,
 * on se contente d'un recadrage rectangulaire sur l'enveloppe des coins.
 */
function redresser(canvas, coins) {
  const { largeur, hauteur } = dimensionsDepuisCoins(coins)
  const echelle = Math.min(1, COTE_MAX_PAGE / Math.max(largeur, hauteur))
  const largeurSortie = Math.max(1, Math.round(largeur * echelle))
  const hauteurSortie = Math.max(1, Math.round(hauteur * echelle))

  if (opencvPret()) {
    try {
      const resultat = getScanner().extractPaper(canvas, largeurSortie, hauteurSortie, coins)
      if (resultat) return resultat
    } catch (error) {
      console.log('Redressement impossible, recadrage simple :', error)
    }
  }

  const xs = CLES_COINS.map((c) => coins[c].x)
  const ys = CLES_COINS.map((c) => coins[c].y)
  const x = Math.max(0, Math.min(...xs))
  const y = Math.max(0, Math.min(...ys))
  const l = Math.max(1, Math.min(canvas.width, Math.max(...xs)) - x)
  const h = Math.max(1, Math.min(canvas.height, Math.max(...ys)) - y)
  const sortie = creerCanvas(l, h)
  sortie.getContext('2d').drawImage(canvas, x, y, l, h, 0, 0, sortie.width, sortie.height)
  return sortie
}

function pivoter(canvas, rotation) {
  const quart = ((rotation % 360) + 360) % 360
  if (quart === 0) return canvas
  const vertical = quart === 90 || quart === 270
  const sortie = creerCanvas(vertical ? canvas.height : canvas.width, vertical ? canvas.width : canvas.height)
  const ctx = sortie.getContext('2d')
  ctx.translate(sortie.width / 2, sortie.height / 2)
  ctx.rotate((quart * Math.PI) / 180)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  return sortie
}

// ---------------------------------------------------------------------------
// Filtres
// ---------------------------------------------------------------------------

/**
 * Applique le filtre choisi, en place sur `canvas` :
 * - 'auto' : couleurs conservées, contraste étiré + légère netteté (rendu
 *   "document scanné" lisible, constant quel que soit l'éclairage) ;
 * - 'nb'   : noir et blanc net (seuillage adaptatif OpenCV, qui efface
 *   ombres et éclairage inégal), à défaut niveaux de gris contrastés ;
 * - 'original' : la photo telle quelle.
 * Ne fait jamais échouer le rendu : en cas d'erreur, la page reste brute.
 */
function appliquerFiltre(canvas, filtre) {
  if (filtre === 'original') return
  try {
    if (filtre === 'nb' && opencvPret()) {
      seuillageAdaptatif(canvas)
      return
    }
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    if (filtre === 'nb') niveauxDeGris(imageData)
    etirerNiveaux(imageData)
    if (filtre === 'auto') appliquerNettete(imageData)
    ctx.putImageData(imageData, 0, 0)
  } catch (error) {
    console.log('Filtre impossible, page brute conservée :', error)
  }
}

function seuillageAdaptatif(canvas) {
  const cv = window.cv
  const src = cv.imread(canvas)
  const gris = new cv.Mat()
  const lisse = new cv.Mat()
  const sortie = new cv.Mat()
  try {
    cv.cvtColor(src, gris, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gris, lisse, new cv.Size(3, 3), 0)
    // Bloc proportionnel à la page (impair) : trop petit, il fait des trous
    // dans les grands caractères ; trop grand, il ne compense plus les ombres.
    const bloc = Math.max(15, Math.round(Math.min(canvas.width, canvas.height) / 40)) | 1
    cv.adaptiveThreshold(lisse, sortie, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, bloc, 12)
    cv.imshow(canvas, sortie)
  } finally {
    src.delete()
    gris.delete()
    lisse.delete()
    sortie.delete()
  }
}

function niveauxDeGris(imageData) {
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    const l = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
    data[i] = data[i + 1] = data[i + 2] = l
  }
}

/**
 * Étirement de contraste automatique (auto-levels) basé sur les vrais
 * percentiles de luminance (1,5 % de pixels extrêmes ignorés de chaque côté),
 * plutôt qu'un réglage fixe qui sur- ou sous-corrige selon l'éclairage.
 * Facteur plafonné : sur une photo à faible contraste (reflet), un facteur
 * énorme crame l'image en noir/blanc quasi pur.
 */
function etirerNiveaux(imageData) {
  const { data } = imageData
  const total = data.length / 4
  const histogramme = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    histogramme[((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000) | 0]++
  }

  const marge = total * 0.015
  let bas = 0
  let cumulBas = 0
  while (bas < 255 && cumulBas + histogramme[bas] < marge) cumulBas += histogramme[bas++]
  let haut = 255
  let cumulHaut = 0
  while (haut > 0 && cumulHaut + histogramme[haut] < marge) cumulHaut += histogramme[haut--]

  if (haut - bas < 40) return
  const echelle = Math.min(255 / (haut - bas), 3)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (data[i] - bas) * echelle
    data[i + 1] = (data[i + 1] - bas) * echelle
    data[i + 2] = (data[i + 2] - bas) * echelle
  }
}

/**
 * Noyau de netteté 3x3 modéré (centre 3 au lieu de 5) pour éviter halos et
 * bruit sur une photo de téléphone — canvas n'a pas de filtre "sharpen" natif.
 */
function appliquerNettete(imageData) {
  const { width, height, data } = imageData
  const copie = new Uint8ClampedArray(data)
  const ligne = width * 4
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * ligne + x * 4
      for (let c = i; c < i + 3; c++) {
        data[c] = 3 * copie[c] - 0.5 * (copie[c - 4] + copie[c + 4] + copie[c - ligne] + copie[c + ligne])
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/**
 * Prépare une photo (canvas déjà réduit à COTE_MAX_PAGE) comme source d'une
 * nouvelle page : Blob JPEG + coins détectés (ou cadrage par défaut). Le
 * canvas est libéré.
 */
export async function preparerSource(canvas) {
  try {
    const detection = detecterCoins(canvas)
    return {
      source: await canvasVersBlob(canvas, 0.92),
      largeur: canvas.width,
      hauteur: canvas.height,
      coins: detection ? detection.coins : coinsParDefaut(canvas.width, canvas.height),
      coinsDetectes: !!detection,
    }
  } finally {
    libererCanvas(canvas)
  }
}

/**
 * Rend une page à partir de sa source et de ses réglages (coins, rotation,
 * filtre) : redressement → rotation → filtre. Renvoie le Blob final, ses
 * dimensions et une miniature pour l'affichage.
 */
export async function rendrePage({ source, coins, rotation = 0, filtre = 'auto' }) {
  const photo = await blobVersCanvas(source)
  const redresse = redresser(photo, coins)
  if (redresse !== photo) libererCanvas(photo)
  const pivote = pivoter(redresse, rotation)
  if (pivote !== redresse) libererCanvas(redresse)
  appliquerFiltre(pivote, filtre)
  try {
    return {
      rendu: await canvasVersBlob(pivote),
      largeurRendu: pivote.width,
      hauteurRendu: pivote.height,
      miniature: miniatureDe(pivote),
    }
  } finally {
    libererCanvas(pivote)
  }
}

/**
 * Assemble les pages rendues en un seul PDF, chaque page aux proportions
 * réelles de l'image (plein cadre, sans marges blanches parasites, comme un
 * vrai scanner) à 150 DPI : net à l'impression, fichier raisonnable.
 */
export async function pagesVersPdf(pages, nomFichier) {
  const { jsPDF } = await import('jspdf')
  const ptParPixel = 72 / 150

  let doc = null
  for (const page of pages) {
    const largeurPt = page.largeurRendu * ptParPixel
    const hauteurPt = page.hauteurRendu * ptParPixel
    const orientation = largeurPt > hauteurPt ? 'landscape' : 'portrait'
    if (!doc) doc = new jsPDF({ unit: 'pt', format: [largeurPt, hauteurPt], orientation, compress: true })
    else doc.addPage([largeurPt, hauteurPt], orientation)
    // JPEG inséré tel quel (pas de ré-encodage via un canvas).
    const octets = new Uint8Array(await page.rendu.arrayBuffer())
    doc.addImage(octets, 'JPEG', 0, 0, largeurPt, hauteurPt, undefined, 'NONE')
  }

  return new File([doc.output('blob')], nomFichier, { type: 'application/pdf', lastModified: Date.now() })
}

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

let moteurOcrPromise = null

// Au-delà, on abandonne l'OCR de la page : sur un téléphone lent (ou sans WASM
// SIMD, Safari iOS < 16.4) la reconnaissance pouvait bloquer la validation.
const DELAI_MAX_OCR_MS = 25000

/**
 * Prépare le moteur de reconnaissance de texte (Tesseract.js, auto-hébergé
 * dans public/vendor — rien depuis un CDN). Chargé à la demande, une seule fois
 * (sauf échec, réessayé à la prochaine demande).
 */
function chargerMoteurOcr() {
  if (!moteurOcrPromise) {
    moteurOcrPromise = import('tesseract.js')
      .then(({ createWorker }) => createWorker('fra', 1, {
        workerPath: '/vendor/tesseract/worker.min.js',
        corePath: '/vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
        langPath: '/vendor/tessdata',
        gzip: false,
      }))
      .catch((error) => {
        moteurOcrPromise = null
        throw error
      })
  }
  return moteurOcrPromise
}

/**
 * Reconnaît le texte d'une page (Blob) — sert uniquement à retrouver le
 * document par son contenu plus tard (recherche), jamais montré comme champ
 * éditable. Ne fait jamais échouer le dépôt : chaîne vide en cas d'échec.
 */
export async function extraireTexte(image) {
  let minuteur = null
  try {
    const delaiDepasse = new Promise((_, reject) => {
      minuteur = setTimeout(() => reject(new Error('OCR trop long, ignoré')), DELAI_MAX_OCR_MS)
    })
    const reconnaissance = chargerMoteurOcr().then((worker) => worker.recognize(image))
    const { data } = await Promise.race([reconnaissance, delaiDepasse])
    return (data?.text || '').trim()
  } catch (error) {
    console.log('Reconnaissance de texte impossible :', error)
    return ''
  } finally {
    clearTimeout(minuteur)
  }
}
