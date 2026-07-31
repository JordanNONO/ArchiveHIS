import React, { useState } from 'react'
import Home from '../pages/Home'
import EspaceIntervenant from '../pages/EspaceIntervenant'
import OnboardingTour from './OnboardingTour'
import { onboardingDejaVu, marquerOnboardingVu } from '../utils/onboarding'

const ROLES_DEPOT = ['Intervenant', 'Beneficiaire']

/**
 * Aiguille la route "/" selon le rôle : un compte dépôt (intervenant, bénéficiaire)
 * n'a pas de tableau de bord d'archive, seulement son espace de dépôt. C'est
 * aussi le point de passage unique de tout le monde vers son tableau de bord,
 * donc l'endroit naturel pour proposer le tour de bienvenue à la toute
 * première connexion, quel que soit le profil.
 */
function RouteAccueil() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const estDepot = ROLES_DEPOT.includes(user?.role)
  const [afficherBienvenue, setAfficherBienvenue] = useState(() => !onboardingDejaVu(user?.id))

  function fermerBienvenue() {
    marquerOnboardingVu(user?.id)
    setAfficherBienvenue(false)
  }

  return (
    <>
      {estDepot ? <EspaceIntervenant /> : <Home />}
      {afficherBienvenue && (
        <OnboardingTour profil={estDepot ? 'depot' : 'personnel'} onTermine={fermerBienvenue} />
      )}
    </>
  )
}

export default RouteAccueil
