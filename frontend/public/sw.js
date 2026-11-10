/**
 * Service worker minimal — sert uniquement à afficher les notifications
 * système (Web Push) envoyées par le backend (voir WebPushChannel.php),
 * même onglet/navigateur fermé. Pas de mise en cache/mode hors-ligne : ce
 * n'est pas l'objectif ici, juste les notifications.
 *
 * Nouveau modèle (maquette « Notifications HIS ») :
 * - titre « PRÉNOM — Action », urgence et contexte en tête du corps ;
 * - icône = logo HIS, avec en bas à droite la pastille de la personne
 *   (initiales et couleur ; ronde = personne, carrée = secteur) cerclée de
 *   la couleur d'urgence ;
 * - rien en double : pas de notification Windows quand l'appli est déjà au
 *   premier plan, et l'ancien abonnement « www » se désabonne ;
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

const TYPE_PICTO = { appel: 'appel', appel_rappel: 'appel', courrier: 'courrier' };
const LOGO = '/logo192.png';
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

let logoBitmap = null;
async function chargerLogo() {
  if (logoBitmap) return logoBitmap;
  const reponse = await fetch(LOGO);
  logoBitmap = await createImageBitmap(await reponse.blob());
  return logoBitmap;
}

/**
 * Icône de la notification : le logo HIS en grand (on reconnaît l'appli
 * d'un coup d'œil), et en bas à droite la pastille de la personne — ses
 * initiales sur sa couleur, ronde pour une personne, carrée pour un
 * secteur — cerclée de la couleur d'urgence. Null si le navigateur ne sait
 * pas dessiner (pas d'OffscreenCanvas) : on retombe alors sur le logo seul.
 */
async function dessinerIcone(cible, urgence) {
  if (!cible || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  try {
    const T = 192;
    const canvas = new OffscreenCanvas(T, T);
    const ctx = canvas.getContext('2d');

    const logo = await chargerLogo();
    const tailleLogo = 150;
    ctx.drawImage(logo, 0, 0, tailleLogo, tailleLogo);

    const r = 46;
    const cx = T - r - 2;
    const cy = T - r - 2;
    const contour = COULEUR_URGENCE[urgence?.niveau] || '#FFFFFF';
    const trace = (rayon) => {
      if (cible.forme === 'carre') {
        cheminRectangleArrondi(ctx, cx - rayon, cy - rayon, rayon * 2, rayon * 2, rayon * 0.4);
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, rayon, 0, Math.PI * 2);
      }
    };
    trace(r);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    trace(r - 4);
    ctx.fillStyle = contour;
    ctx.fill();
    trace(r - 10);
    ctx.fillStyle = cible.couleur || '#2563EB';
    ctx.fill();

    const initiales = (cible.initiales || '?').slice(0, 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${initiales.length > 2 ? 22 : 34}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(initiales, cx, cy + 2);

    return await blobEnDataUrl(await canvas.convertToBlob({ type: 'image/png' }));
  } catch {
    return null;
  }
}

/**
 * www.hisdocs.com servait le site sans rediriger : pour le navigateur c'est
 * un AUTRE site, avec son propre abonnement — d'où chaque notification reçue
 * deux fois, dont une avec l'ancien affichage (le service worker de www
 * n'était jamais mis à jour). Ici, un service worker qui tourne sur www se
 * désabonne : le serveur supprimera l'abonnement au prochain envoi (410).
 */
const SUR_DOUBLON_WWW = self.location.hostname.startsWith('www.');

/** L'appli est-elle ouverte et au premier plan ? Sa propre popup suffit alors. */
async function appliAuPremierPlan() {
  const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return fenetres.some((c) => c.focused && c.visibilityState === 'visible');
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
  const icone = (await dessinerIcone(cible, payload.urgence)) || LOGO;

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

  event.waitUntil((async () => {
    if (SUR_DOUBLON_WWW) {
      const abonnement = await self.registration.pushManager.getSubscription();
      if (abonnement) await abonnement.unsubscribe().catch(() => {});
      // Rien à afficher : hisdocs.com (sans www) affiche déjà la même.
      return;
    }
    // Appli ouverte devant soi : la popup dans l'appli (NotificationBell)
    // s'affiche déjà — la notification Windows en plus faisait doublon.
    if (await appliAuPremierPlan()) return;
    await afficher(payload);
  })());
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
