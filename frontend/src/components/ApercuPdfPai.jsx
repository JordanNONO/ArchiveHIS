import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LuLoader2 } from 'react-icons/lu'
import { genererPdfProtocolePaiAvecPlan } from '../utils/protocolePaiPdf'

const DELAI_REGENERATION_MS = 450

/**
 * Aperçu en direct du PDF de ProtocolePai.jsx : c'est le vrai PDF (celui
 * qu'on télécharge) régénéré pendant la saisie et rendu par pdfjs, pas une
 * imitation HTML — ce qu'on voit est exactement ce qui sera imprimé.
 *
 * Toutes les pages à la suite, dans une zone qui défile : un PAI est un
 * document continu, on doit pouvoir le parcourir d'un trait plutôt que de
 * feuilleter page par page (c'était la première version, abandonnée pour
 * cette raison). Le numéro de page affiché se déduit du défilement, et le
 * menu des rubriques fait défiler jusqu'à la bonne page.
 *
 * Le conteneur de défilement garde son `scrollTop` d'une régénération à
 * l'autre (React réutilise les mêmes nœuds, chaque page étant keyée par son
 * numéro) : on ne repart pas en haut du document à chaque frappe.
 *
 * `rubriqueCible` : titre de rubrique vers laquelle défiler quand l'étape du
 * formulaire change (ex. "Organisation des prestations") — `cleCible` relance
 * le saut même si le titre est le même qu'avant.
 */

