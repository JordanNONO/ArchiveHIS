import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function NavLink({ to, icon: Icon, children }) {
    const location = useLocation();
    const isActive = to === '/'
        ? location.pathname === '/' || location.pathname.startsWith('/folder/')
        : location.pathname.startsWith(to);

    return (
        <Link
            to={to}
            className={`relative flex items-center gap-3 text-sm font-medium w-full rounded-lg hover:cursor-pointer px-3 py-2.5 transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
        >
            {isActive && <span className='absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent' />}
            <Icon size={18} className={isActive ? 'text-accent' : ''} />
            <span>{children}</span>
        </Link>
    );
}

export default NavLink;
