import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { getSuiviBulletinsPaie } from '../../api/routes/bulletinPaie';
import { cleMois, cleMoisCourant, libelleMois, libelleMoisCourt, normaliser } from './analyseNomFichier';
import { ChampRecherche, Pagination, paginer } from './ui';

const PAR_PAGE = 25;

// Couleur ET symbole : deux états ne se distinguent jamais par la couleur seule.
const ETATS = {
    envoye: { glyphe: '✓', classe: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' },
    depose: { glyphe: 'D', classe: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' },
    sansMail: { glyphe: '@', classe: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
    echec: { glyphe: '×', classe: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
    manquant: { glyphe: '!', classe: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
    aVenir: { glyphe: '', classe: 'bg-muted/60 text-muted-foreground' },
};

function etatCase(l, cle, courant) {
    if (cle > courant) return 'aVenir';
    if (!l) return 'manquant';
    if (l.deja_envoye) return 'envoye';
    if (!l.bulletin_trouve) return 'manquant';
    if (l.dernier_statut === 'echec') return 'echec';
    if (!l.a_un_mail) return 'sansMail';
    return 'depose';
}

/**
 * Onglet 3/3 — une année entière, salariés × 12 mois, en cases compactes
 * (~200 lignes : recherche, filtre "avec un manque" et pagination plutôt
 * qu'un long défilement). Un clic ouvre le mois : dépôt si le bulletin
 * manque, envoi sinon.
 */
function OngletSuivi({ onOuvrirMois }) {
    const { t } = useTranslation();
    const courant = cleMoisCourant();
    const [annee, setAnnee] = useState(Number(courant.slice(0, 4)));
    const [donnees, setDonnees] = useState(null);
    const [recherche, setRecherche] = useState('');
    const [seulementManques, setSeulementManques] = useState(false);
    const [page, setPage] = useState(0);

    useEffect(() => {
        setDonnees(null);
        const moisListe = Array.from({ length: 12 }, (_, i) => cleMois(annee, i));
        getSuiviBulletinsPaie(moisListe)
            .then((res) => (res.status === 200 ? res.json() : []))
            .then((data) => setDonnees(Array.isArray(data) ? data : []))
            .catch(() => setDonnees([]));
    }, [annee]);

    const libelleEtat = {
        envoye: t('bulletinPaie.legendeEnvoye'),
        depose: t('bulletinPaie.legendeDepose'),
        sansMail: t('bulletinPaie.legendeSansMail'),
        echec: t('bulletinPaie.legendeEchec'),
        manquant: t('bulletinPaie.legendeManquant'),
        aVenir: t('bulletinPaie.legendeAVenir'),
    };

    const moisListe = Array.from({ length: 12 }, (_, i) => cleMois(annee, i));
    const parMois = {};
    (donnees || []).forEach((bloc) => {
        const index = {};
        bloc.lignes.forEach((l) => { index[l.cle] = l; });
        parMois[bloc.mois] = index;
    });
    // Un nom seulement connu de la Fluctuation RH (ancien intervenant…)
    // n'apparaît que s'il a au moins un bulletin dans l'année affichée.
    const base = (donnees?.[0]?.lignes || []).filter((p) => p.personnel_id || moisListe.some((cle) => parMois[cle]?.[p.cle]?.bulletin_trouve));

    let nIncomplets = 0;
    const requete = normaliser(recherche.trim());
    const lignes = base
        .map((p) => {
            const etats = moisListe.map((cle) => etatCase(parMois[cle]?.[p.cle], cle, courant));
            const incomplet = etats.some((e) => e !== 'envoye' && e !== 'aVenir');
            if (incomplet) nIncomplets += 1;
            return { p, etats, incomplet };
        })
        .filter((x) => (!requete || normaliser(x.p.nom).includes(requete)) && (!seulementManques || x.incomplet));
    const pg = paginer(lignes.length, page, PAR_PAGE);

    const totauxEnvoyes = moisListe.map((cle) => (cle > courant ? null : Object.values(parMois[cle] || {}).filter((l) => l.deja_envoye).length));

    return (
        <section className='overflow-hidden rounded-xl border border-border bg-card'>
            <div className='flex flex-col gap-3 border-b border-border px-4 py-3'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex items-center gap-1'>
                        <button type='button' aria-label={t('bulletinPaie.anneePrecedente')} onClick={() => { setAnnee((a) => a - 1); setPage(0); }} className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted'>
                            <LuChevronLeft size={16} />
                        </button>
                        <span className='min-w-[64px] text-center text-base font-bold tabular-nums text-foreground'>{annee}</span>
                        <button type='button' aria-label={t('bulletinPaie.anneeSuivante')} onClick={() => { setAnnee((a) => a + 1); setPage(0); }} className='flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted'>
                            <LuChevronRight size={16} />
                        </button>
                    </div>
                    <div className='flex flex-wrap items-center gap-3'>
                        <ChampRecherche className='w-64' value={recherche} onChange={(v) => { setRecherche(v); setPage(0); }} placeholder={t('bulletinPaie.rechercherSalarie')} />
                        <label className='inline-flex cursor-pointer items-center gap-2 text-sm text-foreground'>
                            <input type='checkbox' checked={seulementManques} onChange={() => { setSeulementManques((v) => !v); setPage(0); }} className='h-4 w-4 accent-primary' />
                            {t('bulletinPaie.seulementManques', { count: nIncomplets })}
                        </label>
                    </div>
                </div>
                <div className='flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-foreground'>
                    {Object.keys(ETATS).map((e) => (
                        <span key={e} className='inline-flex items-center gap-1.5'>
                            <span className={`inline-flex h-5 w-6 items-center justify-center rounded text-[11px] font-bold ${ETATS[e].classe}`}>{ETATS[e].glyphe}</span>
                            {libelleEtat[e]}
                        </span>
                    ))}
                </div>
            </div>

            {donnees === null ? (
                <p className='px-4 py-8 text-sm text-muted-foreground'>{t('commun.chargement')}</p>
            ) : (
                <div className='overflow-x-auto'>
                    <div className='min-w-[840px]'>
                        <div className='grid grid-cols-[minmax(180px,220px)_repeat(12,minmax(32px,1fr))] gap-1 bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground'>
                            <span className='self-end font-semibold uppercase tracking-wide'>{t('bulletinPaie.colSalarie')}</span>
                            {moisListe.map((cle, i) => (
                                <span key={cle} className='flex flex-col items-center'>
                                    <span className='font-semibold uppercase'>{libelleMoisCourt(cle).split(' ')[0]}</span>
                                    <span className='tabular-nums' title={t('bulletinPaie.envoyesCeMois')}>{totauxEnvoyes[i] === null ? '—' : totauxEnvoyes[i]}</span>
                                </span>
                            ))}
                        </div>
                        {lignes.length === 0 && <p className='px-4 py-8 text-center text-sm text-muted-foreground'>{t('bulletinPaie.aucunSalarieCorrespond')}</p>}
                        {lignes.slice(pg.debut, pg.fin).map(({ p, etats }) => (
                            <div key={p.cle} className='grid grid-cols-[minmax(180px,220px)_repeat(12,minmax(32px,1fr))] items-center gap-1 border-t border-border/60 px-4 py-1.5'>
                                <div className='min-w-0'>
                                    <p className='truncate text-sm font-semibold text-foreground'>{p.nom}</p>
                                    {p.bureau && <p className='truncate text-xs text-muted-foreground'>{p.bureau}</p>}
                                </div>
                                {etats.map((e, i) => {
                                    const libelle = `${p.nom}, ${libelleMois(moisListe[i])} : ${libelleEtat[e]}`;
                                    return (
                                        <button
                                            key={moisListe[i]}
                                            type='button'
                                            disabled={e === 'aVenir'}
                                            onClick={() => onOuvrirMois(moisListe[i], e === 'manquant' ? 'depot' : 'envoi')}
                                            aria-label={libelle}
                                            title={libelle}
                                            className={`h-7 rounded-md text-xs font-bold transition-opacity enabled:hover:opacity-75 disabled:cursor-default ${ETATS[e].classe}`}
                                        >
                                            {ETATS[e].glyphe}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Pagination pg={pg} total={lignes.length} onPage={setPage} />
            <p className='border-t border-border px-4 py-2.5 text-xs text-muted-foreground'>{t('bulletinPaie.suiviAide')}</p>
        </section>
    );
}

export default OngletSuivi;
