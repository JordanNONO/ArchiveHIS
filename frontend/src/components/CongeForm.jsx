import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { LuLoader2, LuSend, LuX } from 'react-icons/lu'
import SignaturePad from './SignaturePad'
import VoiceRecorder from './VoiceRecorder'
import { createDocument } from '../api/routes/document'
import { getBureaux } from '../api/routes/bureau'
import { getInitials } from '../utils/common'
import { genererPdfConges } from '../utils/congesPdf'
import { WizardSuccess, genererConfettis } from './wizard/Wizard'

// Valeurs volontairement laissées en français : incrustées telles quelles sur
// le vrai gabarit PDF officiel (congesPdf.js, entièrement en français, non
// traduit) et dans le résumé du document — seul le libellé affiché à l'écran
// change de langue (voir NATURES_LABEL_KEYS ci-dessous).
const NATURES = ['Payé', 'Sans solde', 'Évènement familial', 'Paternité', 'Autre']
const NATURES_LABEL_KEYS = {
  'Payé': 'conges.naturePaye',
  'Sans solde': 'conges.natureSansSolde',
  'Évènement familial': 'conges.natureEvenementFamilial',
  'Paternité': 'conges.naturePaternite',
  'Autre': 'conges.natureAutre',
}

const FORM_VIDE = {
  nomPrenom: '', fonction: '', adresse: '', telephone: '', email: '',
  du: '', au: '', nombreJours: '', dernierJour: '', reprise: '',
  nature: 'Payé', autreTexte: '', lieu: '', date: new Date().toISOString().slice(0, 10),
}

/**
 * Nombre de jours ouvrables entre deux dates incluses, dimanche exclu — même
 * calcul que celui déjà utilisé à la main sur le formulaire papier (ex: du 7 au
 * 24 décembre inclus = 18 jours calendaires - 2 dimanches = 16 jours ouvrables).
 * Reste modifiable ensuite (jours fériés, etc. non pris en compte ici).
 */
function joursOuvrablesEntre(duStr, auStr) {
  if (!duStr || !auStr) return ''
  const du = new Date(duStr)
  const au = new Date(auStr)
  if (au < du) return ''
  let compte = 0
  const curseur = new Date(du)
  while (curseur <= au) {
    if (curseur.getDay() !== 0) compte++
    curseur.setDate(curseur.getDate() + 1)
  }
  return compte
}

/**
 * Formulaire structuré de "Demande de congés" — remplace le dépôt de fichier
 * générique pour ce dossier précis (voir EspaceDossier.jsx) : les réponses sont
 * incrustées sur le vrai gabarit PDF de HIS (congesPdf.js) plutôt que déposées
 * comme une simple pièce jointe, pour que RH reçoive exactement le même document
 * qu'un formulaire papier rempli.
 *
 * Reste un formulaire classique tout-en-un (contrairement à ReclamationForm.jsx)
 * — seule la confirmation d'envoi reprend l'écran de succès animé partagé
 * (voir wizard/Wizard.jsx), à la demande explicite : pas de parcours en étapes ici.
 */
