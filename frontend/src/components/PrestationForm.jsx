import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { LuSend, LuSparkles, LuShirt, LuPartyPopper, LuFootprints, LuBaby, LuMoon, LuClock4, LuSun, LuCalendarDays, LuCalendarRange, LuRepeat, LuZap } from 'react-icons/lu'
import { createDocument } from '../api/routes/document'
import { getInitials } from '../utils/common'
import { genererPdfPrestation, PRESTATIONS } from '../utils/prestationPdf'
import VoiceRecorder from './VoiceRecorder'
import { WizardShell, WizardStepHeader, WizardChoiceCard, WizardReviewLine, WizardSuccess, genererConfettis } from './wizard/Wizard'

const LONGUEUR_MAX_HORAIRES = 400

const ICONES_PRESTATIONS = [LuSparkles, LuShirt, LuPartyPopper, LuFootprints, LuBaby, LuMoon, LuClock4]

// Valeurs volontairement laissées en français : `genererPdfPrestation`
// (prestationPdf.js) les incruste directement sur le vrai gabarit officiel
// (reclamation_template.pdf), entièrement en français et non traduisible —
// même logique que NATURES dans CongeForm.jsx. Seul le reste du parcours
// (chrome de l'assistant, boutons, messages) suit la langue de l'interface.
const RYTHMES = [
  { valeur: 'Quotidienne', icon: LuSun },
  { valeur: 'Hebdomadaire', icon: LuCalendarDays },
  { valeur: 'Mensuelle', icon: LuCalendarRange },
]

const RECURRENCES = [
  { valeur: 'Récurrente', icon: LuRepeat },
  { valeur: 'Ponctuelle', icon: LuZap },
]

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
  const { t } = useTranslation()
  const LIBELLE_ETAPE = { 1: t('prestation.etapePrestations'), 2: t('prestation.etapeFrequence'), 3: t('prestation.etapeRecurrence'), 4: t('prestation.etapeHoraires'), 5: t('reclamation.etapeRecapitulatif') }
  const TOTAL_ETAPES = 5
  const [etape, setEtape] = useState(1)
  const [direction, setDirection] = useState('avant')
  const [prestations, setPrestations] = useState([])
  const [rythme, setRythme] = useState('')
  const [recurrence, setRecurrence] = useState('')
  const [horaires, setHoraires] = useState('')
  // Certains navigateurs (Firefox, Safari sans la reconnaissance vocale...)
  // enregistrent bien l'audio mais ne transcrivent jamais rien — sans ce
  // repli, le bouton "Suivant" restait grisé indéfiniment après un vocal.
  const [vocalFichier, setVocalFichier] = useState(null)
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
    setVocalFichier(null)
    setConfettis([])
    allerA(1)
  }

  async function envoyer() {
    if (!destination) {
      toast.error(t('espaceDossier.dossierIndisponible'))
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
        toast.error(t('conges.envoiEchoue'))
      }
    } catch (error) {
      console.log(error)
      toast.error(t('reclamation.generationEchouee'))
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
          <WizardStepHeader eyebrow={t('demandes.groupePrestation')} titre={t('prestation.quellesPrestations')} sousTitre={t('prestation.selectionnezTout')} />
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
            {t('reclamation.suivant')}
          </button>
        </>
      )}

      {etape === 2 && (
        <>
          <WizardStepHeader eyebrow={t('demandes.groupePrestation')} titre={t('prestation.quelleFrequence')} />
          <div className='flex flex-col gap-2'>
            {RYTHMES.map((r, i) => (
              <WizardChoiceCard key={r.valeur} icon={r.icon} label={r.valeur} picked={rythme === r.valeur} onClick={() => choisirRythme(r.valeur)} delayMs={i * 60} />
            ))}
          </div>
        </>
      )}

      {etape === 3 && (
        <>
          <WizardStepHeader eyebrow={t('demandes.groupePrestation')} titre={t('prestation.recurrenteOuPonctuelle')} />
          <div className='flex flex-col gap-2'>
            {RECURRENCES.map((r, i) => (
              <WizardChoiceCard key={r.valeur} icon={r.icon} label={r.valeur} picked={recurrence === r.valeur} onClick={() => choisirRecurrence(r.valeur)} delayMs={i * 60} />
            ))}
          </div>
        </>
      )}

      {etape === 4 && (
        <>
          <WizardStepHeader eyebrow={t('demandes.groupePrestation')} titre={t('prestation.quelsHoraires')} sousTitre={t('prestation.decrivezCreneaux')} />
          <VoiceRecorder
            valeurTexte={horaires}
            onChangeTexte={setHoraires}
            onChangeVocal={(fichierAudio, transcript) => { setHoraires(transcript); setVocalFichier(fichierAudio) }}
            placeholder={t('prestation.horairesPlaceholder')}
            variante='wizard'
            className='flex-1'
            maxLength={LONGUEUR_MAX_HORAIRES}
          />
          <div className='flex gap-2 mt-auto'>
            <button type='button' onClick={() => allerA(3)} className='rounded-xl bg-muted px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/70 transition-transform duration-150 active:scale-95'>
              {t('reclamation.retour')}
            </button>
            <button
              type='button'
              disabled={horaires.trim().length === 0 && !vocalFichier}
              onClick={() => allerA(5)}
              className='flex-1 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:shadow-none'
            >
              {t('reclamation.suivant')}
            </button>
          </div>
        </>
      )}

      {etape === 5 && (
        <>
          <WizardStepHeader eyebrow={t('demandes.groupePrestation')} titre={t('reclamation.verifiezAvantEnvoi')} sousTitre={t('reclamation.dernierCoupOeil')} />
          <div className='flex flex-col gap-2.5'>
            <WizardReviewLine label={t('prestation.prestations')} valeur={prestations.join(', ')} onModifier={() => allerA(1)} delayMs={0} multiline />
            <WizardReviewLine label={t('prestation.frequence')} valeur={`${rythme} — ${recurrence}`} onModifier={() => allerA(2)} delayMs={60} />
            <WizardReviewLine label={t('prestation.horaires')} valeur={horaires} onModifier={() => allerA(4)} delayMs={120} multiline />
          </div>
          <button
            type='button'
            disabled={envoiEnCours}
            onClick={envoyer}
            className='mt-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-60'
          >
            <LuSend size={15} /> {envoiEnCours ? t('reclamation.envoiEnCours') : t('paie.envoyerDemande')}
          </button>
        </>
      )}

      {etape === 6 && (
        <WizardSuccess
          titre={t('prestation.demandeEnvoyee')}
          sousTitre={t('prestation.demandeTransmise')}
          confettis={confettis}
          onReset={reinitialiser}
          libelleReset={t('conges.nouvelleDemande')}
        />
      )}
    </WizardShell>
  )
}

export default PrestationForm
