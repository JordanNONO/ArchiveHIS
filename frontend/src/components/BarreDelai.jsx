import React from 'react'
import { pourcentageTempsRestant, couleurUrgence } from '../utils/common'

/**
 * Barre fine en haut d'une carte de document qui se vide au fur et à mesure
 * que l'échéance du suivi de délai actif approche — verte, puis orange, puis
 * rouge scintillante — calculée depuis les vraies dates de suivi (voir
 * pourcentageTempsRestant), pas une estimation fixe. N'affiche rien s'il n'y
 * a pas de suivi de délai actif sur le document.
 */
function BarreDelai({ suiviDelaiActif }) {
  if (!suiviDelaiActif) return null
  const pourcentage = pourcentageTempsRestant(suiviDelaiActif)
  if (pourcentage === null) return null

  return (
    <div className='absolute top-0 left-0 right-0 h-1 bg-muted/60 overflow-hidden rounded-t-[inherit]'>
      <div
        className={`h-full transition-[width] duration-500 ${couleurUrgence(suiviDelaiActif.niveau_alerte)}`}
        style={{ width: `${pourcentage * 100}%` }}
      />
    </div>
  )
}

export default BarreDelai
