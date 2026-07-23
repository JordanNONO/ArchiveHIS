import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

function MainLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

    return (
        <div className="flex w-full flex-col md:flex-row h-screen">
            {/* <button
                className="md:hidden p-4 bg-blue-500 text-white"
                onClick={toggleSidebar}
            >
                {isSidebarOpen ? 'Close Menu' : 'Open Menu'}
            </button> */}
            <div className={`fixed inset-0 z-50 bg-black bg-opacity-50 transition-opacity ${isSidebarOpen ? 'block' : 'hidden'} md:hidden`} onClick={toggleSidebar}></div>
            <div className={`fixed md:relative z-50 w-48 md:w-1/5 h-full bg-white transition-transform transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[150%]'} md:translate-x-0`}>
                <Sidebar toggleSidebar={toggleSidebar} />
            </div>
            <div className="flex w-full flex-col flex-grow h-full">
                <div className="w-full">
                    <Navbar toggleSidebar={()=>toggleSidebar()}/>
                </div>
                <div className="flex flex-grow w-full bg-gray-100 px-8 h-full relative items-start justify-start">
                   <Outlet />
                </div>
            </div>
        </div>
    );
}

export default MainLayout;
