import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuCheck, LuMaximize, LuScanLine, LuRotateCcw, LuX } from 'react-icons/lu'
import { CLES_COINS } from '../../utils/scannerEngine'

// Tailles en pixels ÉCRAN (et non de la photo) : avec un rayon proportionnel
// à la photo, une poignée faisait ~7 px sur téléphone — impossible à attraper
// au doigt. La zone de saisie invisible est plus large que le rond affiché.
const RAYON_POIGNEE_PX = 11
const RAYON_SAISIE_PX = 30
const TAILLE_LOUPE_PX = 112
const GROSSISSEMENT_LOUPE = 2.5

/**
 * Ajustement manuel des 4 coins du document sur la photo, comme les scanners
 * "pro" (Notes, Adobe Scan) : poignées déplaçables, polygone de la zone
 * retenue et loupe pendant le glisser — le doigt cache précisément l'endroit
 * qu'on cherche à viser.
 *
 * Le passage écran -> coordonnées photo se fait via getScreenCTM() du SVG
 * (viewBox = dimensions réelles de la photo) : le letterboxing de
 * object-contain est géré sans calcul manuel de décalage.
 */
function AjustementBords({ photo, nouvellePage, onValider, onAnnuler }) {
  const { t } = useTranslation()
  const svgRef = useRef(null)
  const [coins, setCoins] = useState(photo.coins)
  const [glisse, setGlisse] = useState(null) // clé du coin en cours de déplacement
  const [unitesParPx, setUnitesParPx] = useState(null) // unités photo par pixel écran
  const { largeur, hauteur, url } = photo
  const pleinCadre = {
    topLeftCorner: { x: 0, y: 0 },
    topRightCorner: { x: largeur, y: 0 },
    bottomRightCorner: { x: largeur, y: hauteur },
    bottomLeftCorner: { x: 0, y: hauteur },
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const mesurer = () => {
      const { width, height } = svg.getBoundingClientRect()
      if (width && height) setUnitesParPx(Math.max(largeur / width, hauteur / height))
    }
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(svg)
    return () => observateur.disconnect()
  }, [largeur, hauteur])

  const echelle = unitesParPx || Math.max(largeur, hauteur) / 360

  function pointPhoto(e) {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const local = pt.matrixTransform(ctm.inverse())
    return { x: Math.max(0, Math.min(largeur, local.x)), y: Math.max(0, Math.min(hauteur, local.y)) }
  }

  function onPointerDown(cle, e) {
    e.preventDefault()
    svgRef.current?.setPointerCapture?.(e.pointerId)
    setGlisse(cle)
  }

  function onPointerMove(e) {
    if (!glisse) return
    const p = pointPhoto(e)
    if (p) setCoins((precedents) => ({ ...precedents, [glisse]: p }))
  }

  function finGlisse() {
    setGlisse(null)
  }

  // La loupe s'affiche dans le coin opposé à celui qu'on déplace, pour ne
  // jamais être sous le doigt.
  const loupeAGauche = glisse === 'topRightCorner' || glisse === 'bottomRightCorner'
  const pointLoupe = glisse ? coins[glisse] : null
  const pxParUnite = 1 / echelle

  const points = CLES_COINS.map((c) => `${coins[c].x},${coins[c].y}`).join(' ')
  const estPleinCadre = CLES_COINS.every((c) => Math.abs(coins[c].x - pleinCadre[c].x) < 1 && Math.abs(coins[c].y - pleinCadre[c].y) < 1)

  return (
    <div className='absolute inset-0 flex flex-col bg-black text-white'>
      <div className='flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 shrink-0'>
        <button type='button' onClick={onAnnuler} className='w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10' title={t('scanner.ajustement.annuler')} aria-label={t('scanner.ajustement.annuler')}>
          <LuX size={22} />
        </button>
        <span className='text-sm font-semibold'>{t('scanner.ajustement.titre')}</span>
        <span className='w-11' />
      </div>

      <div className='relative flex-1 min-h-0 p-6 select-none'>
        <div className='relative w-full h-full'>
          <img src={url} alt='' className='absolute inset-0 w-full h-full object-contain pointer-events-none' draggable={false} />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${largeur} ${hauteur}`}
            preserveAspectRatio='xMidYMid meet'
            className='absolute inset-0 w-full h-full touch-none overflow-visible'
            onPointerMove={onPointerMove}
            onPointerUp={finGlisse}
            onPointerCancel={finGlisse}
          >
            <defs>
              <mask id='masque-hors-document'>
                <rect x='0' y='0' width={largeur} height={hauteur} fill='white' />
                <polygon points={points} fill='black' />
              </mask>
            </defs>
            {/* Assombrit ce qui sera coupé, pour voir d'un coup d'œil la zone gardée. */}
            <rect x='0' y='0' width={largeur} height={hauteur} fill='rgba(0,0,0,0.55)' mask='url(#masque-hors-document)' />
            <polygon points={points} fill='none' stroke='#3b82f6' strokeWidth={2 * echelle} strokeLinejoin='round' />
            {CLES_COINS.map((cle) => (
              <g key={cle} onPointerDown={(e) => onPointerDown(cle, e)} style={{ cursor: 'grab' }}>
                <circle cx={coins[cle].x} cy={coins[cle].y} r={RAYON_SAISIE_PX * echelle} fill='transparent' />
                <circle
                  cx={coins[cle].x}
                  cy={coins[cle].y}
                  r={(glisse === cle ? RAYON_POIGNEE_PX * 0.6 : RAYON_POIGNEE_PX) * echelle}
                  fill={glisse === cle ? 'rgba(255,255,255,0.4)' : '#fff'}
                  stroke='#3b82f6'
                  strokeWidth={3 * echelle}
                />
              </g>
            ))}
          </svg>

          {pointLoupe && (
            <div
              className={`absolute top-0 ${loupeAGauche ? 'left-0' : 'right-0'} rounded-full border-2 border-white shadow-lg overflow-hidden pointer-events-none bg-black`}
              style={{
                width: TAILLE_LOUPE_PX,
                height: TAILLE_LOUPE_PX,
                backgroundImage: `url(${url})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${largeur * pxParUnite * GROSSISSEMENT_LOUPE}px ${hauteur * pxParUnite * GROSSISSEMENT_LOUPE}px`,
                backgroundPosition: `${TAILLE_LOUPE_PX / 2 - pointLoupe.x * pxParUnite * GROSSISSEMENT_LOUPE}px ${TAILLE_LOUPE_PX / 2 - pointLoupe.y * pxParUnite * GROSSISSEMENT_LOUPE}px`,
              }}
            >
              <span className='absolute left-1/2 top-1/2 w-5 h-px -translate-x-1/2 bg-sky-400' />
              <span className='absolute left-1/2 top-1/2 h-5 w-px -translate-y-1/2 bg-sky-400' />
            </div>
          )}
        </div>
      </div>

      <div className='shrink-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-3'>
        <p className='text-xs text-center text-white/70'>
          {photo.coinsDetectes ? t('scanner.ajustement.aide') : t('scanner.ajustement.aucunBord')}
        </p>
        <div className='grid grid-cols-3 gap-2'>
          <button type='button' onClick={onAnnuler} className='h-12 rounded-xl bg-white/10 text-sm font-medium flex items-center justify-center gap-1.5'>
            {nouvellePage ? <><LuRotateCcw size={16} /> {t('scanner.ajustement.reprendre')}</> : t('scanner.ajustement.annuler')}
          </button>
          <button
            type='button'
            onClick={() => setCoins(estPleinCadre && photo.coinsDetectes ? photo.coins : pleinCadre)}
            className='h-12 rounded-xl bg-white/10 text-sm font-medium flex items-center justify-center gap-1.5'
          >
            {estPleinCadre && photo.coinsDetectes
              ? <><LuScanLine size={16} /> {t('scanner.ajustement.bordsDetectes')}</>
              : <><LuMaximize size={16} /> {t('scanner.ajustement.pleinCadre')}</>}
          </button>
          <button type='button' onClick={() => onValider(coins)} className='h-12 rounded-xl bg-primary text-sm font-semibold flex items-center justify-center gap-1.5'>
            <LuCheck size={16} /> {nouvellePage ? t('scanner.ajustement.garder') : t('scanner.ajustement.appliquer')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AjustementBords
