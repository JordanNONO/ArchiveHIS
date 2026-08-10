import React, { useEffect, useRef, useState } from 'react'
import { LuEraser } from 'react-icons/lu'

/**
 * Pavé de signature tactile/souris auto-hébergé (pas de librairie externe) —
 * dessine sur un canvas en résolution native (devicePixelRatio) pour rester
 * net sur mobile, et expose le tracé en PNG via `onChange` (dataURL, ou null
 * si le pavé est vide) pour être incrusté ensuite dans le PDF généré.
 */
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const dessineRef = useRef(false)
  const [vide, setVide] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const ratio = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width * ratio
    canvas.height = height * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1c1917'
  }, [])

  function position(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    return { x: point.clientX - rect.left, y: point.clientY - rect.top }
  }

  function commencer(e) {
    e.preventDefault()
    dessineRef.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = position(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function dessiner(e) {
    if (!dessineRef.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = position(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (vide) setVide(false)
  }

  function terminer() {
    if (!dessineRef.current) return
    dessineRef.current = false
    onChange(canvasRef.current.toDataURL('image/png'))
  }

  function effacer() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setVide(true)
    onChange(null)
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <div className='relative rounded-lg border border-border bg-white'>
        <canvas
          ref={canvasRef}
          className='w-full h-32 rounded-lg touch-none cursor-crosshair'
          onMouseDown={commencer}
          onMouseMove={dessiner}
          onMouseUp={terminer}
          onMouseLeave={terminer}
          onTouchStart={commencer}
          onTouchMove={dessiner}
          onTouchEnd={terminer}
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
