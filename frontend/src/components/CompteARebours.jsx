import React, { useEffect, useState } from 'react'
import { infoDelaiCorrection } from '../utils/common'

/**
 * Compte à rebours vivant du délai de correction (3 jours) d'un document
 * rejeté — se remet à jour tout seul (pas besoin de recharger la page) et
 * bascule en noir une fois l'échéance dépassée, en continuant à compter le
 * retard. Visible des deux côtés (déposant ET service) — voir
 * DocumentStatusService côté backend.
 */
function CompteARebours({ document, className = '' }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  const info = infoDelaiCorrection(document)
  if (!info) return null

  return (
    <p className={`text-[11px] text-center font-medium ${info.enRetard ? 'text-neutral-800 dark:text-neutral-300' : 'text-destructive'} ${className}`}>
      {info.texte}
    </p>
  )
}

export default CompteARebours
