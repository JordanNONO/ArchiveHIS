/**
 * Décors SVG des douze fêtes — voir BadgeSaisonnier.jsx.
 *
 * Chaque fête expose `arriere()` et `avant()`, qui rendent du balisage SVG
 * dans un repère de 200×200 où le logo occupe le carré central (56 %). Deux
 * plans : ce qui passe DERRIÈRE le logo (lune, oreilles de lapin, ondes) et
 * ce qui passe DEVANT (bonnet, araignée, œufs).
 *
 * Le balisage est produit sous forme de chaîne puis injecté tel quel : il est
 * entièrement écrit ici, aucune donnée extérieure n'y entre.
 */

const TAU = Math.PI * 2;
const alea = (a, b) => a + Math.random() * (b - a);
const rad = (d) => (d * Math.PI) / 180;
/** Point du cercle de rayon r à l'angle a, centré sur (100,100). */
const pt = (a, r) => [100 + Math.cos(rad(a)) * r, 100 + Math.sin(rad(a)) * r];
const f1 = (n) => n.toFixed(1);

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
}

function arcCercle(r, a0, a1) {
  const [x0, y0] = pt(a0, r);
  const [x1, y1] = pt(a1, r);
  return `M${f1(x0)} ${f1(y0)} A${r} ${r} 0 0 1 ${f1(x1)} ${f1(y1)}`;
}

const VIDE = () => '';

/* ---------------------------------- Noël --------------------------------- */

function noelAvant() {
  const N = 11;
  const R = 63;
  const couleurs = ['#ff4b5c', '#ffd34d', '#3ddc84', '#5cc8ff'];
  const angles = Array.from({ length: N }, (_, i) => 22 + i * (136 / (N - 1)));
  let fil = '';
  let ampoules = '';

  angles.forEach((a, i) => {
    const [x, y] = pt(a, R);
    if (i === 0) {
      fil = `M${f1(x)} ${f1(y)}`;
    } else {
      const [cx, cy] = pt((a + angles[i - 1]) / 2, R + 6);
      fil += ` Q${f1(cx)} ${f1(cy)} ${f1(x)} ${f1(y)}`;
    }
    const c = couleurs[i % 4];
    ampoules += `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a - 90)})"><g class="hs-pop" style="--d:${(0.5 + i * 0.06).toFixed(2)}s"><rect x="-1.7" y="-1" width="3.4" height="3" rx=".6" fill="#b9b39b"/><ellipse class="hs-bulb" style="--c:${c};--dl:${(i * 0.17).toFixed(2)}s" cx="0" cy="5.6" rx="3" ry="4.4" fill="${c}"/></g></g>`;
  });

  return `<path d="${fil}" fill="none" stroke="#2b5133" stroke-width="1.3"/>${ampoules}
  <g transform="translate(134 50) rotate(34) scale(.95)"><g class="hs-pop hs-pop--bas" style="--d:.15s"><g class="hs-sway">
    <path d="M-27 2 C-25 -28 -6 -47 18 -47 C35 -47 47 -36 49 -19 C41 -28 31 -30 22 -24 C26 -14 27 -6 27 2 Z" fill="#d8283f"/>
    <path d="M-27 2 C-25 -28 -6 -47 18 -47 C2 -40 -10 -22 -10 2 Z" fill="#b01d33"/>
    <rect x="-32" y="-7" width="64" height="14" rx="7" fill="#fbfaf6"/>
    <rect x="-32" y="-1" width="64" height="8" rx="4" fill="#e3e6ee"/>
    <circle class="hs-pom" cx="49" cy="-17" r="7.5" fill="#ffffff"/>
  </g></g></g>`;
}

/* ------------------------------- Halloween ------------------------------- */

function halloweenArriere() {
  return `<g class="hs-pop" style="--d:.05s"><g class="hs-moon"><circle cx="44" cy="46" r="22" fill="#ffd27a"/>
  <circle cx="37" cy="40" r="4" fill="#f0b955" opacity=".7"/><circle cx="51" cy="53" r="5.5" fill="#f0b955" opacity=".55"/><circle cx="48" cy="36" r="2.4" fill="#f0b955" opacity=".6"/></g></g>`;
}

