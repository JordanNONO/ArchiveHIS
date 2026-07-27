import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ConfirmDialogProvider } from "./contexts/ConfirmDialogContext";
import MainLayout from "./layout/MainLayout";
import Home from "./pages/Home";
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
import NotFound from "./pages/NotFound";

function App() {
  return (
    <ConfirmDialogProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route element={<PrivateRoute />}>
              <Route index element={<Home />} />
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
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </ConfirmDialogProvider>
  );
}

export default App;
