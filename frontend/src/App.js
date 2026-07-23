import { BrowserRouter, Route, Routes } from "react-router-dom";
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

function App() {
  return (
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
          </Route>
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
