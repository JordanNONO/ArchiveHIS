import React, { useRef, useState } from 'react'
import { LuTrash2 } from 'react-icons/lu'

const LARGEUR_REVELEE = 76

/**
 * Glisser-pour-supprimer façon application de messagerie : on glisse la ligne
 * vers la DROITE pour révéler un bouton de suppression en dessous (à gauche),
 * comme demandé — pas d'auto-suppression sur simple glissement, il faut
 * appuyer sur le bouton révélé pour confirmer (évite les suppressions
 * accidentelles). Un tap ailleurs sur la ligne pendant qu'elle est révélée la
 * referme au lieu de déclencher l'action normale de la ligne (ex: ouvrir le
 * document) — d'où le contenu enfant qui doit rester un simple `children`,
 * pas nécessairement un `<Link>` racine.
 */
function SwipeToDelete({ onDelete, children, disabled = false, className = '' }) {
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
    setOffset(Math.max(0, Math.min(LARGEUR_REVELEE, g.startOffset + dx)))
  }

  function pointerUp() {
    const g = glisseRef.current
    if (!g.active) return
    g.active = false
    if (g.verrouille) {
      setOffset((o) => (o > LARGEUR_REVELEE / 2 ? LARGEUR_REVELEE : 0))
    }
  }

  function onClickCapture(e) {
    if (offset > 0) {
      e.preventDefault()
      e.stopPropagation()
      setOffset(0)
    }
  }

  async function confirmerSuppression() {
    setEnCours(true)
    try {
      await onDelete()
    } finally {
      setEnCours(false)
      setOffset(0)
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <button
        type='button'
        onClick={confirmerSuppression}
        disabled={enCours}
        tabIndex={offset > 0 ? 0 : -1}
        className='absolute inset-y-0 left-0 flex items-center justify-center bg-destructive text-white disabled:opacity-60'
        style={{ width: LARGEUR_REVELEE }}
      >
        <LuTrash2 size={17} />
      </button>
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

export default SwipeToDelete