function halloweenAvant() {
  let pattes = '';
  [-1, 1].forEach((s) => {
    [[-3, -5], [-1, -1], [1, 3], [3, 7]].forEach(([y0, y1]) => {
      pattes += `<path d="M0 ${y0} Q${s * 8} ${y0 - 6} ${s * 12} ${y1}" fill="none" stroke="#1a1422" stroke-width="1.3" stroke-linecap="round"/>`;
    });
  });

  return `<g transform="translate(152 0)"><g class="hs-yoyo">
     <line x1="0" y1="-220" x2="0" y2="30" stroke="#cdd6ea" stroke-width=".6" opacity=".75"/>
     <g transform="translate(0 37)"><g class="hs-pop" style="--d:.4s"><g class="hs-legs">${pattes}</g>
       <ellipse cx="0" cy="1" rx="5.5" ry="6.5" fill="#1a1422" stroke="#7c5fa0" stroke-width=".6"/>
       <circle cx="0" cy="-6" r="3.6" fill="#1a1422"/>
       <circle cx="-1.3" cy="-6.6" r=".9" fill="#ff4d4d"/><circle cx="1.3" cy="-6.6" r=".9" fill="#ff4d4d"/></g></g>
  </g></g>
  <g transform="translate(152 160)"><g class="hs-pop hs-pop--bas" style="--d:.25s"><g class="hs-bob">
     <path d="M-1 -14 C-1 -19 2 -22 5 -23" stroke="#4d7f2a" stroke-width="3" fill="none" stroke-linecap="round"/>
     <ellipse cx="-9" cy="0" rx="10" ry="13" fill="#e6721a"/><ellipse cx="9" cy="0" rx="10" ry="13" fill="#e6721a"/>
     <ellipse cx="0" cy="0" rx="10.5" ry="14" fill="#ff962e"/>
     <g class="hs-flick" fill="#ffe066"><polygon points="-9,-1 -3,-1 -6,-7"/><polygon points="3,-1 9,-1 6,-7"/>
     <polygon points="-10,3 10,3 7,10 3.5,6.5 0,10 -3.5,6.5 -7,10"/></g>
  </g></g></g>`;
}

/* ------------------------------- 14 juillet ------------------------------ */

function juilletAvant() {
  const bandes = [[64, '#2a55c8'], [69, '#f4f6fb'], [74, '#e5243b']];
  const rubans = bandes
    .map(([r, c], i) => `<path class="hs-swoosh" style="--dl:${(i * 0.14).toFixed(2)}s" d="${arcCercle(r, -58, 64)}" pathLength="100" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`)
    .join('');

  let plis = '';
  for (let i = 0; i < 18; i += 1) {
    const a = i * 20;
    const x0 = Math.cos(rad(a)) * 6.5;
    const y0 = Math.sin(rad(a)) * 6.5;
    const x1 = Math.cos(rad(a)) * 16;
    const y1 = Math.sin(rad(a)) * 16;
    plis += `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" stroke="rgba(10,20,60,.22)" stroke-width=".6"/>`;
  }

  return `${rubans}
  <g transform="translate(42 150)"><g class="hs-pop" style="--d:.2s">
    <path class="hs-tail" d="M-3 6 L-11 32 L-6 28 L-3 33 L1 8Z" fill="#2a55c8"/>
    <path class="hs-tail hs-tail--r" d="M3 6 L11 32 L6 28 L3 33 L-1 8Z" fill="#e5243b"/>
    <g class="hs-spin"><circle r="16.5" fill="#2a55c8"/><circle r="11.5" fill="#f4f6fb"/><circle r="6.5" fill="#e5243b"/>${plis}</g>
  </g></g>`;
}

/* --------------------------- Fête de la musique -------------------------- */

function musiqueArriere() {
  return [0, 0.7, 1.4]
    .map((d) => `<circle class="hs-ring" style="--dl:${d}s" cx="100" cy="100" r="56" fill="none" stroke="#7fe3ff" stroke-width="1.6"/>`)
    .join('');
}

