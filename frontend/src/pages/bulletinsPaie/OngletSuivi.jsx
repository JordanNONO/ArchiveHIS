import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSuiviBulletinsPaie } from '../../api/routes/bulletinPaie';
import { cleMoisCourant, decalerCle, libelleMois, libelleMoisCourt } from './analyseNomFichier';

const STATUT_STYLE = {
    envoye: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    depose: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    manquant: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

/**
 * Onglet 3/3 — grille salariés × 6 derniers mois, pour repérer d'un coup
 * d'œil qui est à jour et qui ne l'est pas. Toujours les 6 derniers mois
 * civils (indépendant de la période choisie dans les onglets Dépôt/Envoi) :
 * c'est une vue d'ensemble, pas un filtre.
 */
function OngletSuivi({ onOuvrirMois }) {
    const { t } = useTranslation();
    const [parMois, setParMois] = useState(null);

    useEffect(() => {
        const moisListe = [];
        for (let i = 5; i >= 0; i--) moisListe.push(decalerCle(cleMoisCourant(), -i));
        getSuiviBulletinsPaie(moisListe)
            .then((res) => (res.status === 200 ? res.json() : []))
            .then(setParMois)
            .catch(() => setParMois([]));
    }, []);

    if (parMois === null) {
        return <p className='text-sm text-muted-foreground'>{t('commun.chargement')}</p>;
    }

    const moisListe = parMois.map((bloc) => bloc.mois);
    const parPersonnel = new Map();
    parMois.forEach((bloc) => {
        bloc.lignes.forEach((l) => {
            if (!parPersonnel.has(l.personnel_id)) parPersonnel.set(l.personnel_id, { nom: l.nom, etats: {} });
            parPersonnel.get(l.personnel_id).etats[bloc.mois] = { depose: l.bulletin_trouve, envoye: l.deja_envoye };
        });
    });
    const lignes = Array.from(parPersonnel.entries())
        .map(([personnelId, v]) => ({ personnelId, nom: v.nom, etats: v.etats }))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

    function statutDe(ligne, moisCle) {
        const e = ligne.etats[moisCle];
        if (e?.envoye) return 'envoye';
        if (e?.depose) return 'depose';
        return 'manquant';
    }

    return (
        <section className='overflow-hidden rounded-xl border border-border bg-card'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3'>
                <h2 className='text-sm font-semibold text-foreground'>{t('bulletinPaie.suiviTitre')}</h2>
                <div className='flex flex-wrap gap-2 text-xs'>
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${STATUT_STYLE.envoye}`}>{t('bulletinPaie.legendeEnvoye')}</span>
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${STATUT_STYLE.depose}`}>{t('bulletinPaie.legendeDepose')}</span>
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${STATUT_STYLE.manquant}`}>{t('bulletinPaie.legendeManquant')}</span>
                </div>
            </div>
            <div className='overflow-x-auto'>
                <div className='min-w-[720px]'>
                    <div className='grid grid-cols-[1.6fr_repeat(6,minmax(0,1fr))] gap-2 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
                        <span>{t('bulletinPaie.colSalarie')}</span>
                        {moisListe.map((m) => <span key={m} className='text-center'>{libelleMoisCourt(m)}</span>)}
                    </div>
                    {lignes.length === 0 && (
                        <p className='px-4 py-6 text-center text-sm text-muted-foreground'>{t('bulletinPaie.suiviAucuneDonnee')}</p>
                    )}
                    {lignes.map((l) => (
                        <div key={l.personnelId} className='grid grid-cols-[1.6fr_repeat(6,minmax(0,1fr))] items-center gap-2 border-t border-border/60 px-4 py-2'>
                            <span className='truncate text-sm font-medium text-foreground'>{l.nom}</span>
                            {moisListe.map((m) => {
                                const statut = statutDe(l, m);
                                return (
                                    <button
                                        key={m}
                                        type='button'
                                        onClick={() => onOuvrirMois(m, statut === 'manquant' ? 'depot' : 'envoi')}
                                        aria-label={`${l.nom}, ${libelleMois(m)} : ${t(`bulletinPaie.legende${statut.charAt(0).toUpperCase()}${statut.slice(1)}`)}`}
                                        className={`rounded-lg px-2 py-1.5 text-center text-xs font-semibold transition-opacity hover:opacity-80 ${STATUT_STYLE[statut]}`}
                                    >
                                        {t(`bulletinPaie.legende${statut.charAt(0).toUpperCase()}${statut.slice(1)}`)}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            <div className='border-t border-border px-4 py-2.5 text-xs text-muted-foreground'>{t('bulletinPaie.suiviAide')}</div>
        </section>
    );
}

export default OngletSuivi;
