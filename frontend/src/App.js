import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ConfirmDialogProvider } from "./contexts/ConfirmDialogContext";
import MainLayout from "./layout/MainLayout";
import RouteAccueil from "./components/RouteAccueil";
import EspaceDossier from "./pages/EspaceDossier";
import Login from "./pages/Login";
import PrivateRoute from "./components/PrivateRoute";
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import Personnel from "./pages/Personnel";
import Document from "./pages/Document";
import Settings from "./pages/Settings";
import OpenFolder from "./pages/OpenFolder";
import Profile from "./pages/Profile";
import DocView from "./pages/DocView";
import Corbeille from "./pages/Corbeille";
import Activite from "./pages/Activite";
import PartageExterne from "./pages/PartageExterne";
import Inscription from "./pages/Inscription";
import MotDePasseOublie from "./pages/MotDePasseOublie";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <ConfirmDialogProvider>
      <BrowserRouter>
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
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/inscription" element={<Inscription />} />
          <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="/partage/:token" element={<PartageExterne />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </ConfirmDialogProvider>
  );
}

export default App;
