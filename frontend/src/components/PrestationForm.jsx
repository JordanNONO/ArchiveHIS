import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { LuSend, LuSparkles, LuShirt, LuPartyPopper, LuFootprints, LuBaby, LuMoon, LuClock4, LuSun, LuCalendarDays, LuCalendarRange, LuRepeat, LuZap } from 'react-icons/lu'
import { createDocument } from '../api/routes/document'
import { getInitials } from '../utils/common'
import { genererPdfPrestation, PRESTATIONS } from '../utils/prestationPdf'
import { WizardShell, WizardStepHeader, WizardChoiceCard, WizardReviewLine, WizardSuccess, genererConfettis, WIZARD_TEXTAREA_CLS } from './wizard/Wizard'

const ICONES_PRESTATIONS = [LuSparkles, LuShirt, LuPartyPopper, LuFootprints, LuBaby, LuMoon, LuClock4]

const RYTHMES = [
  { valeur: 'Quotidienne', icon: LuSun },
  { valeur: 'Hebdomadaire', icon: LuCalendarDays },
  { valeur: 'Mensuelle', icon: LuCalendarRange },
]

const RECURRENCES = [
  { valeur: 'Récurrente', icon: LuRepeat },
  { valeur: 'Ponctuelle', icon: LuZap },
]

const LIBELLE_ETAPE = { 1: 'Prestations', 2: 'Fréquence', 3: 'Récurrence', 4: 'Horaires', 5: 'Récapitulatif' }
const TOTAL_ETAPES = 5

/**
 * Parcours séquentiel animé de "Créer une prestation" — même traitement que
 * ReclamationForm.jsx/CongeForm.jsx (briques partagées de wizard/Wizard.jsx).
 * Aucun gabarit scanné n'existe pour ce dépôt (contrairement aux congés/
 * réclamations) : le PDF est construit entièrement dans prestationPdf.js,
 * avec la même identité visuelle HIS (logo, bandeau, pied de page).
 *
 * Nom/prénom et date restent déduits automatiquement du compte connecté —
 * aucune étape ne les demande, l'info du bénéficiaire est déjà là.
 *
 * "Annuler une prestation" et "Qualité de la prestation" sont des parcours
 * autonomes séparés (voir PrestationActionForm.jsx), pas une étape d'ici —
 * regroupés uniquement sur le tableau de bord (voir EspaceIntervenant.jsx).
 */