/** Une page rendue sur son propre canvas, à la largeur disponible. */
function PagePdf({ doc, numero, largeur, enregistrerRef }) {
  const canvasRef = useRef(null)
  const tacheRef = useRef(null)

  useEffect(() => {
    if (!doc || !largeur) return
    let annule = false
    doc.getPage(numero).then((page) => {
      if (annule) return
      const canvas = canvasRef.current
      if (!canvas) return
      const base = page.getViewport({ scale: 1 })
      const ratio = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: (largeur / base.width) * ratio })
      tacheRef.current?.cancel()
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${largeur}px`
      canvas.style.height = `${Math.round(viewport.height / ratio)}px`
      tacheRef.current = page.render({ canvasContext: canvas.getContext('2d'), viewport })
      tacheRef.current.promise.catch(() => {})
    }).catch(() => {})
    return () => { annule = true; tacheRef.current?.cancel() }
  }, [doc, numero, largeur])

  return (
    <div
      ref={(el) => enregistrerRef(numero, el)}
      className='relative w-full rounded-md bg-white shadow-[0_6px_24px_rgba(20,33,58,.14)] overflow-hidden'
      style={{ aspectRatio: '210 / 297' }}
    >
      <canvas ref={canvasRef} className='block' role='img' aria-label={`Page ${numero}`} />
    </div>
  )
}

function ApercuPdfPai({ protocole, extra, rubriqueCible, cleCible }) {
  const [doc, setDoc] = useState(null)
  const [sections, setSections] = useState([])
  const [pageVisible, setPageVisible] = useState(1)
  const [generation, setGeneration] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [largeur, setLargeur] = useState(0)
  const defilementRef = useRef(null)
  const pileRef = useRef(null)
  const pagesRef = useRef(new Map())
  const docRef = useRef(null)
  const sauterVersCibleRef = useRef(true)

  const numPages = doc?.numPages || 0

  const enregistrerRef = useCallback((numero, el) => {
    if (el) pagesRef.current.set(numero, el)
    else pagesRef.current.delete(numero)
  }, [])

  useEffect(() => {
    let annule = false
    setGeneration(true)
    const minuteur = setTimeout(async () => {
      try {
        const [pdfjsLib, resultat] = await Promise.all([
          import('pdfjs-dist/legacy/build/pdf.mjs'),
          genererPdfProtocolePaiAvecPlan(protocole, extra),
        ])
        if (annule) return
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const nouveau = await pdfjsLib.getDocument({ data: resultat.bytes }).promise
        if (annule) { nouveau.destroy(); return }
        const ancien = docRef.current
        docRef.current = nouveau
        setDoc(nouveau)
        setSections(resultat.sections)
        setErreur(null)
        ancien?.destroy()
      } catch (e) {
        if (!annule) setErreur("L'aperçu n'a pas pu être généré. Un caractère spécial dans un champ peut en être la cause.")
      } finally {
        if (!annule) setGeneration(false)
      }
    }, DELAI_REGENERATION_MS)
    return () => { annule = true; clearTimeout(minuteur) }
  }, [protocole, extra])

  useEffect(() => () => { docRef.current?.destroy() }, [])

  useEffect(() => {
    if (!pileRef.current) return
    const obs = new ResizeObserver(([e]) => setLargeur(Math.floor(e.contentRect.width)))
    obs.observe(pileRef.current)
    return () => obs.disconnect()
  }, [])

  const allerA = useCallback((numero, lisse = true) => {
    const zone = defilementRef.current
    const cible = pagesRef.current.get(numero)
    if (!zone || !cible) return
    zone.scrollTo({ top: cible.offsetTop - zone.offsetTop, behavior: lisse ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => { sauterVersCibleRef.current = true }, [rubriqueCible, cleCible])

  // Saut vers la rubrique de l'étape en cours — une fois par changement
  // d'étape, pas à chaque régénération (sinon on ne pourrait plus parcourir
  // librement le document pendant la saisie).
  useEffect(() => {
    if (!sauterVersCibleRef.current || !sections.length || !numPages) return
    const s = sections.find((x) => x.titre === rubriqueCible)
    if (!s) return
    sauterVersCibleRef.current = false
    allerA(s.page)
  }, [sections, rubriqueCible, cleCible, numPages, allerA])

  // Le numéro affiché suit le défilement. Toutes les pages ont la même
  // hauteur (A4) et le même écart, d'où la division directe.
  function auDefilement() {
    const zone = defilementRef.current
    if (!zone || !numPages) return
    const hauteurPage = zone.scrollHeight / numPages
    setPageVisible(Math.min(numPages, Math.floor(zone.scrollTop / hauteurPage) + 1))
  }

  const rubriqueCourante = [...sections].reverse().find((s) => s.page <= pageVisible)

  return (
    <div className='flex flex-col gap-2.5'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
          Aperçu PDF en direct
          {generation && <LuLoader2 size={12} className='animate-spin' aria-label='Mise à jour' />}
        </span>
        <span className='text-xs text-muted-foreground tabular-nums'>p. {pageVisible} / {numPages || '…'}</span>
      </div>

      {sections.length > 0 && (
        <label className='flex items-center gap-2 text-xs text-muted-foreground'>
          <span className='shrink-0'>Aller à</span>
          <select
            value={rubriqueCourante?.titre || ''}
            onChange={(e) => { const s = sections.find((x) => x.titre === e.target.value); if (s) allerA(s.page) }}
            className='flex-1 min-w-0 h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'
          >
            {sections.map((s) => <option key={s.titre} value={s.titre}>{s.titre} — p. {s.page}</option>)}
          </select>
        </label>
      )}

      <div
        ref={defilementRef}
        onScroll={auDefilement}
        className='relative w-full overflow-y-auto overscroll-contain rounded-lg bg-muted/40 p-3 max-h-[calc(100vh-13rem)] min-h-[320px]'
      >
        <div ref={pileRef} className='flex flex-col gap-3'>
          {numPages > 0
            ? Array.from({ length: numPages }, (_, i) => (
              <PagePdf key={i + 1} doc={doc} numero={i + 1} largeur={largeur} enregistrerRef={enregistrerRef} />
            ))
            : (
              <div className='relative w-full rounded-md bg-white shadow-[0_6px_24px_rgba(20,33,58,.14)]' style={{ aspectRatio: '210 / 297' }}>
                {!erreur && (
                  <div className='absolute inset-0 flex items-center justify-center text-muted-foreground'><LuLoader2 className='animate-spin' size={22} /></div>
                )}
              </div>
            )}
        </div>
      </div>

      {erreur && <p className='text-xs text-destructive'>{erreur}</p>}
      <p className='text-xs text-muted-foreground text-center'>
        {numPages ? `${numPages} page${numPages > 1 ? 's' : ''} · ` : ''}se met à jour pendant la saisie
      </p>
    </div>
  )
}

export default ApercuPdfPai
