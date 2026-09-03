import React, { useEffect, useRef, useState } from 'react'
import { LuLoader2, LuZoomIn, LuZoomOut, LuRotateCcw } from 'react-icons/lu'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_PAS = 0.25

/**
 * Visionneuse PDF — toutes les pages affichées à la suite, verticalement,
 * comme dans un lecteur PDF classique (Chrome, Adobe, Google Drive...)
 * plutôt qu'une page à la fois avec des boutons précédent/suivant : on
 * voit tout le document d'un coup en défilant, avec un zoom manuel qui
 * s'applique à toutes les pages ensemble.
 *
 * Rendu de chaque page à chaque changement de zoom/largeur — les documents
 * de cette appli restent courts (quelques pages, pas des centaines), pas
 * besoin d'un rendu paresseux à la défilement pour rester fluide.
 *
 * pdfjs-dist est chargé à la demande (import() dynamique, comme jsPDF dans
 * messagePdf.js) plutôt qu'au chargement de l'app entière — volumineux, et ne
 * sert qu'à cet écran précis.
 */
function PdfPageViewer({ url }) {
  const [doc, setDoc] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [largeurConteneur, setLargeurConteneur] = useState(0)
  const conteneurRef = useRef(null)
  const canvasRefs = useRef({})
  const tachesRenduRef = useRef({})

  useEffect(() => {
    let annule = false
    setChargement(true)
    setErreur(false)
    setDoc(null)
    setZoom(1)
    canvasRefs.current = {}

    import('pdfjs-dist/legacy/build/pdf.mjs')
      .then((pdfjsLib) => {
        if (annule) return null
        // Worker auto-hébergé (copié depuis node_modules dans public/, voir
        // package.json "postinstall") plutôt qu'un CDN — cohérent avec le
        // reste de l'app qui évite les dépendances externes à l'exécution.
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        return pdfjsLib.getDocument(url).promise
      })
      .then((pdf) => {
        if (annule || !pdf) return
        setDoc(pdf)
        setNumPages(pdf.numPages)
      })
      .catch(() => { if (!annule) setErreur(true) })
      .finally(() => { if (!annule) setChargement(false) })

    return () => { annule = true }
  }, [url])

  // Suit la largeur réellement disponible en continu (pas seulement à
  // l'ouverture) — indispensable pour que les pages se redimensionnent quand
  // on bascule en plein écran (voir DocView.jsx) ou qu'on redimensionne la fenêtre.
  useEffect(() => {
    if (!conteneurRef.current) return
    const observateur = new ResizeObserver((entrees) => {
      const largeur = entrees[0]?.contentRect?.width
      if (largeur) setLargeurConteneur(largeur)
    })
    observateur.observe(conteneurRef.current)
    return () => observateur.disconnect()
  }, [])

  useEffect(() => {
    if (!doc || !largeurConteneur || numPages === 0) return
    let annule = false

    function rendrePage(num) {
      doc.getPage(num).then((page) => {
        if (annule) return
        const canvas = canvasRefs.current[num]
        if (!canvas) return
        const viewportBase = page.getViewport({ scale: 1 })
        const echelle = Math.min(largeurConteneur / viewportBase.width, 2.2) * zoom
        const viewport = page.getViewport({ scale: echelle })
        canvas.width = viewport.width
        canvas.height = viewport.height
        const contexte = canvas.getContext('2d')
        // Annule le rendu précédent de cette page s'il tournait encore
        // (changement rapide de zoom pendant qu'une page se dessine encore).
        if (tachesRenduRef.current[num]) tachesRenduRef.current[num].cancel()
        const tache = page.render({ canvasContext: contexte, viewport })
        tachesRenduRef.current[num] = tache
        tache.promise.catch(() => {})
      })
    }

    Array.from({ length: numPages }, (_, i) => i + 1).forEach(rendrePage)

    return () => { annule = true }
  }, [doc, numPages, zoom, largeurConteneur])

  if (erreur) return null

  return (
    <div ref={conteneurRef} className='w-full flex flex-col items-center gap-3'>
      {chargement ? (
        <div className='flex items-center justify-center h-[70vh] lg:h-[90vh] w-full'>
          <LuLoader2 className='animate-spin text-muted-foreground' size={28} />
        </div>
      ) : (
        <>
          <div className='sticky top-0 z-10 flex items-center gap-1.5 bg-card/95 backdrop-blur rounded-lg border border-border px-2 py-1.5 shadow-sm'>
            <button
              type='button'
              disabled={zoom <= ZOOM_MIN}
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_PAS).toFixed(2)))}
              className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
            >
              <LuZoomOut size={14} />
            </button>
            <span className='text-xs font-medium text-muted-foreground tabular-nums w-10 text-center'>{Math.round(zoom * 100)}%</span>
            <button
              type='button'
              disabled={zoom >= ZOOM_MAX}
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_PAS).toFixed(2)))}
              className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
            >
              <LuZoomIn size={14} />
            </button>
            {zoom !== 1 && (
              <button
                type='button'
                onClick={() => setZoom(1)}
                title='Réinitialiser le zoom'
                className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition-colors'
              >
                <LuRotateCcw size={13} />
              </button>
            )}
            {numPages > 1 && (
              <span className='text-xs text-muted-foreground pl-1.5 border-l border-border ml-0.5 tabular-nums'>{numPages} pages</span>
            )}
          </div>
          <div className='w-full flex flex-col items-center gap-4'>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((num) => (
              <canvas
                key={num}
                ref={(el) => { canvasRefs.current[num] = el }}
                className='rounded-lg shadow-sm border border-border max-w-full'
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default PdfPageViewer