function PrestationForm({ user, currentUserName, demande, destination, onEnvoye }) {
  const [etape, setEtape] = useState(1)
  const [direction, setDirection] = useState('avant')
  const [prestations, setPrestations] = useState([])
  const [rythme, setRythme] = useState('')
  const [recurrence, setRecurrence] = useState('')
  const [horaires, setHoraires] = useState('')
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [confettis, setConfettis] = useState([])

  function allerA(cible) {
    setDirection(cible > etape ? 'avant' : 'arriere')
    setEtape(cible)
  }

  function togglePrestation(libelle) {
    setPrestations((prev) => (prev.includes(libelle) ? prev.filter((p) => p !== libelle) : [...prev, libelle]))
  }

  function choisirRythme(valeur) {
    setRythme(valeur)
    setTimeout(() => allerA(3), 420)
  }

  function choisirRecurrence(valeur) {
    setRecurrence(valeur)
    setTimeout(() => allerA(4), 420)
  }

  function reinitialiser() {
    setPrestations([])
    setRythme('')
    setRecurrence('')
    setHoraires('')
    setConfettis([])
    allerA(1)
  }

  async function envoyer() {
    if (!destination) {
      toast.error("Ce dossier n'est pas disponible pour le moment, réessayez dans un instant")
      return
    }
    try {
      setEnvoiEnCours(true)
      const blob = await genererPdfPrestation({
        nomPrenom: currentUserName,
        date: new Date(),
        prestations,
        rythme,
        recurrence,
        horaires,
      })

      const codePrefixe = `${demande.code}-${getInitials(currentUserName)}`
      const reference = `${codePrefixe}-${Date.now()}`
      const fichier = new File([blob], `${codePrefixe} — Demande de prestation.pdf`, { type: 'application/pdf' })

      const res = await createDocument({
        category_id: destination.categorie_id,
        type_document_id: destination.type_document_id,
        titre: `${codePrefixe} — Demande de prestation`,
        auteur: currentUserName,
        nom_personne_concernee: currentUserName,
        resume: `Demande de prestation (${rythme}, ${recurrence}) — ${prestations.join(', ')}`,
        reference,
        file_create_date: Date.now(),
      }, fichier)

      if (res.status === 201) {
        setConfettis(genererConfettis())
        allerA(6)
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

  return (
    <WizardShell
      etape={etape}
      totalEtapes={TOTAL_ETAPES}
      libelleEtape={LIBELLE_ETAPE[etape]}
      direction={direction}
      peutRetour={etape > 1 && etape <= TOTAL_ETAPES}
      onRetour={() => allerA(etape - 1)}
      minHeight={440}
    >
      {etape === 1 && (
        <>
          <WizardStepHeader eyebrow='Prestation' titre='Quelle(s) prestation(s) ?' sousTitre='Sélectionnez tout ce qui correspond à votre besoin.' />
          <div className='flex flex-col gap-2'>
            {PRESTATIONS.map((libelle, i) => (
              <WizardChoiceCard
                key={libelle}
                icon={ICONES_PRESTATIONS[i]}
                label={libelle}
                picked={prestations.includes(libelle)}
                onClick={() => togglePrestation(libelle)}
                delayMs={i * 50}
              />
            ))}
          </div>
          <button
            type='button'
            disabled={prestations.length === 0}
            onClick={() => allerA(2)}
            className='mt-auto rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:shadow-none'
          >
            Suivant
          </button>
        </>
      )}

      {etape === 2 && (
        <>
          <WizardStepHeader eyebrow='Prestation' titre='Quelle fréquence ?' />
          <div className='flex flex-col gap-2'>
            {RYTHMES.map((r, i) => (
              <WizardChoiceCard key={r.valeur} icon={r.icon} label={r.valeur} picked={rythme === r.valeur} onClick={() => choisirRythme(r.valeur)} delayMs={i * 60} />
            ))}
          </div>
        </>
      )}

      {etape === 3 && (
        <>
          <WizardStepHeader eyebrow='Prestation' titre='Récurrente ou ponctuelle ?' />
          <div className='flex flex-col gap-2'>
            {RECURRENCES.map((r, i) => (
              <WizardChoiceCard key={r.valeur} icon={r.icon} label={r.valeur} picked={recurrence === r.valeur} onClick={() => choisirRecurrence(r.valeur)} delayMs={i * 60} />
            ))}
          </div>
        </>
      )}

      {etape === 4 && (
        <>
          <WizardStepHeader eyebrow='Prestation' titre='Quels horaires ?' sousTitre='Décrivez les créneaux souhaités.' />
          <textarea
            autoFocus
            rows={6}
            maxLength={400}
            value={horaires}
            onChange={(e) => setHoraires(e.target.value)}
            placeholder='Ex : tous les matins de 8h à 10h...'
            className={WIZARD_TEXTAREA_CLS}
          />
          <span className='self-end text-[11px] text-muted-foreground tabular-nums'>{horaires.length}/400</span>
          <div className='flex gap-2 mt-auto'>
            <button type='button' onClick={() => allerA(3)} className='rounded-xl bg-muted px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/70 transition-transform duration-150 active:scale-95'>
              Retour
            </button>
            <button
              type='button'
              disabled={horaires.trim().length === 0}
              onClick={() => allerA(5)}
              className='flex-1 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:shadow-none'
            >
              Suivant
            </button>
          </div>
        </>
      )}

      {etape === 5 && (
        <>
          <WizardStepHeader eyebrow='Prestation' titre="Vérifiez avant d'envoyer" sousTitre="Un dernier coup d'œil, puis c'est parti." />
          <div className='flex flex-col gap-2.5'>
            <WizardReviewLine label='Prestation(s)' valeur={prestations.join(', ')} onModifier={() => allerA(1)} delayMs={0} multiline />
            <WizardReviewLine label='Fréquence' valeur={`${rythme} — ${recurrence}`} onModifier={() => allerA(2)} delayMs={60} />
            <WizardReviewLine label='Horaires' valeur={horaires} onModifier={() => allerA(4)} delayMs={120} multiline />
          </div>
          <button
            type='button'
            disabled={envoiEnCours}
            onClick={envoyer}
            className='mt-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-60'
          >
            <LuSend size={15} /> {envoiEnCours ? 'Envoi...' : 'Envoyer la demande'}
          </button>
        </>
      )}

      {etape === 6 && (
        <WizardSuccess
          titre='Demande de prestation envoyée'
          sousTitre='Votre demande a été transmise — vous serez recontacté pour la mise en place.'
          confettis={confettis}
          onReset={reinitialiser}
          libelleReset='Faire une nouvelle demande'
        />
      )}
    </WizardShell>
  )
}

export default PrestationForm
