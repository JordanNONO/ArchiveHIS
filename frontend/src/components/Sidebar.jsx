import { IoApps, IoDocumentAttach } from "react-icons/io5";
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LuUsers2, LuShieldCheck, LuChevronDown, LuTag, LuBuilding2, LuBriefcase, LuTrash2, LuActivity } from "react-icons/lu";
import NavLink from './NavLink';
import hisLogo from '../assets/his-badge.png';
import { getDisplayName, getInitials } from '../utils/common';
import { usePermissions } from '../hooks/usePermissions';
import { TYPES_DE_DEMANDE } from '../constants/typesDemande';

const PERMISSIONS_ADMIN = ['gerer_roles', 'gerer_permissions', 'gerer_categories', 'gerer_services_metier', 'gerer_utilisateurs'];
const ROLES_DEPOT = ['Intervenant', 'Beneficiaire'];

const ADMIN_LINKS = [
    { tab: 'roles', label: 'Rôles & Permissions', icon: LuShieldCheck },
    { tab: 'categories', label: 'Catégories', icon: LuTag },
    { tab: 'bureaux', label: 'Bureaux', icon: LuBuilding2 },
    { tab: 'services', label: 'Services métier', icon: LuBriefcase },
];

function Sidebar() {
    const location = useLocation();
    const isOnSettings = location.pathname === '/setting';
    const activeTab = new URLSearchParams(location.search).get('tab') || 'roles';
    const [adminOpen, setAdminOpen] = useState(isOnSettings);
    const [user, setUser] = useState({});
    const { isAdministrator, hasPermission, role } = usePermissions();
    const peutVoirAdministration = isAdministrator || PERMISSIONS_ADMIN.some(hasPermission);
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
                        Hetep Iaout Services
                    </h1>
                    <p className='text-white/40 text-xs italic mt-0.5'>L'unité sur le chemin de la sérénité</p>
                </div>
            </div>
            <div className='mt-6 flex flex-col gap-6 px-3 overflow-x-hidden overflow-y-auto flex-grow'>
                <div className="flex flex-col gap-1.5">
                    <p className='text-white/25 text-[11px] font-semibold uppercase tracking-wider px-3 mb-1'>
                        Général
                    </p>
                    <NavLink to="/" icon={IoApps}>
                        {estCompteDepot ? 'Tableau de bord' : 'Tableau de bord'}
                    </NavLink>
                    {estCompteDepot ? (
                        TYPES_DE_DEMANDE.map((t) => (
                            <NavLink key={t.id} to={`/espace/${t.id}`} icon={t.icon}>
                                {t.label}
                            </NavLink>
                        ))
                    ) : (
                        <>
                            <NavLink to="/doc" icon={IoDocumentAttach}>
                                Documents
                            </NavLink>
                            <NavLink to="/personnel" icon={LuUsers2}>
                                Personnel
                            </NavLink>
                            <NavLink to="/corbeille" icon={LuTrash2}>
                                Corbeille
                            </NavLink>
                            <NavLink to="/activite" icon={LuActivity}>
                                Activité
                            </NavLink>
                        </>
                    )}
                </div>

                {!estCompteDepot && peutVoirAdministration && (
                    <div className="flex flex-col gap-1.5">
                        <button
                            onClick={() => setAdminOpen((v) => !v)}
                            className='flex items-center justify-between px-3 py-1 text-white/25 hover:text-white/50 transition-colors'
                        >
                            <span className='text-[11px] font-semibold uppercase tracking-wider'>Administration</span>
                            <LuChevronDown size={14} className={`transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {adminOpen && (
                            <div className='flex flex-col gap-1'>
                                {ADMIN_LINKS.map(({ tab, label, icon: Icon }) => {
                                    const active = isOnSettings && activeTab === tab;
                                    return (
                                        <Link
                                            key={tab}
                                            to={`/setting?tab=${tab}`}
                                            className={`relative flex items-center gap-3 text-sm font-medium rounded-lg px-3 py-2 transition-colors ${active ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                                        >
                                            {active && <span className='absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent' />}
                                            <Icon size={16} className={active ? 'text-accent' : ''} />
                                            {label}
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
                    <p className='text-white/40 text-xs truncate'>{user?.role || 'Utilisateur'}</p>
                </div>
            </Link>
        </div>
    );
}

export default Sidebar
