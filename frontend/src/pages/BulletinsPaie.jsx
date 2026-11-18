import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuChevronLeft, LuChevronRight, LuShieldAlert } from 'react-icons/lu';
import { usePermissions } from '../hooks/usePermissions';
import { getPersonnels } from '../api/routes/personnel';
import { getApercuEnvoiBulletinsPaie } from '../api/routes/bulletinPaie';
import OngletDepot from './bulletinsPaie/OngletDepot';
import OngletEnvoi from './bulletinsPaie/OngletEnvoi';
import OngletSuivi from './bulletinsPaie/OngletSuivi';
import { cleMoisCourant, decalerCle, libelleMois } from './bulletinsPaie/analyseNomFichier';

/**
 * Bulletins de paie — un seul espace de travail en trois onglets (Déposer /
 * Envoyer par e-mail / Suivi annuel), remplaçant les deux écrans séparés
 * (DepotBulletinsPaie.jsx, EnvoyerBulletinsPaie.jsx, supprimés) — reprise
 * d'une maquette validée le 2026-11-18 (détection du salarié et du mois
 * depuis le nom du fichier). Réservé aux administrateurs, voir Sidebar.jsx
 * et BulletinPaieController (middleware 'admin').
 *
 * Dépôt et Envoi restent montés (juste masqués en CSS) en changeant
 * d'onglet, pour ne jamais perdre une liste de fichiers ou une sélection en
 * cours de vérification ; Suivi, lui, n'a pas d'état à préserver.
 */
function Tuile({ libelle, valeur, couleur }) {
    return (
        <div className='rounded-xl border border-border bg-card px-4 py-3.5'>
            <span className='block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{libelle}</span>
            <span className={`mt-1 block text-2xl font-bold leading-none tabular-nums ${couleur}`}>{valeur}</span>
        </div>
    );
}

