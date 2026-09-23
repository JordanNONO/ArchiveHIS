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
            className={`group flex items-center gap-3 text-sm w-full rounded-lg hover:cursor-pointer px-2.5 py-2 transition-colors ${isActive ? 'bg-accent/[0.14] text-white font-semibold shadow-[inset_0_0_0_1px_rgba(250,204,21,0.35)]' : 'text-white/50 font-medium hover:bg-white/5 hover:text-white/85'}`}
        >
            <span className={`flex items-center justify-center w-6 h-6 rounded-lg shrink-0 transition-colors ${isActive ? 'bg-accent text-[#142744]' : 'bg-white/[0.08] text-current group-hover:bg-white/[0.14]'}`}>
                <Icon size={14} />
            </span>
            <span className='truncate'>{children}</span>
        </Link>
    );
});

export default NavLink;
