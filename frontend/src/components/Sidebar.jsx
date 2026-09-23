import { IoApps, IoDocumentAttach } from "react-icons/io5";
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LuUsers2, LuShieldCheck, LuChevronDown, LuTag, LuBuilding2, LuBriefcase, LuTrash2, LuActivity, LuPhoneCall, LuPhoneIncoming, LuListChecks, LuBarChart3, LuMail, LuLandmark, LuGripVertical } from "react-icons/lu";
import { useTranslation } from 'react-i18next';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import NavLink from './NavLink';
import hisLogo from '../assets/his-badge.png';
import { getDisplayName, getInitials } from '../utils/common';
import { usePermissions } from '../hooks/usePermissions';
import { useOrdrePersonnalise } from '../hooks/useOrdrePersonnalise';
import { tuilesDuTableauDeBord } from '../constants/typesDemande';

const PERMISSIONS_ADMIN = ['gerer_roles', 'gerer_permissions', 'gerer_categories', 'gerer_services_metier', 'gerer_utilisateurs'];
const ROLES_DEPOT = ['Intervenant', 'Beneficiaire'];

// `permission` : chaque lien exige la sienne propre (pas juste "fait partie
// de la rubrique Administration") — voir Settings.jsx, même raisonnement.
const ADMIN_LINKS = [
    { tab: 'roles', labelKey: 'sidebar.rolesPermissions', icon: LuShieldCheck, permission: 'gerer_roles' },
    { tab: 'categories', labelKey: 'sidebar.categories', icon: LuTag, permission: 'gerer_categories' },
    { tab: 'bureaux', labelKey: 'sidebar.bureaux', icon: LuBuilding2, permission: 'gerer_utilisateurs' },
    { tab: 'services', labelKey: 'sidebar.servicesMetier', icon: LuBriefcase, permission: 'gerer_services_metier' },
];

/**
 * Un lien de la barre latérale, glissable via une poignée dédiée (visible au
 * survol) plutôt que sur toute la ligne — contrairement aux cartes du
 * tableau de bord (CarteStat dans Home.jsx), un lien de menu se clique très
 * souvent et vite : une poignée séparée évite tout risque qu'un clic rapide
 * soit pris pour un début de glissement.
 */
function LienSidebarTriable({ lien, children }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lien.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : undefined,
    };
    return (
        <div ref={setNodeRef} style={style} className='group relative'>
            {children}
            <button
                type='button'
                {...attributes}
                {...listeners}
                title={lien.titreGlisser}
                className='absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-md text-transparent group-hover:text-white/30 hover:!text-white/70 cursor-grab active:cursor-grabbing touch-none transition-colors'
            >
                <LuGripVertical size={14} />
            </button>
        </div>
    );
}

