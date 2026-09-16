import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getEditionWordConfig, getEditionVersionConfig, enregistrerCopieWord } from '../api/routes/document'
import Loading from '../components/Loading'
import Breadcrumbs from '../components/Breadcrumbs'
import { LuX, LuAlertTriangle } from 'react-icons/lu'

/**
 * Édition d'un document Word directement dans le navigateur — via un serveur
 * OnlyOffice séparé (voir DocumentController::ouvrirEditionWord()), pas une
 * bibliothèque JS : c'est ce serveur qui fait tourner le vrai moteur
 * d'édition, cette page ne fait qu'embarquer son éditeur dans un cadre.
 *
 * Chargement du script OnlyOffice à l'adresse retournée par le backend
 * (`documentServerUrl`), jamais codée en dur ici — elle dépend de l'endroit
 * où ce serveur est installé, potentiellement différent en développement.
 */
function EditionWord() {
  const { t } = useTranslation()
  const { id, versionId } = useParams()
  const navigate = useNavigate()
  const conteneurRef = useRef(null)
  const editeurRef = useRef(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    let annule = false

    async function ouvrir() {
      setChargement(true)
      setErreur(null)
      const res = await (versionId ? getEditionVersionConfig(id, versionId) : getEditionWordConfig(id)).catch(() => null)
      if (annule) return

      if (!res || res.status !== 200) {
        const data = await res?.json().catch(() => ({})) ?? {}
        setErreur(data.error || t('editionWord.erreurOuverture'))
        setChargement(false)
        return
      }

      const { documentServerUrl, config } = await res.json()

      // Le script est chargé une seule fois par session — si l'utilisateur
      // ouvre un deuxième document Word sans recharger la page, on réutilise
      // le même <script> déjà en place.
      const idScript = 'onlyoffice-api-script'
      if (!document.getElementById(idScript)) {
        const script = document.createElement('script')
        script.id = idScript
        script.src = `${documentServerUrl}/web-apps/apps/api/documents/api.js`
        script.onload = () => !annule && instancierEditeur(config)
        script.onerror = () => !annule && setErreur(t('editionWord.erreurChargementEditeur'))
        document.body.appendChild(script)
      } else {
        instancierEditeur(config)
      }
    }

    function instancierEditeur(config) {
      if (!window.DocsAPI) {
        setErreur(t('editionWord.erreurChargementEditeur'))
        return
      }
      editeurRef.current = new window.DocsAPI.DocEditor(conteneurRef.current.id, {
        ...config,
        events: {
          onAppReady: () => !annule && setChargement(false),
          onRequestSaveAs: async (event) => {
            const lienCopie = event?.data?.url || event?.url
            const titreCopie = event?.data?.title || event?.title
            if (!lienCopie) return
            const res = await enregistrerCopieWord(id, { url: lienCopie, titre: titreCopie }).catch(() => null)
            if (res?.status === 201) {
              toast.success(t('editionWord.copieEnregistree'))
            } else {
              toast.error(t('commun.erreurGenerique'))
            }
          },
        },
      })
    }

    ouvrir()

    return () => {
      annule = true
      editeurRef.current?.destroyEditor?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, versionId])

  return (
    <div className='flex flex-col w-full h-full gap-3 py-4'>
      <div className='flex items-center justify-between gap-2 shrink-0'>
        <Breadcrumbs where={t('editionWord.titre')} />
        <button
          onClick={() => navigate(-1)}
          aria-label={t('openFolder.fermer')}
          className='rounded-lg border border-border p-2 hover:bg-muted transition-colors shrink-0'
        >
          <LuX size={16} />
        </button>
      </div>

      {erreur ? (
        <div className='flex-grow flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive p-8 text-center'>
          <LuAlertTriangle size={28} />
          <p className='text-sm font-medium max-w-md'>{erreur}</p>
          <button
            onClick={() => navigate(-1)}
            className='inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3.5 py-2 text-sm font-medium hover:bg-destructive/10 transition-colors'
          >
            {t('editionWord.retourAuDocument')}
          </button>
        </div>
      ) : (
        <div className='relative flex-grow rounded-2xl border border-border bg-card overflow-hidden'>
          {chargement && <Loading />}
          <div id='onlyoffice-editor-container' ref={conteneurRef} className='w-full h-full' />
        </div>
      )}
    </div>
  )
}

export default EditionWord
