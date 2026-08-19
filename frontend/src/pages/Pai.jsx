import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuPlus, LuLoader, LuAlertTriangle, LuListChecks, LuArchive, LuSearch } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import { getPaiDossiers, createPaiDossier } from '../api/routes/pai';
import { getPersonnels } from '../api/routes/personnel';

// Préfixe plutôt que nom exact : "RS" (générique) et ses déclinaisons par
// spécialité (RS_QUALITE, RS_EXPLOITATION, RS_COORDINATION) partagent toutes
// le même accès — voir la migration creer_roles_specialises_responsable_secteur.
const PREFIXE_CODE_ROLE_RESPONSABLE_SECTEUR = 'RS';

function Pai() {
    const [dossiers, setDossiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [voirClotures, setVoirClotures] = useState(false);
    const [responsables, setResponsables] = useState([]);
    const [form, setForm] = useState({ titre: '', nom_beneficiaire: '', responsable_secteur_id: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [recherche, setRecherche] = useState('');

    function fetchDossiers(cloture) {
        setLoading(true);
        getPaiDossiers(cloture)
            .then((res) => (res.status === 200 ? res.json() : []))
            .then((data) => setDossiers(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }

    useEffect(() => { fetchDossiers(voirClotures); }, [voirClotures]);

    useEffect(() => {
        getPersonnels().then(async (res) => {
            if (res.status === 200) {
                const data = await res.json();
                setResponsables(data.filter((p) => p.user?.roles?.some((r) => r.code_role?.startsWith(PREFIXE_CODE_ROLE_RESPONSABLE_SECTEUR))));
            }
        }).catch(() => {});
    }, []);

    function ouvrirModal() {
        setForm({ titre: '', nom_beneficiaire: '', responsable_secteur_id: '', description: '' });
        document.getElementById('nouveau_pai').showModal();
    }

    async function creerDossier(e) {
        e.preventDefault();
        try {
            setSaving(true);
            const res = await createPaiDossier(form);
            if (res.status === 201) {
                toast.success('Dossier PAI créé');
                document.getElementById('nouveau_pai').close();
                fetchDossiers(voirClotures);
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || Object.values(data?.errors || {})[0]?.[0] || 'La création a échoué');
            }
        } catch {
            toast.error('La création a échoué');
        } finally {
            setSaving(false);
        }
    }

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
                    <button onClick={ouvrirModal} className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors'>
                        <LuPlus size={16} />
                        Nouveau PAI
                    </button>
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
                            <span className={`self-start inline-flex items-center gap-1 rounded-full text-[11px] font-semibold px-2 py-0.5 ${d.date_cloture ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${d.date_cloture ? 'bg-muted-foreground' : 'bg-primary animate-pulse'}`} />
                                {d.date_cloture ? 'Clôturé' : 'En cours'}
                            </span>
                            <p className='text-xs text-muted-foreground'>{d.nom_beneficiaire || '—'}</p>
                            <div className='flex items-center justify-between mt-auto pt-1'>
                                <span className='text-[11px] text-muted-foreground'>{d.responsable_secteur?.nom}</span>
                                <span className='text-[11px] font-medium text-muted-foreground tabular-nums'>{d.nb_objectifs_faits}/{d.nb_objectifs} réalisés</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            <dialog id='nouveau_pai' className='modal'>
                <div className='modal-box rounded-2xl'>
                    <form method='dialog'>
                        <button className='btn btn-sm btn-circle btn-ghost absolute right-2 top-2'>✕</button>
                    </form>
                    <h1 className='text-lg font-semibold mb-4'>Nouveau dossier PAI</h1>
                    <form onSubmit={creerDossier} className='flex flex-col gap-3'>
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>Titre <span className='text-red-500'>*</span></label>
                            <input
                                type='text'
                                required
                                value={form.titre}
                                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                                placeholder='Ex : PAI — M. Laroussi'
                                className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                            />
                        </div>
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>Bénéficiaire <span className='text-red-500'>*</span></label>
                            <input
                                type='text'
                                required
                                value={form.nom_beneficiaire}
                                onChange={(e) => setForm({ ...form, nom_beneficiaire: e.target.value })}
                                placeholder='Nom du bénéficiaire'
                                className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                            />
                        </div>
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>Responsable secteur <span className='text-red-500'>*</span></label>
                            <select
                                required
                                value={form.responsable_secteur_id}
                                onChange={(e) => setForm({ ...form, responsable_secteur_id: e.target.value })}
                                className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                            >
                                <option value=''>Sélectionner...</option>
                                {responsables.map((p) => (
                                    <option key={p.id} value={p.user?.id}>{p.prenom} {p.nom}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className='block text-sm font-medium mb-1.5'>Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                                className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                            />
                        </div>
                        <div className='modal-action'>
                            <button type='submit' disabled={saving} className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                                {saving ? 'Création...' : 'Créer le dossier'}
                            </button>
                        </div>
                    </form>
                </div>
            </dialog>
        </div>
    );
}

export default Pai;
