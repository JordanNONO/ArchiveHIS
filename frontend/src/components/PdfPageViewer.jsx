import React, { useEffect, useRef, useState } from 'react'
import { LuChevronLeft, LuChevronRight, LuLoader2, LuZoomIn, LuZoomOut, LuRotateCcw } from 'react-icons/lu'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_PAS = 0.25

/**
 * Visionneuse PDF page par page — remplace l'aperçu natif du navigateur dans
 * un <iframe>, qui affiche en petit et défile en continu selon le
 * navigateur/l'appareil. Ici : une page à la fois, mise à l'échelle pour
 * remplir la largeur disponible, avec précédent/suivant et un zoom manuel —
 * ce dernier surtout utile en plein écran (voir DocView.jsx), où la largeur
 * disponible change d'un coup et où "ajusté à la largeur" ne suffit pas
 * toujours à profiter de l'espace.
 *
 * pdfjs-dist est chargé à la demande (import() dynamique, comme jsPDF dans
 * messagePdf.js) plutôt qu'au chargement de l'app entière — volumineux, et ne
 * sert qu'à cet écran précis.
 */
function PdfPageViewer({ url }) {
  const [doc, setDoc] = useState(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [largeurConteneur, setLargeurConteneur] = useState(0)
  const canvasRef = useRef(null)
  const conteneurRef = useRef(null)
  const renduEnCoursRef = useRef(null)

  useEffect(() => {
    let annule = false
    setChargement(true)
    setErreur(false)
    setDoc(null)
    setZoom(1)

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
        setPageNum(1)
      })
      .catch(() => { if (!annule) setErreur(true) })
      .finally(() => { if (!annule) setChargement(false) })

    return () => { annule = true }
  }, [url])

  // Suit la largeur réellement disponible en continu (pas seulement à
  // l'ouverture) — indispensable pour que la page se redimensionne quand on
  // bascule en plein écran (voir DocView.jsx) ou qu'on redimensionne la fenêtre.
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
    if (!doc || !canvasRef.current || !largeurConteneur) return
    let annule = false
    doc.getPage(pageNum).then((page) => {
      if (annule || !canvasRef.current) return
      const viewportBase = page.getViewport({ scale: 1 })
      const echelleAjustee = Math.min(largeurConteneur / viewportBase.width, 2.2) * zoom
      const viewport = page.getViewport({ scale: echelleAjustee })
      const canvas = canvasRef.current
      canvas.width = viewport.width
      canvas.height = viewport.height
      const contexte = canvas.getContext('2d')
      // Annule le rendu précédent s'il tournait encore (changement rapide de page/zoom)
      if (renduEnCoursRef.current) renduEnCoursRef.current.cancel()
      const tache = page.render({ canvasContext: contexte, viewport })
      renduEnCoursRef.current = tache
      tache.promise.catch(() => {})
    })
    return () => { annule = true }
  }, [doc, pageNum, zoom, largeurConteneur])

  if (erreur) return null

  return (
    <div ref={conteneurRef} className='w-full flex flex-col items-center gap-3'>
      {chargement ? (
        <div className='flex items-center justify-center h-[70vh] lg:h-[90vh] w-full'>
          <LuLoader2 className='animate-spin text-muted-foreground' size={28} />
        </div>
      ) : (
        <>
          <div className='w-full overflow-auto flex justify-center'>
            <canvas ref={canvasRef} className='rounded-lg shadow-sm border border-border' />
          </div>
          <div className='flex items-center gap-4 flex-wrap justify-center'>
            {numPages > 1 && (
              <div className='flex items-center gap-3'>
                <button
                  type='button'
                  disabled={pageNum <= 1}
                  onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                  className='flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
                >
                  <LuChevronLeft size={16} />
                </button>
                <span className='text-sm font-medium text-muted-foreground tabular-nums'>Page {pageNum} / {numPages}</span>
                <button
                  type='button'
                  disabled={pageNum >= numPages}
                  onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
                  className='flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
                >
                  <LuChevronRight size={16} />
                </button>
              </div>
            )}
            <div className='flex items-center gap-1.5'>
              <button
                type='button'
                disabled={zoom <= ZOOM_MIN}
                onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_PAS).toFixed(2)))}
                className='flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
              >
                <LuZoomOut size={15} />
              </button>
              <span className='text-sm font-medium text-muted-foreground tabular-nums w-12 text-center'>{Math.round(zoom * 100)}%</span>
              <button
                type='button'
                disabled={zoom >= ZOOM_MAX}
                onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_PAS).toFixed(2)))}
                className='flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
              >
                <LuZoomIn size={15} />
              </button>
              {zoom !== 1 && (
                <button
                  type='button'
                  onClick={() => setZoom(1)}
                  title='Réinitialiser le zoom'
                  className='flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors'
                >
                  <LuRotateCcw size={14} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default PdfPageViewer
