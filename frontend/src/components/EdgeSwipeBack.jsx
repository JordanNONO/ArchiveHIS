import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'

// Zone de départ du geste (comme le bord actif d'iOS, ~20-24pt), DES DEUX
// CÔTÉS — un doigt qui pose ailleurs sur l'écran ne doit jamais déclencher ça
// (listes glissables, carrousel de notation, défilement normal...).
const ZONE_BORD = 24
// Distance à parcourir pour valider le retour — au-delà, on lâche vers la
// page précédente/suivante ; en-deçà, ça revient à sa place comme si de rien
// n'était.
const SEUIL_VALIDATION = 90

/**
 * Navigation précédent/suivant au glissement depuis les bords de l'écran,
 * façon iOS (bord gauche → précédent, bord droit → suivant) — Android n'a
 * rien d'équivalent nativement dans un navigateur/PWA, d'où cet ajout : "pour
 * naviguer côté Android c'est un peu pénible". Tactile uniquement (jamais la
 * souris, sans quoi un simple clic près du bord pourrait le déclencher par
 * erreur sur desktop).
 *
 * `window.history.state.idx` (posé par la lib `history` sous-jacente à
 * react-router) sert à savoir s'il y a réellement une page précédente dans CE
 * passage sur l'appli, pour le bord gauche — pas d'équivalent fiable pour
 * savoir s'il y a une page "suivante" avant d'essayer (l'API History ne
 * l'expose pas) : navigate(1) ne fait simplement rien s'il n'y a rien devant,
 * sans risque de sortir du SPA.
 */
function EdgeSwipeBack({ children, actif = true }) {
  const navigate = useNavigate()
  const [dx, setDx] = useState(0) // >0 glissement depuis la gauche (retour), <0 depuis la droite (suivant)
  const [enCours, setEnCours] = useState(false)
  const [libere, setLibere] = useState(false)
  const glisseRef = useRef({ actif: false, verrouille: false, sens: null, startX: 0, startY: 0 })

  function pointerDown(e) {
    if (!actif || libere) return
    const p = e.touches[0]
    const largeur = window.innerWidth
    let sens = null
    if (p.clientX <= ZONE_BORD && (window.history.state?.idx ?? 0) > 0) {
      sens = 'arriere'
    } else if (p.clientX >= largeur - ZONE_BORD) {
      sens = 'avant'
    } else {
      return
    }
    glisseRef.current = { actif: true, verrouille: false, sens, startX: p.clientX, startY: p.clientY }
  }

  function pointerMove(e) {
    const g = glisseRef.current
    if (!g.actif) return
    const p = e.touches[0]
    const deltaX = p.clientX - g.startX
    const deltaY = p.clientY - g.startY
    if (!g.verrouille) {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        g.actif = false // défilement vertical : on laisse la page scroller normalement
        return
      }
      g.verrouille = true
      setEnCours(true)
    }
    e.preventDefault()
    if (g.sens === 'arriere' && deltaX > 0) {
      setDx(Math.min(deltaX, window.innerWidth))
    } else if (g.sens === 'avant' && deltaX < 0) {
      setDx(Math.max(deltaX, -window.innerWidth))
    }
  }

  function pointerUp() {
    const g = glisseRef.current
    if (!g.actif) return
    g.actif = false
    const valide = g.sens === 'arriere' ? dx > SEUIL_VALIDATION : dx < -SEUIL_VALIDATION
    if (valide) {
      const largeur = window.innerWidth
      setLibere(true)
      setDx(g.sens === 'arriere' ? largeur : -largeur)
      setTimeout(() => {
        navigate(g.sens === 'arriere' ? -1 : 1)
        setEnCours(false)
        setLibere(false)
        setDx(0)
      }, 180)
    } else {
      setEnCours(false)
      setDx(0)
    }
  }

  const sensActuel = glisseRef.current.sens
  const progression = Math.min(Math.abs(dx) / SEUIL_VALIDATION, 1)

  return (
    <div
      onTouchStart={pointerDown}
      onTouchMove={pointerMove}
      onTouchEnd={pointerUp}
      onTouchCancel={pointerUp}
      className='relative w-full'
      style={{ touchAction: dx !== 0 ? 'none' : 'pan-y' }}
    >
      {dx !== 0 && (
        <div
          aria-hidden='true'
          className={`pointer-events-none fixed top-1/2 -translate-y-1/2 z-[60] flex items-center justify-center w-9 h-9 rounded-full bg-card border border-border shadow-lg text-foreground ${sensActuel === 'arriere' ? 'left-2' : 'right-2'}`}
          style={{ opacity: progression, transform: `translateY(-50%) scale(${0.7 + progression * 0.3})` }}
        >
          {sensActuel === 'arriere' ? <LuChevronLeft size={18} /> : <LuChevronRight size={18} />}
        </div>
      )}
      <div
        style={{
          transform: dx !== 0 ? `translateX(${dx}px)` : undefined,
          transition: enCours && !libere ? 'none' : 'transform 0.18s ease',
          boxShadow: dx > 0 ? '-12px 0 24px -12px rgba(16,26,44,0.25)' : dx < 0 ? '12px 0 24px -12px rgba(16,26,44,0.25)' : undefined,
        }}
        className='w-full'
      >
        {children}
      </div>
    </div>
  )
}

export default EdgeSwipeBack
