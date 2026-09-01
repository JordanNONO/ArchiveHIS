import React, { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { LuMailPlus, LuSend, LuUploadCloud, LuInbox, LuCalendarClock, LuUsers, LuFileText, LuClipboardCheck } from 'react-icons/lu'
import { createDocument } from '../api/routes/document'
import { getCategorie } from '../api/routes/categorie'
import { getTypeDocuments } from '../api/routes/typeDocument'
import { getFormData, genererReferenceAuto, getDisplayName } from '../utils/common'
import { genererPdfCourrierSortant } from '../utils/courrierPdf'
import { WizardChoiceCard } from './wizard/Wizard'
import FilePreviewCard from './FilePreviewCard'
import FileContentPreview from './FileContentPreview'
import DestinatairesNotificationField from './DestinatairesNotificationField'

const INPUT_CLASS = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
const LABEL_CLASS = 'block text-sm font-medium mb-1.5'

const TYPES_ENVOI_SORTANT = ['Courrier simple', 'Lettre recommandée', 'LRAR+CS', 'LRAR+CS+Mail', 'Colis', 'Courrier simple+mail']
const ETATS_COURRIER = ['En attente', 'Payé', 'N/C']

const FORM_VIDE = {
  typeEnvoi: '', numeroRecommande: '', nombreDocuments: '', dateEnvoi: '', dateReception: '',
  auteur: '', destinataire: '', adresse: '', expediteurNom: '', expediteurAdresse: '',
  objet: '', contenu: '', montant: '', etatCourrier: '', deadline: '',
  destinataires_mode: 'tous', destinataires_ids: [],
}

/** En-tête de section réutilisé pour chaque groupe de champs — même vocabulaire visuel (icône + libellé en majuscule) que WizardStepHeader, sans le shell complet du wizard (formulaire dense, pas un parcours séquentiel). */
function SectionTitre({ icon: Icon, children }) {
  return (
    <p className='flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-primary mt-1'>
      <Icon size={13} /> {children}
    </p>
  )
}

/**
 * "Nouveau courrier" — remplace le suivi fait jusqu'ici sur Google Sheets.
 * Deux dossiers réels existent déjà en base sous la catégorie ADMIN_DOC
 * (code 'ContratDossier') : "COURRIERS ENTRANTS" / "COURRIERS SORTANTS" —
 * on résout leurs vrais id une fois à l'ouverture, comme resoudreDestinationDemande()
 * le fait pour Congés/Réclamation (voir constants/typesDemande.js), pour ne
 * jamais dépendre d'un id figé qui changerait d'un environnement à l'autre.
 */
function CourrierForm({ dialogId = 'nouveauCourrier', onArchive }) {
  const { t } = useTranslation()
  const currentUserName = getDisplayName(JSON.parse(sessionStorage.getItem('user') || '{}'))
  const [sens, setSens] = useState(null)
  const [form, setForm] = useState(FORM_VIDE)
  const [fichier, setFichier] = useState(null)
  const [destination, setDestination] = useState(null)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)

  useEffect(() => {
    getCategorie().then(async (res) => {
      if (!res.ok) return
      const categories = await res.json()
      const categorie = categories.find((c) => c.code === 'ContratDossier')
      if (!categorie) return
      const resTypes = await getTypeDocuments(categorie.id)
      if (!resTypes.ok) return
      const types = await resTypes.json()
      const typeEntrant = types.find((t) => t.libelle === 'COURRIERS ENTRANTS')
      const typeSortant = types.find((t) => t.libelle === 'COURRIERS SORTANTS')
      setDestination({ categorieId: categorie.id, typeEntrantId: typeEntrant?.id, typeSortantId: typeSortant?.id })
    }).catch(() => {})
  }, [])

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles[0]) setFichier(acceptedFiles[0])
  }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    multiple: false,
  })

  function reinitialiser() {
    setSens(null)
    setForm(FORM_VIDE)
    setFichier(null)
  }

  function choisirSens(valeur) {
    const aujourdHui = new Date().toISOString().slice(0, 10)
    setForm({
      ...FORM_VIDE,
      dateEnvoi: aujourdHui,
      dateReception: aujourdHui,
      auteur: currentUserName,
      etatCourrier: valeur === 'entrant' ? 'En attente' : '',
    })
    setSens(valeur)
  }

  function fermerModal() {
    document.getElementById(dialogId)?.close()
    reinitialiser()
  }

  async function envoyer(e) {
    e.preventDefault()
    if (!destination || !destination.typeEntrantId || !destination.typeSortantId) {
      toast.error(t('courrier.dossierIndisponible'))
      return
    }
    if (sens === 'entrant' && !fichier) {
      toast.warning(t('courrier.fichierObligatoire'))
      return
    }

    setEnvoiEnCours(true)
    try {
      const typeDocumentId = sens === 'entrant' ? destination.typeEntrantId : destination.typeSortantId
      const reference = genererReferenceAuto(sens === 'entrant' ? 'CRE' : 'CRS', 0)
      const titre = `${sens === 'entrant' ? t('courrier.courrierEntrant') : t('courrier.courrierSortant')} — ${form.objet || reference}`

      let fichierAEnvoyer = fichier
      if (sens === 'sortant') {
        const blob = await genererPdfCourrierSortant({
          reference, typeEnvoi: form.typeEnvoi, numeroRecommande: form.numeroRecommande,
          nombreDocuments: form.nombreDocuments, dateEnvoi: form.dateEnvoi, auteur: form.auteur,
          destinataire: form.destinataire, adresse: form.adresse, objet: form.objet, contenu: form.contenu,
        })
        // Un scan optionnel reste possible (dropzone affichée aussi pour le
        // sortant) — dans ce cas c'est lui qui prime sur la fiche générée,
        // qui reste alors uniquement le résumé archivé.
        fichierAEnvoyer = fichier || new File([blob], `${titre}.pdf`, { type: 'application/pdf' })
      }

      const res = await createDocument({
        category_id: destination.categorieId,
        type_document_id: typeDocumentId,
        titre,
        auteur: form.auteur || currentUserName,
        resume: form.contenu,
        objet: form.objet,
        reference,
        file_create_date: Date.now(),
        sens_courrier: sens,
        type_envoi: form.typeEnvoi,
        numero_recommande: sens === 'sortant' ? form.numeroRecommande : undefined,
        nombre_documents: form.nombreDocuments || undefined,
        date_envoi: form.dateEnvoi || undefined,
        date_reception: sens === 'entrant' ? form.dateReception : undefined,
        expediteur_nom: sens === 'entrant' ? form.expediteurNom : undefined,
        expediteur_adresse: sens === 'entrant' ? form.expediteurAdresse : undefined,
        destinataire_nom: form.destinataire,
        destinataire_adresse: form.adresse,
        montant: sens === 'entrant' ? (form.montant || undefined) : undefined,
        etat_courrier: sens === 'entrant' ? form.etatCourrier : undefined,
        deadline_courrier: sens === 'entrant' ? (form.deadline || undefined) : undefined,
        // Sortant : personne à prévenir par défaut (juste un enregistrement de
        // suivi, pas d'action attendue de qui que ce soit) — sans ce choix
        // explicite, le backend retomberait sur "tous" par défaut (voir
        // DocumentController::store()), ce qui notifierait tout le personnel
        // à chaque courrier sortant archivé.
        destinataires_mode: sens === 'entrant' ? form.destinataires_mode : 'aucune',
        destinataires_ids: sens === 'entrant' ? form.destinataires_ids : undefined,
      }, fichierAEnvoyer)

      if (res.status !== 201) {
        toast.error(t('courrier.enregistrementEchoue'))
        return
      }

      toast.success(t('courrier.courrierEnregistre'))
      fermerModal()
      onArchive && onArchive()
    } catch (error) {
      console.log(error)
      toast.error(t('courrier.enregistrementEchoue'))
    } finally {
      setEnvoiEnCours(false)
    }
  }

  return (
    <dialog id={dialogId} className='modal' onClose={reinitialiser}>
      <div className='modal-box w-11/12 max-w-xl rounded-2xl max-h-[85vh] overflow-y-auto'>
        <div className='flex items-center justify-between mb-1'>
          <h3 className='text-lg font-semibold flex items-center gap-2'>
            <LuMailPlus className='text-primary' /> {t('courrier.nouveauCourrier')}
          </h3>
          <form method='dialog'>
            <button className='btn btn-sm btn-ghost btn-circle' onClick={reinitialiser}>✕</button>
          </form>
        </div>

        {!sens ? (
          <div className='flex flex-col gap-2.5 py-3'>
            <p className='text-sm text-muted-foreground mb-1'>{t('courrier.choisirSens')}</p>
            <WizardChoiceCard icon={LuInbox} label={t('courrier.courrierEntrant')} picked={false} onClick={() => choisirSens('entrant')} />
            <WizardChoiceCard icon={LuSend} label={t('courrier.courrierSortant')} picked={false} onClick={() => choisirSens('sortant')} delayMs={60} />
          </div>
        ) : (
          <form onSubmit={envoyer} className='flex flex-col gap-3 py-2'>
            <div className='flex items-center justify-between'>
              <span className='inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1'>
                {sens === 'entrant' ? <LuInbox size={12} /> : <LuSend size={12} />}
                {sens === 'entrant' ? t('courrier.courrierEntrant') : t('courrier.courrierSortant')}
              </span>
              <button type='button' onClick={() => setSens(null)} className='text-xs text-muted-foreground hover:text-foreground'>
                {t('courrier.changerSens')}
              </button>
            </div>

            {sens === 'entrant' && (
              <div {...getRootProps()} className='relative border-2 border-dashed border-primary/30 hover:border-primary/50 p-3 rounded-xl transition-colors cursor-pointer flex flex-col gap-2'>
                <input {...getInputProps()} />
                {fichier ? (
                  <>
                    <FilePreviewCard file={fichier} onRemove={(e) => { e.stopPropagation(); setFichier(null) }} />
                    <FileContentPreview file={fichier} />
                  </>
                ) : (
                  <div className='flex items-center flex-col gap-2 justify-center py-6 text-center'>
                    <LuUploadCloud className='text-primary' size={32} />
                    <p className='text-sm font-medium'>{isDragActive ? t('openFolder.deposerFichierIci') : t('courrier.deposerScan')}</p>
                  </div>
                )}
              </div>
            )}

            <SectionTitre icon={LuCalendarClock}>{t('courrier.sectionEnvoi')}</SectionTitre>
            <div className='rounded-xl border border-border/70 p-3.5 flex flex-col gap-3'>
              <div className='grid grid-cols-2 gap-3'>
                {sens === 'entrant' && (
                  <div>
                    <label className={LABEL_CLASS}>{t('courrier.dateReception')} <span className='text-red-500'>*</span></label>
                    <input type='date' name='dateReception' value={form.dateReception} onChange={(e) => getFormData(e, setForm)} required className={INPUT_CLASS} />
                  </div>
                )}
                <div>
                  <label className={LABEL_CLASS}>{t('courrier.dateEnvoi')}</label>
                  <input type='date' name='dateEnvoi' value={form.dateEnvoi} onChange={(e) => getFormData(e, setForm)} className={INPUT_CLASS} />
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={LABEL_CLASS}>{t('courrier.typeEnvoi')} <span className='text-red-500'>*</span></label>
                  {sens === 'sortant' ? (
                    <select name='typeEnvoi' value={form.typeEnvoi} onChange={(e) => getFormData(e, setForm)} required className={INPUT_CLASS}>
                      <option value='' disabled>—</option>
                      {TYPES_ENVOI_SORTANT.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : (
                    <input type='text' name='typeEnvoi' value={form.typeEnvoi} onChange={(e) => getFormData(e, setForm)} required className={INPUT_CLASS} />
                  )}
                </div>
                <div>
                  <label className={LABEL_CLASS}>{t('courrier.nombreDocuments')}</label>
                  <input type='number' min='0' name='nombreDocuments' value={form.nombreDocuments} onChange={(e) => getFormData(e, setForm)} className={INPUT_CLASS} />
                </div>
              </div>
              {sens === 'sortant' && (
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label className={LABEL_CLASS}>{t('courrier.numeroRecommande')}</label>
                    <input type='text' name='numeroRecommande' value={form.numeroRecommande} onChange={(e) => getFormData(e, setForm)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>{t('courrier.auteurCourrier')}</label>
                    <input type='text' name='auteur' value={form.auteur} onChange={(e) => getFormData(e, setForm)} className={INPUT_CLASS} />
                  </div>
                </div>
              )}
            </div>

            <SectionTitre icon={LuUsers}>{t('courrier.sectionCorrespondant')}</SectionTitre>
            <div className='rounded-xl border border-border/70 p-3.5 flex flex-col gap-3'>
              {sens === 'entrant' && (
                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label className={LABEL_CLASS}>{t('courrier.expediteur')}</label>
                    <input type='text' name='expediteurNom' value={form.expediteurNom} onChange={(e) => getFormData(e, setForm)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>{t('courrier.adresseExpediteur')}</label>
                    <input type='text' name='expediteurAdresse' value={form.expediteurAdresse} onChange={(e) => getFormData(e, setForm)} className={INPUT_CLASS} />
                  </div>
                </div>
              )}
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className={LABEL_CLASS}>{t('courrier.destinataire')} <span className='text-red-500'>*</span></label>
                  <input type='text' name='destinataire' value={form.destinataire} onChange={(e) => getFormData(e, setForm)} required className={INPUT_CLASS} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>{t('courrier.adresse')}</label>
                  <input type='text' name='adresse' value={form.adresse} onChange={(e) => getFormData(e, setForm)} className={INPUT_CLASS} />
                </div>
              </div>
            </div>

            <SectionTitre icon={LuFileText}>{t('courrier.sectionContenu')}</SectionTitre>
            <div className='rounded-xl border border-border/70 p-3.5 flex flex-col gap-3'>
              <div>
                <label className={LABEL_CLASS}>{t('courrier.objet')} <span className='text-red-500'>*</span></label>
                <input type='text' name='objet' value={form.objet} onChange={(e) => getFormData(e, setForm)} required className={INPUT_CLASS} />
              </div>
              <div>
                <label className={LABEL_CLASS}>{t('courrier.contenu')}</label>
                <textarea name='contenu' value={form.contenu} onChange={(e) => getFormData(e, setForm)} rows={3} className={INPUT_CLASS} />
              </div>
            </div>

            {sens === 'entrant' && (
              <>
                <SectionTitre icon={LuClipboardCheck}>{t('courrier.sectionSuivi')}</SectionTitre>
                <div className='rounded-xl border border-border/70 p-3.5 flex flex-col gap-3'>
                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <label className={LABEL_CLASS}>{t('courrier.montant')}</label>
                      <input type='number' min='0' step='0.01' name='montant' value={form.montant} onChange={(e) => getFormData(e, setForm)} className={INPUT_CLASS} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>{t('courrier.deadline')}</label>
                      <input type='date' name='deadline' value={form.deadline} onChange={(e) => getFormData(e, setForm)} className={INPUT_CLASS} />
                    </div>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>{t('courrier.etat')} <span className='text-red-500'>*</span></label>
                    <select name='etatCourrier' value={form.etatCourrier} onChange={(e) => getFormData(e, setForm)} required className={INPUT_CLASS}>
                      <option value='' disabled>—</option>
                      {ETATS_COURRIER.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <DestinatairesNotificationField
                  mode={form.destinataires_mode}
                  selectionIds={form.destinataires_ids}
                  onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                />
              </>
            )}

            <button
              type='submit'
              disabled={envoiEnCours}
              className='mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-60'
            >
              <LuSend size={15} /> {envoiEnCours ? t('courrier.enregistrementEnCours') : t('courrier.enregistrer')}
            </button>
          </form>
        )}
      </div>
      <form method='dialog' className='modal-backdrop'>
        <button onClick={reinitialiser}>close</button>
      </form>
    </dialog>
  )
}

export default CourrierForm
