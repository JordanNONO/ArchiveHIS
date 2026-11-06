import React from 'react';
import { useTranslation } from 'react-i18next';
import { morceauxSignature } from '../utils/raccourcis';

/**
 * Les touches d'un raccourci, dessinées comme des touches. Un seul composant
 * pour la page, le panneau d'aide et la barre d'aide des listes : sans ça, le
 * même raccourci finirait écrit de trois façons différentes.
 */

export function Touche({ children, className = '' }) {
    return (
        <kbd className={`inline-grid place-items-center min-w-[20px] rounded-md border border-b-2 border-border bg-card px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-foreground ${className}`}>
            {children}
        </kbd>
    );
}

function ToucheClavier({ signature, className = '' }) {
    const { t } = useTranslation();
    const { liaison, touches } = morceauxSignature(signature);
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}>
            {touches.map((touche, i) => (
                <React.Fragment key={`${touche}-${i}`}>
                    {i > 0 && (
                        <span className='text-[10px] text-muted-foreground'>
                            {liaison === 'puis' ? t('raccourcis.puis') : '+'}
                        </span>
                    )}
                    <Touche>{touche}</Touche>
                </React.Fragment>
            ))}
        </span>
    );
}

export default ToucheClavier;
