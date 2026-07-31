import React, { useRef, useState } from 'react'
import { LuCheck, LuX, LuRotateCcw } from 'react-icons/lu'

const CLES_DANS_L_ORDRE = ['topLeftCorner', 'topRightCorner', 'bottomRightCorner', 'bottomLeftCorner']

/**
 * Éditeur de rognage manuel : affiche la photo brute avec 4 poignées
 * déplaçables aux coins du document/objet à découper, et un polygone entre
 * elles pour visualiser la zone retenue — comme les scanners de documents
 * "pro" (Notes, Adobe Scan...), pour les cas où la détection automatique se
 * trompe (petit objet dans le cadre, fond peu contrasté...).
 *
 * Le mapping écran -> coordonnées image se fait via getScreenCTM() du SVG
 * (dont le viewBox = dimensions réelles du canvas) : ça gère automatiquement
 * le letterboxing du object-contain, sans calcul manuel de décalage.
 */
function RognageEditor({ canvas, coinsInitiaux, onValider, onAnnuler }) {
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const [coins, setCoins] = useState(coinsInitiaux)

  const largeur = canvas.width
  const hauteur = canvas.height
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  const rayon = Math.max(largeur, hauteur) * 0.018

  function pointDepuisEvenement(e) {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const local = pt.matrixTransform(ctm.inverse())
    return {
      x: Math.max(0, Math.min(largeur, local.x)),
      y: Math.max(0, Math.min(hauteur, local.y)),
    }
  }

  function onPointerDown(cle, e) {
    e.preventDefault()
    dragRef.current = cle
    e.target.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e) {
    if (!dragRef.current) return
    const p = pointDepuisEvenement(e)
    if (!p) return
    setCoins((prev) => ({ ...prev, [dragRef.current]: p }))
  }

  function onPointerUp() {
    dragRef.current = null
  }

  const points = CLES_DANS_L_ORDRE.map((c) => `${coins[c].x},${coins[c].y}`).join(' ')

  return (
    <div className='fixed inset-0 z-[110] bg-black flex flex-col'>
      <div className='flex items-center justify-between px-4 py-3 bg-black/80 text-white shrink-0'>
        <span className='text-sm font-medium'>Ajuster le cadrage</span>
        <button onClick={onAnnuler} className='p-1.5 hover:bg-white/10 rounded-lg transition-colors'>
          <LuX size={20} />
        </button>
      </div>

      <div className='flex-1 relative overflow-hidden flex items-center justify-center select-none'>
        <img src={dataUrl} alt='À recadrer' className='w-full h-full object-contain pointer-events-none select-none' />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${largeur} ${hauteur}`}
          preserveAspectRatio='xMidYMid meet'
          className='absolute inset-0 w-full h-full touch-none'
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <polygon points={points} fill='rgba(59,130,246,0.25)' stroke='#3b82f6' strokeWidth={rayon * 0.35} />
          {CLES_DANS_L_ORDRE.map((cle) => (
            <circle
              key={cle}
              cx={coins[cle].x}
              cy={coins[cle].y}
              r={rayon}
              fill='#fff'
              stroke='#3b82f6'
              strokeWidth={rayon * 0.25}
              onPointerDown={(e) => onPointerDown(cle, e)}
              style={{ cursor: 'move' }}
            />
          ))}
        </svg>
      </div>

      <div className='px-4 py-4 bg-black/90 shrink-0 flex flex-col items-center gap-2'>
        <p className='text-xs text-white/60'>Fais glisser les 4 coins sur les bords de l'objet</p>
        <div className='flex items-center justify-center gap-3'>
          <button onClick={() => setCoins(coinsInitiaux)} className='flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium'>
            <LuRotateCcw size={15} /> Réinitialiser
          </button>
          <button onClick={() => onValider(coins)} className='flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium'>
            <LuCheck size={15} /> Valider le cadrage
          </button>
        </div>
      </div>
    </div>
  )
}

export default RognageEditor
