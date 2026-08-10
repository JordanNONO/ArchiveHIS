import React, { useEffect, useRef, useState } from 'react'
import { LuChevronLeft, LuChevronRight, LuLoader2 } from 'react-icons/lu'

/**
 * Visionneuse PDF page par page — remplace l'aperçu natif du navigateur dans
 * un <iframe>, qui affiche en petit et défile en continu selon le
 * navigateur/l'appareil. Ici : une page à la fois, mise à l'échelle pour
 * remplir la largeur disponible, avec précédent/suivant.
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
  const canvasRef = useRef(null)
  const conteneurRef = useRef(null)
  const renduEnCoursRef = useRef(null)

  useEffect(() => {
    let annule = false
    setChargement(true)
    setErreur(false)
    setDoc(null)

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

  useEffect(() => {
    if (!doc || !canvasRef.current || !conteneurRef.current) return
    let annule = false
    doc.getPage(pageNum).then((page) => {
      if (annule || !canvasRef.current || !conteneurRef.current) return
      const largeurDisponible = conteneurRef.current.clientWidth
      const viewportBase = page.getViewport({ scale: 1 })
      const echelle = Math.min(largeurDisponible / viewportBase.width, 2.2)
      const viewport = page.getViewport({ scale: echelle })
      const canvas = canvasRef.current
      canvas.width = viewport.width
      canvas.height = viewport.height
      const contexte = canvas.getContext('2d')
      // Annule le rendu précédent s'il tournait encore (changement rapide de page)
      if (renduEnCoursRef.current) renduEnCoursRef.current.cancel()
      const tache = page.render({ canvasContext: contexte, viewport })
      renduEnCoursRef.current = tache
      tache.promise.catch(() => {})
    })
    return () => { annule = true }
  }, [doc, pageNum])

  if (erreur) return null

  return (
    <div ref={conteneurRef} className='w-full flex flex-col items-center gap-3'>
      {chargement ? (
        <div className='flex items-center justify-center h-[70vh] lg:h-[90vh] w-full'>
          <LuLoader2 className='animate-spin text-muted-foreground' size={28} />
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} className='max-w-full rounded-lg shadow-sm border border-border' />
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
        </>
      )}
    </div>
  )
}

export default PdfPageViewer
