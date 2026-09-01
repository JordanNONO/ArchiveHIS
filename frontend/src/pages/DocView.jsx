import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { consultationDocument, getDocument, getDocumentLienFichier, getVersionLienFichier, getDocumentMeta, getDocumentHistorique, getDocumentConsultations, getDocumentVersions, uploadNewVersion, transitionDocument, resoudreCourrier, updateDocument, envoyerDecisionConges, envoyerDecisionPaie, verrouillerDocument, deverrouillerDocument, shareDocument } from '../api/routes/document';
import { getServicesMetier } from '../api/routes/serviceMetier';
import { demarrerSuiviDelai, avancerSuiviDelai, cloturerSuiviDelai, getEtapesWorkflowCategorie } from '../api/routes/suiviDelai';
import { getCategorie } from '../api/routes/categorie';
import { getTypeDocuments } from '../api/routes/typeDocument';
import Loading from '../components/Loading';
import Breadcrumbs from '../components/Breadcrumbs';
import DocxReader from '../plugins/DocxReader';
import PdfPageViewer from '../components/PdfPageViewer';
import PptxReader from '../plugins/PptxReader';
/* import ExcelReader from '../plugins/ExcelReader'; */
import InvalideFormat from '../components/InvalideFormat';
import StatutBadge, { STATUT_LABELS, STATUT_TRANSITIONS, getStatutStyle } from '../components/StatutBadge';
import { usePermissions } from '../hooks/usePermissions';
import { alerteDelaiLabel, getDisplayName } from '../utils/common';
import { typesAvecHierarchie } from '../utils/typeHierarchie';
import { nomCategorie, nomType } from '../utils/libelleLocalise';
import { genererPdfDecisionConges } from '../utils/congesPdf';
import { genererPdfCompletionReclamation } from '../utils/reclamationPdf';
import SignaturePad from '../components/SignaturePad';
import { toast } from 'react-toastify';
import { LuFolderOpen, LuPencil, LuX, LuCheck, LuUploadCloud, LuDownload, LuTimer, LuArrowRight, LuCircleSlash, LuLock, LuUnlock, LuMic } from 'react-icons/lu';
import echo from '../utils/echo';

const STATUTS_DECISION_CONGES = ['VALIDE_ET_TRAITE', 'INCOMPLET_REJETE'];
const EXTENSIONS_AUDIO = ['webm', 'm4a', 'mp3', 'wav', 'ogg'];

const NIVEAU_CONFIDENTIALITE_KEYS = {
  PUBLIC: 'docView.niveauPublic',
  INTERNE: 'docView.niveauInterne',
  CONFIDENTIEL: 'docView.niveauConfidentiel',
  STRICTEMENT_CONFIDENTIEL: 'docView.niveauStrictementConfidentiel',
};

