import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStatus } from '../hooks/useAuthStatus'
import Loading from './Loading'

// Retient la page demandée (ex. le document d'une notification cliquée alors
// qu'aucun onglet HIS n'était ouvert) pour y revenir une fois reconnecté —
// voir Login.jsx. Sans ça, on atterrissait sur le tableau de bord et le lien
// de la notification était perdu.
const PrivateRoute = () => {
  const { loggedIn, checkingStatus } = useAuthStatus()
  const location = useLocation()
  if (checkingStatus) {
    return <Loading />
  }
  return loggedIn
    ? <Outlet />
    : <Navigate to='/login' replace state={{ depuis: location.pathname + location.search }} />
}

export default PrivateRoute
