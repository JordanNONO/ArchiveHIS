import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { LuUpload, LuFileCheck2, LuLoader2, LuFolderClock, LuArrowLeft, LuRotateCcw, LuPencilLine, LuTrash2, LuX, LuCamera } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'
import { createDocument, getDocument, corrigerEtRenvoyerDocument, deleteDocument, updateDocument } from '../api/routes/document'
import { getCategorie } from '../api/routes/categorie'
import { getTypeDocuments } from '../api/routes/typeDocument'
import { getDisplayName, getInitials, bordureDocumentClass } from '../utils/common'
import { getFileTypeVisual } from '../utils/fileTypeIcons'
import { genererPdfMessage } from '../utils/messagePdf'
import StatutBadge from '../components/StatutBadge'
import ScannerCapture from '../components/ScannerCapture'
import CompteARebours from '../components/CompteARebours'
import CongeForm from '../components/CongeForm'
import PaieForm from '../components/PaieForm'
import ReclamationForm from '../components/ReclamationForm'
import PrestationForm from '../components/PrestationForm'
import PrestationActionForm from '../components/PrestationActionForm'
import SignalementForm from '../components/SignalementForm'
import FiligraneHIS from '../components/FiligraneHIS'
import SwipeToDelete from '../components/SwipeToDelete'
import SwipeActions from '../components/SwipeActions'
import VoiceRecorder from '../components/VoiceRecorder'
import { useConfirm } from '../contexts/ConfirmDialogContext'
import { trouverTypeDemande, resoudreDestinationDemande, SOUS_TYPES_SIGNALEMENT } from '../constants/typesDemande'

// Aucune vidéo : filmer chez soi exposerait l'auxiliaire de vie qui intervient
// au domicile du bénéficiaire (visage, logement...).
const ACCEPT_FICHIER = '.pdf,.doc,.docx,.odt,image/jpeg,image/png'

// L'extension réelle dépend de ce que le navigateur sait enregistrer (webm,
// m4a sur Safari/iOS...) — voir VoiceRecorder.jsx — jamais figée à ".webm".
function estMessageVocal(f) {
  return f.name.startsWith('Message vocal.')
}

/**
 * Page d'un "dossier" de dépôt (Réclamation, Fiche de paie...) pour un compte
 * intervenant/bénéficiaire : dépôt scopé à ce type précis (plus besoin de le
 * choisir, c'est le menu de la sidebar qui l'a déjà déterminé) + liste de ce qui
 * a déjà été envoyé dans ce dossier — voir EspaceIntervenant.jsx pour la vue
 * d'ensemble tous dossiers confondus.
 */
