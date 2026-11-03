import React, { useEffect, useRef, useState } from 'react'
import { LuChevronLeft, LuChevronRight, LuLoader2 } from 'react-icons/lu'
import { genererPdfProtocolePaiAvecPlan } from '../utils/protocolePaiPdf'

const DELAI_REGENERATION_MS = 450

/**
 * Aperçu en direct du PDF de ProtocolePai.jsx : c'est le vrai PDF (celui
 * qu'on télécharge) régénéré pendant la saisie et rendu par pdfjs, pas une
 * imitation HTML — ce qu'on voit est exactement ce qui sera imprimé.
 *
 * Une page à la fois. Le nombre de pages dépend du contenu (programme
 * détaillé, longs paragraphes...) et peut monter haut : pas d'onglet par
 * page, mais précédent/suivant, un numéro de page à saisir et un menu des
 * rubriques avec leur page.
 *
 * `rubriqueCible` : titre de rubrique à afficher quand l'étape du formulaire
 * change (ex. "Organisation des prestations") — `cleCible` relance le saut
 * même si le titre est le même qu'avant.
 */
function ApercuPdfPai({ protocole, extra, rubriqueCible, cleCible }) {
  const [doc, setDoc] = useState(null)
  const [sections, setSections] = useState([])
  const [pageNum, setPageNum] = useState(1)
  const [saisiePage, setSaisiePage] = useState('1')
  const [generation, setGeneration] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [largeur, setLargeur] = useState(0)
  const conteneurRef = useRef(null)
  const canvasRef = useRef(null)
  const tacheRenduRef = useRef(null)
  const docRef = useRef(null)
  const sauterVersCibleRef = useRef(true)

  const numPages = doc?.numPages || 0

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

  useEffect(() => { sauterVersCibleRef.current = true }, [rubriqueCible, cleCible])

  // Saut vers la rubrique de l'étape en cours — une fois par changement
  // d'étape, pas à chaque régénération (sinon on ne pourrait plus feuilleter).
  useEffect(() => {
    if (!sauterVersCibleRef.current || !sections.length) return
    sauterVersCibleRef.current = false
    const s = sections.find((x) => x.titre === rubriqueCible)
    if (s) setPageNum(s.page)
  }, [sections, rubriqueCible, cleCible])

  useEffect(() => {
    if (numPages && pageNum > numPages) setPageNum(numPages)
  }, [numPages, pageNum])

  useEffect(() => { setSaisiePage(String(pageNum)) }, [pageNum])

  useEffect(() => {
    if (!conteneurRef.current) return
    const obs = new ResizeObserver(([e]) => setLargeur(Math.floor(e.contentRect.width)))
    obs.observe(conteneurRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!doc || !largeur || !canvasRef.current) return
    let annule = false
    doc.getPage(Math.min(pageNum, doc.numPages)).then((page) => {
      if (annule) return
      const base = page.getViewport({ scale: 1 })
      const ratio = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: (largeur / base.width) * ratio })
      const canvas = canvasRef.current
      if (!canvas) return
      tacheRenduRef.current?.cancel()
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${largeur}px`
      canvas.style.height = `${Math.round(viewport.height / ratio)}px`
      tacheRenduRef.current = page.render({ canvasContext: canvas.getContext('2d'), viewport })
      tacheRenduRef.current.promise.catch(() => {})
    }).catch(() => {})
    return () => { annule = true }
  }, [doc, pageNum, largeur])

  function allerA(n) {
    if (!numPages) return
    setPageNum(Math.min(Math.max(1, n), numPages))
  }

  function validerSaisie() {
    const n = parseInt(saisiePage, 10)
    if (Number.isNaN(n)) setSaisiePage(String(pageNum))
    else allerA(n)
  }

  const rubriqueCourante = [...sections].reverse().find((s) => s.page <= pageNum)

  return (
    <div className='flex flex-col gap-2.5'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
          Aperçu PDF en direct
          {generation && <LuLoader2 size={12} className='animate-spin' aria-label='Mise à jour' />}
        </span>
        <div className='flex items-center gap-1'>
          <button type='button' onClick={() => allerA(pageNum - 1)} disabled={pageNum <= 1} aria-label='Page précédente' className='w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 transition-colors'>
            <LuChevronLeft size={16} />
          </button>
          <label className='flex items-center gap-1.5 text-xs text-muted-foreground px-1'>
            <span className='sr-only'>Numéro de page</span>
            <input
              type='text'
              inputMode='numeric'
              value={saisiePage}
              onChange={(e) => setSaisiePage(e.target.value.replace(/\D/g, ''))}
              onBlur={validerSaisie}
              onKeyDown={(e) => { if (e.key === 'Enter') validerSaisie() }}
              className='w-11 h-9 rounded-lg border border-border bg-background text-center text-sm font-semibold text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30'
            />
            <span className='tabular-nums'>/ {numPages || '…'}</span>
          </label>
          <button type='button' onClick={() => allerA(pageNum + 1)} disabled={!numPages || pageNum >= numPages} aria-label='Page suivante' className='w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 transition-colors'>
            <LuChevronRight size={16} />
          </button>
        </div>
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

      <div ref={conteneurRef} className='relative w-full rounded-md bg-white shadow-[0_6px_24px_rgba(20,33,58,.14)] overflow-hidden' style={{ aspectRatio: doc ? undefined : '210 / 297' }}>
        <canvas ref={canvasRef} className='block' aria-label={`Page ${pageNum} du PDF`} role='img' />
        {!doc && !erreur && (
          <div className='absolute inset-0 flex items-center justify-center text-muted-foreground'><LuLoader2 className='animate-spin' size={22} /></div>
        )}
      </div>
      {erreur && <p className='text-xs text-destructive'>{erreur}</p>}
      <p className='text-xs text-muted-foreground text-center'>Page {pageNum} / {numPages || '…'} · se met à jour pendant la saisie</p>
    </div>
  )
}

export default ApercuPdfPai
