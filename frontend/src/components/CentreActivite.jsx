import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuBell, LuFileText, LuMail, LuPhoneIncoming, LuLandmark, LuChevronRight, LuCheckCircle2 } from 'react-icons/lu';
import NotificationBell from './NotificationBell';
import MessagerieIcone from './MessagerieIcone';
import { useMessagerie } from '../contexts/MessagerieContext';

/**
 * « Activité » — barre du haut, direction A validée : notifications,
 * messages et tâches derrière un seul bouton, au lieu de trois icônes nues.
 *
 * NotificationBell reste monté en permanence (temps réel, son, badge de
 * l'onglet) : le panneau est seulement masqué quand il est fermé, jamais
 * retiré de la page.
 */
function CentreActivite({ compteurs = {} }) {
    const { t } = useTranslation();
    const { totalNonLus = 0 } = useMessagerie() || {};
    const [ouvert, setOuvert] = useState(false);
    const [onglet, setOnglet] = useState('notifications');
    const [nbNotifications, setNbNotifications] = useState(0);
    const racineRef = useRef(null);

    useEffect(() => {
        if (!ouvert) return undefined;
        const dehors = (e) => { if (racineRef.current && !racineRef.current.contains(e.target)) setOuvert(false); };
        const echap = (e) => { if (e.key === 'Escape') setOuvert(false); };
        document.addEventListener('mousedown', dehors);
        document.addEventListener('keydown', echap);
        return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap); };
    }, [ouvert]);

    const total = nbNotifications + totalNonLus;
    const taches = [
        { id: 'documents', to: '/?aTraiter=1', icon: LuFileText, n: compteurs.documents || 0, cle: 'navbar.tacheDocuments' },
        { id: 'courriers', to: '/courriers', icon: LuMail, n: compteurs.courriers || 0, cle: 'navbar.tacheCourriers' },
        { id: 'appels', to: '/appels', icon: LuPhoneIncoming, n: compteurs.appels || 0, cle: 'navbar.tacheAppels' },
        { id: 'cheques', to: '/cheques', icon: LuLandmark, n: compteurs.cheques || 0, cle: 'navbar.tacheCheques' },
    ].filter((tache) => tache.n > 0);
    const nbTaches = taches.reduce((s, tache) => s + tache.n, 0);

    const onglets = [
        { id: 'notifications', label: t('navbar.ongletNotifications'), n: nbNotifications },
        { id: 'messages', label: t('navbar.ongletMessages'), n: totalNonLus },
        { id: 'taches', label: t('navbar.ongletTaches'), n: nbTaches },
    ];

    return (
        <div ref={racineRef} className='relative'>
            <button
                type='button'
                onClick={() => setOuvert((v) => !v)}
                aria-expanded={ouvert}
                aria-haspopup='dialog'
                aria-label={total > 0 ? t('navbar.activiteNonLus', { count: total }) : t('navbar.activite')}
                title={t('navbar.activite')}
                className={`relative flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors ${ouvert ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
                {/* Icône seule (le libellé « Activité » est dans l'infobulle) :
                    moins de texte dans la barre, retour utilisateur. */}
                <LuBell size={18} />
                {total > 0 && (
                    <span className='absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-card bg-red-600 px-1 text-[10px] font-bold tabular-nums text-white'>
                        {total > 99 ? '99+' : total}
                    </span>
                )}
            </button>

            <div
                role='dialog'
                aria-label={t('navbar.centreActivite')}
                className={`${ouvert ? 'flex' : 'hidden'} fixed left-4 right-4 top-16 z-50 max-h-[calc(100vh-5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_48px_-16px_rgba(10,15,22,0.3)] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[400px]`}
            >
                <div className='px-4 pt-3.5 text-[15px] font-semibold text-foreground'>{t('navbar.centreActivite')}</div>
                <div role='tablist' className='flex gap-1 border-b border-border px-4 pt-2'>
                    {onglets.map((o) => (
                        <button
                            key={o.id}
                            type='button'
                            role='tab'
                            aria-selected={onglet === o.id}
                            onClick={() => setOnglet(o.id)}
                            className={`-mb-px h-9 border-b-2 px-2.5 text-[13px] transition-colors ${onglet === o.id ? 'border-primary font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground'}`}
                        >
                            {o.label}{o.n > 0 && <span className='ml-1 text-muted-foreground tabular-nums'>{o.n > 99 ? '99+' : o.n}</span>}
                        </button>
                    ))}
                </div>

                <div className='min-h-0 overflow-y-auto'>
                    <NotificationBell
                        integre
                        visible={ouvert && onglet === 'notifications'}
                        onNonLusChange={setNbNotifications}
                        onFermer={() => setOuvert(false)}
                        onDemandeOuverture={() => { setOnglet('notifications'); setOuvert(true); }}
                    />
                    {ouvert && onglet === 'messages' && <MessagerieIcone integre visible onFermer={() => setOuvert(false)} />}
                    {ouvert && onglet === 'taches' && (
                        taches.length === 0 ? (
                            <div className='flex flex-col items-center gap-2 px-4 py-10 text-muted-foreground'>
                                <LuCheckCircle2 size={26} />
                                <span className='text-sm'>{t('navbar.aucuneTache')}</span>
                            </div>
                        ) : (
                            <div className='flex flex-col p-1.5'>
                                {taches.map((tache) => (
                                    <Link
                                        key={tache.id}
                                        to={tache.to}
                                        onClick={() => setOuvert(false)}
                                        className='flex items-center gap-3 rounded-[10px] p-2.5 text-left transition-colors hover:bg-muted'
                                    >
                                        <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'>
                                            <tache.icon size={16} />
                                        </span>
                                        <span className='flex-1 text-sm text-foreground'>{t(tache.cle, { count: tache.n })}</span>
                                        <LuChevronRight size={15} className='text-muted-foreground' />
                                    </Link>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

export default CentreActivite;
