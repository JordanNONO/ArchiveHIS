import React, { useEffect, useRef, useState } from 'react';
import { correspondARequete } from '../utils/recherche';

/**
 * Remplace un <select> par un champ texte + liste filtrée au clic/à la frappe —
 * un simple <select> devient impraticable dès qu'il y a beaucoup d'options
 * (ex: des dizaines de dossiers, voir DeplacerDocumentModal.jsx/BulkActionBar.jsx).
 * Ne stocke que value/label, reste générique pour être réutilisable partout où
 * ce même problème se pose.
 */
function SelectRecherchable({ options, value, onChange, placeholder, disabled, required, className = '' }) {
    const [ouvert, setOuvert] = useState(false);
    const [requete, setRequete] = useState('');
    const conteneurRef = useRef(null);

    const optionSelectionnee = options.find((o) => String(o.value) === String(value));

    useEffect(() => {
        function onClickExterieur(e) {
            if (conteneurRef.current && !conteneurRef.current.contains(e.target)) {
                setOuvert(false);
                setRequete('');
            }
        }
        document.addEventListener('mousedown', onClickExterieur);
        return () => document.removeEventListener('mousedown', onClickExterieur);
    }, []);

    const optionsFiltrees = requete.trim() === ''
        ? options
        : options.filter((o) => correspondARequete([o.label], requete));

    return (
        <div ref={conteneurRef} className={`relative ${className}`}>
            <input
                type='text'
                disabled={disabled}
                required={required}
                value={ouvert ? requete : (optionSelectionnee?.label || '')}
                onFocus={() => { setOuvert(true); setRequete(''); }}
                onChange={(e) => setRequete(e.target.value)}
                placeholder={placeholder}
                autoComplete='off'
                className='input input-bordered input-sm w-full disabled:opacity-50'
            />
            {ouvert && !disabled && (
                <div className='absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-md'>
                    {optionsFiltrees.length === 0 ? (
                        <p className='px-3 py-2 text-sm text-muted-foreground'>—</p>
                    ) : optionsFiltrees.map((o) => (
                        <button
                            key={o.value}
                            type='button'
                            onClick={() => { onChange(o.value); setOuvert(false); setRequete(''); }}
                            className={`block w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${String(o.value) === String(value) ? 'bg-primary/5 text-primary font-medium' : ''}`}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default SelectRecherchable;
