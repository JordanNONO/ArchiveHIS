import React, { useMemo, useRef, useState } from 'react'
import { LuMic, LuSquare, LuTrash2, LuPlay, LuPause, LuX, LuLoader2 } from 'react-icons/lu'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import { SpeechRecognitionImpl, enregistrementSupporte, useEnregistreurVocal } from '../hooks/useEnregistreurVocal'

const DUREE_MAX_SECONDES = 180 // 3 min — au-delà, l'enregistrement se termine tout seul.
const ALERTE_FIN_SECONDES = 15

// Langues proposées pour la transcription — les bénéficiaires ne parlent pas
// tous français. Codes BCP-47 reconnus par la Web Speech API.
const LANGUES_TRANSCRIPTION = [
  { code: 'fr-FR', label: 'Français' },
  { code: 'ar-SA', label: 'العربية' },
  { code: 'en-US', label: 'English' },
  { code: 'es-ES', label: 'Español' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'pt-PT', label: 'Português' },
]
const CLE_LANGUE_STOCKEE = 'his_archive_langue_vocal'

function langueInitiale(langueAppli) {
  try {
    const stockee = localStorage.getItem(CLE_LANGUE_STOCKEE)
    if (stockee) return stockee
  } catch {
    // stockage indisponible (navigation privée)
  }
  const prefixe = (langueAppli || 'fr').slice(0, 2)
  return LANGUES_TRANSCRIPTION.find((l) => l.code.startsWith(prefixe))?.code || 'fr-FR'
}

