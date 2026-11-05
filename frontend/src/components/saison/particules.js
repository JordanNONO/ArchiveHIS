/**
 * Moteurs de particules des douze fêtes — voir BadgeSaisonnier.jsx.
 *
 * Chaque fête expose `init(etat)` et `tick(etat, arriere, avant, k, t)`, où
 * `arriere` et `avant` sont deux contextes 2D de 200×200 encadrant le logo :
 * une particule passe devant ou derrière selon sa profondeur, ce qui donne le
 * relief sans empiler des calques.
 *
 * `k` est le facteur de temps (1 = une image à 60 Hz) : tout déplacement en
 * dépend, pour que l'animation tienne la même vitesse quel que soit l'écran.
 */

import { TAU, alea } from './decors';

const tirer = (liste) => liste[(Math.random() * liste.length) | 0];
const effacer = (...contextes) => contextes.forEach((c) => c.clearRect(0, 0, 200, 200));

/* ------------------------------- primitives ------------------------------ */

function coeur(c, x, y, s) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.beginPath();
  c.moveTo(0, 3.2);
  c.bezierCurveTo(-6.5, -1, -4.5, -7.5, 0, -4);
  c.bezierCurveTo(4.5, -7.5, 6.5, -1, 0, 3.2);
  c.fill();
  c.restore();
}

function etoile(c, x, y, r) {
  c.beginPath();
  c.moveTo(x, y - r * 2);
  c.quadraticCurveTo(x, y, x + r * 2, y);
  c.quadraticCurveTo(x, y, x, y + r * 2);
  c.quadraticCurveTo(x, y, x - r * 2, y);
  c.quadraticCurveTo(x, y, x, y - r * 2);
  c.fill();
}

function poisson(c, x, y, s, sens, battement, couleur) {
  c.save();
  c.translate(x, y);
  c.scale(s * sens, s);
  c.fillStyle = couleur;
  c.beginPath();
  c.ellipse(0, 0, 6, 3.2, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.moveTo(-5, 0);
  c.lineTo(-10, -3.5 + battement);
  c.lineTo(-10, 3.5 + battement);
  c.closePath();
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(3.4, -0.8, 0.9, 0, TAU);
  c.fill();
  c.restore();
}

function chauveSouris(c, x, y, s, battement) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = '#120a1c';
  c.strokeStyle = 'rgba(255,150,60,.6)';
  c.lineWidth = 0.6;
  const w = -battement * 7;
  c.beginPath();
  c.moveTo(0, -3);
  c.quadraticCurveTo(8, -6 + w * 0.5, 16, -2 + w);
  c.quadraticCurveTo(13, 1 + w * 0.6, 12, 4 + w * 0.4);
  c.quadraticCurveTo(9, 2 + w * 0.3, 7, 5 + w * 0.2);
  c.quadraticCurveTo(5, 3, 2, 4);
  c.lineTo(0, 6);
  c.lineTo(-2, 4);
  c.quadraticCurveTo(-5, 3, -7, 5 + w * 0.2);
  c.quadraticCurveTo(-9, 2 + w * 0.3, -12, 4 + w * 0.4);
  c.quadraticCurveTo(-13, 1 + w * 0.6, -16, -2 + w);
  c.quadraticCurveTo(-8, -6 + w * 0.5, 0, -3);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(-2.6, -2); c.lineTo(-2.3, -6.2); c.lineTo(-0.8, -3.6);
  c.lineTo(0.8, -3.6); c.lineTo(2.3, -6.2); c.lineTo(2.6, -2);
  c.closePath();
  c.fill();
  c.fillStyle = '#ffb347';
  c.fillRect(-1.5, -2.8, 0.9, 0.9);
  c.fillRect(0.6, -2.8, 0.9, 0.9);
  c.restore();
}

/* --------------------------- briques partagées --------------------------- */

