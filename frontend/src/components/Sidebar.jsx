import { IoApps, IoDocumentAttach, IoEyeSharp } from "react-icons/io5";
import React from 'react';
import { Separator } from "../ui/ui/separator";
import { LuShare2, LuUsers2, LuShieldCheck } from "react-icons/lu";
import NavLink from './NavLink'; // Assurez-vous d'importer correctement votre composant NavLink
import hisLogo from '../assets/his-logo.png';

function Sidebar() {
    return (
        <div className='w-full bg-[#0A0F16] h-screen p-2'>
            <div className="py-3 flex flex-col items-center gap-2">
                <img src={hisLogo} alt="Hetep Iaout Services" className="w-16 h-16 rounded-full" />
                <h1 className='text-white uppercase text-center text-sm font-bold leading-tight'>
                    Hetep Iaout Services
                </h1>
                <p className='text-white/50 text-xs text-center'>Archivage documentaire</p>
            </div>
            <Separator />
            <ul className='mt-5 flex flex-col gap-5 overflow-x-hidden overflow-y-auto'>
                <p className=' text-white/50'>
                    Overview
                </p>
                <NavLink to="/" icon={IoApps}>
                    Dashboard
                </NavLink>
                <Separator />
                <div className="flex flex-col gap-5">
                    <p className=' text-white/50'>
                        Gestion de fichier
                    </p>
                    <NavLink to="/doc" icon={IoDocumentAttach}>
                        Documents
                    </NavLink>
                    {/* <NavLink to="/share" icon={LuShare2}>
                        Partagé avec moi
                    </NavLink>
                    <NavLink to="/seen" icon={IoEyeSharp}>
                        Documents consultés
                    </NavLink> */}
                </div>

                <Separator />
                <div className="flex flex-col gap-5">
                    <p className=' text-white/50'>
                        Gestion des utilisateurs
                    </p>
                    <NavLink to="/personnel" icon={LuUsers2}>
                        Personnel
                    </NavLink>
                    <NavLink to="/setting" icon={LuShieldCheck}>
                        Rôles & Permissions
                    </NavLink>
                </div>
            </ul>
        </div>
    );
}

export default Sidebar