function formatDuree(secondes) {
  const total = Math.max(0, Math.floor(secondes))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

// Niveau RMS (0..~0,5) → hauteur de barre (0..1), compressée pour qu'une voix
// normale remplisse la barre sans saturer.
function hauteurBarre(rms) {
  return Math.min(1, Math.sqrt(rms) * 2.4)
}

// Forme d'onde réelle de l'enregistrement : les niveaux mesurés pendant la
// prise, regroupés en `nombre` barres (pic de chaque tranche).
function formeOnde(niveaux, nombre) {
  if (!niveaux?.length) return Array(nombre).fill(0.15)
  const barres = []
  for (let i = 0; i < nombre; i++) {
    const debut = Math.floor((i * niveaux.length) / nombre)
    const fin = Math.max(debut + 1, Math.floor(((i + 1) * niveaux.length) / nombre))
    barres.push(Math.max(...niveaux.slice(debut, fin)))
  }
  const max = Math.max(...barres) || 1
  return barres.map((b) => Math.max(0.08, b / max))
}

/**
 * Champ de message avec dictée vocale, façon messagerie : un champ texte et, à
 * côté, un bouton rond qui change de rôle selon l'état (micro pour démarrer,
 * carré pour terminer). Pendant l'enregistrement : vrai niveau sonore en
 * direct, durée (3 min max, fin automatique), pause, annulation, et le texte
 * reconnu qui s'affiche au fur et à mesure. Ensuite : lecteur (vraie forme
 * d'onde, progression, déplacement dans l'écoute) et le champ texte reste
 * visible pour corriger ou compléter — c'est ce texte qui reste dans le
 * dossier quand l'audio est purgé au bout de 3 jours (PurgerFichiersAudio).
 *
 * Logique d'enregistrement/transcription : voir useEnregistreurVocal.
 *
 * `onChangeVocal(fichierAudio, transcription)` est appelé une fois
 * l'enregistrement terminé ; `fichierAudio` vaut `null` après suppression.
 *
 * `variante` : 'compact' (formulaire générique d'EspaceDossier.jsx) ou
 * 'wizard' (même cadre que les autres champs du wizard, voir
 * WIZARD_TEXTAREA_CLS dans wizard/Wizard.jsx, et le champ s'étire jusqu'aux
 * boutons Retour/Suivant).
 */
function VoiceRecorder({ valeurTexte, onChangeTexte, placeholder, requis, onChangeVocal, className = '', variante = 'compact', maxLength }) {
  const { t, i18n } = useTranslation()
  const [langue, setLangue] = useState(() => langueInitiale(i18n.language))
  const audioRef = useRef(null)
  const [lecture, setLecture] = useState({ enCours: false, position: 0, impossible: false })

  const vocal = useEnregistreurVocal({
    langue,
    dureeMaxSecondes: DUREE_MAX_SECONDES,
    onTermine: (fichier, texte) => {
      setLecture({ enCours: false, position: 0, impossible: false })
      // Une dictée part facilement plus loin qu'un texte tapé : même limite
      // que le champ, pour ne pas déborder du gabarit PDF.
      onChangeVocal?.(fichier, maxLength ? texte.slice(0, maxLength) : texte)
    },
    onErreur: (cle) => (cle === 'micCoupe' ? toast.warning : toast.error)(t(`voiceRecorder.${cle}`)),
  })
  const { etat, enregistrement } = vocal

  const barresLecture = useMemo(() => formeOnde(enregistrement?.niveaux, 40), [enregistrement])

  function changerLangue(code) {
    setLangue(code)
    try {
      localStorage.setItem(CLE_LANGUE_STOCKEE, code)
    } catch {
      // stockage indisponible : le choix vaut pour cette page
    }
  }

  function supprimer() {
    audioRef.current?.pause()
    vocal.supprimer()
    onChangeVocal?.(null, '')
  }

  function basculerLecture() {
    const audio = audioRef.current
    if (!audio) return
    if (lecture.enCours) {
      audio.pause()
      return
    }
    audio.play().catch(() => setLecture((l) => ({ ...l, impossible: true })))
  }

  function deplacerLecture(e) {
    const audio = audioRef.current
    if (!audio || !enregistrement) return
    const zone = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - zone.left) / zone.width))
    try {
      audio.currentTime = ratio * enregistrement.duree
      const position = audio.currentTime
      setLecture((l) => ({ ...l, position }))
    } catch {
      // certains enregistrements WebM ne permettent pas le déplacement
    }
  }

  const estWizard = variante === 'wizard'
  const rayon = estWizard ? 'rounded-2xl' : 'rounded-lg'
  // text-base sous sm: : sous 16px, les navigateurs mobiles zooment toute la
  // page au focus du champ (même correctif que Login.jsx/Inscription.jsx).
  const champCls = estWizard
    ? 'w-full rounded-2xl border-[1.5px] border-border bg-background px-3.5 py-3 text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow resize-none'
    : 'w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const rangees = estWizard ? 6 : 2
  const boutonRond = 'flex items-center justify-center w-11 h-11 rounded-full shrink-0 transition-colors'
  // Un enfant flex refuse par défaut de descendre sous la taille de son
  // contenu : min-h-0 à chaque niveau pour que le champ s'étire en wizard.
  const conteneurCls = estWizard ? `flex min-h-0 flex-col ${className}` : className

  const compteur = maxLength ? (
    <span className={`${estWizard ? 'self-end shrink-0' : 'block text-right'} text-[11px] text-muted-foreground tabular-nums mt-1`}>
      {(valeurTexte || '').length}/{maxLength}
    </span>
  ) : null

  const champTexte = (classesSupp = '') => (
    <textarea
      value={valeurTexte}
      onChange={(e) => onChangeTexte(e.target.value)}
      rows={rangees}
      required={requis}
      maxLength={maxLength}
      className={`${champCls} ${classesSupp}`}
      placeholder={placeholder}
    />
  )

  // Pas d'enregistrement possible (navigateur trop ancien, http://) : simple
  // champ texte — le clavier du téléphone garde sa propre dictée.
  if (!onChangeVocal || !enregistrementSupporte()) {
    return (
      <div className={conteneurCls}>
        {champTexte(estWizard ? 'flex-1 min-h-0' : '')}
        {compteur}
      </div>
    )
  }

  // --- Enregistrement en cours ----------------------------------------------
  if (etat === 'enregistrement' || etat === 'pause' || etat === 'finalisation') {
    const enPause = etat === 'pause'
    const finalisation = etat === 'finalisation'
    const restant = DUREE_MAX_SECONDES - vocal.duree
    const barres = [...Array(Math.max(0, 32 - vocal.niveauxRecents.length)).fill(0), ...vocal.niveauxRecents]
    const noteTranscription = vocal.etatTranscription === 'indisponible' ? t('voiceRecorder.transcriptionIndisponible')
      : vocal.etatTranscription === 'coupee' ? t('voiceRecorder.transcriptionCoupee') : null

    return (
      <div className={`${conteneurCls} gap-2 ${estWizard ? '' : 'flex flex-col'}`} aria-live='polite'>
        <div className='flex items-center gap-2 min-w-0'>
          <button
            type='button'
            onClick={vocal.annuler}
            disabled={finalisation}
            title={t('voiceRecorder.annuler')}
            aria-label={t('voiceRecorder.annuler')}
            className={`${boutonRond} text-muted-foreground hover:bg-muted disabled:opacity-40`}
          >
            <LuX size={18} />
          </button>
          <div className={`flex-1 min-w-0 flex items-center gap-2.5 ${rayon} border px-2.5 h-12 ${enPause ? 'border-border bg-muted/50' : 'border-destructive/30 bg-destructive/5'}`}>
            <button
              type='button'
              onClick={enPause ? vocal.reprendre : vocal.mettreEnPause}
              disabled={finalisation}
              title={enPause ? t('voiceRecorder.reprendre') : t('voiceRecorder.mettreEnPause')}
              aria-label={enPause ? t('voiceRecorder.reprendre') : t('voiceRecorder.mettreEnPause')}
              className='flex items-center justify-center w-8 h-8 rounded-full bg-background border border-border text-foreground shrink-0 disabled:opacity-40'
            >
              {enPause ? <LuPlay size={13} className='ml-0.5' /> : <LuPause size={13} />}
            </button>
            <div className='flex-1 min-w-0 flex items-center gap-[2px] h-7 overflow-hidden' aria-hidden='true'>
              {barres.map((rms, i) => (
                <span
                  key={i}
                  className={`flex-1 min-w-[2px] rounded-full transition-[height] duration-100 ${enPause ? 'bg-muted-foreground/40' : 'bg-destructive/70'}`}
                  style={{ height: `${Math.max(8, hauteurBarre(rms) * 100)}%` }}
                />
              ))}
            </div>
            <span className={`text-sm font-medium tabular-nums shrink-0 ${enPause ? 'text-muted-foreground' : 'text-destructive'}`}>
              {!enPause && <span className='inline-block w-2 h-2 rounded-full bg-destructive animate-pulse mr-1.5 align-middle' />}
              {formatDuree(vocal.duree)}
            </span>
          </div>
          <button
            type='button'
            onClick={() => vocal.terminer()}
            disabled={finalisation}
            title={t('voiceRecorder.terminerEtEnvoyer')}
            aria-label={t('voiceRecorder.terminerEtEnvoyer')}
            className={`${boutonRond} bg-destructive text-white hover:bg-destructive/90 disabled:opacity-60`}
          >
            {finalisation ? <LuLoader2 size={17} className='animate-spin' /> : <LuSquare size={15} fill='currentColor' />}
          </button>
        </div>

        {restant <= ALERTE_FIN_SECONDES && !finalisation && (
          <p className='text-xs font-medium text-amber-600 text-center'>{t('voiceRecorder.secondesRestantes', { count: Math.ceil(restant) })}</p>
        )}

        <div className={`${rayon} border border-dashed border-border px-3.5 py-2.5 text-sm overflow-y-auto ${estWizard ? 'flex-1 min-h-[6rem]' : 'min-h-[3.5rem] max-h-40'}`}>
          {vocal.transcription
            ? <p className='whitespace-pre-wrap text-foreground'>{vocal.transcription}</p>
            : <p className='text-muted-foreground'>{noteTranscription || t('voiceRecorder.parlez')}</p>}
          {vocal.transcription && noteTranscription && <p className='text-xs text-muted-foreground mt-1.5'>{noteTranscription}</p>}
        </div>
      </div>
    )
  }

  const selecteurLangue = SpeechRecognitionImpl && (
    <div className='flex justify-end mb-1 shrink-0'>
      <select
        value={langue}
        onChange={(e) => changerLangue(e.target.value)}
        title={t('voiceRecorder.langueMessageVocal')}
        aria-label={t('voiceRecorder.langueMessageVocal')}
        className='text-base sm:text-[11px] font-medium text-muted-foreground bg-transparent border-none py-0 pl-0 pr-4 focus:outline-none cursor-pointer hover:text-foreground'
      >
        {LANGUES_TRANSCRIPTION.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </div>
  )

  // --- Message vocal prêt : lecteur + texte modifiable ----------------------
  if (etat === 'pret' && enregistrement) {
    const progression = enregistrement.duree ? Math.min(1, lecture.position / enregistrement.duree) : 0
    return (
      <div className={`${conteneurCls} ${estWizard ? '' : 'flex flex-col'} gap-2`}>
        <audio
          ref={audioRef}
          src={enregistrement.url}
          preload='metadata'
          onPlay={() => setLecture((l) => ({ ...l, enCours: true }))}
          onPause={() => setLecture((l) => ({ ...l, enCours: false }))}
          onEnded={() => setLecture((l) => ({ ...l, enCours: false, position: 0 }))}
          onTimeUpdate={(e) => {
            // Lu tout de suite : e.currentTarget vaut null quand la mise à jour
            // d'état s'exécute plus tard.
            const position = e.currentTarget.currentTime
            setLecture((l) => ({ ...l, position }))
          }}
          onError={() => setLecture((l) => ({ ...l, impossible: true }))}
          className='hidden'
        />
        <div className='flex items-center gap-2 min-w-0 shrink-0'>
          <div className={`flex-1 min-w-0 flex items-center gap-2.5 ${rayon} border border-border bg-primary/5 px-2.5 h-12`}>
            <button
              type='button'
              onClick={basculerLecture}
              disabled={lecture.impossible}
              title={lecture.enCours ? t('voiceRecorder.pauseEcoute') : t('voiceRecorder.ecouter')}
              aria-label={lecture.enCours ? t('voiceRecorder.pauseEcoute') : t('voiceRecorder.ecouter')}
              className='flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white shrink-0 disabled:opacity-40'
            >
              {lecture.enCours ? <LuPause size={13} /> : <LuPlay size={13} className='ml-0.5' />}
            </button>
            <div
              className='flex-1 min-w-0 flex items-center gap-[2px] h-7 cursor-pointer'
              onClick={deplacerLecture}
              role='slider'
              aria-label={t('voiceRecorder.messageVocal')}
              aria-valuemin={0}
              aria-valuemax={Math.round(enregistrement.duree)}
              aria-valuenow={Math.round(lecture.position)}
            >
              {barresLecture.map((h, i) => (
                <span
                  key={i}
                  className={`flex-1 min-w-[2px] rounded-full ${i / barresLecture.length < progression ? 'bg-primary' : 'bg-primary/30'}`}
                  style={{ height: `${h * 100}%` }}
                />
              ))}
            </div>
            <span className='text-xs text-muted-foreground tabular-nums shrink-0'>
              {formatDuree(lecture.enCours || lecture.position ? lecture.position : enregistrement.duree)}
            </span>
          </div>
          <button
            type='button'
            onClick={supprimer}
            title={t('voiceRecorder.supprimerMessageVocal')}
            aria-label={t('voiceRecorder.supprimerMessageVocal')}
            className={`${boutonRond} border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive`}
          >
            <LuTrash2 size={16} />
          </button>
        </div>
        {lecture.impossible && <p className='text-xs text-muted-foreground shrink-0'>{t('voiceRecorder.lectureImpossible')}</p>}
        {champTexte(estWizard ? 'flex-1 min-h-0' : '')}
        {compteur}
      </div>
    )
  }

  // --- Repos : champ texte + micro -------------------------------------------
  const demarrage = etat === 'demarrage'
  const boutonMicro = (
    <button
      type='button'
      onClick={vocal.demarrer}
      disabled={demarrage}
      title={t('voiceRecorder.messageVocal')}
      aria-label={t('voiceRecorder.messageVocal')}
      className={`${boutonRond} self-end border border-border text-primary hover:bg-primary/10 disabled:opacity-60`}
    >
      {demarrage ? <LuLoader2 size={17} className='animate-spin' /> : <LuMic size={17} />}
    </button>
  )

  // En wizard, la ligne texte + micro est une grille (colonne flexible +
  // colonne fixe) : sans ambiguïté de taille, contrairement à un flex-grow
  // imbriqué dans un conteneur de hauteur `auto`.
  return (
    <div className={conteneurCls}>
      {selecteurLangue}
      <div className={estWizard ? 'grid grid-cols-[1fr_auto] items-stretch gap-2 flex-1 min-h-0' : 'flex items-end gap-2'}>
        {champTexte(estWizard ? 'h-full min-h-0' : 'flex-1')}
        {boutonMicro}
      </div>
      {compteur}
    </div>
  )
}

export default VoiceRecorder
