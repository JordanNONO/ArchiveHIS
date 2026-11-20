import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuLoader, LuArrowLeft, LuCheckCircle2, LuAlertTriangle, LuX } from 'react-icons/lu';
import { envoyerBulletinsPaie, enregistrerContactBulletinPaie } from '../../api/routes/bulletinPaie';
import { libelleMois, libelleMoisMinuscule, normaliser } from './analyseNomFichier';
import { ChampRecherche, Pagination, Pastille, Puce, paginer } from './ui';

const PAR_PAGE = 25;
const NOMS_VISIBLES = 15;

/**
 * Adresse e-mail d'un salarié dans la liste d'envoi. Celle d'un compte se
 * gère sur la fiche du compte ; sinon on la saisit ici, elle est gardée pour
 * les mois suivants (la plupart des intervenants n'ont pas de compte). Une
 * adresse trouvée dans les observations de la Fluctuation RH est seulement
 * proposée : un clic pour l'utiliser, jamais d'office.
 */
function ChampMail({ ligne, onEnregistre }) {
    const { t } = useTranslation();
    const [edition, setEdition] = useState(false);
    const [valeur, setValeur] = useState('');
    const [enCours, setEnCours] = useState(false);

    async function enregistrer(mail) {
        if (enCours) return;
        setEnCours(true);
        const res = await enregistrerContactBulletinPaie(ligne.nom, mail).catch(() => null);
        setEnCours(false);
        if (!res || res.status !== 200) {
            const data = (await res?.json().catch(() => ({}))) || {};
            toast.error(data?.error || data?.message || t('commun.erreurGenerique'));
            return;
        }
        setEdition(false);
        toast.success(mail ? t('bulletinPaie.adresseEnregistree') : t('bulletinPaie.adresseRetiree'));
        onEnregistre();
    }

    if (edition) {
        return (
            <form onSubmit={(e) => { e.preventDefault(); if (valeur.trim()) enregistrer(valeur.trim()); }} className='flex min-w-0 items-center gap-1.5'>
                <input
                    type='email'
                    autoFocus
                    required
                    value={valeur}
                    onChange={(e) => setValeur(e.target.value)}
                    placeholder='prenom.nom@exemple.fr'
                    aria-label={t('bulletinPaie.adresseDe', { nom: ligne.nom })}
                    className='h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20'
                />
                <button type='submit' disabled={enCours || !valeur.trim()} className='inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50'>
                    {enCours && <LuLoader size={12} className='animate-spin' />}{t('bulletinPaie.enregistrer')}
                </button>
                <button type='button' onClick={() => setEdition(false)} aria-label={t('bulletinPaie.annuler')} className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted'>
                    <LuX size={14} />
                </button>
            </form>
        );
    }

    if (ligne.mail) {
        return (
            <div className='min-w-0'>
                <p className='truncate text-sm text-foreground' title={ligne.mail}>{ligne.mail}</p>
                {ligne.mail_source === 'saisi' && (
                    <button type='button' onClick={() => { setValeur(ligne.mail); setEdition(true); }} className='text-xs text-primary hover:underline'>
                        {t('bulletinPaie.modifierAdresse')}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className='flex min-w-0 flex-col items-start gap-0.5'>
            <button type='button' onClick={() => { setValeur(''); setEdition(true); }} className='text-sm font-medium text-primary hover:underline'>
                + {t('bulletinPaie.saisirAdresse')}
            </button>
            {ligne.mail_suggere && (
                <button
                    type='button'
                    onClick={() => enregistrer(ligne.mail_suggere)}
                    disabled={enCours}
                    title={t('bulletinPaie.suggestionFluctuationAide')}
                    className='max-w-full truncate text-left text-xs text-muted-foreground hover:text-foreground'
                >
                    {t('bulletinPaie.utiliserSuggestion', { mail: ligne.mail_suggere })}
                </button>
            )}
        </div>
    );
}

function formatDateFr(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR');
}

/** Une catégorie par salarié — sert au résumé, aux filtres et aux cases à cocher. */
function categorie(l, exclus) {
    if (l.deja_envoye) return 'sent';
    if (l.raison_exclusion === 'en_cours') return 'encours';
    if (!l.bulletin_trouve) return 'nodep';
    if (!l.mail) return 'nomail';
    if (l.dernier_statut === 'echec') return 'fail';
    if (exclus[l.cle]) return 'excl';
    return 'ready';
}

const TON_CATEGORIE = { ready: 'info', excl: 'mute', fail: 'err', nomail: 'err', nodep: 'warn', sent: 'ok', encours: 'info' };
const BADGE = {
    nomail: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    nodep: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    excl: 'bg-muted text-muted-foreground',
    encours: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    sent: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
};

/**
 * Onglet 2/3 — envoi par e-mail. Pensé pour ~200 salariés : un résumé (combien
 * partent, et ce qui ne partira pas, groupé par raison) plutôt qu'une liste
 * de 200 cases à cocher ; la liste complète reste accessible, filtrée et
 * paginée. Une confirmation précède chaque envoi : un e-mail parti ne se
 * rattrape pas. La progression suit les vrais statuts serveur (le conteneur
 * recharge l'aperçu tant que des envois sont en file).
 */
function OngletEnvoi({ mois, apercu, chargement, onApercuChange, onAllerDepot }) {
    const { t } = useTranslation();
    const [mode, setMode] = useState('resume');
    const [filtre, setFiltre] = useState('tous');
    const [recherche, setRecherche] = useState('');
    const [page, setPage] = useState(0);
    const [exclus, setExclus] = useState({});
    const [ouverts, setOuverts] = useState({});
    const [confirmation, setConfirmation] = useState(null); // cle[]
    const [requeteEnCours, setRequeteEnCours] = useState(false);
    const [suivi, setSuivi] = useState(null); // { ids: cle[], apercuDepart }
    const [resultat, setResultat] = useState(null); // { ok, echecs }

    useEffect(() => {
        setMode('resume'); setFiltre('tous'); setRecherche(''); setPage(0);
        setExclus({}); setOuverts({}); setConfirmation(null); setSuivi(null); setResultat(null);
    }, [mois]);

    // Identifiés par `cle` (le nom) : beaucoup d'intervenants n'ont pas de
    // compte, donc pas de personnel_id. Un nom seulement connu de la
    // Fluctuation RH ne compte que s'il a un bulletin ce mois-ci.
    const lignes = (apercu?.lignes || []).filter((l) => l.personnel_id || l.bulletin_trouve);
    const parId = {};
    lignes.forEach((l) => { parId[l.cle] = l; });
    const cats = lignes.map((l) => ({ l, c: categorie(l, exclus) }));
    const compte = { ready: 0, excl: 0, fail: 0, nomail: 0, nodep: 0, sent: 0, encours: 0 };
    cats.forEach((x) => { compte[x.c] += 1; });
    const idsPrets = cats.filter((x) => x.c === 'ready').map((x) => x.l.cle);
    const idsEchecs = cats.filter((x) => x.c === 'fail').map((x) => x.l.cle);

    // Fin d'un envoi suivi : plus aucun de ses destinataires n'est "en cours".
    // Seulement sur un aperçu rechargé APRÈS le lancement (apercuDepart) :
    // l'ancien ne les montre pas encore en file, ce qui ferait croire à une
    // fin immédiate.
    const suiviRestants = suivi ? suivi.ids.filter((id) => parId[id]?.raison_exclusion === 'en_cours').length : 0;
    useEffect(() => {
        if (!suivi || !apercu || apercu === suivi.apercuDepart || suiviRestants > 0) return;
        const ok = suivi.ids.filter((id) => parId[id]?.deja_envoye).length;
        setResultat({ ok, echecs: suivi.ids.length - ok });
        setSuivi(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apercu, suivi, suiviRestants]);

    async function lancer() {
        if (!confirmation?.length || requeteEnCours) return;
        setRequeteEnCours(true);
        const ids = confirmation;
        const res = await envoyerBulletinsPaie(mois, ids).catch(() => null);
        setRequeteEnCours(false);
        setConfirmation(null);
        if (!res || res.status !== 202) {
            const data = (await res?.json().catch(() => ({}))) || {};
            toast.error(data?.error || t('commun.erreurGenerique'));
            return;
        }
        setResultat(null);
        setSuivi({ ids, apercuDepart: apercu });
        onApercuChange();
    }

    if (chargement && !apercu) {
        return <p className='text-sm text-muted-foreground'>{t('commun.chargement')}</p>;
    }

    const periode = libelleMois(mois);
    const aucunDepot = lignes.length > 0 && lignes.every((l) => !l.bulletin_trouve);
    const occupe = requeteEnCours || !!suivi || !!confirmation;
    const nPrets = compte.ready;

    const groupesDef = [
        // Saisie directe des adresses (la plupart des intervenants n'ont pas
        // de compte) : la liste complète, filtrée sur les salariés concernés.
        { cle: 'nomail', titre: t('bulletinPaie.groupeSansMail'), desc: t('bulletinPaie.groupeSansMailDesc'), action: t('bulletinPaie.saisirAdresses'), onAction: () => { setMode('liste'); setFiltre('nomail'); setPage(0); setRecherche(''); } },
        { cle: 'nodep', titre: t('bulletinPaie.groupeNonDepose'), desc: t('bulletinPaie.groupeNonDeposeDesc', { mois: libelleMoisMinuscule(mois) }), action: t('bulletinPaie.allerAuDepot'), onAction: onAllerDepot },
        { cle: 'excl', titre: t('bulletinPaie.groupeDecoches'), desc: t('bulletinPaie.groupeDecochesDesc'), action: t('bulletinPaie.reintegrer'), onAction: () => setExclus({}) },
        { cle: 'encours', titre: t('bulletinPaie.groupeEnCours'), desc: t('bulletinPaie.groupeEnCoursDesc') },
        { cle: 'sent', titre: t('bulletinPaie.groupeDejaEnvoyes'), desc: t('bulletinPaie.groupeDejaEnvoyesDesc') },
    ].filter((g) => compte[g.cle] > 0);

    const requete = normaliser(recherche.trim());
    const filtres = cats.filter((x) => {
        if (filtre !== 'tous' && x.c !== filtre) return false;
        if (requete && !normaliser(`${x.l.nom} ${x.l.mail || ''}`).includes(requete)) return false;
        return true;
    });
    const pg = paginer(filtres.length, page, PAR_PAGE);

    function basculer(id) {
        setExclus((prev) => {
            const suivant = { ...prev };
            if (suivant[id]) delete suivant[id]; else suivant[id] = true;
            return suivant;
        });
    }
    function cocherAffiches(cocher) {
        setExclus((prev) => {
            const suivant = { ...prev };
            filtres.forEach((x) => {
                if (x.c !== 'ready' && x.c !== 'excl') return;
                if (cocher) delete suivant[x.l.cle]; else suivant[x.l.cle] = true;
            });
            return suivant;
        });
    }

    const libelleCategorie = (x) => ({
        ready: t('bulletinPaie.ligneEnvoiPret'),
        excl: t('bulletinPaie.ligneEnvoiDecoche'),
        fail: t('bulletinPaie.ligneEnvoiEchec'),
        nomail: t('bulletinPaie.ligneEnvoiSansMail'),
        nodep: t('bulletinPaie.ligneEnvoiNonDepose'),
        encours: t('bulletinPaie.ligneEnvoiEnCours'),
        sent: t('bulletinPaie.ligneEnvoiEnvoyeLe', { date: formatDateFr(x.l.envoye_le) }),
    }[x.c]);

    const puces = [
        ['tous', t('bulletinPaie.filtreTous'), lignes.length],
        ['ready', t('bulletinPaie.filtrePrets'), compte.ready],
        ['excl', t('bulletinPaie.filtreDecoches'), compte.excl],
        ['fail', t('bulletinPaie.filtreEchecs'), compte.fail],
        ['nomail', t('bulletinPaie.filtreSansMail'), compte.nomail],
        ['nodep', t('bulletinPaie.filtreNonDeposes'), compte.nodep],
        ['encours', t('bulletinPaie.filtreEnCours'), compte.encours],
        ['sent', t('bulletinPaie.filtreDejaEnvoyes'), compte.sent],
    ].filter(([cle, , n]) => cle === 'tous' || cle === 'ready' || n > 0);

    const boutonEnvoyer = (
        <button
            type='button'
            onClick={() => setConfirmation(idsPrets)}
            disabled={nPrets === 0 || occupe}
            className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
        >
            {nPrets === 0 ? t('bulletinPaie.envoyerAucunSelectionne') : t('bulletinPaie.envoyerNBulletins', { count: nPrets })}
        </button>
    );

    return (
        <section className='flex flex-wrap items-start gap-4'>
            <div className='flex min-w-0 flex-[999_1_600px] flex-col gap-3.5'>
                {aucunDepot && (
                    <div className='flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6'>
                        <p className='text-base font-semibold text-foreground'>{t('bulletinPaie.aucunDepotTitre', { periode })}</p>
                        <p className='text-sm text-muted-foreground'>{t('bulletinPaie.aucunDepotTexte')}</p>
                        <button type='button' onClick={onAllerDepot} className='rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90'>{t('bulletinPaie.allerAuDepot')}</button>
                    </div>
                )}

                {suivi && (
                    <div role='status' className='flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4'>
                        <div className='flex items-center justify-between gap-3 text-sm'>
                            <span className='inline-flex items-center gap-2 font-semibold text-foreground'><LuLoader size={15} className='animate-spin' /> {t('bulletinPaie.envoiEnCoursTitre')}</span>
                            <span className='tabular-nums text-muted-foreground'>{suivi.ids.length - suiviRestants} / {suivi.ids.length}</span>
                        </div>
                        <div className='h-2.5 overflow-hidden rounded-full bg-muted'>
                            <div className='h-full rounded-full bg-primary transition-all duration-500' style={{ width: `${Math.round((100 * (suivi.ids.length - suiviRestants)) / Math.max(1, suivi.ids.length))}%` }} />
                        </div>
                        <p className='text-xs text-muted-foreground'>{t('bulletinPaie.envoiEnCoursAide')}</p>
                    </div>
                )}

                {resultat && (
                    <div role='status' className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${resultat.echecs ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200' : 'border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200'}`}>
                        <span className='inline-flex items-center gap-2 font-medium'>
                            {resultat.echecs ? <LuAlertTriangle size={16} /> : <LuCheckCircle2 size={16} />}
                            {t('bulletinPaie.resultatEnvoi', { count: resultat.ok, periode })}
                            {resultat.echecs > 0 && ` ${t('bulletinPaie.resultatEchecs', { count: resultat.echecs })}`}
                        </span>
                        <button type='button' aria-label={t('bulletinPaie.fermer')} onClick={() => setResultat(null)} className='flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5'><LuX size={15} /></button>
                    </div>
                )}

                {confirmation && (
                    <div role='alertdialog' aria-label={t('bulletinPaie.confirmerEnvoiTitre', { count: confirmation.length })} className='flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30'>
                        <p className='text-base font-bold text-amber-900 dark:text-amber-200'>{t('bulletinPaie.confirmerEnvoiTitre', { count: confirmation.length })}</p>
                        <p className='text-sm text-amber-900 dark:text-amber-200'>{t('bulletinPaie.confirmerEnvoiTexte', { mois: libelleMoisMinuscule(mois) })}</p>
                        <div className='flex flex-wrap gap-2'>
                            <button type='button' onClick={lancer} disabled={requeteEnCours} className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50'>
                                {requeteEnCours && <LuLoader size={14} className='animate-spin' />}
                                {t('bulletinPaie.confirmerEnvoiOui', { count: confirmation.length })}
                            </button>
                            <button type='button' onClick={() => setConfirmation(null)} disabled={requeteEnCours} className='rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted'>
                                {t('bulletinPaie.annuler')}
                            </button>
                        </div>
                    </div>
                )}

                {!aucunDepot && mode === 'resume' && (
                    <>
                        {(nPrets > 0 || compte.excl > 0) && !suivi && (
                            <div className='flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5'>
                                <div className='flex flex-col gap-1'>
                                    <span className='text-4xl font-bold leading-none tabular-nums text-primary'>{nPrets}</span>
                                    <span className='text-sm text-foreground'>{t('bulletinPaie.salariesPrets', { count: nPrets, mois: libelleMoisMinuscule(mois) })}</span>
                                    <button type='button' onClick={() => { setMode('liste'); setFiltre('tous'); setPage(0); }} className='self-start py-1 text-sm font-medium text-primary underline-offset-2 hover:underline'>
                                        {t('bulletinPaie.voirListeComplete', { count: lignes.length })}
                                    </button>
                                </div>
                                {boutonEnvoyer}
                            </div>
                        )}

                        {nPrets === 0 && compte.excl === 0 && compte.fail === 0 && compte.encours === 0 && !suivi && (
                            <div className='flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3.5 text-sm font-medium text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200'>
                                <LuCheckCircle2 size={17} /> {t('bulletinPaie.toutEstParti', { periode })}
                            </div>
                        )}

                        {compte.fail > 0 && !suivi && (
                            <div className='overflow-hidden rounded-xl border border-red-200 bg-card dark:border-red-900/50'>
                                <div className='flex flex-wrap items-center justify-between gap-3 bg-red-50 px-4 py-3 dark:bg-red-950/30'>
                                    <span className='text-sm font-bold text-red-800 dark:text-red-300'>{t('bulletinPaie.echecsTitre', { count: compte.fail })}</span>
                                    <button type='button' onClick={() => setConfirmation(idsEchecs)} disabled={occupe} className='rounded-lg bg-red-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50'>
                                        {t('bulletinPaie.reessayer')}
                                    </button>
                                </div>
                                {cats.filter((x) => x.c === 'fail').map((x) => (
                                    <div key={x.l.cle} className='flex flex-wrap gap-x-4 gap-y-1 border-t border-red-100 px-4 py-2.5 text-sm dark:border-red-900/40'>
                                        <span className='min-w-[180px] font-semibold text-foreground'>{x.l.nom}</span>
                                        <span className='flex-1 text-muted-foreground'>{x.l.mail}</span>
                                        <span className='text-red-700 dark:text-red-400'>{x.l.derniere_erreur || t('bulletinPaie.ligneEnvoiEchec')}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {groupesDef.length > 0 && (
                            <div className='overflow-hidden rounded-xl border border-border bg-card'>
                                <h2 className='border-b border-border px-4 py-3 text-sm font-semibold text-foreground'>{t('bulletinPaie.cequiNePartiraPas')}</h2>
                                {groupesDef.map((g) => {
                                    const noms = cats.filter((x) => x.c === g.cle).map((x) => x.l);
                                    const ouvert = !!ouverts[g.cle];
                                    return (
                                        <div key={g.cle} className='flex flex-col gap-2.5 border-t border-border/60 px-4 py-3 first-of-type:border-t-0'>
                                            <div className='flex flex-wrap items-center justify-between gap-3'>
                                                <div className='flex items-center gap-3'>
                                                    <span className={`flex h-8 min-w-[44px] items-center justify-center rounded-lg px-2 text-[15px] font-bold tabular-nums ${BADGE[g.cle]}`}>{noms.length}</span>
                                                    <div>
                                                        <p className='text-sm font-semibold text-foreground'>{g.titre}</p>
                                                        <p className='text-xs text-muted-foreground'>{g.desc}</p>
                                                    </div>
                                                </div>
                                                <div className='flex flex-wrap gap-1.5'>
                                                    <button type='button' aria-expanded={ouvert} onClick={() => setOuverts((p) => ({ ...p, [g.cle]: !p[g.cle] }))} className='rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted'>
                                                        {ouvert ? t('bulletinPaie.masquerNoms') : t('bulletinPaie.voirNoms')}
                                                    </button>
                                                    {g.action && (
                                                        <button type='button' onClick={g.onAction} className='rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90'>{g.action}</button>
                                                    )}
                                                </div>
                                            </div>
                                            {ouvert && (
                                                <div className='flex flex-wrap gap-1.5'>
                                                    {noms.slice(0, NOMS_VISIBLES).map((l) => (
                                                        <span key={l.cle} className='rounded-full bg-muted px-2.5 py-1 text-xs text-foreground'>{l.nom}</span>
                                                    ))}
                                                    {noms.length > NOMS_VISIBLES && (
                                                        <button type='button' onClick={() => { setMode('liste'); setFiltre(g.cle); setPage(0); setRecherche(''); }} className='px-1 text-xs font-medium text-primary underline-offset-2 hover:underline'>
                                                            {t('bulletinPaie.etNAutres', { count: noms.length - NOMS_VISIBLES })}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {!aucunDepot && mode === 'liste' && (
                    <div className='overflow-hidden rounded-xl border border-border bg-card'>
                        <div className='flex flex-col gap-3 border-b border-border px-4 py-3'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <button type='button' onClick={() => setMode('resume')} className='inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline'>
                                    <LuArrowLeft size={14} /> {t('bulletinPaie.retourResume')}
                                </button>
                                <ChampRecherche className='w-72' value={recherche} onChange={(v) => { setRecherche(v); setPage(0); }} placeholder={t('bulletinPaie.rechercherSalarieMail')} />
                            </div>
                            <div className='flex flex-wrap gap-1.5'>
                                {puces.map(([cle, libelle, n]) => (
                                    <Puce key={cle} actif={filtre === cle} onClick={() => { setFiltre(cle); setPage(0); }}>{libelle} ({n})</Puce>
                                ))}
                            </div>
                            <div className='flex flex-wrap items-center gap-2'>
                                <button type='button' onClick={() => cocherAffiches(true)} disabled={occupe} className='rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40'>{t('bulletinPaie.cocherAffiches')}</button>
                                <button type='button' onClick={() => cocherAffiches(false)} disabled={occupe} className='rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40'>{t('bulletinPaie.decocherAffiches')}</button>
                                <span className='text-xs text-muted-foreground'>{t('bulletinPaie.seulsCochesRecoivent')}</span>
                            </div>
                        </div>
                        <div className='overflow-x-auto'>
                            <div className='min-w-[660px]'>
                                {filtres.length === 0 && <p className='px-4 py-8 text-center text-sm text-muted-foreground'>{t('bulletinPaie.aucunSalarieCorrespond')}</p>}
                                {filtres.slice(pg.debut, pg.fin).map((x) => {
                                    const selectionnable = x.c === 'ready' || x.c === 'excl';
                                    return (
                                        <label key={x.l.cle} className={`grid grid-cols-[24px_1.5fr_1.7fr_1.3fr] items-center gap-3.5 border-t border-border/60 px-4 py-2.5 first:border-t-0 ${selectionnable ? 'cursor-pointer hover:bg-muted/30' : ''}`}>
                                            <input
                                                type='checkbox'
                                                checked={x.c === 'ready'}
                                                disabled={!selectionnable || occupe}
                                                onChange={() => basculer(x.l.cle)}
                                                aria-label={t('bulletinPaie.envoyerA', { nom: x.l.nom })}
                                                className='h-4 w-4 accent-primary disabled:opacity-30'
                                            />
                                            <div className='min-w-0'>
                                                <p className='truncate text-sm font-semibold text-foreground'>{x.l.nom}</p>
                                                {x.l.bureau && <p className='truncate text-xs text-muted-foreground'>{x.l.bureau}</p>}
                                            </div>
                                            <ChampMail ligne={x.l} onEnregistre={onApercuChange} />
                                            <Pastille ton={TON_CATEGORIE[x.c]} title={x.c === 'fail' ? x.l.derniere_erreur || '' : undefined}>{libelleCategorie(x)}</Pastille>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <Pagination pg={pg} total={filtres.length} onPage={setPage} />
                        <div className='flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3'>
                            <p className='text-xs text-muted-foreground'>{t('bulletinPaie.envoiAide')}</p>
                            {boutonEnvoyer}
                        </div>
                    </div>
                )}
            </div>

            {/* Aperçu du VRAI mail (BulletinPaieMail, toujours en français) —
                volontairement non traduit : il montre ce que le salarié reçoit. */}
            <aside className='flex flex-1 basis-[320px] flex-col gap-3 rounded-xl border border-border bg-card p-4'>
                <h3 className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('bulletinPaie.apercuMailTitre')}</h3>
                <div className='flex flex-col gap-0.5 text-[13px]'>
                    <span className='text-muted-foreground'>{t('bulletinPaie.apercuDe')} <span className='font-medium text-foreground'>L’Administration — Hetep Iaout Services</span></span>
                    <span className='text-muted-foreground'>{t('bulletinPaie.apercuMailObjetLabel')} <span className='font-semibold text-foreground'>Bulletin de salaire — {periode}</span></span>
                </div>
                <div className='flex flex-col gap-3 rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-foreground'>
                    <p>Bonjour [Prénom],</p>
                    <p>Vous trouverez ci-joint votre bulletin de salaire du mois de {libelleMoisMinuscule(mois)}.</p>
                    <p>Je vous en souhaite bonne réception.</p>
                    <p>Bien cordialement,</p>
                    <p className='border-t border-border pt-2.5 text-[13px] font-semibold'>L’Administration — Hetep Iaout Services</p>
                </div>
                <div className='flex items-center gap-2.5 rounded-lg border border-border p-2.5'>
                    <span className='flex h-9 w-7 shrink-0 items-center justify-center rounded-md bg-red-50 text-[9px] font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300'>PDF</span>
                    <div className='min-w-0'>
                        <p className='truncate text-[13px] font-medium text-foreground'>Bulletin de salaire - {periode}.pdf</p>
                        <p className='text-xs text-muted-foreground'>{t('bulletinPaie.apercuMailPieceJointe')}</p>
                    </div>
                </div>
                <p className='text-xs text-muted-foreground'>{t('bulletinPaie.apercuPrenomRemplace')}</p>
            </aside>
        </section>
    );
}

export default OngletEnvoi;
