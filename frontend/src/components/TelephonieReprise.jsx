import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowLeft, LuCheck, LuLoader, LuRefreshCw } from 'react-icons/lu';
import { getSalariesSansTelephone, createReprise } from '../api/routes/telephonie';
import { filtrerParRequete } from '../utils/recherche';
import { OPERATEURS, messageErreur } from './TelephonieForms';

/**
 * Reprise de l'existant : enregistrer d'un coup qui détient déjà quoi.
 *
 * C'est l'écran qui décide si le module sera utilisé : les téléphones sont
 * déjà sur le terrain, et exiger dix-huit IMEI pour démarrer, c'est s'assurer
 * que personne ne démarre. Un modèle et/ou un numéro suffisent ; chaque fiche
 * créée ici est marquée « à compléter » (voir TelephonieController::storeReprise).
 *
 * Saisie au clavier : Entrée enregistre la ligne et place le curseur sur la
 * suivante, pour enchaîner sans toucher la souris.
 */

const classeChamp = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30';

function TelephonieReprise({ modelesConnus = [], onRetour, onEnregistre }) {
    const { t } = useTranslation();
    const [donnees, setDonnees] = useState(null);
    const [erreurChargement, setErreurChargement] = useState(false);
    const [saisies, setSaisies] = useState({});
    const [enCours, setEnCours] = useState(null);
    const [erreursLigne, setErreursLigne] = useState({});
    const [faits, setFaits] = useState([]);
    const [recherche, setRecherche] = useState('');
    const [dernierOperateur, setDernierOperateur] = useState('');
    const champsModele = useRef({});

    function charger() {
        setErreurChargement(false);
        return getSalariesSansTelephone()
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
            .then(setDonnees)
            .catch(() => setErreurChargement(true));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { charger(); }, []);

    const restants = useMemo(() => filtrerParRequete(
        donnees?.restants || [],
        (p) => [`${p.nom} ${p.prenom}`],
        recherche,
    ), [donnees, recherche]);

    function saisie(id) {
        return saisies[id] || { modele: '', numero: '', operateur: dernierOperateur };
    }

    function maj(id, champ, valeur) {
        setSaisies((s) => ({ ...s, [id]: { ...saisie(id), [champ]: valeur } }));
        if (erreursLigne[id]) setErreursLigne((e) => ({ ...e, [id]: null }));
    }

    async function enregistrer(personne) {
        const s = saisie(personne.id);
        const modele = s.modele.trim();
        const numero = s.numero.trim();
        const operateur = s.operateur.trim();

        if (!modele && !numero) {
            setErreursLigne((e) => ({ ...e, [personne.id]: t('telephonie.repriseErreurVide') }));
            return;
        }
        if (numero && !operateur) {
            setErreursLigne((e) => ({ ...e, [personne.id]: t('telephonie.erreurOperateur') }));
            return;
        }

        setEnCours(personne.id);
        const res = await createReprise({
            personnel_id: personne.id,
            modele: modele || null,
            numero: numero || null,
            operateur: numero ? operateur : null,
        }).catch(() => null);
        setEnCours(null);

        if (!res?.ok) {
            const message = await messageErreur(res, t);
            setErreursLigne((e) => ({ ...e, [personne.id]: message }));
            return;
        }

        if (operateur) setDernierOperateur(operateur);

        // Passer à la personne suivante dans la liste affichée, avant de
        // retirer celle-ci.
        const index = restants.findIndex((p) => p.id === personne.id);
        const suivante = restants[index + 1] || restants[index - 1];

        setFaits((f) => [{ id: personne.id, nom: `${personne.nom} ${personne.prenom}`.trim(), modele, numero, operateur: numero ? operateur : '' }, ...f]);
        setDonnees((d) => ({
            ...d,
            restants: d.restants.filter((p) => p.id !== personne.id),
            enregistres: d.enregistres + 1,
        }));
        setSaisies((s) => { const copie = { ...s }; delete copie[personne.id]; return copie; });
        onEnregistre();

        if (suivante) setTimeout(() => champsModele.current[suivante.id]?.focus(), 0);
    }

    function surTouche(e, personne) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (enCours === null) enregistrer(personne);
        }
    }

    if (erreurChargement) {
        return (
            <div className='p-2'>
                <p className='text-sm text-destructive'>{t('telephonie.chargementEchoue')}</p>
                <button onClick={charger} className='mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted'>
                    <LuRefreshCw size={15} /> {t('telephonie.reessayer')}
                </button>
            </div>
        );
    }

    if (!donnees) {
        return <p className='p-2 text-sm text-muted-foreground'>{t('commun.chargement')}</p>;
    }

    const pourcentage = donnees.total ? Math.round((donnees.enregistres / donnees.total) * 100) : 0;

    return (
        <div className='flex flex-col gap-5'>

            <div>
                <button onClick={onRetour} className='inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline'>
                    <LuArrowLeft size={15} /> {t('telephonie.repriseTerminerPlusTard')}
                </button>
            </div>

            <section className='rounded-xl border border-border bg-card px-5 py-5'>
                <h2 className='text-base font-semibold text-foreground'>{t('telephonie.repriseTitre')}</h2>
                <p className='mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground'>{t('telephonie.repriseIntro')}</p>
                <div className='mt-4 flex flex-wrap items-center gap-3'>
                    <div
                        role='progressbar'
                        aria-valuemin={0}
                        aria-valuemax={donnees.total}
                        aria-valuenow={donnees.enregistres}
                        aria-label={t('telephonie.repriseAvancement', { faits: donnees.enregistres, total: donnees.total })}
                        className='h-2 w-full max-w-md overflow-hidden rounded-full bg-muted'
                    >
                        <div className='h-full rounded-full bg-primary transition-all' style={{ width: `${pourcentage}%` }} />
                    </div>
                    <span className='text-sm font-medium tabular-nums text-foreground'>{t('telephonie.repriseAvancement', { faits: donnees.enregistres, total: donnees.total })}</span>
                </div>
            </section>

            <section className='overflow-hidden rounded-xl border border-border bg-card'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4'>
                    <div>
                        <h2 className='text-sm font-semibold text-foreground'>
                            {t('telephonie.repriseSansTelephone')} <span className='font-normal text-muted-foreground'>— {t('telephonie.repriseRestants', { count: donnees.restants.length })}</span>
                        </h2>
                        <p className='mt-0.5 text-xs text-muted-foreground'>{t('telephonie.repriseAideClavier')}</p>
                    </div>
                    <label htmlFor='recherche-reprise' className='sr-only'>{t('telephonie.repriseRechercher')}</label>
                    <input
                        id='recherche-reprise'
                        type='search'
                        value={recherche}
                        onChange={(e) => setRecherche(e.target.value)}
                        placeholder={t('telephonie.repriseRechercher')}
                        className='h-10 w-64 max-w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground'
                    />
                </div>

                <datalist id='reprise-modeles'>
                    {modelesConnus.map((m) => <option key={m} value={m} />)}
                </datalist>
                <datalist id='reprise-operateurs'>
                    {OPERATEURS.map((o) => <option key={o} value={o} />)}
                </datalist>

                {restants.length === 0 ? (
                    <p className='px-4 py-10 text-center text-sm text-muted-foreground'>
                        {recherche ? t('telephonie.aucunResultat') : t('telephonie.repriseTerminee')}
                    </p>
                ) : (
                    <div className='overflow-x-auto'>
                        <table className='w-full min-w-[760px] border-collapse'>
                            <thead className='bg-muted/40'>
                                <tr>
                                    <th scope='col' className='border-b border-border px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('telephonie.colSalarie')}</th>
                                    <th scope='col' className='border-b border-border px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('telephonie.repriseColModele')}</th>
                                    <th scope='col' className='border-b border-border px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('telephonie.repriseColNumero')}</th>
                                    <th scope='col' className='border-b border-border px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('telephonie.colOperateur')}</th>
                                    <th scope='col' className='border-b border-border px-4 py-2.5'><span className='sr-only'>{t('telephonie.colAction')}</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {restants.map((p) => {
                                    const s = saisie(p.id);
                                    const nom = `${p.nom} ${p.prenom}`.trim();
                                    const erreur = erreursLigne[p.id];
                                    return (
                                        <React.Fragment key={p.id}>
                                            <tr className='odd:bg-background even:bg-muted/10'>
                                                <td className={`px-4 py-2.5 text-sm font-medium text-foreground ${erreur ? '' : 'border-b border-border/60'}`}>{nom}</td>
                                                <td className={`px-4 py-2.5 ${erreur ? '' : 'border-b border-border/60'}`}>
                                                    <input
                                                        ref={(el) => { champsModele.current[p.id] = el; }}
                                                        list='reprise-modeles'
                                                        value={s.modele}
                                                        onChange={(e) => maj(p.id, 'modele', e.target.value)}
                                                        onKeyDown={(e) => surTouche(e, p)}
                                                        aria-label={t('telephonie.repriseAriaModele', { nom })}
                                                        placeholder={t('telephonie.placeholderChoisirOuSaisir')}
                                                        className={classeChamp}
                                                    />
                                                </td>
                                                <td className={`px-4 py-2.5 ${erreur ? '' : 'border-b border-border/60'}`}>
                                                    <input
                                                        type='tel'
                                                        value={s.numero}
                                                        onChange={(e) => maj(p.id, 'numero', e.target.value)}
                                                        onKeyDown={(e) => surTouche(e, p)}
                                                        aria-label={t('telephonie.repriseAriaNumero', { nom })}
                                                        placeholder='06 …'
                                                        className={`${classeChamp} tabular-nums`}
                                                    />
                                                </td>
                                                <td className={`px-4 py-2.5 ${erreur ? '' : 'border-b border-border/60'}`}>
                                                    <input
                                                        list='reprise-operateurs'
                                                        value={s.operateur}
                                                        onChange={(e) => maj(p.id, 'operateur', e.target.value)}
                                                        onKeyDown={(e) => surTouche(e, p)}
                                                        aria-label={t('telephonie.repriseAriaOperateur', { nom })}
                                                        placeholder={t('telephonie.colOperateur')}
                                                        className={classeChamp}
                                                    />
                                                </td>
                                                <td className={`px-4 py-2.5 text-right ${erreur ? '' : 'border-b border-border/60'}`}>
                                                    <button
                                                        type='button'
                                                        onClick={() => enregistrer(p)}
                                                        disabled={enCours !== null}
                                                        className='inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-primary transition-colors hover:bg-muted disabled:opacity-60'
                                                    >
                                                        {enCours === p.id && <LuLoader size={14} className='animate-spin' />}
                                                        {t('telephonie.enregistrer')}
                                                    </button>
                                                </td>
                                            </tr>
                                            {erreur && (
                                                <tr>
                                                    <td colSpan={5} className='border-b border-border/60 px-4 pb-2.5 text-xs text-destructive'>{erreur}</td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {faits.length > 0 && (
                <section className='overflow-hidden rounded-xl border border-border bg-card'>
                    <h2 className='border-b border-border px-5 py-4 text-sm font-semibold text-foreground'>{t('telephonie.repriseFaits', { count: faits.length })}</h2>
                    <ul className='divide-y divide-border/60'>
                        {faits.map((f) => (
                            <li key={f.id} className='flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm'>
                                <span className='min-w-[180px] font-medium text-foreground'>{f.nom}</span>
                                <span className='flex-grow text-muted-foreground'>{[f.modele, f.numero, f.operateur].filter(Boolean).join(' · ')}</span>
                                <span className='rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200'>{t('telephonie.aCompleter')}</span>
                                <span className='inline-flex items-center gap-1 text-green-700 dark:text-green-400'><LuCheck size={14} /> {t('telephonie.repriseEnregistre')}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <p className='text-xs text-muted-foreground'>{t('telephonie.repriseNoteDecharge')}</p>
        </div>
    );
}

export default TelephonieReprise;