function musiqueAvant() {
  const couleurs = ['#ff5fa2', '#ffb03a', '#ffe14d', '#3ee6c4', '#5cb6ff', '#a98bff', '#ff5fa2', '#ffb03a', '#3ee6c4'];
  let barres = '';
  for (let i = 0; i < 9; i += 1) {
    const x = 62 + i * 9.3;
    const h = 14 + Math.sin(i * 1.3) * 4 + 6;
    barres += `<rect class="hs-bar" style="--du:${alea(0.28, 0.62).toFixed(2)}s;--dl:${(-i * 0.13).toFixed(2)}s" x="${f1(x)}" y="${f1(194 - h)}" width="5.6" height="${f1(h)}" rx="2.8" fill="${couleurs[i]}"/>`;
  }
  return `<g class="hs-pop" style="--d:.3s">${barres}</g>`;
}

/* ---------------------------------- Pâques ------------------------------- */

const OEUF = 'M0 -15 C9 -15 12 -2 12 4 C12 11 7 15 0 15 C-7 15 -12 11 -12 4 C-12 -2 -9 -15 0 -15Z';

function paquesArriere() {
  const oreille = (cls, interieur) => `<g class="${cls}"><ellipse cx="0" cy="-24" rx="10" ry="27" fill="#f6f1f8"/><ellipse cx="0" cy="-22" rx="5.4" ry="20" fill="${interieur}"/></g>`;
  return `<g transform="translate(84 60) rotate(-14)"><g class="hs-peek" style="--d:.1s">${oreille('hs-earL', '#f7a9c7')}</g></g>
          <g transform="translate(117 58) rotate(16)"><g class="hs-peek" style="--d:.25s">${oreille('hs-earR', '#f7a9c7')}</g></g>`;
}

function paquesAvant() {
  const oeufs = [
    [66, 174, '#ffd0e1', '#ff7fae', '#8f6bd8', 0],
    [100, 181, '#c8f1dc', '#2fb37a', '#ff9a3c', 0.25],
    [134, 174, '#d6e4ff', '#5b8cff', '#ffcf3a', 0.5],
  ];
  return oeufs
    .map(([x, y, c1, c2, c3, d], i) => `<g transform="translate(${x} ${y}) scale(.9)"><g class="hs-pop hs-pop--bas" style="--d:${(0.35 + i * 0.12).toFixed(2)}s"><g class="hs-egg" style="--dl:${d}s">
    <path d="${OEUF}" fill="${c1}"/>
    <path d="M-11 0 L-7 -4 L-3 0 L1 -4 L5 0 L9 -4 L11.5 -1.5" fill="none" stroke="${c2}" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="-5" cy="7" r="1.6" fill="${c3}"/><circle cx="0" cy="9.5" r="1.6" fill="${c3}"/><circle cx="5" cy="7" r="1.6" fill="${c3}"/>
    <ellipse cx="-4.5" cy="-8" rx="2.2" ry="3.6" fill="#fff" opacity=".55" transform="rotate(20 -4.5 -8)"/>
  </g></g></g>`)
    .join('');
}

/* ---------------------------------- 1er mai ------------------------------ */

const CLOCHETTE = 'M0 0 C-5 0 -7 4 -7 8 C-7 10 -8 11 -9 12.2 C-6 12.8 -3 11.6 0 12.8 C3 11.6 6 12.8 9 12.2 C8 11 7 10 7 8 C7 4 5 0 0 0Z';

function maiAvant() {
  const courbe = [[6, 0], [8, -34], [20, -62], [48, -78]];
  let clochettes = '';
  [0.4, 0.53, 0.65, 0.76, 0.86, 0.95].forEach((t, i) => {
    const [x, y] = bezier(...courbe, t);
    const s = 1 - i * 0.09;
    clochettes += `<g transform="translate(${f1(x)} ${f1(y)})"><g class="hs-pop" style="--d:${(0.45 + i * 0.1).toFixed(2)}s"><g class="hs-bell" style="--dl:${(-i * 0.3).toFixed(2)}s">
      <path d="M0 0 Q2.5 2 2.5 6" stroke="#6cc070" stroke-width="1" fill="none"/>
      <g transform="translate(2.5 6) scale(${s.toFixed(2)})"><path d="${CLOCHETTE}" fill="#fbfdf7" stroke="#cfe5d2" stroke-width=".5"/><path d="M-3.5 3 C-4.5 6 -4.5 8 -4.6 10" stroke="#e6efe5" stroke-width="1.1" fill="none"/></g>
    </g></g></g>`;
  });

  return `<g transform="translate(30 188)"><g class="hs-pop hs-pop--bas" style="--d:.1s"><g class="hs-sprig">
    <path d="M0 0 C-15 -30 -11 -72 4 -100 C15 -68 15 -30 0 0Z" fill="#2c8a4c"/>
    <path d="M0 -4 C-2 -36 0 -70 4 -96" stroke="#1d6537" stroke-width=".8" fill="none" opacity=".6"/>
    <path d="M5 0 C22 -24 32 -52 27 -78 C12 -56 5 -30 5 0Z" fill="#40ad61"/>
    <path d="M6 -4 C14 -26 22 -48 26 -74" stroke="#247a41" stroke-width=".8" fill="none" opacity=".6"/>
    <path d="M6 0 C8 -34 20 -62 48 -78" stroke="#62bb66" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${clochettes}
  </g></g></g>`;
}

