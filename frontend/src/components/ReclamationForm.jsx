import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { LuSend, LuWallet, LuCalendarClock, LuHeartHandshake, LuSwords, LuMoreHorizontal } from 'react-icons/lu'
import { createDocument } from '../api/routes/document'
import { getInitials } from '../utils/common'
import { genererPdfReclamation } from '../utils/reclamationPdf'
import VoiceRecorder from './VoiceRecorder'
import { WizardShell, WizardStepHeader, WizardChoiceCard, WizardReviewLine, WizardSuccess, genererConfettis } from './wizard/Wizard'

const LONGUEUR_MAX_RECLAMATION = 600

// `valeur` reste le canonique interne (comparaisons, filtre par profil) —
// `labelKey` est la clé de traduction affichée (namespace "reclamation").
const OBJETS = [
  { valeur: 'Salaire', labelKey: 'reclamation.objetSalaire', icon: LuWallet },
  { valeur: 'Planning', labelKey: 'reclamation.objetPlanning', icon: LuCalendarClock },
  { valeur: 'Climat de travail', labelKey: 'reclamation.objetClimat', icon: LuHeartHandshake },
  { valeur: 'Conflits internes', labelKey: 'reclamation.objetConflits', icon: LuSwords },
  { valeur: 'Autre', labelKey: 'reclamation.objetAutre', icon: LuMoreHorizontal },
]

/**
 * Parcours séquentiel animé (une question à la fois, façon assistant
 * d'installation) — maquette approuvée avant implémentation. S'appuie sur les
 * briques partagées de wizard/Wizard.jsx (utilisées aussi par CongeForm.jsx)
 * plutôt que de recopier la mécanique d'animation ici. Le PDF continue à se
 * générer en arrière-plan exactement comme avant (reclamationPdf.js), seule
 * la façade change.
 *
 * Nom/prénom, date et la case Client/Salarié restent déduits automatiquement
 * du compte connecté — aucune étape ne les demande.
 */
