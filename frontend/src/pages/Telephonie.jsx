import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { avecParamsGlobaux, remplacementSilencieux } from '../utils/paramsUrl';
import { LuSmartphone, LuSignal, LuAlertTriangle, LuRefreshCw, LuPlus, LuPencil, LuListChecks, LuSend, LuCornerUpLeft } from 'react-icons/lu';
import { getTelephonie } from '../api/routes/telephonie';
import { filtrerParRequete } from '../utils/recherche';
import { usePermissions } from '../hooks/usePermissions';
import { AppareilForm, LigneForm } from '../components/TelephonieForms';
import { RemiseForm, ClotureDetentionForm, IncidentForm } from '../components/TelephonieActions';
import TelephonieReprise from '../components/TelephonieReprise';

/**
 * Parc des téléphones et des lignes SIM confiés aux salariés.
 *
 * Quatre onglets qui lisent les mêmes données, chargées en une requête (voir
 * TelephonieController::index) — exactement comme le registre des courriers.
 *
 * Cette page a remplacé la section « Téléphone » de la Fluctuation RH le
 * 16/11/2026 : ces incidents portent sur du matériel confié, ils
 * appartiennent au parc et non au mouvement du personnel du mois.
 */

const ONGLETS = ['apercu', 'appareils', 'lignes', 'incidents'];

/** La reprise de l'existant n'est pas un onglet mais un écran de saisie, joignable par l'URL. */
const VUES = [...ONGLETS, 'reprise'];

const ETATS_APPAREIL = {
    en_stock: 'text-blue-800 bg-blue-100 dark:text-blue-200 dark:bg-blue-900/40',
    en_service: 'text-green-800 bg-green-100 dark:text-green-200 dark:bg-green-900/40',
    hors_service: 'text-orange-900 bg-orange-100 dark:text-orange-200 dark:bg-orange-900/40',
    reforme: 'text-muted-foreground bg-muted',
    perdu: 'text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900/40',
    vole: 'text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900/40',
};

const NATURES_INCIDENT = {
    perte: 'text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900/40',
    vol: 'text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900/40',
    casse: 'text-orange-900 bg-orange-100 dark:text-orange-200 dark:bg-orange-900/40',
    depassement_forfait: 'text-yellow-900 bg-yellow-100 dark:text-yellow-200 dark:bg-yellow-900/40',
    autre: 'text-muted-foreground bg-muted',
};

function formaterDate(v) {
    return v ? new Date(v).toLocaleDateString('fr-FR') : '—';
}

function formaterEuros(v) {
    if (v === null || v === undefined || v === '') return '—';
    return `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Le nom du détenteur, que la fiche du personnel existe encore ou non. */
function nomDetenteur(detention) {
    if (!detention) return null;
    const p = detention.personnel;
    return p ? `${p.nom} ${p.prenom}`.trim() : (detention.salarie_nom || '—');
}

function Tuile({ libelle, valeur, detail, alerte }) {
    return (
        <section className='rounded-xl border border-border bg-card px-5 py-4'>
            <h3 className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>{libelle}</h3>
            <p className={`mt-2.5 text-3xl font-bold leading-none tabular-nums ${alerte ? 'text-orange-700 dark:text-orange-400' : 'text-foreground'}`}>{valeur}</p>
            {detail && <p className='mt-2.5 text-xs text-muted-foreground'>{detail}</p>}
        </section>
    );
}

function Etiquette({ texte, classe }) {
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${classe}`}>{texte}</span>;
}

function EnTete({ children }) {
    return <th scope='col' className='border-b border-border px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{children}</th>;
}

function Cellule({ children, className = '' }) {
    return <td className={`border-b border-border/60 px-4 py-3 text-sm text-foreground ${className}`}>{children}</td>;
}

const classeBoutonSecondaire = 'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-primary transition-colors hover:bg-muted';
const classeBoutonPrincipal = 'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-primary bg-primary px-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90';

function BoutonModifier({ libelle, onClick }) {
    return (
        <button type='button' onClick={onClick} aria-label={libelle} title={libelle} className='inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'>
            <LuPencil size={15} />
        </button>
    );
}

