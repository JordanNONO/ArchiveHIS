import React, { useEffect, useRef, useState } from 'react';
import ImportHissapPai from '../components/ImportHissapPai';
import { Link, useSearchParams } from 'react-router-dom';
import { LuPlus, LuLoader, LuAlertTriangle, LuListChecks, LuArchive, LuSearch, LuDownloadCloud } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import { getPaiDossiers } from '../api/routes/pai';
import { usePermissions } from '../hooks/usePermissions';

function Pai() {
    // Registre visible par tout le personnel interne, mais créer un dossier
    // (et le reste des actions d'écriture, voir PaiDetail.jsx) reste réservé
    // à gerer_pai — pas d'autre check dans ce fichier avant ce changement,
    // la page entière n'était atteignable que par gerer_pai jusqu'ici.
    const { hasPermission, isAdministrator } = usePermissions();
    const peutGererPai = isAdministrator || hasPermission('gerer_pai');
    const [searchParams, setSearchParams] = useSearchParams();
    const [dossiers, setDossiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [voirClotures, setVoirClotures] = useState(searchParams.get('clotures') === '1');
    const [recherche, setRecherche] = useState(searchParams.get('q') || '');
    const importHissap = useRef(null);

    // Ouvrir un dossier (lien vers /pai/:id) démonte cette page — au retour,
    // elle remontait de zéro et recherche/filtre repartaient par défaut
    // (retour utilisateur : "c'est comme ça partout"). Même principe que
    // OpenFolder.jsx/FluctuationRh.jsx : l'état vit dans l'URL.
    useEffect(() => {
        const params = {};
        if (voirClotures) params.clotures = '1';
        if (recherche) params.q = recherche;
        setSearchParams(params, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [voirClotures, recherche]);

    function fetchDossiers(cloture) {
        setLoading(true);
        getPaiDossiers(cloture)
            .then((res) => (res.status === 200 ? res.json() : []))
            .then((data) => setDossiers(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }

    useEffect(() => { fetchDossiers(voirClotures); }, [voirClotures]);

    const dossiersFiltres = dossiers.filter((d) => {
        const q = recherche.trim().toLowerCase();
        if (!q) return true;
        return d.titre.toLowerCase().includes(q)
            || (d.nom_beneficiaire || '').toLowerCase().includes(q)
            || (d.responsable_secteur?.nom || '').toLowerCase().includes(q);
    });

    return (
        <div className='flex flex-col flex-grow py-6'>
            <Breadcrumbs where='PAI' />
            <div className='flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 mt-1'>
                <div>
                    <h2 className='text-2xl font-semibold text-foreground'>Projets d'Accompagnement Individualisé</h2>
                    <p className='text-sm text-muted-foreground mt-1'>Suivi continu des objectifs par bénéficiaire.</p>
                </div>
                <div className='flex items-center gap-2 shrink-0'>
                    <button
                        onClick={() => { setVoirClotures((v) => !v); setRecherche(''); }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${voirClotures ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                        <LuArchive size={14} />
                        {voirClotures ? 'Voir les actifs' : 'Voir les clôturés'}
                    </button>
                    {peutGererPai && (
                        <button
                            onClick={() => importHissap.current?.ouvrir()}
                            className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors'
                        >
                            <LuDownloadCloud size={15} />
                            Importer depuis HisSAP
                        </button>
                    )}
                    {peutGererPai && (
                        <Link to='/pai/nouveau/protocole' className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors'>
                            <LuPlus size={16} />
                            Nouveau PAI
                        </Link>
                    )}
                </div>
            </div>

            {dossiers.length > 0 && (
                <div className='relative mb-5 max-w-sm'>
                    <LuSearch size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
                    <input
                        type='text'
                        value={recherche}
                        onChange={(e) => setRecherche(e.target.value)}
                        placeholder='Rechercher un bénéficiaire, un responsable...'
                        className='w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                    />
                </div>
            )}

            {loading ? (
                <div className='flex items-center justify-center py-16 text-muted-foreground'>
                    <LuLoader className='animate-spin' size={22} />
                </div>
            ) : dossiers.length === 0 ? (
                <div className='flex flex-col items-center gap-2 py-16 text-muted-foreground rounded-2xl border border-dashed border-border'>
                    <LuListChecks size={28} />
                    <span className='text-sm'>{voirClotures ? 'Aucun dossier clôturé' : 'Aucun dossier PAI actif'}</span>
                </div>
            ) : dossiersFiltres.length === 0 ? (
                <div className='flex flex-col items-center gap-2 py-16 text-muted-foreground rounded-2xl border border-dashed border-border'>
                    <LuSearch size={28} />
                    <span className='text-sm'>Aucun résultat pour "{recherche}"</span>
                </div>
            ) : (
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                    {dossiersFiltres.map((d) => (
                        <Link
                            key={d.id}
                            to={`/pai/${d.id}`}
                            className='rounded-2xl border border-border bg-card p-4 flex flex-col gap-2.5 hover:border-primary/40 hover:shadow-sm transition-all'
                        >
                            <div className='flex items-start justify-between gap-2'>
                                <h3 className='text-sm font-semibold text-foreground leading-snug'>{d.titre}</h3>
                                {d.nb_objectifs_en_retard > 0 && (
                                    <span className='shrink-0 inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold px-2 py-0.5'>
                                        <LuAlertTriangle size={11} />
                                        {d.nb_objectifs_en_retard}
                                    </span>
                                )}
                            </div>
                            {/* Un PAI ne se ferme jamais tout seul — ce badge est le seul
                                indice visuel, sur la carte, que ce dossier reste suivi
                                indéfiniment tant que personne ne le clôture à la main. */}
                            <div className='flex flex-wrap items-center gap-1.5'>
                                <span className={`inline-flex items-center gap-1 rounded-full text-[11px] font-semibold px-2 py-0.5 ${d.date_cloture ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${d.date_cloture ? 'bg-muted-foreground' : 'bg-primary animate-pulse'}`} />
                                    {d.date_cloture ? 'Clôturé' : 'En cours'}
                                </span>
                                {d.hissap_pai_id && (
                                    <span className='inline-flex items-center rounded-full text-[11px] font-semibold px-2 py-0.5 bg-muted text-foreground'>HisSAP</span>
                                )}
                            </div>
                            <p className='text-xs text-muted-foreground'>{d.nom_beneficiaire || '—'}</p>
                            <div className='flex items-center justify-between mt-auto pt-1'>
                                <span className='text-[11px] text-muted-foreground'>{d.responsable_secteur?.nom}</span>
                                <span className='text-[11px] font-medium text-muted-foreground tabular-nums'>{d.nb_objectifs_faits}/{d.nb_objectifs} réalisés</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            <ImportHissapPai ref={importHissap} onImporte={() => fetchDossiers(voirClotures)} />
        </div>
    );
}

export default Pai;