function CongeForm({ user, currentUserName, demande, destination, onEnvoye }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    ...FORM_VIDE,
    nomPrenom: currentUserName || '',
    adresse: user?.personnel?.lieu_residence || '',
    telephone: user?.personnel?.first_phone || '',
    email: user?.mail || '',
  })
  // Certains navigateurs (Firefox, Safari sans la reconnaissance vocale...)
  // enregistrent bien l'audio mais ne transcrivent jamais rien — sans ce
  // repli, l'envoi restait bloqué indéfiniment après un vocal sur "Autre".
  const [vocalFichierAutre, setVocalFichierAutre] = useState(null)
  const [modeSignature, setModeSignature] = useState('pad')
  const [signatureDataUrl, setSignatureDataUrl] = useState(null)
  const [signatureTexte, setSignatureTexte] = useState('')
  const [certifie, setCertifie] = useState(false)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [bureaux, setBureaux] = useState([])
  const [envoye, setEnvoye] = useState(false)
  const [confettis, setConfettis] = useState([])

  useEffect(() => {
    const auto = joursOuvrablesEntre(form.du, form.au)
    if (auto !== '') setForm((f) => ({ ...f, nombreJours: auto }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.du, form.au])

  // Le "Lieu" du formulaire est un des sièges/bureaux réels de HIS (Saint-Denis,
  // Nangis, Domont...) plutôt qu'un champ libre — voir BureauController, déjà
  // accessible à tout compte connecté (pas seulement le personnel interne).
  useEffect(() => {
    getBureaux().then(async (res) => res.ok && setBureaux(await res.json())).catch(() => {})
  }, [])

  function champ(nom) {
    return {
      value: form[nom],
      onChange: (e) => setForm((f) => ({ ...f, [nom]: e.target.value })),
    }
  }

  function reinitialiser() {
    setForm({
      ...FORM_VIDE,
      nomPrenom: currentUserName || '',
      adresse: user?.personnel?.lieu_residence || '',
      telephone: user?.personnel?.first_phone || '',
      email: user?.mail || '',
    })
    setSignatureDataUrl(null)
    setSignatureTexte('')
    setCertifie(false)
    setVocalFichierAutre(null)
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!form.du || !form.au) {
      toast.warning(t('conges.precisezPeriode'))
      return
    }
    if (form.nature === 'Autre' && !form.autreTexte.trim() && !vocalFichierAutre) {
      toast.warning(t('conges.precisezNature'))
      return
    }
    if (!form.lieu.trim()) {
      toast.warning(t('conges.precisezLieu'))
      return
    }
    const signatureOk = modeSignature === 'pad' ? !!signatureDataUrl : (signatureTexte.trim() && certifie)
    if (!signatureOk) {
      toast.warning(modeSignature === 'pad' ? t('conges.signezPave') : t('conges.indiquezNomCertification'))
      return
    }
    if (!destination) {
      toast.error(t('espaceDossier.dossierIndisponible'))
      return
    }

    try {
      setEnvoiEnCours(true)
      const blob = await genererPdfConges({
        nomPrenom: form.nomPrenom,
        fonction: form.fonction,
        adresse: form.adresse,
        telephone: form.telephone,
        email: form.email,
        du: new Date(form.du),
        au: new Date(form.au),
        nombreJours: form.nombreJours,
        dernierJour: form.dernierJour ? new Date(form.dernierJour) : null,
        reprise: form.reprise ? new Date(form.reprise) : null,
        nature: form.nature,
        autreTexte: form.autreTexte,
        lieu: form.lieu,
        date: new Date(form.date),
        signatureDataUrl: modeSignature === 'pad' ? signatureDataUrl : null,
        signatureTexte: modeSignature === 'texte' ? `${signatureTexte} (signature électronique certifiée)` : null,
      })

      const codePrefixe = `${demande.code}-${getInitials(currentUserName)}`
      const reference = `${codePrefixe}-${Date.now()}`
      const fichier = new File([blob], `${codePrefixe} — Demande de congés du ${form.du} au ${form.au}.pdf`, { type: 'application/pdf' })

      const res = await createDocument({
        category_id: destination.categorie_id,
        type_document_id: destination.type_document_id,
        titre: `${codePrefixe} — Demande de congés (${form.du} au ${form.au})`,
        auteur: currentUserName,
        nom_personne_concernee: currentUserName,
        resume: `Demande de congés (${form.nature}) du ${form.du} au ${form.au}, ${form.nombreJours} jour(s) ouvrable(s)`,
        reference,
        file_create_date: Date.now(),
      }, fichier)

      if (res.status === 201) {
        toast.success(t('conges.demandeEnvoyee'))
        reinitialiser()
        setConfettis(genererConfettis())
        setEnvoye(true)
        onEnvoye && onEnvoye()
      } else {
        toast.error(t('conges.envoiEchoue'))
      }
    } catch (error) {
      console.log(error)
      toast.error(t('reclamation.generationEchouee'))
    } finally {
      setEnvoiEnCours(false)
    }
  }

  if (envoye) {
    return (
      <div className='rounded-2xl border border-border bg-card p-5'>
        <WizardSuccess
          titre={t('conges.demandeEnvoyeeTitre')}
          sousTitre={t('conges.rhNotifie')}
          confettis={confettis}
          onReset={() => setEnvoye(false)}
          libelleReset={t('conges.nouvelleDemande')}
        />
      </div>
    )
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 accent-primary'
  const labelCls = 'block text-sm font-medium mb-1.5'

  return (
    <form onSubmit={onSubmit} className='rounded-2xl border border-border bg-card p-5 flex flex-col gap-5'>
      <div>
        <h2 className='text-sm font-semibold mb-3'>{t('conges.section1')}</h2>
        <div className='grid sm:grid-cols-2 gap-3'>
          <div>
            <label className={labelCls}>{t('conges.nomPrenom')} <span className='text-red-500'>*</span></label>
            <input type='text' required className={inputCls} {...champ('nomPrenom')} />
          </div>
          <div>
            <label className={labelCls}>{t('conges.fonction')} <span className='text-red-500'>*</span></label>
            <input type='text' required className={inputCls} {...champ('fonction')} />
          </div>
          <div className='sm:col-span-2'>
            <label className={labelCls}>{t('conges.adresse')} <span className='text-red-500'>*</span></label>
            <input type='text' required className={inputCls} {...champ('adresse')} />
          </div>
          <div>
            <label className={labelCls}>{t('conges.telephone')} <span className='text-red-500'>*</span></label>
            <input type='tel' required className={inputCls} {...champ('telephone')} />
          </div>
          <div>
            <label className={labelCls}>{t('conges.email')} <span className='text-red-500'>*</span></label>
            <input type='email' required className={inputCls} {...champ('email')} />
          </div>
        </div>
      </div>

      <div>
        <h2 className='text-sm font-semibold mb-3'>{t('conges.section2')}</h2>
        <div className='grid sm:grid-cols-2 gap-3'>
          <div>
            <label className={labelCls}>{t('conges.du')} <span className='text-red-500'>*</span></label>
            <input type='date' required className={inputCls} {...champ('du')} />
          </div>
          <div>
            <label className={labelCls}>{t('conges.auInclus')} <span className='text-red-500'>*</span></label>
            <input type='date' required className={inputCls} {...champ('au')} />
          </div>
          <div>
            <label className={labelCls}>{t('conges.nombreJours')}</label>
            <input type='number' min='0' className={inputCls} {...champ('nombreJours')} />
          </div>
          <div />
          <div>
            <label className={labelCls}>{t('conges.dernierJour')}</label>
            <input type='date' className={inputCls} {...champ('dernierJour')} />
          </div>
          <div>
            <label className={labelCls}>{t('conges.dateReprise')}</label>
            <input type='date' className={inputCls} {...champ('reprise')} />
          </div>
        </div>
      </div>

      <div>
        <h2 className='text-sm font-semibold mb-3'>{t('conges.natureDuConge')}</h2>
        <div className='flex flex-col gap-2'>
          {NATURES.map((n) => (
            <label key={n} className='flex items-center gap-2 text-sm cursor-pointer'>
              <input type='radio' name='nature' checked={form.nature === n} onChange={() => setForm((f) => ({ ...f, nature: n }))} className='accent-primary' />
              {t(NATURES_LABEL_KEYS[n])}
            </label>
          ))}
          {form.nature === 'Autre' && (
            <VoiceRecorder
              placeholder={t('conges.precisezNaturePlaceholder')}
              valeurTexte={form.autreTexte}
              onChangeTexte={(texte) => setForm((f) => ({ ...f, autreTexte: texte }))}
              onChangeVocal={(fichierAudio, transcript) => { setForm((f) => ({ ...f, autreTexte: transcript })); setVocalFichierAutre(fichierAudio) }}
            />
          )}
        </div>
      </div>

      <div className='grid sm:grid-cols-2 gap-3'>
        <div>
          <label className={labelCls}>{t('conges.lieu')} <span className='text-red-500'>*</span></label>
          <select required className={inputCls} {...champ('lieu')}>
            <option value='' disabled>{t('conges.selectionnerSite')}</option>
            {bureaux.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('conges.date')} <span className='text-red-500'>*</span></label>
          <input type='date' required className={inputCls} {...champ('date')} />
        </div>
      </div>

      <div>
        <div className='flex items-center justify-between mb-1.5'>
          <label className='text-sm font-medium'>{t('conges.signatureDemandeur')}</label>
          <div className='inline-flex rounded-lg border border-border overflow-hidden text-xs'>
            <button type='button' onClick={() => setModeSignature('pad')} className={`px-2.5 py-1 transition-colors ${modeSignature === 'pad' ? 'bg-primary text-white' : 'bg-background hover:bg-muted'}`}>{t('conges.pave')}</button>
            <button type='button' onClick={() => setModeSignature('texte')} className={`px-2.5 py-1 transition-colors ${modeSignature === 'texte' ? 'bg-primary text-white' : 'bg-background hover:bg-muted'}`}>{t('conges.jeCertifie')}</button>
          </div>
        </div>
        {modeSignature === 'pad' ? (
          <SignaturePad onChange={setSignatureDataUrl} />
        ) : (
          <div className='flex flex-col gap-2'>
            <input
              type='text'
              placeholder={t('conges.tapezNomComplet')}
              className={inputCls}
              value={signatureTexte}
              onChange={(e) => setSignatureTexte(e.target.value)}
            />
            <label className='flex items-center gap-2 text-xs text-muted-foreground cursor-pointer'>
              <input type='checkbox' checked={certifie} onChange={(e) => setCertifie(e.target.checked)} className='accent-primary' />
              {t('conges.jeCertifieExactitude')}
            </label>
          </div>
        )}
      </div>

      <div className='grid grid-cols-2 gap-2'>
        <button
          type='button'
          onClick={reinitialiser}
          disabled={envoiEnCours}
          className='inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60'
        >
          <LuX size={15} /> {t('espaceDossier.annuler')}
        </button>
        <button
          type='submit'
          disabled={envoiEnCours}
          className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'
        >
          {envoiEnCours ? <LuLoader2 className='animate-spin' size={15} /> : <LuSend size={15} />}
          {envoiEnCours ? t('reclamation.envoiEnCours') : t('conges.envoyer')}
        </button>
      </div>
    </form>
  )
}

export default CongeForm