function Vide({ message }) {
    return <p className='px-4 py-10 text-center text-sm text-muted-foreground'>{message}</p>;
}

function Telephonie() {
    const { t } = useTranslation();
    const { hasPermission, isAdministrator } = usePermissions();
    const peutGerer = isAdministrator || hasPermission('gerer_telephonie');

    const [searchParams, setSearchParams] = useSearchParams();
    const [onglet, setOnglet] = useState(() => (VUES.includes(searchParams.get('onglet')) ? searchParams.get('onglet') : 'apercu'));
    const [recherche, setRecherche] = useState('');
    const [parc, setParc] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState(null);
    // { type: 'appareil' | 'ligne', objet } — objet absent en ajout.
    const [fenetre, setFenetre] = useState(null);

    useEffect(() => {
        const params = {};
        if (onglet !== 'apercu') params.onglet = onglet;
        setSearchParams(avecParamsGlobaux(params), remplacementSilencieux());
    }, [onglet, setSearchParams]);

    function charger() {
        setChargement(true);
        setErreur(null);
        return getTelephonie()
            .then((res) => (res.status === 200 ? res.json() : Promise.reject(new Error(String(res.status)))))
            .then(setParc)
            .catch(() => setErreur(t('telephonie.chargementEchoue')))
            .finally(() => setChargement(false));
    }

    // Au montage seulement : charger() se recrée à chaque rendu, l'inclure
    // dans les dépendances relancerait la requête en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { charger(); }, []);

    const resume = parc?.resume;
    const alertes = parc?.alertes;
    const nbAlertes = alertes
        ? alertes.materiel_non_restitue.length + alertes.lignes_facturees_inutilement.length + alertes.engagements_proches.length
        : 0;

    const modelesConnus = useMemo(
        () => [...new Set((parc?.appareils || []).map((a) => a.modele).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')),
        [parc],
    );

    // Ce qu'on peut effectivement remettre : personne ne le détient déjà, et
    // l'appareil n'est pas hors service/réformé/perdu/volé. Même logique que
    // TelephonieAppareil::scopeDisponible() et TelephonieLigne::scopeLibre()
    // côté serveur — recalculée ici pour refléter l'état local sans recharger
    // tout le parc entre deux actions.
    const appareilsDisponibles = useMemo(
        () => (parc?.appareils || []).filter((a) => !a.detention_en_cours && !['hors_service', 'reforme', 'perdu', 'vole'].includes(a.etat)),
        [parc],
    );
    const lignesDisponibles = useMemo(
        () => (parc?.lignes || []).filter((l) => !l.detention_en_cours && l.statut === 'active'),
        [parc],
    );
    const appareilsEnService = useMemo(() => (parc?.appareils || []).filter((a) => a.detention_en_cours), [parc]);
    const lignesAttribuees = useMemo(() => (parc?.lignes || []).filter((l) => l.detention_en_cours), [parc]);

    const detentions = useMemo(() => filtrerParRequete(
        parc?.detentions || [],
        (d) => [nomDetenteur(d), d.appareil?.modele, d.appareil?.imei, d.ligne?.numero, d.ligne?.operateur],
        recherche,
    ), [parc, recherche]);

    const appareils = useMemo(() => filtrerParRequete(
        parc?.appareils || [],
        (a) => [a.modele, a.imei, a.numero_serie, nomDetenteur(a.detention_en_cours)],
        recherche,
    ), [parc, recherche]);

    const lignes = useMemo(() => filtrerParRequete(
        parc?.lignes || [],
        (l) => [l.numero, l.operateur, l.forfait, nomDetenteur(l.detention_en_cours)],
        recherche,
    ), [parc, recherche]);

    const incidents = useMemo(() => filtrerParRequete(
        parc?.incidents || [],
        (i) => [nomDetenteur(i), i.salarie_nom, i.appareil?.modele, i.ligne?.numero, i.observations],
        recherche,
    ), [parc, recherche]);

    if (chargement && !parc) {
        return <div className='p-8 text-sm text-muted-foreground'>{t('commun.chargement')}</div>;
    }

    if (erreur) {
        return (
            <div className='p-8'>
                <p className='text-sm text-destructive'>{erreur}</p>
                <button onClick={charger} className='mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted transition-colors'>
                    <LuRefreshCw size={15} /> {t('telephonie.reessayer')}
                </button>
            </div>
        );
    }

    return (
        <div className='flex min-h-full flex-col'>

            <header className='flex flex-wrap items-center justify-between gap-4 bg-card px-6 pb-4 pt-6'>
                <div className='min-w-0'>
                    <h1 className='text-xl font-semibold tracking-tight text-foreground'>{t('telephonie.titre')}</h1>
                    <p className='mt-1 text-sm text-muted-foreground'>{t('telephonie.sousTitre')}</p>
                </div>
                {onglet !== 'reprise' && (
                    <div className='flex flex-wrap items-center gap-2'>
                        <label htmlFor='recherche-telephonie' className='sr-only'>{t('telephonie.rechercher')}</label>
                        <input
                            id='recherche-telephonie'
                            type='search'
                            value={recherche}
                            onChange={(e) => setRecherche(e.target.value)}
                            placeholder={t('telephonie.rechercher')}
                            className='h-10 w-72 max-w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground'
                        />
                        {peutGerer && (
                            <>
                                <button onClick={() => setOnglet('reprise')} className={classeBoutonSecondaire}>
                                    <LuListChecks size={15} /> {t('telephonie.repriseBouton')}
                                </button>
                                {onglet === 'incidents' ? (
                                    <button onClick={() => setFenetre({ type: 'incident' })} className={classeBoutonPrincipal}>
                                        <LuPlus size={15} /> {t('telephonie.declarerIncident')}
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={() => setFenetre({ type: 'appareil' })} className={onglet === 'appareils' ? classeBoutonPrincipal : classeBoutonSecondaire}>
                                            <LuPlus size={15} /> {t('telephonie.ajouterAppareil')}
                                        </button>
                                        <button onClick={() => setFenetre({ type: 'ligne' })} className={onglet === 'lignes' ? classeBoutonPrincipal : classeBoutonSecondaire}>
                                            <LuPlus size={15} /> {t('telephonie.ajouterLigne')}
                                        </button>
                                        <button onClick={() => setFenetre({ type: 'remise' })} className={classeBoutonPrincipal}>
                                            <LuSend size={15} /> {t('telephonie.remettreBouton')}
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}
            </header>

            <nav aria-label={t('telephonie.titre')} className='flex flex-wrap gap-1 border-b border-border bg-card px-6'>
                {ONGLETS.map((cle) => (
                    <button
                        key={cle}
                        onClick={() => setOnglet(cle)}
                        aria-current={onglet === cle ? 'page' : undefined}
                        className={`inline-flex min-h-[44px] items-center gap-2 border-b-2 px-3.5 text-sm transition-colors ${onglet === cle
                            ? 'border-primary font-semibold text-primary'
                            : 'border-transparent font-medium text-muted-foreground hover:text-foreground'}`}
                    >
                        {t(`telephonie.onglet_${cle}`)}
                        {cle === 'incidents' && resume?.incidents_sans_suite > 0 && (
                            <span className='rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white'>{resume.incidents_sans_suite}</span>
                        )}
                    </button>
                ))}
            </nav>

            <div className='flex-grow bg-background px-6 pb-10 pt-5'>

                {onglet === 'reprise' && (peutGerer ? (
                    <TelephonieReprise
                        modelesConnus={modelesConnus}
                        onRetour={() => setOnglet('apercu')}
                        onEnregistre={charger}
                    />
                ) : (
                    <Vide message={t('telephonie.lectureSeule')} />
                ))}

                {onglet === 'apercu' && (
                    <div className='flex flex-col gap-6'>
                        {peutGerer && parc.detentions.length === 0 && (
                            <section className='flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4'>
                                <div className='min-w-[260px] flex-1'>
                                    <h2 className='text-sm font-semibold text-foreground'>{t('telephonie.repriseTitre')}</h2>
                                    <p className='mt-1 text-sm text-muted-foreground'>{t('telephonie.repriseAppel')}</p>
                                </div>
                                <button onClick={() => setOnglet('reprise')} className={classeBoutonPrincipal}>
                                    <LuListChecks size={15} /> {t('telephonie.repriseCommencer')}
                                </button>
                            </section>
                        )}

                        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                            <Tuile
                                libelle={t('telephonie.tuileAppareils')}
                                valeur={resume.appareils_total}
                                detail={t('telephonie.detailAppareils', { attribues: resume.appareils_attribues, stock: resume.appareils_en_stock, hs: resume.appareils_hors_service })}
                            />
                            <Tuile
                                libelle={t('telephonie.tuileLignes')}
                                valeur={resume.lignes_total}
                                detail={t('telephonie.detailLignes', { attribuees: resume.lignes_attribuees, suspendues: resume.lignes_suspendues })}
                            />
                            <Tuile
                                libelle={t('telephonie.tuileForfaits')}
                                valeur={formaterEuros(resume.cout_mensuel)}
                                detail={t('telephonie.detailForfaits', { annuel: formaterEuros(resume.cout_mensuel * 12) })}
                            />
                            <Tuile
                                libelle={t('telephonie.tuileARegulariser')}
                                valeur={nbAlertes}
                                alerte={nbAlertes > 0}
                                detail={resume.fiches_a_completer > 0 ? t('telephonie.fichesACompleter', { nombre: resume.fiches_a_completer }) : null}
                            />
                        </div>

                        <section className='overflow-hidden rounded-xl border border-border bg-card'>
                            <div className='border-b border-border px-5 py-4'>
                                <h2 className='flex items-center gap-2 text-sm font-semibold text-foreground'>
                                    <LuAlertTriangle size={16} className={nbAlertes ? 'text-orange-600' : 'text-muted-foreground'} />
                                    {t('telephonie.aFaire')}
                                </h2>
                            </div>
                            {nbAlertes === 0 ? (
                                <Vide message={t('telephonie.rienAFaire')} />
                            ) : (
                                <ul className='divide-y divide-border/60'>
                                    {alertes.materiel_non_restitue.map((d) => (
                                        <li key={`m${d.id}`} className='flex flex-wrap items-center gap-3 px-5 py-3.5'>
                                            <span aria-hidden='true' className='h-2 w-2 shrink-0 rounded-full bg-red-600' />
                                            <span className='min-w-[260px] flex-grow text-sm leading-relaxed text-foreground'>
                                                <strong className='font-semibold'>{t('telephonie.alerteNonRestitue')}</strong>{' '}
                                                <span className='text-muted-foreground'>
                                                    {t('telephonie.alerteNonRestitueDetail', {
                                                        nom: nomDetenteur(d),
                                                        date: formaterDate(d.sorti_le),
                                                        objet: d.appareil ? d.appareil.modele : d.ligne?.numero,
                                                    })}
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                    {alertes.lignes_facturees_inutilement.map((l) => (
                                        <li key={`l${l.id}`} className='flex flex-wrap items-center gap-3 px-5 py-3.5'>
                                            <span aria-hidden='true' className='h-2 w-2 shrink-0 rounded-full bg-orange-500' />
                                            <span className='min-w-[260px] flex-grow text-sm leading-relaxed text-foreground'>
                                                <strong className='font-semibold'>{t('telephonie.alerteLigneLibre')}</strong>{' '}
                                                <span className='text-muted-foreground'>
                                                    {t('telephonie.alerteLigneLibreDetail', {
                                                        numero: l.numero,
                                                        depuis: formaterDate(l.libre_depuis),
                                                        cout: formaterEuros(l.cout_mensuel),
                                                    })}
                                                    {l.perdu_depuis_libre > 0 && ` ${t('telephonie.alerteDejaPerdu', { total: formaterEuros(l.perdu_depuis_libre) })}`}
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                    {alertes.engagements_proches.map((e) => (
                                        <li key={`e${e.echeance}`} className='flex flex-wrap items-center gap-3 px-5 py-3.5'>
                                            <span aria-hidden='true' className='h-2 w-2 shrink-0 rounded-full bg-orange-500' />
                                            <span className='min-w-[260px] flex-grow text-sm leading-relaxed text-foreground'>
                                                <strong className='font-semibold'>{t('telephonie.alerteEngagement', { jours: e.jours_restants })}</strong>{' '}
                                                <span className='text-muted-foreground'>
                                                    {t('telephonie.alerteEngagementDetail', {
                                                        nombre: e.nombre,
                                                        operateur: e.operateur,
                                                        date: formaterDate(e.echeance),
                                                        cout: formaterEuros(e.cout_mensuel_total),
                                                    })}
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className='overflow-hidden rounded-xl border border-border bg-card'>
                            <div className='border-b border-border px-5 py-4'>
                                <h2 className='text-sm font-semibold text-foreground'>
                                    {t('telephonie.quiDetientQuoi')} <span className='font-normal text-muted-foreground'>— {t('telephonie.detentionsEnCours', { nombre: parc.detentions.length })}</span>
                                </h2>
                            </div>
                            {detentions.length === 0 ? (
                                <Vide message={recherche ? t('telephonie.aucunResultat') : t('telephonie.aucuneDetention')} />
                            ) : (
                                <div className='overflow-x-auto'>
                                    <table className='w-full border-collapse'>
                                        <thead className='bg-muted/40'>
                                            <tr>
                                                <EnTete>{t('telephonie.colSalarie')}</EnTete>
                                                <EnTete>{t('telephonie.colObjet')}</EnTete>
                                                <EnTete>{t('telephonie.colDepuis')}</EnTete>
                                                <EnTete>{t('telephonie.colDecharge')}</EnTete>
                                                {peutGerer && <EnTete><span className='sr-only'>{t('telephonie.colAction')}</span></EnTete>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detentions.map((d) => (
                                                <tr key={d.id} className='odd:bg-background even:bg-muted/10'>
                                                    <Cellule className='font-medium'>{nomDetenteur(d)}</Cellule>
                                                    <Cellule>
                                                        {d.appareil ? (
                                                            <span className='inline-flex items-center gap-1.5'><LuSmartphone size={13} className='text-muted-foreground' />{d.appareil.modele}</span>
                                                        ) : (
                                                            <span className='inline-flex items-center gap-1.5 tabular-nums'><LuSignal size={13} className='text-muted-foreground' />{d.ligne?.numero}</span>
                                                        )}
                                                    </Cellule>
                                                    <Cellule className='tabular-nums text-muted-foreground'>{formaterDate(d.date_debut)}</Cellule>
                                                    <Cellule>
                                                        {d.remise?.decharge_statut === 'signee' && <span className='text-green-700 dark:text-green-400'>{t('telephonie.dechargeSignee')}</span>}
                                                        {d.remise?.decharge_statut === 'a_signer' && <span className='font-medium text-orange-700 dark:text-orange-400'>{t('telephonie.dechargeASigner')}</span>}
                                                        {(!d.remise || d.remise.decharge_statut === 'non_requise') && <span className='text-muted-foreground'>—</span>}
                                                    </Cellule>
                                                    {peutGerer && (
                                                        <Cellule className='text-right'>
                                                            <button
                                                                type='button'
                                                                onClick={() => setFenetre({ type: 'cloture', objet: d })}
                                                                className='inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                                                            >
                                                                <LuCornerUpLeft size={14} /> {t('telephonie.cloturerBouton')}
                                                            </button>
                                                        </Cellule>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {onglet === 'appareils' && (
                    <section className='overflow-hidden rounded-xl border border-border bg-card'>
                        {appareils.length === 0 ? (
                            <Vide message={recherche ? t('telephonie.aucunResultat') : t('telephonie.aucunAppareil')} />
                        ) : (
                            <div className='overflow-x-auto'>
                                <table className='w-full border-collapse'>
                                    <thead className='bg-muted/40'>
                                        <tr>
                                            <EnTete>{t('telephonie.colModele')}</EnTete>
                                            <EnTete>{t('telephonie.colImei')}</EnTete>
                                            <EnTete>{t('telephonie.colAchete')}</EnTete>
                                            <EnTete>{t('telephonie.colValeur')}</EnTete>
                                            <EnTete>{t('telephonie.colDetenteur')}</EnTete>
                                            <EnTete>{t('telephonie.colEtat')}</EnTete>
                                            {peutGerer && <EnTete><span className='sr-only'>{t('telephonie.colAction')}</span></EnTete>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {appareils.map((a) => (
                                            <tr key={a.id} className='odd:bg-background even:bg-muted/10'>
                                                <Cellule className='font-medium'>
                                                    {a.modele}
                                                    {a.fiche_a_completer && <span className='ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200'>{t('telephonie.aCompleter')}</span>}
                                                </Cellule>
                                                <Cellule className='tabular-nums text-muted-foreground'>{a.imei || '—'}</Cellule>
                                                <Cellule className='tabular-nums text-muted-foreground'>{formaterDate(a.date_achat)}</Cellule>
                                                <Cellule className='tabular-nums'>{formaterEuros(a.prix_achat)}</Cellule>
                                                <Cellule>{nomDetenteur(a.detention_en_cours) || <span className='text-muted-foreground'>—</span>}</Cellule>
                                                <Cellule><Etiquette texte={t(`telephonie.etat_${a.etat}`)} classe={ETATS_APPAREIL[a.etat] || 'bg-muted text-muted-foreground'} /></Cellule>
                                                {peutGerer && (
                                                    <Cellule className='text-right'>
                                                        <BoutonModifier libelle={t('telephonie.modifierAppareilDe', { modele: a.modele })} onClick={() => setFenetre({ type: 'appareil', objet: a })} />
                                                    </Cellule>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {onglet === 'lignes' && (
                    <section className='overflow-hidden rounded-xl border border-border bg-card'>
                        {lignes.length === 0 ? (
                            <Vide message={recherche ? t('telephonie.aucunResultat') : t('telephonie.aucuneLigne')} />
                        ) : (
                            <>
                                <div className='overflow-x-auto'>
                                    <table className='w-full border-collapse'>
                                        <thead className='bg-muted/40'>
                                            <tr>
                                                <EnTete>{t('telephonie.colNumero')}</EnTete>
                                                <EnTete>{t('telephonie.colOperateur')}</EnTete>
                                                <EnTete>{t('telephonie.colForfait')}</EnTete>
                                                <EnTete>{t('telephonie.colCoutMensuel')}</EnTete>
                                                <EnTete>{t('telephonie.colEngagement')}</EnTete>
                                                <EnTete>{t('telephonie.colCodes')}</EnTete>
                                                <EnTete>{t('telephonie.colDetenteur')}</EnTete>
                                                {peutGerer && <EnTete><span className='sr-only'>{t('telephonie.colAction')}</span></EnTete>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lignes.map((l) => (
                                                <tr key={l.id} className='odd:bg-background even:bg-muted/10'>
                                                    <Cellule className='font-medium tabular-nums'>
                                                        {l.numero}
                                                        {l.fiche_a_completer && <span className='ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200'>{t('telephonie.aCompleter')}</span>}
                                                    </Cellule>
                                                    <Cellule>{l.operateur}</Cellule>
                                                    <Cellule>{l.forfait || '—'}</Cellule>
                                                    <Cellule className='tabular-nums'>{formaterEuros(l.cout_mensuel)}</Cellule>
                                                    <Cellule className='tabular-nums text-muted-foreground'>{l.engagement_jusquau ? formaterDate(l.engagement_jusquau) : t('telephonie.sansEngagement')}</Cellule>
                                                    <Cellule className='text-muted-foreground'>{l.a_des_codes ? '••••' : t('telephonie.codesNonRenseignes')}</Cellule>
                                                    <Cellule>{nomDetenteur(l.detention_en_cours) || <span className='text-muted-foreground'>—</span>}</Cellule>
                                                    {peutGerer && (
                                                        <Cellule className='text-right'>
                                                            <BoutonModifier libelle={t('telephonie.modifierLigneDe', { numero: l.numero })} onClick={() => setFenetre({ type: 'ligne', objet: l })} />
                                                        </Cellule>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className='border-t border-border px-5 py-3.5 text-xs text-muted-foreground'>{t('telephonie.noteCodes')}</p>
                            </>
                        )}
                    </section>
                )}

                {onglet === 'incidents' && (
                    <section className='overflow-hidden rounded-xl border border-border bg-card'>
                        {incidents.length === 0 ? (
                            <Vide message={recherche ? t('telephonie.aucunResultat') : t('telephonie.aucunIncident')} />
                        ) : (
                            <>
                                <div className='overflow-x-auto'>
                                    <table className='w-full border-collapse'>
                                        <thead className='bg-muted/40'>
                                            <tr>
                                                <EnTete>{t('telephonie.colDate')}</EnTete>
                                                <EnTete>{t('telephonie.colSalarie')}</EnTete>
                                                <EnTete>{t('telephonie.colConcerne')}</EnTete>
                                                <EnTete>{t('telephonie.colNature')}</EnTete>
                                                <EnTete>{t('telephonie.colMontant')}</EnTete>
                                                <EnTete>{t('telephonie.colSuite')}</EnTete>
                                                {peutGerer && <EnTete><span className='sr-only'>{t('telephonie.colAction')}</span></EnTete>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {incidents.map((i) => (
                                                <tr key={i.id} className='odd:bg-background even:bg-muted/10'>
                                                    <Cellule className='tabular-nums text-muted-foreground'>{formaterDate(i.date_incident)}</Cellule>
                                                    <Cellule className='font-medium'>{nomDetenteur(i) || i.salarie_nom || '—'}</Cellule>
                                                    <Cellule>{i.appareil?.modele || i.ligne?.numero || '—'}</Cellule>
                                                    <Cellule><Etiquette texte={t(`telephonie.nature_${i.nature}`)} classe={NATURES_INCIDENT[i.nature] || 'bg-muted text-muted-foreground'} /></Cellule>
                                                    <Cellule className='tabular-nums'>{formaterEuros(i.montant)}</Cellule>
                                                    <Cellule className={i.suite_donnee === 'a_decider' ? 'font-medium text-orange-700 dark:text-orange-400' : ''}>
                                                        {t(`telephonie.suite_${i.suite_donnee}`)}
                                                    </Cellule>
                                                    {peutGerer && (
                                                        <Cellule className='text-right'>
                                                            <BoutonModifier libelle={t('telephonie.modifierIncident')} onClick={() => setFenetre({ type: 'incident', objet: i })} />
                                                        </Cellule>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className='border-t border-border px-5 py-3.5 text-xs text-muted-foreground'>{t('telephonie.noteRetenue')}</p>
                            </>
                        )}
                    </section>
                )}

                {!peutGerer && (
                    <p className='mt-6 text-xs text-muted-foreground'>{t('telephonie.lectureSeule')}</p>
                )}
            </div>

            {fenetre?.type === 'appareil' && (
                <AppareilForm appareil={fenetre.objet} modelesConnus={modelesConnus} onFerme={() => setFenetre(null)} onEnregistre={charger} />
            )}
            {fenetre?.type === 'ligne' && (
                <LigneForm ligne={fenetre.objet} onFerme={() => setFenetre(null)} onEnregistre={charger} />
            )}
            {fenetre?.type === 'remise' && (
                <RemiseForm
                    appareilsDisponibles={appareilsDisponibles}
                    lignesDisponibles={lignesDisponibles}
                    onFerme={() => setFenetre(null)}
                    onEnregistre={charger}
                />
            )}
            {fenetre?.type === 'cloture' && (
                <ClotureDetentionForm detention={fenetre.objet} onFerme={() => setFenetre(null)} onEnregistre={charger} />
            )}
            {fenetre?.type === 'incident' && (
                <IncidentForm
                    incident={fenetre.objet}
                    appareilsEnService={appareilsEnService}
                    lignesAttribuees={lignesAttribuees}
                    onFerme={() => setFenetre(null)}
                    onEnregistre={charger}
                />
            )}
        </div>
    );
}

export default Telephonie;