/* -------------------------------- Nouvel An ------------------------------ */

function nouvelanAvant(annee) {
  const flute = (cls) => `<g class="${cls}"><path d="M-5 -24 L5 -24 L3.6 -5 Q0 -1 -3.6 -5Z" fill="rgba(255,255,255,.22)" stroke="#f6e9c2" stroke-width=".8"/><path d="M-4.4 -17 L4.4 -17 L3.3 -5.6 Q0 -2.2 -3.3 -5.6Z" fill="#f2c94c"/><line x1="0" y1="-2" x2="0" y2="10" stroke="#f6e9c2" stroke-width="1.1"/><ellipse cx="0" cy="10.5" rx="5" ry="1.4" fill="#f6e9c2"/></g>`;

  return `<text x="100" y="32" text-anchor="middle" class="hs-pop" style="--d:.15s" font-family="system-ui, sans-serif" font-weight="700" font-size="17" letter-spacing="2" fill="#f5cf62"><tspan class="hs-shine">${annee}</tspan></text>
  <path class="hs-swoosh" style="--dl:0s" pathLength="100" d="M18 70 c9 -7 16 4 9 11 s-13 5 -6 13 s13 3 9 13 s-12 6 -5 14" fill="none" stroke="#ff5fa2" stroke-width="2" stroke-linecap="round"/>
  <path class="hs-swoosh" style="--dl:.4s" pathLength="100" d="M182 60 c-9 -6 -16 5 -9 11 s13 5 6 13 s-13 3 -9 13" fill="none" stroke="#5cc8ff" stroke-width="2" stroke-linecap="round"/>
  <g transform="translate(152 172)"><g class="hs-pop hs-pop--bas" style="--d:.35s">
    <g transform="translate(-7 0)">${flute('hs-clinkL')}</g><g transform="translate(7 0)">${flute('hs-clinkR')}</g>
    <g transform="translate(0 -28)"><path class="hs-spark" d="M0 -6 Q0 0 6 0 Q0 0 0 6 Q0 0 -6 0 Q0 0 0 -6Z" fill="#fff6c9"/></g>
  </g></g>`;
}

/* -------------------------------- Épiphanie ------------------------------ */

function epiphanieAvant() {
  return `<g transform="translate(100 50)"><g class="hs-drop" style="--d:.1s"><g class="hs-tilt">
    <path d="M-26 4 L-27 -14 L-15 -3 L-8 -23 L0 -6 L8 -23 L15 -3 L27 -14 L26 4Z" fill="#f2c230" stroke="#b9820e" stroke-width="1" stroke-linejoin="round"/>
    <path d="M-8 -23 L-4 -14 L-15 -3Z" fill="#ffe58a" opacity=".55"/>
    <rect x="-27" y="-3" width="54" height="8" rx="2" fill="#e0a417"/>
    <circle cx="-14" cy="1" r="2.4" fill="#e5243b"/><circle cx="0" cy="1" r="2.8" fill="#2a8bf2"/><circle cx="14" cy="1" r="2.4" fill="#2fbf71"/>
    <circle cx="-27" cy="-15" r="2.4" fill="#ffe58a"/><circle cx="-8" cy="-24" r="2.6" fill="#ffe58a"/><circle cx="8" cy="-24" r="2.6" fill="#ffe58a"/><circle cx="27" cy="-15" r="2.4" fill="#ffe58a"/>
  </g></g></g>
  <g transform="translate(150 170)"><g class="hs-pop hs-pop--bas" style="--d:.45s"><g class="hs-bob">
    <ellipse cx="0" cy="3" rx="22" ry="8" fill="#c4842f"/><ellipse cx="0" cy="0" rx="21" ry="7" fill="#f0c060"/>
    <path d="M-14 -3 Q0 -9 14 -3 M-18 1 Q0 -5 18 1 M-12 4.5 Q0 0 12 4.5" stroke="#c98a35" stroke-width=".8" fill="none"/>
  </g></g></g>`;
}

