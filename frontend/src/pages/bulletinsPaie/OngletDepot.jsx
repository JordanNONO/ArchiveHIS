import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import { LuUploadCloud, LuX, LuLoader, LuCalendarDays, LuChevronLeft, LuChevronRight, LuFolderPlus } from 'react-icons/lu';
import { deposerBulletinsPaie, getApercuEnvoiBulletinsPaie } from '../../api/routes/bulletinPaie';
import { analyserNomFichier, cleDuNom, decalerCle, libelleMois, normaliser } from './analyseNomFichier';
import { ChampRecherche, Pagination, Pastille, Puce, paginer } from './ui';
import { useConfirmerDepart } from '../../contexts/GardeDepartContext';

// PHP refuse par défaut plus de 20 fichiers par requête (max_file_uploads) :
// au-delà, les fichiers en trop disparaîtraient sans erreur. On envoie donc
// par paquets, ce qui permet aussi d'afficher une progression.
const TAILLE_PAQUET = 10;
const PAR_PAGE = 20;
const ORDRE_TON = { err: 0, warn: 1, info: 2, ok: 2 };

/**
 * Onglet 1/3 — dépôt groupé (prévu pour ~200 bulletins d'un coup). Le
 * salarié et le mois sont lus dans le nom du fichier (analyseNomFichier.js),
 * comparés à TOUS les salariés connus — comptes, dossiers existants,
 * Fluctuation RH (SalariesPaie côté serveur) — avec une règle stricte : un
 * bulletin n'est attribué d'office que si le nom complet correspond.
 *
 * Un salarié connu nulle part peut être rangé sous le nom écrit dans son
 * fichier (un dossier est alors créé) : ligne par ligne ou pour tous les non
 * reconnus d'un coup, après confirmation.
 */
