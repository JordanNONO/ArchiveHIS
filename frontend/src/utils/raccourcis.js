/**
 * Catalogue des raccourcis clavier — une seule source de vérité, lue à la
 * fois par le gestionnaire de touches (RaccourcisContext), par la page
 * /raccourcis, par le panneau d'aide et par la barre d'aide des listes.
 *
 * Avant ce fichier, 15 écouteurs `keydown` vivaient éparpillés dans
 * l'application sans se connaître : impossible de savoir quelle touche était
 * déjà prise, et rien n'empêchait deux composants d'écouter la même.
 *
 * Chaque entrée dit COMMENT elle est gérée (`gere`) :
 *  - 'externe'  : la touche est déjà écoutée ailleurs et ça marche très bien
 *                 (RechercheGlobale pour Ctrl+K, TitreRenommable pour F2, les
 *                 dialogues pour Échap). On ne la réécoute pas, on la
 *                 documente — réécouter la volerait à son propriétaire.
 *  - 'provider' : le gestionnaire agit lui-même (ouvrir le panneau, naviguer).
 *  - 'local'    : un composant doit s'inscrire via useRaccourci(). Sans
 *                 inscription, la touche garde son comportement navigateur —
 *                 elle n'est pas avalée pour rien.
 *  - 'reserve'  : jamais écoutée. Listée pour dire POURQUOI on l'écarte.
 */

export const CONTEXTES = ['global', 'navigation', 'liste', 'dossier', 'document', 'reserve'];

/** Préfixes d'accord (« G puis D ») — une touche de préfixe ne peut pas servir de raccourci à elle seule. */
export const PREFIXES_ACCORD = ['g'];

/** Au-delà de ce délai, un G resté sans suite est oublié : on ne veut pas qu'un G tapé par mégarde arme la navigation pour toujours. */
export const DELAI_ACCORD_MS = 1500;

export const RACCOURCIS = [
    // ---- Partout ----
    { id: 'recherche', signature: 'ctrl+k', contexte: 'global', gere: 'externe' },
    // `toujours` : le point d'interrogation n'exécute rien, il explique. Couper
    // les raccourcis d'une seule touche sert à ne pas déclencher une action par
    // mégarde — ça n'a aucune raison de fermer la porte de l'aide.
    { id: 'panneau', signature: '?', contexte: 'global', gere: 'provider', toujours: true },
    { id: 'fermer', signature: 'Escape', contexte: 'global', gere: 'externe' },
    { id: 'page', signature: 'ctrl+,', contexte: 'global', gere: 'provider' },

    // ---- Aller à : G puis une lettre, choisie sur le libellé français ----
    { id: 'allerAccueil', signature: 'g a', contexte: 'navigation', gere: 'provider', route: '/' },
    { id: 'allerDocuments', signature: 'g d', contexte: 'navigation', gere: 'provider', route: '/doc' },
    { id: 'allerPai', signature: 'g p', contexte: 'navigation', gere: 'provider', route: '/pai' },
    { id: 'allerCourriers', signature: 'g c', contexte: 'navigation', gere: 'provider', route: '/courriers' },
    // Même condition que l'entrée de menu correspondante (voir Sidebar.jsx) :
    // la lecture seule suffit pour y aller, mais il faut l'un des deux droits.
    { id: 'allerRh', signature: 'g r', contexte: 'navigation', gere: 'provider', route: '/fluctuation-rh', permissions: ['gerer_fluctuation_rh', 'consulter_fluctuation_rh'] },

    // ---- Dans une liste ----
    { id: 'listeHaut', signature: 'ArrowUp', contexte: 'liste', gere: 'local' },
    { id: 'listeBas', signature: 'ArrowDown', contexte: 'liste', gere: 'local' },
    { id: 'listeOuvrir', signature: 'Enter', contexte: 'liste', gere: 'local' },
    { id: 'listeCocher', signature: 'Espace', contexte: 'liste', gere: 'local' },
    { id: 'listeTout', signature: 'ctrl+a', contexte: 'liste', gere: 'local' },

    // ---- Sur le document de la ligne en cours ----
    { id: 'docTelecharger', signature: 't', contexte: 'document', gere: 'local', modifiable: true },
    { id: 'docRenommer', signature: 'F2', contexte: 'document', gere: 'externe' },
    // Jamais sur une touche nue, et jamais sans confirmation : voir 'ecarteSuppr'.
    { id: 'docCorbeille', signature: 'ctrl+Backspace', contexte: 'document', gere: 'local', confirmation: true, ecriture: true },

    // ---- Dans un dossier ----
    { id: 'dossierNouveau', signature: 'n', contexte: 'dossier', gere: 'local', modifiable: true, ecriture: true },
    { id: 'dossierImporter', signature: 'i', contexte: 'dossier', gere: 'local', modifiable: true, ecriture: true },
    { id: 'dossierParent', signature: 'Backspace', contexte: 'dossier', gere: 'local' },

    // ---- Écartés volontairement : la page le dit, plutôt que de laisser
    // croire que personne n'y a pensé. ----
    { id: 'ecarteSuppr', signature: 'Delete', contexte: 'reserve', gere: 'reserve', etat: 'ecarte' },
    { id: 'ecarteValider', signature: 'v', contexte: 'reserve', gere: 'reserve', etat: 'decider' },
];

/**
 * L'état à afficher en bout de ligne. Un seul endroit décide, pour que le
 * panneau d'aide et la page ne puissent pas se contredire.
 */
export function etatRaccourci(raccourci) {
    if (raccourci.etat) return raccourci.etat;
    if (raccourci.gere === 'externe') return 'service';
    if (raccourci.confirmation) return 'confirmation';
    return 'actif';
}

