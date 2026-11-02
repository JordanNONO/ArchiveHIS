import React, { useEffect, useRef, useState } from 'react'
import { LuEraser } from 'react-icons/lu'

/**
 * Pavé de signature tactile/souris auto-hébergé (pas de librairie externe) —
 * dessine sur un canvas en résolution native (devicePixelRatio) pour rester
 * net sur mobile, et expose le tracé en PNG via `onChange` (dataURL, ou null
 * si le pavé est vide) pour être incrusté ensuite dans le PDF généré.
 *
 * Pointer Events (pas mouse+touch séparés) : un seul jeu de handlers pour
 * souris/doigt/stylet, setPointerCapture garde les événements rattachés au
 * canvas même si le doigt en sort pendant le tracé (sinon `terminer` ne se
 * déclenche jamais et le trait reste "collé"). touch-action: none (classe
 * touch-none ci-dessous) empêche déjà le défilement de la page pendant la
 * signature ; côté JS, preventDefault() sur onTouchMove ne suffisait pas
 * seul, React attachant ce listener en passif par défaut.
 */
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const dessineRef = useRef(false)
  // Un vrai trait a-t-il été posé (pas juste un appui relâché sans bouger) —
  // c'est CE flag, pas juste "le pointeur a été pressé", qui doit décider si
  // onChange reçoit une image : avant ce correctif, `terminer()` renvoyait
  // systématiquement le canvas (même vierge) dès qu'on avait touché le
  // pavé, laissant passer une "signature" blanche.
  const aDessineRef = useRef(false)
  const [vide, setVide] = useState(true)

  function initCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return
    canvas.width = width * ratio
    canvas.height = height * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1c1917'
  }

  useEffect(() => {
    initCanvas()
    // Reprend les dimensions si le pavé change de taille (rotation de
    // l'écran, fin de l'animation d'entrée de l'étape du wizard qui peut
    // fausser la mesure prise au tout premier rendu...) — redimensionner un
    // <canvas> efface son contenu, d'où le effacer() qui suit, cohérent
    // avec le pavé réellement vide à l'écran.
    const ro = new ResizeObserver(() => { initCanvas(); effacer() })
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function position(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function commencer(e) {
    e.preventDefault()
    canvasRef.current.setPointerCapture(e.pointerId)
    dessineRef.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = position(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    // Un simple tap sans mouvement (le point d'un "i", un paraphe...) ne
    // déclenche jamais `dessiner()` ci-dessous : sans ce point dessiné tout
    // de suite, il resterait invisible alors qu'il doit compter comme un
    // vrai trait.
    ctx.lineTo(x + 0.01, y + 0.01)
    ctx.stroke()
    aDessineRef.current = true
    if (vide) setVide(false)
  }

  function dessiner(e) {
    if (!dessineRef.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = position(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function terminer(e) {
    if (!dessineRef.current) return
    dessineRef.current = false
    try { canvasRef.current.releasePointerCapture(e.pointerId) } catch { /* déjà relâché */ }
    if (aDessineRef.current) onChange(canvasRef.current.toDataURL('image/png'))
  }

  function effacer() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    aDessineRef.current = false
    setVide(true)
    onChange(null)
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <div className='relative rounded-lg border border-border bg-white'>
        <canvas
          ref={canvasRef}
          className='w-full h-32 rounded-lg touch-none cursor-crosshair'
          onPointerDown={commencer}
          onPointerMove={dessiner}
          onPointerUp={terminer}
          onPointerCancel={terminer}
        />
        {vide && (
          <span className='absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none'>
            Signez ici avec le doigt ou la souris
          </span>
        )}
      </div>
      <button type='button' onClick={effacer} className='self-end inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors'>
        <LuEraser size={12} /> Effacer
      </button>
    </div>
  )
}

export default SignaturePad