/* ------------------------------- Chandeleur ------------------------------ */

function chandeleurAvant() {
  return `<g transform="translate(60 174)"><g class="hs-pop" style="--d:.15s">
    <g class="hs-pan"><rect x="-50" y="-2.2" width="31" height="4.4" rx="2.2" fill="#7a4d2a"/><ellipse cx="0" cy="1" rx="21" ry="6.5" fill="#24272e"/><ellipse cx="0" cy="-.5" rx="18" ry="4.8" fill="#3b4049"/></g>
    <g transform="translate(0 -4)"><g class="hs-crepe"><ellipse rx="15" ry="3.8" fill="#eab55e"/><ellipse rx="12" ry="2.6" fill="#f8d78f"/><circle cx="-5" cy="-.5" r="1.3" fill="#d4913a"/><circle cx="4" cy=".6" r="1.1" fill="#d4913a"/><circle cx="8" cy="-.8" r=".9" fill="#d4913a"/></g></g>
  </g></g>`;
}

/* ----------------------------- Saint-Valentin ---------------------------- */

const ANGLE_FLECHE = -42.2;

function valentinArriere() {
  return `<g class="hs-arrowin"><g class="hs-thunk"><line x1="36" y1="158" x2="164" y2="42" stroke="#eadbbd" stroke-width="2.2" stroke-linecap="round"/></g></g>`;
}

function valentinAvant() {
  return `<g class="hs-arrowin"><g class="hs-thunk">
    <g transform="translate(164 42) rotate(${ANGLE_FLECHE})"><path d="M-3 -5.5 L10 0 L-3 5.5 L0 0Z" fill="#d5dbe8"/></g>
    <g transform="translate(36 158) rotate(${ANGLE_FLECHE})"><path d="M0 0 L10 -6.5 L17 -6.5 L7 0Z" fill="#ff5f8f"/><path d="M0 0 L10 6.5 L17 6.5 L7 0Z" fill="#ff9dbb"/></g>
  </g></g>`;
}

/* -------------------------------- Mardi gras ----------------------------- */

function carnavalAvant() {
  const plumes = [['#ff4fa0', -24, 0], ['#3ee6c4', -8, 0.4], ['#ffd23f', 8, 0.8]]
    .map(([c, r, d]) => `<g transform="rotate(${r})"><g class="hs-plume" style="--dl:${-d}s"><path d="M0 0 C-7 -10 -6 -26 0 -36 C6 -26 7 -10 0 0Z" fill="${c}"/><path d="M0 -2 L0 -32" stroke="rgba(255,255,255,.55)" stroke-width=".7"/></g></g>`)
    .join('');

  const serpentins = [
    ['#ffd23f', 'M174 112 c-8 6 -2 14 6 10 s8 10 0 14 s-6 12 4 14', 0],
    ['#ff4fa0', 'M146 188 c6 -8 14 -2 10 6 s10 8 14 0 s12 -6 12 4', 0.3],
    ['#3ee6c4', 'M22 140 c8 4 4 14 -4 12 s-6 12 4 14 s4 12 -4 14', 0.6],
  ].map(([c, d, l]) => `<path class="hs-swoosh" style="--dl:${l}s" pathLength="100" d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`).join('');

  return `${serpentins}<g transform="translate(58 54) rotate(-16)"><g class="hs-pop" style="--d:.15s"><g class="hs-mask">
    <g transform="translate(-19 -7)">${plumes}</g>
    <line x1="-25" y1="5" x2="-38" y2="32" stroke="#f2c230" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M-27 -2 C-25 -13 -12 -15 0 -8 C12 -15 25 -13 27 -2 C25 9 14 13 6 9 C3 7 -3 7 -6 9 C-14 13 -25 9 -27 -2Z" fill="#8a3bd6" stroke="#f2c230" stroke-width="1.2"/>
    <ellipse cx="-12" cy="-2" rx="6.5" ry="3.8" fill="#170b2b" stroke="#f2c230" stroke-width=".8"/><ellipse cx="12" cy="-2" rx="6.5" ry="3.8" fill="#170b2b" stroke="#f2c230" stroke-width=".8"/>
    <circle cx="0" cy="-6" r="1.7" fill="#f2c230"/><circle cx="-21" cy="4" r="1.2" fill="#ff4fa0"/><circle cx="21" cy="4" r="1.2" fill="#3ee6c4"/>
  </g></g></g>`;
}