/** Index par identifiant, pour les lectures ponctuelles. */
export const PAR_ID = Object.fromEntries(RACCOURCIS.map((r) => [r.id, r]));

/**
 * Normalise une touche telle que le navigateur la donne (event.key) : on
 * travaille sur le CARACTÈRE PRODUIT, jamais sur la position physique
 * (event.code). C'est ce qui fait qu'un même raccourci marche sur AZERTY,
 * QWERTY ou un clavier arabe : « ? » reste « ? » même si la combinaison
 * physique pour le produire change d'un clavier à l'autre.
 */
export function normaliserTouche(touche) {
    if (touche === ' ') return 'Espace';
    return String(touche).length === 1 ? String(touche).toLowerCase() : String(touche);
}

/**
 * Signature d'un événement clavier : 'ctrl+k', 't', 'maj+ArrowUp', 'Escape'…
 * Maj n'est noté que pour les touches nommées : pour un caractère imprimable
 * il est déjà contenu dans le caractère produit (en AZERTY, « ? » EST Maj+,).
 */
export function signatureEvenement(e) {
    const touche = normaliserTouche(e.key);
    const morceaux = [];
    if (e.ctrlKey || e.metaKey) morceaux.push('ctrl');
    if (e.shiftKey && touche.length > 1) morceaux.push('maj');
    morceaux.push(touche);
    return morceaux.join('+');
}

const LIBELLES_TOUCHE = {
    ctrl: 'Ctrl',
    maj: 'Maj',
    Escape: 'Échap',
    Enter: 'Entrée',
    Espace: 'Espace',
    Backspace: '⌫',
    Delete: 'Suppr',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Tab: '⇥',
};

/** Libellé affichable d'une touche seule. */
export function libelleTouche(touche) {
    if (LIBELLES_TOUCHE[touche]) return LIBELLES_TOUCHE[touche];
    return touche.length === 1 ? touche.toUpperCase() : touche;
}

/**
 * Découpe une signature en touches affichables + le mot qui les relie.
 * 'ctrl+k' → { liaison: '+', touches: ['Ctrl', 'K'] }
 * 'g d'    → { liaison: 'puis', touches: ['G', 'D'] }
 */
export function morceauxSignature(signature) {
    if (signature.includes(' ')) {
        return { liaison: 'puis', touches: signature.split(' ').map(libelleTouche) };
    }
    return { liaison: '+', touches: signature.split('+').map(libelleTouche) };
}

/**
 * Touches physiques à allumer sur la carte du clavier. « ? » n'existe pas en
 * tant que touche sur un AZERTY : c'est Maj + la virgule, et c'est bien ces
 * deux touches-là qu'il faut montrer à quelqu'un qui cherche où appuyer.
 */
const TOUCHES_COMPOSEES = { '?': ['Shift', ','], '/': ['Shift', ':'] };

export function touchesPhysiques(signature) {
    const brutes = signature.includes(' ') ? signature.split(' ') : signature.split('+');
    return brutes.flatMap((touche) => {
        if (touche === 'ctrl') return ['Control'];
        if (touche === 'maj') return ['Shift'];
        return TOUCHES_COMPOSEES[touche] || [touche];
    });
}

/** Signature réellement en vigueur pour un raccourci, surcharge personnelle comprise. */
export function signatureEffective(raccourci, surcharges = {}) {
    return (raccourci.modifiable && surcharges[raccourci.id]) || raccourci.signature;
}

/**
 * Une signature d'une seule touche imprimable, sans Ctrl — c'est-à-dire
 * exactement ce que le réglage « raccourcis d'une seule touche » permet de
 * couper, accords « G puis… » compris.
 */
export function estToucheSimple(signature) {
    if (signature.includes(' ')) return true;
    if (signature.includes('+')) return false;
    return signature.length === 1;
}

/**
 * Le raccourci est-il à la portée de cette personne ? Même logique que les
 * entrées de menu : un raccourci qui ne mènerait nulle part ne doit ni
 * s'afficher dans la page, ni répondre sous les doigts.
 */
export function estAutorise(raccourci, { hasPermission, isAdministrator }) {
    if (raccourci.ecriture && !isAdministrator && !hasPermission('archiver_documents')) return false;
    if (!raccourci.permissions) return true;
    if (isAdministrator) return true;
    return raccourci.permissions.some(hasPermission);
}

/** Les raccourcis visibles pour cette personne, dans l'ordre du catalogue. */
export function raccourcisAutorises(droits) {
    return RACCOURCIS.filter((r) => estAutorise(r, droits));
}

/**
 * Le raccourci déjà pris par cette signature, s'il y en a un — utilisé au
 * moment de capturer une nouvelle touche, pour refuser un doublon avant de
 * l'enregistrer plutôt que de laisser deux actions se battre.
 */
export function raccourciEnConflit(signature, idExclu, droits, surcharges = {}) {
    return raccourcisAutorises(droits).find(
        (r) => r.id !== idExclu && r.gere !== 'reserve' && signatureEffective(r, surcharges) === signature,
    ) || null;
}

/**
 * Une touche capturée est-elle acceptable comme raccourci ? On n'accepte
 * qu'une lettre ou un chiffre : tout le reste est soit réservé au navigateur
 * (F5, Tab), soit essentiel à la saisie (Entrée, Échap, les flèches), soit
 * dangereux (Suppr). Retourne null si c'est bon, sinon la raison.
 */
export function refusDeTouche(signature) {
    const sansCtrl = signature.replace(/^ctrl\+/, '');
    if (sansCtrl.length !== 1 || !/[a-z0-9]/.test(sansCtrl)) return 'raccourcis.refusLettre';
    if (!signature.startsWith('ctrl+') && PREFIXES_ACCORD.includes(sansCtrl)) return 'raccourcis.refusPrefixe';
    return null;
}
