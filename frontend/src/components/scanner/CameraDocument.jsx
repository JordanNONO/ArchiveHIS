import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { LuCamera, LuImagePlus, LuLoader2, LuRefreshCw, LuZap, LuZapOff, LuX } from 'react-icons/lu'
import { CLES_COINS, COTE_MAX_PAGE, detecterCoins, dessinerReduit, libererCanvas } from '../../utils/scannerEngine'

// Au-delà, on affiche une aide (autorisation, appareil photo natif) sans
// abandonner la demande : l'utilisateur peut encore accepter la popup.
const DELAI_AIDE_OUVERTURE_MS = 8000
// Largeur de l'image analysée en direct : assez pour un contour fiable, assez
// peu pour rester fluide et économe en batterie.
const LARGEUR_ANALYSE = 480
const INTERVALLE_ANALYSE_MS = 250
// Passes consécutives au même cadrage avant la capture automatique (~0,75 s).
const PASSES_STABLES_CAPTURE = 3
// Délai avant de réarmer la capture automatique au retour sur la caméra :
// sans ça, la page qu'on vient de garder était aussitôt reprise.
const DELAI_REARMEMENT_MS = 1500
const CLE_CAPTURE_AUTO = 'his_scanner_capture_auto'

function lireCaptureAuto() {
  try {
    return localStorage.getItem(CLE_CAPTURE_AUTO) !== 'non'
  } catch {
    return true
  }
}

function ecartMoyen(a, b) {
  return CLES_COINS.reduce((total, c) => total + Math.hypot(a[c].x - b[c].x, a[c].y - b[c].y), 0) / CLES_COINS.length
}

function lisser(precedent, nouveau, alpha) {
  const resultat = {}
  for (const c of CLES_COINS) {
    resultat[c] = {
      x: precedent[c].x + (nouveau[c].x - precedent[c].x) * alpha,
      y: precedent[c].y + (nouveau[c].y - precedent[c].y) * alpha,
    }
  }
  return resultat
}

/**
 * Viseur du scanner : caméra arrière en direct, contour du document détecté
 * en continu et capture automatique dès que le cadrage est stable (désactivable,
 * choix mémorisé sur l'appareil).
 *
 * La caméra en direct (getUserMedia) exige un contexte sécurisé (https ou
 * localhost) et l'autorisation du navigateur. Sans elle (http://, refus,
 * navigateur intégré d'une appli...), on passe par l'appareil photo natif du
 * téléphone (<input capture>) : la photo suit ensuite exactement le même
 * parcours. "Importer" permet aussi de reprendre des photos déjà prises.
 *
 * Le composant reste monté (actif=false) pendant l'ajustement des bords pour
 * garder le flux ouvert : rouvrir la caméra à chaque page coûtait une à deux
 * secondes, et une nouvelle demande d'autorisation sur certains navigateurs.
 */
