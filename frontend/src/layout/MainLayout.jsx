import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import EdgeSwipeBack from '../components/EdgeSwipeBack';
import echo from '../utils/echo';
import { definirTitreBase } from '../utils/faviconBadge';
import { reabonnerSiDejaAutorise } from '../utils/pushNotifications';

const TITRES_PAR_ROUTE = [
    { test: (p) => p === '/', titre: 'Tableau de bord' },
    { test: (p) => p.startsWith('/folder/'), titre: 'Dossier' },
    { test: (p) => p === '/doc', titre: 'Documents' },
    { test: (p) => p.startsWith('/view/'), titre: 'Document' },
    { test: (p) => p === '/personnel', titre: 'Personnel' },
    { test: (p) => p === '/corbeille', titre: 'Corbeille' },
    { test: (p) => p === '/activite', titre: 'Activité' },
    { test: (p) => p === '/setting', titre: 'Administration' },
    { test: (p) => p === '/profile', titre: 'Mon profil' },
];

function titreDepuisChemin(pathname) {
    const match = TITRES_PAR_ROUTE.find((r) => r.test(pathname));
    return match ? `${match.titre} · HIS Archivage` : 'HIS Archivage';
}

function MainLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const contentRef = useRef(null);

    // Function to toggle the sidebar
    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    // Function to close the sidebar when the screen size changes
    const handleResize = () => {
        if (window.innerWidth >= 768) {
            setIsSidebarOpen(false);
        }
    };

    useEffect(() => {
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Rejoint le canal de présence temps réel (voir routes/channels.php) tant
    // que ce layout reste monté, c'est-à-dire toute la session authentifiée —
    // c'est ce qui fait apparaître ce compte comme "en ligne" ailleurs (voir
    // Personnel.jsx), rien à écouter ici, juste être présent dans le canal.
    useEffect(() => {
        echo.join('presence-connectes');
        return () => {
            echo.leave('presence-connectes');
        };
    }, []);

    // Si la permission de notification système a déjà été accordée par le
    // passé (session précédente), ré-enregistre discrètement l'abonnement
    // côté serveur — voir pushNotifications.js. Ne redemande jamais la
    // permission ici (ça, c'est le bouton dans NotificationBell.jsx).
    useEffect(() => {
        reabonnerSiDejaAutorise();
    }, []);

    // À chaque navigation : titre d'onglet cohérent, retour en haut de page,
    // et fermeture du menu mobile (sinon il reste ouvert après avoir cliqué un lien).
    useEffect(() => {
        definirTitreBase(titreDepuisChemin(location.pathname));
        contentRef.current?.scrollTo({ top: 0 });
        setIsSidebarOpen(false);
    }, [location.pathname]);

    return (
        <div className="flex w-full flex-col md:flex-row h-screen overflow-hidden">
            <div className={`fixed inset-0 z-50 bg-black bg-opacity-50 transition-opacity ${isSidebarOpen ? 'block' : 'hidden'} md:hidden`} onClick={toggleSidebar}></div>
            <div className={`fixed md:relative z-50 w-48 md:w-1/5 h-full shrink-0 bg-gradient-to-b from-[#1B365D] to-[#0A0F16] transition-transform transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[150%]'} md:translate-x-0`}>
                <Sidebar toggleSidebar={toggleSidebar} />
            </div>
            <div className="flex w-full flex-col flex-grow h-full overflow-hidden">
                <div className="w-full shrink-0">
                    <Navbar toggleSidebar={()=>toggleSidebar()}/>
                </div>
                <div ref={contentRef} className="flex flex-grow w-full bg-muted px-4 sm:px-6 lg:px-8 relative items-start justify-start overflow-y-auto">
                   {/* min-w-0 : sans ça, un enfant flex peut s'étirer au-delà du
                       viewport pour loger un contenu non-coupable (email long,
                       nom de fichier...) au lieu de laisser ses descendants
                       tronquer/wrap dans l'espace réellement disponible. */}
                   <div className="min-w-0 w-full">
                     <EdgeSwipeBack actif={!isSidebarOpen}>
                       <Outlet />
                     </EdgeSwipeBack>
                   </div>
                </div>
            </div>
        </div>
    );
}

export default MainLayout;
