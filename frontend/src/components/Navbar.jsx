
import { LuSettings, LuMenu, LuHelpCircle, LuKeyboard } from 'react-icons/lu';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { logoutAPI } from '../api/routes/auth';
import { detacherAbonnementDuCompte } from '../utils/pushNotifications';
import { SERVER_URL } from '../api';
import { getDisplayName, getInitials } from '../utils/common';
import NotificationBell from './NotificationBell';
import MessagerieIcone from './MessagerieIcone';
import LanguageSwitcher from './LanguageSwitcher';
import RechercheGlobale from './RechercheGlobale';
import { usePermissions } from '../hooks/usePermissions';

const ROLES_DEPOT = ['Intervenant', 'Beneficiaire'];

function Navbar({ toggleSidebar }) {
    const { t } = useTranslation();
    const [user, setUser] = useState({});
    const navigate = useNavigate()
    const location = useLocation()
    // Lu directement depuis sessionStorage (comme MainLayout.jsx et
    // Sidebar.jsx, via usePermissions) plutôt que depuis le `user` local
    // ci-dessus : ce dernier ne se peuple qu'après coup (useEffect), donc
    // vaut encore {} au tout premier rendu suivant un remount de Navbar — ce
    // qui arrive après une navigation vers une page chargée en lazy (React
    // suspend alors tout l'arbre jusqu'au <Suspense> racine, au-dessus de
    // MainLayout, puis le remonte). À ce premier rendu, estCompteDepot
    // valait donc `false` ici alors que MainLayout (lui, synchrone) avait
    // déjà correctement choisi de ne PAS monter <MessagerieProvider> pour ce
    // compte — <MessagerieIcone/> se montait quand même et plantait toute la
    // page (contexte null, voir useMessagerie()).
    const { role } = usePermissions();
    const estCompteDepot = ROLES_DEPOT.includes(role)
    function logout() {
        // La déconnexion locale doit toujours réussir, même si l'appel serveur
        // échoue (ex: token déjà expiré) — sinon un clic peut sembler ne rien faire.
        // Ce PC ne doit plus recevoir les notifications de ce compte.
        detacherAbonnementDuCompte()
            .then(() => logoutAPI())
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
        <div className='flex justify-between items-center py-3 px-4 sm:px-6 border-b border-border bg-card'>
            <div className='flex gap-3 sm:gap-4 items-center min-w-0'>
                <div>
                    <LuMenu size={19} className='md:hidden cursor-pointer text-muted-foreground shrink-0' onClick={toggleSidebar} />
                </div>
                <h1 className='hidden sm:block text-base font-semibold text-foreground truncate'>
                    {t('commun.titreNavbar')}
                </h1>
            </div>

            <div className='flex justify-end items-center gap-1.5 sm:gap-2.5 shrink-0'>
                {!estCompteDepot && <RechercheGlobale />}

                {/* Réglages de l'appli — même gabarit (w-9 h-9) pour chaque bouton,
                    la langue ne dépasse plus des icônes nues à côté d'elle comme
                    avant (retour utilisateur). */}
                {!estCompteDepot && (
                    <div className='flex items-center gap-0.5'>
                        <LanguageSwitcher iconSeul />
                        <Link to="/formation" className='flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors' title="Aide">
                            <LuHelpCircle size={18} />
                        </Link>
                        <Link to="/setting" className='flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
                            <LuSettings size={18} />
                        </Link>
                    </div>
                )}

                {!estCompteDepot && <div className="w-px h-6 bg-border" />}

                {/* Temps réel — messagerie et notifications regroupées ensemble. */}
                <div className='flex items-center gap-0.5'>
                    {!estCompteDepot && <MessagerieIcone />}
                    <NotificationBell />
                </div>

                {/* Remplace l'ancien bouton "Aide" (LuHelpCircle) qui ne menait nulle
                    part pour un compte dépôt — ce créneau sert mieux à la langue ici. */}
                {estCompteDepot && <LanguageSwitcher compact />}

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
                        {/* Chemin à la souris vers les raccourcis : sur un clavier
                            arabe, « ? » n'est pas directement accessible — la page
                            ne doit pas dépendre d'une touche pour s'ouvrir. */}
                        {!estCompteDepot && (
                            <li>
                                <Link to={'/raccourcis'} className='rounded-lg flex items-center gap-2'>
                                    <LuKeyboard size={15} /> {t('raccourcis.titre')}
                                </Link>
                            </li>
                        )}
                        <li><button onClick={logout} className='text-destructive rounded-lg w-full text-left'>Déconnexion</button></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default Navbar;
