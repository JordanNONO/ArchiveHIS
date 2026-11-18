import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuChevronLeft, LuChevronRight, LuShieldAlert, LuCheckCircle2, LuX } from 'react-icons/lu';
import { usePermissions } from '../hooks/usePermissions';
import { getPersonnels } from '../api/routes/personnel';
import { getApercuEnvoiBulletinsPaie } from '../api/routes/bulletinPaie';
import OngletDepot from './bulletinsPaie/OngletDepot';
import OngletEnvoi from './bulletinsPaie/OngletEnvoi';
import OngletSuivi from './bulletinsPaie/OngletSuivi';
import { cleMoisCourant, decalerCle, libelleMois } from './bulletinsPaie/analyseNomFichier';

/**
 * Bulletins de paie — un espace en trois onglets (Déposer / Envoyer par
 * e-mail / Suivi annuel), conçu pour ~200 salariés : on montre d'abord ce
 * qui demande une action, le reste est derrière des filtres, une recherche
 * et une pagination. Réservé aux administrateurs (Sidebar.jsx et middleware
 * 'admin' de BulletinPaieController).
 *
 * Dépôt et Envoi restent montés (masqués en CSS) en changeant d'onglet pour
 * ne jamais perdre une liste de fichiers ou une sélection en cours.
 */
function Tuile({ libelle, valeur, detail, couleur, onClick }) {
    const contenu = (
        <>
            <span className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{libelle}</span>
            <span className={`text-2xl font-bold leading-none tabular-nums ${couleur}`}>{valeur}</span>
            {detail && <span className='text-xs text-muted-foreground'>{detail}</span>}
        </>
    );
    const classe = 'flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3.5 text-left';
    return onClick
        ? <button type='button' onClick={onClick} className={`${classe} transition-colors hover:border-primary/40 hover:bg-muted/20`}>{contenu}</button>
        : <div className={classe}>{contenu}</div>;
}

