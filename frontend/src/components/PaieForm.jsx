import React, { useState } from 'react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { LuSend } from 'react-icons/lu'
import { createDocument } from '../api/routes/document'
import { getInitials } from '../utils/common'
import { genererPdfMessage } from '../utils/messagePdf'
import VoiceRecorder from './VoiceRecorder'
import { WizardShell, WizardStepHeader, WizardReviewLine, WizardSuccess, genererConfettis } from './wizard/Wizard'

/** Noms de mois dans la langue active de l'interface (voir i18n). */
function nomsMois(langue) {
  return Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(langue, { month: 'long' }))
}

/** "2026-08" → "août 2026" (ou "August 2026" selon la langue active). */
function libelleMois(moisStr, langue) {
  if (!moisStr) return ''
  const [annee, mois] = moisStr.split('-').map(Number)
  return new Date(annee, mois - 1, 1).toLocaleDateString(langue, { month: 'long', year: 'numeric' })
}

function moisActuel() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Années sélectionnables (les 3 dernières jusqu'à l'année en cours) — une
 * fiche de paie ne se demande pas des années en avance ni très en arrière.
 */
function anneesDisponibles() {
  const anneeActuelle = new Date().getFullYear()
  return [anneeActuelle, anneeActuelle - 1, anneeActuelle - 2]
}

/**
 * Formulaire de "Demande de fiche de paie" — contrairement à l'ancien dépôt
 * (l'intervenant uploadait lui-même un fichier, ce qui n'avait pas de sens
 * pour un bulletin de paie), c'est ici une simple demande précisant le mois
 * voulu. Un PDF récapitulatif la représente dans le circuit habituel ; la
 * Compta y répond en envoyant le vrai bulletin depuis la fiche du document
 * (voir DocView.jsx, DocumentController::decisionPaie), qui range alors le
 * fichier dans le vrai dossier interne "Bulletin de paie".
 *
 * Même parcours en étapes (briques partagées de wizard/Wizard.jsx) que
 * Réclamation/Prestation/Signalement, pour rester visuellement cohérent avec
 * le reste des demandes plutôt qu'un simple formulaire à part.
 */
