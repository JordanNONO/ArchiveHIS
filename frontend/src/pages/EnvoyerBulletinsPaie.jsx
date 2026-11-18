import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuArrowLeft, LuLoader, LuCheck, LuAlertCircle, LuClock, LuRefreshCw, LuShieldAlert } from 'react-icons/lu';
import MenuDeroulant from '../components/MenuDeroulant';
import { getApercuEnvoiBulletinsPaie, envoyerBulletinsPaie, getEnvoisBulletinsPaie } from '../api/routes/bulletinPaie';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Envoi par mail des bulletins d'un mois — réservé aux administrateurs.
 * Rien ne part sans cet écran : un mail envoyé ne se rattrape pas. Les
 * destinataires exclus (pas de bulletin déposé, pas d'adresse mail
 * enregistrée) sont listés avec leur raison, jamais juste omis en silence.
 */

/** Les 24 derniers mois (y compris le courant), les plus récents en premier. */
function moisDisponibles() {
    const options = [];
    const base = new Date();
    for (let i = 0; i < 24; i++) {
        const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
        const valeur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const libelle = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        options.push({ value: valeur, label: libelle.charAt(0).toUpperCase() + libelle.slice(1) });
    }
    return options;
}

function Tuile({ libelle, valeur, couleur }) {
    return (
        <section className='rounded-xl border border-border bg-card px-4 py-3.5'>
            <h2 className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{libelle}</h2>
            <p className={`mt-1.5 text-2xl font-bold leading-none tabular-nums ${couleur}`}>{valeur}</p>
        </section>
    );
}