function confettisInit(etat, couleurs, n) {
  etat.c = Array.from({ length: n }, () => ({
    x: alea(0, 200), y: alea(-200, 200), w: alea(2, 4), h: alea(4, 7),
    r: alea(0, TAU), vr: alea(-0.06, 0.06), v: alea(0.25, 0.6),
    ph: alea(0, TAU), c: tirer(couleurs),
  }));
}

function confettisTick(etat, arriere, avant, k, t) {
  effacer(arriere, avant);
  etat.c.forEach((p, i) => {
    p.y += p.v * k;
    p.r += p.vr * k;
    p.x += Math.sin(t / 700 + p.ph) * 0.3 * k;
    if (p.y > 206) { p.y = -6; p.x = alea(0, 200); }
    // Deux tiers derrière le logo, un tiers devant : c'est ce rapport qui
    // donne l'impression que le médaillon est pris dans la pluie.
    const c = i % 3 ? arriere : avant;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.r);
    c.scale(1, Math.cos(t / 300 + p.ph));
    c.fillStyle = p.c;
    c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    c.restore();
  });
}

function eclater(etat, x, y, couleurs) {
  const n = 54;
  const uniforme = Math.random() < 0.5;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TAU + alea(-0.06, 0.06);
    const sp = alea(0.8, 2.1);
    etat.p.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      l: 1, d: alea(0.009, 0.016), s: alea(0.7, 1.5),
      c: uniforme ? couleurs[Math.floor((i / n) * 3)] : tirer(couleurs),
    });
  }
}

/** Feu d'artifice : fusées, explosion, traînée qui s'efface. */
function feuDartifice(etat, arriere, k, t, couleurs, basse, haute) {
  // La traînée s'obtient en effaçant partiellement l'image précédente
  // plutôt qu'en redessinant chaque particule : bien moins coûteux.
  arriere.globalCompositeOperation = 'destination-out';
  arriere.fillStyle = `rgba(0,0,0,${Math.min(1, 0.2 * k).toFixed(3)})`;
  arriere.fillRect(0, 0, 200, 200);
  arriere.globalCompositeOperation = 'lighter';

  if (t > etat.n) {
    const cote = Math.random();
    etat.r.push({
      x: cote < 0.4 ? alea(22, 70) : cote < 0.8 ? alea(130, 178) : alea(80, 120),
      y: 205, vy: -alea(2.8, 3.5), ty: alea(16, 70),
    });
    etat.n = t + alea(basse, haute);
  }

  etat.r = etat.r.filter((r) => {
    r.y += r.vy * k;
    r.vy += 0.03 * k;
    arriere.fillStyle = 'rgba(255,225,180,.9)';
    arriere.fillRect(r.x - 0.6, r.y, 1.2, 3.2);
    if (r.y <= r.ty || r.vy > -0.6) { eclater(etat, r.x, r.y, couleurs); return false; }
    return true;
  });

  etat.p = etat.p.filter((p) => {
    p.vx *= Math.pow(0.985, k);
    p.vy = p.vy * Math.pow(0.985, k) + 0.022 * k;
    p.x += p.vx * k;
    p.y += p.vy * k;
    p.l -= p.d * k;
    if (p.l <= 0) return false;
    arriere.globalAlpha = p.l;
    arriere.fillStyle = p.c;
    arriere.beginPath();
    arriere.arc(p.x, p.y, p.s, 0, TAU);
    arriere.fill();
    return true;
  });

  arriere.globalAlpha = 1;
  arriere.globalCompositeOperation = 'source-over';
}

/* ------------------------------ par fête --------------------------------- */

