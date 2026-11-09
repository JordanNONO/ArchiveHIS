/**
 * Service worker minimal — sert uniquement à afficher les notifications
 * système (Web Push) envoyées par le backend (voir WebPushChannel.php),
 * même onglet/navigateur fermé. Pas de mise en cache/mode hors-ligne : ce
 * n'est pas l'objectif ici, juste les notifications.
 *
 * Nouveau modèle (maquette « Notifications HIS ») :
 * - titre « PRÉNOM — Action », urgence et contexte en tête du corps ;
 * - icône = avatar aux initiales et à la couleur de la personne (rond) ou du
 *   secteur (carré), avec une pastille du type (appel, courrier) ;
 * - reste à l'écran si urgent, avec ses deux boutons d'action ;
 * - une relance remplace la précédente (même tag) au lieu de s'empiler ;
 * - au-delà de 3 notifications pour la même personne, une seule résumée.
 */

const SEUIL_REGROUPEMENT = 3;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Pictogrammes (traits, viewBox 24) dessinés dans la pastille de l'avatar.
const PICTOS = {
  appel: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z'],
  courrier: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 6l-10 7L2 6'],
};
const TYPE_PICTO = { appel: 'appel', appel_rappel: 'appel', courrier: 'courrier' };
const COULEUR_URGENCE = { urgent: '#B91C1C', retard: '#C2410C', nouveau: '#1D4ED8' };

function cheminRectangleArrondi(ctx, x, y, l, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

async function blobEnDataUrl(blob) {
  const octets = new Uint8Array(await blob.arrayBuffer());
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
  }
  return `data:${blob.type};base64,${btoa(binaire)}`;
}

/**
 * Avatar dessiné à la volée — null si le navigateur ne sait pas faire
 * (pas d'OffscreenCanvas) : on retombe alors sur le logo.
 */
async function dessinerAvatar(cible, type, urgence) {
  if (!cible || typeof OffscreenCanvas === 'undefined') return null;
  try {
    const T = 192;
    const canvas = new OffscreenCanvas(T, T);
    const ctx = canvas.getContext('2d');
    const marge = 8;
    const taille = T - marge * 2 - 20;

    ctx.fillStyle = cible.couleur || '#2563EB';
    if (cible.forme === 'carre') {
      cheminRectangleArrondi(ctx, marge, marge, taille, taille, 34);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(marge + taille / 2, marge + taille / 2, taille / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const initiales = (cible.initiales || '?').slice(0, 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${initiales.length > 2 ? 40 : 60}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(initiales, marge + taille / 2, marge + taille / 2 + 3);

    const picto = PICTOS[TYPE_PICTO[type]];
    if (picto && typeof Path2D !== 'undefined') {
      const r = 34;
      const cx = T - r - 4;
      const cy = T - r - 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
      ctx.fillStyle = COULEUR_URGENCE[urgence?.niveau] || '#374151';
      ctx.fill();
      ctx.save();
      ctx.translate(cx - 16, cy - 16);
      ctx.scale(32 / 24, 32 / 24);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      picto.forEach((d) => ctx.stroke(new Path2D(d)));
      ctx.restore();
    }

    return await blobEnDataUrl(await canvas.convertToBlob({ type: 'image/png' }));
  } catch {
    return null;
  }
}

/** « 2 appels · 2 courriers » pour la notification résumée. */
function resumeParType(elements) {
  const compte = { appel: 0, courrier: 0, autre: 0 };
  elements.forEach((e) => { compte[TYPE_PICTO[e.type] || 'autre'] += 1; });
  const morceaux = [];
  if (compte.appel) morceaux.push(`${compte.appel} appel${compte.appel > 1 ? 's' : ''}`);
  if (compte.courrier) morceaux.push(`${compte.courrier} courrier${compte.courrier > 1 ? 's' : ''}`);
  if (compte.autre) morceaux.push(`${compte.autre} autre${compte.autre > 1 ? 's' : ''}`);
  return morceaux.join(' · ');
}

async function afficher(payload) {
  const cible = payload.cible || null;
  const groupe = cible?.cle || 'vous';
  const element = {
    titre: payload.titre || payload.title,
    urgence: payload.urgence?.libelle || '',
    url: payload.url || '/',
    type: payload.type,
    tag: payload.tag || null,
  };
  const icone = (await dessinerAvatar(cible, payload.type, payload.urgence)) || '/logo192.png';

  // Regroupement : notifications encore affichées pour la même personne
  // (hors celle que la nouvelle remplace, même tag), résumé compris.
  const ouvertes = (await self.registration.getNotifications())
    .filter((n) => n.data?.groupe === groupe);
  const resume = ouvertes.find((n) => n.data?.resume);
  const individuelles = ouvertes.filter((n) => !n.data?.resume && (!element.tag || n.tag !== element.tag));
  const anciens = [
    ...(resume?.data?.elements || []),
    ...individuelles.map((n) => n.data.element),
  ].filter((e) => e && (!element.tag || e.tag !== element.tag));
  const elements = [element, ...anciens];

  if (elements.length > SEUIL_REGROUPEMENT) {
    individuelles.forEach((n) => n.close());
    const libelle = cible?.libelle || 'POUR VOUS';
    const lignes = elements.slice(0, 4).map((e) => [e.titre, e.urgence].filter(Boolean).join(' · '));
    if (elements.length > 4) lignes.push(`+ ${elements.length - 4} autre(s)`);
    return self.registration.showNotification(`${libelle} — ${elements.length} éléments à traiter`, {
      body: [resumeParType(elements), ...lignes].join('\n'),
      icon: icone,
      badge: '/logo192.png',
      tag: `groupe-${groupe}`,
      renotify: true,
      requireInteraction: elements.some((e) => e.urgence),
      actions: [{ action: 'liste', title: 'Voir ma liste' }],
      data: { url: '/?notifications=1', groupe, resume: true, elements },
    });
  }

  const actions = (payload.actions || []).slice(0, 2);
  const options = {
    body: payload.body,
    icon: icone,
    badge: '/logo192.png',
    requireInteraction: !!payload.persistante,
    actions: actions.map((a) => ({ action: a.action, title: a.title })),
    data: { url: element.url, groupe, element, actions },
  };
  if (element.tag) {
    // Même tag = la nouvelle relance remplace l'ancienne et ressonne.
    options.tag = element.tag;
    options.renotify = true;
  }
  return self.registration.showNotification(payload.title, options);
}

self.addEventListener('push', (event) => {
  let payload = { title: 'HIS Archivage', body: '', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // ignore payload non-JSON, garde les valeurs par défaut
  }

  event.waitUntil(afficher(payload));
});

// Un clic focalise un onglet HIS Archivage déjà ouvert plutôt que d'en
// ouvrir un nouveau à chaque fois, et le fait naviguer vers le document
// concerné — sinon on se retrouve avec un onglet par notification cliquée.
function ouvrir(url) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = (data.actions || []).find((a) => a.action === event.action);

  // « Rappeler dans 1 h » : le serveur renverra la même notification plus
  // tard (URL signée, voir PushSubscriptionController::reporter) — rien à ouvrir.
  if (action?.action === 'reporter') {
    if (action.url) event.waitUntil(fetch(action.url, { mode: 'no-cors' }).catch(() => {}));
    return;
  }

  event.waitUntil(ouvrir(action?.url || data.url || '/'));
});
