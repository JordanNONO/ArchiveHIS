import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { LuLoader2 } from 'react-icons/lu'
import { useConfirm } from '../../contexts/ConfirmDialogContext'
import { blobVersCanvas, chargerOpenCv, extraireTexte, pagesVersPdf, preparerSource, rendrePage } from '../../utils/scannerEngine'
import CameraDocument from './CameraDocument'
import AjustementBords from './AjustementBords'
import RevuePages from './RevuePages'

// Laisse le navigateur afficher l'indicateur d'attente avant un traitement
// lourd et synchrone (détection, filtres) — sinon l'écran restait figé.
function laisserPeindre() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
}

function horodatageLisible(date) {
  const deux = (n) => String(n).padStart(2, '0')
  return `${deux(date.getDate())}-${deux(date.getMonth() + 1)}-${date.getFullYear()} ${deux(date.getHours())}h${deux(date.getMinutes())}`
}

/**
 * Scanner de documents plein écran (espace intervenant/bénéficiaire, voir
 * EspaceDossier.jsx), façon Notes iPhone / Adobe Scan :
 *
 *   caméra ──photo──▶ ajustement des bords ──garder──▶ caméra (page suivante)
 *      │                                                    │
 *      └──────────────── voir les pages / importer ─────────┴──▶ vérification
 *                                                                  │ valider
 *                                                                  ▼
 *                                               OCR + un seul PDF → onTermine
 *
 * Toutes les pages finissent dans UN seul PDF (un document à classer, pas une
 * série d'images). onTermine reçoit ([fichierPdf], [texteReconnu]).
 */