/* ----------------------------- Poisson d'avril --------------------------- */

function avrilAvant() {
  return `<g transform="translate(150 118) rotate(-14)"><g class="hs-pop" style="--d:.2s"><g class="hs-wob">
    <g transform="translate(15 0)"><path class="hs-fishtail" d="M0 0 L14 -10 L11 0 L14 10Z" fill="#ff6b2c"/></g>
    <path d="M-4 -10 L4 -15 L9 -10 L1 -7Z" fill="#ff6b2c"/>
    <path d="M-22 0 C-13 -13 8 -13 17 0 C8 13 -13 13 -22 0Z" fill="#ff8a3d"/>
    <path d="M-10 -8 Q-6 0 -10 8" stroke="#e5602a" stroke-width="1" fill="none"/>
    <path d="M-2 -6 Q2 -3 -2 0 M4 -6 Q8 -3 4 0 M-2 1 Q2 4 -2 7 M4 1 Q8 4 4 7" stroke="#ffc39a" stroke-width=".8" fill="none"/>
    <circle cx="-15" cy="-3" r="2.4" fill="#fff"/><circle cx="-15.5" cy="-3" r="1.2" fill="#1b1b2a"/>
    <rect x="-7" y="-17" width="17" height="7" rx="1" fill="rgba(255,250,225,.78)" transform="rotate(-24 1.5 -13.5)"/>
  </g></g></g>`;
}

/**
 * Décor de chaque fête. `logo` nomme l'animation appliquée au médaillon
 * lui-même (flottement, battement, lueur), `teinte` le fond de la scène.
 */
export const DECORS = {
  nouvelan: { arriere: VIDE, avant: nouvelanAvant, logo: 'warm', teinte: ['#3a2a5c', '#0b0717'] },
  epiphanie: { arriere: VIDE, avant: epiphanieAvant, logo: 'warm', teinte: ['#5a3f12', '#170e04'] },
  chandeleur: { arriere: VIDE, avant: chandeleurAvant, logo: 'float', teinte: ['#5b3a1e', '#170b04'] },
  valentin: { arriere: valentinArriere, avant: valentinAvant, logo: 'love', teinte: ['#64193f', '#190510'] },
  carnaval: { arriere: VIDE, avant: carnavalAvant, logo: 'float', teinte: ['#3d2075', '#0d0726'] },
  paques: { arriere: paquesArriere, avant: paquesAvant, logo: 'float', teinte: ['#46679c', '#16264a'] },
  avril: { arriere: VIDE, avant: avrilAvant, logo: 'float', teinte: ['#0e5277', '#03172a'] },
  mai: { arriere: VIDE, avant: maiAvant, logo: 'float', teinte: ['#1f5650', '#0b1d24'] },
  musique: { arriere: musiqueArriere, avant: musiqueAvant, logo: 'beat', teinte: ['#45206b', '#110a26'] },
  juillet: { arriere: VIDE, avant: juilletAvant, logo: 'float', teinte: ['#183375', '#060e29'] },
  halloween: { arriere: halloweenArriere, avant: halloweenAvant, logo: 'spook', teinte: ['#4a1c4a', '#0d0613'] },
  noel: { arriere: VIDE, avant: noelAvant, logo: 'warm', teinte: ['#1a4777', '#071327'] },
};

export { TAU, alea };
