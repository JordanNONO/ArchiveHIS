import React from 'react';
import { useTranslation } from 'react-i18next';
import ToucheClavier from './ToucheClavier';
import { CONTEXTES, etatRaccourci, signatureEffective } from '../utils/raccourcis';

/**
 * La liste des raccourcis groupée par contexte — partagée par la page
 * /raccourcis et par le panneau d'aide, pour qu'ils ne puissent jamais
 * raconter deux choses différentes.
 */

const TEINTES_ETAT = {
    service: 'text-green-800 dark:text-green-300 bg-green-600/15',
    actif: 'text-primary bg-primary/10',
    confirmation: 'text-amber-700 dark:text-amber-400 bg-amber-500/15',
    ecarte: 'text-destructive bg-destructive/10',
    decider: 'text-amber-700 dark:text-amber-400 bg-amber-500/15',
};

function GroupesRaccourcis({ raccourcis, surcharges = {}, colonnes = 'grid-cols-1', onSurvol }) {
    const { t } = useTranslation();
    const groupes = CONTEXTES
        .map((contexte) => ({ contexte, lignes: raccourcis.filter((r) => r.contexte === contexte) }))
        .filter((g) => g.lignes.length > 0);

    return (
        <div className={`grid ${colonnes} gap-3 items-start`}>
            {groupes.map(({ contexte, lignes }) => (
                <div key={contexte} className='rounded-xl border border-border bg-card px-4 py-3'>
                    <p className='text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2'>
                        {t(`raccourcis.ctx_${contexte}`)}
                    </p>
                    <ul className='flex flex-col'>
                        {lignes.map((r) => {
                            const etat = etatRaccourci(r);
                            return (
                                <li
                                    key={r.id}
                                    onMouseEnter={() => onSurvol?.(r)}
                                    onMouseLeave={() => onSurvol?.(null)}
                                    className='flex items-center gap-2.5 border-t border-border/60 first:border-t-0 py-1.5 text-[13px]'
                                >
                                    <span className='shrink-0 min-w-[88px]'>
                                        <ToucheClavier signature={signatureEffective(r, surcharges)} />
                                    </span>
                                    <span className='flex-1 min-w-0'>
                                        <span className='block text-foreground'>{t(`raccourcis.a_${r.id}`)}</span>
                                        {contexte === 'reserve' && (
                                            <span className='block text-[11.5px] text-muted-foreground'>{t(`raccourcis.pourquoi_${r.id}`)}</span>
                                        )}
                                    </span>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${TEINTES_ETAT[etat]}`}>
                                        {t(`raccourcis.etat_${etat}`)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}

export default GroupesRaccourcis;
