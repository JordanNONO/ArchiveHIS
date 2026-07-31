import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { LuCamera, LuUpload, LuFileCheck2, LuLoader2, LuFolderClock, LuArrowLeft, LuRotateCcw } from 'react-icons/lu'
import { createDocument, getDocument, corrigerEtRenvoyerDocument } from '../api/routes/document'
import { getCategorie } from '../api/routes/categorie'
import { getTypeDocuments } from '../api/routes/typeDocument'
import { getDisplayName, getInitials, bordureDocumentClass } from '../utils/common'
import { getFileTypeVisual } from '../utils/fileTypeIcons'
import StatutBadge from '../components/StatutBadge'
import ScannerCapture from '../components/ScannerCapture'
import CompteARebours from '../components/CompteARebours'
import { trouverTypeDemande, resoudreDestinationDemande } from '../constants/typesDemande'

/**
 * Page d'un "dossier" de dépôt (Réclamation, Fiche de paie...) pour un compte
 * intervenant/bénéficiaire : dépôt scopé à ce type précis (plus besoin de le
 * choisir, c'est le menu de la sidebar qui l'a déjà déterminé) + liste de ce qui
 * a déjà été envoyé dans ce dossier — voir EspaceIntervenant.jsx pour la vue
 * d'ensemble tous dossiers confondus.
 */