function ScannerDocument({ onTermine, onClose }) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const [moteur, setMoteur] = useState('chargement') // chargement | pret | indisponible
  const [ecran, setEcran] = useState('camera') // camera | ajustement | revue | finalisation
  const [pages, setPages] = useState([])
  const [indexRevue, setIndexRevue] = useState(0)
  const [ajustement, setAjustement] = useState(null) // photo en cours d'ajustement ({ ..., pageId } si page existante)
  const [occupe, setOccupe] = useState(null) // message du traitement en cours
  const pagesRef = useRef(pages)
  pagesRef.current = pages
  const prochainIdRef = useRef(1)
  // Version du rendu demandé par page : un rendu plus ancien qui arrive après
  // un plus récent (filtres changés vite) est ignoré.
  const versionsRef = useRef({})

  useEffect(() => {
    chargerOpenCv()
      .then(() => setMoteur('pret'))
      .catch(() => {
        setMoteur('indisponible')
        toast.warning(t('scanner.moteurIndisponible'))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Libère les images en mémoire à la fermeture du scanner.
  useEffect(() => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  useEffect(() => () => ajustement && URL.revokeObjectURL(ajustement.url), [ajustement])

  function signalerErreur(error, messageParDefaut) {
    console.log(error)
    toast.error(error?.message === 'memoire-insuffisante' ? t('scanner.memoire')
      : error?.message === 'image-illisible' ? t('scanner.photoIllisible') : messageParDefaut)
  }

  async function nouvellePage(source, coins) {
    const rendu = await rendrePage({ source: source.source, coins, rotation: 0, filtre: 'auto' })
    const id = prochainIdRef.current++
    return {
      id,
      source: source.source,
      largeur: source.largeur,
      hauteur: source.hauteur,
      coinsDetectes: source.coinsDetectes,
      coins,
      rotation: 0,
      filtre: 'auto',
      ...rendu,
      url: URL.createObjectURL(rendu.rendu),
      enRendu: false,
    }
  }

  // --- Caméra ---------------------------------------------------------------

  async function onPhoto(canvas) {
    setOccupe(t('scanner.traitement'))
    await laisserPeindre()
    try {
      const source = await preparerSource(canvas)
      setAjustement({ ...source, url: URL.createObjectURL(source.source), pageId: null })
      setEcran('ajustement')
    } catch (error) {
      signalerErreur(error, t('scanner.captureEchouee'))
    } finally {
      setOccupe(null)
    }
  }

  async function onImport(fichiers) {
    // Une seule photo : même parcours qu'une prise de vue (ajustement).
    if (fichiers.length === 1) {
      setOccupe(t('scanner.traitement'))
      try {
        const canvas = await blobVersCanvas(fichiers[0])
        setOccupe(null)
        await onPhoto(canvas)
      } catch (error) {
        setOccupe(null)
        signalerErreur(error, t('scanner.photoIllisible'))
      }
      return
    }

    // Plusieurs photos : ajoutées directement (bords détectés), à vérifier
    // ensuite d'un coup dans l'écran de vérification.
    const premierIndex = pagesRef.current.length
    let ajoutees = 0
    try {
      for (let i = 0; i < fichiers.length; i++) {
        setOccupe(`${t('scanner.traitement')} (${i + 1}/${fichiers.length})`)
        await laisserPeindre()
        const source = await preparerSource(await blobVersCanvas(fichiers[i]))
        const page = await nouvellePage(source, source.coins)
        setPages((precedentes) => [...precedentes, page])
        ajoutees++
      }
    } catch (error) {
      signalerErreur(error, t('scanner.photoIllisible'))
    } finally {
      setOccupe(null)
    }
    if (ajoutees > 0) {
      setIndexRevue(premierIndex)
      setEcran('revue')
    }
  }

  // --- Ajustement des bords ------------------------------------------------

  async function onValiderAjustement(coins) {
    const { pageId } = ajustement
    if (pageId) {
      setAjustement(null)
      setEcran('revue')
      mettreAJourPage(pageId, { coins })
      return
    }

    setOccupe(t('scanner.traitement'))
    await laisserPeindre()
    try {
      const page = await nouvellePage(ajustement, coins)
      setPages((precedentes) => [...precedentes, page])
      setAjustement(null)
      setEcran('camera')
    } catch (error) {
      signalerErreur(error, t('scanner.captureEchouee'))
    } finally {
      setOccupe(null)
    }
  }

  function onAnnulerAjustement() {
    const retour = ajustement?.pageId ? 'revue' : 'camera'
    setAjustement(null)
    setEcran(retour)
  }

  // --- Vérification ---------------------------------------------------------

  async function mettreAJourPage(id, changements) {
    const page = pagesRef.current.find((p) => p.id === id)
    if (!page) return
    const version = (versionsRef.current[id] || 0) + 1
    versionsRef.current[id] = version
    const reglages = { ...page, ...changements }
    setPages((precedentes) => precedentes.map((p) => (p.id === id ? { ...p, ...changements, enRendu: true } : p)))

    try {
      await laisserPeindre()
      const rendu = await rendrePage(reglages)
      if (versionsRef.current[id] !== version) return
      const url = URL.createObjectURL(rendu.rendu)
      setPages((precedentes) => precedentes.map((p) => {
        if (p.id !== id) return p
        URL.revokeObjectURL(p.url)
        return { ...p, ...rendu, url, enRendu: false }
      }))
    } catch (error) {
      signalerErreur(error, t('scanner.captureEchouee'))
      setPages((precedentes) => precedentes.map((p) => (p.id === id ? { ...p, enRendu: false } : p)))
    }
  }

  function onRogner(id) {
    const page = pages.find((p) => p.id === id)
    if (!page) return
    setAjustement({
      source: page.source,
      largeur: page.largeur,
      hauteur: page.hauteur,
      coins: page.coins,
      coinsDetectes: page.coinsDetectes,
      url: URL.createObjectURL(page.source),
      pageId: id,
    })
    setEcran('ajustement')
  }

  function onPivoter(id) {
    const page = pages.find((p) => p.id === id)
    if (page) mettreAJourPage(id, { rotation: (page.rotation + 90) % 360 })
  }

  async function onSupprimer(id) {
    if (!await confirm({ message: t('scanner.revue.confirmerSuppression'), danger: true, confirmLabel: t('scanner.revue.supprimer') })) return
    const restantes = pages.filter((p) => p.id !== id)
    const supprimee = pages.find((p) => p.id === id)
    if (supprimee) URL.revokeObjectURL(supprimee.url)
    setPages(restantes)
    setIndexRevue((i) => Math.max(0, Math.min(i, restantes.length - 1)))
    if (restantes.length === 0) setEcran('camera')
  }

  function onDeplacer(id, sens) {
    const index = pages.findIndex((p) => p.id === id)
    const cible = index + sens
    if (index < 0 || cible < 0 || cible >= pages.length) return
    const reordonnees = [...pages]
    ;[reordonnees[index], reordonnees[cible]] = [reordonnees[cible], reordonnees[index]]
    setPages(reordonnees)
    setIndexRevue(cible)
  }

  async function onValider() {
    if (pages.length === 0) return
    setEcran('finalisation')
    try {
      // OCR page par page (jamais bloquant, voir extraireTexte) : sert à
      // retrouver le document par son contenu plus tard.
      const textes = []
      for (let i = 0; i < pages.length; i++) {
        setOccupe(t('scanner.final.lecture', { numero: i + 1, total: pages.length }))
        textes.push(await extraireTexte(pages[i].rendu))
      }
      setOccupe(t('scanner.final.pdf'))
      await laisserPeindre()
      const nom = `${t('scanner.nomFichier', { date: horodatageLisible(new Date()) })}.pdf`
      const fichier = await pagesVersPdf(pages, nom)
      onTermine([fichier], [textes.filter(Boolean).join('\n\n')])
    } catch (error) {
      signalerErreur(error, t('scanner.final.echec'))
      setEcran('revue')
    } finally {
      setOccupe(null)
    }
  }

  async function fermer() {
    if (pages.length > 0 || ajustement) {
      const abandonner = await confirm({
        title: t('scanner.confirmerAbandonTitre'),
        message: t('scanner.confirmerAbandon'),
        danger: true,
        confirmLabel: t('scanner.abandonner'),
      })
      if (!abandonner) return
    }
    onClose()
  }

  const derniere = pages[pages.length - 1]

  return (
    <div className='fixed inset-0 z-[95] h-[100dvh] bg-black overflow-hidden select-none' role='dialog' aria-modal='true' aria-label={t('scanner.titre')}>
      {(ecran === 'camera' || ecran === 'ajustement') && (
        <CameraDocument
          actif={ecran === 'camera' && !occupe}
          moteurPret={moteur === 'pret'}
          moteurEnChargement={moteur === 'chargement'}
          nbPages={pages.length}
          derniereMiniature={derniere?.miniature}
          onPhoto={onPhoto}
          onImport={onImport}
          onVoirPages={() => {
            setIndexRevue(pages.length - 1)
            setEcran('revue')
          }}
          onFermer={fermer}
        />
      )}

      {ecran === 'ajustement' && ajustement && (
        <AjustementBords
          key={ajustement.url}
          photo={ajustement}
          nouvellePage={!ajustement.pageId}
          onValider={onValiderAjustement}
          onAnnuler={onAnnulerAjustement}
        />
      )}

      {(ecran === 'revue' || ecran === 'finalisation') && (
        <RevuePages
          pages={pages}
          index={Math.min(indexRevue, Math.max(0, pages.length - 1))}
          onIndex={setIndexRevue}
          onRogner={onRogner}
          onPivoter={onPivoter}
          onFiltre={(id, filtre) => mettreAJourPage(id, { filtre })}
          onSupprimer={onSupprimer}
          onDeplacer={onDeplacer}
          onAjouter={() => setEcran('camera')}
          onValider={onValider}
          onFermer={fermer}
        />
      )}

      {occupe && (
        <div className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/75 text-white text-sm text-center px-8'>
          <LuLoader2 size={30} className='animate-spin' />
          {occupe}
        </div>
      )}
    </div>
  )
}

export default ScannerDocument
