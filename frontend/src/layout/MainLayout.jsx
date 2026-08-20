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

const LARGEUR_SIDEBAR_MIN = 200;
const LARGEUR_SIDEBAR_MAX = 420;
const LARGEUR_SIDEBAR_DEFAUT = 280;
const CLE_LARGEUR_SIDEBAR = 'his_largeur_sidebar';

function MainLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const contentRef = useRef(null);
    // Largeur réglable à la souris (glisser depuis le bord droit) — persistée
    // pour rester stable d'une session à l'autre, un peu comme le choix de
    // langue. Uniquement sur desktop : sur mobile la sidebar est en overlay
    // plein écran, la redimensionner n'aurait aucun sens.
    const [largeurSidebar, setLargeurSidebar] = useState(() => {
        const stockee = Number(localStorage.getItem(CLE_LARGEUR_SIDEBAR));
        return stockee >= LARGEUR_SIDEBAR_MIN && stockee <= LARGEUR_SIDEBAR_MAX ? stockee : LARGEUR_SIDEBAR_DEFAUT;
    });
    const [redimensionnementEnCours, setRedimensionnementEnCours] = useState(false);

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

    // Glisser-déposer sur la poignée : écoute au niveau document (pas juste la
    // poignée elle-même), sinon un mouvement de souris trop rapide qui sort du
    // petit élément de poignée interromprait le redimensionnement en cours.
    useEffect(() => {
        if (!redimensionnementEnCours) return;
        function onMouseMove(e) {
            const largeur = Math.min(LARGEUR_SIDEBAR_MAX, Math.max(LARGEUR_SIDEBAR_MIN, e.clientX));
            setLargeurSidebar(largeur);
        }
        function onMouseUp() {
            setRedimensionnementEnCours(false);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        // Empêche la sélection de texte de la page pendant le glissement.
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [redimensionnementEnCours]);

    useEffect(() => {
        localStorage.setItem(CLE_LARGEUR_SIDEBAR, String(largeurSidebar));
    }, [largeurSidebar]);

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
            <div
                className={`fixed md:relative z-50 w-48 h-full shrink-0 bg-gradient-to-b from-[#1B365D] to-[#0A0F16] ${redimensionnementEnCours ? '' : 'transition-transform'} transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[150%]'} md:translate-x-0`}
                style={window.innerWidth >= 768 ? { width: largeurSidebar } : undefined}
            >
                <Sidebar toggleSidebar={toggleSidebar} />
                {/* Poignée de redimensionnement — desktop uniquement, un mobile n'a pas de souris pour l'utiliser. */}
                <div
                    onMouseDown={() => setRedimensionnementEnCours(true)}
                    className='hidden md:block absolute top-0 right-0 h-full w-1.5 -mr-0.5 cursor-col-resize group z-10'
                    title='Glisser pour redimensionner'
                >
                    <div className='w-px h-full mx-auto bg-white/0 group-hover:bg-accent/60 transition-colors' />
                </div>
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