function OngletDepot({ mois, onMoisChange, salaries, onRange }) {
    const { t } = useTranslation();
    // { id, file, cle, nouveauNom, confiance, candidats, nomDuFichier, moisCle, moisDetecteDuNom, confirme }
    const [fichiers, setFichiers] = useState([]);
    const [banniere, setBanniere] = useState('');
    const [existants, setExistants] = useState({}); // { [moisCle]: Set<cle> }
    const [filtre, setFiltre] = useState('traiter');
    const [recherche, setRecherche] = useState('');
    const [page, setPage] = useState(0);
    const [edition, setEdition] = useState('');
    const [rechercheSalarie, setRechercheSalarie] = useState('');
    const [rangement, setRangement] = useState(null); // { fait, total }
    const [confirmerCreation, setConfirmerCreation] = useState(false);

    // Quitter la page avec des fichiers déposés mais pas encore rangés (ou
    // pendant le rangement) les perdrait sans prévenir.
    useConfirmerDepart(fichiers.length > 0, {
        titre: t('bulletinPaie.quitterSansRangerTitre'),
        message: t('bulletinPaie.quitterSansRangerTexte', { count: fichiers.length }),
    });

    useEffect(() => {
        const manquantes = Array.from(new Set(fichiers.map((f) => f.moisCle))).filter((c) => c && !(c in existants));
        manquantes.forEach((c) => {
            getApercuEnvoiBulletinsPaie(c)
                .then((res) => (res.status === 200 ? res.json() : null))
                .then((data) => {
                    if (!data) return;
                    setExistants((prev) => ({ ...prev, [c]: new Set(data.lignes.filter((l) => l.bulletin_trouve).map((l) => l.cle)) }));
                })
                .catch(() => {});
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fichiers]);

    const parCle = {};
    salaries.forEach((s) => { parCle[s.cle] = s; });

    function onDrop(acceptes) {
        if (!acceptes.length || rangement) return;
        const analyses = acceptes.map((file) => ({ file, ...analyserNomFichier(file.name, salaries, Number(mois.slice(0, 4))) }));

        const comptage = {};
        analyses.forEach((a) => { if (a.moisDetecteDuNom) comptage[a.moisCle] = (comptage[a.moisCle] || 0) + 1; });
        const cles = Object.keys(comptage).sort((a, b) => comptage[b] - comptage[a]);

        let periode = mois;
        if (cles.length) {
            periode = cles[0];
            const params = { mois: libelleMois(periode), n: comptage[periode], total: analyses.length };
            setBanniere(periode !== mois ? t('bulletinPaie.moisDetecteDifferent', params) : t('bulletinPaie.moisDetecteIdentique', params));
            if (periode !== mois) onMoisChange(periode);
        } else {
            setBanniere(t('bulletinPaie.aucunMoisDetecte', { mois: libelleMois(mois) }));
        }

        setFichiers((prev) => [...prev, ...analyses.map((a) => ({
            id: `${a.file.name}-${a.file.lastModified}-${Math.random()}`,
            file: a.file,
            cle: a.cle,
            nouveauNom: '',
            confiance: a.confiance,
            candidats: a.candidats,
            nomDuFichier: a.nomDuFichier,
            moisCle: a.moisCle || periode,
            moisDetecteDuNom: a.moisDetecteDuNom,
            confirme: false,
        }))]);
        setFiltre('traiter');
        setPage(0);
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] }, multiple: true, disabled: !!rangement });

    function maj(id, champs) {
        setFichiers((prev) => prev.map((f) => (f.id === id ? { ...f, ...champs } : f)));
    }

    // Une même clé pour un salarié connu et pour un nouveau nom : « Jean
    // AWASSI » tapé à la main retombe sur le dossier « AWASSI Jean ».
    const cleCible = (f) => f.cle || (f.nouveauNom ? cleDuNom(f.nouveauNom) : '');

    // ---- Statut de chaque fichier
    const doublons = {};
    fichiers.forEach((f) => {
        const c = cleCible(f);
        if (c) doublons[`${c}|${f.moisCle}`] = (doublons[`${c}|${f.moisCle}`] || 0) + 1;
    });
    const analyses = fichiers.map((f, idx) => {
        const c = cleCible(f);
        let ton = 'ok';
        let message = t('bulletinPaie.ligneStatutPret');
        if (!c) {
            ton = 'err'; message = t('bulletinPaie.ligneStatutNonReconnu');
        } else if (doublons[`${c}|${f.moisCle}`] > 1) {
            ton = 'err'; message = t('bulletinPaie.ligneStatutDoublon');
        } else if (!f.confirme && f.confiance === 'ambigu') {
            ton = 'warn'; message = t('bulletinPaie.ligneStatutAmbigu');
        } else if (!f.confirme && !f.moisDetecteDuNom) {
            ton = 'warn'; message = t('bulletinPaie.ligneStatutMoisAbsent', { mois: libelleMois(f.moisCle) });
        } else if (!f.confirme && existants[f.moisCle]?.has(c)) {
            ton = 'warn'; message = t('bulletinPaie.ligneStatutRemplace');
        } else if (!f.confirme && f.moisCle !== mois) {
            ton = 'warn'; message = t('bulletinPaie.ligneStatutAutreMois', { mois: libelleMois(f.moisCle) });
        } else if (f.nouveauNom) {
            ton = 'info'; message = t('bulletinPaie.ligneStatutNouveauDossier');
        }
        return { f, idx, ton, message, salarie: parCle[f.cle] };
    });
    const nErr = analyses.filter((a) => a.ton === 'err').length;
    const nWarn = analyses.filter((a) => a.ton === 'warn').length;
    const nOk = analyses.length - nErr - nWarn;
    const pretsLigne = (a) => a.ton === 'ok' || a.ton === 'info';
    const nonReconnus = fichiers.filter((f) => !f.cle && !f.nouveauNom && f.nomDuFichier);

    const requete = normaliser(recherche.trim());
    const visibles = analyses
        .filter((a) => {
            if (filtre === 'traiter' && pretsLigne(a)) return false;
            if (filtre === 'err' && a.ton !== 'err') return false;
            if (filtre === 'warn' && a.ton !== 'warn') return false;
            if (filtre === 'ok' && !pretsLigne(a)) return false;
            if (requete && !normaliser(`${a.f.file.name} ${a.salarie?.nom || a.f.nouveauNom}`).includes(requete)) return false;
            return true;
        })
        .sort((a, b) => (ORDRE_TON[a.ton] - ORDRE_TON[b.ton]) || (a.idx - b.idx));
    const pg = paginer(visibles.length, page, PAR_PAGE);

    function optionsSalarie(f) {
        const q = normaliser(rechercheSalarie.trim());
        const liste = q
            ? salaries.filter((s) => normaliser(s.nom).includes(q))
            : f.candidats.map((c) => parCle[c]).filter(Boolean);
        const nouveau = rechercheSalarie.trim() || f.nomDuFichier;
        // Pas de « créer » si ce nom existe déjà : on choisirait l'existant.
        const nouveauExiste = !nouveau || salaries.some((s) => s.cle === cleDuNom(nouveau));
        return { liste: liste.slice(0, 8), reste: Math.max(0, liste.length - 8), suggestions: !q, nouveau: nouveauExiste ? '' : nouveau };
    }

    function sousTitre(a) {
        if (a.salarie) return a.salarie.personnel_id ? (a.salarie.bureau || t('bulletinPaie.avecCompte')) : t('bulletinPaie.sansCompte');
        if (a.f.nouveauNom) return t('bulletinPaie.nouveauDossier');
        return t('bulletinPaie.aChoisir');
    }

    async function ranger() {
        const prets = analyses.filter(pretsLigne);
        if (!prets.length || rangement) return;
        setRangement({ fait: 0, total: prets.length });

        const ranges = new Set();
        let echecs = 0;
        let erreurGlobale = '';
        for (let i = 0; i < prets.length; i += TAILLE_PAQUET) {
            const paquet = prets.slice(i, i + TAILLE_PAQUET);
            const assignations = paquet.map((a, index) => ({
                index,
                personnel_id: a.salarie?.personnel_id || null,
                nom: a.salarie ? a.salarie.nom : a.f.nouveauNom,
                mois: a.f.moisCle,
            }));
            const res = await deposerBulletinsPaie(paquet.map((a) => a.f.file), assignations).catch(() => null);
            const data = res ? await res.json().catch(() => ({})) : {};
            if (!res || !Array.isArray(data.resultats)) {
                erreurGlobale = data?.error || t('commun.erreurGenerique');
                break;
            }
            for (const r of data.resultats) {
                const a = paquet[Number(r.index)];
                if (a && r.ok) ranges.add(a.f.id);
                else if (a) echecs += 1;
            }
            setRangement({ fait: Math.min(prets.length, i + paquet.length), total: prets.length });
        }

        setRangement(null);
        const restants = fichiers.length - ranges.size;
        setFichiers((prev) => prev.filter((f) => !ranges.has(f.id)));
        setExistants({});
        setPage(0);
        setEdition('');
        if (!restants) setBanniere('');
        if (ranges.size) onRange(ranges.size, restants);
        if (echecs) toast.error(t('bulletinPaie.rangementEchecs', { count: echecs }));
        if (erreurGlobale) toast.error(erreurGlobale);
    }

    function creerPourNonReconnus() {
        const ids = new Set(nonReconnus.map((f) => f.id));
        setFichiers((prev) => prev.map((f) => (ids.has(f.id) ? { ...f, nouveauNom: f.nomDuFichier } : f)));
        setConfirmerCreation(false);
    }

    const puces = [
        ['traiter', t('bulletinPaie.filtreATraiter'), nErr + nWarn],
        ['err', t('bulletinPaie.filtreBloquants'), nErr],
        ['warn', t('bulletinPaie.filtreAVerifier'), nWarn],
        ['ok', t('bulletinPaie.filtrePrets'), nOk],
        ['tous', t('bulletinPaie.filtreTous'), fichiers.length],
    ];

    return (
        <section className='flex flex-col gap-4'>
            <div
                {...getRootProps()}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed text-center transition-colors ${fichiers.length ? 'p-4' : 'p-8'} ${isDragActive ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
            >
                <input {...getInputProps()} />
                <span className='flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                    <LuUploadCloud size={22} />
                </span>
                <p className='text-[15px] font-semibold text-foreground'>{fichiers.length ? t('bulletinPaie.depotZoneAjouter') : t('bulletinPaie.depotZoneTitre')}</p>
                {!fichiers.length && <p className='max-w-xl text-sm text-muted-foreground'>{t('bulletinPaie.depotZoneSousTitre')}</p>}
            </div>

            {banniere && (
                <div role='status' className='flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200'>
                    <LuCalendarDays size={17} className='mt-0.5 shrink-0' />
                    <span>{banniere}</span>
                </div>
            )}

            {nonReconnus.length > 0 && !rangement && (
                <div className='flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <span className='max-w-2xl'>{t('bulletinPaie.nonReconnusExplication', { count: nonReconnus.length })}</span>
                        {!confirmerCreation && (
                            <button type='button' onClick={() => setConfirmerCreation(true)} className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary/90'>
                                <LuFolderPlus size={15} /> {t('bulletinPaie.creerDossiersNonReconnus', { count: nonReconnus.length })}
                            </button>
                        )}
                    </div>
                    {confirmerCreation && (
                        <div role='alertdialog' aria-label={t('bulletinPaie.creerDossiersNonReconnus', { count: nonReconnus.length })} className='flex flex-col gap-2.5 rounded-lg border border-amber-300 bg-card p-3 text-foreground dark:border-amber-800'>
                            <p className='font-semibold'>{t('bulletinPaie.creerDossiersConfirmation', { count: nonReconnus.length })}</p>
                            <div className='flex flex-wrap gap-1.5'>
                                {nonReconnus.slice(0, 12).map((f) => (
                                    <span key={f.id} className='rounded-full bg-muted px-2.5 py-1 text-xs'>{f.nomDuFichier}</span>
                                ))}
                                {nonReconnus.length > 12 && <span className='px-1 py-1 text-xs text-muted-foreground'>{t('bulletinPaie.etNAutresSimple', { count: nonReconnus.length - 12 })}</span>}
                            </div>
                            <div className='flex flex-wrap gap-2'>
                                <button type='button' onClick={creerPourNonReconnus} className='rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary/90'>{t('bulletinPaie.creerDossiersOui')}</button>
                                <button type='button' onClick={() => setConfirmerCreation(false)} className='rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted'>{t('bulletinPaie.annuler')}</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {fichiers.length > 0 && (
                <section className='overflow-hidden rounded-xl border border-border bg-card'>
                    <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3'>
                        <div className='flex flex-wrap gap-1.5'>
                            {puces.map(([cle, libelle, n]) => (
                                <Puce key={cle} actif={filtre === cle} onClick={() => { setFiltre(cle); setPage(0); setEdition(''); }}>
                                    {libelle} ({n})
                                </Puce>
                            ))}
                        </div>
                        <div className='flex flex-wrap items-center gap-2'>
                            <ChampRecherche className='w-64' value={recherche} onChange={(v) => { setRecherche(v); setPage(0); }} placeholder={t('bulletinPaie.rechercherFichier')} />
                            <button type='button' onClick={() => { setFichiers([]); setBanniere(''); setEdition(''); setConfirmerCreation(false); }} disabled={!!rangement} className='rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40'>
                                {t('bulletinPaie.viderListe')}
                            </button>
                        </div>
                    </div>

                    <div className='overflow-x-auto'>
                        <div className='min-w-[920px]'>
                            <div className='grid grid-cols-[2fr_1.7fr_1.1fr_1.7fr_130px] gap-3.5 bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
                                <span>{t('bulletinPaie.colFichier')}</span>
                                <span>{t('bulletinPaie.colSalarie')}</span>
                                <span>{t('bulletinPaie.colMois')}</span>
                                <span>{t('bulletinPaie.colStatut')}</span>
                                <span />
                            </div>

                            {visibles.length === 0 && (
                                <p className='px-4 py-8 text-center text-sm text-muted-foreground'>
                                    {filtre === 'traiter' && !requete ? t('bulletinPaie.plusRienATraiter') : t('bulletinPaie.aucunFichierCategorie')}
                                </p>
                            )}

                            {visibles.slice(pg.debut, pg.fin).map((a) => {
                                const { f, salarie } = a;
                                const libelle = salarie?.nom || f.nouveauNom;
                                const enEdition = edition === f.id;
                                const options = enEdition ? optionsSalarie(f) : null;
                                return (
                                    <div key={f.id} className='border-t border-border/60'>
                                        <div className='grid grid-cols-[2fr_1.7fr_1.1fr_1.7fr_130px] items-center gap-3.5 px-4 py-2.5'>
                                            <div className='flex min-w-0 items-center gap-2.5'>
                                                <span className='flex h-9 w-7 shrink-0 items-center justify-center rounded-md bg-red-50 text-[9px] font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300'>PDF</span>
                                                <span className='truncate text-sm text-foreground' title={f.file.name}>{f.file.name}</span>
                                            </div>
                                            <div className='flex min-w-0 items-center gap-2'>
                                                <div className='min-w-0 flex-1'>
                                                    <p className={`truncate text-sm font-semibold ${libelle ? 'text-foreground' : 'text-red-700 dark:text-red-400'}`} title={libelle || ''}>
                                                        {libelle || t('bulletinPaie.aucunSalarie')}
                                                    </p>
                                                    <p className='truncate text-xs text-muted-foreground'>{sousTitre(a)}</p>
                                                </div>
                                                <button
                                                    type='button'
                                                    onClick={() => { setEdition(enEdition ? '' : f.id); setRechercheSalarie(''); }}
                                                    aria-expanded={enEdition}
                                                    className='shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted'
                                                >
                                                    {libelle ? t('bulletinPaie.changer') : t('bulletinPaie.choisir')}
                                                </button>
                                            </div>
                                            <div className='flex items-center gap-0.5'>
                                                <button type='button' aria-label={t('bulletinPaie.moisPrecedent')} onClick={() => maj(f.id, { moisCle: decalerCle(f.moisCle, -1), moisDetecteDuNom: true })} className='flex h-8 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted'>
                                                    <LuChevronLeft size={15} />
                                                </button>
                                                <span className='whitespace-nowrap text-sm text-foreground'>{libelleMois(f.moisCle)}</span>
                                                <button type='button' aria-label={t('bulletinPaie.moisSuivant')} onClick={() => maj(f.id, { moisCle: decalerCle(f.moisCle, 1), moisDetecteDuNom: true })} className='flex h-8 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted'>
                                                    <LuChevronRight size={15} />
                                                </button>
                                            </div>
                                            <Pastille ton={a.ton}>{a.message}</Pastille>
                                            <div className='flex items-center justify-end gap-1'>
                                                {a.ton === 'warn' && (
                                                    <button type='button' onClick={() => maj(f.id, { confirme: true })} className='rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90'>
                                                        {t('bulletinPaie.confirmer')}
                                                    </button>
                                                )}
                                                <button
                                                    type='button'
                                                    onClick={() => setFichiers((prev) => prev.filter((x) => x.id !== f.id))}
                                                    aria-label={t('bulletinPaie.retirerFichier', { nom: f.file.name })}
                                                    className='flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted'
                                                >
                                                    <LuX size={15} />
                                                </button>
                                            </div>
                                        </div>

                                        {enEdition && (
                                            <div className='mx-4 mb-3 flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3'>
                                                <ChampRecherche className='max-w-md' value={rechercheSalarie} onChange={setRechercheSalarie} placeholder={t('bulletinPaie.rechercherSalarie')} />
                                                <div className='flex flex-wrap gap-1.5'>
                                                    {options.liste.map((s) => (
                                                        <button
                                                            key={s.cle}
                                                            type='button'
                                                            onClick={() => { maj(f.id, { cle: s.cle, nouveauNom: '', confiance: 'sur', confirme: true }); setEdition(''); }}
                                                            className='rounded-lg border border-border bg-card px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:border-primary/40'
                                                        >
                                                            {s.nom}
                                                            <span className='text-muted-foreground'> · {s.personnel_id ? (s.bureau || t('bulletinPaie.avecCompte')) : t('bulletinPaie.sansCompte')}</span>
                                                        </button>
                                                    ))}
                                                    {options.nouveau && (
                                                        <button
                                                            type='button'
                                                            onClick={() => { maj(f.id, { cle: '', nouveauNom: options.nouveau, confiance: 'sur', confirme: true }); setEdition(''); }}
                                                            className='inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/50 bg-card px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5'
                                                        >
                                                            <LuFolderPlus size={14} /> {t('bulletinPaie.creerDossierPour', { nom: options.nouveau })}
                                                        </button>
                                                    )}
                                                </div>
                                                <p className='text-xs text-muted-foreground'>
                                                    {options.liste.length === 0
                                                        ? t('bulletinPaie.aucunSalarieTrouve')
                                                        : options.reste > 0
                                                            ? t('bulletinPaie.autresResultats', { count: options.reste })
                                                            : (options.suggestions ? t('bulletinPaie.suggestionsNomFichier') : '')}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Pagination pg={pg} total={visibles.length} onPage={setPage} />

                    <div className='flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3'>
                        {rangement ? (
                            <div className='flex min-w-[260px] flex-1 flex-col gap-1.5'>
                                <span className='text-xs font-medium text-foreground'>{t('bulletinPaie.rangementEnCours', { fait: rangement.fait, total: rangement.total })}</span>
                                <div className='h-2 overflow-hidden rounded-full bg-muted'>
                                    <div className='h-full rounded-full bg-primary transition-all' style={{ width: `${Math.round((100 * rangement.fait) / Math.max(1, rangement.total))}%` }} />
                                </div>
                            </div>
                        ) : (
                            <p className='max-w-2xl text-xs text-muted-foreground'>
                                {nErr + nWarn > 0 ? t('bulletinPaie.rangerAidePartiel', { prets: nOk, autres: nErr + nWarn }) : t('bulletinPaie.rangementExplication')}
                            </p>
                        )}
                        <button
                            type='button'
                            onClick={ranger}
                            disabled={nOk === 0 || !!rangement}
                            className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                            {rangement && <LuLoader size={14} className='animate-spin' />}
                            {nOk === 0 ? t('bulletinPaie.aucunBulletinPret') : t('bulletinPaie.rangerPrets', { count: nOk })}
                        </button>
                    </div>
                </section>
            )}
        </section>
    );
}

export default OngletDepot;