function EnvoyerBulletinsPaie() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isAdministrator } = usePermissions();
    const optionsMois = useMemo(() => moisDisponibles(), []);
    const [mois, setMois] = useState(optionsMois[0]?.value || '');
    const [apercu, setApercu] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [envoiEnCours, setEnvoiEnCours] = useState(false);
    const [envois, setEnvois] = useState(null);

    function chargerApercu() {
        setChargement(true);
        return getApercuEnvoiBulletinsPaie(mois)
            .then((res) => (res.status === 200 ? res.json() : Promise.reject(new Error(String(res.status)))))
            .then(setApercu)
            .catch(() => toast.error(t('bulletinPaie.chargementApercuEchoue')))
            .finally(() => setChargement(false));
    }

    function chargerEnvois() {
        return getEnvoisBulletinsPaie(mois)
            .then((res) => (res.status === 200 ? res.json() : []))
            .then(setEnvois)
            .catch(() => {});
    }

    useEffect(() => {
        // Le vrai verrou est côté serveur (middleware 'admin') — on évite
        // juste ici une salve de requêtes vouées à l'échec pour qui n'a pas
        // le droit, avant même d'atteindre l'écran "réservé" plus bas.
        if (!isAdministrator) { setChargement(false); return; }
        setEnvois(null);
        chargerApercu();
        chargerEnvois();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mois, isAdministrator]);

    async function envoyer() {
        if (!apercu?.recevront) return;
        setEnvoiEnCours(true);
        const res = await envoyerBulletinsPaie(mois).catch(() => null);
        setEnvoiEnCours(false);

        if (!res || res.status !== 202) {
            const data = await res?.json().catch(() => ({})) || {};
            toast.error(data?.error || t('commun.erreurGenerique'));
            return;
        }
        toast.success(t('bulletinPaie.envoisLances'));
        chargerApercu();
        chargerEnvois();
    }

    const lignesEnAttente = apercu ? [
        ...apercu.lignes.filter((l) => l.sera_envoye),
        ...apercu.lignes.filter((l) => !l.sera_envoye),
    ] : [];

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
                <button onClick={() => navigate(-1)} className='mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline'>
                    <LuArrowLeft size={13} /> {t('bulletinPaie.retourDossier')}
                </button>
                <div className='flex flex-wrap items-end justify-between gap-4'>
                    <div>
                        <h1 className='text-xl font-semibold tracking-tight text-foreground'>{t('bulletinPaie.envoyerTitre')}</h1>
                        <p className='mt-1 max-w-xl text-sm text-muted-foreground'>{t('bulletinPaie.envoyerSousTitre')}</p>
                    </div>
                    <div>
                        <label htmlFor='mois-envoi' className='mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('bulletinPaie.moisConcerne')}</label>
                        <MenuDeroulant className='w-[220px]' boutonClassName='w-full' options={optionsMois} value={mois} onChange={setMois} />
                    </div>
                </div>
            </header>

            <div className='flex-grow bg-background px-6 pb-10 pt-5'>
                <div className='mx-auto flex max-w-[1040px] flex-col gap-4'>

                    {chargement && !apercu ? (
                        <p className='text-sm text-muted-foreground'>{t('commun.chargement')}</p>
                    ) : apercu && (
                        <>
                            <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-3'>
                                <Tuile libelle={t('bulletinPaie.tuileRecevront')} valeur={apercu.recevront} couleur='text-green-700 dark:text-green-400' />
                                <Tuile libelle={t('bulletinPaie.tuileSansBulletin')} valeur={apercu.sans_bulletin} couleur='text-amber-700 dark:text-amber-400' />
                                <Tuile libelle={t('bulletinPaie.tuileSansMail')} valeur={apercu.sans_mail} couleur='text-red-700 dark:text-red-400' />
                            </div>

                            <section className='overflow-hidden rounded-xl border border-border bg-card'>
                                <div className='border-b border-border px-4 py-3'>
                                    <h2 className='text-sm font-semibold text-foreground'>{t('bulletinPaie.verifierAvantEnvoi')}</h2>
                                </div>
                                <div className='overflow-x-auto'>
                                    <table className='w-full border-collapse'>
                                        <thead>
                                            <tr className='bg-muted/40'>
                                                <th scope='col' className='border-b border-border px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('bulletinPaie.colSalarie')}</th>
                                                <th scope='col' className='border-b border-border px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('bulletinPaie.colMail')}</th>
                                                <th scope='col' className='border-b border-border px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('bulletinPaie.colSeraEnvoye')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lignesEnAttente.map((l) => (
                                                <tr key={l.personnel_id} className={`odd:bg-background even:bg-muted/10 ${!l.sera_envoye ? 'bg-amber-500/[0.04]' : ''}`}>
                                                    <td className='border-b border-border/60 px-4 py-2.5 text-sm font-medium text-foreground'>{l.nom}</td>
                                                    <td className='border-b border-border/60 px-4 py-2.5 text-sm text-muted-foreground'>{l.mail || '—'}</td>
                                                    <td className='border-b border-border/60 px-4 py-2.5 text-sm'>
                                                        {l.sera_envoye ? (
                                                            <span className='inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200'>{t('bulletinPaie.oui')}</span>
                                                        ) : (
                                                            <span className='inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300'>
                                                                <LuAlertCircle size={12} />
                                                                {l.raison_exclusion === 'pas_de_mail' ? t('bulletinPaie.raisonPasDeMail') : t('bulletinPaie.raisonPasDeBulletin')}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className='flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3'>
                                    <p className='text-xs text-muted-foreground'>{t('bulletinPaie.totalAffiche', { count: apercu.total })}</p>
                                    <button
                                        type='button'
                                        onClick={envoyer}
                                        disabled={!apercu.recevront || envoiEnCours}
                                        className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
                                    >
                                        {envoiEnCours && <LuLoader size={14} className='animate-spin' />}
                                        {t('bulletinPaie.envoyerBouton', { count: apercu.recevront })}
                                    </button>
                                </div>
                            </section>

                            {envois && envois.length > 0 && (
                                <section className='overflow-hidden rounded-xl border border-border bg-card'>
                                    <div className='flex items-center justify-between border-b border-border px-4 py-3'>
                                        <h2 className='text-sm font-semibold text-foreground'>{t('bulletinPaie.suiviEnvois')}</h2>
                                        <button type='button' onClick={chargerEnvois} className='inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground'>
                                            <LuRefreshCw size={12} /> {t('bulletinPaie.actualiser')}
                                        </button>
                                    </div>
                                    <ul className='divide-y divide-border/60'>
                                        {envois.map((e) => (
                                            <li key={e.id} className='flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm'>
                                                <span className='min-w-[160px] font-medium text-foreground'>{e.personnel ? `${e.personnel.nom} ${e.personnel.prenom}` : '—'}</span>
                                                <span className='flex-grow text-xs text-muted-foreground'>{e.mail_utilise}</span>
                                                {e.statut === 'envoye' && <span className='inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400'><LuCheck size={13} /> {t('bulletinPaie.statutEnvoye')}</span>}
                                                {e.statut === 'en_attente' && <span className='inline-flex items-center gap-1 text-xs font-medium text-muted-foreground'><LuClock size={13} /> {t('bulletinPaie.statutEnAttente')}</span>}
                                                {e.statut === 'echec' && <span title={e.erreur || ''} className='inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400'><LuAlertCircle size={13} /> {t('bulletinPaie.statutEchec')}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default EnvoyerBulletinsPaie;
