import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { LuSend } from 'react-icons/lu'
import { createDocument } from '../api/routes/document'
import { getInitials } from '../utils/common'
import { genererPdfMessage } from '../utils/messagePdf'
import VoiceRecorder from './VoiceRecorder'
import NotationAuxiliaires from './NotationAuxiliaires'
import { WizardShell, WizardStepHeader, WizardReviewLine, WizardSuccess, genererConfettis } from './wizard/Wizard'

/**
 * Parcours court pour "Annuler une prestation" et "Qualité de la prestation" —
 * même principe que SignalementForm.jsx (message/vocal, + notation pour la
 * qualité), mais en parcours autonome à destination fixe : ces deux-là ne
 * passent plus par un choix de type, ils ont chacun leur propre route/tuile,
 * seulement regroupées visuellement avec "Créer une prestation" sur le
 * tableau de bord (voir EspaceIntervenant.jsx).
 */
function PrestationActionForm({ demande, currentUserName, destination, onEnvoye, avecNotation = false }) {
  const { t } = useTranslation()
  const demandeLabel = t(demande.label)
  const sequence = avecNotation ? ['notation', 'message', 'recap'] : ['message', 'recap']
  const TOTAL_ETAPES = sequence.length
  const ETAPE_SUCCES = TOTAL_ETAPES + 1

  const [etape, setEtape] = useState(1)
  const [direction, setDirection] = useState('avant')
  const [notationResume, setNotationResume] = useState('')
  const [notationCle, setNotationCle] = useState(0)
  const [texte, setTexte] = useState('')
  const [vocalFichier, setVocalFichier] = useState(null)
  const [vocalTranscript, setVocalTranscript] = useState('')
  const [vocalCle, setVocalCle] = useState(0)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [confettis, setConfettis] = useState([])

  const etapeNom = sequence[etape - 1]
  const messageValide = texte.trim().length > 0 || !!vocalFichier || (avecNotation && notationResume.trim().length > 0)

  function allerA(cible) {
    setDirection(cible > etape ? 'avant' : 'arriere')
    setEtape(cible)
  }

  function reinitialiser() {
    setNotationResume('')
    setNotationCle((k) => k + 1)
    setTexte('')
    setVocalFichier(null)
    setVocalTranscript('')
    setVocalCle((k) => k + 1)
    setConfettis([])
    allerA(1)
  }

  async function envoyer() {
    if (!destination) {
      toast.error(t('espaceDossier.dossierIndisponible'))
      return
    }
    const codePrefixe = `${demande.code}-${getInitials(currentUserName)}`
    const reference = `${codePrefixe}-${Date.now()}`
    const titre = `${codePrefixe} — ${demandeLabel}`
    const resumeComplet = [texte.trim(), notationResume.trim()].filter(Boolean).join('\n\n') || demandeLabel

    try {
      setEnvoiEnCours(true)
      let fichier
      if (vocalFichier) {
        fichier = vocalFichier
      } else {
        const blob = await genererPdfMessage({ titre, message: resumeComplet, auteur: currentUserName })
        fichier = new File([blob], `${titre}.pdf`, { type: 'application/pdf' })
      }

      const res = await createDocument({
        category_id: destination.categorie_id,
        type_document_id: destination.type_document_id,
        titre,
        auteur: currentUserName,
        nom_personne_concernee: currentUserName,
        resume: resumeComplet,
        texte_extrait: vocalTranscript || undefined,
        reference,
        file_create_date: fichier.lastModified || Date.now(),
      }, fichier)

      if (res.status === 201) {
        setConfettis(genererConfettis())
        allerA(ETAPE_SUCCES)
        onEnvoye && onEnvoye()
      } else {
        toast.error(t('prestationAction.envoiEchoue'))
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
      libelleEtape={etapeNom === 'notation' ? t('signalement.notation') : etapeNom === 'message' ? t('espaceDossier.message') : t('reclamation.etapeRecapitulatif')}
      direction={direction}
      peutRetour={etape > 1 && etape <= TOTAL_ETAPES}
      onRetour={() => allerA(etape - 1)}
      minHeight={460}
    >
      {etapeNom === 'notation' && (
        <>
          <WizardStepHeader eyebrow={demandeLabel} titre={t('signalement.notezAuxiliaires')} sousTitre={t('signalement.glissezPourChanger')} />
          <NotationAuxiliaires key={notationCle} onChange={setNotationResume} />
          <button type='button' onClick={() => allerA(etape + 1)} className='mt-auto rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95'>
            {t('reclamation.suivant')}
          </button>
        </>
      )}

      {etapeNom === 'message' && (
        <>
          <WizardStepHeader
            eyebrow={demandeLabel}
            titre={avecNotation ? t('signalement.remarqueGenerale') : t('prestationAction.decrivezDemande')}
            sousTitre={avecNotation ? t('signalement.optionnelSiNotes') : t('prestationAction.precisezPrestationRaison')}
          />
          <VoiceRecorder
            key={vocalCle}
            valeurTexte={texte}
            onChangeTexte={setTexte}
            placeholder={t('reclamation.ecrivezIci')}
            onChangeVocal={(fichierAudio, transcript) => { setVocalFichier(fichierAudio); setVocalTranscript(transcript || '') }}
            className='flex-1'
            variante='wizard'
          />
          <div className='flex gap-2 mt-auto'>
            {avecNotation && (
              <button type='button' onClick={() => allerA(etape - 1)} className='rounded-xl bg-muted px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/70 transition-transform duration-150 active:scale-95'>
                {t('reclamation.retour')}
              </button>
            )}
            <button
              type='button'
              disabled={!messageValide}
              onClick={() => allerA(etape + 1)}
              className='flex-1 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:shadow-none'
            >
              {t('reclamation.suivant')}
            </button>
          </div>
        </>
      )}

      {etapeNom === 'recap' && (
        <>
          <WizardStepHeader eyebrow={demandeLabel} titre={t('reclamation.verifiezAvantEnvoi')} sousTitre={t('reclamation.dernierCoupOeil')} />
          <div className='flex flex-col gap-2.5'>
            {avecNotation && (
              <WizardReviewLine label={t('signalement.notation')} valeur={notationResume || t('signalement.aucune')} onModifier={() => allerA(1)} delayMs={0} multiline />
            )}
            <WizardReviewLine label={t('espaceDossier.message')} valeur={texte || (vocalFichier ? t('signalement.messageVocalEnregistre') : '')} onModifier={() => allerA(etape - 1)} delayMs={60} multiline />
          </div>
          <button
            type='button'
            disabled={envoiEnCours}
            onClick={envoyer}
            className='mt-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-60'
          >
            <LuSend size={15} /> {envoiEnCours ? t('reclamation.envoiEnCours') : t('prestationAction.envoyer')}
          </button>
        </>
      )}

      {etape === ETAPE_SUCCES && (
        <WizardSuccess
          titre={t('wizard.envoye')}
          sousTitre={t('prestation.demandeTransmise')}
          confettis={confettis}
          onReset={reinitialiser}
          libelleReset={t('wizard.recommencer')}
        />
      )}
    </WizardShell>
  )
}

export default PrestationActionForm
