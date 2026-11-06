import React from 'react';
import { useTranslation } from 'react-i18next';
import ToucheClavier from './ToucheClavier';
import { useRaccourcis } from '../contexts/RaccourcisContext';

/**
 * Le rappel discret sous une liste. C'est la pièce qui fait vivre les
 * raccourcis : on les découvre en travaillant, sans avoir à ouvrir un
 * panneau. Sans elle, à peu près personne ne les apprend jamais.
 *
 * Masquable par chacun (réglage « barre d'aide en bas des listes »), et
 * jamais imprimée avec la liste.
 *
 * @param {Array} elements [{ signatures: ['ArrowUp','ArrowDown'], texte: 'se déplacer' }]
 */
function BarreAideRaccourcis({ elements = [], className = '' }) {
    const { t } = useTranslation();
    const { prefs, setPanneauOuvert } = useRaccourcis();
    const visibles = elements.filter(Boolean);
    if (!prefs.barreAide || visibles.length === 0) return null;

    return (
        <div className={`print:hidden flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-[12px] text-muted-foreground ${className}`}>
            {visibles.map((element, i) => (
                <span key={i} className='inline-flex items-center gap-1.5'>
                    {element.signatures.map((signature) => (
                        <ToucheClavier key={signature} signature={signature} />
                    ))}
                    {element.texte}
                </span>
            ))}
            <button
                type='button'
                onClick={() => setPanneauOuvert(true)}
                className='ml-auto inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 hover:text-foreground transition-colors'
            >
                <ToucheClavier signature='?' /> {t('raccourcis.court_tous')}
            </button>
        </div>
    );
}

export default BarreAideRaccourcis;
