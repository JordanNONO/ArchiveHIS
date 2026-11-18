import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuSearch } from 'react-icons/lu';

// Petits éléments partagés par les trois onglets de BulletinsPaie.jsx —
// pensés pour des listes de ~200 salariés : filtres à puces, recherche,
// pagination, plutôt qu'une longue liste à faire défiler.

export const TONS = {
    ok: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    err: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    mute: 'bg-muted text-muted-foreground',
};

export function Pastille({ ton, children, title }) {
    return (
        <span title={title} className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-tight ${TONS[ton]}`}>
            {children}
        </span>
    );
}

export function Puce({ actif, onClick, children }) {
    return (
        <button
            type='button'
            aria-pressed={actif}
            onClick={onClick}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${actif ? 'border-primary bg-primary text-white' : 'border-border bg-card text-foreground hover:border-primary/40'}`}
        >
            {children}
        </button>
    );
}

export function ChampRecherche({ value, onChange, placeholder, className = '' }) {
    return (
        <label className={`flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 ${className}`}>
            <LuSearch size={15} className='shrink-0 text-muted-foreground' />
            <input
                type='search'
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className='min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground'
            />
        </label>
    );
}

export function paginer(total, page, taille) {
    const pages = Math.max(1, Math.ceil(total / taille));
    const p = Math.min(Math.max(0, page), pages - 1);
    return { page: p, debut: p * taille, fin: Math.min(total, (p + 1) * taille), premiere: p === 0, derniere: p >= pages - 1 };
}

const BOUTON_PAGE = 'rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40';

export function Pagination({ pg, total, onPage }) {
    const { t } = useTranslation();
    if (total === 0) return null;
    return (
        <div className='flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5'>
            <span className='text-xs text-muted-foreground'>{t('bulletinPaie.paginationPlage', { debut: pg.debut + 1, fin: pg.fin, total })}</span>
            <div className='flex gap-1.5'>
                <button type='button' className={BOUTON_PAGE} disabled={pg.premiere} onClick={() => onPage(pg.page - 1)}>{t('bulletinPaie.precedent')}</button>
                <button type='button' className={BOUTON_PAGE} disabled={pg.derniere} onClick={() => onPage(pg.page + 1)}>{t('bulletinPaie.suivant')}</button>
            </div>
        </div>
    );
}