function CameraDocument({ actif, moteurPret, moteurEnChargement, nbPages, derniereMiniature, onPhoto, onImport, onVoirPages, onFermer }) {
  const { t } = useTranslation()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const inputPhotoRef = useRef(null)
  const inputImportRef = useRef(null)
  const [tentative, setTentative] = useState(0)
  const [fluxPret, setFluxPret] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [attenteLongue, setAttenteLongue] = useState(false)
  const [torche, setTorche] = useState({ disponible: false, active: false })
  const [zoom, setZoom] = useState(null) // { min, max, courant } si l'appareil expose un zoom réel
  const pinchRef = useRef({ distance: 0, zoom: 1 })
  const [captureAuto, setCaptureAuto] = useState(lireCaptureAuto)
  const [contour, setContour] = useState(null) // { coins, largeur, hauteur } dans le repère de l'analyse
  const [stable, setStable] = useState(false)
  // Toujours la dernière valeur, lue depuis la boucle d'analyse sans la
  // relancer à chaque rendu.
  const onPhotoRef = useRef(onPhoto)
  onPhotoRef.current = onPhoto
  const captureAutoRef = useRef(captureAuto)
  captureAutoRef.current = captureAuto

  // --- Ouverture du flux ----------------------------------------------------
  useEffect(() => {
    let annule = false
    setFluxPret(false)
    setErreur(null)
    setAttenteLongue(false)

    // navigator.mediaDevices n'existe pas du tout hors contexte sécurisé :
    // l'appel direct plantait le composant au lieu de proposer une solution.
    if (!navigator.mediaDevices?.getUserMedia) {
      setErreur(window.isSecureContext === false ? 'horsHttps' : 'indisponible')
      return
    }

    const minuteurAide = setTimeout(() => !annule && setAttenteLongue(true), DELAI_AIDE_OUVERTURE_MS)

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        // 'ideal' : un appareil sans caméra arrière retombe sur celle qu'il a
        // au lieu d'échouer. 2560 px suffisent (photo réduite à COTE_MAX_PAGE)
        // et allègent l'aperçu comme l'analyse en direct.
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } },
      })
      .then((stream) => {
        clearTimeout(minuteurAide)
        if (annule) {
          stream.getTracks().forEach((piste) => piste.stop())
          return
        }
        streamRef.current = stream
        const [piste] = stream.getVideoTracks()
        const capacites = piste?.getCapabilities?.() || {}
        setZoom(capacites.zoom ? { min: capacites.zoom.min, max: capacites.zoom.max, courant: piste.getSettings?.().zoom || capacites.zoom.min } : null)
        setTorche({ disponible: !!capacites.torch, active: false })
        setAttenteLongue(false)
        setFluxPret(true)
      })
      .catch((err) => {
        clearTimeout(minuteurAide)
        if (annule) return
        console.log(err)
        setErreur(err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
          ? 'refusee'
          : err?.name === 'NotReadableError' ? 'occupee' : 'indisponible')
      })

    return () => {
      annule = true
      clearTimeout(minuteurAide)
      streamRef.current?.getTracks().forEach((piste) => piste.stop())
      streamRef.current = null
    }
  }, [tentative])

  // Ref "callback" : le flux est branché dès que le <video> est réellement
  // monté (l'ancien code le branchait avant le montage : vidéo noire). play()
  // explicite : sur iOS, autoPlay seul ne démarre pas toujours un flux
  // attaché après coup.
  const brancherVideo = useCallback((video) => {
    videoRef.current = video
    if (video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current
      video.play?.().catch(() => {})
    }
  }, [])

  // Retour sur le viseur après l'ajustement : iOS met parfois la vidéo en
  // pause quand elle est masquée.
  useEffect(() => {
    if (actif) videoRef.current?.play?.().catch(() => {})
  }, [actif])

  // --- Analyse en direct et capture automatique ----------------------------
  useEffect(() => {
    if (!actif || !fluxPret || !moteurPret) return
    let annule = false
    let minuteur = null
    let lisse = null
    let passesStables = 0
    let arme = false
    const minuteurArmement = setTimeout(() => { arme = true }, DELAI_REARMEMENT_MS)
    // Un seul canvas réutilisé : en créer un par passe saturait la mémoire
    // canvas de Safari iOS.
    const canvasAnalyse = document.createElement('canvas')

    function analyser() {
      if (annule) return
      const video = videoRef.current
      if (video?.videoWidth) {
        canvasAnalyse.width = LARGEUR_ANALYSE
        canvasAnalyse.height = Math.round(video.videoHeight * (LARGEUR_ANALYSE / video.videoWidth))
        canvasAnalyse.getContext('2d').drawImage(video, 0, 0, canvasAnalyse.width, canvasAnalyse.height)
        const detection = detecterCoins(canvasAnalyse)

        if (!detection) {
          lisse = null
          passesStables = 0
          setContour(null)
          setStable(false)
        } else {
          // Seuil assoupli : la détection elle-même varie d'une passe à
          // l'autre sur une vraie image, pas seulement la main qui tremble.
          const diagonale = Math.hypot(canvasAnalyse.width, canvasAnalyse.height)
          passesStables = lisse && ecartMoyen(lisse, detection.coins) < diagonale * 0.04 ? passesStables + 1 : 1
          lisse = lisse ? lisser(lisse, detection.coins, 0.5) : detection.coins
          // Un petit contour (bruit de fond, objet lointain) ne déclenche rien.
          const assezGrand = detection.couverture > 0.2
          const pret = passesStables >= PASSES_STABLES_CAPTURE && assezGrand
          setContour({ coins: lisse, largeur: canvasAnalyse.width, hauteur: canvasAnalyse.height })
          setStable(passesStables >= 2 && assezGrand)

          if (pret && arme && captureAutoRef.current) {
            capturer()
            return
          }
        }
      }
      minuteur = setTimeout(analyser, INTERVALLE_ANALYSE_MS)
    }
    analyser()

    return () => {
      annule = true
      clearTimeout(minuteur)
      clearTimeout(minuteurArmement)
      libererCanvas(canvasAnalyse)
      setContour(null)
      setStable(false)
    }
    // capturer() ne lit que des refs : inutile de relancer la boucle pour elle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, fluxPret, moteurPret])

  function basculerCaptureAuto() {
    const suivant = !captureAuto
    setCaptureAuto(suivant)
    try {
      localStorage.setItem(CLE_CAPTURE_AUTO, suivant ? 'oui' : 'non')
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour la session.
    }
  }

  function capturer() {
    const video = videoRef.current
    if (!video?.videoWidth) {
      toast.error(t('scanner.camera.pasPrete'))
      return
    }
    // Directement à la taille finale : pas de photo 4K gardée en mémoire.
    onPhotoRef.current(dessinerReduit(video, video.videoWidth, video.videoHeight, COTE_MAX_PAGE))
  }

  // --- Flash et zoom --------------------------------------------------------
  function basculerTorche() {
    const piste = streamRef.current?.getVideoTracks()[0]
    if (!piste) return
    const active = !torche.active
    piste.applyConstraints({ advanced: [{ torch: active }] })
      .then(() => setTorche((etat) => ({ ...etat, active })))
      .catch(() => setTorche((etat) => ({ ...etat, disponible: false })))
  }

  function distanceDoigts(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
  }

  function onTouchStart(e) {
    if (e.touches.length === 2 && zoom) pinchRef.current = { distance: distanceDoigts(e.touches), zoom: zoom.courant }
  }

  function onTouchMove(e) {
    if (e.touches.length !== 2 || !zoom || !pinchRef.current.distance) return
    const courant = Math.min(zoom.max, Math.max(zoom.min, pinchRef.current.zoom * (distanceDoigts(e.touches) / pinchRef.current.distance)))
    streamRef.current?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ zoom: courant }] }).catch(() => {})
    setZoom((z) => (z ? { ...z, courant } : z))
  }

  // --- Appareil photo natif et import --------------------------------------
  function ouvrirSelecteur(input) {
    if (!input) return
    // Android refuse souvent d'ouvrir l'appareil photo natif tant que la page
    // garde la caméra : on la libère, et on la rouvre si l'utilisateur revient
    // sans photo ("cancel", ou simple retour sur la page pour les navigateurs
    // qui ne l'émettent pas). Une photo choisie fait quitter le viseur avant.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((piste) => piste.stop())
      streamRef.current = null
      setFluxPret(false)
      const relancer = () => {
        window.removeEventListener('focus', relancer)
        input.removeEventListener('cancel', relancer)
        setTimeout(() => setTentative((n) => n + 1), 600)
      }
      window.addEventListener('focus', relancer)
      input.addEventListener('cancel', relancer)
    }
    input.click()
  }

  function onFichiersChoisis(e) {
    const fichiers = Array.from(e.target.files || [])
    // Permet de reprendre la même photo (sinon onChange ne se redéclenche pas).
    e.target.value = ''
    if (fichiers.length) onImport(fichiers)
  }

  const messageErreur = erreur ? t(`scanner.camera.${erreur}`) : null
  const indice = !moteurPret
    ? (moteurEnChargement ? t('scanner.camera.detectionPreparation') : t('scanner.camera.indiceManuel'))
    : stable && captureAuto ? t('scanner.camera.indiceStable')
      : captureAuto ? t('scanner.camera.indicePlacer') : t('scanner.camera.indiceManuel')

  return (
    <div className={`absolute inset-0 flex flex-col bg-black text-white ${actif ? '' : 'invisible pointer-events-none'}`} aria-hidden={!actif}>
      <input ref={inputPhotoRef} type='file' accept='image/*' capture='environment' className='hidden' onChange={onFichiersChoisis} />
      <input ref={inputImportRef} type='file' accept='image/*' multiple className='hidden' onChange={onFichiersChoisis} />

      {/* Barre du haut */}
      <div className='flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 shrink-0'>
        <button type='button' onClick={onFermer} className='w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10' title={t('scanner.fermer')} aria-label={t('scanner.fermer')}>
          <LuX size={22} />
        </button>
        <div className='flex items-center gap-2'>
          {fluxPret && moteurPret && (
            <button
              type='button'
              onClick={basculerCaptureAuto}
              className={`h-9 px-3.5 rounded-full text-xs font-semibold transition-colors ${captureAuto ? 'bg-white text-black' : 'bg-white/15 text-white'}`}
              title={t('scanner.camera.captureAuto')}
              aria-pressed={captureAuto}
            >
              {captureAuto ? t('scanner.camera.auto') : t('scanner.camera.manuel')}
            </button>
          )}
          {fluxPret && torche.disponible && (
            <button
              type='button'
              onClick={basculerTorche}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${torche.active ? 'bg-amber-400 text-black' : 'bg-white/15'}`}
              title={t('scanner.camera.flash')}
              aria-label={t('scanner.camera.flash')}
              aria-pressed={torche.active}
            >
              {torche.active ? <LuZap size={18} /> : <LuZapOff size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Viseur */}
      <div
        className='relative flex-1 min-h-0 overflow-hidden flex items-center justify-center touch-none'
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => { pinchRef.current.distance = 0 }}
      >
        {erreur && (
          <div className='flex flex-col items-center gap-4 text-center px-8 max-w-sm'>
            <span className='w-14 h-14 rounded-full bg-white/10 flex items-center justify-center'>
              <LuCamera size={26} className='text-white/70' />
            </span>
            <p className='text-sm text-white/85'>{messageErreur}</p>
            <button type='button' onClick={() => ouvrirSelecteur(inputPhotoRef.current)} className='flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-white text-sm font-semibold'>
              <LuCamera size={18} /> {t('scanner.camera.prendrePhoto')}
            </button>
            {navigator.mediaDevices?.getUserMedia && erreur !== 'horsHttps' && (
              <button type='button' onClick={() => setTentative((n) => n + 1)} className='flex items-center gap-1.5 text-xs text-white/70 underline underline-offset-2'>
                <LuRefreshCw size={13} /> {t('scanner.camera.reessayer')}
              </button>
            )}
          </div>
        )}

        {!erreur && !fluxPret && (
          <div className='flex flex-col items-center gap-3 text-center px-8 max-w-sm'>
            <LuLoader2 size={28} className='animate-spin' />
            <span className='text-sm'>{t('scanner.camera.ouverture')}</span>
            {attenteLongue && (
              <>
                <p className='text-xs text-white/70'>{t('scanner.camera.attenteLongue')}</p>
                <button type='button' onClick={() => ouvrirSelecteur(inputPhotoRef.current)} className='flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-white text-sm font-semibold'>
                  <LuCamera size={18} /> {t('scanner.camera.prendrePhoto')}
                </button>
              </>
            )}
          </div>
        )}

        {!erreur && fluxPret && (
          <>
            <video ref={brancherVideo} autoPlay playsInline muted className='w-full h-full object-contain' />
            {contour && (
              <svg
                viewBox={`0 0 ${contour.largeur} ${contour.hauteur}`}
                preserveAspectRatio='xMidYMid meet'
                className='absolute inset-0 w-full h-full pointer-events-none'
              >
                <polygon
                  points={CLES_COINS.map((c) => `${contour.coins[c].x},${contour.coins[c].y}`).join(' ')}
                  fill={stable ? 'rgba(34,197,94,0.28)' : 'rgba(255,255,255,0.12)'}
                  stroke={stable ? '#22c55e' : '#ffffff'}
                  strokeWidth={contour.largeur * 0.008}
                  strokeLinejoin='round'
                  style={{ transition: 'fill 0.2s, stroke 0.2s' }}
                />
              </svg>
            )}
            {zoom && zoom.courant > zoom.min && (
              <span className='absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/60 text-xs font-medium'>
                ×{zoom.courant.toFixed(1)}
              </span>
            )}
            <span className={`absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[90%] flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-center ${stable && captureAuto && moteurPret ? 'bg-green-600' : 'bg-black/60'}`}>
              {moteurEnChargement && <LuLoader2 size={12} className='animate-spin shrink-0' />}
              {indice}
            </span>
          </>
        )}
      </div>

      {/* Barre du bas : pages déjà prises · déclencheur · import */}
      <div className='shrink-0 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]'>
        <div className='flex items-center justify-between'>
          <div className='w-14 h-14 flex items-center justify-center'>
            {nbPages > 0 && (
              <button type='button' onClick={onVoirPages} className='relative w-12 h-14' title={t('scanner.camera.voirPages')} aria-label={t('scanner.camera.voirPages')}>
                <img src={derniereMiniature} alt='' className='w-full h-full object-cover rounded-md border-2 border-white' />
                <span className='absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-primary text-[11px] font-bold flex items-center justify-center'>
                  {nbPages}
                </span>
              </button>
            )}
          </div>

          <button
            type='button'
            onClick={erreur ? () => ouvrirSelecteur(inputPhotoRef.current) : capturer}
            disabled={!erreur && !fluxPret}
            className='w-[72px] h-[72px] rounded-full border-4 border-white/40 flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform'
            title={t('scanner.camera.capturer')}
            aria-label={t('scanner.camera.capturer')}
          >
            <span className='w-[58px] h-[58px] rounded-full bg-white' />
          </button>

          <button
            type='button'
            onClick={() => ouvrirSelecteur(inputImportRef.current)}
            className='w-14 h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] text-white/85'
            title={t('scanner.camera.importer')}
          >
            <LuImagePlus size={22} />
            {t('scanner.camera.importer')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CameraDocument
