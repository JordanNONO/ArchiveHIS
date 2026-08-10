import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { LuLoader2, LuSend, LuX } from 'react-icons/lu'
import SignaturePad from './SignaturePad'
import { createDocument } from '../api/routes/document'
import { getBureaux } from '../api/routes/bureau'
import { getInitials } from '../utils/common'
import { genererPdfConges } from '../utils/congesPdf'
import { WizardSuccess, genererConfettis } from './wizard/Wizard'

const NATURES = ['Payé', 'Sans solde', 'Évènement familial', 'Paternité', 'Autre']

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
  const [form, setForm] = useState({
    ...FORM_VIDE,
    nomPrenom: currentUserName || '',
    adresse: user?.personnel?.lieu_residence || '',
    telephone: user?.personnel?.first_phone || '',
    email: user?.mail || '',
  })
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
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!form.du || !form.au) {
      toast.warning('Précisez la période demandée')
      return
    }
    if (form.nature === 'Autre' && !form.autreTexte.trim()) {
      toast.warning('Précisez la nature du congé')
      return
    }
    if (!form.lieu.trim()) {
      toast.warning('Précisez le lieu')
      return
    }
    const signatureOk = modeSignature === 'pad' ? !!signatureDataUrl : (signatureTexte.trim() && certifie)
    if (!signatureOk) {
      toast.warning(modeSignature === 'pad' ? 'Signez dans le pavé prévu à cet effet' : 'Indiquez votre nom et cochez la certification')
      return
    }
    if (!destination) {
      toast.error("Ce dossier n'est pas disponible pour le moment, réessayez dans un instant")
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
        toast.success('Demande de congés envoyée avec succès')
        reinitialiser()
        setConfettis(genererConfettis())
        setEnvoye(true)
        onEnvoye && onEnvoye()
      } else {
        toast.error("L'envoi de la demande a échoué")
      }
    } catch (error) {
      console.log(error)
      toast.error('Une erreur est survenue lors de la génération du document')
    } finally {
      setEnvoiEnCours(false)
    }
  }

  if (envoye) {
    return (
      <div className='rounded-2xl border border-border bg-card p-5'>
        <WizardSuccess
          titre='Demande de congés envoyée'
          sousTitre='RH a été notifié — vous recevrez une réponse dès que la demande est traitée.'
          confettis={confettis}
          onReset={() => setEnvoye(false)}
          libelleReset='Faire une nouvelle demande'
        />
      </div>
    )
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 accent-primary'
  const labelCls = 'block text-sm font-medium mb-1.5'

  return (
    <form onSubmit={onSubmit} className='rounded-2xl border border-border bg-card p-5 flex flex-col gap-5'>
      <div>
        <h2 className='text-sm font-semibold mb-3'>1. Informations du demandeur</h2>
        <div className='grid sm:grid-cols-2 gap-3'>
          <div>
            <label className={labelCls}>Nom et prénom</label>
            <input type='text' required className={inputCls} {...champ('nomPrenom')} />
          </div>
          <div>
            <label className={labelCls}>Fonction</label>
            <input type='text' required className={inputCls} {...champ('fonction')} />
          </div>
          <div className='sm:col-span-2'>
            <label className={labelCls}>Adresse</label>
            <input type='text' required className={inputCls} {...champ('adresse')} />
          </div>
          <div>
            <label className={labelCls}>Numéro de téléphone</label>
            <input type='tel' required className={inputCls} {...champ('telephone')} />
          </div>
          <div>
            <label className={labelCls}>E-mail</label>
            <input type='email' required className={inputCls} {...champ('email')} />
          </div>
        </div>
      </div>

      <div>
        <h2 className='text-sm font-semibold mb-3'>2. Informations sur les congés</h2>
        <div className='grid sm:grid-cols-2 gap-3'>
          <div>
            <label className={labelCls}>Du</label>
            <input type='date' required className={inputCls} {...champ('du')} />
          </div>
          <div>
            <label className={labelCls}>Au (inclus)</label>
            <input type='date' required className={inputCls} {...champ('au')} />
          </div>
          <div>
            <label className={labelCls}>Nombre de jours ouvrables</label>
            <input type='number' min='0' className={inputCls} {...champ('nombreJours')} />
          </div>
          <div />
          <div>
            <label className={labelCls}>Dernier jour travaillé</label>
            <input type='date' className={inputCls} {...champ('dernierJour')} />
          </div>
          <div>
            <label className={labelCls}>Date de reprise du travail</label>
            <input type='date' className={inputCls} {...champ('reprise')} />
          </div>
        </div>
      </div>

      <div>
        <h2 className='text-sm font-semibold mb-3'>Nature du congé</h2>
        <div className='flex flex-col gap-2'>
          {NATURES.map((n) => (
            <label key={n} className='flex items-center gap-2 text-sm cursor-pointer'>
              <input type='radio' name='nature' checked={form.nature === n} onChange={() => setForm((f) => ({ ...f, nature: n }))} className='accent-primary' />
              {n === 'Paternité' ? 'Paternité/accueil d\'enfant' : n}
            </label>
          ))}
          {form.nature === 'Autre' && (
            <textarea
              rows={3}
              className={inputCls}
              placeholder='Précisez la nature du congé...'
              value={form.autreTexte}
              onChange={(e) => setForm((f) => ({ ...f, autreTexte: e.target.value }))}
            />
          )}
        </div>
      </div>

      <div className='grid sm:grid-cols-2 gap-3'>
        <div>
          <label className={labelCls}>Lieu</label>
          <select required className={inputCls} {...champ('lieu')}>
            <option value='' disabled>Sélectionner un site...</option>
            {bureaux.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input type='date' required className={inputCls} {...champ('date')} />
        </div>
      </div>

      <div>
        <div className='flex items-center justify-between mb-1.5'>
          <label className='text-sm font-medium'>Signature du demandeur</label>
          <div className='inline-flex rounded-lg border border-border overflow-hidden text-xs'>
            <button type='button' onClick={() => setModeSignature('pad')} className={`px-2.5 py-1 transition-colors ${modeSignature === 'pad' ? 'bg-primary text-white' : 'bg-background hover:bg-muted'}`}>Pavé</button>
            <button type='button' onClick={() => setModeSignature('texte')} className={`px-2.5 py-1 transition-colors ${modeSignature === 'texte' ? 'bg-primary text-white' : 'bg-background hover:bg-muted'}`}>Je certifie</button>
          </div>
        </div>
        {modeSignature === 'pad' ? (
          <SignaturePad onChange={setSignatureDataUrl} />
        ) : (
          <div className='flex flex-col gap-2'>
            <input
              type='text'
              placeholder='Tapez votre nom complet'
              className={inputCls}
              value={signatureTexte}
              onChange={(e) => setSignatureTexte(e.target.value)}
            />
            <label className='flex items-center gap-2 text-xs text-muted-foreground cursor-pointer'>
              <input type='checkbox' checked={certifie} onChange={(e) => setCertifie(e.target.checked)} className='accent-primary' />
              Je certifie l'exactitude des informations fournies dans cette demande.
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
          <LuX size={15} /> Annuler
        </button>
        <button
          type='submit'
          disabled={envoiEnCours}
          className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'
        >
          {envoiEnCours ? <LuLoader2 className='animate-spin' size={15} /> : <LuSend size={15} />}
          {envoiEnCours ? 'Envoi...' : 'Envoyer'}
        </button>
      </div>
    </form>
  )
}

export default CongeForm
