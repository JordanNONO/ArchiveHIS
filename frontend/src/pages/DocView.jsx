import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { consultationDocument, getDocument, getDocumentLienFichier, getVersionLienFichier, getDocumentMeta, getDocumentHistorique, getDocumentConsultations, getDocumentVersions, uploadNewVersion, transitionDocument, updateDocument } from '../api/routes/document';
import { demarrerSuiviDelai, avancerSuiviDelai, cloturerSuiviDelai } from '../api/routes/suiviDelai';
import { getCategorie } from '../api/routes/categorie';
import { getTypeDocuments } from '../api/routes/typeDocument';
import Loading from '../components/Loading';
import Breadcrumbs from '../components/Breadcrumbs';
import DocxReader from '../plugins/DocxReader';
/* import ExcelReader from '../plugins/ExcelReader';
import PptxReader from '../plugins/PptxReader'; */
import InvalideFormat from '../components/InvalideFormat';
import StatutBadge, { STATUT_LABELS, STATUT_TRANSITIONS, getStatutStyle } from '../components/StatutBadge';
import { usePermissions } from '../hooks/usePermissions';
import { alerteDelaiLabel } from '../utils/common';
import { toast } from 'react-toastify';
import { LuFolderOpen, LuPencil, LuX, LuCheck, LuUploadCloud, LuDownload, LuTimer, LuArrowRight, LuCircleSlash } from 'react-icons/lu';
import echo from '../utils/echo';