function Sidebar() {
    const { t } = useTranslation();
    const location = useLocation();
    const isOnSettings = location.pathname === '/setting';
    const activeTab = new URLSearchParams(location.search).get('tab') || 'roles';
    const [adminOpen, setAdminOpen] = useState(isOnSettings);
    const [user, setUser] = useState({});
    const { isAdministrator, hasPermission, role } = usePermissions();
    const peutVoirAdministration = PERMISSIONS_ADMIN.some(hasPermission);
    const estCompteDepot = ROLES_DEPOT.includes(role);

    useEffect(() => {
        const loadUser = () => setUser(JSON.parse(sessionStorage.getItem('user') || '{}'));
        loadUser();
        if (isOnSettings) setAdminOpen(true);
        window.addEventListener('user-updated', loadUser);
        return () => window.removeEventListener('user-updated', loadUser);
    }, [location, isOnSettings]);

    const displayName = getDisplayName(user);
    const initials = getInitials(displayName);

    // Liens internes réordonnables (voir useOrdrePersonnalise) — "Tableau de
    // bord" reste fixe en tout premier (ancre naturelle, jamais parmi les
    // liens glissables), la corbeille/activité/statistiques restent
    // réordonnables comme le reste : aucune raison de les figer plus que les
    // autres.
    const liensInternes = [
        { id: 'documents', to: '/doc', icon: IoDocumentAttach, label: t('sidebar.documents') },
        { id: 'personnel', to: '/personnel', icon: LuUsers2, label: t('sidebar.personnel') },
        hasPermission('gerer_pai') && { id: 'pai', to: '/pai', icon: LuListChecks, label: 'PAI' },
        (isAdministrator || hasPermission('traiter_courrier')) && { id: 'courriers', to: '/courriers', icon: LuMail, label: t('sidebar.courriers') },
        (isAdministrator || hasPermission('gerer_appels')) && { id: 'appels', to: '/appels', icon: LuPhoneIncoming, label: t('sidebar.appels') },
        (isAdministrator || hasPermission('gerer_cheques')) && { id: 'cheques', to: '/cheques', icon: LuLandmark, label: t('sidebar.cheques') },
        { id: 'corbeille', to: '/corbeille', icon: LuTrash2, label: t('sidebar.corbeille') },
        { id: 'activite', to: '/activite', icon: LuActivity, label: t('sidebar.activite') },
        { id: 'statistiques', to: '/statistiques', icon: LuBarChart3, label: t('sidebar.statistiques') },
    ].filter(Boolean).map((l) => ({ ...l, titreGlisser: t('sidebar.glisserPourReordonner') }));

    const [ordreLiens, setOrdreLiens] = useOrdrePersonnalise('his_ordre_sidebar', liensInternes.map((l) => l.id));
    const liensInternesTries = ordreLiens.map((id) => liensInternes.find((l) => l.id === id)).filter(Boolean);
    const capteursSidebar = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
    function onDragEndLiens(event) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const ancienIndex = ordreLiens.indexOf(active.id);
        const nouvelIndex = ordreLiens.indexOf(over.id);
        setOrdreLiens(arrayMove(ordreLiens, ancienIndex, nouvelIndex));
    }

    return (
        <div className='w-full bg-gradient-to-b from-[#1B365D] to-[#0A0F16] h-screen flex flex-col'>
            <div className="py-8 px-4 flex flex-col items-center gap-3 border-b border-white/10">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-accent/25 blur-xl scale-125" />
                    <div className="relative w-20 h-20 rounded-full bg-white shadow-lg ring-4 ring-white/5 overflow-hidden">
                        <img src={hisLogo} alt="Hetep Iaout Services" className="w-full h-full object-cover" />
                    </div>
                </div>
                <div className="text-center">
                    <h1 className='text-white text-sm font-semibold leading-tight tracking-wide'>
                        {t('commun.entreprise')}
                    </h1>
                    <p className='text-white/40 text-xs italic mt-0.5'>{t('sidebar.slogan')}</p>
                </div>
            </div>
            <div className='mt-6 flex flex-col gap-6 px-3 overflow-x-hidden overflow-y-auto flex-grow'>
                <div className="flex flex-col gap-1.5">
                    <p className='text-white/25 text-[11px] font-semibold uppercase tracking-wider px-3 mb-1'>
                        {t('sidebar.general')}
                    </p>
                    <NavLink to="/" icon={IoApps}>
                        {t('sidebar.tableauDeBord')}
                    </NavLink>
                    {estCompteDepot ? (
                        <>
                            {tuilesDuTableauDeBord(role).flatMap((tuile) => (
                                tuile.groupe
                                    ? tuile.membres.map((m) => (
                                        <NavLink key={m.id} to={m.to} icon={m.icon}>
                                            {t(m.label)}
                                        </NavLink>
                                    ))
                                    : [(
                                        <NavLink key={tuile.id} to={tuile.to} icon={tuile.icon}>
                                            {t(tuile.label)}
                                        </NavLink>
                                    )]
                            ))}
                            <NavLink to="/corbeille" icon={LuTrash2}>
                                {t('sidebar.corbeille')}
                            </NavLink>
                            <NavLink to="/contact" icon={LuPhoneCall}>
                                {t('sidebar.contact')}
                            </NavLink>
                        </>
                    ) : (
                        <DndContext sensors={capteursSidebar} collisionDetection={closestCenter} onDragEnd={onDragEndLiens}>
                            <SortableContext items={ordreLiens} strategy={verticalListSortingStrategy}>
                                {liensInternesTries.map((lien) => (
                                    <LienSidebarTriable key={lien.id} lien={lien}>
                                        <NavLink to={lien.to} icon={lien.icon}>
                                            {lien.label}
                                        </NavLink>
                                    </LienSidebarTriable>
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>

                {!estCompteDepot && peutVoirAdministration && (
                    <div className="flex flex-col gap-1.5">
                        <button
                            onClick={() => setAdminOpen((v) => !v)}
                            className='flex items-center justify-between px-3 py-1 text-white/25 hover:text-white/50 transition-colors'
                        >
                            <span className='text-[11px] font-semibold uppercase tracking-wider'>{t('sidebar.administration')}</span>
                            <LuChevronDown size={14} className={`transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {adminOpen && (
                            <div className='flex flex-col gap-1'>
                                {ADMIN_LINKS.filter(({ permission }) => hasPermission(permission)).map(({ tab, labelKey, icon: Icon }) => {
                                    const active = isOnSettings && activeTab === tab;
                                    return (
                                        <Link
                                            key={tab}
                                            to={`/setting?tab=${tab}`}
                                            className={`group flex items-center gap-3 text-sm rounded-lg px-2.5 py-2 transition-colors ${active ? 'bg-accent/[0.14] text-white font-semibold shadow-[inset_0_0_0_1px_rgba(250,204,21,0.35)]' : 'text-white/50 font-medium hover:bg-white/5 hover:text-white/85'}`}
                                        >
                                            <span className={`flex items-center justify-center w-6 h-6 rounded-lg shrink-0 transition-colors ${active ? 'bg-accent text-[#142744]' : 'bg-white/[0.08] text-current group-hover:bg-white/[0.14]'}`}>
                                                <Icon size={13} />
                                            </span>
                                            {t(labelKey)}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Link to="/profile" className='flex items-center gap-3 px-4 py-4 border-t border-white/10 hover:bg-white/5 transition-colors'>
                <div className='flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white text-xs font-semibold shrink-0'>
                    {initials || '?'}
                </div>
                <div className='overflow-hidden'>
                    <p className='text-white text-sm font-medium truncate'>{displayName || '—'}</p>
                    <p className='text-white/40 text-xs truncate'>{user?.role || t('sidebar.utilisateur')}</p>
                </div>
            </Link>
        </div>
    );
}

export default Sidebar
