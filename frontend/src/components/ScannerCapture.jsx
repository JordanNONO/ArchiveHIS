import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { LuCamera, LuX, LuCheck, LuRotateCcw, LuLoader2, LuPlus, LuTrash2, LuCrop, LuZap, LuZapOff } from 'react-icons/lu'
import { chargerOpenCv, detecterCoins, coinsParDefaut, redresserAvecCoins, ameliorerScan, canvasVersFichier, pagesVersPdf, extraireTexte } from '../utils/scannerEngine'
import RognageEditor from './RognageEditor'

/**
 * Scanner de document dans l'appli (façon app Notes iPhone) : caméra en direct,
 * détection automatique des bords à la capture, cadrage/redressement de
 * perspective, amélioration (contraste + netteté), pages multiples, export en
 * image(s) ou en un seul PDF. Nécessite un contexte sécurisé (HTTPS ou
 * localhost) pour l'accès caméra — voir la configuration HTTPS locale.
 */
function ScannerCapture({ onTermine, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [pretCv, setPretCv] = useState(false)
  const [chargementCv, setChargementCv] = useState(true)
  const [erreurCamera, setErreurCamera] = useState(null)
  const [etape, setEtape] = useState('camera') // camera | traitement | apercu
  const [pages, setPages] = useState([]) // canvases déjà validés
  const [apercuCanvas, setApercuCanvas] = useState(null)
  const [brutCanvas, setBrutCanvas] = useState(null) // photo non recadrée, pour l'ajustement manuel
  const [coinsActuels, setCoinsActuels] = useState(null)
  const [rognageOuvert, setRognageOuvert] = useState(false)
  const [formatExport, setFormatExport] = useState('image') // image | pdf
  const [enTraitementFinal, setEnTraitementFinal] = useState(false)
  const [zoomInfo, setZoomInfo] = useState(null) // { min, max, courant } si l'appareil expose un zoom caméra
  const pinchRef = useRef({ distanceInitiale: 0, zoomInitial: 1 })
  const [torcheDisponible, setTorcheDisponible] = useState(false)
  const [torcheActive, setTorcheActive] = useState(false)
  const [coinsLive, setCoinsLive] = useState(null) // contour détecté en direct (guide visuel pendant la visée), lissé
  const [tailleLive, setTailleLive] = useState(null)
  const [pretPourCapture, setPretPourCapture] = useState(false) // cadrage stable, capture auto imminente
  const coinsLisseRef = useRef(null)
  const stabiliteRef = useRef(0)
  const autoCaptureRef = useRef(false)
  // Toujours la dernière version de capturer() (elle ferme sur pretCv) sans
  // la mettre dans les deps de la boucle de détection ci-dessous : ça la
  // redémarrerait à chaque rendu (flash de la vidéo, capture auto ratée).
  const capturerRef = useRef(null)

  useEffect(() => {
    chargerOpenCv()
      .then(() => setPretCv(true))
      .catch(() => toast.error("Le moteur de détection n'a pas pu se charger"))
      .finally(() => setChargementCv(false))
  }, [])

  useEffect(() => {
    if (etape !== 'camera') return
    let annule = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } } })
      .then((stream) => {
        if (annule) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream

        // Zoom caméra réel (optique/hybride selon l'appareil) si le
        // navigateur l'expose — pas de zoom numérique CSS de secours, ça ne
        // ferait qu'agrandir des pixels flous sans rien changer à la photo
        // capturée (lue depuis le flux natif, pas depuis l'affichage).
        const [track] = stream.getVideoTracks()
        const capacites = track.getCapabilities?.()
        if (capacites?.zoom) {
          setZoomInfo({
            min: capacites.zoom.min,
            max: capacites.zoom.max,
            courant: track.getSettings?.().zoom || capacites.zoom.min,
          })
        } else {
          setZoomInfo(null)
        }
        setTorcheDisponible(!!capacites?.torch)
        setTorcheActive(false)
      })
      .catch((err) => {
        console.log(err)
        setErreurCamera(
          err?.name === 'NotAllowedError'
            ? "Accès à la caméra refusé. Autorisez la caméra pour ce site dans les réglages du navigateur."
            : "Impossible d'accéder à la caméra sur cet appareil/navigateur."
        )
      })

    return () => {
      annule = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [etape])

  function fermerCameraSeulement() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function toggleTorche() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const nouvelEtat = !torcheActive
    track.applyConstraints({ advanced: [{ torch: nouvelEtat }] })
      .then(() => setTorcheActive(nouvelEtat))
      .catch(() => toast.error("Impossible d'activer le flash sur cet appareil"))
  }

  function distanceMoyenneCoins(a, b) {
    const cles = ['topLeftCorner', 'topRightCorner', 'bottomLeftCorner', 'bottomRightCorner']
    let total = 0
    for (const c of cles) total += Math.hypot(a[c].x - b[c].x, a[c].y - b[c].y)
    return total / cles.length
  }

  function lisserCoins(precedent, nouveau, alpha) {
    const cles = ['topLeftCorner', 'topRightCorner', 'bottomLeftCorner', 'bottomRightCorner']
    const resultat = {}
    for (const c of cles) {
      resultat[c] = {
        x: precedent[c].x + (nouveau[c].x - precedent[c].x) * alpha,
        y: precedent[c].y + (nouveau[c].y - precedent[c].y) * alpha,
      }
    }
    return resultat
  }

  // Contour détecté en direct pendant la visée (guide visuel, comme les
  // scanners "pro") : on tourne sur une copie réduite de l'image (640px de
  // large) pour que la détection OpenCV reste fluide et peu gourmande en
  // batterie — le recadrage final, lui, est toujours refait en pleine
  // résolution au moment de la capture (voir capturer()).
  //
  // Le contour affiché est lissé (moyenne glissante) d'une passe à l'autre
  // pour éviter les sautillements d'une détection brute image par image. Et
  // dès que le cadrage reste stable ~1s sur un objet qui occupe une part
  // suffisante du cadre, la capture se déclenche toute seule — comme un vrai
  // scanner de document, sans avoir à appuyer sur le déclencheur.
  useEffect(() => {
    if (etape !== 'camera' || !pretCv) return
    let annule = false
    let minuteur = null
    coinsLisseRef.current = null
    stabiliteRef.current = 0
    autoCaptureRef.current = false
    setPretPourCapture(false)

    function boucle() {
      if (annule) return
      const video = videoRef.current
      if (video && video.videoWidth) {
        const largeurAnalyse = 640
        const echelle = largeurAnalyse / video.videoWidth
        const hauteurAnalyse = Math.round(video.videoHeight * echelle)
        const petitCanvas = document.createElement('canvas')
        petitCanvas.width = largeurAnalyse
        petitCanvas.height = hauteurAnalyse
        petitCanvas.getContext('2d').drawImage(video, 0, 0, largeurAnalyse, hauteurAnalyse)
        const detection = detecterCoins(petitCanvas)

        if (!annule) {
          setTailleLive({ largeur: largeurAnalyse, hauteur: hauteurAnalyse })

          if (!detection) {
            coinsLisseRef.current = null
            stabiliteRef.current = 0
            setCoinsLive(null)
            setPretPourCapture(false)
          } else {
            const diagonale = Math.hypot(largeurAnalyse, hauteurAnalyse)
            if (coinsLisseRef.current) {
              // Seuil assoupli : la détection elle-même (algorithme de
              // contour, pas seulement le tremblement de la main) varie
              // sensiblement d'une passe à l'autre sur une image réelle —
              // un seuil trop strict ne se stabilisait quasiment jamais.
              // Sans risque à se déclencher un peu tôt : la capture auto ne
              // fait plus que garder la photo brute améliorée (jamais de
              // recadrage forcé), voir capturer().
              const ecart = distanceMoyenneCoins(coinsLisseRef.current, detection.corners)
              stabiliteRef.current = ecart < diagonale * 0.05 ? stabiliteRef.current + 1 : 1
              coinsLisseRef.current = lisserCoins(coinsLisseRef.current, detection.corners, 0.45)
            } else {
              coinsLisseRef.current = detection.corners
              stabiliteRef.current = 1
            }
            setCoinsLive(coinsLisseRef.current)

            // Évite qu'un petit contour de bruit de fond déclenche la
            // capture auto : l'objet doit occuper une part significative du
            // cadre.
            const occupeAssezDeCadre = detection.largeurDoc > largeurAnalyse * 0.2 && detection.hauteurDoc > hauteurAnalyse * 0.15
            setPretPourCapture(stabiliteRef.current >= 2 && occupeAssezDeCadre)

            if (stabiliteRef.current >= 2 && occupeAssezDeCadre && !autoCaptureRef.current) {
              autoCaptureRef.current = true
              capturerRef.current(true)
              return
            }
          }
        }
      }
      minuteur = setTimeout(boucle, 300)
    }
    boucle()

    return () => {
      annule = true
      clearTimeout(minuteur)
      setCoinsLive(null)
      setPretPourCapture(false)
    }
  }, [etape, pretCv])

  function distanceEntreDoigts(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
  }

  function onTouchStartZoom(e) {
    if (e.touches.length !== 2 || !zoomInfo) return
    pinchRef.current = { distanceInitiale: distanceEntreDoigts(e.touches), zoomInitial: zoomInfo.courant }
  }

  function onTouchMoveZoom(e) {
    if (e.touches.length !== 2 || !zoomInfo || !pinchRef.current.distanceInitiale) return
    e.preventDefault()
    const ratio = distanceEntreDoigts(e.touches) / pinchRef.current.distanceInitiale
    const nouveauZoom = Math.min(zoomInfo.max, Math.max(zoomInfo.min, pinchRef.current.zoomInitial * ratio))
    const track = streamRef.current?.getVideoTracks()[0]
    track?.applyConstraints({ advanced: [{ zoom: nouveauZoom }] }).catch(() => {})
    setZoomInfo((z) => (z ? { ...z, courant: nouveauZoom } : z))
  }

  function onTouchEndZoom() {
    pinchRef.current.distanceInitiale = 0
  }

  useEffect(() => {
    capturerRef.current = capturer
  })

  async function capturer(cadrageFiable) {
    if (!pretCv || !videoRef.current) return
    const video = videoRef.current
    const largeur = video.videoWidth
    const hauteur = video.videoHeight
    if (!largeur || !hauteur) {
      toast.error("La caméra n'est pas encore prête, réessayez dans un instant")
      return
    }

    // On capture la frame TANT QUE la caméra est encore active : certains
    // navigateurs/téléphones vident l'affichage de la vidéo dès que les
    // pistes sont arrêtées, ce qui rendait la capture aléatoire selon
    // l'appareil (fonctionnait sur certains, pas sur d'autres).
    const instantane = document.createElement('canvas')
    instantane.width = largeur
    instantane.height = hauteur
    instantane.getContext('2d').drawImage(video, 0, 0, largeur, hauteur)

    setEtape('traitement')
    fermerCameraSeulement()

    try {
      // Le recadrage auto n'est appliqué que si le contour était jugé
      // fiable au moment de la capture (cadre stable sur plusieurs passes,
      // objet occupant une part suffisante du cadre — même condition que le
      // déclenchement de la capture automatique). Sinon (cadre pas stable,
      // capture manuelle "à l'arrache") on garde la photo brute améliorée :
      // jscanify se trompe assez souvent sur un fond réel pour produire un
      // contour "valide" mais faux, et déformer l'image sans le signaler.
      const detection = detecterCoins(instantane)
      const coins = detection ? detection.corners : coinsParDefaut(instantane)
      const base = cadrageFiable && detection
        ? redresserAvecCoins(instantane, detection.corners, detection.largeurDoc, detection.hauteurDoc)
        : instantane
      const ameliore = ameliorerScan(base)
      setBrutCanvas(instantane)
      setCoinsActuels(coins)
      setApercuCanvas(ameliore)
      setEtape('apercu')
    } catch (error) {
      console.log(error)
      toast.error('La capture a échoué, réessayez')
      setEtape('camera')
    }
  }

  function appliquerRognage(nouveauxCoins) {
    setCoinsActuels(nouveauxCoins)
    const cadre = redresserAvecCoins(brutCanvas, nouveauxCoins)
    setApercuCanvas(ameliorerScan(cadre))
    setRognageOuvert(false)
  }

  function reprendre() {
    setApercuCanvas(null)
    setBrutCanvas(null)
    setCoinsActuels(null)
    setEtape('camera')
  }

  function garderCettePage() {
    setPages((prev) => [...prev, apercuCanvas])
    setApercuCanvas(null)
    setBrutCanvas(null)
    setCoinsActuels(null)
    setEtape('camera')
  }

  function retirerPage(index) {
    setPages((prev) => prev.filter((_, i) => i !== index))
  }

  async function terminer(pagesAValider) {
    const toutesLesPages = apercuCanvas ? [...pagesAValider, apercuCanvas] : pagesAValider
    if (toutesLesPages.length === 0) {
      toast.warning('Scannez au moins une page')
      return
    }

    try {
      setEnTraitementFinal(true)
      const horodatage = Date.now()

      // Reconnaissance de texte (OCR) sur chaque page, pour pouvoir retrouver
      // le document par son contenu plus tard — jamais bloquant : une page où
      // l'OCR échoue renvoie juste une chaîne vide (voir extraireTexte()).
      const textesParPage = await Promise.all(toutesLesPages.map((canvas) => extraireTexte(canvas)))

      if (formatExport === 'pdf') {
        const fichier = await pagesVersPdf(toutesLesPages, `scan-${horodatage}.pdf`)
        onTermine([fichier], [textesParPage.filter(Boolean).join('\n\n')])
      } else {
        const fichiers = await Promise.all(
          toutesLesPages.map((canvas, i) => canvasVersFichier(canvas, `scan-${horodatage}-${i + 1}.jpg`))
        )
        onTermine(fichiers, textesParPage)
      }
    } catch (error) {
      console.log(error)
      toast.error("La finalisation du scan a échoué")
    } finally {
      setEnTraitementFinal(false)
    }
  }

  return (
    <div className='fixed inset-0 z-[100] bg-black flex flex-col'>
      <div className='flex items-center justify-between px-4 py-3 bg-black/80 text-white shrink-0'>
        <span className='text-sm font-medium'>
          Scanner {pages.length > 0 ? `— ${pages.length} page(s)` : ''}
        </span>
        <button onClick={onClose} className='p-1.5 hover:bg-white/10 rounded-lg transition-colors'>
          <LuX size={20} />
        </button>
      </div>

      <div
        className='flex-1 relative overflow-hidden flex items-center justify-center touch-none'
        onTouchStart={onTouchStartZoom}
        onTouchMove={onTouchMoveZoom}
        onTouchEnd={onTouchEndZoom}
      >
        {etape === 'camera' && zoomInfo && zoomInfo.courant > zoomInfo.min && (
          <span className='absolute top-3 left-1/2 -translate-x-1/2 z-10 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium'>
            ×{zoomInfo.courant.toFixed(1)}
          </span>
        )}
        {chargementCv && (
          <div className='flex flex-col items-center gap-3 text-white'>
            <LuLoader2 size={28} className='animate-spin' />
            <span className='text-sm'>Chargement du moteur de détection...</span>
          </div>
        )}

        {!chargementCv && erreurCamera && (
          <div className='flex flex-col items-center gap-3 text-white text-center px-8'>
            <LuCamera size={32} className='text-white/50' />
            <p className='text-sm'>{erreurCamera}</p>
          </div>
        )}

        {!chargementCv && !erreurCamera && etape === 'camera' && (
          <>
            <video ref={videoRef} autoPlay playsInline muted className='w-full h-full object-contain' />
            {coinsLive && tailleLive && (
              <svg
                viewBox={`0 0 ${tailleLive.largeur} ${tailleLive.hauteur}`}
                preserveAspectRatio='xMidYMid meet'
                className='absolute inset-0 w-full h-full pointer-events-none'
              >
                <polygon
                  points={['topLeftCorner', 'topRightCorner', 'bottomRightCorner', 'bottomLeftCorner']
                    .map((c) => `${coinsLive[c].x},${coinsLive[c].y}`)
                    .join(' ')}
                  fill={pretPourCapture ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.15)'}
                  stroke='#22c55e'
                  strokeWidth={tailleLive.largeur * (pretPourCapture ? 0.016 : 0.01)}
                  strokeLinejoin='round'
                  style={{ transition: 'fill 0.15s, stroke-width 0.15s' }}
                />
              </svg>
            )}
            {pretPourCapture && (
              <span className='absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-medium animate-pulse'>
                Capture...
              </span>
            )}
          </>
        )}

        {etape === 'traitement' && (
          <div className='flex flex-col items-center gap-3 text-white'>
            <LuLoader2 size={28} className='animate-spin' />
            <span className='text-sm'>Détection et amélioration...</span>
          </div>
        )}

        {etape === 'apercu' && apercuCanvas && (
          <img
            src={apercuCanvas.toDataURL('image/jpeg', 0.9)}
            alt='Page scannée'
            className='w-full h-full object-contain bg-black'
          />
        )}
      </div>

      {pages.length > 0 && etape === 'camera' && (
        <div className='flex gap-2 px-4 py-2 overflow-x-auto bg-black/80 shrink-0'>
          {pages.map((canvas, i) => (
            <div key={i} className='relative shrink-0'>
              <img src={canvas.toDataURL('image/jpeg', 0.7)} alt={`Page ${i + 1}`} className='w-12 h-16 object-cover rounded border border-white/20' />
              <button onClick={() => retirerPage(i)} className='absolute -top-1.5 -right-1.5 bg-destructive rounded-full p-0.5'>
                <LuTrash2 size={10} className='text-white' />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className='px-4 py-4 bg-black/90 shrink-0'>
        {etape === 'camera' && !chargementCv && !erreurCamera && (
          <div className='flex items-center justify-center gap-6'>
            {pages.length > 0 && (
              <button
                onClick={() => terminer(pages)}
                disabled={enTraitementFinal}
                className='px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-60'
              >
                Terminer
              </button>
            )}
            <button
              onClick={() => capturer(pretPourCapture)}
              disabled={!pretCv}
              className='w-16 h-16 rounded-full bg-white border-4 border-white/30 hover:scale-105 transition-transform disabled:opacity-50'
              title="Capturer"
            />
            <div className='w-[76px] flex justify-center'>
              {torcheDisponible && (
                <button
                  onClick={toggleTorche}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${torcheActive ? 'bg-accent text-black' : 'bg-white/10 text-white'}`}
                  title="Flash"
                >
                  {torcheActive ? <LuZap size={18} /> : <LuZapOff size={18} />}
                </button>
              )}
            </div>
          </div>
        )}

        {etape === 'apercu' && (
          <div className='flex flex-col gap-3'>
            <div className='flex items-center justify-center gap-3 flex-wrap'>
              <button onClick={reprendre} className='flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium'>
                <LuRotateCcw size={15} /> Reprendre
              </button>
              <button
                onClick={() => setRognageOuvert(true)}
                disabled={!brutCanvas}
                className='flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium disabled:opacity-50'
              >
                <LuCrop size={15} /> Rogner
              </button>
              <button onClick={garderCettePage} className='flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium'>
                <LuPlus size={15} /> Page suivante
              </button>
              <button
                onClick={() => terminer(pages)}
                disabled={enTraitementFinal}
                className='flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-60'
              >
                {enTraitementFinal ? <LuLoader2 size={15} className='animate-spin' /> : <LuCheck size={15} />}
                Valider
              </button>
            </div>
          </div>
        )}

        {(etape === 'camera' || etape === 'apercu') && (
          <div className='flex items-center justify-center gap-4 mt-3 text-xs text-white/60'>
            <label className='flex items-center gap-1.5 cursor-pointer'>
              <input type='radio' checked={formatExport === 'image'} onChange={() => setFormatExport('image')} />
              Image{pages.length + (apercuCanvas ? 1 : 0) > 1 ? 's séparées' : ''}
            </label>
            <label className='flex items-center gap-1.5 cursor-pointer'>
              <input type='radio' checked={formatExport === 'pdf'} onChange={() => setFormatExport('pdf')} />
              PDF{pages.length + (apercuCanvas ? 1 : 0) > 1 ? ' (toutes les pages)' : ''}
            </label>
          </div>
        )}
      </div>

      {rognageOuvert && brutCanvas && coinsActuels && (
        <RognageEditor
          canvas={brutCanvas}
          coinsInitiaux={coinsActuels}
          onValider={appliquerRognage}
          onAnnuler={() => setRognageOuvert(false)}
        />
      )}
    </div>
  )
}

export default ScannerCapture
