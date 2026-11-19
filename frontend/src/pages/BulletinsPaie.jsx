import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuChevronLeft, LuChevronRight, LuShieldAlert, LuCheckCircle2, LuX } from 'react-icons/lu';
import { usePermissions } from '../hooks/usePermissions';
import { getApercuEnvoiBulletinsPaie, getSalariesBulletinsPaie } from '../api/routes/bulletinPaie';
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

const ONGLETS_VALIDES = ['depot', 'envoi', 'suivi'];

function BulletinsPaie() {
    const { t } = useTranslation();
    const { isAdministrator } = usePermissions();
    const [salaries, setSalaries] = useState([]);
    const location = useLocation();
    const navigate = useNavigate();
    // Onglet et période vivent dans l'adresse (?onglet=envoi&mois=2026-10) :
    // « retour » revient à l'onglet précédent, et revenir sur la page
    // retrouve la période choisie au lieu du mois courant.
    const params = new URLSearchParams(location.search);
    const onglet = ONGLETS_VALIDES.includes(params.get('onglet')) ? params.get('onglet') : 'depot';
    const mois = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('mois') || '') ? params.get('mois') : cleMoisCourant();
    // Une seule navigation pour plusieurs changements : deux navigations dans
    // le même instant liraient chacune l'ancienne adresse et s'écraseraient.
    const allerVers = useCallback((changements, { historique = 'push' } = {}) => {
        const p = new URLSearchParams(window.location.search);
        Object.entries(changements).forEach(([cle, valeur]) => {
            const parDefaut = (cle === 'onglet' && valeur === 'depot') || (cle === 'mois' && valeur === cleMoisCourant());
            if (!valeur || parDefaut) p.delete(cle); else p.set(cle, valeur);
        });
        const search = p.toString();
        if ((search ? `?${search}` : '') === window.location.search) return;
        navigate({ pathname: window.location.pathname, search: search ? `?${search}` : '' }, { replace: historique === 'replace', state: window.history.state?.usr });
    }, [navigate]);
    const setMois = useCallback((cle) => allerVers({ mois: cle }, { historique: 'replace' }), [allerVers]);
    const [apercu, setApercu] = useState(null);
    const [chargementApercu, setChargementApercu] = useState(true);
    const [message, setMessage] = useState(null); // { texte, versEnvoi }
    const moisDemande = useRef(mois);

    const chargerSalaries = useCallback(() => {
        getSalariesBulletinsPaie()
            .then((res) => (res.status === 200 ? res.json() : []))
            .then((liste) => setSalaries(Array.isArray(liste) ? liste : []))
            .catch(() => toast.error(t('bulletinPaie.chargementSalariesEchoue')));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isAdministrator) chargerSalaries();
    }, [isAdministrator, chargerSalaries]);

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
        allerVers({ onglet: cible });
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
    // Un nom seulement connu de la Fluctuation RH (ancien intervenant…) ne
    // compte pour un mois que s'il y a un bulletin ce mois-là : sinon les
    // départs gonfleraient les « manquants » indéfiniment.
    const lignes = (apercu?.lignes || []).filter((l) => l.personnel_id || l.bulletin_trouve);
    const kTotal = lignes.length;
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
                            salaries={salaries}
                            onRange={(n, restants) => {
                                setMessage({
                                    texte: `${t('bulletinPaie.rangeAvecSucces', { count: n })}${restants ? ` ${t('bulletinPaie.restentATraiter', { count: restants })}` : ''}`,
                                    versEnvoi: true,
                                });
                                rechargerApercu(true);
                                chargerSalaries();
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
                    {onglet === 'suivi' && <OngletSuivi onOuvrirMois={(cle, cible) => { allerVers({ mois: cle, onglet: cible }); setMessage(null); }} />}
                </div>
            </div>
        </div>
    );
}

export default BulletinsPaie;
