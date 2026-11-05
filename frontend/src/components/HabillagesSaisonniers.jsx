import React from 'react';

/**
 * Le dessin de chaque fête, superposé au logo — voir LogoSaisonnier.jsx.
 *
 * Un habillage = un composant dans HABILLAGES. Chacun se dessine dans un
 * carré de 100×100 en pourcentages, pour tenir quelle que soit la taille du
 * logo (80 px dans le menu, davantage ailleurs).
 *
 * Règles communes, volontairement strictes : rien ne bouge en moins de deux
 * secondes, aucune lumière ne clignote (l'opacité varie, jamais le tout ou
 * rien), et tout s'arrête quand le poste demande moins d'animations — voir
 * les classes `his-saison-*` dans index.css.
 */

const PLEIN_CADRE = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' };

/** Halloween — toile dans l'angle, araignée qui descend puis se balance. */
function Halloween() {
  return (
    <span style={PLEIN_CADRE} aria-hidden='true'>
      <svg viewBox='0 0 100 100' style={PLEIN_CADRE}>
        <g fill='none' stroke='#1B365D' strokeWidth='2.2' strokeLinecap='round' opacity='0.8'>
          <path d='M3 3 L3 44 M3 3 L44 3 M3 3 L33 33' />
          <path d='M3 14 Q10 12 14 3' />
          <path d='M3 25 Q18 20 25 3' />
          <path d='M3 36 Q26 28 36 3' />
        </g>
      </svg>
      <svg viewBox='0 0 30 76' className='his-saison-fil' style={{ position: 'absolute', top: 0, right: '14%', height: '78%', width: 'auto', pointerEvents: 'none' }}>
        <line x1='15' y1='0' x2='15' y2='48' stroke='#1B365D' strokeWidth='1.2' opacity='0.55' />
        <g stroke='#1B365D' strokeWidth='1.7' strokeLinecap='round' fill='none'>
          <path d='M8 55 L1 48 M8 60 L0 60 M8 65 L2 72' />
          <path d='M22 55 L29 48 M22 60 L30 60 M22 65 L28 72' />
        </g>
        <ellipse cx='15' cy='60' rx='7.5' ry='9.5' fill='#1B365D' />
        <circle cx='12.2' cy='56.4' r='1.7' fill='#FACC15' />
        <circle cx='17.8' cy='56.4' r='1.7' fill='#FACC15' />
      </svg>
    </span>
  );
}

// Seize lumières réparties sur l'anneau, décalées pour qu'une vague en fasse
// le tour plutôt que de les voir toutes scintiller ensemble.
const LUMIERES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 - Math.PI / 2;
  return {
    x: 50 + Math.cos(angle) * 52,
    y: 50 + Math.sin(angle) * 52,
    couleur: i % 2 === 0 ? '#FACC15' : '#FFF1C9',
    retard: `${((i / 16) * 2.8).toFixed(2)}s`,
  };
});

/** Noël — l'anneau doré du logo devient un fil de lumières qui respirent. */
function Noel() {
  return (
    <span style={PLEIN_CADRE} aria-hidden='true'>
      <svg viewBox='0 0 100 100' style={PLEIN_CADRE}>
        {LUMIERES.map((l, i) => (
          <circle key={`h${i}`} className='his-saison-halo' cx={l.x} cy={l.y} r='6' fill={l.couleur} style={{ animationDelay: l.retard }} />
        ))}
        {LUMIERES.map((l, i) => (
          <circle key={`p${i}`} className='his-saison-lumiere' cx={l.x} cy={l.y} r='2.6' fill={l.couleur} style={{ animationDelay: l.retard }} />
        ))}
      </svg>
    </span>
  );
}

/** 1er mai — un brin de muguet glissé derrière le médaillon. */
function Muguet() {
  return (
    <span style={PLEIN_CADRE} aria-hidden='true'>
      <svg viewBox='0 0 100 100' style={PLEIN_CADRE}>
        <path d='M78 96 Q76 70 84 50' fill='none' stroke='#2C6B45' strokeWidth='2.6' strokeLinecap='round' />
        <path d='M78 84 Q66 78 62 64' fill='none' stroke='#2C6B45' strokeWidth='4.5' strokeLinecap='round' opacity='0.9' />
        <g fill='#FFFFFF' stroke='#D7DEE8' strokeWidth='0.8'>
          <circle cx='80' cy='60' r='3.6' />
          <circle cx='77' cy='70' r='3.6' />
          <circle cx='79' cy='80' r='3.6' />
          <circle cx='75' cy='89' r='3.2' />
        </g>
      </svg>
    </span>
  );
}

/** 21 juin — deux notes qui montent doucement, fête de la musique. */
function Musique() {
  return (
    <span style={PLEIN_CADRE} aria-hidden='true'>
      <svg viewBox='0 0 100 100' style={PLEIN_CADRE}>
        <g className='his-saison-note' fill='#1B365D'>
          <rect x='74' y='12' width='2.4' height='18' rx='1.2' />
          <ellipse cx='71.5' cy='30' rx='5' ry='3.8' />
          <path d='M76.4 12 Q83 14 83 20 Q81 15.5 76.4 16 Z' />
        </g>
        <g className='his-saison-note his-saison-note--tard' fill='#FACC15'>
          <rect x='88' y='26' width='2' height='14' rx='1' />
          <ellipse cx='86' cy='40' rx='4' ry='3' />
        </g>
      </svg>
    </span>
  );
}

/** 14 juillet — un ruban tricolore sobre, posé sur l'anneau. */
function Nationale() {
  return (
    <span style={PLEIN_CADRE} aria-hidden='true'>
      <svg viewBox='0 0 100 100' style={PLEIN_CADRE}>
        <g strokeWidth='5' fill='none' strokeLinecap='round'>
          <path d='M22 88 Q13 78 11 64' stroke='#1B365D' />
          <path d='M33 94 Q22 87 17 74' stroke='#FFFFFF' />
          <path d='M45 97 Q32 93 25 82' stroke='#C8102E' />
        </g>
      </svg>
    </span>
  );
}

/** Pâques — deux œufs décorés au pied du médaillon. */
function Paques() {
  return (
    <span style={PLEIN_CADRE} aria-hidden='true'>
      <svg viewBox='0 0 100 100' style={PLEIN_CADRE}>
        <g>
          <ellipse cx='20' cy='82' rx='9' ry='12' fill='#FACC15' />
          <path d='M11.6 77 Q20 81 28.4 77 M11.6 86 Q20 90 28.4 86' fill='none' stroke='#FFFFFF' strokeWidth='1.8' />
        </g>
        <g>
          <ellipse cx='34' cy='90' rx='7.5' ry='10' fill='#1B365D' />
          <path d='M27 86 Q34 90 41 86' fill='none' stroke='#FACC15' strokeWidth='1.6' />
          <circle cx='31' cy='93' r='1.4' fill='#FACC15' />
          <circle cx='37' cy='93' r='1.4' fill='#FACC15' />
        </g>
      </svg>
    </span>
  );
}

export const HABILLAGES = {
  halloween: Halloween,
  noel: Noel,
  muguet: Muguet,
  musique: Musique,
  nationale: Nationale,
  paques: Paques,
};
