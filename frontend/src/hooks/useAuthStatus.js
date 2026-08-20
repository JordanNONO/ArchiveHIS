import { useEffect, useState, useRef } from 'react'
import { AUTH_ME_API } from '../api'
/* import { AUTH_STATUS_API } from '../lib/api' */

// Le jeton JWT a une durée de vie volontairement courte côté serveur (voir
// JWT_TTL) — sans renouvellement périodique, une session ouverte plus
// longtemps que cette durée déconnecterait l'utilisateur en pleine journée de
// travail. /auth/me renvoie déjà un jeton frais à chaque appel (voir
// AuthController::me(), JWTAuth::refresh()) ; il suffit de le rappeler
// régulièrement tant que l'app reste ouverte plutôt qu'une seule fois au chargement.
const INTERVALLE_RENOUVELLEMENT_MS = 30 * 60 * 1000

export const useAuthStatus = () => {
  const [loggedIn, setLoggedIn] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const isMounted = useRef(true)
  const token = sessionStorage.getItem('token')
  useEffect(() => {
    function verifierEtRenouveler() {
      try {
        const { url, ...rest } = AUTH_ME_API

        fetch(url, { ...rest, credentials: "include" }).then(async (res) => {
          if (res.status === 200) {

            const data = await res.json()
            const { token, user, role, profile, personnel, permissions } = data
            setLoggedIn(true)
            sessionStorage.setItem('token', token)
            sessionStorage.setItem('user', JSON.stringify({ ...user, role, profile, personnel, permissions }))
            // Navbar/Sidebar se montent avant la fin de cet appel (ils ne dépendent
            // que de la route, pas de l'état d'auth) : sans ce signal, ils gardent
            // un utilisateur vide (donc pas de photo/nom) tant qu'aucune navigation
            // ne se produit.
            window.dispatchEvent(new Event('user-updated'))
            setCheckingStatus(false)
          }
          else {
            setCheckingStatus(false)
          }
        }).catch(function (err) {
          setCheckingStatus(false)
          console.log(err)
        })
      } catch (error) {
        setCheckingStatus(false)
        console.log(error)
      }
    }

    if (isMounted) {
      verifierEtRenouveler()
    }
    const intervalle = setInterval(verifierEtRenouveler, INTERVALLE_RENOUVELLEMENT_MS)
    return () => {
      isMounted.current = false
      clearInterval(intervalle)
    }
  }, [isMounted, token])
  return { loggedIn, checkingStatus }
}

// Protected routes in v6
// https://stackoverflow.com/questions/65505665/protected-route-with-firebase

// Fix memory leak warning
// https://stackoverflow.com/questions/59780268/cleanup-memory-leaks-on-an-unmounted-component-in-react-hooks