function ReclamationForm({ user, currentUserName, demande, destination, onEnvoye }) {
  const { t } = useTranslation()
  const LIBELLE_ETAPE = { 1: t('reclamation.etapeObjet'), 2: t('reclamation.etapeDescription'), 3: t('reclamation.etapeRecapitulatif') }
  const [etape, setEtape] = useState(1)
  const [direction, setDirection] = useState('avant')
  const [objet, setObjet] = useState('')
  const [texte, setTexte] = useState('')
  const [vocalFichier, setVocalFichier] = useState(null)
  const [vocalUrl, setVocalUrl] = useState(null)
  const [vocalCle, setVocalCle] = useState(0)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [confettis, setConfettis] = useState([])

  // VoiceRecorder se démonte en changeant d'étape (chaque étape n'est rendue
  // que si `etape` correspond) — sans conserver le fichier audio ici, plus
  // moyen de le réécouter une fois sur le récapitulatif.
  useEffect(() => {
    if (!vocalFichier) {
      setVocalUrl(null)
      return
    }
    const url = URL.createObjectURL(vocalFichier)
    setVocalUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [vocalFichier])

  const profil = user?.role === 'Beneficiaire' ? 'Client' : 'Salarié'
  // "Salaire" ne concerne que les salariés (intervenants) — un bénéficiaire
  // (client) n'a pas de salaire à réclamer.
  const objetsDisponibles = profil === 'Client' ? OBJETS.filter((o) => o.valeur !== 'Salaire') : OBJETS

  function allerA(cible) {
    setDirection(cible > etape ? 'avant' : 'arriere')
    setEtape(cible)
  }

  function choisirObjet(valeur) {
    setObjet(valeur)
    setTimeout(() => allerA(2), 420)
  }

  function reinitialiser() {
    setObjet('')
    setTexte('')
    setVocalFichier(null)
    setVocalCle((k) => k + 1)
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
      const objetLabel = t(OBJETS.find((o) => o.valeur === objet)?.labelKey || objet)
      const blob = await genererPdfReclamation({
        nomPrenom: currentUserName,
        profil,
        date: new Date(),
        objet: objetLabel,
        reclamation: texte,
      })

      const codePrefixe = `${demande.code}-${getInitials(currentUserName)}`
      const refBase = `${codePrefixe}-${Date.now()}`
      const titre = `${codePrefixe} — ${t('demandes.reclamation')} : ${objetLabel}`
      const fichier = new File([blob], `${titre}.pdf`, { type: 'application/pdf' })
      const avecAudioLie = !!vocalFichier

      const res = await createDocument({
        category_id: destination.categorie_id,
        type_document_id: destination.type_document_id,
        titre,
        auteur: currentUserName,
        nom_personne_concernee: currentUserName,
        resume: t('reclamation.resume', { profil, objet: objetLabel }),
        // Même convention que les dépôts multi-pages (EspaceDossier.jsx) : un
        // suffixe "-1"/"-2" numérique commun rattache le message vocal à sa
        // réclamation — DocView.jsx (fetchPagesLiees) les retrouve alors comme
        // "pages liées" du même dépôt, dans le même dossier, sous le même nom.
        reference: avecAudioLie ? `${refBase}-1` : refBase,
        file_create_date: Date.now(),
      }, fichier)

      if (res.status !== 201) {
        toast.error(t('reclamation.envoiEchoue'))
        return
      }

      if (avecAudioLie) {
        const resAudio = await createDocument({
          category_id: destination.categorie_id,
          type_document_id: destination.type_document_id,
          titre,
          auteur: currentUserName,
          nom_personne_concernee: currentUserName,
          resume: t('reclamation.resumeVocal', { profil, objet: objetLabel }),
          texte_extrait: texte || undefined,
          reference: `${refBase}-2`,
          file_create_date: vocalFichier.lastModified || Date.now(),
        }, vocalFichier)
        if (resAudio.status !== 201) {
          toast.warning(t('reclamation.audioNonJoint'))
        }
      }

      setConfettis(genererConfettis())
      allerA(4)
      onEnvoye && onEnvoye()
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
      totalEtapes={3}
      libelleEtape={LIBELLE_ETAPE[etape]}
      direction={direction}
      peutRetour={etape > 1 && etape < 4}
      onRetour={() => allerA(etape - 1)}
    >
      {etape === 1 && (
        <>
          <WizardStepHeader eyebrow={t('demandes.reclamation')} titre={t('reclamation.quelEstObjet')} sousTitre={t('reclamation.choisissezCategorie')} />
          <div className='flex flex-col gap-2'>
            {objetsDisponibles.map((o, i) => (
              <WizardChoiceCard
                key={o.valeur}
                icon={o.icon}
                label={t(o.labelKey)}
                picked={objet === o.valeur}
                onClick={() => choisirObjet(o.valeur)}
                delayMs={i * 60}
              />
            ))}
          </div>
        </>
      )}

      {etape === 2 && (
        <>
          <WizardStepHeader eyebrow={t('demandes.reclamation')} titre={t('reclamation.decrivezSituation')} sousTitre={t('reclamation.decrivezSousTitre')} />
          <VoiceRecorder
            key={vocalCle}
            valeurTexte={texte}
            onChangeTexte={setTexte}
            onChangeVocal={(fichierAudio, transcript) => { setTexte(transcript); setVocalFichier(fichierAudio) }}
            placeholder={t('reclamation.ecrivezIci')}
            variante='wizard'
            className='flex-1'
            maxLength={LONGUEUR_MAX_RECLAMATION}
          />
          <div className='flex gap-2 mt-auto'>
            <button type='button' onClick={() => allerA(1)} className='rounded-xl bg-muted px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/70 transition-transform duration-150 active:scale-95'>
              {t('reclamation.retour')}
            </button>
            <button
              type='button'
              disabled={texte.trim().length === 0 && !vocalFichier}
              onClick={() => allerA(3)}
              className='flex-1 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:shadow-none'
            >
              {t('reclamation.suivant')}
            </button>
          </div>
        </>
      )}

      {etape === 3 && (
        <>
          <WizardStepHeader eyebrow={t('demandes.reclamation')} titre={t('reclamation.verifiezAvantEnvoi')} sousTitre={t('reclamation.dernierCoupOeil')} />
          <div className='flex flex-col gap-2.5'>
            <WizardReviewLine label={t('reclamation.objet')} valeur={t(OBJETS.find((o) => o.valeur === objet)?.labelKey || objet)} onModifier={() => allerA(1)} delayMs={50} />
            <WizardReviewLine label={t('demandes.reclamation')} valeur={texte} onModifier={() => allerA(2)} delayMs={120} multiline />
            {vocalUrl && (
              <div className='rounded-2xl bg-muted/60 px-3.5 py-3 opacity-0 animate-wizard-card-in' style={{ animationDelay: '180ms' }}>
                <p className='text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5'>{t('reclamation.reecouterVocal')}</p>
                <audio controls src={vocalUrl} className='w-full h-9' />
              </div>
            )}
          </div>
          <button
            type='button'
            disabled={envoiEnCours}
            onClick={envoyer}
            className='mt-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-60'
          >
            <LuSend size={15} /> {envoiEnCours ? t('reclamation.envoiEnCours') : t('reclamation.envoyerReclamation')}
          </button>
        </>
      )}

      {etape === 4 && (
        <WizardSuccess
          titre={t('reclamation.reclamationEnvoyee')}
          sousTitre={t('reclamation.rhNotifie')}
          confettis={confettis}
          onReset={reinitialiser}
          libelleReset={t('reclamation.nouvelleReclamation')}
        />
      )}
    </WizardShell>
  )
}

export default ReclamationForm
