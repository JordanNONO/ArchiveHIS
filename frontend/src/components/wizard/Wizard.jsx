import React, { useState } from 'react'
import { LuArrowLeft, LuCheck } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'
import FiligraneHIS from '../FiligraneHIS'

/**
 * Briques partagées d'un parcours séquentiel animé (une question à la fois,
 * façon assistant d'installation) — fond en mesh, carte en verre, pilules de
 * progression, cartes à ressort avec ripple au tap, écran de succès animé
 * avec confettis. Introduit avec ReclamationForm.jsx (maquette approuvée),
 * puis réutilisé tel quel pour les autres parcours (Congés, Signalement...)
 * plutôt que de recopier la même mécanique dans chaque formulaire.
 *
 * Les keyframes (wizard-drift-a, wizard-card-in, wizard-ripple, wizard-rise-in,
 * wizard-ring-pop, wizard-ring-expand, wizard-circle-draw, wizard-check-draw,
 * wizard-confetto-fly) et les animations d'étape (step-in-right/left) sont
 * définies globalement — voir index.css et tailwind.config.js.
 */

/**
 * Cadre de champ texte commun à tous les wizards (Réclamation, Prestation,
 * Signalement...) — utilisé directement pour un <textarea> local, ou passé à
 * VoiceRecorder via sa prop `variante='wizard'` pour qu'un champ
 * message/vocal reprenne exactement le même cadre que les autres champs du
 * même parcours plutôt que son style resserré par défaut.
 */
export const WIZARD_TEXTAREA_CLS = 'w-full flex-1 rounded-2xl border-[1.5px] border-border bg-background px-3.5 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-shadow resize-none'

