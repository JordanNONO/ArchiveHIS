import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import { LuUploadCloud, LuX, LuLoader, LuArrowLeft, LuAlertCircle, LuShieldAlert } from 'react-icons/lu';
import MenuDeroulant from '../components/MenuDeroulant';
import SelectRecherchable from '../components/SelectRecherchable';
import { getPersonnels } from '../api/routes/personnel';
import { deposerBulletinsPaie } from '../api/routes/bulletinPaie';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Dépôt groupé des bulletins de paie — un fichier PDF par salarié et par
 * mois (demande explicite 2026-11-16/18). Réservé aux administrateurs,
 * voir Sidebar.jsx et BulletinPaieController (middleware 'admin').
 *
 * Chaque ligne doit être confirmée avant le dépôt : un bulletin de paie est
 * un document sensible, un classement automatique silencieux pourrait, une
 * fois sur mille, ranger le mauvais bulletin chez la mauvaise personne. Le
 * rapprochement par nom de fichier n'est donc qu'une SUGGESTION, jamais
 * appliquée sans régard — voir suggererPersonnel() plus bas.
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

/** Nom comparable : sans accents, en majuscules, espaces réduits. */
function cleNom(nom) {
    const sans = (nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
    return sans.toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Essaie de reconnaître un salarié d'après le nom du fichier — ex.
 * "DUPONT_Marie_mars2025.pdf" contient "DUPONT" et "Marie". Simple
 * rapprochement par inclusion sur le nom normalisé, jamais plus : une
 * fausse piste reste visible et modifiable, jamais appliquée en silence.
 */
function suggererPersonnel(nomFichier, personnels) {
    const cle = cleNom(nomFichier.replace(/\.[^.]+$/, ''));
    if (!cle) return null;
    return personnels.find((p) => {
        const clePersonne = cleNom(`${p.nom} ${p.prenom}`);
        const mots = clePersonne.split(' ').filter((m) => m.length > 1);
        return mots.length > 0 && mots.every((m) => cle.includes(m));
    }) || null;
}

function DepotBulletinsPaie() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isAdministrator } = usePermissions();
    const [personnels, setPersonnels] = useState([]);
    const [lignes, setLignes] = useState([]); // { id, fichier, personnelId, mois, suggere }
    const [envoiEnCours, setEnvoiEnCours] = useState(false);

    useEffect(() => {
        getPersonnels()
            .then((res) => (res.status === 200 ? res.json() : []))
            .then((liste) => setPersonnels(Array.isArray(liste) ? liste : []))
            .catch(() => toast.error(t('bulletinPaie.chargementSalariesEchoue')));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const optionsPersonnel = useMemo(
        () => personnels.map((p) => ({ value: String(p.id), label: `${p.nom} ${p.prenom}`.trim() })),
        [personnels],
    );
    const optionsMois = useMemo(() => moisDisponibles(), []);
    const moisParDefaut = optionsMois[0]?.value || '';

    const onDrop = useCallback((fichiers) => {
        if (!fichiers.length) return;
        setLignes((prev) => [
            ...prev,
            ...fichiers.map((fichier) => {
                const suggestion = suggererPersonnel(fichier.name, personnels);
                return {
                    id: `${fichier.name}-${fichier.lastModified}-${Math.random()}`,
                    fichier,
                    personnelId: suggestion ? String(suggestion.id) : '',
                    mois: moisParDefaut,
                    suggere: !!suggestion,
                };
            }),
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [personnels, moisParDefaut]);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: true,
    });

    function majLigne(id, champ, valeur) {
        setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, [champ]: valeur, ...(champ === 'personnelId' ? { suggere: false } : {}) } : l)));
    }

    function retirerLigne(id) {
        setLignes((prev) => prev.filter((l) => l.id !== id));
    }

    const lignesCompletes = lignes.filter((l) => l.personnelId && l.mois);
    const toutPret = lignes.length > 0 && lignesCompletes.length === lignes.length;

    // Le vrai verrou est côté serveur (middleware 'admin') — ceci évite
    // seulement d'atterrir sur une page qui échouerait en silence.
    if (!isAdministrator) {
        return (
            <div className='flex min-h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center'>
                <LuShieldAlert size={28} className='text-muted-foreground' />
                <p className='text-sm font-medium text-foreground'>{t('bulletinPaie.reserveAdmin')}</p>
            </div>
        );
    }

    async function deposer() {
        if (!toutPret || envoiEnCours) return;
        setEnvoiEnCours(true);

        const assignations = lignes.map((l, index) => ({ index, personnel_id: Number(l.personnelId), mois: l.mois }));
        const res = await deposerBulletinsPaie(lignes.map((l) => l.fichier), assignations).catch(() => null);
        setEnvoiEnCours(false);

        if (!res) {
            toast.error(t('commun.erreurGenerique'));
            return;
        }
        const data = await res.json().catch(() => ({}));
        if (res.status === 201) {
            toast.success(t('bulletinPaie.deposesAvecSucces', { count: data.deposes }));
            setLignes([]);
            return;
        }
        toast.error(data?.error || t('commun.erreurGenerique'));
    }

    return (
        <div className='flex min-h-full flex-col'>
            <header className='bg-card px-6 pb-4 pt-6'>
                <button onClick={() => navigate(-1)} className='mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline'>
                    <LuArrowLeft size={13} /> {t('bulletinPaie.retourDossier')}
                </button>
                <h1 className='text-xl font-semibold tracking-tight text-foreground'>{t('bulletinPaie.deposerTitre')}</h1>
                <p className='mt-1 max-w-xl text-sm text-muted-foreground'>{t('bulletinPaie.deposerSousTitre')}</p>
            </header>

            <div className='flex-grow bg-background px-6 pb-10 pt-5'>
                <div className='mx-auto flex max-w-[1040px] flex-col gap-4'>

                    <div {...getRootProps()} className='flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-border bg-card p-7 text-center transition-colors hover:border-primary/40'>
                        <input {...getInputProps()} />
                        <LuUploadCloud size={28} className='text-muted-foreground' />
                        <p className='text-sm font-medium text-foreground'>{t('bulletinPaie.glisserDeposer')}</p>
                        <p className='text-xs text-muted-foreground'>{t('bulletinPaie.formatAccepte')}</p>
                        {lignes.length > 0 && <p className='mt-1 text-xs font-medium text-primary'>{t('bulletinPaie.fichiersSelectionnes', { count: lignes.length })}</p>}
                    </div>

                    {lignes.length > 0 && (
                        <section className='overflow-hidden rounded-xl border border-border bg-card'>
                            <div className='flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3'>
                                <h2 className='text-sm font-semibold text-foreground'>{t('bulletinPaie.verifierLignes')}</h2>
                                <span className='text-xs text-muted-foreground'>{t('bulletinPaie.lignesPretes', { pretes: lignesCompletes.length, total: lignes.length })}</span>
                            </div>
                            <div className='divide-y divide-border/60'>
                                {lignes.map((l) => (
                                    <div key={l.id} className='flex flex-wrap items-start gap-3 px-4 py-3'>
                                        <div className='min-w-0 flex-1 basis-[220px]'>
                                            <p className='truncate text-xs text-muted-foreground' title={l.fichier.name}>{l.fichier.name}</p>
                                        </div>
                                        <div className='w-full sm:w-[230px]'>
                                            <SelectRecherchable
                                                options={optionsPersonnel}
                                                value={l.personnelId}
                                                onChange={(v) => majLigne(l.id, 'personnelId', v)}
                                                placeholder={t('bulletinPaie.choisirOuSaisirSalarie')}
                                            />
                                            {l.suggere && (
                                                <p className='mt-1 inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-700 dark:text-amber-400'>
                                                    <LuAlertCircle size={11} /> {t('bulletinPaie.suggereDuNom')}
                                                </p>
                                            )}
                                        </div>
                                        <div className='w-full sm:w-[170px]'>
                                            <MenuDeroulant className='w-full' boutonClassName='w-full' options={optionsMois} value={l.mois} onChange={(v) => majLigne(l.id, 'mois', v)} />
                                        </div>
                                        <button type='button' onClick={() => retirerLigne(l.id)} aria-label={t('bulletinPaie.retirerFichier', { nom: l.fichier.name })} className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted'>
                                            <LuX size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className='flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3'>
                                <p className='text-xs text-muted-foreground'>{t('bulletinPaie.aideSuggestion')}</p>
                                <button
                                    type='button'
                                    onClick={deposer}
                                    disabled={!toutPret || envoiEnCours}
                                    className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
                                >
                                    {envoiEnCours && <LuLoader size={14} className='animate-spin' />}
                                    {t('bulletinPaie.deposerBouton', { count: lignes.length })}
                                </button>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DepotBulletinsPaie;
