import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuLoader, LuTrash2, LuDownload, LuSave, LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import MenuDeroulant from '../components/MenuDeroulant';
import { getPaiDossier, updatePaiProtocole, creerPaiAvecProtocole } from '../api/routes/pai';
import { getPersonnels } from '../api/routes/personnel';
import { genererPdfProtocolePai } from '../utils/protocolePaiPdf';
import { usePermissions } from '../hooks/usePermissions';

// Préfixe plutôt que nom exact : "RS" (générique) et ses déclinaisons par
// spécialité partagent le même accès — même règle que Pai.jsx/PaiDetail.jsx.
const PREFIXE_CODE_ROLE_RESPONSABLE_SECTEUR = 'RS';

// Procédures techniques standardisées, réutilisées d'un bénéficiaire à
// l'autre (aspiration, change...) — insérées en un clic depuis l'onglet
// Procédures plutôt que ressaisies à chaque fois, puis librement adaptées.
const MODELES_PROCEDURES = {
    Aspiration: { type: 'numerotee', etapes: [
        { label: '', texte: 'Se placer en face du bénéficiaire.' },
        { label: '', texte: 'Demander : « Au fond ? » ou « Bouche ? »' },
        { label: '', texte: 'Attendre un signe de confirmation (ex. clignement des yeux).' },
        { label: '', texte: 'Rincer la sonde dans le pot prévu.' },
    ] },
    Change: { type: 'puces', etapes: [
        { label: '', texte: 'Ne pas utiliser de lingettes.' },
        { label: '', texte: 'Proposer systématiquement le pistolet (sans appuyer sur les zones sensibles).' },
        { label: 'Urine seulement', texte: 'Utiliser des gants lavables, les faire sécher sur le sèche-serviettes.' },
        { label: 'Selles', texte: '', sous: ["Utiliser des gants jetables jusqu'à ce qu'il n'y ait plus de selles.", 'Finir avec un gant lavable et mettre le tout à laver.'] },
    ] },
    'Masque VNI': { type: 'numerotee', etapes: [
        { label: '', texte: 'Appliquer un pansement de protection si besoin.' },
        { label: '', texte: 'Mettre le masque en levant doucement la tête du bénéficiaire.' },
    ] },
    Mouchoirs: { type: 'puces', etapes: [
        { label: '', texte: 'Prendre un mouchoir à la fois.' },
        { label: '', texte: "Le jeter dès qu'il est mouillé." },
        { label: '', texte: 'Ne jamais le mettre dans la bouche.' },
    ] },
};

const SUGGESTIONS_ETAPES = ['Vérifier les besoins', 'Bain de bouche', 'Aspiration si nécessaire', 'Douche / toilette', 'Change', 'Habillage', 'Repas', 'Installer la tablette de communication', 'Aide au rasage', 'Nettoyage du matériel', 'Surveillance'];

let compteurId = 0;
function uid() { compteurId += 1; return `n${Date.now()}_${compteurId}`; }
function creerEtape(label = '', texte = '') { return { id: uid(), label, texte, sous: [] }; }
function creerBlocModele(nom, modele) {
    return {
        id: uid(), titre: nom, nom, type: modele.type,
        etapes: modele.etapes.map((e) => ({ id: uid(), label: e.label || '', texte: e.texte || '', sous: (e.sous || []).map((s) => ({ id: uid(), texte: s })) })),
    };
}

function protocoleVide(dossier) {
    const parties = (dossier?.nom_beneficiaire || '').trim().split(/\s+/);
    const nom = parties.length > 1 ? parties.pop() : '';
    const prenom = parties.join(' ');
    return {
        beneficiaire: { nom, prenom, dateNaissance: '', telephone: '', adresse: '', pathologie: '', typeIntervention: '', frequence: '' },
        tuteur: { nom: '', prenom: '', lien: '', telephone: '', telephoneFixe: '', mail: '' },
        moments: [{ id: uid(), titre: '', type: 'numerotee', etapes: [creerEtape()] }],
        procSpecifiquesTitre: 'Procédures spécifiques',
        procedures: [],
        objectifs: [creerEtape()],
        instructions: [creerEtape()],
        dispositif: { cahierCourses: false, cahierLiaison: false, cahierLiaisonNote: '', remiseCle: false, absenceRetard: '', niveauRemplacement: '', comportements: '', numeroAstreinte: '' },
        meta: { realiseLe: new Date().toLocaleDateString('fr-FR'), realisePar: '' },
    };
}

