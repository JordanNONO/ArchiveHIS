import React, { useRef, useState } from 'react'

const LARGEUR_BOUTON = 68

/**
 * Comme SwipeToDelete.jsx (même geste : glisser vers la droite révèle des
 * boutons à gauche), mais pour plusieurs actions côte à côte — ex: Modifier +
 * Supprimer sur une prestation, façon application de messagerie.
 *
 * `actions`: [{ icone, libelle, onClick, classe }] — `classe` fixe la couleur
 * du bouton (ex: 'bg-primary text-white' pour modifier, 'bg-destructive
 * text-white' pour supprimer), dans l'ordre d'apparition de gauche à droite.
 */
function SwipeActions({ actions, children, disabled = false, className = '' }) {
  const largeurRevelee = actions.length * LARGEUR_BOUTON
  const [offset, setOffset] = useState(0)
  const glisseRef = useRef({ active: false, verrouille: false, startX: 0, startY: 0, startOffset: 0 })
  const [enCours, setEnCours] = useState(false)

  function position(e) {
    return e.touches ? e.touches[0] : e
  }

  function pointerDown(e) {
    if (disabled) return
    const p = position(e)
    glisseRef.current = { active: true, verrouille: false, startX: p.clientX, startY: p.clientY, startOffset: offset }
  }

  function pointerMove(e) {
    const g = glisseRef.current
    if (!g.active) return
    const p = position(e)
    const dx = p.clientX - g.startX
    const dy = p.clientY - g.startY
    if (!g.verrouille) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      if (Math.abs(dy) > Math.abs(dx)) {
        g.active = false
        return
      }
      g.verrouille = true
    }
    e.preventDefault()
    setOffset(Math.max(0, Math.min(largeurRevelee, g.startOffset + dx)))
  }

  function pointerUp() {
    const g = glisseRef.current
    if (!g.active) return
    g.active = false
    if (g.verrouille) {
      setOffset((o) => (o > largeurRevelee / 2 ? largeurRevelee : 0))
    }
  }

  function onClickCapture(e) {
    if (offset > 0) {
      e.preventDefault()
      e.stopPropagation()
      setOffset(0)
    }
  }

  async function declencher(action) {
    setEnCours(true)
    try {
      await action.onClick()
    } finally {
      setEnCours(false)
      setOffset(0)
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <div className='absolute inset-y-0 left-0 flex' style={{ width: largeurRevelee }}>
        {actions.map((action, i) => {
          const Icon = action.icone
          return (
            <button
              key={i}
              type='button'
              onClick={() => declencher(action)}
              disabled={enCours}
              tabIndex={offset > 0 ? 0 : -1}
              className={`flex flex-col items-center justify-center gap-0.5 disabled:opacity-60 ${action.classe}`}
              style={{ width: LARGEUR_BOUTON }}
            >
              <Icon size={16} />
              <span className='text-[10px] font-medium'>{action.libelle}</span>
            </button>
          )
        })}
      </div>
      <div
        onMouseDown={pointerDown}
        onMouseMove={pointerMove}
        onMouseUp={pointerUp}
        onMouseLeave={pointerUp}
        onTouchStart={pointerDown}
        onTouchMove={pointerMove}
        onTouchEnd={pointerUp}
        onClickCapture={onClickCapture}
        style={{
          transform: `translateX(${offset}px)`,
          transition: glisseRef.current.active ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
        }}
        className='relative bg-card'
      >
        {children}
      </div>
    </div>
  )
}

export default SwipeActions