const NIVEAU_CONFIDENTIALITE_LABELS = {
  PUBLIC: 'Public',
  INTERNE: 'Interne',
  CONFIDENTIEL: 'Confidentiel',
  STRICTEMENT_CONFIDENTIEL: 'Strictement confidentiel',
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
    const {id,type} = useParams();
    const navigate = useNavigate();
    const [lienFichier, setLienFichier] = useState(null)
    const [loading,setLoading] = useState(false)
    const [meta, setMeta] = useState(null)
    const [historique, setHistorique] = useState([])
    const [consultations, setConsultations] = useState([])
    const [versions, setVersions] = useState([])
    const [uploadingVersion, setUploadingVersion] = useState(false)
    const [motif, setMotif] = useState('')
    const [transitioning, setTransitioning] = useState(false)
    const [suiviEnCours, setSuiviEnCours] = useState(false)
    const [editingDossier, setEditingDossier] = useState(false)
    const [categories, setCategories] = useState([])
    const [typesForCategorie, setTypesForCategorie] = useState([])
    const [dossierForm, setDossierForm] = useState({ category_id: '', type_document_id: '' })
    const [savingDossier, setSavingDossier] = useState(false)
    const [activeTab, setActiveTab] = useState('details')
    const [pagesLiees, setPagesLiees] = useState([])
    const { hasPermission, isAdministrator, role } = usePermissions();
    const canValidate = isAdministrator || hasPermission('valider_documents');
    const canManageDocument = isAdministrator || hasPermission('archiver_documents');
    // Un compte "dépôt" (intervenant, bénéficiaire) n'a pas à connaître le
    // détail du circuit de validation interne — voir StatutBadge.
    const estCompteDepot = ['Intervenant', 'Beneficiaire'].includes(role);

    function getDoc(){
        setLoading(true)
        getDocumentLienFichier(id).then(async(res)=>{
            if (res.status ===200) {
                const data = await res.json()
                consultationDocument({document_id:id}).catch(()=>{})
                setLienFichier(data)
            }
            setLoading(false)
        }).catch(function(err){
            console.log(err)
            setLoading(false)
        })
    }

    function fetchMeta(){
        getDocumentMeta(id).then(async (res) => {
            if (res.status === 200) {
                const data = await res.json()
                setMeta(data)
                fetchPagesLiees(data.code_reference)
            }
        }).catch((err) => console.log(err))
    }

    // Un dépôt multi-pages (scanner, ou plusieurs fichiers ajoutés d'un coup)
    // crée un document par page, chacun avec une référence du type
    // "DEPOT-<horodatage>-<n>" — voir EspaceDossier.jsx. On retrouve les pages
    // sœurs par ce préfixe commun pour permettre de naviguer entre elles.
    function fetchPagesLiees(reference){
        const correspondance = typeof reference === 'string' ? reference.match(/^(.*)-(\d+)$/) : null
        if (!correspondance) {
            setPagesLiees([])
            return
        }
        const prefixeEchappe = correspondance[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const motif = new RegExp(`^${prefixeEchappe}-(\\d+)$`)
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
            setPagesLiees(pages.length > 1 ? pages : [])
        }).catch(() => {})
    }

    function fetchHistorique(){
        getDocumentHistorique(id).then(async (res) => {
            if (res.status === 200) {
                setHistorique(await res.json())
            }
        }).catch((err) => console.log(err))
    }

    function fetchConsultations(){
        getDocumentConsultations(id).then(async (res) => {
            if (res.status === 200) {
                setConsultations(await res.json())
            }
        }).catch((err) => console.log(err))
    }

    function fetchVersions(){
        getDocumentVersions(id).then(async (res) => {
            if (res.status === 200) {
                setVersions(await res.json())
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
                toast.error('Le téléchargement a échoué')
            }
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
        }
    }

    async function onReplaceFile(e){
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            setUploadingVersion(true)
            const res = await uploadNewVersion(id, file)
            if (res.status === 200) {
                toast.success('Fichier remplacé, ancienne version conservée')
                fetchVersions()
                fetchMeta()
                getDoc()
            } else {
                const data = await res.json()
                toast.error(data?.error || 'Le remplacement a échoué')
            }
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
        } finally {
            setUploadingVersion(false)
        }
    }

    useEffect(() => {
      getDoc()
      fetchMeta()
      fetchHistorique()
      fetchConsultations()
      fetchVersions()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

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
    }, [id])

    async function doTransition(nouveauStatut){
        try {
            setTransitioning(true)
            const res = await transitionDocument(id, { nouveau_statut: nouveauStatut, motif: motif || undefined })
            if (res.status === 200) {
                toast.success('Statut mis à jour')
                setMotif('')
                fetchMeta()
                fetchHistorique()
            } else {
                const data = await res.json()
                toast.error(data?.error || 'Transition non autorisée')
            }
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
        } finally {
            setTransitioning(false)
        }
    }

    async function doDemarrerSuivi(){
        try {
            setSuiviEnCours(true)
            const res = await demarrerSuiviDelai(id)
            if (res.status === 201) {
                toast.success('Suivi de délai démarré')
                fetchMeta()
            } else {
                const data = await res.json()
                toast.error(data?.error || "Impossible de démarrer le suivi")
            }
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
        } finally {
            setSuiviEnCours(false)
        }
    }

    async function doAvancerSuivi(){
        try {
            setSuiviEnCours(true)
            const res = await avancerSuiviDelai(meta.suivi_delai_actif.id)
            if (res.status === 201) {
                toast.success('Étape suivante démarrée')
            } else if (res.status === 200) {
                toast.success('Procédure terminée')
            } else {
                const data = await res.json()
                toast.error(data?.error || "Impossible d'avancer l'étape")
            }
            fetchMeta()
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
        } finally {
            setSuiviEnCours(false)
        }
    }

    async function doCloturerSuivi(){
        try {
            setSuiviEnCours(true)
            const res = await cloturerSuiviDelai(meta.suivi_delai_actif.id)
            if (res.status === 200) {
                toast.success('Suivi clôturé')
                fetchMeta()
            } else {
                const data = await res.json()
                toast.error(data?.error || 'Impossible de clôturer le suivi')
            }
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
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
            toast.error('Choisissez une catégorie');
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
                toast.success('Dossier mis à jour')
                setEditingDossier(false)
                fetchMeta()
            } else {
                const data = await res.json()
                toast.error(data?.error || 'Mise à jour du dossier impossible')
            }
        } catch (error) {
            console.log(error)
            toast.error('Une erreur est survenue')
        } finally {
            setSavingDossier(false)
        }
    }

    const ReadFile = () => {
      if (!lienFichier) return null;
      const fileExtension = type;
      switch (fileExtension) {
        case 'pdf':
          return  <iframe src={lienFichier.affichage} className='w-full h-[70vh] lg:h-[90vh]' frameborder="0"></iframe>;
        case 'doc':
        case 'docx':
          return <DocxReader fileUrl={lienFichier.affichage}/>
        case 'jpg':
        case 'jpeg':
        case 'png':
          return <img src={lienFichier.affichage} alt={meta?.titre_document} className='w-full max-h-[70vh] lg:max-h-[90vh] object-contain rounded-lg bg-muted' />;
        case 'txt':
          return <iframe src={lienFichier.affichage} className='w-full h-[70vh] lg:h-[90vh] bg-white rounded-lg border border-border' frameborder="0"></iframe>;
        case 'xls':
        case 'xlsx':
        case 'csv':
          return <InvalideFormat href={lienFichier.telechargement}/>
        case 'ppt':
        case 'pptx':
          return <InvalideFormat href={lienFichier.telechargement} />;
        default:
          return <InvalideFormat href={lienFichier.telechargement}/>;
      }
    };

    const transitionsPossibles = meta?.status_doc ? (STATUT_TRANSITIONS[meta.status_doc] || []) : [];

  return loading? <Loading/>:(
    <div className='flex flex-col w-full gap-4 py-4'>
      <div className='flex items-center justify-between gap-2'>
        <Breadcrumbs where={meta?.titre_document || 'Document'} />
        <button
          onClick={() => navigate(-1)}
          className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0'
        >
          <LuX size={14} />
          Fermer
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
          Télécharger
        </a>
      </div>

      {pagesLiees.length > 1 && (
        <div className='flex items-center gap-2 flex-wrap'>
          <span className='text-xs text-muted-foreground'>Pages de ce dépôt :</span>
          <div className='flex items-center gap-1.5 flex-wrap'>
            {pagesLiees.map((p) => (
              <button
                key={p.id}
                onClick={() => String(p.id) !== id && navigate(`/view/${p.id}/${p.extension}`)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  String(p.id) === id ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted'
                }`}
              >
                Page {p.page}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className='flex flex-col lg:flex-row w-full gap-5 items-start'>
      <div className='flex-grow min-w-0 rounded-2xl border border-border bg-card p-3 overflow-hidden'>
        {<ReadFile/>}
      </div>
      <div className='w-full lg:w-80 lg:flex-shrink-0 flex flex-col gap-5'>

        <div className='rounded-2xl border border-border bg-card overflow-hidden'>
          <div className='flex items-center gap-1 p-1.5 border-b border-border bg-muted/40'>
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${activeTab === 'details' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Détails
            </button>
            <button
              onClick={() => setActiveTab('historique')}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${activeTab === 'historique' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Historique
            </button>
            <button
              onClick={() => setActiveTab('activite')}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${activeTab === 'activite' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Activité
            </button>
            <button
              onClick={() => setActiveTab('versions')}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${activeTab === 'versions' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Versions
            </button>
          </div>

          {activeTab === 'details' && (
            <div className='p-4'>
              <div className='flex items-center justify-between mb-1.5'>
                <p className='text-xs text-muted-foreground'>Dossier</p>
                {canManageDocument && !editingDossier && (
                  <button className='text-muted-foreground hover:text-foreground' onClick={openEditDossier} title="Changer de dossier">
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
                    <option value=''>Choisir une catégorie</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.libelle_cat}</option>
                    ))}
                  </select>
                  <select
                    className='select select-bordered select-sm w-full'
                    value={dossierForm.type_document_id}
                    onChange={(e) => setDossierForm((f) => ({ ...f, type_document_id: e.target.value }))}
                    disabled={!dossierForm.category_id}
                  >
                    <option value=''>Aucun sous-dossier</option>
                    {typesForCategorie.map((t) => (
                      <option key={t.id} value={t.id}>{t.libelle}</option>
                    ))}
                  </select>
                  <div className='flex gap-2 justify-end'>
                    <button className='btn btn-sm btn-ghost' onClick={() => setEditingDossier(false)} disabled={savingDossier}>
                      <LuX size={14} /> Annuler
                    </button>
                    <button className='btn btn-sm bg-primary text-white hover:bg-primary' onClick={saveDossier} disabled={savingDossier}>
                      <LuCheck size={14} /> Enregistrer
                    </button>
                  </div>
                </div>
              ) : (
                <div className='flex items-center gap-2 text-sm font-medium pb-4 mb-4 border-b border-border'>
                  <LuFolderOpen size={14} className='flex-shrink-0 text-muted-foreground' />
                  <span className='truncate'>
                    {meta?.categorie_document?.libelle_cat || '—'}
                    {meta?.type_document?.libelle ? ` / ${meta.type_document.libelle}` : ''}
                  </span>
                </div>
              )}

              <div className='grid grid-cols-2 gap-x-4 gap-y-3.5'>
                <div>
                  <p className='text-xs text-muted-foreground'>Auteur</p>
                  <p className='text-sm font-medium truncate'>{meta?.auteur || '—'}</p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Référence</p>
                  <p className='text-sm font-medium truncate'>{meta?.code_reference || '—'}</p>
                </div>
                {nomConcerne(meta) && nomConcerne(meta) !== meta?.auteur && (
                  <div>
                    <p className='text-xs text-muted-foreground'>Concerné</p>
                    <p className='text-sm font-medium truncate'>{nomConcerne(meta)}</p>
                  </div>
                )}
                <div>
                  <p className='text-xs text-muted-foreground'>Taille</p>
                  <p className='text-sm font-medium truncate'>{formatTaille(meta?.taille) || '—'}</p>
                </div>
                <div>
                  <p className='text-xs text-muted-foreground'>Date du document</p>
                  <p className='text-sm font-medium truncate'>{meta?.file_create_date || '—'}</p>
                </div>
                {meta?.date_archivage && (
                  <div>
                    <p className='text-xs text-muted-foreground'>Archivé le</p>
                    <p className='text-sm font-medium truncate'>{new Date(meta.date_archivage).toLocaleDateString()}</p>
                  </div>
                )}
                {meta?.niveau_confidentialite && (
                  <div>
                    <p className='text-xs text-muted-foreground'>Confidentialité</p>
                    <p className='text-sm font-medium truncate'>{NIVEAU_CONFIDENTIALITE_LABELS[meta.niveau_confidentialite] || meta.niveau_confidentialite}</p>
                  </div>
                )}
              </div>

              {meta?.resume && (
                <div className='mt-4 pt-4 border-t border-border'>
                  <p className='text-xs text-muted-foreground mb-1'>Résumé</p>
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
                          {STATUT_LABELS[h.nouveau_statut] || h.nouveau_statut}
                        </div>
                        <div className='text-muted-foreground text-xs mt-0.5'>
                          {new Date(h.date_changement).toLocaleString()}
                        </div>
                        {h.motif_changement && <div className='text-xs mt-1 text-foreground/80 break-words'>{h.motif_changement}</div>}
                      </div>
                    </li>
                  );
                })}
                {historique.length === 0 && <li className='text-sm text-muted-foreground'>Aucun historique</li>}
              </ul>
            </div>
          )}

          {activeTab === 'activite' && (
            <div className='p-4'>
              <p className='text-xs text-muted-foreground mb-3'>Personnes ayant consulté ce document</p>
              <ul className='flex flex-col gap-3'>
                {consultations.map((c) => {
                  const p = c.user?.personnels?.[0];
                  const nomAffiche = p ? `${p.prenom || ''} ${p.nom || ''}`.trim() : (c.user?.nom || 'Utilisateur');
                  return (
                    <li key={c.id} className='flex items-center gap-2.5 text-sm'>
                      <span className='flex-shrink-0 w-7 h-7 rounded-full bg-secondary/10 text-secondary text-xs font-semibold flex items-center justify-center'>
                        {nomAffiche.slice(0, 1).toUpperCase()}
                      </span>
                      <div className='min-w-0'>
                        <div className='font-medium truncate'>{nomAffiche}</div>
                        <div className='text-muted-foreground text-xs'>{new Date(c.created_at).toLocaleString()}</div>
                      </div>
                    </li>
                  );
                })}
                {consultations.length === 0 && <li className='text-sm text-muted-foreground'>Aucune consultation enregistrée</li>}
              </ul>
            </div>
          )}

          {activeTab === 'versions' && (
            <div className='p-4'>
              {canManageDocument && (
                <label className={`flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm font-medium mb-4 cursor-pointer transition-colors ${uploadingVersion ? 'opacity-60 pointer-events-none' : 'hover:bg-muted'}`}>
                  <LuUploadCloud size={15} />
                  {uploadingVersion ? 'Envoi en cours...' : 'Remplacer le fichier'}
                  <input type="file" className='hidden' onChange={onReplaceFile} disabled={uploadingVersion} />
                </label>
              )}
              <ul className='flex flex-col gap-3'>
                {versions.map((v) => {
                  const p = v.utilisateur?.personnels?.[0];
                  const nomAffiche = p ? `${p.prenom || ''} ${p.nom || ''}`.trim() : (v.utilisateur?.nom || 'Utilisateur');
                  return (
                    <li key={v.id} className='flex items-center justify-between gap-2 text-sm border border-border rounded-lg px-3 py-2'>
                      <div className='min-w-0'>
                        <div className='font-medium truncate'>Version {v.numero_version}</div>
                        <div className='text-muted-foreground text-xs truncate'>{nomAffiche} — {new Date(v.created_at).toLocaleString()}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDownloadVersion(v.id)}
                        className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0'
                        title="Télécharger cette version"
                      >
                        <LuDownload size={15} />
                      </button>
                    </li>
                  );
                })}
                {versions.length === 0 && <li className='text-sm text-muted-foreground'>Aucune version antérieure</li>}
              </ul>
            </div>
          )}

          {(meta?.suivi_delai_actif || canManageDocument) && (
            <div className='p-4 border-t border-border'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5'>
                <LuTimer size={13} /> Suivi de délai
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
                        <LuArrowRight size={14} /> Étape suivante
                      </button>
                      <button disabled={suiviEnCours} onClick={doCloturerSuivi} className='btn btn-sm btn-ghost gap-1.5' title="Clôturer sans passer à l'étape suivante">
                        <LuCircleSlash size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ) : canManageDocument ? (
                <button disabled={suiviEnCours} onClick={doDemarrerSuivi} className='btn btn-sm w-full gap-1.5 border-border'>
                  <LuTimer size={14} /> Démarrer le suivi de délai
                </button>
              ) : null}
            </div>
          )}

          {canValidate && transitionsPossibles.length > 0 && (
            <div className='p-4 border-t border-border bg-primary/5'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-primary mb-3'>Faire évoluer le statut</h3>
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Motif (optionnel)"
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
                      {STATUT_LABELS[statut] || statut}
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
