import React, { useEffect, useRef, useState } from 'react';
import { LuChevronDown, LuCheck } from 'react-icons/lu';

/**
 * Remplace un <select> natif — la LISTE OUVERTE d'un select natif est dessinée
 * par le navigateur/l'OS, impossible à styliser en CSS (angles droits, bleu
 * système...), ce qui la fait trancher avec le reste de l'appli même quand la
 * case fermée est habillée. Même charte que SelectRecherchable.jsx (bordure,
 * fond, survol, sélection), juste sans le champ de recherche — pour les
 * listes courtes (filtres, états...) où taper pour filtrer n'apporte rien.
 */
function MenuDeroulant({ options, value, onChange, placeholder, disabled, className = '', boutonClassName = '' }) {
    const [ouvert, setOuvert] = useState(false);
    const conteneurRef = useRef(null);

    const optionSelectionnee = options.find((o) => String(o.value) === String(value));

    useEffect(() => {
        function onClickExterieur(e) {
            if (conteneurRef.current && !conteneurRef.current.contains(e.target)) {
                setOuvert(false);
            }
        }
        document.addEventListener('mousedown', onClickExterieur);
        return () => document.removeEventListener('mousedown', onClickExterieur);
    }, []);

    return (
        <div ref={conteneurRef} className={`relative ${className}`}>
            <button
                type='button'
                disabled={disabled}
                onClick={() => setOuvert((v) => !v)}
                className={`flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50 hover:border-primary/40 transition-colors ${ouvert ? 'border-primary/50 ring-2 ring-primary/20' : ''} ${boutonClassName}`}
            >
                <span className={optionSelectionnee ? '' : 'text-muted-foreground'}>
                    {optionSelectionnee?.label || placeholder || '—'}
                </span>
                <LuChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${ouvert ? 'rotate-180' : ''}`} />
            </button>
            {ouvert && !disabled && (
                <div className='absolute z-20 mt-1 min-w-full w-max max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-md p-1'>
                    {options.map((o) => {
                        const actif = String(o.value) === String(value);
                        return (
                            <button
                                key={o.value}
                                type='button'
                                disabled={o.disabled}
                                onClick={() => { onChange(o.value); setOuvert(false); }}
                                className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${actif ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-muted disabled:hover:bg-transparent'}`}
                            >
                                {o.label}
                                {actif && <LuCheck size={13} className='shrink-0' />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default MenuDeroulant;
