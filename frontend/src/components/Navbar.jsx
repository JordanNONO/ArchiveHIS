
import { LuSettings, LuMenu, LuHelpCircle } from 'react-icons/lu';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { logoutAPI } from '../api/routes/auth';
import { SERVER_URL } from '../api';
import { getDisplayName, getInitials } from '../utils/common';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';

const ROLES_DEPOT = ['Intervenant', 'Beneficiaire'];

function Navbar({ toggleSidebar }) {
    const [user, setUser] = useState({});
    const navigate = useNavigate()
    const location = useLocation()
    const estCompteDepot = ROLES_DEPOT.includes(user?.role)
    function logout() {
        // La déconnexion locale doit toujours réussir, même si l'appel serveur
        // échoue (ex: token déjà expiré) — sinon un clic peut sembler ne rien faire.
        logoutAPI()
            .catch(() => {})
            .finally(() => {
                sessionStorage.clear()
                navigate("/login")
            })
    }
    useEffect(() => {
        const loadUser = () => setUser(JSON.parse(sessionStorage.getItem("user") || '{}'))
        loadUser()
        window.addEventListener('user-updated', loadUser)
        return () => window.removeEventListener('user-updated', loadUser)
    }, [location])

    const displayName = getDisplayName(user)
    const initials = getInitials(displayName)

    return (
        <div className='relative flex justify-between items-center py-3 px-4 sm:px-6 border-b border-border bg-card overflow-hidden'>
            {/* Motif décoratif discret (formes douces et floues, façon Microsoft 365)
                derrière la zone profil/icônes — purement esthétique, sans interaction,
                donc masqué aux lecteurs d'écran et ignoré au clic. */}
            <div aria-hidden='true' className='absolute inset-0 pointer-events-none overflow-hidden'>
                <div className='absolute top-1/2 -translate-y-1/2 right-4 w-28 h-28 rounded-full bg-primary/20 blur-lg' />
                <div className='absolute top-1/2 -translate-y-1/2 right-32 w-20 h-20 rounded-full bg-accent/30 blur-md' />
                <div className='absolute top-1/2 -translate-y-1/2 right-64 w-24 h-24 rounded-full bg-primary/[0.15] blur-md' />
                <div className='absolute top-1/2 -translate-y-1/2 right-96 w-14 h-14 rounded-full bg-accent/25 blur-sm' />
            </div>
            <div className='relative flex gap-3 sm:gap-4 items-center min-w-0'>
                <div>
                    <LuMenu size={19} className='md:hidden cursor-pointer text-muted-foreground shrink-0' onClick={toggleSidebar} />
                </div>
                <h1 className='hidden sm:block text-base font-semibold text-foreground truncate'>
                    Gestion de documents
                </h1>
            </div>

            <div className='relative flex justify-end items-center gap-2.5 sm:gap-4 shrink-0'>
                {!estCompteDepot && <LanguageSwitcher compact />}
                <NotificationBell />
                {estCompteDepot ? (
                    // Remplace l'ancien bouton "Aide" (LuHelpCircle) qui ne menait nulle
                    // part pour un compte dépôt — ce créneau sert mieux à la langue ici.
                    <LanguageSwitcher compact />
                ) : (
                    <Link to="/formation" className='text-muted-foreground hover:text-foreground transition-colors' title="Formation">
                        <LuHelpCircle size={19} />
                    </Link>
                )}
                {!estCompteDepot && (
                    <Link to="/setting" className='text-muted-foreground hover:text-foreground transition-colors'>
                        <LuSettings size={19} />
                    </Link>
                )}
                <div className="w-px h-6 bg-border" />
                <div className="dropdown dropdown-end">
                    {user?.profile ? (
                        <div className="avatar online cursor-pointer" tabIndex={0}>
                            <div className="w-9 rounded-full ring-2 ring-primary/20">
                                <img src={SERVER_URL+user?.profile} alt="" />
                            </div>
                        </div>
                    ) :
                        (
                            <div className="avatar placeholder cursor-pointer" tabIndex={0}>
                                <div className="bg-primary text-white w-9 rounded-full ring-2 ring-primary/20">
                                    <span className="text-xs font-semibold">
                                        {initials}
                                    </span>
                                </div>
                            </div>
                        )
                    }

                    <ul tabIndex={0} className="dropdown-content menu bg-card border border-border rounded-xl z-[1] w-52 p-2 shadow-lg mt-2">
                        <li><Link to={'/profile'} className='rounded-lg'>Profil</Link></li>
                        <li><button onClick={logout} className='text-destructive rounded-lg w-full text-left'>Déconnexion</button></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default Navbar;
