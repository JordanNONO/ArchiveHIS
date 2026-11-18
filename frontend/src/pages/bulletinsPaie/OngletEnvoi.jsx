import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuLoader, LuPaperclip } from 'react-icons/lu';
import { envoyerBulletinsPaie } from '../../api/routes/bulletinPaie';
import { libelleMois } from './analyseNomFichier';

const PASTILLE = {
    ok: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    err: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    mute: 'bg-muted text-muted-foreground',
};

function formatDateFr(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR');
}

/**
 * Onglet 2/3 — envoi par mail des bulletins déjà déposés. `apercu` vient du
 * conteneur (BulletinsPaie.jsx), partagé avec les tuiles chiffrées en haut de
 * page : un seul appel réseau pour l'état du mois, pas un par onglet.
 */
function OngletEnvoi({ mois, apercu, chargement, onApercuChange }) {
    const { t } = useTranslation();
    const [nonCoches, setNonCoches] = useState({});
    const [enCours, setEnCours] = useState(false);

    useEffect(() => { setNonCoches({}); }, [mois]);

    const lignesBrutes = apercu?.lignes || [];
    let selectionnables = 0;
    let coches = 0;
    const sendRows = lignesBrutes.map((l) => {
        const selectionnable = l.bulletin_trouve && !!l.mail && !l.deja_envoye;
        let tone = 'mute';
        let msg = t('bulletinPaie.ligneEnvoiNonDepose');
        if (l.deja_envoye) {
            tone = 'ok'; msg = t('bulletinPaie.ligneEnvoiEnvoyeLe', { date: formatDateFr(l.envoye_le) });
        } else if (!l.bulletin_trouve) {
            tone = 'mute'; msg = t('bulletinPaie.ligneEnvoiNonDepose');
        } else if (!l.mail) {
            tone = 'err'; msg = t('bulletinPaie.ligneEnvoiSansMail');
        } else if (l.dernier_statut === 'echec') {
            tone = 'err'; msg = t('bulletinPaie.ligneEnvoiEchec');
        } else {
            tone = 'info'; msg = t('bulletinPaie.ligneEnvoiPret');
        }
        const coche = selectionnable && !nonCoches[l.personnel_id];
        if (selectionnable) selectionnables += 1;
        if (coche) coches += 1;
        return { ...l, tone, msg, selectionnable, coche };
    });

    function toggle(personnelId) {
        setNonCoches((prev) => {
            const next = { ...prev };
            if (next[personnelId]) delete next[personnelId]; else next[personnelId] = true;
            return next;
        });
    }

    const toutCoche = selectionnables > 0 && coches === selectionnables;
    function toutBasculer() {
        setNonCoches((prev) => {
            const next = { ...prev };
            sendRows.forEach((l) => {
                if (!l.selectionnable) return;
                if (toutCoche) next[l.personnel_id] = true; else delete next[l.personnel_id];
            });
            return next;
        });
    }

    async function envoyer() {
        if (coches === 0 || enCours) return;
        setEnCours(true);
        const personnelIds = sendRows.filter((l) => l.coche).map((l) => l.personnel_id);
        const res = await envoyerBulletinsPaie(mois, personnelIds).catch(() => null);
        setEnCours(false);

        if (!res || res.status !== 202) {
            const data = (await res?.json().catch(() => ({}))) || {};
            toast.error(data?.error || t('commun.erreurGenerique'));
            return;
        }
        toast.success(t('bulletinPaie.envoisLances'));
        setNonCoches({});
        onApercuChange();
    }

    if (chargement && !apercu) {
        return <p className='text-sm text-muted-foreground'>{t('commun.chargement')}</p>;
    }

    const periodeLabel = libelleMois(mois);
    const restants = selectionnables - coches;

    return (
        <section className='flex flex-wrap items-start gap-4'>
            <div className='min-w-0 flex-[999_1_560px] overflow-hidden rounded-xl border border-border bg-card'>
                <div className='flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3'>
                    <h2 className='text-sm font-semibold text-foreground'>{t('bulletinPaie.destinatairesPeriode', { periode: periodeLabel })}</h2>
                    <button type='button' onClick={toutBasculer} disabled={selectionnables === 0} className='rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40'>
                        {toutCoche ? t('bulletinPaie.toutDeselectionner') : t('bulletinPaie.toutSelectionner')}
                    </button>
                </div>
                <div className='overflow-x-auto'>
                    <div className='min-w-[640px] divide-y divide-border/60'>
                        {sendRows.map((l) => (
                            <label key={l.personnel_id} className={`grid grid-cols-[28px_1.5fr_1.7fr_1.3fr] items-center gap-3.5 px-4 py-2.5 ${l.selectionnable ? 'cursor-pointer' : ''}`}>
                                <input
                                    type='checkbox'
                                    checked={l.coche}
                                    disabled={!l.selectionnable}
                                    onChange={() => toggle(l.personnel_id)}
                                    className='h-4 w-4 accent-primary disabled:opacity-40'
                                />
                                <div className='min-w-0'>
                                    <p className='truncate text-sm font-medium text-foreground'>{l.nom}</p>
                                    {l.bureau && <p className='truncate text-xs text-muted-foreground'>{l.bureau}</p>}
                                </div>
                                <div className='min-w-0'>
                                    <p className={`truncate text-sm ${l.mail ? 'text-foreground' : 'text-red-600 dark:text-red-400'}`}>{l.mail || t('bulletinPaie.ligneEnvoiSansMail')}</p>
                                    {l.nom_fichier_original && <p className='truncate text-xs text-muted-foreground' title={l.nom_fichier_original}>{l.nom_fichier_original}</p>}
                                </div>
                                <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${PASTILLE[l.tone]}`}>{l.msg}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className='flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3'>
                    <p className='text-xs text-muted-foreground'>
                        {t('bulletinPaie.envoiAide')}{restants > 0 ? ` ${t('bulletinPaie.envoiAidePretsNonCoches', { count: restants })}` : ''}
                    </p>
                    <button
                        type='button'
                        onClick={envoyer}
                        disabled={coches === 0 || enCours}
                        className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
                    >
                        {enCours && <LuLoader size={14} className='animate-spin' />}
                        {coches === 0 ? t('bulletinPaie.envoyerAucunSelectionne') : t('bulletinPaie.envoyerBouton', { count: coches })}
                    </button>
                </div>
            </div>

            <aside className='flex-1 basis-[300px] rounded-xl border border-border bg-card p-4'>
                <h3 className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('bulletinPaie.apercuMailTitre')}</h3>
                <div className='mt-3 flex flex-col gap-1'>
                    <span className='text-xs text-muted-foreground'>{t('bulletinPaie.apercuMailObjetLabel')}</span>
                    <span className='text-sm font-semibold text-foreground'>{t('bulletinPaie.apercuMailObjet', { periode: periodeLabel })}</span>
                </div>
                <div className='mt-3 flex flex-col gap-2.5 rounded-lg bg-muted/30 p-3.5 text-sm leading-relaxed text-foreground'>
                    <p>{t('bulletinPaie.apercuMailCorpsIntro')}</p>
                    <p>{t('bulletinPaie.apercuMailCorps', { periode: periodeLabel })}</p>
                </div>
                <div className='mt-3 flex items-center gap-2.5 rounded-lg border border-border p-2.5'>
                    <LuPaperclip size={16} className='shrink-0 text-muted-foreground' />
                    <span className='text-xs text-muted-foreground'>{t('bulletinPaie.apercuMailPieceJointe')}</span>
                </div>
            </aside>
        </section>
    );
}

export default OngletEnvoi;