function formatTaille(bytes) {
  if (!bytes) return null;
  return bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} Mo` : `${(bytes / 1024).toFixed(2)} Ko`;
}

function nomConcerne(meta) {
  if (!meta) return null;
  if (meta.personnel_concerne) {
    return `${meta.personnel_concerne.prenom || ''} ${meta.personnel_concerne.nom || ''}`.trim();
  }
  return meta.nom_personne_concernee || null;
}

function DocView() {
    const { t, i18n } = useTranslation();
    const {id,type} = useParams();
    const navigate = useNavigate();
    // Passer d'un document à l'autre (ex: depuis "Traités récemment") garde le
    // même DocView monté, juste avec un `id` différent — sans garde, la
    // réponse d'un fetch pour l'ANCIEN document peut arriver après celle du
    // nouveau (l'ordre réseau n'est pas garanti) et écraser silencieusement
    // son contenu avec les données du document précédent. `idActuelRef`
    // retient le SEUL id qu'on veut encore appliquer ; toute réponse pour un
    // autre id est ignorée.
    const idActuelRef = useRef(id)
    const [lienFichier, setLienFichier] = useState(null)
    const [loading,setLoading] = useState(false)
    const [meta, setMeta] = useState(null)
    const [historique, setHistorique] = useState([])
    const [consultations, setConsultations] = useState([])
    const [versions, setVersions] = useState([])
    const [uploadingVersion, setUploadingVersion] = useState(false)
    const [typeVersionChoisi, setTypeVersionChoisi] = useState('mineure')
    const [verrouEnCours, setVerrouEnCours] = useState(false)
    const [motif, setMotif] = useState('')
    const [transitioning, setTransitioning] = useState(false)
    const [suiviEnCours, setSuiviEnCours] = useState(false)
    // null = pas encore vérifié (n'affiche rien tant qu'on ne sait pas), pour
    // éviter un flash du bouton "Démarrer le suivi de délai" avant de savoir
    // si une procédure existe réellement pour cette catégorie.
    const [procedureDelaiDisponible, setProcedureDelaiDisponible] = useState(null)
    const [editingDossier, setEditingDossier] = useState(false)
    const [categories, setCategories] = useState([])
    const [typesForCategorie, setTypesForCategorie] = useState([])
    const [dossierForm, setDossierForm] = useState({ category_id: '', type_document_id: '' })
    const [savingDossier, setSavingDossier] = useState(false)
    const [activeTab, setActiveTab] = useState('details')
    const [pagesLiees, setPagesLiees] = useState([])
    const [audioLie, setAudioLie] = useState(null)
    const { hasPermission, isAdministrator, role } = usePermissions();
    // Le traitement d'un courrier (voir resoudreCourrier ci-dessous) reste
    // réservé aux Administrateurs et au personnel Comptabilité/Paie, quel que
    // soit le service propriétaire du dossier — plus étroit que canValidate.
    const peutTraiterCourrier = isAdministrator || role === 'Éditeur Comptabilité, Paie & Finance';
    const [resolvingCourrier, setResolvingCourrier] = useState(false);
    const canValidate = isAdministrator || hasPermission('valider_documents');
    const canManageDocument = isAdministrator || hasPermission('archiver_documents');
    // Un compte "dépôt" (intervenant, bénéficiaire) n'a pas à connaître le
    // détail du circuit de validation interne — voir StatutBadge.
    const estCompteDepot = ['Intervenant', 'Beneficiaire'].includes(role);
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    // Un dépôt externe atterrit maintenant dans un vrai sous-dossier au nom du
    // déposant (voir DocumentController::store()), pas directement dans le
    // type demandé — on reconnaît donc le type réel soit sur le type lui-même,
    // soit sur son parent immédiat (meta charge typeDocument.parent, voir
    // DocumentController::meta()), sans quoi tout ce qui suit (signature RH,
    // décision paie, traitement réclamation...) ne s'affichait plus du tout.
    function estDuType(libelle) {
        return meta?.type_document?.libelle === libelle || meta?.type_document?.parent?.libelle === libelle
    }
    const estDemandeDeConges = estDuType('Demande de congés');
    // Courrier entrant (voir CourrierForm.jsx) : boutons de résolution dédiés
    // (Payé/Prélèvement/Traité) à la place des transitions de statut
    // classiques, qui n'ont pas de sens pour ce suivi — voir plus bas.
    const estCourrierEntrant = meta?.sens_courrier === 'entrant';
    // Réclamation : "Suivi par"/"Délai de réclamation"/"Actions correctives"
    // sont réservés au traitement interne (voir ReclamationForm.jsx) — remplis
    // ici, jamais par le déposant lui-même.
    const estReclamation = estDuType('Réclamation');
    // Demande de fiche de paie : la Compta répond en envoyant le vrai
    // bulletin (voir PaieForm.jsx, DocumentController::decisionPaie) plutôt
    // que par une simple transition de statut.
    const estDemandePaie = estDuType('Demande de fiche de paie');
    const [fichierPaie, setFichierPaie] = useState(null);
    // Un verrou posé depuis plus de 30 min est traité comme expiré côté
    // serveur (voir DocumentArchive::estVerrouille()) — même règle ici pour
    // ne pas afficher un verrou "actif" qui ne bloquerait plus rien en pratique.
    const verrouActif = !!meta?.verrouille_le && (Date.now() - new Date(meta.verrouille_le).getTime()) < 30 * 60 * 1000;
    const verrouParMoi = verrouActif && meta?.verrouille_par_utilisateur_id === user?.id;
    const verrouParAutrui = verrouActif && !verrouParMoi;
    const [nomSignataire, setNomSignataire] = useState('');
    const [modeSignatureRH, setModeSignatureRH] = useState('pad');
    const [signatureRHDataUrl, setSignatureRHDataUrl] = useState(null);
    const [signatureRHTexte, setSignatureRHTexte] = useState('');
    const [certifieRH, setCertifieRH] = useState(false);
    const [suiviPar, setSuiviPar] = useState('');
    const [delaiReclamation, setDelaiReclamation] = useState('');
    const [actionsCorrectives, setActionsCorrectives] = useState('');
    // "Transmis au service" doit permettre de choisir VERS QUEL service (ex: un
    // responsable secteur transmet une réclamation à RH, qui peut ensuite la
    // retrouver dans ses propres dossiers) — réutilise le mécanisme de partage
    // à un service déjà existant (voir ShareDocumentModal.jsx / partagerVersService
    // côté backend) plutôt que d'ajouter un nouveau système d'assignation.
    const [servicesMetier, setServicesMetier] = useState([]);
    const [serviceChoisi, setServiceChoisi] = useState('');

    function getDoc(){
        setLoading(true)
        getDocumentLienFichier(id).then(async(res)=>{
            if (res.status ===200) {
                const data = await res.json()
                consultationDocument({document_id:id}).catch(()=>{})
                if (idActuelRef.current === id) setLienFichier(data)
            }
            if (idActuelRef.current === id) setLoading(false)
        }).catch(function(err){
            console.log(err)
            if (idActuelRef.current === id) setLoading(false)
        })
    }

    const fetchMeta = useCallback(() => {
        getDocumentMeta(id).then(async (res) => {
            if (res.status === 200) {
                const data = await res.json()
                if (idActuelRef.current !== id) return
                setMeta(data)
                fetchPagesLiees(data.code_reference)
            }
        }).catch((err) => console.log(err))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    // Un dépôt multi-pages (scanner, ou plusieurs fichiers ajoutés d'un coup)
    // crée un document par page, chacun avec une référence du type
    // "DEPOT-<horodatage>-<n>" — voir EspaceDossier.jsx. On retrouve les pages
    // sœurs par ce préfixe commun pour permettre de naviguer entre elles.
    //
    // Le numéro de page/audio (\d{1,3}) doit rester COURT et distinct de
    // l'horodatage qui précède (13 chiffres, voir Date.now()) — sans cette
    // borne, une simple demande de congés ("CNG-JA-1786526998408", sans
    // aucune page sœur) matchait quand même le motif, et se faisait à tort
    // "relier" à toute AUTRE demande de congés de la même personne (même
    // préfixe "CNG-JA", horodatage différent mais toujours suivi de chiffres) :
    // deux dépôts sans aucun rapport apparaissaient comme "pages du même dépôt".
    function fetchPagesLiees(reference){
        const correspondance = typeof reference === 'string' ? reference.match(/^(.*)-(\d{1,3})$/) : null
        if (!correspondance) {
            setPagesLiees([])
            setAudioLie(null)
            return
        }
        const prefixeEchappe = correspondance[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const motif = new RegExp(`^${prefixeEchappe}-(\\d{1,3})$`)
        getDocument().then(async (res) => {
            if (res.status !== 200) return
            const data = await res.json()
            const pages = data
                .filter((d) => typeof d.code_reference === 'string' && motif.test(d.code_reference))
                .map((d) => ({
                    id: d.id,
                    page: parseInt(d.code_reference.match(motif)[1], 10),
                    extension: String(d.chemin_stockage_serveur || '').split('.').pop(),
                }))
                .sort((a, b) => a.page - b.page)
            if (idActuelRef.current !== id) return
            // Un message vocal joint à une réclamation/un signalement (voir
            // ReclamationForm.jsx/SignalementForm.jsx) est une "page" liée comme
            // une autre, mais se montre directement sous le document plutôt que
            // comme une page à part à aller chercher via le sélecteur.
            const pageAudio = pages.find((p) => EXTENSIONS_AUDIO.includes(p.extension) && String(p.id) !== id)
            const autresPages = pages.filter((p) => p !== pageAudio)
            setPagesLiees(autresPages.length > 1 ? autresPages : [])
            if (pageAudio) {
                getDocumentLienFichier(pageAudio.id).then(async (r) => {
                    if (r.status === 200 && idActuelRef.current === id) {
                        const d = await r.json()
                        setAudioLie({ id: pageAudio.id, url: d.affichage })
                    }
                }).catch(() => {})
            } else {
                setAudioLie(null)
            }
        }).catch(() => {})
    }

    const fetchHistorique = useCallback(() => {
        getDocumentHistorique(id).then(async (res) => {
            if (res.status === 200) {
                const data = await res.json()
                if (idActuelRef.current === id) setHistorique(data)
            }
        }).catch((err) => console.log(err))
    }, [id])

    function fetchConsultations(){
        getDocumentConsultations(id).then(async (res) => {
            if (res.status === 200) {
                const data = await res.json()
                if (idActuelRef.current === id) setConsultations(data)
            }
        }).catch((err) => console.log(err))
    }

    function fetchVersions(){
        getDocumentVersions(id).then(async (res) => {
            if (res.status === 200) {
                const data = await res.json()
                if (idActuelRef.current === id) setVersions(data)
            }
        }).catch((err) => console.log(err))
    }

    async function onDownloadVersion(versionId){
        try {
            const res = await getVersionLienFichier(id, versionId)
            if (res.status === 200) {
                const data = await res.json()
                window.location.href = data.telechargement
            } else {
                toast.error(t('docView.telechargementEchoue'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        }
    }

    async function onReplaceFile(e){
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            setUploadingVersion(true)
            const res = await uploadNewVersion(id, file, typeVersionChoisi)
            if (res.status === 200) {
                toast.success(t('docView.fichierRemplace'))
                fetchVersions()
                fetchMeta()
                getDoc()
            } else {
                const data = await res.json()
                toast.error(data?.error || t('docView.remplacementEchoue'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setUploadingVersion(false)
        }
    }

    async function onVerrouiller(){
        try {
            setVerrouEnCours(true)
            const res = await verrouillerDocument(id)
            if (res.status === 200) {
                toast.success(t('docView.documentVerrouilleMsg'))
                fetchMeta()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error || t('docView.verrouillageEchoue'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setVerrouEnCours(false)
        }
    }

    async function onDeverrouiller(){
        try {
            setVerrouEnCours(true)
            const res = await deverrouillerDocument(id)
            if (res.status === 200) {
                toast.success(t('docView.documentDeverrouille'))
                fetchMeta()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error || t('docView.deverrouillageEchoue'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setVerrouEnCours(false)
        }
    }

    useEffect(() => {
      idActuelRef.current = id
      // Efface tout de suite l'ancien contenu affiché plutôt que d'attendre
      // la réponse du nouveau document — sans ça, la page/le fichier
      // précédent reste visible pendant le chargement, ce qui donne
      // l'impression qu'on regarde encore l'ancien document.
      setLienFichier(null)
      setMeta(null)
      setHistorique([])
      setConsultations([])
      setVersions([])
      setPagesLiees([])
      getDoc()
      fetchMeta()
      fetchHistorique()
      fetchConsultations()
      fetchVersions()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    // Pré-rempli avec l'identité du responsable connecté — reste modifiable
    // (ex: préciser sa fonction) avant de valider/rejeter une demande de congés.
    useEffect(() => {
      if (estDemandeDeConges && !nomSignataire) {
        setNomSignataire(getDisplayName(user))
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [estDemandeDeConges])

    useEffect(() => {
      if (canValidate) {
        getServicesMetier().then(async (res) => res.ok && setServicesMetier(await res.json())).catch(() => {})
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canValidate])

    // Si quelqu'un d'autre change le statut de ce document pendant qu'on a la
    // page ouverte, on le voit sans avoir à rafraîchir.
    useEffect(() => {
      const channel = echo.channel(`document.${id}`)
      channel.listen('.statut.maj', () => {
        fetchMeta()
        fetchHistorique()
      })
      return () => {
        echo.leave(`document.${id}`)
      }
    }, [id, fetchMeta, fetchHistorique])

    // Détermine si la catégorie du document a une procédure de délai définie
    // (aujourd'hui, seule "SortieRupture" en a une) — évite d'afficher le
    // bouton "Démarrer le suivi de délai" pour ensuite échouer à tous les coups
    // avec "Aucune procédure de délai n'est définie pour ce type de dossier".
    useEffect(() => {
        setProcedureDelaiDisponible(null)
        if (!meta?.categorie_id) return
        let annule = false
        getEtapesWorkflowCategorie(meta.categorie_id).then(async (res) => {
            if (annule) return
            const data = res.ok ? await res.json() : []
            setProcedureDelaiDisponible(Array.isArray(data) && data.length > 0)
        }).catch(() => { if (!annule) setProcedureDelaiDisponible(false) })
        return () => { annule = true }
    }, [meta?.categorie_id])

    async function doTransition(nouveauStatut){
        if (estDemandeDeConges && STATUTS_DECISION_CONGES.includes(nouveauStatut)) {
            return doTransitionCongeAvecDecision(nouveauStatut)
        }
        if (estDemandePaie && nouveauStatut === 'VALIDE_ET_TRAITE') {
            return doTransitionPaieAvecFichier()
        }
        if (estReclamation && nouveauStatut === 'VALIDE_ET_TRAITE') {
            return doTraiterReclamation()
        }
        if (nouveauStatut === 'TRANSMIS_AU_SERVICE') {
            return doTransmettreAuService()
        }
        try {
            setTransitioning(true)
            const res = await transitionDocument(id, { nouveau_statut: nouveauStatut, motif: motif || undefined })
            if (res.status === 200) {
                toast.success(t('docView.statutMisAJour'))
                setMotif('')
                fetchMeta()
                fetchHistorique()
            } else {
                const data = await res.json()
                toast.error(data?.error || t('docView.transitionNonAutorisee'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setTransitioning(false)
        }
    }

    /**
     * Cas particulier d'une demande de congés : au lieu d'une simple
     * transition de statut, on complète la section 3 "Décision de l'employeur"
     * directement sur le PDF déjà déposé (voir congesPdf.js), on remplace le
     * fichier par cette version complétée, puis le backend envoie ce PDF final
     * par e-mail au demandeur — le tout en un seul appel (decisionConges).
     */
    async function doResoudreCourrier(etatCourrier){
        try {
            setResolvingCourrier(true)
            const res = await resoudreCourrier(id, { etat_courrier: etatCourrier })
            if (res.status === 200) {
                toast.success(t('docView.courrierTraite'))
                fetchMeta()
                fetchHistorique()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error || t('docView.transitionNonAutorisee'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setResolvingCourrier(false)
        }
    }

    async function doTransitionCongeAvecDecision(nouveauStatut){
        if (!nomSignataire.trim()) {
            toast.warning(t('docView.indiquerSignataire'))
            return
        }
        const signatureOk = modeSignatureRH === 'pad' ? !!signatureRHDataUrl : (signatureRHTexte.trim() && certifieRH)
        if (!signatureOk) {
            toast.warning(modeSignatureRH === 'pad' ? t('docView.signezDansLePave') : t('docView.indiquerNomEtCertifier'))
            return
        }
        if (!lienFichier?.affichage) {
            toast.error(t('docView.fichierNonDisponible'))
            return
        }
        try {
            setTransitioning(true)
            const pdfResponse = await fetch(lienFichier.affichage)
            if (!pdfResponse.ok) throw new Error('lien-fichier')
            const pdfBytes = await pdfResponse.arrayBuffer()

            const blob = await genererPdfDecisionConges(pdfBytes, {
                reponse: nouveauStatut === 'VALIDE_ET_TRAITE' ? 'Accord' : 'Refus',
                motif: motif || undefined,
                dateDecision: new Date(),
                nomSignataire,
                signatureDataUrl: modeSignatureRH === 'pad' ? signatureRHDataUrl : null,
                signatureTexte: modeSignatureRH === 'texte' ? `${signatureRHTexte} (signature électronique certifiée)` : null,
            })
            const fichier = new File([blob], `${meta?.titre_document || 'demande-conges'}.pdf`, { type: 'application/pdf' })

            const formData = new FormData()
            formData.append('file', fichier)
            formData.append('nouveau_statut', nouveauStatut)
            if (motif) formData.append('motif', motif)
            formData.append('nom_signataire', nomSignataire)

            const res = await envoyerDecisionConges(id, formData)
            if (res.status === 200) {
                toast.success(t('docView.decisionEnregistree'))
                setMotif('')
                setSignatureRHDataUrl(null)
                setSignatureRHTexte('')
                setCertifieRH(false)
                fetchMeta()
                fetchHistorique()
                fetchVersions()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error || t('docView.decisionEchouee'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('docView.erreurGenerationPdf'))
        } finally {
            setTransitioning(false)
        }
    }

    /**
     * Cas particulier d'une "Demande de fiche de paie" : la Compta envoie
     * directement le vrai bulletin (voir PaieForm.jsx, DocumentController::
     * decisionPaie) — pas de simple transition de statut, le fichier de la
     * demande est remplacé par le bulletin et rangé dans le vrai dossier.
     */
    async function doTransitionPaieAvecFichier(){
        if (!fichierPaie) {
            toast.warning(t('docView.selectionnerFichierPaie'))
            return
        }
        try {
            setTransitioning(true)
            const formData = new FormData()
            formData.append('file', fichierPaie)
            const res = await envoyerDecisionPaie(id, formData)
            if (res.status === 200) {
                toast.success(t('docView.ficheDePaieEnvoyee'))
                setFichierPaie(null)
                fetchMeta()
                fetchHistorique()
                fetchVersions()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error || t('docView.envoiEchoue'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setTransitioning(false)
        }
    }

    /**
     * Cas particulier d'une réclamation : complète directement le PDF déjà
     * déposé (voir reclamationPdf.js) avec le traitement interne ("Suivi
     * par"/"Délai de réclamation"/"Actions correctives"), remplace le fichier
     * (nouvelle version majeure) puis marque le document "Validé et traité" —
     * pas besoin d'un endpoint dédié comme les congés : le propriétaire est
     * déjà notifié automatiquement à ce changement de statut (voir
     * DocumentStatusService::STATUTS_NOTIFIANT_PROPRIETAIRE), inutile d'un
     * e-mail à part.
     */
    async function doTraiterReclamation(){
        if (!actionsCorrectives.trim()) {
            toast.warning(t('docView.preciserActionsCorrectives'))
            return
        }
        if (!lienFichier?.affichage) {
            toast.error(t('docView.fichierNonDisponible'))
            return
        }
        try {
            setTransitioning(true)
            const pdfResponse = await fetch(lienFichier.affichage)
            if (!pdfResponse.ok) throw new Error('lien-fichier')
            const pdfBytes = await pdfResponse.arrayBuffer()

            const blob = await genererPdfCompletionReclamation(pdfBytes, {
                suiviPar,
                delaiReclamation,
                actionsCorrectives,
            })
            const fichier = new File([blob], `${meta?.titre_document || 'reclamation'}.pdf`, { type: 'application/pdf' })

            const resVersion = await uploadNewVersion(id, fichier, 'majeure')
            if (resVersion.status !== 200) {
                const data = await resVersion.json().catch(() => ({}))
                toast.error(data?.error || t('docView.remplacementFichierEchoue'))
                return
            }

            const resTransition = await transitionDocument(id, { nouveau_statut: 'VALIDE_ET_TRAITE' })
            if (resTransition.status === 200) {
                toast.success(t('docView.reclamationTraitee'))
                setSuiviPar('')
                setDelaiReclamation('')
                setActionsCorrectives('')
                fetchMeta()
                fetchHistorique()
                fetchVersions()
            } else {
                const data = await resTransition.json().catch(() => ({}))
                toast.error(data?.error || t('docView.transitionEchouee'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('docView.erreurGenerationPdf'))
        } finally {
            setTransitioning(false)
        }
    }

    /**
     * "Transmis au service" demande vers QUEL service — réutilise le partage à
     * un service déjà existant (voir share() côté backend / ShareDocumentModal.jsx) :
     * tous les membres du service choisi reçoivent le document (email +
     * notification) et le retrouvent ensuite dans leurs propres dossiers, en plus
     * de faire avancer le statut.
     */
    async function doTransmettreAuService(){
        if (!serviceChoisi) {
            toast.warning(t('docView.choisirServiceTransmission'))
            return
        }
        try {
            setTransitioning(true)
            const resPartage = await shareDocument(id, { service_metier_id: serviceChoisi, message: motif || undefined })
            if (resPartage.status !== 200) {
                const data = await resPartage.json().catch(() => ({}))
                toast.error(data?.error || t('docView.transmissionServiceEchouee'))
                return
            }
            const resTransition = await transitionDocument(id, { nouveau_statut: 'TRANSMIS_AU_SERVICE', motif: motif || undefined })
            if (resTransition.status === 200) {
                toast.success(t('docView.documentTransmisAuService'))
                setMotif('')
                setServiceChoisi('')
                fetchMeta()
                fetchHistorique()
            } else {
                const data = await resTransition.json().catch(() => ({}))
                toast.error(data?.error || t('docView.transitionNonAutorisee'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setTransitioning(false)
        }
    }

    async function doDemarrerSuivi(){
        try {
            setSuiviEnCours(true)
            const res = await demarrerSuiviDelai(id)
            if (res.status === 201) {
                toast.success(t('docView.suiviDelaiDemarre'))
                fetchMeta()
            } else {
                const data = await res.json()
                toast.error(data?.error || t('docView.impossibleDemarrerSuivi'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setSuiviEnCours(false)
        }
    }

    async function doAvancerSuivi(){
        try {
            setSuiviEnCours(true)
            const res = await avancerSuiviDelai(meta.suivi_delai_actif.id)
            if (res.status === 201) {
                toast.success(t('docView.etapeSuivanteDemarree'))
            } else if (res.status === 200) {
                toast.success(t('docView.procedureTerminee'))
            } else {
                const data = await res.json()
                toast.error(data?.error || t('docView.impossibleAvancerEtape'))
            }
            fetchMeta()
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setSuiviEnCours(false)
        }
    }

    async function doCloturerSuivi(){
        try {
            setSuiviEnCours(true)
            const res = await cloturerSuiviDelai(meta.suivi_delai_actif.id)
            if (res.status === 200) {
                toast.success(t('docView.suiviCloture'))
                fetchMeta()
            } else {
                const data = await res.json()
                toast.error(data?.error || t('docView.impossibleCloturerSuivi'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setSuiviEnCours(false)
        }
    }

    function openEditDossier(){
        setDossierForm({ category_id: meta.categorie_id || '', type_document_id: meta.type_document_id || '' })
        if (categories.length === 0) {
            getCategorie().then(async (res) => res.ok && setCategories(await res.json())).catch(() => {})
        }
        if (meta.categorie_id) {
            getTypeDocuments(meta.categorie_id).then(async (res) => res.ok && setTypesForCategorie(await res.json())).catch(() => {})
        }
        setEditingDossier(true)
    }

    function onCategorieChange(newCategoryId){
        setDossierForm({ category_id: newCategoryId, type_document_id: '' })
        setTypesForCategorie([])
        if (newCategoryId) {
            getTypeDocuments(newCategoryId).then(async (res) => res.ok && setTypesForCategorie(await res.json())).catch(() => {})
        }
    }

    async function saveDossier(){
        if (!dossierForm.category_id) {
            toast.error(t('docView.choisirUneCategorie'));
            return;
        }
        try {
            setSavingDossier(true)
            const res = await updateDocument(id, {
                category_id: dossierForm.category_id,
                type_document_id: dossierForm.type_document_id || null,
                titre: meta.titre_document,
                auteur: meta.auteur,
                resume: meta.resume,
                reference: meta.code_reference,
                personnel_concerne_id: meta.personnel_concerne_id,
                nom_personne_concernee: meta.nom_personne_concernee,
            })
            if (res.status === 200) {
                toast.success(t('docView.dossierMisAJour'))
                setEditingDossier(false)
                fetchMeta()
            } else {
                const data = await res.json()
                toast.error(data?.error || t('docView.miseAJourDossierImpossible'))
            }
        } catch (error) {
            console.log(error)
            toast.error(t('commun.erreurGenerique'))
        } finally {
            setSavingDossier(false)
        }
    }

    const ReadFile = () => {
      if (!lienFichier) return null;
      const fileExtension = type;
      switch (fileExtension) {
        case 'pdf':
          return <PdfPageViewer url={lienFichier.affichage} />;
        case 'doc':
        case 'docx':
          return <DocxReader fileUrl={lienFichier.affichage}/>
        case 'jpg':
        case 'jpeg':
        case 'png':
          return <img src={lienFichier.affichage} alt={meta?.titre_document} className='w-full max-h-[70vh] lg:max-h-[90vh] object-contain rounded-lg bg-muted' />;
        case 'txt':
          return <iframe src={lienFichier.affichage} title={meta?.titre_document || t('docView.apercuDocument')} className='w-full h-[70vh] lg:h-[90vh] bg-white rounded-lg border border-border' frameBorder="0"></iframe>;
        case 'webm':
        case 'mp3':
        case 'wav':
        case 'ogg':
        case 'm4a':
          // Message vocal (voir VoiceRecorder.jsx) ou tout autre dépôt audio —
          // les contrôles natifs suffisent (lecture/pause/défilement/volume).
          return (
            <div className='w-full flex items-center justify-center py-16 bg-muted rounded-lg'>
              <audio src={lienFichier.affichage} controls className='w-full max-w-md' />
            </div>
          );
        case 'xls':
        case 'xlsx':
        case 'csv':
          return <InvalideFormat href={lienFichier.telechargement}/>
        case 'ppt':
        case 'pptx':
          return <PptxReader fileUrl={lienFichier.affichage} />;
        default:
          return <InvalideFormat href={lienFichier.telechargement}/>;
      }
    };

    const transitionsPossibles = meta?.status_doc ? (STATUT_TRANSITIONS[meta.status_doc] || []) : [];

  return loading? <Loading/>:(
    <div className='flex flex-col w-full gap-4 py-4'>
      <div className='flex items-center justify-between gap-2'>
        <Breadcrumbs where={meta?.titre_document || t('docView.document')} />
        <button
          onClick={() => navigate(-1)}
          aria-label={t('openFolder.fermer')}
          className='rounded-lg border border-border p-2 hover:bg-muted transition-colors shrink-0'
        >
          <LuX size={16} />
        </button>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap items-center gap-3'>
          <h2 className='font-bold text-xl break-words'>{meta?.titre_document}</h2>
          <StatutBadge statut={meta?.status_doc} externe={estCompteDepot} />
        </div>
        <a
          href={lienFichier?.telechargement}
          className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors shrink-0'
        >
          <LuDownload size={14} />
          {t('docView.telecharger')}
        </a>
      </div>

      {pagesLiees.length > 1 && (
        <div className='flex items-center gap-2 flex-wrap'>
          <span className='text-xs text-muted-foreground'>{t('docView.pagesDeCeDepot')}</span>
          <div className='flex items-center gap-1.5 flex-wrap'>
            {pagesLiees.map((p) => (
              <button
                key={p.id}
                onClick={() => String(p.id) !== id && navigate(`/view/${p.id}/${p.extension}`)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  String(p.id) === id ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {t('docView.page', { numero: p.page })}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className='flex flex-col lg:flex-row w-full gap-5 items-start'>
      <div className='flex-grow min-w-0 rounded-2xl border border-border bg-card p-3 overflow-hidden'>
        {ReadFile()}
        {audioLie && (
          <div className='mt-3 pt-3 border-t border-border'>
            <p className='text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5'>
              <LuMic size={13} /> {t('docView.messageVocalOriginal')}
            </p>
            <audio controls src={audioLie.url} className='w-full h-9' />
          </div>
        )}
      </div>
      <div className='w-full lg:w-80 lg:flex-shrink-0 flex flex-col gap-5'>

        <div className='rounded-2xl border border-border bg-card overflow-hidden'>
          <div className='flex items-center gap-1 p-1.5 border-b border-border bg-muted/40'>
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${activeTab === 'details' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('docView.details')}
            </button>
            <button
              onClick={() => setActiveTab('historique')}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${activeTab === 'historique' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('docView.historique')}
            </button>
            <button
              onClick={() => setActiveTab('activite')}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${activeTab === 'activite' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('docView.activite')}
            </button>
            <button
              onClick={() => setActiveTab('versions')}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${activeTab === 'versions' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('docView.versions')}
            </button>
          </div>

          {activeTab === 'details' && (
            <div className='p-4'>
              <div className='flex items-center justify-between mb-1.5'>
                <p className='text-xs text-muted-foreground'>{t('docView.dossier')}</p>
                {canManageDocument && !editingDossier && (
                  <button className='text-muted-foreground hover:text-foreground' onClick={openEditDossier} title={t('docView.changerDeDossier')}>
                    <LuPencil size={13} />
                  </button>
                )}
              </div>
              {editingDossier ? (
                <div className='flex flex-col gap-2 pb-4 mb-4 border-b border-border'>
                  <select
                    className='select select-bordered select-sm w-full'
                    value={dossierForm.category_id}
                    onChange={(e) => onCategorieChange(e.target.value)}
                  >
                    <option value=''>{t('docView.choisirCategorie')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{nomCategorie(c, i18n.language)}</option>
                    ))}
                  </select>
                  <select
                    className='select select-bordered select-sm w-full'
                    value={dossierForm.type_document_id}
                    onChange={(e) => setDossierForm((f) => ({ ...f, type_document_id: e.target.value }))}
                    disabled={!dossierForm.category_id}
                  >
                    <option value=''>{t('docView.aucunSousDossier')}</option>
                    {typesAvecHierarchie(typesForCategorie).map((tp) => (
                      <option key={tp.id} value={tp.id}>{tp.profondeur > 0 ? `${'—'.repeat(tp.profondeur)} ${nomType(tp, i18n.language)}` : nomType(tp, i18n.language)}</option>
                    ))}
                  </select>
                  <div className='flex gap-2 justify-end'>
                    <button className='btn btn-sm btn-ghost' onClick={() => setEditingDossier(false)} disabled={savingDossier}>
                      <LuX size={14} /> {t('docView.annuler')}
                    </button>
                    <button className='btn btn-sm bg-primary text-white hover:bg-primary' onClick={saveDossier} disabled={savingDossier}>
                      <LuCheck size={14} /> {t('docView.enregistrer')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className='flex items-center gap-2 text-sm font-medium pb-4 mb-4 border-b border-border'>
                  <LuFolderOpen size={14} className='flex-shrink-0 text-muted-foreground' />
                  <span className='truncate'>
                    {meta?.categorie_document ? nomCategorie(meta.categorie_document, i18n.language) : '—'}
                    {meta?.type_document ? ` / ${nomType(meta.type_document, i18n.language)}` : ''}
                  </span>
                </div>
              )}

              <div className='grid grid-cols-2 gap-x-4 gap-y-3.5'>
                <div>
                  <p className='text-xs text-muted-foreground'>{t('docView.auteur')}</p>
                  <p className='text-sm font-medium truncate'>{meta?.auteur || '—'}</p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>{t('docView.reference')}</p>
                  <p className='text-sm font-medium truncate'>{meta?.code_reference || '—'}</p>
                </div>
                {nomConcerne(meta) && nomConcerne(meta) !== meta?.auteur && (
                  <div>
                    <p className='text-xs text-muted-foreground'>{t('docView.concerne')}</p>
                    <p className='text-sm font-medium truncate'>{nomConcerne(meta)}</p>
                  </div>
                )}
                <div>
                  <p className='text-xs text-muted-foreground'>{t('docView.taille')}</p>
                  <p className='text-sm font-medium truncate'>{formatTaille(meta?.taille) || '—'}</p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>{t('docView.dateDocument')}</p>
                  <p className='text-sm font-medium truncate'>{meta?.file_create_date || '—'}</p>
                </div>
                {meta?.date_archivage && (
                  <div>
                    <p className='text-xs text-muted-foreground'>{t('docView.archiveLe')}</p>
                    <p className='text-sm font-medium truncate'>{new Date(meta.date_archivage).toLocaleDateString(i18n.language)}</p>
                  </div>
                )}
                {meta?.niveau_confidentialite && (
                  <div>
                    <p className='text-xs text-muted-foreground'>{t('docView.confidentialite')}</p>
                    <p className='text-sm font-medium truncate'>{NIVEAU_CONFIDENTIALITE_KEYS[meta.niveau_confidentialite] ? t(NIVEAU_CONFIDENTIALITE_KEYS[meta.niveau_confidentialite]) : meta.niveau_confidentialite}</p>
                  </div>
                )}
              </div>

              {meta?.resume && (
                <div className='mt-4 pt-4 border-t border-border'>
                  <p className='text-xs text-muted-foreground mb-1'>{t('docView.resume')}</p>
                  <p className='text-sm whitespace-pre-line'>{meta.resume}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'historique' && (
            <div className='p-4'>
              <ul className='flex flex-col max-h-[420px] overflow-y-auto pr-1'>
                {historique.map((h, idx) => {
                  const { classes, icon: Icon } = getStatutStyle(h.nouveau_statut);
                  const isLast = idx === historique.length - 1;
                  return (
                    <li key={h.id} className='flex gap-3'>
                      <div className='flex flex-col items-center'>
                        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${classes}`}>
                          {Icon && <Icon size={14} />}
                        </span>
                        {!isLast && <span className='w-px flex-1 bg-border my-1' />}
                      </div>
                      <div className={`min-w-0 text-sm ${isLast ? 'pb-0' : 'pb-4'}`}>
                        <div className='font-medium'>
                          {STATUT_LABELS[h.nouveau_statut] ? t(STATUT_LABELS[h.nouveau_statut]) : h.nouveau_statut}
                        </div>
                        <div className='text-muted-foreground text-xs mt-0.5'>
                          {new Date(h.date_changement).toLocaleString(i18n.language)}
                        </div>
                        {h.motif_changement && <div className='text-xs mt-1 text-foreground/80 break-words'>{h.motif_changement}</div>}
                      </div>
                    </li>
                  );
                })}
                {historique.length === 0 && <li className='text-sm text-muted-foreground'>{t('docView.aucunHistorique')}</li>}
              </ul>
            </div>
          )}

          {activeTab === 'activite' && (
            <div className='p-4'>
              <p className='text-xs text-muted-foreground mb-3'>{t('docView.personnesAyantConsulte')}</p>
              <ul className='flex flex-col gap-3'>
                {consultations.map((c) => {
                  const p = c.user?.personnels?.[0];
                  const nomAffiche = p ? `${p.prenom || ''} ${p.nom || ''}`.trim() : (c.user?.nom || t('docView.utilisateur'));
                  return (
                    <li key={c.id} className='flex items-center gap-2.5 text-sm'>
                      <span className='flex-shrink-0 w-7 h-7 rounded-full bg-secondary/10 text-secondary text-xs font-semibold flex items-center justify-center'>
                        {nomAffiche.slice(0, 1).toUpperCase()}
                      </span>
                      <div className='min-w-0'>
                        <div className='font-medium truncate'>{nomAffiche}</div>
                        <div className='text-muted-foreground text-xs'>{new Date(c.created_at).toLocaleString(i18n.language)}</div>
                      </div>
                    </li>
                  );
                })}
                {consultations.length === 0 && <li className='text-sm text-muted-foreground'>{t('docView.aucuneConsultation')}</li>}
              </ul>
            </div>
          )}

          {activeTab === 'versions' && (
            <div className='p-4'>
              <div className='flex items-center justify-between mb-4'>
                <div className='text-sm'>
                  <span className='text-muted-foreground'>{t('docView.versionActuelle')} </span>
                  <span className='font-semibold'>{meta?.version_majeure ?? 1}.{meta?.version_mineure ?? 0}</span>
                </div>
                {canManageDocument && (
                  verrouActif ? (
                    <button
                      type='button'
                      onClick={onDeverrouiller}
                      disabled={verrouEnCours || (verrouParAutrui && !isAdministrator)}
                      className='inline-flex items-center gap-1.5 text-xs font-medium text-accent-foreground bg-accent/20 rounded-lg px-2.5 py-1.5 hover:bg-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                      title={verrouParAutrui ? undefined : t('docView.deverrouiller')}
                    >
                      <LuLock size={13} />
                      {verrouParMoi ? t('docView.verrouilleParVous') : t('docView.verrouillePar', { nom: meta?.verrouille_par?.nom || t('docView.unAutreUtilisateur') })}
                    </button>
                  ) : (
                    <button
                      type='button'
                      onClick={onVerrouiller}
                      disabled={verrouEnCours}
                      className='inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted transition-colors disabled:opacity-50'
                    >
                      <LuUnlock size={13} />
                      {t('docView.verrouiller')}
                    </button>
                  )
                )}
              </div>

              {verrouParAutrui && (
                <p className='text-xs text-accent-foreground bg-accent/10 rounded-lg px-3 py-2 mb-4'>
                  {t('docView.travailleSurDocument', { nom: meta?.verrouille_par?.nom || t('docView.quelquUn') })}
                </p>
              )}

              {canManageDocument && (
                <div className={`mb-4 ${verrouParAutrui && !isAdministrator ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className='inline-flex rounded-lg border border-border overflow-hidden text-xs mb-2'>
                    <button type='button' onClick={() => setTypeVersionChoisi('mineure')} className={`px-2.5 py-1 transition-colors ${typeVersionChoisi === 'mineure' ? 'bg-primary text-white' : 'bg-background hover:bg-muted'}`}>{t('docView.modificationMineure')}</button>
                    <button type='button' onClick={() => setTypeVersionChoisi('majeure')} className={`px-2.5 py-1 transition-colors ${typeVersionChoisi === 'majeure' ? 'bg-primary text-white' : 'bg-background hover:bg-muted'}`}>{t('docView.versionMajeureBtn')}</button>
                  </div>
                  <label className={`flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${uploadingVersion ? 'opacity-60 pointer-events-none' : 'hover:bg-muted'}`}>
                    <LuUploadCloud size={15} />
                    {uploadingVersion ? t('docView.envoiEnCours') : t('docView.remplacerFichier')}
                    <input type="file" className='hidden' onChange={onReplaceFile} disabled={uploadingVersion} />
                  </label>
                </div>
              )}
              <ul className='flex flex-col gap-3'>
                {versions.map((v) => {
                  const p = v.utilisateur?.personnels?.[0];
                  const nomAffiche = p ? `${p.prenom || ''} ${p.nom || ''}`.trim() : (v.utilisateur?.nom || t('docView.utilisateur'));
                  return (
                    <li key={v.id} className='flex items-center justify-between gap-2 text-sm border border-border rounded-lg px-3 py-2'>
                      <div className='min-w-0'>
                        <div className='font-medium truncate flex items-center gap-1.5'>
                          {t('docView.versionLabel', { majeur: v.numero_majeur ?? 1, mineur: v.numero_mineur ?? 0 })}
                          <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded-full ${v.type_version === 'majeure' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {v.type_version === 'majeure' ? t('docView.majeure') : t('docView.mineure')}
                          </span>
                        </div>
                        <div className='text-muted-foreground text-xs truncate'>{nomAffiche} — {new Date(v.created_at).toLocaleString(i18n.language)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDownloadVersion(v.id)}
                        className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0'
                        title={t('docView.telechargerCetteVersion')}
                      >
                        <LuDownload size={15} />
                      </button>
                    </li>
                  );
                })}
                {versions.length === 0 && <li className='text-sm text-muted-foreground'>{t('docView.aucuneVersionAnterieure')}</li>}
              </ul>
            </div>
          )}

          {(meta?.suivi_delai_actif || (canManageDocument && procedureDelaiDisponible)) && (
            <div className='p-4 border-t border-border'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5'>
                <LuTimer size={13} /> {t('docView.suiviDeDelai')}
              </h3>
              {meta?.suivi_delai_actif ? (
                <div className='flex flex-col gap-3'>
                  <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                    meta.suivi_delai_actif.niveau_alerte === 'ROUGE' ? 'border-destructive/40 bg-destructive/5 text-destructive'
                    : meta.suivi_delai_actif.niveau_alerte === 'ORANGE' ? 'border-accent/50 bg-accent/10'
                    : 'border-border bg-muted/40'
                  }`}>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      meta.suivi_delai_actif.niveau_alerte === 'ROUGE' ? 'bg-destructive animate-alerte-rouge'
                      : meta.suivi_delai_actif.niveau_alerte === 'ORANGE' ? 'bg-accent animate-alerte-orange'
                      : 'bg-green-600'
                    }`} />
                    <div className='min-w-0'>
                      <div className='font-medium truncate'>{meta.suivi_delai_actif.etape_workflow?.nom}</div>
                      <div className='text-xs opacity-80 truncate'>{alerteDelaiLabel(meta.suivi_delai_actif)}</div>
                    </div>
                  </div>
                  {canValidate && (
                    <div className='flex gap-2'>
                      <button disabled={suiviEnCours} onClick={doAvancerSuivi} className='btn btn-sm flex-1 bg-primary text-white hover:bg-primary/90 border-0 gap-1.5'>
                        <LuArrowRight size={14} /> {t('docView.etapeSuivante')}
                      </button>
                      <button disabled={suiviEnCours} onClick={doCloturerSuivi} className='btn btn-sm btn-ghost gap-1.5' title={t('docView.cloturerSansEtapeSuivante')}>
                        <LuCircleSlash size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ) : canManageDocument ? (
                <button disabled={suiviEnCours} onClick={doDemarrerSuivi} className='btn btn-sm w-full gap-1.5 border-border'>
                  <LuTimer size={14} /> {t('docView.demarrerSuiviDelai')}
                </button>
              ) : null}
            </div>
          )}

          {estCourrierEntrant && transitionsPossibles.includes('VALIDE_ET_TRAITE') && (
            <div className='p-4 border-t border-border bg-primary/5'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-primary mb-3'>{t('docView.traiterCourrier')}</h3>
              {peutTraiterCourrier ? (
                <div className='flex flex-col gap-2'>
                  {['Payé', 'Prélèvement', 'Traité'].map((etatCourrier) => (
                    <button
                      key={etatCourrier}
                      disabled={resolvingCourrier}
                      onClick={() => doResoudreCourrier(etatCourrier)}
                      className='btn btn-sm justify-start gap-2 border-0 hover:opacity-90 bg-green-600 text-white'
                    >
                      <LuCheck size={14} /> {etatCourrier}
                    </button>
                  ))}
                </div>
              ) : (
                <p className='text-xs text-muted-foreground'>{t('docView.traiterCourrierReserve')}</p>
              )}
            </div>
          )}

          {canValidate && !estCourrierEntrant && transitionsPossibles.length > 0 && (
            <div className='p-4 border-t border-border bg-primary/5'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-primary mb-3'>{t('docView.faireEvoluerStatut')}</h3>
              {estDemandeDeConges && transitionsPossibles.some((s) => STATUTS_DECISION_CONGES.includes(s)) && (
                <div className='mb-2'>
                  <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('docView.nomFonctionSignataire')}</label>
                  <input
                    type='text'
                    value={nomSignataire}
                    onChange={(e) => setNomSignataire(e.target.value)}
                    placeholder={t('docView.exempleSignataire')}
                    className='input input-bordered input-sm w-full bg-background mb-2'
                  />
                  <div className='flex items-center justify-between mb-1.5'>
                    <label className='block text-xs font-medium text-muted-foreground'>{t('docView.signature')}</label>
                    <div className='inline-flex rounded-lg border border-border overflow-hidden text-[11px]'>
                      <button type='button' onClick={() => setModeSignatureRH('pad')} className={`px-2 py-0.5 transition-colors ${modeSignatureRH === 'pad' ? 'bg-primary text-white' : 'bg-background hover:bg-muted'}`}>{t('docView.pave')}</button>
                      <button type='button' onClick={() => setModeSignatureRH('texte')} className={`px-2 py-0.5 transition-colors ${modeSignatureRH === 'texte' ? 'bg-primary text-white' : 'bg-background hover:bg-muted'}`}>{t('docView.jeCertifieOnglet')}</button>
                    </div>
                  </div>
                  {modeSignatureRH === 'pad' ? (
                    <SignaturePad onChange={setSignatureRHDataUrl} />
                  ) : (
                    <div className='flex flex-col gap-2'>
                      <input
                        type='text'
                        placeholder={t('docView.tapezNomComplet')}
                        className='input input-bordered input-sm w-full bg-background'
                        value={signatureRHTexte}
                        onChange={(e) => setSignatureRHTexte(e.target.value)}
                      />
                      <label className='flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer'>
                        <input type='checkbox' checked={certifieRH} onChange={(e) => setCertifieRH(e.target.checked)} className='accent-primary' />
                        {t('docView.jeCertifieExactitude')}
                      </label>
                    </div>
                  )}
                  <p className='text-[11px] text-muted-foreground mt-2'>
                    {t('docView.validerRejeterInfo')}
                  </p>
                </div>
              )}
              {estDemandePaie && transitionsPossibles.includes('VALIDE_ET_TRAITE') && (
                <div className='mb-2'>
                  <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('docView.ficheDePaieAEnvoyer')}</label>
                  <input
                    type='file'
                    accept='application/pdf'
                    onChange={(e) => setFichierPaie(e.target.files?.[0] || null)}
                    className='file-input file-input-bordered file-input-sm w-full bg-background'
                  />
                  <p className='text-[11px] text-muted-foreground mt-1.5'>
                    {t('docView.marquerValideTraiteInfoPaie')}
                  </p>
                </div>
              )}
              {estReclamation && transitionsPossibles.includes('VALIDE_ET_TRAITE') && (
                <div className='mb-2 flex flex-col gap-2'>
                  <div>
                    <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('docView.suiviPar')}</label>
                    <input
                      type='text'
                      value={suiviPar}
                      onChange={(e) => setSuiviPar(e.target.value)}
                      placeholder={t('docView.exempleSuiviPar')}
                      className='input input-bordered input-sm w-full bg-background'
                    />
                  </div>
                  <div>
                    <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('docView.delaiReclamation')}</label>
                    <input
                      type='text'
                      value={delaiReclamation}
                      onChange={(e) => setDelaiReclamation(e.target.value)}
                      placeholder={t('docView.exempleDelai')}
                      className='input input-bordered input-sm w-full bg-background'
                    />
                  </div>
                  <div>
                    <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('docView.actionsCorrectives')}</label>
                    <textarea
                      value={actionsCorrectives}
                      onChange={(e) => setActionsCorrectives(e.target.value)}
                      placeholder={t('docView.placeholderActionsCorrectives')}
                      className='textarea textarea-bordered textarea-sm w-full bg-background'
                      rows={3}
                    />
                  </div>
                  <p className='text-[11px] text-muted-foreground'>
                    {t('docView.marquerValideTraiteInfoReclamation')}
                  </p>
                </div>
              )}
              {transitionsPossibles.includes('TRANSMIS_AU_SERVICE') && (
                <div className='mb-2'>
                  <label className='block text-xs font-medium text-muted-foreground mb-1'>{t('docView.transmettreAQuelService')}</label>
                  <select
                    value={serviceChoisi}
                    onChange={(e) => setServiceChoisi(e.target.value)}
                    className='select select-bordered select-sm w-full bg-background'
                  >
                    <option value=''>{t('docView.selectionnerServiceOption')}</option>
                    {servicesMetier.map((s) => (
                      <option key={s.id} value={s.id}>{s.nom_service}</option>
                    ))}
                  </select>
                  <p className='text-[11px] text-muted-foreground mt-1.5'>
                    {t('docView.membresServiceRecevront')}
                  </p>
                </div>
              )}
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder={t('docView.motifOptionnel')}
                className='textarea textarea-bordered textarea-sm w-full mb-2 bg-background'
              />
              <div className='flex flex-col gap-2'>
                {transitionsPossibles.map((statut) => {
                  const { classes, icon: Icon } = getStatutStyle(statut);
                  return (
                    <button
                      key={statut}
                      disabled={transitioning}
                      onClick={() => doTransition(statut)}
                      className={`btn btn-sm justify-start gap-2 border-0 hover:opacity-90 ${classes}`}
                    >
                      {Icon && <Icon size={14} />}
                      {STATUT_LABELS[statut] ? t(STATUT_LABELS[statut]) : statut}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

export default DocView
