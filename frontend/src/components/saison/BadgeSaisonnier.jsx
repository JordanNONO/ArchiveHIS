import React, { useEffect, useRef } from 'react';
import { DECORS } from './decors';
import { PARTICULES } from './particules';
import hisLogo from '../../assets/his-badge.png';

/**
 * Le logo HIS habillé pour une fête — cinq plans empilés dans un carré :
 *
 *   SVG arrière · canvas arrière · LOGO · canvas avant · SVG avant
 *
 * Le logo officiel est au milieu, intact : tout le décor passe devant ou
 * derrière, jamais dessus. Un flocon qui passe devant le médaillon et un
 * autre derrière, c'est ce qui donne la profondeur.
 *
 * Trois économies, parce que ce composant vit dans le menu toute la journée :
 * - une seule boucle d'animation pour tous les badges de la page ;
 * - un badge hors de l'écran ne consomme rien (IntersectionObserver) ;
 * - si le poste demande moins d'animations, on dessine UNE image fixe et on
 *   ne lance jamais la boucle.
 */

// Boucle unique partagée : dix badges sur la page d'administration ne doivent
// pas lancer dix requestAnimationFrame concurrents.
const vivants = new Set();
let boucleLancee = false;
let derniereImage = 0;

function demarrerBoucle() {
  if (boucleLancee) return;
  boucleLancee = true;
  derniereImage = performance.now();

  const image = (maintenant) => {
    // Plafonné à 50 ms : après un onglet mis en veille, le temps écoulé
    // ferait bondir les particules à l'autre bout de l'écran.
    const k = Math.min(50, maintenant - derniereImage) / 16.67;
    derniereImage = maintenant;
    vivants.forEach((b) => {
      if (b.visible) PARTICULES[b.cle]?.tick(b.etat, b.ctxArriere, b.ctxAvant, k, maintenant);
    });
    requestAnimationFrame(image);
  };

  requestAnimationFrame(image);
}

const animationsReduites = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * `avecLogo` : vrai sur la page de réglage, où le badge est seul et doit
 * donc fournir le médaillon. Faux quand il est posé PAR-DESSUS un logo déjà
 * affiché (menu, page de connexion) — en afficher un second donnerait deux
 * logos superposés. Le carré central de 56 % reste vide : le logo de la page
 * s'y voit, exactement à la bonne taille si le conteneur fait 1,8 fois la
 * sienne (voir LogoSaisonnier.jsx).
 */
function BadgeSaisonnier({ cle, taille = '100%', avecLogo = true }) {
  const racineRef = useRef(null);
  const canvasArriereRef = useRef(null);
  const canvasAvantRef = useRef(null);
  const badgeRef = useRef({});

  useEffect(() => {
    const racine = racineRef.current;
    const cArriere = canvasArriereRef.current;
    const cAvant = canvasAvantRef.current;
    if (!racine || !cArriere || !cAvant || !PARTICULES[cle]) return undefined;

    const badge = {
      cle,
      etat: {},
      ctxArriere: cArriere.getContext('2d'),
      ctxAvant: cAvant.getContext('2d'),
      visible: true,
    };
    badgeRef.current = badge;
    PARTICULES[cle].init(badge.etat);

    const reduit = animationsReduites();

    // Le canvas est dessiné dans un repère de 200×200 quelle que soit sa
    // taille réelle : les décors sont écrits une fois pour toutes dedans.
    const ajuster = () => {
      const largeur = racine.getBoundingClientRect().width;
      if (!largeur) return;
      const densite = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.round(largeur * densite);
      [[cArriere, badge.ctxArriere], [cAvant, badge.ctxAvant]].forEach(([c, ctx]) => {
        c.width = px;
        c.height = px;
        ctx.setTransform(px / 200, 0, 0, px / 200, 0, 0);
      });
      if (reduit) figer(badge);
    };

    const ro = new ResizeObserver(ajuster);
    ro.observe(racine);
    ajuster();

    let io;
    if (!reduit) {
      io = new IntersectionObserver(([e]) => { badge.visible = e.isIntersecting; });
      io.observe(racine);
      vivants.add(badge);
      demarrerBoucle();
    }

    return () => {
      ro.disconnect();
      io?.disconnect();
      vivants.delete(badge);
    };
  }, [cle]);

  const decor = DECORS[cle];
  if (!decor) return null;

  const plan = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' };

  return (
    <span
      ref={racineRef}
      aria-hidden='true'
      style={{ position: 'absolute', inset: 0, width: taille, height: taille, pointerEvents: 'none' }}
    >
      <svg viewBox='0 0 200 200' style={plan} dangerouslySetInnerHTML={{ __html: decor.arriere(new Date().getFullYear() + 1) }} />
      <canvas ref={canvasArriereRef} style={plan} />
      {/* Le logo officiel, au centre, à la taille exacte qu'il occupe dans
          le repère 200×200 des décors (56 %, centré). */}
      {avecLogo && (
        <img
          src={hisLogo}
          alt=''
          className={`hs-logo hs-logo--${decor.logo}`}
          style={{ position: 'absolute', left: '22%', top: '22%', width: '56%', height: '56%', borderRadius: '50%', objectFit: 'cover' }}
        />
      )}
      <canvas ref={canvasAvantRef} style={plan} />
      <svg viewBox='0 0 200 200' style={plan} dangerouslySetInnerHTML={{ __html: decor.avant(new Date().getFullYear() + 1) }} />
    </span>
  );
}

/** Une seule image, pour qui a demandé moins d'animations. */
function figer(badge) {
  const moteur = PARTICULES[badge.cle];
  if (!moteur) return;
  // 120 pas d'un coup : les particules partent d'un état aléatoire hors
  // champ, il faut les laisser entrer avant de prendre la photo.
  for (let i = 0; i < 120; i += 1) moteur.tick(badge.etat, badge.ctxArriere, badge.ctxAvant, 1, i * 16.7);
}

export default BadgeSaisonnier;
