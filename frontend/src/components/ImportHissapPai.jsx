import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { LuLoader, LuRefreshCw } from 'react-icons/lu';
import { getHissapPai, importerHissapPai } from '../api/routes/pai';

const LIBELLES_STATUT = {
    nouveau: { texte: 'Nouveau', classe: 'bg-green-100 text-green-800' },
    modifie: { texte: 'Modifié dans HisSAP', classe: 'bg-yellow-100 text-yellow-900' },
    a_jour: { texte: 'À jour', classe: 'bg-muted text-muted-foreground' },
};

/**
 * Fenêtre "Importer depuis HisSAP" de la page PAI — la liste est relue en
 * direct dans HisSAP à chaque ouverture (voir HissapPaiController).
 * À ouvrir avec ref.current.ouvrir().
 */
const ImportHissapPai = React.forwardRef(function ImportHissapPai({ onImporte }, ref) {
    const [chargement, setChargement] = useState(false);
    const [erreur, setErreur] = useState(null);
    const [configure, setConfigure] = useState(true);
    const [pais, setPais] = useState([]);
    const [selection, setSelection] = useState([]);
    const [moisEcheance, setMoisEcheance] = useState(3);
    const [donneesSante, setDonneesSante] = useState(false);
    const [importEnCours, setImportEnCours] = useState(false);

    async function charger() {
        setChargement(true);
        setErreur(null);
        try {
            const res = await getHissapPai();
            const data = await res.json().catch(() => ({}));
            if (res.status !== 200) {
                setErreur(data?.error || 'HisSAP est injoignable pour le moment.');
                setPais([]);
                return;
            }
            setConfigure(data.configure);
            setPais(data.pais || []);
            // Présélectionne ce qui demande une action : nouveaux et modifiés.
            setSelection((data.pais || []).filter((p) => p.statut !== 'a_jour').map((p) => p.client_id));
        } catch {
            setErreur('HisSAP est injoignable pour le moment.');
        } finally {
            setChargement(false);
        }
    }

    React.useImperativeHandle(ref, () => ({
        ouvrir() {
            document.getElementById('import_hissap_pai').showModal();
            charger();
        },
    }));

    function basculer(clientId) {
        setSelection((s) => (s.includes(clientId) ? s.filter((id) => id !== clientId) : [...s, clientId]));
    }

    async function importer() {
        try {
            setImportEnCours(true);
            const res = await importerHissapPai({ client_ids: selection, mois_echeance: Number(moisEcheance), donnees_sante: donneesSante });
            const data = await res.json().catch(() => ({}));
            (data.erreurs || []).forEach((e) => toast.error(e));
            if (res.status === 200) {
                toast.success(`${data.dossier_ids.length} PAI importé(s) depuis HisSAP`);
                document.getElementById('import_hissap_pai').close();
                onImporte?.();
            } else if (!data.erreurs?.length) {
                toast.error(data?.error || "L'import a échoué");
            }
        } catch {
            toast.error("L'import a échoué");
        } finally {
            setImportEnCours(false);
        }
    }

    return (
        <dialog id='import_hissap_pai' className='modal'>
            <div className='modal-box rounded-2xl max-w-3xl'>
                <form method='dialog'>
                    <button className='btn btn-sm btn-circle btn-ghost absolute right-2 top-2'>✕</button>
                </form>
                <div className='flex items-center justify-between gap-3 mb-1 pr-8'>
                    <h1 className='text-lg font-semibold'>Importer des PAI depuis HisSAP</h1>
                    <button
                        onClick={charger}
                        disabled={chargement}
                        className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50'
                    >
                        <LuRefreshCw size={13} className={chargement ? 'animate-spin' : ''} /> Actualiser
                    </button>
                </div>
                <p className='text-sm text-muted-foreground mb-4'>PAI publiés dans HisSAP, lus en direct. Un dossier déjà importé est mis à jour, jamais dupliqué.</p>

                {chargement ? (
                    <div className='flex items-center justify-center py-12 text-muted-foreground'><LuLoader className='animate-spin' size={22} /></div>
                ) : erreur ? (
                    <p className='text-sm text-destructive py-6 text-center'>{erreur}</p>
                ) : !configure ? (
                    <p className='text-sm text-muted-foreground py-6 text-center'>La liaison HisSAP n'est pas configurée sur ce serveur (HISSAP_URL / HISSAP_API_KEY).</p>
                ) : pais.length === 0 ? (
                    <p className='text-sm text-muted-foreground py-6 text-center'>Aucun PAI publié dans HisSAP.</p>
                ) : (
                    <>
                        <div className='rounded-xl border border-border overflow-x-auto max-h-80'>
                            <table className='w-full text-sm min-w-[560px]'>
                                <thead className='bg-muted/40 text-xs text-muted-foreground text-left'>
                                    <tr>
                                        <th className='px-3 py-2 w-10'><span className='sr-only'>Choisir</span></th>
                                        <th className='px-3 py-2'>Bénéficiaire</th>
                                        <th className='px-3 py-2'>Responsable (HisSAP)</th>
                                        <th className='px-3 py-2'>Objectifs</th>
                                        <th className='px-3 py-2'>État</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-border'>
                                    {pais.map((p) => (
                                        <tr key={p.client_id} className='hover:bg-muted/20'>
                                            <td className='px-3 py-2'>
                                                <input
                                                    type='checkbox'
                                                    aria-label={`Choisir ${p.beneficiaire}`}
                                                    checked={selection.includes(p.client_id)}
                                                    onChange={() => basculer(p.client_id)}
                                                    className='checkbox checkbox-sm checkbox-primary'
                                                />
                                            </td>
                                            <td className='px-3 py-2 font-medium'>{p.beneficiaire || `Client n° ${p.client_id}`}</td>
                                            <td className='px-3 py-2 text-muted-foreground'>{p.responsable_secteur || '—'}</td>
                                            <td className='px-3 py-2 tabular-nums'>{p.nb_objectifs}</td>
                                            <td className='px-3 py-2'>
                                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${LIBELLES_STATUT[p.statut]?.classe}`}>{LIBELLES_STATUT[p.statut]?.texte}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4'>
                            <label className='flex flex-col gap-1.5 text-sm font-medium'>
                                Échéance des nouveaux objectifs
                                <select
                                    value={moisEcheance}
                                    onChange={(e) => setMoisEcheance(e.target.value)}
                                    className='rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal'
                                >
                                    {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m} mois après l'ouverture</option>)}
                                </select>
                            </label>
                            <label className='flex items-start gap-2 text-sm pt-6 cursor-pointer'>
                                <input type='checkbox' checked={donneesSante} onChange={(e) => setDonneesSante(e.target.checked)} className='checkbox checkbox-sm checkbox-primary mt-0.5' />
                                <span>
                                    <span className='font-medium'>Importer les données de santé</span>
                                    <span className='block text-xs text-muted-foreground'>Pathologie, traitement, médecin — visibles seulement par le responsable du dossier et la supervision.</span>
                                </span>
                            </label>
                        </div>

                        <div className='modal-action'>
                            <button
                                onClick={importer}
                                disabled={importEnCours || selection.length === 0}
                                className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'
                            >
                                {importEnCours ? 'Import...' : `Importer ${selection.length} PAI`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </dialog>
    );
});

export default ImportHissapPai;
