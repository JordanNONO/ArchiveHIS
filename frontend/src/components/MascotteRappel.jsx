import React from 'react';

/**
 * Petit personnage abstrait (une cloche à visage, cohérente avec l'icône de
 * notification 🔔) — utilisé pour l'accusé de lecture "vu par" (voir
 * NotificationBell.jsx, type 'lu') : incarne la réassurance envoyée à
 * l'expéditeur d'un partage/appel quand son destinataire l'a ouvert.
 * Volontairement minimal et géométrique (pas un vrai avatar illustré) pour
 * rester dans le ton sobre de l'appli plutôt que verser dans le mignon/
 * enfantin. `humeur` change juste la couleur et l'expression
 * (sourcils/bouche), jamais la forme de base.
 */
export const HUMEURS_MASCOTTE = {
  alerte: { tint: '#dc2626', bgTint: 'rgba(220,38,38,.12)', sourcil: -6, bouche: 'M9 15.5q3-1.6 6 0' },
  attention: { tint: '#b45309', bgTint: 'rgba(217,119,6,.12)', sourcil: 0, bouche: 'M9.5 15a2.5 2.5 0 005 0' },
  positif: { tint: '#16a34a', bgTint: 'rgba(22,163,74,.12)', sourcil: 3, bouche: 'M9 14q3 2.4 6 0' },
  neutre: { tint: '#1B365D', bgTint: 'rgba(27,54,93,.10)', sourcil: 0, bouche: 'M9.5 15h5' },
};

/** Glyphe seul (pas de fond) — pour s'insérer dans un conteneur déjà teinté, comme les pastilles de TYPE_VISUAL. */
export function GlypheMascotte({ humeur = 'neutre', size = 16 }) {
  const h = HUMEURS_MASCOTTE[humeur] || HUMEURS_MASCOTTE.neutre;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path
        d="M12 3.5c-3.6 0-5.6 2.7-5.6 6.4 0 3.8-1 5.6-1.9 6.6h15c-.9-1-1.9-2.8-1.9-6.6 0-3.7-2-6.4-5.6-6.4z"
        fill={h.tint}
        opacity="0.16"
        stroke={h.tint}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M9.6 18.8a2.6 2.6 0 004.8 0" stroke={h.tint} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="7.6" y1={9.5 - h.sourcil / 10} x2="10" y2={9.5 + h.sourcil / 10} stroke={h.tint} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="14" y1={9.5 + h.sourcil / 10} x2="16.4" y2={9.5 - h.sourcil / 10} stroke={h.tint} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9.3" cy="12" r="1" fill={h.tint} />
      <circle cx="14.7" cy="12" r="1" fill={h.tint} />
      <path d={h.bouche} stroke={h.tint} strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Version autonome (avec son propre fond circulaire teinté + animation d'apparition) — pour un usage isolé, hors d'une pastille déjà stylée. */
export default function MascotteRappel({ humeur = 'neutre', taillePastille = 36, tailleGlyphe = 20, className = '' }) {
  const h = HUMEURS_MASCOTTE[humeur] || HUMEURS_MASCOTTE.neutre;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 animate-mascotte-pop ${className}`}
      style={{ background: h.bgTint, width: taillePastille, height: taillePastille }}
    >
      <GlypheMascotte humeur={humeur} size={tailleGlyphe} />
    </span>
  );
}