export function WizardShell({ etape, totalEtapes, libelleEtape, direction, peutRetour, onRetour, children, minHeight = 400 }) {
  const { t } = useTranslation()
  const animEtape = direction === 'avant' ? 'animate-step-in-right' : 'animate-step-in-left'
  const etapeActuelle = Math.min(etape, totalEtapes)
  const termine = etape > totalEtapes

  return (
    <div className='relative overflow-hidden rounded-3xl'>
      {/* Fond en mesh animé, contenu dans les limites du composant */}
      <div className='pointer-events-none absolute -top-24 -left-16 w-64 h-64 rounded-full bg-primary/25 blur-3xl animate-wizard-drift-a' />
      <div className='pointer-events-none absolute -bottom-20 -right-14 w-56 h-56 rounded-full bg-accent/25 blur-3xl animate-wizard-drift-b' />

      <div className='relative flex items-center gap-2.5 px-5 pt-5'>
        {peutRetour ? (
          <button
            type='button'
            onClick={onRetour}
            className='flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-transform duration-200 active:scale-90 active:-rotate-6 shrink-0'
          >
            <LuArrowLeft size={15} />
          </button>
        ) : (
          <div className='w-8 shrink-0' />
        )}
        <div className='flex-1 flex flex-col gap-1.5'>
          <div className='flex gap-1.5'>
            {Array.from({ length: totalEtapes }, (_, i) => i + 1).map((n) => (
              <div key={n} className='flex-1 h-1.5 rounded-full bg-muted overflow-hidden'>
                <div
                  className={`h-full rounded-full bg-primary origin-left transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] ${
                    n === etapeActuelle && !termine ? 'shadow-[0_0_10px_1px_rgba(27,54,93,0.55)]' : ''
                  }`}
                  style={{ transform: n <= etapeActuelle ? 'scaleX(1)' : 'scaleX(0)' }}
                />
              </div>
            ))}
          </div>
          <span className='text-[11px] font-semibold text-muted-foreground'>
            {termine ? t('wizard.envoye') : t('wizard.etapeSur', { etape, total: totalEtapes, libelle: libelleEtape })}
          </span>
        </div>
      </div>

      <div className='relative isolate mt-4 rounded-[26px] border border-border/70 bg-card/90 backdrop-blur-xl shadow-[0_1px_2px_rgba(16,26,44,0.05),0_30px_60px_-28px_rgba(16,26,44,0.35)] overflow-hidden'>
        <FiligraneHIS />
        <div className='relative p-5 flex flex-col overflow-hidden' style={{ minHeight }}>
          <div key={etape} className={`flex flex-1 flex-col gap-4 ${animEtape}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export function WizardStepHeader({ eyebrow, titre, sousTitre }) {
  return (
    <div>
      <p className='text-[11px] font-extrabold uppercase tracking-wider text-primary'>{eyebrow}</p>
      <h2 className='text-xl font-extrabold tracking-tight mt-0.5'>{titre}</h2>
      {sousTitre && <p className='text-xs text-muted-foreground mt-1'>{sousTitre}</p>}
    </div>
  )
}

export function WizardChoiceCard({ icon: Icon, label, picked, onClick, delayMs = 0 }) {
  const [ripple, setRipple] = useState(null)

  function gererClic(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const taille = Math.max(rect.width, rect.height) * 1.4
    const id = Date.now()
    setRipple({
      id,
      taille,
      x: (e.clientX ?? rect.left + rect.width / 2) - rect.left - taille / 2,
      y: (e.clientY ?? rect.top + rect.height / 2) - rect.top - taille / 2,
    })
    setTimeout(() => setRipple((r) => (r?.id === id ? null : r)), 650)
    onClick()
  }

  return (
    <button
      type='button'
      onClick={gererClic}
      style={{ animationDelay: `${delayMs}ms` }}
      className={`relative overflow-hidden flex items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-3 text-left transition-all duration-200 active:scale-[0.97] opacity-0 animate-wizard-card-in ${
        picked ? 'border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(27,54,93,0.12)]' : 'border-border hover:border-primary/40 hover:-translate-y-px'
      }`}
    >
      {ripple && (
        <span
          className='absolute rounded-full bg-primary/20 pointer-events-none animate-wizard-ripple'
          style={{ width: ripple.taille, height: ripple.taille, left: ripple.x, top: ripple.y }}
        />
      )}
      <span className={`relative flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] ${picked ? 'bg-primary text-white scale-110 -rotate-6' : 'bg-primary/10 text-primary'}`}>
        <Icon size={16} />
      </span>
      <span className='relative text-sm font-semibold flex-1'>{label}</span>
      <span className={`relative flex items-center justify-center w-5 h-5 rounded-full border shrink-0 transition-colors duration-200 ${picked ? 'bg-primary border-primary scale-105' : 'border-border'}`}>
        {picked && <LuCheck size={11} className='text-white' />}
      </span>
    </button>
  )
}

export function WizardReviewLine({ label, valeur, onModifier, delayMs = 0, multiline = false }) {
  const { t } = useTranslation()
  return (
    <div className='flex items-start justify-between gap-3 rounded-2xl bg-muted/60 px-3.5 py-3 opacity-0 animate-wizard-card-in' style={{ animationDelay: `${delayMs}ms` }}>
      <div className='min-w-0'>
        <p className='text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5'>{label}</p>
        <p className={`text-sm font-semibold ${multiline ? 'line-clamp-3' : 'truncate'}`}>{valeur || '—'}</p>
      </div>
      {onModifier && <button type='button' onClick={onModifier} className='shrink-0 text-xs font-bold text-primary'>{t('wizard.modifier')}</button>}
    </div>
  )
}

const FORMES_CONFETTI = ['50%', '3px', '1px 8px']
const COULEURS_CONFETTI = ['bg-accent', 'bg-primary', 'bg-emerald-600']

/** À appeler au moment du succès : renvoie une nouvelle salve de confettis à passer à WizardSuccess. */
export function genererConfettis(n = 16) {
  return Array.from({ length: n }, (_, i) => {
    const angle = Math.random() * Math.PI * 2
    const distance = 50 + Math.random() * 40
    return {
      id: `${Date.now()}-${i}`,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance - 20,
      rot: (Math.random() - 0.5) * 360,
      taille: 5 + Math.random() * 4,
      forme: FORMES_CONFETTI[i % FORMES_CONFETTI.length],
      couleur: COULEURS_CONFETTI[i % COULEURS_CONFETTI.length],
      delai: 0.3 + Math.random() * 0.15,
    }
  })
}

export function WizardSuccess({ titre, sousTitre, confettis, onReset, libelleReset }) {
  const { t } = useTranslation()
  const libelle = libelleReset ?? t('wizard.recommencer')
  return (
    <div className='flex flex-1 flex-col items-center justify-center text-center gap-3.5'>
      <div className='relative w-[100px] h-[100px]'>
        <span className='absolute inset-0 rounded-full bg-emerald-600/10 animate-wizard-ring-pop' />
        <span className='absolute inset-2 rounded-full border-2 border-emerald-600/35 animate-wizard-ring-expand' />
        <svg viewBox='0 0 52 52' className='absolute inset-0 m-auto w-[50px] h-[50px]'>
          <circle
            cx='26' cy='26' r='24' fill='none' stroke='#1E8E5A' strokeWidth='2.4' strokeDasharray='151'
            style={{ strokeDashoffset: 151, animation: 'wizard-circle-draw 0.5s cubic-bezier(0.22,1,0.36,1) 0.15s forwards' }}
          />
          <path
            d='M15 27l7 7 15-15' fill='none' stroke='#1E8E5A' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' strokeDasharray='32'
            style={{ strokeDashoffset: 32, animation: 'wizard-check-draw 0.35s cubic-bezier(0.22,1,0.36,1) 0.55s forwards' }}
          />
        </svg>
        {confettis.map((c) => (
          <span
            key={c.id}
            className={`absolute left-1/2 top-1/2 opacity-0 ${c.couleur}`}
            style={{
              width: c.taille, height: c.taille, borderRadius: c.forme,
              '--dx': `${c.dx}px`, '--dy': `${c.dy}px`, '--rot': `${c.rot}deg`,
              animation: `wizard-confetto-fly 1.1s cubic-bezier(0.22,1,0.36,1) ${c.delai}s forwards`,
            }}
          />
        ))}
      </div>
      <div className='animate-wizard-rise-in' style={{ animationDelay: '.5s' }}>
        <h2 className='text-xl font-extrabold tracking-tight'>{titre}</h2>
        <p className='text-xs text-muted-foreground mt-1'>{sousTitre}</p>
      </div>
      {onReset && (
        <button type='button' onClick={onReset} className='text-xs font-bold text-primary mt-1 animate-wizard-rise-in' style={{ animationDelay: '.66s' }}>
          {libelle}
        </button>
      )}
    </div>
  )
}
