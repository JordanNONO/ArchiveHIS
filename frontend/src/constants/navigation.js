import { IoApps, IoDocumentAttach } from 'react-icons/io5';
import {
    LuActivity, LuBarChart3, LuMail, LuPhoneIncoming, LuLandmark, LuSmartphone,
    LuUsers2, LuBanknote, LuArrowLeftRight, LuListChecks, LuTrash2,
} from 'react-icons/lu';

/**
 * La navigation du personnel interne, en 4 groupes (maquette validée) —
 * une seule définition pour la barre latérale (Sidebar.jsx) et pour le
 * titre / fil d'Ariane de la barre du haut (Navbar.jsx), pour qu'ils ne
 * puissent jamais se contredire.
 *
 * `visible(droits)` : mêmes règles qu'avant la refonte — PAI, courriers,
 * appels et chèques sont ouverts en lecture à tout le personnel interne ;
 * Fluctuation RH et Téléphonie se méritent (données nominatives, codes
 * PIN/PUK) ; Bulletins de paie est réservé aux administrateurs (voir
 * AdminSeulementMiddleware côté serveur).
 * `compteur` : clé dans useCompteursNavigation (pastille du menu).
 */
export const GROUPES_NAVIGATION = [
    {
        id: 'pilotage',
        labelKey: 'sidebar.groupePilotage',
        liens: [
            { id: 'tableau', to: '/', icon: IoApps, labelKey: 'sidebar.tableauDeBord' },
            { id: 'activite', to: '/activite', icon: LuActivity, labelKey: 'sidebar.activite' },
            { id: 'statistiques', to: '/statistiques', icon: LuBarChart3, labelKey: 'sidebar.statistiques' },
        ],
    },
    {
        id: 'registres',
        labelKey: 'sidebar.groupeRegistres',
        liens: [
            { id: 'courriers', to: '/courriers', icon: LuMail, labelKey: 'sidebar.courriersCourt', compteur: 'courriers' },
            { id: 'appels', to: '/appels', icon: LuPhoneIncoming, labelKey: 'sidebar.appelsCourt', compteur: 'appels' },
            { id: 'cheques', to: '/cheques', icon: LuLandmark, labelKey: 'sidebar.chequesCourt', compteur: 'cheques' },
            {
                id: 'telephonie', to: '/telephonie', icon: LuSmartphone, labelKey: 'sidebar.telephonie',
                visible: (d) => d.isAdministrator || d.hasPermission('gerer_telephonie') || d.hasPermission('consulter_telephonie'),
            },
        ],
    },
    {
        id: 'rh',
        labelKey: 'sidebar.groupeRh',
        liens: [
            { id: 'personnel', to: '/personnel', icon: LuUsers2, labelKey: 'sidebar.personnel' },
            { id: 'bulletins-paie', to: '/bulletins-paie', icon: LuBanknote, labelKey: 'sidebar.bulletinsPaie', visible: (d) => d.isAdministrator },
            {
                id: 'fluctuation-rh', to: '/fluctuation-rh', icon: LuArrowLeftRight, labelKey: 'sidebar.fluctuationRh',
                visible: (d) => d.isAdministrator || d.hasPermission('gerer_fluctuation_rh') || d.hasPermission('consulter_fluctuation_rh'),
            },
            { id: 'pai', to: '/pai', icon: LuListChecks, labelKey: 'sidebar.pai' },
        ],
    },
    {
        id: 'archives',
        labelKey: 'sidebar.groupeArchives',
        liens: [
            { id: 'documents', to: '/doc', icon: IoDocumentAttach, labelKey: 'sidebar.documents', compteur: 'documents' },
            { id: 'corbeille', to: '/corbeille', icon: LuTrash2, labelKey: 'sidebar.corbeille' },
        ],
    },
];

/** Groupes filtrés selon les droits de l'utilisateur (groupes vides retirés). */
export function groupesVisibles(droits) {
    return GROUPES_NAVIGATION
        .map((g) => ({ ...g, liens: g.liens.filter((l) => !l.visible || l.visible(droits)) }))
        .filter((g) => g.liens.length > 0);
}

/** Un dossier ouvert depuis le tableau de bord garde « Tableau de bord » actif, comme avant. */
export function estLienActif(to, pathname) {
    if (to === '/') return pathname === '/' || pathname.startsWith('/folder/');
    return pathname === to || pathname.startsWith(`${to}/`);
}

// Pages hors menu : leur titre dans la barre du haut.
const PAGES_HORS_MENU = [
    { test: (p) => p.startsWith('/view/'), labelKey: 'navbar.pageDocument', groupe: 'archives' },
    { test: (p) => p.startsWith('/espace/'), labelKey: 'sidebar.tableauDeBord', groupe: null },
    { test: (p) => p === '/profile', labelKey: 'sidebar.monProfil', groupe: null },
    { test: (p) => p === '/setting', labelKey: 'sidebar.administration', groupe: null },
    { test: (p) => p === '/formation', labelKey: 'navbar.aide', groupe: null },
    { test: (p) => p === '/raccourcis', labelKey: 'raccourcis.titre', groupe: null },
    { test: (p) => p === '/contact', labelKey: 'sidebar.contact', groupe: null },
];

/** { labelKey, groupeLabelKey } de la page affichée — titre et fil d'Ariane de la barre du haut. */
export function pageCourante(pathname) {
    for (const groupe of GROUPES_NAVIGATION) {
        const lien = groupe.liens.find((l) => estLienActif(l.to, pathname));
        if (lien) {
            if (pathname.startsWith('/folder/')) return { labelKey: 'navbar.pageDossier', groupeLabelKey: 'sidebar.groupeArchives' };
            return { labelKey: lien.labelKey, groupeLabelKey: groupe.labelKey };
        }
    }
    const horsMenu = PAGES_HORS_MENU.find((p) => p.test(pathname));
    if (horsMenu) {
        const groupe = GROUPES_NAVIGATION.find((g) => g.id === horsMenu.groupe);
        return { labelKey: horsMenu.labelKey, groupeLabelKey: groupe?.labelKey || null };
    }
    return { labelKey: null, groupeLabelKey: null };
}
