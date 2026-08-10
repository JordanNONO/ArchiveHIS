import React from 'react'
import hisLogo from '../assets/his-logo.png'

/**
 * Filigrane HIS très discret — logo centré, opacité très faible (maquette
 * "centré très discret" approuvée). Un seul par page : sur une carte unique
 * (Réclamation, Congés...) `fixe` reste false et le filigrane se centre sur
 * cette carte (position absolute, parent `relative`) ; sur une page interne
 * sans carte dominante (OpenFolder...) `fixe=true` le centre sur le
 * viewport et l'y garde pendant le défilement, comme un tampon fixe sur la
 * page. Jamais interactif (pointer-events-none), toujours derrière le
 * contenu (z-index négatif).
 */
function FiligraneHIS({ fixe = false }) {
  return (
    <div
      aria-hidden='true'
      className={`pointer-events-none ${fixe ? 'fixed' : 'absolute'} inset-0 -z-10 bg-no-repeat bg-center opacity-[0.05]`}
      style={{ backgroundImage: `url(${hisLogo})`, backgroundSize: '340px auto' }}
    />
  )
}

export default FiligraneHIS
