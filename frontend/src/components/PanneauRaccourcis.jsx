import React, { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuArrowUpRight, LuX } from 'react-icons/lu';
import GroupesRaccourcis from './GroupesRaccourcis';
import { useRaccourcis } from '../contexts/RaccourcisContext';
import { raccourcisAutorises } from '../utils/raccourcis';

/**
 * Le rappel en surimpression, ouvert par « ? ». Volontairement court : on le
 * consulte sans quitter son dossier, et on va sur /raccourcis quand on veut
 * la carte du clavier, les réglages ou le bac d'essai.
 *
 * Un <dialog> natif, comme ailleurs dans l'application : la fermeture par
 * Échap et le piège du focus viennent avec, sans code à écrire — et c'est
 * d'ailleurs ce qui rend « Échap » déjà en service partout.
 */
function PanneauRaccourcis() {
    const { t } = useTranslation();
    const { panneauOuvert, setPanneauOuvert, prefs, droits } = useRaccourcis();
    const ref = useRef(null);

    useEffect(() => {
        if (panneauOuvert) ref.current?.showModal();
        else ref.current?.close();
    }, [panneauOuvert]);

    // Les raccourcis écartés n'ont rien à faire ici : ce panneau sert à agir,
    // pas à expliquer. L'explication est sur la page.
    const liste = useMemo(
        () => raccourcisAutorises(droits).filter((r) => r.contexte !== 'reserve'),
        [droits],
    );

    return (
        <dialog ref={ref} className='modal' onClose={() => setPanneauOuvert(false)}>
            <div className='modal-box max-w-3xl rounded-2xl p-0 overflow-hidden'>
                <div className='flex items-start gap-3.5 px-5 py-4 border-b border-border'>
                    <span className='shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-primary text-white text-lg font-bold'>?</span>
                    <div className='flex-1 min-w-0'>
                        <h3 className='text-base font-semibold text-foreground'>{t('raccourcis.titre')}</h3>
                        <p className='text-[13px] text-muted-foreground mt-0.5'>
                            {t('raccourcis.panneauSous')}
                        </p>
                    </div>
                    <button
                        type='button'
                        aria-label={t('commun.fermer', { defaultValue: 'Fermer' })}
                        onClick={() => setPanneauOuvert(false)}
                        className='shrink-0 grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
                    >
                        <LuX size={16} />
                    </button>
                </div>

                <div className='px-5 py-4 max-h-[60vh] overflow-y-auto'>
                    <GroupesRaccourcis raccourcis={liste} surcharges={prefs.surcharges} colonnes='sm:grid-cols-2' />
                </div>

                <div className='flex flex-wrap items-center gap-3 px-5 py-3 border-t border-border bg-muted/40'>
                    <p className='flex-1 min-w-[260px] text-[12.5px] text-muted-foreground'>{t('raccourcis.garde')}</p>
                    <Link
                        to='/raccourcis'
                        onClick={() => setPanneauOuvert(false)}
                        className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-primary/90 transition-colors'
                    >
                        {t('raccourcis.voirPage')} <LuArrowUpRight size={14} />
                    </Link>
                </div>
            </div>
            {/* Clic hors de la fenêtre : même geste de fermeture que les autres
                dialogues de l'application. */}
            <form method='dialog' className='modal-backdrop'>
                <button>{t('commun.fermer', { defaultValue: 'Fermer' })}</button>
            </form>
        </dialog>
    );
}

export default PanneauRaccourcis;
