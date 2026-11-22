import { Suspense } from "react";
import { chargerPage } from "./utils/chargementPage";
import ErreurApplication from "./components/ErreurApplication";
import { createBrowserRouter, createRoutesFromElements, Outlet, Route, RouterProvider } from "react-router-dom";
import { LuLoader2 } from "react-icons/lu";
import { ConfirmDialogProvider } from "./contexts/ConfirmDialogContext";
import { DossierPersonneProvider } from "./contexts/DossierPersonneContext";
import { GardeDepartProvider } from "./contexts/GardeDepartContext";
import GestionRetourFenetres from "./components/GestionRetourFenetres";
import { useFenetresDialogueDeplacables } from "./hooks/useFenetresDialogueDeplacables";
import MainLayout from "./layout/MainLayout";
import RouteAccueil from "./components/RouteAccueil";
import Login from "./pages/Login";
import PrivateRoute from "./components/PrivateRoute";
import SplashConnexion from "./components/accueil/SplashConnexion";
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

// Chargées à la demande (React.lazy) plutôt qu'au démarrage de l'app : ces
// pages ne sont visitées qu'après navigation (jamais au premier écran), et
// certaines embarquent des dépendances lourdes (EspaceDossier → pdf-lib +
// ScannerDocument → tesseract.js) qui gonflaient le bundle principal — voir
// l'avertissement "bundle size is significantly larger than recommended" du
// build. Login/RouteAccueil restent chargées immédiatement : ce sont les deux
// tout premiers écrans possibles, pas la peine d'ajouter un flash de
// chargement dessus.
const EspaceDossier = chargerPage(() => import("./pages/EspaceDossier"));
const Personnel = chargerPage(() => import("./pages/Personnel"));
const Pai = chargerPage(() => import("./pages/Pai"));
const PaiDetail = chargerPage(() => import("./pages/PaiDetail"));
const ProtocolePai = chargerPage(() => import("./pages/ProtocolePai"));
const Document = chargerPage(() => import("./pages/Document"));
const Settings = chargerPage(() => import("./pages/Settings"));
const OpenFolder = chargerPage(() => import("./pages/OpenFolder"));
const Profile = chargerPage(() => import("./pages/Profile"));
const DocView = chargerPage(() => import("./pages/DocView"));
const EditionWord = chargerPage(() => import("./pages/EditionWord"));
const Formation = chargerPage(() => import("./pages/Formation"));
const Raccourcis = chargerPage(() => import("./pages/Raccourcis"));
const Corbeille = chargerPage(() => import("./pages/Corbeille"));
const Activite = chargerPage(() => import("./pages/Activite"));
// recharts est une dépendance lourde (comme pdf-lib/tesseract.js ci-dessus) —
// chargée uniquement à la visite de cette page.
const Statistiques = chargerPage(() => import("./pages/Statistiques"));
const Contact = chargerPage(() => import("./pages/Contact"));
const Courriers = chargerPage(() => import("./pages/Courriers"));
const AppelsTelephoniques = chargerPage(() => import("./pages/AppelsTelephoniques"));
const Cheques = chargerPage(() => import("./pages/Cheques"));
const FluctuationRh = chargerPage(() => import("./pages/FluctuationRh"));
const Telephonie = chargerPage(() => import("./pages/Telephonie"));
const BulletinsPaie = chargerPage(() => import("./pages/BulletinsPaie"));
const MesBulletins = chargerPage(() => import("./pages/MesBulletins"));
const MesDocuments = chargerPage(() => import("./pages/MesDocuments"));
const SuiviDemande = chargerPage(() => import("./pages/SuiviDemande"));
const PartageExterne = chargerPage(() => import("./pages/PartageExterne"));
const Inscription = chargerPage(() => import("./pages/Inscription"));
const MotDePasseOublie = chargerPage(() => import("./pages/MotDePasseOublie"));
const NotFound = chargerPage(() => import("./pages/NotFound"));