function BulletinsPaie() {
    const { t } = useTranslation();
    const { isAdministrator } = usePermissions();
    const [personnels, setPersonnels] = useState([]);
    const [onglet, setOnglet] = useState('depot');
    const [mois, setMois] = useState(() => cleMoisCourant());
    const [apercu, setApercu] = useState(null);
    const [chargementApercu, setChargementApercu] = useState(true);
    const [message, setMessage] = useState(null); // { texte, versEnvoi }
    const moisDemande = useRef(mois);

    useEffect(() => {
        if (!isAdministrator) return;
        getPersonnels()
            .then((res) => (res.status === 200 ? res.json() : []))
            .then((liste) => setPersonnels(Array.isArray(liste) ? liste : []))
            .catch(() => toast.error(t('bulletinPaie.chargementSalariesEchoue')));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdministrator]);

    const rechargerApercu = useCallback((silencieux = false) => {
        const cible = mois;
        moisDemande.current = cible;
        if (!silencieux) setChargementApercu(true);
        return getApercuEnvoiBulletinsPaie(cible)
            .then((res) => (res.status === 200 ? res.json() : Promise.reject(new Error(String(res.status)))))
            // Une réponse arrivée après un changement de mois ne doit pas
            // écraser l'aperçu du mois affiché.
            .then((data) => { if (moisDemande.current === cible) setApercu(data); })
            .catch(() => { if (!silencieux) toast.error(t('bulletinPaie.chargementApercuEchoue')); })
            .finally(() => { if (moisDemande.current === cible) setChargementApercu(false); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mois]);

    useEffect(() => {
        if (!isAdministrator) { setChargementApercu(false); return; }
        setApercu(null);
        rechargerApercu();
    }, [rechargerApercu, isAdministrator]);

    // Des e-mails partent en arrière-plan : on rafraîchit jusqu'à ce que
    // plus aucun ne soit en file (progression et statuts réels).
    useEffect(() => {
        if (!apercu?.en_cours) return undefined;
        const id = setTimeout(() => rechargerApercu(true), 3000);
        return () => clearTimeout(id);
    }, [apercu, rechargerApercu]);

    function changerMois(cle) {
        setMois(cle);
        setMessage(null);
    }

    function changerOnglet(cible) {
        setOnglet(cible);
        setMessage(null);
    }

    if (!isAdministrator) {
        return (
            <div className='flex min-h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center'>
                <LuShieldAlert size={28} className='text-muted-foreground' />
                <p className='text-sm font-medium text-foreground'>{t('bulletinPaie.reserveAdmin')}</p>
            </div>
        );
    }

    const periode = libelleMois(mois);
    const lignes = apercu?.lignes || [];
    const kTotal = apercu ? apercu.total : personnels.length;
    const kDep = lignes.filter((l) => l.bulletin_trouve).length;
    const kSent = apercu?.deja_envoyes || 0;
    const kTodo = mois > cleMoisCourant()
        ? 0
        : lignes.filter((l) => !l.deja_envoye && l.raison_exclusion !== 'en_cours' && (!l.bulletin_trouve || !l.mail || l.dernier_statut === 'echec')).length;

    const ONGLETS = [
        { id: 'depot', label: t('bulletinPaie.ongletDeposer') },
        { id: 'envoi', label: t('bulletinPaie.ongletEnvoyer') },
        { id: 'suivi', label: t('bulletinPaie.ongletSuivi') },
    ];

    return (
        <div className='flex min-h-full flex-col'>
            <header className='flex flex-wrap items-end justify-between gap-4 bg-card px-6 pb-4 pt-6'>
                <div>
                    <h1 className='text-xl font-semibold tracking-tight text-foreground'>{t('bulletinPaie.titre')}</h1>
                    <p className='mt-1 max-w-xl text-sm text-muted-foreground'>{t('bulletinPaie.sousTitreGeneral')}</p>
                </div>
                <div className='flex flex-col items-end gap-1'>
                    <span className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('bulletinPaie.periodeLabel')}</span>
                    <div className='flex items-center gap-1 rounded-xl border border-border bg-background p-1'>
                        <button type='button' aria-label={t('bulletinPaie.moisPrecedent')} onClick={() => changerMois(decalerCle(mois, -1))} className='flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted'>
                            <LuChevronLeft size={17} />
                        </button>
                        <span className='min-w-[150px] text-center text-sm font-semibold text-foreground'>{periode}</span>
                        <button type='button' aria-label={t('bulletinPaie.moisSuivant')} onClick={() => changerMois(decalerCle(mois, 1))} className='flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted'>
                            <LuChevronRight size={17} />
                        </button>
                    </div>
                </div>
            </header>

            <div className='flex-grow bg-background px-6 pb-10 pt-5'>
                <div className='mx-auto flex max-w-[1200px] flex-col gap-4'>
                    <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
                        <Tuile libelle={t('bulletinPaie.kpiSalariesActifs')} valeur={kTotal} couleur='text-foreground' />
                        <Tuile libelle={t('bulletinPaie.kpiBulletinsDeposes')} valeur={`${kDep} / ${kTotal}`} detail={t('bulletinPaie.kpiPourPeriode', { periode })} couleur='text-foreground' onClick={() => changerOnglet('depot')} />
                        <Tuile libelle={t('bulletinPaie.kpiEnvoyesParMail')} valeur={`${kSent} / ${kDep}`} detail={t('bulletinPaie.kpiSurDeposes')} couleur='text-green-700 dark:text-green-400' onClick={() => changerOnglet('envoi')} />
                        <Tuile libelle={t('bulletinPaie.kpiATraiter')} valeur={kTodo} detail={t('bulletinPaie.kpiATraiterDetail')} couleur='text-amber-700 dark:text-amber-400' onClick={() => changerOnglet('envoi')} />
                    </div>

                    <div role='tablist' aria-label={t('bulletinPaie.titre')} className='flex flex-wrap gap-1 border-b border-border'>
                        {ONGLETS.map((o) => (
                            <button
                                key={o.id}
                                type='button'
                                role='tab'
                                aria-selected={onglet === o.id}
                                onClick={() => changerOnglet(o.id)}
                                className={`-mb-px border-b-[3px] px-4 py-2.5 text-sm font-semibold transition-colors ${onglet === o.id ? 'border-[#FACC15] text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>

                    {message && (
                        <div role='status' className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200'>
                            <span className='inline-flex items-center gap-2 font-medium'><LuCheckCircle2 size={16} /> {message.texte}</span>
                            <div className='flex items-center gap-1'>
                                {message.versEnvoi && (
                                    <button type='button' onClick={() => changerOnglet('envoi')} className='rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-800'>
                                        {t('bulletinPaie.passerAEnvoi')}
                                    </button>
                                )}
                                <button type='button' aria-label={t('bulletinPaie.fermer')} onClick={() => setMessage(null)} className='flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5'>
                                    <LuX size={15} />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={onglet === 'depot' ? '' : 'hidden'}>
                        <OngletDepot
                            mois={mois}
                            onMoisChange={setMois}
                            personnels={personnels}
                            onRange={(n, restants) => {
                                setMessage({
                                    texte: `${t('bulletinPaie.rangeAvecSucces', { count: n })}${restants ? ` ${t('bulletinPaie.restentATraiter', { count: restants })}` : ''}`,
                                    versEnvoi: true,
                                });
                                rechargerApercu(true);
                            }}
                        />
                    </div>
                    <div className={onglet === 'envoi' ? '' : 'hidden'}>
                        <OngletEnvoi
                            mois={mois}
                            apercu={apercu}
                            chargement={chargementApercu}
                            onApercuChange={() => rechargerApercu(true)}
                            onAllerDepot={() => changerOnglet('depot')}
                        />
                    </div>
                    {onglet === 'suivi' && <OngletSuivi onOuvrirMois={(cle, cible) => { changerMois(cle); setOnglet(cible); }} />}
                </div>
            </div>
        </div>
    );
}

export default BulletinsPaie;
