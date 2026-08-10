import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LuLoader2 } from "react-icons/lu";
import { ConfirmDialogProvider } from "./contexts/ConfirmDialogContext";
import MainLayout from "./layout/MainLayout";
import RouteAccueil from "./components/RouteAccueil";
import Login from "./pages/Login";
import PrivateRoute from "./components/PrivateRoute";
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

// Chargées à la demande (React.lazy) plutôt qu'au démarrage de l'app : ces
// pages ne sont visitées qu'après navigation (jamais au premier écran), et
// certaines embarquent des dépendances lourdes (EspaceDossier → pdf-lib +
// ScannerCapture → tesseract.js) qui gonflaient le bundle principal — voir
// l'avertissement "bundle size is significantly larger than recommended" du
// build. Login/RouteAccueil restent chargées immédiatement : ce sont les deux
// tout premiers écrans possibles, pas la peine d'ajouter un flash de
// chargement dessus.
const EspaceDossier = lazy(() => import("./pages/EspaceDossier"));
const Personnel = lazy(() => import("./pages/Personnel"));
const Document = lazy(() => import("./pages/Document"));
const Settings = lazy(() => import("./pages/Settings"));
const OpenFolder = lazy(() => import("./pages/OpenFolder"));
const Profile = lazy(() => import("./pages/Profile"));
const DocView = lazy(() => import("./pages/DocView"));
const Corbeille = lazy(() => import("./pages/Corbeille"));
const Activite = lazy(() => import("./pages/Activite"));
const Contact = lazy(() => import("./pages/Contact"));
const PartageExterne = lazy(() => import("./pages/PartageExterne"));
const Inscription = lazy(() => import("./pages/Inscription"));
const MotDePasseOublie = lazy(() => import("./pages/MotDePasseOublie"));
const NotFound = lazy(() => import("./pages/NotFound"));

function ChargementPage() {
  return (
    <div className="flex w-full items-center justify-center py-24">
      <LuLoader2 className="animate-spin text-muted-foreground" size={24} />
    </div>
  );
}

function App() {
  return (
    <ConfirmDialogProvider>
      <BrowserRouter>
        <Suspense fallback={<ChargementPage />}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route element={<PrivateRoute />}>
                <Route index element={<RouteAccueil />} />
                <Route path="espace/:type" element={<EspaceDossier />} />
                <Route path="personnel" element={<Personnel />} />
                <Route path="doc" element={<Document />} />
                <Route path="setting" element={<Settings />} />
                <Route path="profile" element={<Profile />} />
                <Route path="view/:id/:type" element={<DocView />} />
                <Route path="folder/:id" element={<OpenFolder/>} />
                <Route path="corbeille" element={<Corbeille/>} />
                <Route path="activite" element={<Activite/>} />
                <Route path="contact" element={<Contact/>} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/inscription" element={<Inscription />} />
            <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
            <Route path="/partage/:token" element={<PartageExterne />} />
          </Routes>
        </Suspense>
        <ToastContainer />
      </BrowserRouter>
    </ConfirmDialogProvider>
  );
}

export default App;