function BulletinsPaie() {
    const { t } = useTranslation();
    const { isAdministrator } = usePermissions();
    const [personnels, setPersonnels] = useState([]);
    const [onglet, setOnglet] = useState('depot');
    const [mois, setMois] = useState(() => cleMoisCourant());
    const [apercu, setApercu] = useState(null);
    const [chargementApercu, setChargementApercu] = useState(true);
    const [banniereRangement, setBanniereRangement] = useState(null);

    useEffect(() => {
        if (!isAdministrator) return;
        getPersonnels()
            .then((res) => (res.status === 200 ? res.json() : []))
            .then((liste) => setPersonnels(Array.isArray(liste) ? liste : []))
            .catch(() => toast.error(t('bulletinPaie.chargementSalariesEchoue')));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdministrator]);

    const rechargerApercu = useCallback(() => {
        setChargementApercu(true);
        return getApercuEnvoiBulletinsPaie(mois)
            .then((res) => (res.status === 200 ? res.json() : Promise.reject(new Error(String(res.status)))))
            .then(setApercu)
            .catch(() => toast.error(t('bulletinPaie.chargementApercuEchoue')))
            .finally(() => setChargementApercu(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mois]);

    useEffect(() => {
        if (!isAdministrator) { setChargementApercu(false); return; }
        rechargerApercu();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mois, isAdministrator]);

    function decaler(delta) {
        setMois((m) => decalerCle(m, delta));
        setBanniereRangement(null);
    }

    function onRange(count) {
        setBanniereRangement({ count });
        rechargerApercu();
    }

    function ouvrirMois(cle, cible) {
        setMois(cle);
        setOnglet(cible);
        setBanniereRangement(null);
    }

    if (!isAdministrator) {
        return (
            <div className='flex min-h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center'>
                <LuShieldAlert size={28} className='text-muted-foreground' />
                <p className='text-sm font-medium text-foreground'>{t('bulletinPaie.reserveAdmin')}</p>
            </div>
        );
    }

    const periodeLabel = libelleMois(mois);
    const kTotal = personnels.length;
    const kDep = apercu ? apercu.lignes.filter((l) => l.bulletin_trouve).length : 0;
    const kSent = apercu ? apercu.deja_envoyes : 0;
    const kMissing = Math.max(0, kTotal - kDep);

    const ONGLETS = [
        { id: 'depot', label: t('bulletinPaie.ongletDeposer') },
        { id: 'envoi', label: t('bulletinPaie.ongletEnvoyer') },
        { id: 'suivi', label: t('bulletinPaie.ongletSuivi') },
    ];

    return (
        <div className='flex min-h-full flex-col'>
            <header className='flex flex-wrap items-end justify-between gap-4 bg-card px-6 pb-4 pt-6'>
                <div>
                    <h1 className='text-xl font-semibold tracking-tight text-foreground'>{t('bulletinPaie.accueilTitre')}</h1>
                    <p className='mt-1 max-w-xl text-sm text-muted-foreground'>{t('bulletinPaie.sousTitreGeneral')}</p>
                </div>
                <div className='flex flex-col items-end gap-1'>
                    <span className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('bulletinPaie.periodeLabel')}</span>
                    <div className='flex items-center gap-1 rounded-xl border border-border bg-background p-1'>
                        <button type='button' aria-label={t('bulletinPaie.moisPrecedent')} onClick={() => decaler(-1)} className='flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted'>
                            <LuChevronLeft size={17} />
                        </button>
                        <span className='min-w-[150px] text-center text-sm font-semibold text-foreground'>{periodeLabel}</span>
                        <button type='button' aria-label={t('bulletinPaie.moisSuivant')} onClick={() => decaler(1)} className='flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted'>
                            <LuChevronRight size={17} />
                        </button>
                    </div>
                </div>
            </header>

            <div className='flex-grow bg-background px-6 pb-10 pt-5'>
                <div className='mx-auto flex max-w-[1080px] flex-col gap-4'>
                    <div className='grid grid-cols-2 gap-3.5 sm:grid-cols-4'>
                        <Tuile libelle={t('bulletinPaie.kpiSalariesActifs')} valeur={kTotal} couleur='text-foreground' />
                        <Tuile libelle={t('bulletinPaie.kpiBulletinsDeposes', { periode: periodeLabel })} valeur={`${kDep} / ${kTotal}`} couleur='text-foreground' />
                        <Tuile libelle={t('bulletinPaie.kpiEnvoyesParMail')} valeur={`${kSent} / ${kDep}`} couleur='text-green-700 dark:text-green-400' />
                        <Tuile libelle={t('bulletinPaie.kpiBulletinsManquants')} valeur={kMissing} couleur='text-amber-700 dark:text-amber-400' />
                    </div>

                    <div role='tablist' aria-label={t('bulletinPaie.accueilTitre')} className='flex w-fit flex-wrap gap-1 rounded-xl bg-muted/50 p-1'>
                        {ONGLETS.map((o) => (
                            <button
                                key={o.id}
                                type='button'
                                role='tab'
                                aria-selected={onglet === o.id}
                                onClick={() => { setOnglet(o.id); setBanniereRangement(null); }}
                                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${onglet === o.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>

                    {banniereRangement && (
                        <div className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200'>
                            <span className='font-medium'>{t('bulletinPaie.rangeAvecSucces', { count: banniereRangement.count })}</span>
                            <button
                                type='button'
                                onClick={() => { setOnglet('envoi'); setBanniereRangement(null); }}
                                className='rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-800'
                            >
                                {t('bulletinPaie.passerAEnvoi')}
                            </button>
                        </div>
                    )}

                    <div className={onglet === 'depot' ? '' : 'hidden'}>
                        <OngletDepot mois={mois} onMoisChange={setMois} personnels={personnels} onRange={onRange} />
                    </div>
                    <div className={onglet === 'envoi' ? '' : 'hidden'}>
                        <OngletEnvoi mois={mois} apercu={apercu} chargement={chargementApercu} onApercuChange={rechargerApercu} />
                    </div>
                    {onglet === 'suivi' && <OngletSuivi onOuvrirMois={ouvrirMois} />}
                </div>
            </div>
        </div>
    );
}

export default BulletinsPaie;