const ETAPES_FORM = [
    { cle: 'beneficiaire', libelle: 'Bénéficiaire' },
    { cle: 'tuteur', libelle: 'Tuteur' },
    { cle: 'programme', libelle: 'Programme' },
    { cle: 'procedures', libelle: 'Procédures' },
    { cle: 'objectifs', libelle: 'Objectifs' },
    { cle: 'dispositif', libelle: 'Dispositif' },
];

const CHAMP_CLASSES = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
const LABEL_CLASSES = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5';

function Champ({ label, value, onChange, type = 'text', area = false, placeholder }) {
    return (
        <div>
            <label className={LABEL_CLASSES}>{label}</label>
            {area ? (
                <textarea rows={2} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={CHAMP_CLASSES} />
            ) : (
                <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={CHAMP_CLASSES} />
            )}
        </div>
    );
}

function SegmentedToggle({ value, onChange, options }) {
    return (
        <div className='inline-flex rounded-lg border border-border overflow-hidden text-xs mb-2'>
            {options.map((o) => (
                <button key={o.value} type='button' onClick={() => onChange(o.value)} className={`px-2.5 py-1 font-medium transition-colors ${value === o.value ? 'bg-primary text-white' : 'bg-background hover:bg-muted text-muted-foreground'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function EtapeItem({ etape, numero, numerote, onChange, onRemove }) {
    function majSous(sousId, texte) {
        onChange({ ...etape, sous: etape.sous.map((s) => (s.id === sousId ? { ...s, texte } : s)) });
    }
    function ajouterSous() {
        onChange({ ...etape, sous: [...(etape.sous || []), { id: uid(), texte: '' }] });
    }
    function retirerSous(sousId) {
        onChange({ ...etape, sous: etape.sous.filter((s) => s.id !== sousId) });
    }
    return (
        <div className='rounded-lg border border-border bg-background p-2.5 mb-2'>
            <div className='flex items-start gap-2'>
                <span className='w-5 pt-2 text-xs font-semibold text-muted-foreground shrink-0'>{numerote ? `${numero}.` : '•'}</span>
                <div className='flex-1 min-w-0 flex flex-col gap-1.5'>
                    <input
                        type='text'
                        value={etape.label}
                        onChange={(e) => onChange({ ...etape, label: e.target.value })}
                        placeholder='Libellé en gras (optionnel, ex. « Préparation pour la douche »)'
                        className='text-sm font-semibold rounded-md border border-dashed border-border bg-muted/30 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30'
                    />
                    <textarea
                        rows={1}
                        value={etape.texte}
                        onChange={(e) => onChange({ ...etape, texte: e.target.value })}
                        placeholder="Détail de l'étape"
                        className='text-sm rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30'
                    />
                    {etape.sous.length > 0 && (
                        <div className='flex flex-col gap-1.5 pl-5'>
                            {etape.sous.map((s) => (
                                <div key={s.id} className='flex items-center gap-1.5'>
                                    <span className='text-xs text-muted-foreground shrink-0'>o</span>
                                    <input type='text' value={s.texte} onChange={(e) => majSous(s.id, e.target.value)} className='flex-1 text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30' />
                                    <button type='button' onClick={() => retirerSous(s.id)} className='shrink-0 text-muted-foreground hover:text-destructive transition-colors'><LuTrash2 size={13} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                    <button type='button' onClick={ajouterSous} className='self-start text-[11px] font-semibold text-primary hover:underline pl-5'>+ sous-étape</button>
                </div>
                <button type='button' onClick={onRemove} className='shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors'>✕</button>
            </div>
        </div>
    );
}

function BlocEtapes({ bloc, nomChamp, onChangeTitre, onChangeType, onRemoveBloc, onChangeEtapes, suggestions }) {
    const titre = nomChamp === 'titre' ? bloc.titre : bloc.nom;
    function majEtape(id, nouvelle) { onChangeEtapes(bloc.etapes.map((e) => (e.id === id ? nouvelle : e))); }
    function retirerEtape(id) { onChangeEtapes(bloc.etapes.filter((e) => e.id !== id)); }
    function ajouterEtape(texte = '') { onChangeEtapes([...bloc.etapes, creerEtape('', texte)]); }
    return (
        <div className='rounded-xl border border-border bg-muted/20 p-3 mb-3'>
            <div className='flex items-center gap-2 mb-2'>
                <input type='text' value={titre} onChange={(e) => onChangeTitre(e.target.value)} placeholder={nomChamp === 'titre' ? 'Nom du moment (ex. Avant de partir)' : 'Nom de la procédure (ex. Aspiration)'} className='flex-1 text-sm font-semibold rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30' />
                <button type='button' onClick={onRemoveBloc} className='shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors'><LuTrash2 size={14} /></button>
            </div>
            <SegmentedToggle value={bloc.type} onChange={onChangeType} options={[{ value: 'numerotee', label: '① Numéroté' }, { value: 'puces', label: '• Puces' }]} />
            {bloc.etapes.map((e, i) => (
                <EtapeItem key={e.id} etape={e} numero={i + 1} numerote={bloc.type !== 'puces'} onChange={(n) => majEtape(e.id, n)} onRemove={() => retirerEtape(e.id)} />
            ))}
            <button type='button' onClick={() => ajouterEtape()} className='text-xs font-semibold text-primary border border-dashed border-primary/40 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors'>+ Étape</button>
            {suggestions && (
                <div className='flex flex-wrap gap-1.5 mt-2.5'>
                    {SUGGESTIONS_ETAPES.map((s) => (
                        <button key={s} type='button' onClick={() => ajouterEtape(s)} className='text-[11px] font-semibold text-primary bg-primary/5 border border-dashed border-primary/30 rounded-full px-2.5 py-1 hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors'>{s}</button>
                    ))}
                </div>
            )}
        </div>
    );
}

function ListeSimple({ items, onChange }) {
    function maj(id, nouvelle) { onChange(items.map((e) => (e.id === id ? nouvelle : e))); }
    function retirer(id) { onChange(items.filter((e) => e.id !== id)); }
    return (
        <>
            {items.map((e, i) => (
                <EtapeItem key={e.id} etape={e} numero={i + 1} numerote={false} onChange={(n) => maj(e.id, n)} onRemove={() => retirer(e.id)} />
            ))}
            <button type='button' onClick={() => onChange([...items, creerEtape()])} className='text-xs font-semibold text-primary border border-dashed border-primary/40 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors'>+ Ajouter une ligne</button>
        </>
    );
}

function contenuNonVide(e) { return e.texte.trim() || e.label.trim() || (e.sous || []).some((s) => s.texte.trim()); }

function ListeApercu({ etapes, numerote }) {
    const items = etapes.filter(contenuNonVide);
    if (!items.length) return <p className='text-xs italic text-muted-foreground'>Aucune étape.</p>;
    const Tag = numerote ? 'ol' : 'ul';
    return (
        <Tag className={`${numerote ? 'list-decimal' : 'list-disc'} pl-5 mb-2 space-y-1 text-[13px]`}>
            {items.map((e) => (
                <li key={e.id}>
                    {e.label && <b>{e.label}{e.texte ? ' : ' : ''}</b>}{e.texte}
                    {(e.sous || []).some((s) => s.texte.trim()) && (
                        <ul className='list-none pl-4 mt-1 space-y-0.5'>
                            {e.sous.filter((s) => s.texte.trim()).map((s) => <li key={s.id}>o {s.texte}</li>)}
                        </ul>
                    )}
                </li>
            ))}
        </Tag>
    );
}

function Apercu({ p }) {
    const { beneficiaire: b, tuteur: t, dispositif: d } = p;
    const nomComplet = `${b.prenom} ${b.nom}`.trim() || '…';
    return (
        <div className='rounded-xl border border-border bg-white text-slate-800 shadow-sm p-6 text-[13px] leading-relaxed max-h-[76vh] overflow-y-auto'>
            <div className='flex items-center gap-3 border-b-2 border-red-700 pb-2.5 mb-4'>
                <div className='w-10 h-10 rounded-full bg-primary border-2 border-accent text-white flex items-center justify-center text-[11px] font-bold shrink-0'>HIS</div>
                <div>
                    <div className='font-bold text-primary text-[13px]'>HETEP-IAOUT SERVICES</div>
                    <div className='italic text-slate-500 text-[11px]'>« L'utilité sur le chemin de la sérénité »</div>
                </div>
            </div>
            <div className='text-center text-red-700 font-bold text-[15px] underline uppercase mb-4'>Protocole de prise en charge de {nomComplet}</div>

            <h2 className='text-[11px] font-bold uppercase tracking-wide text-red-700 border-l-[3px] border-red-700 pl-2 mt-4 mb-1.5'>Identité du bénéficiaire</h2>
            <div className='grid grid-cols-2 gap-x-4 gap-y-0.5'><div><b>Nom :</b> {b.nom || '—'}</div><div><b>Prénom :</b> {b.prenom || '—'}</div></div>
            <div className='grid grid-cols-2 gap-x-4 gap-y-0.5'><div><b>Téléphone :</b> {b.telephone || '—'}</div><div><b>Pathologie :</b> {b.pathologie || '—'}</div></div>
            <div className='grid grid-cols-2 gap-x-4 gap-y-0.5'><div><b>Intervention :</b> {b.typeIntervention || '—'}</div><div><b>Fréquence :</b> {b.frequence || '—'}</div></div>
            {b.adresse && <div className='mt-0.5'><b>Adresse :</b> {b.adresse}</div>}

            <h2 className='text-[11px] font-bold uppercase tracking-wide text-red-700 border-l-[3px] border-red-700 pl-2 mt-4 mb-1.5'>Identité du tuteur</h2>
            <div className='grid grid-cols-2 gap-x-4 gap-y-0.5'><div><b>Nom :</b> {t.nom || '—'}</div><div><b>Prénom :</b> {t.prenom || '—'}</div></div>
            <div className='grid grid-cols-2 gap-x-4 gap-y-0.5'><div><b>Lien :</b> {t.lien || '—'}</div><div><b>Téléphone :</b> {t.telephone || '—'}</div></div>
            {t.mail && <div className='mt-0.5'><b>Mail :</b> {t.mail}</div>}

            <h2 className='text-[11px] font-bold uppercase tracking-wide text-red-700 border-l-[3px] border-red-700 pl-2 mt-4 mb-1.5'>Description des interventions</h2>
            {p.moments.length === 0 && <p className='text-xs italic text-muted-foreground'>Aucun moment défini pour l'instant.</p>}
            {p.moments.map((m) => (
                <div key={m.id}>
                    <div className='font-bold mt-2.5 mb-1'>{m.titre || 'Moment sans titre'} :</div>
                    <ListeApercu etapes={m.etapes} numerote={m.type !== 'puces'} />
                </div>
            ))}
            {p.procedures.length > 0 && (
                <>
                    <div className='font-bold mt-3.5 mb-1'>{p.procSpecifiquesTitre || 'Procédures spécifiques'} :</div>
                    {p.procedures.map((pr) => (
                        <div key={pr.id}>
                            <div className='font-bold mt-2.5 mb-1'>{pr.nom || 'Procédure sans nom'} :</div>
                            <ListeApercu etapes={pr.etapes} numerote={pr.type !== 'puces'} />
                        </div>
                    ))}
                </>
            )}

            <h2 className='text-[11px] font-bold uppercase tracking-wide text-red-700 border-l-[3px] border-red-700 pl-2 mt-4 mb-1.5'>Objectifs de la prise en charge</h2>
            <ListeApercu etapes={p.objectifs} numerote={false} />
            <h2 className='text-[11px] font-bold uppercase tracking-wide text-red-700 border-l-[3px] border-red-700 pl-2 mt-4 mb-1.5'>Instructions particulières</h2>
            <ListeApercu etapes={p.instructions} numerote={false} />

            <h2 className='text-[11px] font-bold uppercase tracking-wide text-red-700 border-l-[3px] border-red-700 pl-2 mt-4 mb-1.5'>Dispositif à mettre en place</h2>
            <table className='w-full border-collapse text-xs mt-1'>
                <tbody>
                    <tr><td className='border border-slate-200 bg-slate-50 font-semibold w-[42%] p-1.5'>Cahier de courses</td><td className='border border-slate-200 p-1.5'>{d.cahierCourses ? 'Oui' : 'Non'}</td></tr>
                    <tr><td className='border border-slate-200 bg-slate-50 font-semibold p-1.5'>Cahier de liaison</td><td className='border border-slate-200 p-1.5'>{d.cahierLiaison ? 'Oui' : 'Non'}{d.cahierLiaisonNote ? ` — ${d.cahierLiaisonNote}` : ''}</td></tr>
                    <tr><td className='border border-slate-200 bg-slate-50 font-semibold p-1.5'>Remise de clé</td><td className='border border-slate-200 p-1.5'>{d.remiseCle ? 'Oui' : 'Non'}</td></tr>
                    <tr><td className='border border-slate-200 bg-slate-50 font-semibold p-1.5'>En cas d'absence ou de retard</td><td className='border border-slate-200 p-1.5'>{d.absenceRetard || '—'}</td></tr>
                    <tr><td className='border border-slate-200 bg-slate-50 font-semibold p-1.5'>Niveau de remplacement</td><td className='border border-slate-200 p-1.5'>{d.niveauRemplacement || '—'}</td></tr>
                    <tr><td className='border border-slate-200 bg-slate-50 font-semibold p-1.5'>Comportements particuliers</td><td className='border border-slate-200 p-1.5'>{d.comportements || '—'}</td></tr>
                    <tr><td className='border border-slate-200 bg-slate-50 font-semibold p-1.5'>Numéro d'astreinte</td><td className='border border-slate-200 p-1.5'>{d.numeroAstreinte || '—'}</td></tr>
                </tbody>
            </table>

            <div className='mt-5 pt-2.5 border-t border-slate-200 text-center text-[9px] text-slate-400 leading-relaxed'>
                8 place Georges Braque, 93120 La Courneuve — Tél : 01 43 52 64 23<br />
                Sarl au capital de 6000 euros — Siret : 493 761 175 00030 R.C.S. Bobigny — APE 9609Z — Agrément qualité préfectorale : SAP493761175
            </div>
        </div>
    );
}

function ProtocolePai() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { hasPermission, isAdministrator } = usePermissions();
    const peutGererPai = isAdministrator || hasPermission('gerer_pai');
    // /pai/nouveau/protocole : pas encore de dossier — le formulaire sert à la
    // fois à rédiger le protocole ET à créer le dossier en un seul geste (plus
    // besoin de remplir un premier formulaire "créer le dossier" séparé avant
    // de pouvoir rédiger quoi que ce soit).
    const estNouveau = id === 'nouveau';

    const [dossier, setDossier] = useState(null);
    const [loading, setLoading] = useState(!estNouveau);
    const [p, setP] = useState(estNouveau ? protocoleVide(null) : null);
    const [etape, setEtape] = useState(0);
    const [vueMobile, setVueMobile] = useState('form');
    const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
    const [exportEnCours, setExportEnCours] = useState(false);
    const [responsables, setResponsables] = useState([]);
    const [responsableSecteurId, setResponsableSecteurId] = useState('');

    const fetchDossier = useCallback(() => {
        if (estNouveau) return;
        setLoading(true);
        getPaiDossier(id).then(async (res) => {
            if (res.status === 200) {
                const data = await res.json();
                setDossier(data);
                setP(data.protocole && Object.keys(data.protocole).length ? data.protocole : protocoleVide(data));
            } else {
                toast.error("Ce dossier n'est pas accessible");
            }
        }).catch(() => toast.error('Erreur de chargement')).finally(() => setLoading(false));
    }, [id, estNouveau]);

    useEffect(() => { fetchDossier(); }, [fetchDossier]);

    useEffect(() => {
        if (!estNouveau) return;
        getPersonnels().then(async (res) => {
            if (res.status === 200) {
                const data = await res.json();
                setResponsables(data.filter((pers) => pers.user?.roles?.some((r) => r.code_role?.startsWith(PREFIXE_CODE_ROLE_RESPONSABLE_SECTEUR))));
            }
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!peutGererPai && !loading) {
        // Rédaction réservée à gerer_pai (même règle que le reste du dossier) —
        // la lecture seule n'a pas d'intérêt ici, contrairement aux objectifs :
        // le protocole est un document de travail, pas un suivi à consulter.
        return (
            <div className='max-w-2xl mx-auto py-16 text-center text-muted-foreground'>
                Vous n'avez pas la permission de rédiger un protocole de prise en charge.
            </div>
        );
    }

    if (loading || !p) {
        return <div className='flex items-center justify-center py-16 text-muted-foreground'><LuLoader className='animate-spin' size={22} /></div>;
    }

    function majSection(cle, valeur) { setP({ ...p, [cle]: valeur }); }
    function majChamp(section, champ, valeur) { setP({ ...p, [section]: { ...p[section], [champ]: valeur } }); }

    function ajouterMoment() { majSection('moments', [...p.moments, { id: uid(), titre: '', type: 'numerotee', etapes: [creerEtape()] }]); }
    function ajouterProcedure() { majSection('procedures', [...p.procedures, { id: uid(), nom: '', type: 'numerotee', etapes: [creerEtape()] }]); }
    function insererModele(nom) { majSection('procedures', [...p.procedures, creerBlocModele(nom, MODELES_PROCEDURES[nom])]); }

    async function enregistrer() {
        if (estNouveau) {
            if (!p.beneficiaire.nom.trim() && !p.beneficiaire.prenom.trim()) {
                toast.error('Indiquez au moins le nom du bénéficiaire (onglet Bénéficiaire).');
                setEtape(0);
                return;
            }
            if (!responsableSecteurId) {
                toast.error('Sélectionnez un responsable secteur (onglet Bénéficiaire).');
                setEtape(0);
                return;
            }
        }
        try {
            setEnregistrementEnCours(true);
            const res = estNouveau ? await creerPaiAvecProtocole(responsableSecteurId, p) : await updatePaiProtocole(id, p);
            if (res.status === 200 || res.status === 201) {
                const data = await res.json();
                if (estNouveau) {
                    toast.success('Dossier créé');
                    navigate(`/pai/${data.id}/protocole`, { replace: true });
                } else {
                    toast.success('Protocole enregistré');
                    setDossier(data);
                }
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data?.error || "L'enregistrement a échoué");
            }
        } catch {
            toast.error("L'enregistrement a échoué");
        } finally {
            setEnregistrementEnCours(false);
        }
    }

    async function exporterPdf() {
        try {
            setExportEnCours(true);
            const blob = await genererPdfProtocolePai(p);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Protocole - ${(p.beneficiaire.prenom + ' ' + p.beneficiaire.nom).trim() || dossier?.titre || 'bénéficiaire'}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("L'export a échoué");
        } finally {
            setExportEnCours(false);
        }
    }

    return (
        <div className='flex flex-col w-full gap-5 py-4'>
            <Breadcrumbs where={estNouveau ? 'Nouveau protocole' : `Protocole — ${dossier.titre}`} />

            <div className='rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <h1 className='text-lg font-bold text-foreground'>{estNouveau ? 'Nouveau protocole de prise en charge' : 'Protocole de prise en charge'}</h1>
                    <p className='text-sm text-muted-foreground mt-0.5'>
                        {estNouveau ? 'Remplissez le formulaire puis enregistrez : le dossier est créé automatiquement.' : (
                            <>
                                {dossier.titre}
                                {dossier.protocole_maj_le && ` · dernière mise à jour le ${new Date(dossier.protocole_maj_le).toLocaleDateString('fr-FR')}${dossier.protocole_maj_par ? ' par ' + dossier.protocole_maj_par : ''}`}
                            </>
                        )}
                    </p>
                </div>
                <div className='flex items-center gap-2'>
                    <button type='button' onClick={() => navigate(estNouveau ? '/pai' : -1)} className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors'>
                        <LuChevronLeft size={13} /> {estNouveau ? 'Annuler' : 'Retour au dossier'}
                    </button>
                    <button type='button' onClick={exporterPdf} disabled={exportEnCours} className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50'>
                        <LuDownload size={13} /> {exportEnCours ? 'Export...' : 'Exporter en PDF'}
                    </button>
                    <button type='button' onClick={enregistrer} disabled={enregistrementEnCours} className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                        <LuSave size={13} /> {enregistrementEnCours ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </div>

            <div className='grid lg:grid-cols-2 gap-5 items-start'>
                <div className='rounded-2xl border border-border bg-card overflow-hidden'>
                    <div className='flex gap-1 p-2 bg-muted/30 border-b border-border overflow-x-auto'>
                        {ETAPES_FORM.map((s, i) => (
                            <button key={s.cle} type='button' onClick={() => setEtape(i)} className={`shrink-0 whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${i === etape ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}>
                                {i + 1}. {s.libelle}
                            </button>
                        ))}
                    </div>
                    <div className='lg:hidden flex gap-2 px-3 pt-3'>
                        <button type='button' onClick={() => setVueMobile('form')} className={`flex-1 text-xs font-semibold rounded-lg py-2 border border-border ${vueMobile === 'form' ? 'bg-primary text-white border-primary' : 'bg-muted/30 text-muted-foreground'}`}>Formulaire</button>
                        <button type='button' onClick={() => setVueMobile('apercu')} className={`flex-1 text-xs font-semibold rounded-lg py-2 border border-border ${vueMobile === 'apercu' ? 'bg-primary text-white border-primary' : 'bg-muted/30 text-muted-foreground'}`}>Aperçu</button>
                    </div>

                    <div className={`p-5 max-h-[76vh] overflow-y-auto ${vueMobile !== 'form' ? 'hidden lg:block' : ''}`}>
                        {ETAPES_FORM[etape].cle === 'beneficiaire' && (
                            <div className='flex flex-col gap-3'>
                                <div className='grid sm:grid-cols-2 gap-3'>
                                    <Champ label='Nom' value={p.beneficiaire.nom} onChange={(v) => majChamp('beneficiaire', 'nom', v)} />
                                    <Champ label='Prénom' value={p.beneficiaire.prenom} onChange={(v) => majChamp('beneficiaire', 'prenom', v)} />
                                    <Champ label='Date de naissance' type='date' value={p.beneficiaire.dateNaissance} onChange={(v) => majChamp('beneficiaire', 'dateNaissance', v)} />
                                    <Champ label='Téléphone' type='tel' value={p.beneficiaire.telephone} onChange={(v) => majChamp('beneficiaire', 'telephone', v)} />
                                    <Champ label='Pathologie' value={p.beneficiaire.pathologie} onChange={(v) => majChamp('beneficiaire', 'pathologie', v)} />
                                    <Champ label="Type d'intervention" value={p.beneficiaire.typeIntervention} onChange={(v) => majChamp('beneficiaire', 'typeIntervention', v)} />
                                    <Champ label='Fréquence' value={p.beneficiaire.frequence} onChange={(v) => majChamp('beneficiaire', 'frequence', v)} />
                                    <Champ label='Réalisé par' value={p.meta.realisePar} onChange={(v) => majChamp('meta', 'realisePar', v)} />
                                </div>
                                <Champ label='Adresse' value={p.beneficiaire.adresse} onChange={(v) => majChamp('beneficiaire', 'adresse', v)} />
                                {estNouveau && (
                                    <div>
                                        <label className={LABEL_CLASSES}>Responsable secteur <span className='text-destructive'>*</span></label>
                                        <MenuDeroulant
                                            className='w-full'
                                            boutonClassName='w-full'
                                            value={responsableSecteurId}
                                            onChange={setResponsableSecteurId}
                                            placeholder='Sélectionner...'
                                            options={responsables.map((pers) => ({ value: pers.user?.id, label: `${pers.prenom} ${pers.nom}` }))}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {ETAPES_FORM[etape].cle === 'tuteur' && (
                            <div className='grid sm:grid-cols-2 gap-3'>
                                <Champ label='Nom' value={p.tuteur.nom} onChange={(v) => majChamp('tuteur', 'nom', v)} />
                                <Champ label='Prénom' value={p.tuteur.prenom} onChange={(v) => majChamp('tuteur', 'prenom', v)} />
                                <Champ label='Lien avec le bénéficiaire' value={p.tuteur.lien} onChange={(v) => majChamp('tuteur', 'lien', v)} />
                                <Champ label='Téléphone' type='tel' value={p.tuteur.telephone} onChange={(v) => majChamp('tuteur', 'telephone', v)} />
                                <Champ label='Téléphone fixe' type='tel' value={p.tuteur.telephoneFixe} onChange={(v) => majChamp('tuteur', 'telephoneFixe', v)} />
                                <Champ label='Mail' type='email' value={p.tuteur.mail} onChange={(v) => majChamp('tuteur', 'mail', v)} />
                            </div>
                        )}

                        {ETAPES_FORM[etape].cle === 'programme' && (
                            <div>
                                <p className='text-xs text-muted-foreground mb-3'>Découpez la journée en moments-clés, propres à ce bénéficiaire. Une étape peut avoir un libellé en gras et des sous-étapes imbriquées (ex. « Préparation pour la douche » → ses gestes).</p>
                                {p.moments.map((m) => (
                                    <BlocEtapes
                                        key={m.id}
                                        bloc={m}
                                        nomChamp='titre'
                                        suggestions
                                        onChangeTitre={(v) => majSection('moments', p.moments.map((x) => (x.id === m.id ? { ...x, titre: v } : x)))}
                                        onChangeType={(v) => majSection('moments', p.moments.map((x) => (x.id === m.id ? { ...x, type: v } : x)))}
                                        onRemoveBloc={() => majSection('moments', p.moments.filter((x) => x.id !== m.id))}
                                        onChangeEtapes={(etapes) => majSection('moments', p.moments.map((x) => (x.id === m.id ? { ...x, etapes } : x)))}
                                    />
                                ))}
                                <button type='button' onClick={ajouterMoment} className='w-full text-center text-xs font-semibold text-primary border border-dashed border-primary/40 rounded-lg py-2 hover:bg-primary/5 transition-colors'>+ Ajouter un moment de la journée</button>
                            </div>
                        )}

                        {ETAPES_FORM[etape].cle === 'procedures' && (
                            <div>
                                <p className='text-xs text-muted-foreground mb-3'>Gestes techniques précis (aspiration, change, pose d'un masque…). Apparaissent dans le document à la suite du programme, sous « Description des interventions ».</p>
                                <Champ label='Titre de la sous-section' value={p.procSpecifiquesTitre} onChange={(v) => majSection('procSpecifiquesTitre', v)} />
                                <div className='flex flex-wrap gap-1.5 my-3'>
                                    {Object.keys(MODELES_PROCEDURES).map((nom) => (
                                        <button key={nom} type='button' onClick={() => insererModele(nom)} className='text-[11px] font-semibold text-primary border border-primary rounded-full px-2.5 py-1 hover:bg-primary hover:text-white transition-colors'>+ Insérer « {nom} »</button>
                                    ))}
                                </div>
                                {p.procedures.map((pr) => (
                                    <BlocEtapes
                                        key={pr.id}
                                        bloc={pr}
                                        nomChamp='nom'
                                        onChangeTitre={(v) => majSection('procedures', p.procedures.map((x) => (x.id === pr.id ? { ...x, nom: v } : x)))}
                                        onChangeType={(v) => majSection('procedures', p.procedures.map((x) => (x.id === pr.id ? { ...x, type: v } : x)))}
                                        onRemoveBloc={() => majSection('procedures', p.procedures.filter((x) => x.id !== pr.id))}
                                        onChangeEtapes={(etapes) => majSection('procedures', p.procedures.map((x) => (x.id === pr.id ? { ...x, etapes } : x)))}
                                    />
                                ))}
                                <button type='button' onClick={ajouterProcedure} className='w-full text-center text-xs font-semibold text-primary border border-dashed border-primary/40 rounded-lg py-2 hover:bg-primary/5 transition-colors'>+ Ajouter une procédure vierge</button>
                            </div>
                        )}

                        {ETAPES_FORM[etape].cle === 'objectifs' && (
                            <div className='flex flex-col gap-5'>
                                <div>
                                    <h3 className='text-sm font-bold text-foreground mb-2'>Objectifs de la prise en charge</h3>
                                    <ListeSimple items={p.objectifs} onChange={(v) => majSection('objectifs', v)} />
                                </div>
                                <div>
                                    <h3 className='text-sm font-bold text-foreground mb-1'>Instructions particulières</h3>
                                    <p className='text-xs text-muted-foreground mb-2'>Un libellé en gras avant les deux points (ex. « Entretien du masque : ») est optionnel.</p>
                                    <ListeSimple items={p.instructions} onChange={(v) => majSection('instructions', v)} />
                                </div>
                            </div>
                        )}

                        {ETAPES_FORM[etape].cle === 'dispositif' && (
                            <div className='flex flex-col gap-3'>
                                {[
                                    ['cahierCourses', 'Cahier de courses'],
                                    ['cahierLiaison', 'Cahier de liaison'],
                                    ['remiseCle', 'Remise de clé'],
                                ].map(([champ, label]) => (
                                    <div key={champ} className='flex items-center justify-between gap-3 py-2 border-b border-border'>
                                        <span className='text-sm font-medium'>{label}</span>
                                        <SegmentedToggle value={p.dispositif[champ] ? 'oui' : 'non'} onChange={(v) => majChamp('dispositif', champ, v === 'oui')} options={[{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }]} />
                                    </div>
                                ))}
                                <Champ label='Précision cahier de liaison' value={p.dispositif.cahierLiaisonNote} onChange={(v) => majChamp('dispositif', 'cahierLiaisonNote', v)} />
                                <Champ label="En cas d'absence ou de retard" area value={p.dispositif.absenceRetard} onChange={(v) => majChamp('dispositif', 'absenceRetard', v)} />
                                <div className='grid sm:grid-cols-2 gap-3'>
                                    <Champ label='Niveau de remplacement' value={p.dispositif.niveauRemplacement} onChange={(v) => majChamp('dispositif', 'niveauRemplacement', v)} />
                                    <Champ label="Numéro d'astreinte" type='tel' value={p.dispositif.numeroAstreinte} onChange={(v) => majChamp('dispositif', 'numeroAstreinte', v)} />
                                </div>
                                <Champ label='Comportements particuliers / conduite à tenir' area value={p.dispositif.comportements} onChange={(v) => majChamp('dispositif', 'comportements', v)} />
                            </div>
                        )}
                    </div>

                    <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border bg-muted/20'>
                        <button type='button' disabled={etape === 0} onClick={() => setEtape(etape - 1)} className='inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground disabled:opacity-40 hover:text-foreground transition-colors'>
                            <LuChevronLeft size={14} /> Précédent
                        </button>
                        <button type='button' disabled={etape === ETAPES_FORM.length - 1} onClick={() => setEtape(etape + 1)} className='inline-flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-40 hover:underline'>
                            Suivant <LuChevronRight size={14} />
                        </button>
                    </div>
                </div>

                <div className={`${vueMobile !== 'apercu' ? 'hidden lg:block' : ''}`}>
                    <Apercu p={p} />
                </div>
            </div>
        </div>
    );
}

export default ProtocolePai;
