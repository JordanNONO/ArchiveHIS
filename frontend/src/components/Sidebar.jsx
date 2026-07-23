import { IoApps, IoDocumentAttach, IoEyeSharp } from "react-icons/io5";
import React from 'react';
import { Separator } from "../ui/ui/separator";
import { LuShare2, LuUsers2 } from "react-icons/lu";
import NavLink from './NavLink'; // Assurez-vous d'importer correctement votre composant NavLink

function Sidebar() {
    return (
        <div className='w-full bg-[#2e2e2e]  h-screen p-2'>
            <div className="py-3">
                <h1 className='text-white uppercase text-center text-xl font-bold'>
                    SIGE Archivage
                </h1>
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
                </div>
            </ul>
        </div>
    );
}

export default Sidebar

