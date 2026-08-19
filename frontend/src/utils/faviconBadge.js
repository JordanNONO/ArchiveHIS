/**
 * Badge de notifications non lues sur l'onglet du navigateur — façon
 * réseaux sociaux (Gmail, Facebook...) : un rond rouge avec le nombre,
 * superposé sur le logo dans l'onglet, plus le compte entre parenthèses
 * dans le titre de la page. Seul repère fiable pour quelqu'un qui a
 * plusieurs onglets ouverts et le son coupé (voir NotificationBell.jsx,
 * qui appelle ceci à chaque changement du nombre de notifications non lues).
 */
const TAILLE_CANVAS = 64;

// MainLayout.jsx pose un titre différent à chaque navigation (voir
// definirTitreBase ci-dessous) ; ce module compose juste le préfixe "(N) "
// par-dessus le dernier titre connu, sans jamais écraser l'autre — sinon
// les deux logiques (titre par route / badge de notifications) se
// marchaient dessus selon l'ordre d'exécution.
let dernierTitreBase = document.title;
let compteActuel = 0;

function appliquerTitre() {
  document.title = compteActuel > 0
    ? `(${compteActuel > 99 ? '99+' : compteActuel}) ${dernierTitreBase}`
    : dernierTitreBase;
}

/**
 * Appelé par MainLayout.jsx à chaque changement de route, à la place d'une
 * affectation directe à document.title.
 */
export function definirTitreBase(titre) {
  dernierTitreBase = titre;
  appliquerTitre();
}

let logoImage = null;
let logoPromise = null;

function chargerLogo() {
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { logoImage = img; resolve(img); };
      img.onerror = () => resolve(null);
      img.src = `${process.env.PUBLIC_URL || ''}/logo192.png`;
    });
  }
  return logoPromise;
}

function dessinerBadge(count) {
  const canvas = document.createElement('canvas');
  canvas.width = TAILLE_CANVAS;
  canvas.height = TAILLE_CANVAS;
  const ctx = canvas.getContext('2d');

  if (logoImage) {
    ctx.drawImage(logoImage, 0, 0, TAILLE_CANVAS, TAILLE_CANVAS);
  }

  if (count > 0) {
    const rayon = TAILLE_CANVAS * 0.32;
    const cx = TAILLE_CANVAS - rayon - 2;
    const cy = rayon + 2;

    ctx.beginPath();
    ctx.arc(cx, cy, rayon, 0, Math.PI * 2);
    ctx.fillStyle = '#DC2626';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    const texte = count > 9 ? '9+' : String(count);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${rayon}px -apple-system, Segoe UI, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texte, cx, cy + 1);
  }

  return canvas.toDataURL('image/png');
}

/**
 * @param {number} count nombre de notifications non lues (0 = retire le badge)
 */
export async function updateFaviconBadge(count) {
  await chargerLogo();

  const lien = document.getElementById('app-favicon');
  if (lien) {
    lien.href = count > 0 ? dessinerBadge(count) : (`${process.env.PUBLIC_URL || ''}/favicon.ico`);
  }

  compteActuel = count;
  appliquerTitre();
}
