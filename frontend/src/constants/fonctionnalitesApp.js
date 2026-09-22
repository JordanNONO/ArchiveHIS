import { IoApps, IoDocumentAttach } from 'react-icons/io5';
import { LuUsers2, LuListChecks, LuMail, LuPhoneIncoming, LuLandmark, LuTrash2, LuActivity, LuBarChart3, LuShieldCheck, LuTag, LuBuilding2, LuBriefcase, LuUserCircle2 } from 'react-icons/lu';

/**
 * Index des fonctionnalités/pages de l'appli pour la recherche globale (voir
 * RechercheGlobale.jsx) — "chercher une fonctionnalité comme sur un
 * téléphone", pas les documents eux-mêmes (déjà couverts par la recherche
 * documentaire existante). Réservé au personnel interne (voir estCompteDepot
 * dans Navbar.jsx), qui a un jeu de pages fixe — contrairement à un compte
 * dépôt, dont les pages dépendent de tuilesDuTableauDeBord(role).
 *
 * `permission`/`adminOnly` reprennent exactement les mêmes règles de
 * visibilité que Sidebar.jsx, pour ne jamais faire apparaître ici une page
 * que la personne ne peut pas réellement ouvrir.
 */
export function listeFonctionnalites(t) {
  return [
    { id: 'tableau-de-bord', to: '/', label: t('sidebar.tableauDeBord'), icon: IoApps },
    { id: 'documents', to: '/doc', label: t('sidebar.documents'), icon: IoDocumentAttach },
    { id: 'personnel', to: '/personnel', label: t('sidebar.personnel'), icon: LuUsers2 },
    { id: 'pai', to: '/pai', label: 'PAI', icon: LuListChecks, permission: 'gerer_pai' },
    { id: 'courriers', to: '/courriers', label: t('sidebar.courriers'), icon: LuMail, permission: 'traiter_courrier' },
    { id: 'appels', to: '/appels', label: t('sidebar.appels'), icon: LuPhoneIncoming, permission: 'gerer_appels' },
    { id: 'cheques', to: '/cheques', label: t('sidebar.cheques'), icon: LuLandmark, permission: 'gerer_cheques' },
    { id: 'corbeille', to: '/corbeille', label: t('sidebar.corbeille'), icon: LuTrash2 },
    { id: 'activite', to: '/activite', label: t('sidebar.activite'), icon: LuActivity },
    { id: 'statistiques', to: '/statistiques', label: t('sidebar.statistiques'), icon: LuBarChart3 },
    { id: 'profil', to: '/profile', label: t('sidebar.monProfil'), icon: LuUserCircle2 },
    { id: 'admin-roles', to: '/setting?tab=roles', label: t('sidebar.rolesPermissions'), icon: LuShieldCheck, adminOnly: true },
    { id: 'admin-categories', to: '/setting?tab=categories', label: t('sidebar.categories'), icon: LuTag, adminOnly: true },
    { id: 'admin-bureaux', to: '/setting?tab=bureaux', label: t('sidebar.bureaux'), icon: LuBuilding2, adminOnly: true },
    { id: 'admin-services', to: '/setting?tab=services', label: t('sidebar.servicesMetier'), icon: LuBriefcase, adminOnly: true },
  ];
}
