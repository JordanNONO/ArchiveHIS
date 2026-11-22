import { useEffect } from 'react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { envoyerEnAttente } from '../utils/fileEnvoiHorsLigne'

/**
 * Fait partir les dépôts gardés sans réseau (voir fileEnvoiHorsLigne.js) :
 * à l'ouverture de l'application, dès que la connexion revient, et toutes
 * les minutes tant qu'il en reste. Rien à l'écran : seulement un message
 * (et une notification du téléphone si elles sont autorisées) quand un
 * dépôt est bien parti.
 */
function SynchroEnvoisHorsLigne({ userId }) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!userId) return
    let actif = true

    async function synchroniser() {
      const partis = await envoyerEnAttente(userId)
      if (!actif || partis.length === 0) return
      partis.forEach((titre) => {
        const texte = t('horsLigne.depotParti', { titre })
        toast.success(texte)
        // Notification du téléphone si l'application est en arrière-plan.
        if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
          navigator.serviceWorker?.getRegistration().then((reg) => {
            reg?.showNotification(t('horsLigne.depotPartiTitre'), { body: texte, icon: '/logo192.png', tag: `depot-${titre}` })
          }).catch(() => {})
        }
      })
    }

    synchroniser()
    window.addEventListener('online', synchroniser)
    const minuterie = setInterval(synchroniser, 60000)
    return () => {
      actif = false
      window.removeEventListener('online', synchroniser)
      clearInterval(minuterie)
    }
  }, [userId, t])

  return null
}

export default SynchroEnvoisHorsLigne
