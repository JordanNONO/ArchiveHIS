import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import { LuUploadCloud, LuX, LuLoader, LuAlertCircle } from 'react-icons/lu';
import MenuDeroulant from '../../components/MenuDeroulant';
import SelectRecherchable from '../../components/SelectRecherchable';
import { deposerBulletinsPaie, getApercuEnvoiBulletinsPaie } from '../../api/routes/bulletinPaie';
import { analyserNomFichier, libelleMois, optionsMois } from './analyseNomFichier';

const PASTILLE = {
    ok: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    err: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

/**
 * Onglet 1/3 de la page Bulletins de paie — dépôt groupé avec détection du
 * salarié et du mois d'après le nom de fichier (voir analyseNomFichier.js).
 * Reste monté (juste masqué, voir BulletinsPaie.jsx) quand on passe à un
 * autre onglet : un administrateur qui va vérifier l'onglet Envoi avant de
 * ranger ne doit pas perdre sa liste en cours.
 *
 * Toujours une SUGGESTION à confirmer, jamais un classement automatique : un
 * bulletin de paie est un document sensible, voir l'ancien
 * suggererPersonnel() que ce module remplace.
 */
function OngletDepot({ mois, onMoisChange, personnels, onRange }) {
    const { t } = useTranslation();
    const [fichiers, setFichiers] = useState([]); // { id, file, personnelId, confiance, moisCle, moisDetecteDuNom }
    const [banniere, setBanniere] = useState('');
    const [existants, setExistants] = useState({}); // { [moisCle]: Set<personnelId> }
    const [enCours, setEnCours] = useState(false);

    useEffect(() => {
        const clesPresentes = Array.from(new Set(fichiers.map((f) => f.moisCle)));
        const manquantes = clesPresentes.filter((c) => c && !(c in existants));
        if (!manquantes.length) return;
        manquantes.forEach((c) => {
            getApercuEnvoiBulletinsPaie(c)
                .then((res) => (res.status === 200 ? res.json() : null))
                .then((data) => {
                    if (!data) return;
                    const ensemble = new Set(data.lignes.filter((l) => l.bulletin_trouve).map((l) => String(l.personnel_id)));
                    setExistants((prev) => ({ ...prev, [c]: ensemble }));
                })
                .catch(() => {});
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fichiers]);

    function onDrop(acceptedFiles) {
        if (!acceptedFiles.length) return;
        const analyses = acceptedFiles.map((file) => ({ file, ...analyserNomFichier(file.name, personnels, Number(mois.slice(0, 4))) }));

        const comptage = {};
        analyses.forEach((a) => { if (a.moisDetecteDuNom) comptage[a.moisCle] = (comptage[a.moisCle] || 0) + 1; });
        const cles = Object.keys(comptage).sort((a, b) => comptage[b] - comptage[a]);

        let periodeCible = mois;
        if (cles.length) {
            periodeCible = cles[0];
            const n = comptage[periodeCible];
            if (periodeCible !== mois) {
                setBanniere(t('bulletinPaie.moisDetecteDifferent', { mois: libelleMois(periodeCible), n, total: analyses.length }));
                onMoisChange(periodeCible);
            } else {
                setBanniere(t('bulletinPaie.moisDetecteIdentique', { mois: libelleMois(periodeCible), n, total: analyses.length }));
            }
        } else {
            setBanniere(t('bulletinPaie.aucunMoisDetecte', { mois: libelleMois(mois) }));
        }

        const nouveaux = analyses.map((a) => ({
            id: `${a.file.name}-${a.file.lastModified}-${Math.random()}`,
            file: a.file,
            personnelId: a.personnelId,
            confiance: a.confiance,
            moisCle: a.moisCle || periodeCible,
            moisDetecteDuNom: a.moisDetecteDuNom,
        }));
        setFichiers((prev) => [...prev, ...nouveaux]);
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] }, multiple: true });

    function mettreAJourLigne(id, champs) {
        setFichiers((prev) => prev.map((f) => (f.id === id ? { ...f, ...champs } : f)));
    }

    function retirerLigne(id) {
        setFichiers((prev) => prev.filter((f) => f.id !== id));
    }

    function viderListe() {
        setFichiers([]);
        setBanniere('');
    }

    const comptageActuel = {};
    fichiers.forEach((f) => {
        if (f.personnelId) {
            const cle = `${f.personnelId}|${f.moisCle}`;
            comptageActuel[cle] = (comptageActuel[cle] || 0) + 1;
        }
    });

    let bloquants = 0;
    let prets = 0;
    let avertissements = 0;
    const lignes = fichiers.map((f) => {
        const personnel = personnels.find((p) => String(p.id) === f.personnelId);
        const cle = `${f.personnelId}|${f.moisCle}`;
        let tone = 'ok';
        let message = t('bulletinPaie.ligneStatutPret');
        if (!f.personnelId) {
            tone = 'err'; message = t('bulletinPaie.ligneStatutNonReconnu');
        } else if (comptageActuel[cle] > 1) {
            tone = 'err'; message = t('bulletinPaie.ligneStatutDoublon');
        } else if (f.confiance === 'ambigu') {
            tone = 'warn'; message = t('bulletinPaie.ligneStatutAmbigu');
        } else if (!f.moisDetecteDuNom) {
            tone = 'warn'; message = t('bulletinPaie.ligneStatutMoisAbsent');
        } else if (existants[f.moisCle]?.has(f.personnelId)) {
            tone = 'warn'; message = t('bulletinPaie.ligneStatutRemplace');
        } else if (f.moisCle !== mois) {
            tone = 'warn'; message = t('bulletinPaie.ligneStatutAutreMois', { mois: libelleMois(f.moisCle) });
        }

        if (tone === 'err') bloquants += 1; else prets += 1;
        if (tone === 'warn') avertissements += 1;

        return {
            ...f,
            tone,
            message,
            destination: personnel
                ? `${personnel.nom} ${personnel.prenom} › ${t('bulletinPaie.dossierBulletinPaie')} › ${libelleMois(f.moisCle)}`
                : t('bulletinPaie.dossierAIndeterminer'),
        };
    });

    const optionsPersonnel = [{ value: '', label: t('bulletinPaie.choisirSalarie') }, ...personnels.map((p) => ({ value: String(p.id), label: `${p.nom} ${p.prenom}`.trim() }))];
    const optionsMoisLigne = optionsMois(mois);
    const rangerDisabled = fichiers.length === 0 || bloquants > 0;

    async function ranger() {
        if (rangerDisabled || enCours) return;
        setEnCours(true);
        const assignations = fichiers.map((f, index) => ({ index, personnel_id: Number(f.personnelId), mois: f.moisCle }));
        const res = await deposerBulletinsPaie(fichiers.map((f) => f.file), assignations).catch(() => null);
        setEnCours(false);

        if (!res) { toast.error(t('commun.erreurGenerique')); return; }
        const data = await res.json().catch(() => ({}));
        if (res.status === 201) {
            setFichiers([]);
            setBanniere('');
            setExistants({});
            onRange(data.deposes);
            return;
        }
        toast.error(data?.error || t('commun.erreurGenerique'));
    }

    return (
        <section className='flex flex-col gap-4'>
            <div
                {...getRootProps()}
                className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed p-7 text-center transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
            >
                <input {...getInputProps()} />
                <LuUploadCloud size={28} className='text-muted-foreground' />
                <p className='text-sm font-medium text-foreground'>{t('bulletinPaie.depotZoneTitre')}</p>
                <p className='max-w-xl text-xs text-muted-foreground'>{t('bulletinPaie.depotZoneSousTitre')}</p>
            </div>

            {fichiers.length > 0 && (
                <div className='flex items-center'>
                    <button type='button' onClick={viderListe} className='text-xs font-medium text-muted-foreground hover:text-foreground'>
                        {t('bulletinPaie.viderListe')}
                    </button>
                </div>
            )}

            {banniere && (
                <div className='flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200'>
                    <LuAlertCircle size={16} className='mt-0.5 shrink-0' />
                    <span>{banniere}</span>
                </div>
            )}

            {fichiers.length > 0 && (
                <section className='overflow-hidden rounded-xl border border-border bg-card'>
                    <div className='flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3'>
                        <h2 className='text-sm font-semibold text-foreground'>{t('bulletinPaie.fichiersAnalyses', { count: fichiers.length })}</h2>
                        <span className='text-xs text-muted-foreground'>{t('bulletinPaie.resumeLignes', { prets, avertissements, bloquants })}</span>
                    </div>
                    <div className='overflow-x-auto'>
                        <div className='min-w-[900px] divide-y divide-border/60'>
                            <div className='grid grid-cols-[2.1fr_1.6fr_1.2fr_1.6fr_40px] gap-3.5 bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
                                <span>{t('bulletinPaie.colFichier')}</span>
                                <span>{t('bulletinPaie.colSalarieDetecte')}</span>
                                <span>{t('bulletinPaie.colMoisDetecte')}</span>
                                <span>{t('bulletinPaie.colStatut')}</span>
                                <span />
                            </div>
                            {lignes.map((l) => (
                                <div key={l.id} className='grid grid-cols-[2.1fr_1.6fr_1.2fr_1.6fr_40px] items-center gap-3.5 px-4 py-2.5'>
                                    <div className='min-w-0'>
                                        <p className='truncate text-sm font-medium text-foreground' title={l.file.name}>{l.file.name}</p>
                                        <p className='truncate text-xs text-muted-foreground' title={l.destination}>→ {l.destination}</p>
                                    </div>
                                    <SelectRecherchable
                                        options={optionsPersonnel}
                                        value={l.personnelId}
                                        onChange={(v) => mettreAJourLigne(l.id, { personnelId: v, confiance: 'sur' })}
                                        placeholder={t('bulletinPaie.choisirSalarie')}
                                    />
                                    <MenuDeroulant
                                        className='w-full'
                                        boutonClassName='w-full'
                                        options={optionsMoisLigne}
                                        value={l.moisCle}
                                        onChange={(v) => mettreAJourLigne(l.id, { moisCle: v, moisDetecteDuNom: true })}
                                    />
                                    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${PASTILLE[l.tone]}`}>{l.message}</span>
                                    <button
                                        type='button'
                                        onClick={() => retirerLigne(l.id)}
                                        aria-label={t('bulletinPaie.retirerFichier', { nom: l.file.name })}
                                        className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted'
                                    >
                                        <LuX size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className='flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3'>
                        <p className='text-xs text-muted-foreground'>{t('bulletinPaie.rangementExplication')}</p>
                        <button
                            type='button'
                            onClick={ranger}
                            disabled={rangerDisabled || enCours}
                            className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                            {enCours && <LuLoader size={14} className='animate-spin' />}
                            {bloquants > 0 ? t('bulletinPaie.rangerBoutonBloquants', { count: bloquants }) : t('bulletinPaie.rangerBouton', { count: fichiers.length })}
                        </button>
                    </div>
                </section>
            )}
        </section>
    );
}

export default OngletDepot;