export const PARTICULES = {
  paques: {
    init: (e) => confettisInit(e, ['#ffc2d9', '#bfefd6', '#cfe0ff', '#fff1a8', '#e3d2ff'], 34),
    tick: confettisTick,
  },

  carnaval: {
    init: (e) => confettisInit(e, ['#ff4fa0', '#ffd23f', '#3ee6c4', '#5cb6ff', '#a98bff', '#ff8a3d'], 46),
    tick: confettisTick,
  },

  mai: {
    init(e) {
      e.s = Array.from({ length: 28 }, () => ({ x: alea(8, 192), y: alea(0, 200), v: alea(0.1, 0.3), ph: alea(0, TAU), r: alea(0.6, 1.5) }));
    },
    tick(e, arriere, avant, k, t) {
      effacer(arriere, avant);
      e.s.forEach((s, i) => {
        s.y -= s.v * k;
        s.x += Math.sin(t / 900 + s.ph) * 0.15 * k;
        if (s.y < -4) { s.y = 204; s.x = alea(8, 192); }
        const c = i % 2 ? arriere : avant;
        c.fillStyle = `rgba(235,255,225,${(0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t / 380 + s.ph))).toFixed(2)})`;
        etoile(c, s.x, s.y, s.r);
      });
    },
  },

  musique: {
    init(e) { e.n = []; e.suivante = 0; },
    tick(e, arriere, avant, k, t) {
      effacer(arriere, avant);
      if (t > e.suivante) {
        const a = alea(Math.PI * 0.85, Math.PI * 2.15);
        e.n.push({
          x: 100 + Math.cos(a) * 56, y: 100 + Math.sin(a) * 56,
          vx: Math.cos(a) * 0.35, vy: -alea(0.35, 0.75),
          r: alea(-0.4, 0.4), vr: alea(-0.02, 0.02),
          g: tirer(['♪', '♫', '♬', '♩']),
          c: tirer(['#ff5fa2', '#ffd23f', '#3ee6c4', '#7aa8ff', '#ff8a3d', '#c59bff']),
          s: alea(11, 20), l: 1, ph: alea(0, TAU),
        });
        e.suivante = t + alea(160, 320);
      }
      avant.textAlign = 'center';
      avant.textBaseline = 'middle';
      e.n = e.n.filter((n) => {
        n.x += (n.vx + Math.sin(t / 400 + n.ph) * 0.3) * k;
        n.y += n.vy * k;
        n.r += n.vr * k;
        n.l -= 0.0065 * k;
        if (n.l <= 0) return false;
        avant.save();
        avant.translate(n.x, n.y);
        avant.rotate(n.r);
        const sc = Math.min(1, (1 - n.l) * 7);
        avant.scale(sc, sc);
        avant.globalAlpha = Math.min(1, n.l * 1.6);
        avant.fillStyle = n.c;
        avant.shadowColor = n.c;
        avant.shadowBlur = 8;
        avant.font = `${n.s.toFixed(0)}px "Segoe UI Symbol","Noto Sans Symbols 2",sans-serif`;
        avant.fillText(n.g, 0, 0);
        avant.restore();
        return true;
      });
    },
  },

  juillet: {
    init(e) { e.r = []; e.p = []; e.n = 0; },
    tick(e, arriere, avant, k, t) {
      avant.clearRect(0, 0, 200, 200);
      feuDartifice(e, arriere, k, t, ['#4a78ff', '#ffffff', '#ff3a52'], 420, 1000);
    },
  },

  nouvelan: {
    init(e) {
      e.r = []; e.p = []; e.n = 0; e.bu = []; e.bn = 0;
      e.g = Array.from({ length: 36 }, () => ({ x: alea(0, 200), y: alea(0, 200), v: alea(0.2, 0.5), ph: alea(0, TAU), s: alea(1, 2.2), r: alea(0, TAU) }));
    },
    tick(e, arriere, avant, k, t) {
      feuDartifice(e, arriere, k, t, ['#ffd56a', '#fff3c4', '#ffb347'], 650, 1300);
      avant.clearRect(0, 0, 200, 200);
      e.g.forEach((g) => {
        g.y += g.v * k;
        g.r += 0.05 * k;
        if (g.y > 204) { g.y = -4; g.x = alea(0, 200); }
        avant.save();
        avant.translate(g.x, g.y);
        avant.rotate(g.r);
        avant.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t / 220 + g.ph));
        avant.fillStyle = '#ffd56a';
        avant.fillRect(-g.s / 2, -g.s / 4, g.s, g.s / 2);
        avant.restore();
      });
      if (t > e.bn) { e.bu.push({ x: 152 + (Math.random() < 0.5 ? -7 : 7) + alea(-2, 2), y: 166, v: alea(0.25, 0.5), l: 1, r: alea(0.5, 1) }); e.bn = t + alea(90, 200); }
      avant.strokeStyle = '#fff6d0';
      avant.lineWidth = 0.5;
      e.bu = e.bu.filter((u) => {
        u.y -= u.v * k;
        u.x += Math.sin(t / 120 + u.y) * 0.08;
        u.l -= 0.012 * k;
        if (u.l <= 0) return false;
        avant.globalAlpha = Math.min(1, u.l * 1.5);
        avant.beginPath();
        avant.arc(u.x, u.y, u.r, 0, TAU);
        avant.stroke();
        return true;
      });
      avant.globalAlpha = 1;
    },
  },

  epiphanie: {
    init(e) {
      e.s = Array.from({ length: 22 }, () => ({ a: alea(0, TAU), r: alea(64, 94), ph: alea(0, TAU), s: alea(0.8, 1.9), sp: alea(0.002, 0.006) }));
    },
    tick(e, arriere, avant, k, t) {
      effacer(arriere, avant);
      e.s.forEach((s, i) => {
        s.a += s.sp * k;
        const scint = 0.5 + 0.5 * Math.sin(t / 300 + s.ph);
        const c = i % 2 ? arriere : avant;
        c.fillStyle = `rgba(255,226,138,${(0.2 + 0.8 * scint).toFixed(2)})`;
        etoile(c, 100 + Math.cos(s.a) * s.r, 100 + Math.sin(s.a) * s.r, s.s * (0.5 + 0.5 * scint));
      });
    },
  },

  chandeleur: {
    init(e) {
      e.s = Array.from({ length: 40 }, () => ({ x: alea(0, 200), y: alea(0, 200), v: alea(0.12, 0.3), r: alea(0.3, 0.8), ph: alea(0, TAU) }));
      e.st = []; e.n = 0;
    },
    tick(e, arriere, avant, k, t) {
      effacer(arriere, avant);
      avant.fillStyle = 'rgba(255,255,255,.6)';
      e.s.forEach((s) => {
        s.y += s.v * k;
        s.x += Math.sin(t / 800 + s.ph) * 0.12 * k;
        if (s.y > 204) { s.y = -4; s.x = alea(0, 200); }
        avant.beginPath();
        avant.arc(s.x, s.y, s.r, 0, TAU);
        avant.fill();
      });
      if (t > e.n) { e.st.push({ x: 60 + alea(-10, 10), y: 166, r: 2, l: 1, ph: alea(0, TAU) }); e.n = t + alea(200, 320); }
      e.st = e.st.filter((p) => {
        p.y -= 0.35 * k;
        p.r += 0.07 * k;
        p.x += Math.sin(t / 400 + p.ph) * 0.2 * k;
        p.l -= 0.009 * k;
        if (p.l <= 0) return false;
        arriere.fillStyle = `rgba(255,255,255,${(p.l * 0.16).toFixed(3)})`;
        arriere.beginPath();
        arriere.arc(p.x, p.y, p.r, 0, TAU);
        arriere.fill();
        return true;
      });
    },
  },

  valentin: {
    init(e) { e.h = []; e.n = 0; },
    tick(e, arriere, avant, k, t) {
      effacer(arriere, avant);
      if (t > e.n) {
        e.h.push({ x: alea(16, 184), y: 208, v: alea(0.4, 0.8), s: alea(0.5, 1.15), ph: alea(0, TAU), c: tirer(['#ff4d7a', '#ff8fb0', '#ff2e5f', '#ffc2d4']), devant: Math.random() < 0.5 });
        e.n = t + alea(160, 300);
      }
      e.h = e.h.filter((h) => {
        h.y -= h.v * k;
        h.x += Math.sin(t / 500 + h.ph) * 0.3 * k;
        if (h.y < -10) return false;
        const c = h.devant ? avant : arriere;
        c.globalAlpha = Math.min(1, h.y / 60);
        c.fillStyle = h.c;
        coeur(c, h.x, h.y, h.s);
        return true;
      });
      arriere.globalAlpha = 1;
      avant.globalAlpha = 1;
    },
  },

  avril: {
    init(e) {
      e.f = Array.from({ length: 3 }, (_, i) => ({ a: alea(0, TAU), sp: alea(0.012, 0.02) * (i % 2 ? 1 : -1), rx: alea(70, 86), ry: alea(14, 24), cy: alea(80, 130), s: alea(0.8, 1.1), c: tirer(['#ffb347', '#5cc8ff', '#ff7aa8']), fp: alea(0, TAU) }));
      e.bu = []; e.n = 0;
    },
    tick(e, arriere, avant, k, t) {
      effacer(arriere, avant);
      e.f.forEach((o) => {
        o.a += o.sp * k;
        const d = Math.sin(o.a);
        const sens = -Math.sign(Math.sin(o.a) * o.sp) || 1;
        poisson(d > 0 ? avant : arriere, 100 + Math.cos(o.a) * o.rx, o.cy + d * o.ry, o.s * (0.75 + 0.3 * (d + 1) / 2), sens, Math.sin(t / 70 + o.fp) * 1.5, o.c);
      });
      if (t > e.n) { e.bu.push({ x: alea(16, 184), y: 206, r: alea(0.8, 2.4), v: alea(0.3, 0.7), ph: alea(0, TAU), devant: Math.random() < 0.5 }); e.n = t + alea(150, 260); }
      e.bu = e.bu.filter((u) => {
        u.y -= u.v * k;
        u.x += Math.sin(t / 300 + u.ph) * 0.2 * k;
        if (u.y < -5) return false;
        const c = u.devant ? avant : arriere;
        c.strokeStyle = 'rgba(200,240,255,.7)';
        c.lineWidth = 0.6;
        c.beginPath();
        c.arc(u.x, u.y, u.r, 0, TAU);
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,.6)';
        c.beginPath();
        c.arc(u.x - u.r * 0.35, u.y - u.r * 0.35, u.r * 0.25, 0, TAU);
        c.fill();
        return true;
      });
    },
  },

  halloween: {
    init(e) {
      e.b = Array.from({ length: 5 }, () => ({ a: alea(0, TAU), sp: alea(0.012, 0.022) * (Math.random() < 0.5 ? 1 : -1), rx: alea(68, 90), ry: alea(16, 30), cy: alea(70, 125), s: alea(0.75, 1.15), fp: alea(0, TAU) }));
    },
    tick(e, arriere, avant, k, t) {
      effacer(arriere, avant);
      e.b.forEach((o) => {
        o.a += o.sp * k;
        const d = Math.sin(o.a);
        chauveSouris(d > 0 ? avant : arriere, 100 + Math.cos(o.a) * o.rx, o.cy + d * o.ry + Math.sin(t / 260 + o.fp) * 3, o.s * (0.72 + 0.3 * (d + 1) / 2), Math.sin(t / 55 + o.fp));
      });
    },
  },

  noel: {
    init(e) {
      e.f = Array.from({ length: 70 }, () => ({ x: alea(0, 200), y: alea(0, 200), r: alea(0.5, 2.2), v: alea(0.2, 0.7), ph: alea(0, TAU) }));
    },
    tick(e, arriere, avant, k, t) {
      effacer(arriere, avant);
      e.f.forEach((p) => {
        p.y += p.v * k;
        p.x += Math.sin(t / 1000 + p.ph) * 0.25 * k;
        if (p.y > 204) { p.y = -4; p.x = alea(0, 200); }
        // Les gros flocons passent devant, les petits derrière : la
        // profondeur vient de là, pas d'un flou.
        const c = p.r > 1.5 ? avant : arriere;
        c.globalAlpha = Math.min(1, 0.45 + p.r * 0.22);
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, TAU);
        c.fill();
      });
      arriere.globalAlpha = 1;
      avant.globalAlpha = 1;
    },
  },
};
