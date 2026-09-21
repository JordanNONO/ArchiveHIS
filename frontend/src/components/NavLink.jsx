import React, { forwardRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

// forwardRef + ...rest (style, attributs/écouteurs dnd-kit...) : nécessaire
// pour que Sidebar.jsx puisse rendre ces liens glissables (voir
// LienSidebarTriable) sans dupliquer tout le balisage ici — sans effet sur
// les usages existants, qui ne passent ni ref ni props en plus.
const NavLink = forwardRef(({ to, icon: Icon, children, ...rest }, ref) => {
    const location = useLocation();
    const isActive = to === '/'
        ? location.pathname === '/' || location.pathname.startsWith('/folder/')
        : location.pathname.startsWith(to);

    return (
        <Link
            ref={ref}
            to={to}
            {...rest}
            className={`relative flex items-center gap-3 text-sm font-medium w-full rounded-lg hover:cursor-pointer px-3 py-2.5 transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
        >
            {isActive && <span className='absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent' />}
            <Icon size={18} className={isActive ? 'text-accent' : ''} />
            <span>{children}</span>
        </Link>
    );
});

export default NavLink;