function PaieForm({ currentUserName, demande, destination, onEnvoye }) {
  const { t, i18n } = useTranslation()
  const LIBELLE_ETAPE = { 1: t('paie.etapeDemande'), 2: t('reclamation.etapeRecapitulatif') }
  const NOMS_MOIS = nomsMois(i18n.resolvedLanguage)
  const [etape, setEtape] = useState(1)
  const [direction, setDirection] = useState('avant')
  const [mois, setMois] = useState(moisActuel())
  const [note, setNote] = useState('')
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [confettis, setConfettis] = useState([])

  // Deux <select> plutôt qu'un <input type="month"> : le rendu natif de ce
  // dernier déborde de son cadre sur Safari/iOS avec un mois écrit en toutes
  // lettres ("août 2026") — un select classique, entièrement sous notre
  // contrôle CSS, ne pose pas ce problème.
  const [anneeNum, moisNum] = mois.split('-').map(Number)
  const moisMaxAutorise = anneeNum === new Date().getFullYear() ? new Date().getMonth() + 1 : 12

  function changerAnnee(nouvelleAnnee) {
    const maxMoisPourAnnee = nouvelleAnnee === new Date().getFullYear() ? new Date().getMonth() + 1 : 12
    const moisAjuste = Math.min(moisNum, maxMoisPourAnnee)
    setMois(`${nouvelleAnnee}-${String(moisAjuste).padStart(2, '0')}`)
  }

  function changerMois(nouveauMois) {
    setMois(`${anneeNum}-${String(nouveauMois).padStart(2, '0')}`)
  }

  function allerA(cible) {
    setDirection(cible > etape ? 'avant' : 'arriere')
    setEtape(cible)
  }

  function reinitialiser() {
    setMois(moisActuel())
    setNote('')
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
      const moisLabel = libelleMois(mois, i18n.resolvedLanguage)
      const titre = t('paie.titreDemande', { mois: moisLabel })
      const message = note.trim()
        ? t('paie.messageAvecNote', { mois: moisLabel, note: note.trim() })
        : t('paie.messageSansNote', { mois: moisLabel })

      const blob = await genererPdfMessage({ titre, message, auteur: currentUserName })
      const codePrefixe = `${demande.code}-${getInitials(currentUserName)}`
      const reference = `${codePrefixe}-${Date.now()}`
      const fichier = new File([blob], `${titre}.pdf`, { type: 'application/pdf' })

      const res = await createDocument({
        category_id: destination.categorie_id,
        type_document_id: destination.type_document_id,
        titre,
        auteur: currentUserName,
        // Sert à la Compta pour ranger la vraie fiche de paie au bon nom une
        // fois la demande traitée (voir DocumentController::decisionPaie).
        nom_personne_concernee: currentUserName,
        resume: message,
        reference,
        file_create_date: Date.now(),
      }, fichier)

      if (res.status === 201) {
        setConfettis(genererConfettis())
        allerA(3)
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
      totalEtapes={2}
      libelleEtape={LIBELLE_ETAPE[etape]}
      direction={direction}
      peutRetour={etape === 2}
      onRetour={() => allerA(1)}
    >
      {etape === 1 && (
        <>
          <WizardStepHeader eyebrow={t('demandes.paie')} titre={t('paie.quelMois')} sousTitre={t('paie.precisezMoisSousTitre')} />
          <div className='min-w-0'>
            <label className='block text-sm font-medium mb-1.5'>{t('paie.moisConcerne')} <span className='text-red-500'>*</span></label>
            <div className='grid grid-cols-2 gap-2'>
              <select
                required
                value={moisNum}
                onChange={(e) => changerMois(Number(e.target.value))}
                className='w-full min-w-0 rounded-2xl border-[1.5px] border-border bg-background px-3.5 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow'
              >
                {NOMS_MOIS.map((nom, i) => (
                  <option key={nom} value={i + 1} disabled={i + 1 > moisMaxAutorise}>{nom}</option>
                ))}
              </select>
              <select
                required
                value={anneeNum}
                onChange={(e) => changerAnnee(Number(e.target.value))}
                className='w-full min-w-0 rounded-2xl border-[1.5px] border-border bg-background px-3.5 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow'
              >
                {anneesDisponibles().map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className='block text-sm font-medium mb-1.5'>{t('paie.precisionOptionnel')}</label>
            <VoiceRecorder
              placeholder={t('paie.precisionPlaceholder')}
              valeurTexte={note}
              onChangeTexte={setNote}
              onChangeVocal={(fichierAudio, transcript) => setNote(transcript)}
              variante='wizard'
              className='flex-1'
            />
          </div>
          <button
            type='button'
            disabled={!mois}
            onClick={() => allerA(2)}
            className='mt-auto rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:shadow-none'
          >
            {t('reclamation.suivant')}
          </button>
        </>
      )}

      {etape === 2 && (
        <>
          <WizardStepHeader eyebrow={t('demandes.paie')} titre={t('reclamation.verifiezAvantEnvoi')} sousTitre={t('reclamation.dernierCoupOeil')} />
          <div className='flex flex-col gap-2.5'>
            <WizardReviewLine label={t('paie.moisConcerne')} valeur={libelleMois(mois, i18n.resolvedLanguage)} onModifier={() => allerA(1)} delayMs={0} />
            <WizardReviewLine label={t('paie.precision')} valeur={note || t('signalement.aucune')} onModifier={() => allerA(1)} delayMs={60} multiline />
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

      {etape === 3 && (
        <WizardSuccess
          titre={t('paie.demandeEnvoyee')}
          sousTitre={t('paie.comptaNotifiee')}
          confettis={confettis}
          onReset={reinitialiser}
          libelleReset={t('conges.nouvelleDemande')}
        />
      )}
    </WizardShell>
  )
}

export default PaieForm