function EspaceDossier() {
  const { type } = useParams()
  const navigate = useNavigate()
  const demande = trouverTypeDemande(type)
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

  const destination = resoudreDestinationDemande(demande, categories, typesParCategorie)

  useEffect(() => {
    if (!destination) return
    fetchMesDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.categorie_id, destination?.type_document_id])

  function fetchMesDocuments() {
    getDocument().then(async (res) => {
      if (res.status === 200) {
        const data = await res.json()
        setMesDocuments(
          data
            .filter((d) => d.categorie_id === destination.categorie_id && d.type_document_id === destination.type_document_id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        )
      }
    }).catch(() => {})
  }

  async function onCorrigerDocument(documentId, e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    try {
      setCorrectionEnCours(documentId)
      const res = await corrigerEtRenvoyerDocument(documentId, fichier)
      if (res.status === 200) {
        toast.success('Document corrigé et renvoyé — il repart en validation')
        fetchMesDocuments()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error || 'La correction a échoué')
      }
    } catch (error) {
      console.log(error)
      toast.error('Une erreur est survenue')
    } finally {
      setCorrectionEnCours(null)
    }
  }

  function onFilesSelected(selectedFiles, textes) {
    const nouveaux = Array.from(selectedFiles || [])
    if (nouveaux.length === 0) return
    setFiles((prev) => [...prev, ...nouveaux])
    // Texte OCR aligné 1-pour-1 avec `files` (voir ScannerCapture.jsx) — une
    // pièce choisie manuellement (pas scannée) n'a pas de texte reconnu.
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

  async function onSubmit(e) {
    e.preventDefault()
    if (files.length === 0) {
      toast.warning('Choisissez au moins une pièce à déposer')
      return
    }
    if (demande?.messageObligatoire && !form.resume.trim()) {
      toast.warning('Précisez de quoi il s\'agit dans le message')
      return
    }
    if (!destination) {
      toast.error("Ce dossier n'est pas disponible pour le moment, réessayez dans un instant")
      return
    }

    // Convention de nommage : code du type de demande + initiales du déposant
    // (ex: "REC-JN" pour une Réclamation de Jordan Nono) — sert à la fois de
    // référence et à préfixer le titre, pour que RH identifie l'origine d'un
    // dépôt d'un coup d'œil dans la liste des documents.
    const codePrefixe = `${demande.code}-${getInitials(currentUserName)}`
    const reference = `${codePrefixe}-${Date.now()}`
    const titreBase = form.titre || `${codePrefixe} — ${demande.label}`
    const plusieursPages = files.length > 1

    try {
      setEnvoiEnCours(true)
      for (let i = 0; i < files.length; i++) {
        setProgression({ actuel: i + 1, total: files.length })
        const fichier = files[i]
        const res = await createDocument({
          category_id: destination.categorie_id,
          type_document_id: destination.type_document_id,
          titre: plusieursPages ? `${titreBase} (page ${i + 1}/${files.length})` : titreBase,
          auteur: currentUserName,
          // La personne concernée par ce dépôt est le déposant lui-même (il
          // dépose sa propre réclamation/fiche de paie/etc.) — ça permet à
          // RH de regrouper tous ses dépôts dans un même "dossier" via le
          // regroupement par salarié déjà existant côté archives (OpenFolder.jsx).
          nom_personne_concernee: currentUserName,
          resume: form.resume || demande.label,
          // Texte reconnu par OCR au moment du scan (voir ScannerCapture.jsx)
          // — sert uniquement à retrouver ce document par son contenu plus
          // tard (recherche RH), jamais affiché comme un champ à part.
          texte_extrait: textesFichiers[i] || undefined,
          reference: plusieursPages ? `${reference}-${i + 1}` : reference,
          file_create_date: fichier.lastModified,
        }, fichier)

        if (res.status !== 201) {
          toast.error(`L'envoi de la page ${i + 1} a échoué`)
          return
        }
      }

      toast.success(plusieursPages ? 'Pièces déposées avec succès' : 'Pièce déposée avec succès')
      setFiles([])
      setTextesFichiers([])
      setForm({ titre: '', resume: '' })
      fetchMesDocuments()
    } catch (error) {
      console.log(error)
      toast.error('Une erreur est survenue')
    } finally {
      setEnvoiEnCours(false)
      setProgression(null)
    }
  }

  if (!demande) {
    return (
      <div className='flex flex-col items-center justify-center py-20 gap-3 text-center w-full'>
        <p className='text-sm text-muted-foreground'>Ce dossier n'existe pas.</p>
        <button onClick={() => navigate('/')} className='text-sm text-primary hover:underline'>Retour au tableau de bord</button>
      </div>
    )
  }

  const Icon = demande.icon

  return (
    <div className='flex flex-col w-full gap-5 py-4 max-w-2xl mx-auto'>
      <div>
        <Link to='/' className='inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2'>
          <LuArrowLeft size={13} /> Tableau de bord
        </Link>
        <h1 className='text-xl font-bold flex items-center gap-2'>
          <Icon size={20} className='text-primary' />
          {demande.label}
        </h1>
      </div>

      <form onSubmit={onSubmit} className='rounded-2xl border border-border bg-card p-5 flex flex-col gap-4'>
        {files.length > 0 ? (
          <div className='flex flex-col gap-2'>
            {files.map((f, i) => (
              <div key={i} className='flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3'>
                <LuFileCheck2 className='text-primary shrink-0' size={20} />
                <div className='min-w-0 flex-1'>
                  <div className='text-sm font-medium truncate'>{files.length > 1 ? `Page ${i + 1} — ` : ''}{f.name}</div>
                  <div className='text-xs text-muted-foreground'>{(f.size / 1024).toFixed(0)} Ko</div>
                </div>
                <button type="button" onClick={() => retirerFichier(i)} className='text-xs text-destructive hover:underline shrink-0'>Retirer</button>
              </div>
            ))}
            <div className='grid grid-cols-2 gap-2'>
              <button
                type="button"
                onClick={() => setScannerOuvert(true)}
                className='flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-3 cursor-pointer hover:bg-muted transition-colors text-sm font-medium text-primary'
              >
                <LuCamera size={16} />
                Scanner une page
              </button>
              <label className='flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-3 cursor-pointer hover:bg-muted transition-colors text-sm font-medium text-primary'>
                <LuUpload size={16} />
                Ajouter un fichier
                <input type="file" multiple className='hidden' onChange={(e) => onFilesSelected(e.target.files)} />
              </label>
            </div>
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-3'>
            <button
              type="button"
              onClick={() => setScannerOuvert(true)}
              className='flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 cursor-pointer hover:bg-muted transition-colors'
            >
              <LuCamera size={24} className='text-primary' />
              <span className='text-sm font-medium text-center'>Scanner un document</span>
            </button>
            <label className='flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 cursor-pointer hover:bg-muted transition-colors'>
              <LuUpload size={24} className='text-primary' />
              <span className='text-sm font-medium text-center'>Choisir un ou plusieurs fichiers</span>
              <input type="file" multiple className='hidden' onChange={(e) => onFilesSelected(e.target.files)} />
            </label>
          </div>
        )}
        {files.length > 1 && (
          <p className='text-xs text-muted-foreground -mt-2'>{files.length} pages seront déposées comme un seul dossier.</p>
        )}

        <div>
          <label className='block text-sm font-medium mb-1.5'>Titre</label>
          <input
            type="text"
            value={form.titre}
            onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
            className='w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
            placeholder="Titre du document"
          />
        </div>

        <div>
          <label className='block text-sm font-medium mb-1.5'>
            Message {demande.messageObligatoire ? '' : '(optionnel)'}
          </label>
          <textarea
            value={form.resume}
            onChange={(e) => setForm((f) => ({ ...f, resume: e.target.value }))}
            rows={2}
            required={demande.messageObligatoire}
            className='w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
            placeholder={demande.messageObligatoire ? "Précisez de quoi il s'agit..." : "Un mot sur cette pièce..."}
          />
        </div>

        <button
          type="submit"
          disabled={envoiEnCours}
          className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'
        >
          {envoiEnCours ? <LuLoader2 className='animate-spin' size={15} /> : <LuUpload size={15} />}
          {envoiEnCours && progression ? `Envoi ${progression.actuel}/${progression.total}...` : files.length > 1 ? 'Déposer les pages' : 'Déposer la pièce'}
        </button>
      </form>

      <div className='rounded-2xl border border-border bg-card p-5'>
        <h2 className='text-sm font-semibold mb-3 flex items-center gap-1.5'>
          <LuFolderClock size={15} /> Déjà envoyés dans ce dossier
        </h2>
        <ul className='flex flex-col gap-2'>
          {mesDocuments.map((d) => {
            const { icon: FileIcon, tint } = getFileTypeVisual(d.chemin_stockage_serveur)
            const extension = String(d.chemin_stockage_serveur || '').split('.').pop()
            const rejete = d.status_doc === 'INCOMPLET_REJETE'
            return (
              <li key={d.id} className='flex flex-col gap-1.5'>
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
                {rejete && (
                  <>
                    <CompteARebours document={d} className='-mt-0.5' />
                    <label className='flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-destructive/40 text-destructive text-xs font-medium py-2 cursor-pointer hover:bg-destructive/5 transition-colors'>
                    {correctionEnCours === d.id ? (
                      <LuLoader2 size={13} className='animate-spin' />
                    ) : (
                      <LuRotateCcw size={13} />
                    )}
                    {correctionEnCours === d.id ? 'Envoi en cours...' : 'Corriger et renvoyer un nouveau fichier'}
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
          {mesDocuments.length === 0 && <li className='text-sm text-muted-foreground'>Rien envoyé dans ce dossier pour l'instant</li>}
        </ul>
      </div>

      {scannerOuvert && (
        <ScannerCapture onTermine={onScannerTermine} onClose={() => setScannerOuvert(false)} />
      )}
    </div>
  )
}

export default EspaceDossier