function EspaceDossier() {
  const { t } = useTranslation()
  const { type } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const demande = trouverTypeDemande(type)
  const demandeLabel = demande ? t(demande.label) : ''
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const currentUserName = getDisplayName(user)

  const [categories, setCategories] = useState([])
  const [typesParCategorie, setTypesParCategorie] = useState({})
  const [form, setForm] = useState({ titre: '', resume: '' })
  const [files, setFiles] = useState([])
  const [textesFichiers, setTextesFichiers] = useState([])
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [progression, setProgression] = useState(null)
  const [mesDocuments, setMesDocuments] = useState([])
  const [scannerOuvert, setScannerOuvert] = useState(false)
  const [correctionEnCours, setCorrectionEnCours] = useState(null)
  const [vocalCle, setVocalCle] = useState(0)
  const [documentEnEdition, setDocumentEnEdition] = useState(null)
  const [editForm, setEditForm] = useState({ titre: '', resume: '' })
  const [modificationEnCours, setModificationEnCours] = useState(false)

  useEffect(() => {
    if (!demande) return
    getCategorie().then(async (res) => res.ok && setCategories(await res.json())).catch(() => {})
  }, [demande])

  useEffect(() => {
    if (!demande || categories.length === 0) return
    const categorie = categories.find((c) => c.code === demande.categorieCode)
    if (!categorie) return
    getTypeDocuments(categorie.id).then(async (res) => {
      if (res.ok) {
        const data = await res.json()
        setTypesParCategorie((prev) => ({ ...prev, [demande.categorieCode]: data }))
      }
    }).catch(() => {})
  }, [demande, categories])

  // "Signalement" chapeaute 3 vrais types différents (voir SignalementForm.jsx
  // + SOUS_TYPES_SIGNALEMENT) — pas une seule destination mais une liste,
  // pour que "Déjà envoyés dans ce dossier" les agrège tous.
  const estSignalement = demande?.id === 'signalement'
  const destination = estSignalement ? null : resoudreDestinationDemande(demande, categories, typesParCategorie)
  const destinationsSignalement = estSignalement
    ? SOUS_TYPES_SIGNALEMENT.map((st) => resoudreDestinationDemande(st, categories, typesParCategorie)).filter(Boolean)
    : []

  useEffect(() => {
    if (estSignalement ? destinationsSignalement.length === 0 : !destination) return
    fetchMesDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.categorie_id, destination?.type_document_id, estSignalement, destinationsSignalement.length])

  // Un dépôt externe est rangé dans un vrai sous-dossier à son nom (voir
  // DocumentController::store()), pas directement dans le type demandé — on
  // le reconnaît donc aussi via le parent immédiat de ce sous-dossier, sinon
  // "Déjà envoyés dans ce dossier" restait vide malgré de vrais dépôts.
  function correspondAuType(d, dest) {
    return d.categorie_id === dest.categorie_id && (d.type_document_id === dest.type_document_id || d.type_document?.parent_id === dest.type_document_id)
  }

  function fetchMesDocuments() {
    getDocument().then(async (res) => {
      if (res.status === 200) {
        const data = await res.json()
        setMesDocuments(
          data
            .filter((d) => estSignalement
              ? destinationsSignalement.some((dest) => correspondAuType(d, dest))
              : correspondAuType(d, destination))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        )
      }
    }).catch(() => {})
  }

  async function onSupprimerDocument(d) {
    if (!await confirm({ message: t('espaceDossier.confirmerSuppression'), danger: true, confirmLabel: t('espaceDossier.envoyerCorbeille') })) return
    try {
      const res = await deleteDocument(d.id)
      if (res.status === 200) {
        toast.success(t('espaceDossier.pieceSupprimee'))
        fetchMesDocuments()
      } else {
        toast.error(t('espaceDossier.suppressionEchouee'))
      }
    } catch (error) {
      console.log(error)
      toast.error(t('commun.erreurGenerique'))
    }
  }

  // Édition d'une prestation déjà envoyée (façon messagerie : glisser →
  // Modifier ouvre ce petit formulaire, pas un aller-retour vers le dossier
  // d'archives complet) — voir SwipeActions.jsx.
  function ouvrirModification(d) {
    setDocumentEnEdition(d)
    setEditForm({ titre: d.titre_document, resume: d.resume })
  }

  async function onEnregistrerModification(e) {
    e.preventDefault()
    if (!documentEnEdition) return
    try {
      setModificationEnCours(true)
      const res = await updateDocument(documentEnEdition.id, {
        category_id: documentEnEdition.categorie_id,
        type_document_id: documentEnEdition.type_document_id,
        titre: editForm.titre,
        auteur: documentEnEdition.auteur,
        resume: editForm.resume,
        reference: documentEnEdition.code_reference,
        personnel_concerne_id: documentEnEdition.personnel_concerne_id,
        nom_personne_concernee: documentEnEdition.nom_personne_concernee,
      })
      if (res.status === 200) {
        toast.success(t('espaceDossier.prestationModifiee'))
        setDocumentEnEdition(null)
        fetchMesDocuments()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || t('espaceDossier.modificationEchouee'))
      }
    } catch (error) {
      console.log(error)
      toast.error(t('commun.erreurGenerique'))
    } finally {
      setModificationEnCours(false)
    }
  }

  async function onCorrigerDocument(documentId, e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    try {
      setCorrectionEnCours(documentId)
      const res = await corrigerEtRenvoyerDocument(documentId, fichier)
      if (res.status === 200) {
        toast.success(t('espaceDossier.documentCorrige'))
        fetchMesDocuments()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || t('espaceDossier.correctionEchouee'))
      }
    } catch (error) {
      console.log(error)
      toast.error(t('commun.erreurGenerique'))
    } finally {
      setCorrectionEnCours(null)
    }
  }

  function onFilesSelected(selectedFiles, textes) {
    const nouveaux = Array.from(selectedFiles || [])
    if (nouveaux.length === 0) return
    setFiles((prev) => [...prev, ...nouveaux])
    // Texte OCR aligné 1-pour-1 avec `files` (voir ScannerCapture.jsx), ou
    // transcription vocale le cas échéant (voir onVocalChange) — une pièce
    // jointe classique (choisie/photographiée sans passer par ces deux
    // chemins) n'a pas de texte associé.
    setTextesFichiers((prev) => [...prev, ...(textes || nouveaux.map(() => ''))])
    setForm((f) => ({ ...f, titre: f.titre || nouveaux[0].name.split('.')[0] }))
  }

  function retirerFichier(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setTextesFichiers((prev) => prev.filter((_, i) => i !== index))
  }

  function onScannerTermine(fichiersScannes, textes) {
    setScannerOuvert(false)
    onFilesSelected(fichiersScannes, textes)
  }

  // Le vocal est traité comme une pièce parmi d'autres (voir onFilesSelected) —
  // sauf qu'ici on remplace/retire l'éventuel vocal déjà présent au lieu d'en
  // accumuler plusieurs, puisqu'un seul message vocal a du sens à la fois.
  function onVocalChange(fichierAudio, transcript) {
    const index = files.findIndex(estMessageVocal)
    if (index !== -1) {
      const nouveauxFiles = [...files]
      const nouveauxTextes = [...textesFichiers]
      if (fichierAudio) {
        nouveauxFiles[index] = fichierAudio
        nouveauxTextes[index] = transcript
      } else {
        nouveauxFiles.splice(index, 1)
        nouveauxTextes.splice(index, 1)
      }
      setFiles(nouveauxFiles)
      setTextesFichiers(nouveauxTextes)
    } else if (fichierAudio) {
      setFiles((prev) => [...prev, fichierAudio])
      setTextesFichiers((prev) => [...prev, transcript])
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    const aUnePiece = files.length > 0
    const aUnVocal = files.some(estMessageVocal)
    const aUnMessage = form.resume.trim().length > 0
    if (!aUnePiece && !demande?.fichierFacultatif) {
      toast.warning(t('espaceDossier.choisissezPiece'))
      return
    }
    // Un vocal (transcrit ou non) compte comme "message" au même titre qu'un
    // message tapé — voir VoiceRecorder.jsx.
    if (demande?.messageObligatoire && !aUnMessage && !aUnVocal) {
      toast.warning(t('espaceDossier.precisezMessage'))
      return
    }
    if (!aUnePiece && demande?.fichierFacultatif && !aUnMessage) {
      toast.warning(t('espaceDossier.ajoutezMessage'))
      return
    }
    if (!destination) {
      toast.error(t('espaceDossier.dossierIndisponible'))
      return
    }

    // Convention de nommage : code du type de demande + initiales du déposant
    // (ex: "REC-JN" pour une Réclamation de Jordan Nono) — sert à la fois de
    // référence et à préfixer le titre, pour que RH identifie l'origine d'un
    // dépôt d'un coup d'œil dans la liste des documents.
    const codePrefixe = `${demande.code}-${getInitials(currentUserName)}`
    const reference = `${codePrefixe}-${Date.now()}`
    const titreBase = form.titre || `${codePrefixe} — ${demandeLabel}`
    const resumeComplet = form.resume.trim()

    // Ni pièce jointe ni vocal : le message texte devient lui-même le
    // "fichier" déposé (un PDF propre plutôt qu'un .txt brut) — le modèle de
    // document exige toujours un fichier.
    let filesAEnvoyer = files
    let textesAEnvoyer = textesFichiers
    if (!aUnePiece) {
      const blob = await genererPdfMessage({ titre: titreBase, message: resumeComplet, auteur: currentUserName })
      filesAEnvoyer = [new File([blob], `${titreBase}.pdf`, { type: 'application/pdf' })]
      textesAEnvoyer = ['']
    }
    const plusieursPages = filesAEnvoyer.length > 1

    try {
      setEnvoiEnCours(true)
      for (let i = 0; i < filesAEnvoyer.length; i++) {
        setProgression({ actuel: i + 1, total: filesAEnvoyer.length })
        const fichier = filesAEnvoyer[i]
        const res = await createDocument({
          category_id: destination.categorie_id,
          type_document_id: destination.type_document_id,
          titre: plusieursPages ? `${titreBase} (page ${i + 1}/${filesAEnvoyer.length})` : titreBase,
          auteur: currentUserName,
          // La personne concernée par ce dépôt est le déposant lui-même (il
          // dépose sa propre réclamation/fiche de paie/etc.) — ça permet à
          // RH de regrouper tous ses dépôts dans un même "dossier" via le
          // regroupement par salarié déjà existant côté archives (OpenFolder.jsx).
          nom_personne_concernee: currentUserName,
          resume: resumeComplet || demandeLabel,
          // Texte reconnu par OCR au moment du scan (voir ScannerCapture.jsx),
          // ou transcrit depuis un message vocal (voir VoiceRecorder.jsx) —
          // sert uniquement à retrouver ce document par son contenu plus
          // tard (recherche RH), jamais affiché comme un champ à part.
          texte_extrait: textesAEnvoyer[i] || undefined,
          reference: plusieursPages ? `${reference}-${i + 1}` : reference,
          file_create_date: fichier.lastModified || Date.now(),
        }, fichier)

        if (res.status !== 201) {
          toast.error(t('espaceDossier.envoiPageEchoue', { numero: i + 1 }))
          return
        }
      }

      toast.success(plusieursPages ? t('espaceDossier.piecesDeposees') : t('espaceDossier.pieceDeposee'))
      setFiles([])
      setTextesFichiers([])
      setForm({ titre: '', resume: '' })
      setVocalCle((k) => k + 1)
      fetchMesDocuments()
    } catch (error) {
      console.log(error)
      toast.error(t('commun.erreurGenerique'))
    } finally {
      setEnvoiEnCours(false)
      setProgression(null)
    }
  }

  if (!demande) {
    return (
      <div className='flex flex-col items-center justify-center py-20 gap-3 text-center w-full'>
        <p className='text-sm text-muted-foreground'>{t('espaceDossier.dossierInexistant')}</p>
        <button onClick={() => navigate('/')} className='text-sm text-primary hover:underline'>{t('espaceDossier.retourTableauDeBord')}</button>
      </div>
    )
  }

  const Icon = demande.icon
  const libelleBouton = files.length > 1 ? t('espaceDossier.deposerPages') : t('espaceDossier.deposerPiece')
  const IconBouton = LuUpload

  return (
    <div className='flex flex-col w-full gap-5 py-4 max-w-2xl mx-auto'>
      <div>
        <Link to='/' className='inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3'>
          <LuArrowLeft size={13} /> {t('espaceDossier.retourTableauDeBord')}
        </Link>
        <div className='flex items-center gap-3'>
          <span className='w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0'>
            <Icon size={21} />
          </span>
          <h1 className='text-xl font-bold text-foreground'>{demandeLabel}</h1>
        </div>
      </div>

      {demande.id === 'conges' ? (
        <CongeForm user={user} currentUserName={currentUserName} demande={demande} destination={destination} onEnvoye={fetchMesDocuments} />
      ) : demande.id === 'paie' ? (
        <PaieForm currentUserName={currentUserName} demande={demande} destination={destination} onEnvoye={fetchMesDocuments} />
      ) : demande.id === 'reclamation' ? (
        <ReclamationForm user={user} currentUserName={currentUserName} demande={demande} destination={destination} onEnvoye={fetchMesDocuments} />
      ) : demande.id === 'prestation' ? (
        <PrestationForm user={user} currentUserName={currentUserName} demande={demande} destination={destination} onEnvoye={fetchMesDocuments} />
      ) : demande.id === 'prestation-annulation' ? (
        <PrestationActionForm demande={demande} currentUserName={currentUserName} destination={destination} onEnvoye={fetchMesDocuments} />
      ) : demande.id === 'prestation-qualite' ? (
        <PrestationActionForm demande={demande} currentUserName={currentUserName} destination={destination} onEnvoye={fetchMesDocuments} avecNotation />
      ) : demande.id === 'signalement' ? (
        <SignalementForm currentUserName={currentUserName} categories={categories} typesParCategorie={typesParCategorie} onEnvoye={fetchMesDocuments} />
      ) : (
      <form onSubmit={onSubmit} className='relative isolate overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm flex flex-col gap-5'>
        <FiligraneHIS />
        {demande.accepteFichier !== false && (
          <div>
            <div className='flex items-baseline justify-between mb-1.5'>
              <label className='text-sm font-medium'>{t('espaceDossier.pieceJointe')} {!demande.fichierFacultatif && <span className='text-red-500'>*</span>}</label>
              {demande.fichierFacultatif && (
                <span className='text-xs text-muted-foreground'>{t('espaceDossier.pieceOptionnelle')}</span>
              )}
            </div>

            {files.filter((f) => !estMessageVocal(f)).length > 0 && (
              <div className='flex flex-col gap-2 mb-2'>
                {files.map((f, i) => estMessageVocal(f) ? null : (
                  <div key={i} className='flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3'>
                    <span className='w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0'>
                      <LuFileCheck2 size={16} />
                    </span>
                    <div className='min-w-0 flex-1'>
                      <div className='text-sm font-medium truncate'>{files.length > 1 ? t('espaceDossier.pageN', { numero: i + 1 }) : ''}{f.name}</div>
                      <div className='text-xs text-muted-foreground'>{t('espaceDossier.tailleKo', { taille: (f.size / 1024).toFixed(0) })}</div>
                    </div>
                    <button type="button" onClick={() => retirerFichier(i)} className='text-xs text-destructive hover:underline shrink-0'>{t('espaceDossier.retirer')}</button>
                  </div>
                ))}
              </div>
            )}

            {/* Le scanner (redressement + OCR) reste proposé, utile pour un vrai
                document papier — voir ScannerCapture.jsx. */}
            <div className='grid grid-cols-2 gap-2'>
              <button
                type='button'
                onClick={() => setScannerOuvert(true)}
                className='flex flex-col items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-primary/5 hover:bg-primary/10 p-4 cursor-pointer transition-colors text-center'
              >
                <span className='w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center'>
                  <LuCamera size={20} />
                </span>
                <span className='text-sm font-semibold text-foreground'>{files.length > 0 ? t('espaceDossier.scannerPage') : t('espaceDossier.scannerDocument')}</span>
              </button>
              <label className='flex flex-col items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-primary/5 hover:bg-primary/10 p-4 cursor-pointer transition-colors text-center'>
                <span className='w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center'>
                  <LuUpload size={20} />
                </span>
                <span className='text-sm font-semibold text-foreground'>{files.length > 0 ? t('espaceDossier.ajouterAutreFichier') : t('espaceDossier.ajouterFichier')}</span>
                <input type="file" multiple accept={ACCEPT_FICHIER} className='hidden' onChange={(e) => onFilesSelected(e.target.files)} />
              </label>
            </div>

            {files.filter((f) => !estMessageVocal(f)).length > 1 && (
              <p className='text-xs text-muted-foreground mt-1.5'>{t('espaceDossier.pagesGroupees', { count: files.length })}</p>
            )}
          </div>
        )}


        {demande.accepteTitre !== false && (
          <div>
            <label className='block text-sm font-medium mb-1.5'>{t('espaceDossier.titre')}</label>
            <input
              type="text"
              value={form.titre}
              onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
              className='w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
              placeholder={t('espaceDossier.titreDocument')}
            />
          </div>
        )}

        <div>
          <label className='block text-sm font-medium mb-1.5'>
            {t('espaceDossier.message')} {demande.messageObligatoire ? <span className='text-red-500'>*</span> : `(${t('espaceDossier.optionnel')})`}
          </label>
          <VoiceRecorder
            key={vocalCle}
            valeurTexte={form.resume}
            onChangeTexte={(texte) => setForm((f) => ({ ...f, resume: texte }))}
            requis={demande.messageObligatoire}
            onChangeVocal={demande.accepteVocal ? onVocalChange : undefined}
          />
        </div>

        <button
          type="submit"
          disabled={envoiEnCours}
          className='inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground shadow-sm shadow-accent/40 hover:brightness-95 hover:shadow-md hover:shadow-accent/40 transition-all disabled:opacity-60 disabled:shadow-none'
        >
          {envoiEnCours ? <LuLoader2 className='animate-spin' size={15} /> : <IconBouton size={15} />}
          {envoiEnCours && progression
            ? t('espaceDossier.envoiProgression', { actuel: progression.actuel, total: progression.total })
            : libelleBouton}
        </button>
      </form>
      )}

      <div className='rounded-3xl border border-border bg-card p-5 shadow-sm'>
        <h2 className='text-sm font-semibold mb-3 flex items-center gap-1.5 text-foreground'>
          <LuFolderClock size={15} className='text-muted-foreground' /> {t('espaceDossier.dejaEnvoyes')}
        </h2>
        <ul className='flex flex-col gap-2'>
          {mesDocuments.map((d) => {
            const { icon: FileIcon, tint } = getFileTypeVisual(d.chemin_stockage_serveur)
            const extension = String(d.chemin_stockage_serveur || '').split('.').pop()
            const rejete = d.status_doc === 'INCOMPLET_REJETE'
            const carte = (
              <Link to={`/view/${d.id}/${extension}`} className={`flex items-center gap-3 text-sm border border-border rounded-lg px-3 py-2.5 hover:bg-muted/60 transition-colors ${bordureDocumentClass(d, true)}`}>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
                  <FileIcon size={14} />
                </span>
                <div className='min-w-0 flex-1'>
                  <div className='font-medium truncate'>{d.titre_document}</div>
                  <div className='text-xs text-muted-foreground'>{new Date(d.created_at).toLocaleDateString()}</div>
                </div>
                <StatutBadge statut={d.status_doc} externe className='!px-1.5 !py-0.5 !text-[10px] shrink-0' />
              </Link>
            )
            return (
              <li key={d.id} className='flex flex-col gap-1.5'>
                {demande.id === 'prestation' ? (
                  <SwipeActions
                    actions={[
                      { icone: LuPencilLine, libelle: t('espaceDossier.modifier'), classe: 'bg-primary text-white', onClick: () => ouvrirModification(d) },
                      { icone: LuTrash2, libelle: t('espaceDossier.supprimer'), classe: 'bg-destructive text-white', onClick: () => onSupprimerDocument(d) },
                    ]}
                  >
                    {carte}
                  </SwipeActions>
                ) : (
                  <SwipeToDelete onDelete={() => onSupprimerDocument(d)}>
                    {carte}
                  </SwipeToDelete>
                )}
                {rejete && (
                  <>
                    <CompteARebours document={d} className='-mt-0.5' />
                    <label className='flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-destructive/40 text-destructive text-xs font-medium py-2 cursor-pointer hover:bg-destructive/5 transition-colors'>
                    {correctionEnCours === d.id ? (
                      <LuLoader2 size={13} className='animate-spin' />
                    ) : (
                      <LuRotateCcw size={13} />
                    )}
                    {correctionEnCours === d.id ? t('espaceDossier.envoiEnCours') : t('espaceDossier.corrigerRenvoyer')}
                    <input
                      type="file"
                      className='hidden'
                      disabled={correctionEnCours === d.id}
                      onChange={(e) => onCorrigerDocument(d.id, e)}
                    />
                    </label>
                  </>
                )}
              </li>
            )
          })}
          {mesDocuments.length === 0 && <li className='text-sm text-muted-foreground'>{t('espaceDossier.rienEnvoye')}</li>}
        </ul>
      </div>

      {scannerOuvert && (
        <ScannerCapture onTermine={onScannerTermine} onClose={() => setScannerOuvert(false)} />
      )}

      {documentEnEdition && (
        <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
          <div className='absolute inset-0 bg-black/50' onClick={() => !modificationEnCours && setDocumentEnEdition(null)} />
          <form onSubmit={onEnregistrerModification} className='relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl flex flex-col gap-4'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <h3 className='text-base font-semibold text-foreground'>{t('espaceDossier.modifierPrestation')}</h3>
                <p className='text-sm text-muted-foreground mt-0.5'>{t('espaceDossier.ajustezDemande')}</p>
              </div>
              <button type='button' onClick={() => setDocumentEnEdition(null)} className='shrink-0 p-1 rounded-full text-muted-foreground hover:bg-muted'>
                <LuX size={16} />
              </button>
            </div>
            <div>
              <label className='block text-sm font-medium mb-1.5'>{t('espaceDossier.titre')} <span className='text-red-500'>*</span></label>
              <input
                type='text'
                value={editForm.titre}
                onChange={(e) => setEditForm((f) => ({ ...f, titre: e.target.value }))}
                required
                className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
              />
            </div>
            <div>
              <label className='block text-sm font-medium mb-1.5'>{t('espaceDossier.message')} <span className='text-red-500'>*</span></label>
              <VoiceRecorder
                valeurTexte={editForm.resume}
                onChangeTexte={(texte) => setEditForm((f) => ({ ...f, resume: texte }))}
                onChangeVocal={(fichierAudio, transcript) => setEditForm((f) => ({ ...f, resume: transcript }))}
                requis
              />
            </div>
            <div className='flex justify-end gap-2'>
              <button type='button' onClick={() => setDocumentEnEdition(null)} className='btn btn-sm btn-ghost' disabled={modificationEnCours}>
                {t('espaceDossier.annuler')}
              </button>
              <button type='submit' className='btn btn-sm bg-primary text-white border-0 hover:opacity-90' disabled={modificationEnCours}>
                {modificationEnCours ? <LuLoader2 size={14} className='animate-spin' /> : t('espaceDossier.enregistrer')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default EspaceDossier
