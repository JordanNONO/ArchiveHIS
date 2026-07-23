import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function NavLink({ to, icon: Icon, children }) {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link 
            to={to} 
            className={`flex items-center gap-1 text-white w-full rounded hover:cursor-pointer p-2 ${isActive ? 'bg-primary' : 'hover:bg-amber-500/10'}`}
        >
            <Icon />
            <span>{children}</span>
        </Link>
    );
}

export default NavLink;
