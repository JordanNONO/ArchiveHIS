import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LuUploadCloud, LuMailPlus, LuShieldAlert, LuChevronRight } from 'react-icons/lu';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Point d'entrée des bulletins de paie depuis la barre latérale (voir
 * Sidebar.jsx) — réservé aux administrateurs, demande explicite 2026-11-18 :
 * un onglet dédié plutôt que des boutons cachés dans le dossier
 * "Bulletin de paie" (premier essai, trop difficile à retrouver).
 *
 * Simple palier vers les deux vrais écrans (DepotBulletinsPaie.jsx,
 * EnvoyerBulletinsPaie.jsx) — eux n'ont pas changé.
 */
function Carte({ icone: Icone, titre, texte, onClick }) {
    return (
        <button
            type='button'
            onClick={onClick}
            className='flex items-start gap-3.5 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30'
        >
            <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <Icone size={19} />
            </span>
            <span className='min-w-0 flex-grow'>
                <span className='flex items-center gap-1.5 text-[15px] font-semibold text-foreground'>
                    {titre} <LuChevronRight size={15} className='text-muted-foreground' />
                </span>
                <span className='mt-1 block text-sm leading-relaxed text-muted-foreground'>{texte}</span>
            </span>
        </button>
    );
}

function BulletinsPaie() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isAdministrator } = usePermissions();

    if (!isAdministrator) {
        return (
            <div className='flex min-h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center'>
                <LuShieldAlert size={28} className='text-muted-foreground' />
                <p className='text-sm font-medium text-foreground'>{t('bulletinPaie.reserveAdmin')}</p>
            </div>
        );
    }

    return (
        <div className='flex min-h-full flex-col'>
            <header className='bg-card px-6 pb-4 pt-6'>
                <h1 className='text-xl font-semibold tracking-tight text-foreground'>{t('bulletinPaie.accueilTitre')}</h1>
                <p className='mt-1 text-sm text-muted-foreground'>{t('bulletinPaie.accueilSousTitre')}</p>
            </header>

            <div className='flex-grow bg-background px-6 pb-10 pt-6'>
                <div className='mx-auto grid max-w-[720px] grid-cols-1 gap-3.5 sm:grid-cols-2'>
                    <Carte
                        icone={LuUploadCloud}
                        titre={t('bulletinPaie.accueilDeposerTitre')}
                        texte={t('bulletinPaie.accueilDeposerTexte')}
                        onClick={() => navigate('/bulletins-paie/deposer')}
                    />
                    <Carte
                        icone={LuMailPlus}
                        titre={t('bulletinPaie.accueilEnvoyerTitre')}
                        texte={t('bulletinPaie.accueilEnvoyerTexte')}
                        onClick={() => navigate('/bulletins-paie/envoyer')}
                    />
                </div>
            </div>
        </div>
    );
}

export default BulletinsPaie;
