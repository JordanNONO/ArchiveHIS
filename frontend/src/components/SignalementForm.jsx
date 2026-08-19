import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { LuSend, LuAperture, LuCheck } from 'react-icons/lu'
import { createDocument } from '../api/routes/document'
import { getInitials } from '../utils/common'
import { genererPdfMessage } from '../utils/messagePdf'
import { resoudreDestinationDemande, SOUS_TYPES_SIGNALEMENT } from '../constants/typesDemande'
import VoiceRecorder from './VoiceRecorder'
import NotationAuxiliaires from './NotationAuxiliaires'
import { WizardShell, WizardStepHeader, WizardChoiceCard, WizardReviewLine, WizardSuccess, genererConfettis } from './wizard/Wizard'

// Aucune vidéo : filmer chez soi exposerait l'auxiliaire de vie qui intervient
// au domicile du bénéficiaire — seule la photo reste proposée. "image/*" (et
// non une liste de mimes précis) est ce qui déclenche de façon fiable l'intent
// photo-only des OS mobiles avec capture="environment", sans repasser par
// l'appli caméra complète qui propose aussi la vidéo.
const ACCEPT_PHOTO = 'image/*'

/**
 * Parcours séquentiel animé, même traitement que ReclamationForm.jsx : une
 * question à la fois, briques partagées de wizard/Wizard.jsx. Contrairement à
 * Réclamation (3 étapes fixes), les 5 sous-types de Signalement n'ont pas
 * tous la même vue intermédiaire (photo pour Incident, Retard/Absence pour
 * Retard, notation pour Qualité, rien pour Maltraitance/Annulation) — d'où le
 * calcul dynamique de `etapeIntermediaire` à partir du sous-type choisi en
 * étape 1. Le vocal (VoiceRecorder) reste disponible à l'étape Message pour
 * tous les sous-types.
 */