function ChargementPage() {
  return (
    <div className="flex w-full items-center justify-center py-24">
      <LuLoader2 className="animate-spin text-muted-foreground" size={24} />
    </div>
  );
}

/**
 * Racine commune à toutes les routes. Un « data router »
 * (createBrowserRouter) plutôt que <BrowserRouter> : c'est la condition pour
 * useBlocker, qui permet de demander confirmation avant de perdre une saisie
 * sur un « retour » (voir GardeDepartContext.jsx).
 */
function Racine() {
  return (
    <GardeDepartProvider>
      {/* À l'intérieur du routeur : le volet a besoin de useNavigate() pour
          emmener vers l'élément cliqué de sa chronologie (voir
          DossierPersonneContext.jsx). */}
      <DossierPersonneProvider>
        {/* Avant les routes : il doit recouvrir le premier chargement de
            /auth/me et lire son drapeau avant que RouteAccueil ne décide
            d'afficher le tour de bienvenue (voir utils/splash.js). */}
        <SplashConnexion />
        <GestionRetourFenetres />
        <Suspense fallback={<ChargementPage />}>
          <Outlet />
        </Suspense>
        <ToastContainer />
      </DossierPersonneProvider>
    </GardeDepartProvider>
  );
}

const router = createBrowserRouter(createRoutesFromElements(
          <Route element={<Racine />} errorElement={<ErreurApplication />}>
            <Route path="/" element={<MainLayout />}>
              <Route element={<PrivateRoute />}>
                <Route index element={<RouteAccueil />} />
                <Route path="espace/:type" element={<EspaceDossier />} />
                <Route path="mes-bulletins" element={<MesBulletins />} />
                <Route path="mes-documents" element={<MesDocuments />} />
                <Route path="suivi/:id" element={<SuiviDemande />} />
                <Route path="personnel" element={<Personnel />} />
                <Route path="pai" element={<Pai />} />
                <Route path="pai/:id" element={<PaiDetail />} />
                <Route path="pai/:id/protocole" element={<ProtocolePai />} />
                <Route path="doc" element={<Document />} />
                <Route path="setting" element={<Settings />} />
                <Route path="profile" element={<Profile />} />
                <Route path="view/:id/:type" element={<DocView />} />
                <Route path="folder/:id" element={<OpenFolder/>} />
                <Route path="corbeille" element={<Corbeille/>} />
                <Route path="activite" element={<Activite/>} />
                <Route path="statistiques" element={<Statistiques/>} />
                <Route path="courriers" element={<Courriers/>} />
                <Route path="appels" element={<AppelsTelephoniques/>} />
                <Route path="cheques" element={<Cheques/>} />
                <Route path="fluctuation-rh" element={<FluctuationRh/>} />
                <Route path="telephonie" element={<Telephonie/>} />
                <Route path="bulletins-paie" element={<BulletinsPaie/>} />
                <Route path="formation" element={<Formation/>} />
                <Route path="raccourcis" element={<Raccourcis/>} />
                <Route path="contact" element={<Contact/>} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
            {/* Hors de MainLayout (pas de Sidebar/Navbar) : l'éditeur Word a besoin
                de tout l'écran, pas juste l'espace restant sous la barre du haut —
                voir EditionWord.jsx (h-screen). Toujours protégé par PrivateRoute. */}
            <Route element={<PrivateRoute />}>
              <Route path="/view/:id/editer-word" element={<EditionWord />} />
              <Route path="/view/:id/editer-word/version/:versionId" element={<EditionWord />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/inscription" element={<Inscription />} />
            <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
            <Route path="/partage/:token" element={<PartageExterne />} />
          </Route>
));

function App() {
  useFenetresDialogueDeplacables();

  return (
    <ConfirmDialogProvider>
      <RouterProvider router={router} />
    </ConfirmDialogProvider>
  );
}

export default App;