function SignalementForm({ currentUserName, categories, typesParCategorie, onEnvoye }) {
  const { t } = useTranslation()
  const [etape, setEtape] = useState(1)
  const [direction, setDirection] = useState('avant')
  const [sousTypeChoisi, setSousTypeChoisi] = useState(null)
  const [sousChoix, setSousChoix] = useState('')
  const [photo, setPhoto] = useState(null)
  const [notationResume, setNotationResume] = useState('')
  const [notationCle, setNotationCle] = useState(0)
  const [texte, setTexte] = useState('')
  const [vocalFichier, setVocalFichier] = useState(null)
  const [vocalUrl, setVocalUrl] = useState(null)
  const [vocalCle, setVocalCle] = useState(0)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [confettis, setConfettis] = useState([])

  // VoiceRecorder se démonte en changeant d'étape — sans conserver le fichier
  // audio ici, plus moyen de le réécouter une fois sur le récapitulatif (voir
  // ReclamationForm.jsx, même mécanisme).
  useEffect(() => {
    if (!vocalFichier) {
      setVocalUrl(null)
      return
    }
    const url = URL.createObjectURL(vocalFichier)
    setVocalUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [vocalFichier])

  const etapeIntermediaire = sousTypeChoisi?.capturePhotoDirecte
    ? 'photo'
    : sousTypeChoisi?.choixSousType
      ? 'sousType'
      : sousTypeChoisi?.notation
        ? 'notation'
        : null

  const ETAPE_TYPE = 1
  const ETAPE_INTER = etapeIntermediaire ? 2 : null
  const ETAPE_MESSAGE = etapeIntermediaire ? 3 : 2
  const ETAPE_RECAP = etapeIntermediaire ? 4 : 3
  const TOTAL_ETAPES = ETAPE_RECAP
  const ETAPE_SUCCES = TOTAL_ETAPES + 1

  const LIBELLE_ETAPE = { [ETAPE_TYPE]: t('signalement.etapeType'), [ETAPE_MESSAGE]: t('espaceDossier.message'), [ETAPE_RECAP]: t('reclamation.etapeRecapitulatif') }
  if (ETAPE_INTER) {
    LIBELLE_ETAPE[ETAPE_INTER] = etapeIntermediaire === 'photo' ? t('signalement.etapePhoto') : etapeIntermediaire === 'sousType' ? t('signalement.etapePrecision') : t('signalement.etapeNotation')
  }

  const messageValide = texte.trim().length > 0 || !!vocalFichier || (etapeIntermediaire === 'notation' && notationResume.trim().length > 0)

  function allerA(cible) {
    setDirection(cible > etape ? 'avant' : 'arriere')
    setEtape(cible)
  }

  function choisirType(st) {
    setSousTypeChoisi(st)
    setTimeout(() => allerA(2), 420)
  }

  function choisirSousChoix(valeur) {
    setSousChoix(valeur)
    setTimeout(() => allerA(ETAPE_MESSAGE), 420)
  }

  function reinitialiser() {
    setSousTypeChoisi(null)
    setSousChoix('')
    setPhoto(null)
    setNotationResume('')
    setNotationCle((k) => k + 1)
    setTexte('')
    setVocalFichier(null)
    setVocalCle((k) => k + 1)
    setConfettis([])
    allerA(1)
  }

  async function envoyer() {
    const destination = resoudreDestinationDemande(sousTypeChoisi, categories, typesParCategorie)
    if (!destination) {
      toast.error(t('espaceDossier.dossierIndisponible'))
      return
    }
    const optionChoisie = sousTypeChoisi.choixSousType?.options.find((o) => o.valeur === sousChoix)
    const libelleEffectif = optionChoisie ? t(optionChoisie.libelleLong) : t(sousTypeChoisi.label)

    const codePrefixe = `${sousTypeChoisi.code}-${getInitials(currentUserName)}`
    const refBase = `${codePrefixe}-${Date.now()}`
    const titre = `${codePrefixe} — ${libelleEffectif}`
    const resumeComplet = [
      optionChoisie ? `${t(sousTypeChoisi.choixSousType.question)} ${t(optionChoisie.label)}` : null,
      texte.trim(),
      notationResume.trim(),
    ].filter(Boolean).join('\n\n') || t(sousTypeChoisi.label)
    // Un vocal reste joint tel quel (voir plus bas) — sauf s'il y a une photo,
    // qui prime comme pièce déposée (Incident).
    const avecAudioLie = !photo && !!vocalFichier

    try {
      setEnvoiEnCours(true)
      // Une photo (Incident) prime comme pièce déposée ; sinon un PDF lisible
      // (texte tapé ou transcrit) reste toujours le document principal — même
      // sans reconnaissance vocale disponible, le message tapé/la notation
      // suffisent à le remplir (le modèle de document exige toujours un
      // fichier). Même principe que ReclamationForm.jsx.
      let fichier
      if (photo) {
        fichier = photo
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
        // Même convention que les dépôts multi-pages (EspaceDossier.jsx) : un
        // suffixe "-1"/"-2" commun rattache le message vocal d'origine à son
        // signalement — DocView.jsx (fetchPagesLiees) les retrouve alors comme
        // "pages liées" du même dépôt, dans le même dossier, sous le même nom.
        reference: avecAudioLie ? `${refBase}-1` : refBase,
        file_create_date: fichier.lastModified || Date.now(),
      }, fichier)

      if (res.status !== 201) {
        toast.error(t('signalement.envoiEchoue'))
        return
      }

      if (avecAudioLie) {
        const resAudio = await createDocument({
          category_id: destination.categorie_id,
          type_document_id: destination.type_document_id,
          titre,
          auteur: currentUserName,
          nom_personne_concernee: currentUserName,
          resume: t('signalement.resumeVocal', { libelle: libelleEffectif }),
          texte_extrait: texte || undefined,
          reference: `${refBase}-2`,
          file_create_date: vocalFichier.lastModified || Date.now(),
        }, vocalFichier)
        if (resAudio.status !== 201) {
          toast.warning(t('signalement.audioNonJoint'))
        }
      }

      setConfettis(genererConfettis())
      allerA(ETAPE_SUCCES)
      onEnvoye && onEnvoye()
    } catch (error) {
      console.log(error)
      toast.error(t('signalement.envoiErreur'))
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
      minHeight={460}
    >
      {etape === ETAPE_TYPE && (
        <>
          <WizardStepHeader eyebrow={t('demandes.signalement')} titre={t('signalement.deQuoiParler')} sousTitre={t('signalement.choisissezSituation')} />
          <div className='flex flex-col gap-2'>
            {SOUS_TYPES_SIGNALEMENT.map((st, i) => (
              <WizardChoiceCard
                key={st.id}
                icon={st.icon}
                label={t(st.label)}
                picked={sousTypeChoisi?.id === st.id}
                onClick={() => choisirType(st)}
                delayMs={i * 50}
              />
            ))}
          </div>
        </>
      )}

      {etapeIntermediaire === 'photo' && etape === ETAPE_INTER && (
        <>
          <WizardStepHeader eyebrow={t('demandes.signalement')} titre={t('signalement.unePhoto')} sousTitre={t('signalement.photoFacultative')} />
          <label className='relative flex items-center gap-3 rounded-2xl p-4 cursor-pointer border-2 border-black bg-card text-foreground shadow-sm transition-transform active:scale-[0.99]'>
            <span className='w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center shrink-0'>
              <LuAperture size={20} />
            </span>
            <div className='min-w-0 flex-1'>
              <div className='text-sm font-semibold text-foreground'>{photo ? t('signalement.reprendrePhoto') : t('signalement.joindrePhoto')}</div>
              <div className='text-xs text-muted-foreground'>{t('signalement.ouvreAppareilPhoto')}</div>
            </div>
            {photo && <LuCheck size={18} className='text-emerald-600 shrink-0' />}
            <input type='file' accept={ACCEPT_PHOTO} capture='environment' className='hidden' onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
          </label>
          <div className='flex gap-2 mt-auto'>
            <button type='button' onClick={() => allerA(ETAPE_TYPE)} className='rounded-xl bg-muted px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/70 transition-transform duration-150 active:scale-95'>
              {t('reclamation.retour')}
            </button>
            <button type='button' onClick={() => allerA(ETAPE_MESSAGE)} className='flex-1 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95'>
              {t('reclamation.suivant')}
            </button>
          </div>
        </>
      )}

      {etapeIntermediaire === 'sousType' && etape === ETAPE_INTER && (
        <>
          <WizardStepHeader eyebrow={t('demandes.signalement')} titre={t(sousTypeChoisi.choixSousType.question)} />
          <div className='flex flex-col gap-2'>
            {sousTypeChoisi.choixSousType.options.map((o, i) => (
              <WizardChoiceCard key={o.valeur} icon={o.icon} label={t(o.label)} picked={sousChoix === o.valeur} onClick={() => choisirSousChoix(o.valeur)} delayMs={i * 60} />
            ))}
          </div>
        </>
      )}

      {etapeIntermediaire === 'notation' && etape === ETAPE_INTER && (
        <>
          <WizardStepHeader eyebrow={t('demandes.signalement')} titre={t('signalement.notezAuxiliaires')} sousTitre={t('signalement.glissezPourChanger')} />
          <NotationAuxiliaires key={notationCle} onChange={setNotationResume} />
          <div className='flex gap-2 mt-auto'>
            <button type='button' onClick={() => allerA(ETAPE_TYPE)} className='rounded-xl bg-muted px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/70 transition-transform duration-150 active:scale-95'>
              {t('reclamation.retour')}
            </button>
            <button type='button' onClick={() => allerA(ETAPE_MESSAGE)} className='flex-1 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95'>
              {t('reclamation.suivant')}
            </button>
          </div>
        </>
      )}

      {etape === ETAPE_MESSAGE && (
        <>
          <WizardStepHeader
            eyebrow={t('demandes.signalement')}
            titre={etapeIntermediaire === 'notation' ? t('signalement.remarqueGenerale') : t('reclamation.decrivezSituation')}
            sousTitre={etapeIntermediaire === 'notation' ? t('signalement.optionnelSiNotes') : t('signalement.leplusPrecisementPossible')}
          />
          <VoiceRecorder
            key={vocalCle}
            valeurTexte={texte}
            onChangeTexte={setTexte}
            placeholder={t('reclamation.ecrivezIci')}
            onChangeVocal={(fichierAudio, transcript) => { setTexte(transcript); setVocalFichier(fichierAudio) }}
            className='flex-1'
            variante='wizard'
          />
          <div className='flex gap-2 mt-auto'>
            <button type='button' onClick={() => allerA(ETAPE_INTER || ETAPE_TYPE)} className='rounded-xl bg-muted px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/70 transition-transform duration-150 active:scale-95'>
              {t('reclamation.retour')}
            </button>
            <button
              type='button'
              disabled={!messageValide}
              onClick={() => allerA(ETAPE_RECAP)}
              className='flex-1 rounded-xl bg-gradient-to-br from-accent to-[#D9A80A] px-4 py-3 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/40 transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:shadow-none'
            >
              {t('reclamation.suivant')}
            </button>
          </div>
        </>
      )}

      {etape === ETAPE_RECAP && (
        <>
          <WizardStepHeader eyebrow={t('demandes.signalement')} titre={t('reclamation.verifiezAvantEnvoi')} sousTitre={t('reclamation.dernierCoupOeil')} />
          <div className='flex flex-col gap-2.5'>
            <WizardReviewLine label={t('signalement.type')} valeur={t(sousTypeChoisi.label)} onModifier={() => allerA(ETAPE_TYPE)} delayMs={0} />
            {etapeIntermediaire === 'sousType' && (
              <WizardReviewLine
                label={t(sousTypeChoisi.choixSousType.question)}
                valeur={t(sousTypeChoisi.choixSousType.options.find((o) => o.valeur === sousChoix)?.label)}
                onModifier={() => allerA(ETAPE_INTER)}
                delayMs={50}
              />
            )}
            {etapeIntermediaire === 'photo' && (
              <WizardReviewLine label={t('signalement.photo')} valeur={photo ? photo.name : t('signalement.aucune')} onModifier={() => allerA(ETAPE_INTER)} delayMs={50} />
            )}
            {etapeIntermediaire === 'notation' && (
              <WizardReviewLine label={t('signalement.notation')} valeur={notationResume || t('signalement.aucune')} onModifier={() => allerA(ETAPE_INTER)} delayMs={50} multiline />
            )}
            <WizardReviewLine
              label={t('espaceDossier.message')}
              valeur={texte || (vocalFichier ? t('signalement.messageVocalEnregistre') : '')}
              onModifier={() => allerA(ETAPE_MESSAGE)}
              delayMs={100}
              multiline
            />
            {!photo && vocalUrl && (
              <div className='rounded-2xl bg-muted/60 px-3.5 py-3 opacity-0 animate-wizard-card-in' style={{ animationDelay: '150ms' }}>
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
            <LuSend size={15} /> {envoiEnCours ? t('reclamation.envoiEnCours') : t('signalement.envoyerSignalement')}
          </button>
        </>
      )}

      {etape === ETAPE_SUCCES && (
        <WizardSuccess
          titre={t('signalement.signalementEnvoye')}
          sousTitre={t('signalement.equipeNotifiee')}
          confettis={confettis}
          onReset={reinitialiser}
          libelleReset={t('signalement.nouveauSignalement')}
        />
      )}
    </WizardShell>
  )
}

export default SignalementForm
