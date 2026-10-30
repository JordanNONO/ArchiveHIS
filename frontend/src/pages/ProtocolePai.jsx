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

const JOURS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const JOURS_LABEL = { LUN: 'Lundi', MAR: 'Mardi', MER: 'Mercredi', JEU: 'Jeudi', VEN: 'Vendredi', SAM: 'Samedi', DIM: 'Dimanche' };
const HEURE_MIN = 7;
const HEURE_MAX = 20;

// Procédures techniques standardisées, réutilisées d'un bénéficiaire à
// l'autre — insérées en un clic depuis l'onglet "Programme détaillé" plutôt
// que ressaisies à chaque fois, puis librement adaptées.
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
};

let compteurId = 0;
function uid() { compteurId += 1; return `n${Date.now()}_${compteurId}`; }
function creerEtape(label = '', texte = '') { return { id: uid(), label, texte, sous: [] }; }
function creerCreneau() { return { id: uid(), jour: 'LUN', debut: '09:00', fin: '10:00', label: '' }; }
function creerBlocModele(nom, modele) {
    return {
        id: uid(), titre: nom, nom, type: modele.type,
        etapes: modele.etapes.map((e) => ({ id: uid(), label: e.label || '', texte: e.texte || '', sous: (e.sous || []).map((s) => ({ id: uid(), texte: s })) })),
    };
}

function age(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr), t = new Date();
    let a = t.getFullYear() - d.getFullYear();
    if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
    return isNaN(a) ? null : a;
}
function formatDateFr(iso) {
    if (!iso) return '';
    const p = iso.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}
function hhmmToMin(t) { if (!t) return 0; const p = t.split(':'); return (+p[0]) * 60 + (+(p[1] || 0)); }
function fmtDureeMin(min) { const h = Math.floor(min / 60), m = Math.round(min % 60); return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`; }

function statsPlanning(creneaux) {
    const passages = creneaux.length;
    const minutesTotal = creneaux.reduce((s, c) => s + Math.max(0, hhmmToMin(c.fin) - hhmmToMin(c.debut)), 0);
    const jours = new Set(creneaux.map((c) => c.jour));
    const moy = passages ? minutesTotal / passages : 0;
    return { passages, heures: fmtDureeMin(minutesTotal), jours: jours.size, moy: fmtDureeMin(moy) };
}
function dureeJourTexte(creneaux, jour) {
    const crJour = creneaux.filter((c) => c.jour === jour);
    if (!crJour.length) return '—';
    return fmtDureeMin(crJour.reduce((s, c) => s + Math.max(0, hhmmToMin(c.fin) - hhmmToMin(c.debut)), 0));
}

function protocoleVide(dossier) {
    const parties = (dossier?.nom_beneficiaire || '').trim().split(/\s+/);
    const nom = parties.length > 1 ? parties.pop() : '';
    const prenom = parties.join(' ');
    return {
        beneficiaire: { nom, prenom, dateNaissance: '', telephone: '', adresse: '', pathologie: '', medecinTraitant: '', traitements: '' },
        tuteur: { nom: '', prenom: '', lien: '', telephone: '', telephoneFixe: '', mail: '', adresse: '' },
        historique: '',
        planning: { creneaux: [] },
        interventions: { description: '', tags: [] },
        moments: [],
        procSpecifiquesTitre: 'Procédures spécifiques',
        procedures: [],
        objectifs: '',
        dispositif: { cahierCourses: false, cahierLiaison: false, remiseCle: false, absenceRetard: '', niveauRemplacement: '', comportements: '', autres: '' },
        aSavoir: '',
        decision: null,
        faitA: 'La Courneuve',
        faitLe: '',
        meta: { realiseLe: new Date().toLocaleDateString('fr-FR'), realisePar: '' },
    };
}

const ETAPES_FORM = [
    { cle: 'beneficiaire', libelle: 'Bénéficiaire' },
    { cle: 'tuteur', libelle: 'Tuteur' },
    { cle: 'historique', libelle: 'Historique' },
    { cle: 'planning', libelle: 'Planning' },
    { cle: 'interventions', libelle: 'Interventions' },
    { cle: 'programme', libelle: 'Programme détaillé' },
    { cle: 'objectifs', libelle: 'Objectifs' },
    { cle: 'dispositif', libelle: 'Dispositif' },
];

const CHAMP_CLASSES = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
const LABEL_CLASSES = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5';

function Champ({ label, value, onChange, type = 'text', area = false, rows = 2, placeholder }) {
    return (
        <div>
            <label className={LABEL_CLASSES}>{label}</label>
            {area ? (
                <textarea rows={rows} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={CHAMP_CLASSES} />
            ) : (
                <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={CHAMP_CLASSES} />
            )}
        </div>
    );
}

function SegmentedToggle({ value, onChange, options }) {
    return (
        <div className='inline-flex rounded-lg border border-border overflow-hidden text-xs'>
            {options.map((o) => (
                <button key={o.value} type='button' onClick={() => onChange(o.value)} className={`px-2.5 py-1 font-medium transition-colors ${value === o.value ? 'bg-primary text-white' : 'bg-background hover:bg-muted text-muted-foreground'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function EtapeItem({ etape, numero, numerote, onChange, onRemove }) {
    function majSous(sousId, texte) { onChange({ ...etape, sous: etape.sous.map((s) => (s.id === sousId ? { ...s, texte } : s))}); }
    function ajouterSous() { onChange({ ...etape, sous: [...(etape.sous || []), { id: uid(), texte: '' }] }); }
    function retirerSous(sousId) { onChange({ ...etape, sous: etape.sous.filter((s) => s.id !== sousId) }); }
    return (
        <div className='rounded-lg border border-border bg-background p-2.5 mb-2'>
            <div className='flex items-start gap-2'>
                <span className='w-5 pt-2 text-xs font-semibold text-muted-foreground shrink-0'>{numerote ? `${numero}.` : '•'}</span>
                <div className='flex-1 min-w-0 flex flex-col gap-1.5'>
                    <input type='text' value={etape.label} onChange={(e) => onChange({ ...etape, label: e.target.value })} placeholder='Libellé en gras (optionnel)' className='text-sm font-semibold rounded-md border border-dashed border-border bg-muted/30 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30' />
                    <textarea rows={1} value={etape.texte} onChange={(e) => onChange({ ...etape, texte: e.target.value })} placeholder="Détail de l'étape" className='text-sm rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30' />
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

function BlocEtapes({ bloc, nomChamp, onChangeTitre, onChangeType, onRemoveBloc, onChangeEtapes }) {
    const titre = nomChamp === 'titre' ? bloc.titre : bloc.nom;
    function majEtape(id, nouvelle) { onChangeEtapes(bloc.etapes.map((e) => (e.id === id ? nouvelle : e))); }
    function retirerEtape(id) { onChangeEtapes(bloc.etapes.filter((e) => e.id !== id)); }
    return (
        <div className='rounded-xl border border-border bg-muted/20 p-3 mb-3'>
            <div className='flex items-center gap-2 mb-2'>
                <input type='text' value={titre} onChange={(e) => onChangeTitre(e.target.value)} placeholder={nomChamp === 'titre' ? 'Nom du moment (ex. Avant de partir)' : 'Nom de la procédure (ex. Aspiration)'} className='flex-1 text-sm font-semibold rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30' />
                <button type='button' onClick={onRemoveBloc} className='shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors'><LuTrash2 size={14} /></button>
            </div>
            <div className='mb-2'><SegmentedToggle value={bloc.type} onChange={onChangeType} options={[{ value: 'numerotee', label: '① Numéroté' }, { value: 'puces', label: '• Puces' }]} /></div>
            {bloc.etapes.map((e, i) => (
                <EtapeItem key={e.id} etape={e} numero={i + 1} numerote={bloc.type !== 'puces'} onChange={(n) => majEtape(e.id, n)} onRemove={() => retirerEtape(e.id)} />
            ))}
            <button type='button' onClick={() => onChangeEtapes([...bloc.etapes, creerEtape()])} className='text-xs font-semibold text-primary border border-dashed border-primary/40 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors'>+ Étape</button>
        </div>
    );
}

// ---------------- planning (tableau, pas un agenda flottant) ----------------

function TableauPlanning({ creneaux }) {
    const rows = [];
    for (let h = HEURE_MIN; h < HEURE_MAX; h++) rows.push(h);

    const occ = {};
    JOURS.forEach((j) => {
        occ[j] = rows.map(() => null);
        creneaux.filter((c) => c.jour === j).forEach((c) => {
            const hDeb = Math.floor(hhmmToMin(c.debut) / 60);
            const hFin = Math.ceil(hhmmToMin(c.fin) / 60);
            const startIdx = Math.max(0, hDeb - HEURE_MIN);
            const endIdx = Math.min(rows.length, Math.max(startIdx + 1, hFin - HEURE_MIN));
            for (let i = startIdx; i < endIdx; i++) occ[j][i] = i === startIdx ? { span: endIdx - startIdx, c } : 'skip';
        });
    });

    return (
        <table className='w-full border-collapse text-[11px]' style={{ fontFamily: 'inherit' }}>
            <thead>
                <tr>
                    <th className='border border-slate-300 bg-primary' style={{ width: 30 }}></th>
                    {JOURS.map((j) => (
                        <th key={j} className='border border-slate-300 bg-primary text-white py-1.5 px-0.5'>
                            <b className='block font-bold text-[9.5px]'>{j}</b>
                            <span className='block text-[7.5px] font-semibold text-white/65 mt-0.5'>{dureeJourTexte(creneaux, j)}</span>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((h, ri) => (
                    <tr key={h}>
                        <td className='border border-slate-300 bg-slate-50 text-[7.5px] font-semibold text-muted-foreground text-center' style={{ height: 18 }}>{h}h</td>
                        {JOURS.map((j) => {
                            const cell = occ[j][ri];
                            if (cell === 'skip') return null;
                            if (cell && cell.span) {
                                return (
                                    <td key={j} rowSpan={cell.span} className='border border-slate-300 text-white text-center align-middle px-0.5 text-[7.8px] font-semibold leading-tight' style={{ background: 'linear-gradient(160deg,#1b365d,#2c4b7c)' }}>
                                        {cell.c.debut}–{cell.c.fin}
                                        {cell.c.label && <span className='block font-medium opacity-90'>{cell.c.label}</span>}
                                    </td>
                                );
                            }
                            const journeeVide = occ[j].every((x) => x === null);
                            return <td key={j} className='border border-slate-300' style={journeeVide ? { background: 'repeating-linear-gradient(135deg,#eef0f4 0 6px,#f8f9fb 6px 12px)' } : undefined} />;
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function EditeurPlanning({ creneaux, onChange }) {
    function maj(id, champ, val) { onChange(creneaux.map((c) => (c.id === id ? { ...c, [champ]: val } : c))); }
    function retirer(id) { onChange(creneaux.filter((c) => c.id !== id)); }
    return (
        <div>
            {creneaux.map((c) => (
                <div key={c.id} className='grid grid-cols-[1fr_auto_auto_1.4fr_auto] gap-1.5 items-center mb-2'>
                    <select value={c.jour} onChange={(e) => maj(c.id, 'jour', e.target.value)} className='text-xs rounded-lg border border-border bg-background px-2 py-2'>
                        {JOURS.map((j) => <option key={j} value={j}>{JOURS_LABEL[j]}</option>)}
                    </select>
                    <input type='time' value={c.debut} onChange={(e) => maj(c.id, 'debut', e.target.value)} className='text-xs rounded-lg border border-border bg-background px-1.5 py-2 w-[88px]' />
                    <input type='time' value={c.fin} onChange={(e) => maj(c.id, 'fin', e.target.value)} className='text-xs rounded-lg border border-border bg-background px-1.5 py-2 w-[88px]' />
                    <input type='text' value={c.label} onChange={(e) => maj(c.id, 'label', e.target.value)} placeholder='Ex. Toilette · ménage' className='text-xs rounded-lg border border-border bg-background px-2 py-2 min-w-0' />
                    <button type='button' onClick={() => retirer(c.id)} className='shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors'>✕</button>
                </div>
            ))}
            <button type='button' onClick={() => onChange([...creneaux, creerCreneau()])} className='text-xs font-semibold text-primary border border-dashed border-primary/40 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors'>+ Ajouter un créneau</button>
        </div>
    );
}

function contenuNonVide(e) { return e.texte.trim() || e.label.trim() || (e.sous || []).some((s) => s.texte.trim()); }

function ListeApercu({ etapes, numerote }) {
    const items = etapes.filter(contenuNonVide);
    if (!items.length) return null;
    const Tag = numerote ? 'ol' : 'ul';
    return (
        <Tag className={`${numerote ? 'list-decimal' : 'list-disc'} pl-5 mb-2 space-y-1 text-[11.5px]`}>
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

function SectionTitre({ n, children }) {
    return (
        <>
            <div className='flex items-center gap-2 mt-5 mb-1 first:mt-0'>
                <span className='shrink-0 w-[21px] h-[21px] rounded-md bg-primary text-white text-[10.5px] font-bold flex items-center justify-center'>{n}</span>
                <span className='italic font-semibold text-[15px]' style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: '#a4231a' }}>{children}</span>
            </div>
            <div className='h-[1.5px] mb-3' style={{ background: '#a4231a', opacity: .35 }} />
        </>
    );
}

function InfoItem({ label, value }) {
    return (
        <div>
            <span className='block text-[8.5px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5'>{label}</span>
            <b className='text-[12.5px] font-semibold'>{value || '—'}</b>
        </div>
    );
}

function Apercu({ p, responsableSecteurNom }) {
    const { beneficiaire: b, tuteur: t, dispositif: d } = p;
    const nomComplet = `${b.prenom} ${b.nom}`.trim() || '…';
    const ageVal = age(b.dateNaissance);
    const st = statsPlanning(p.planning.creneaux);
    const tagsPresents = p.interventions.tags.filter((x) => x.trim());
    const docStyle = { fontFamily: "'Inter', sans-serif", color: '#182235' };

    const entete = (
        <div className='flex items-start justify-between border-b-2' style={{ borderImage: 'linear-gradient(90deg,#1b365d,#facc15) 1' }}>
            <div className='flex items-center gap-2.5 pb-2.5'>
                <div className='w-8 h-8 rounded-full bg-primary border-[1.5px] border-accent text-white flex items-center justify-center text-[9.5px] font-extrabold shrink-0'>HIS</div>
            </div>
            <div className='text-right pb-2.5'>
                <b className='text-[11.5px] text-primary block'>HETEP-IAOUT SERVICES</b>
                <div className='italic text-slate-400 text-[9.5px]'>« L'utilité sur le chemin de la sérénité »</div>
                <div className='text-[8.5px] text-slate-300 uppercase tracking-wide mt-0.5'>PIAA · Mme {nomComplet.toUpperCase()}</div>
            </div>
        </div>
    );

    return (
        <div className='max-h-[80vh] overflow-y-auto flex flex-col gap-4'>
            {/* couverture */}
            <div className='rounded-md border border-border bg-white shadow-sm px-7 py-6' style={docStyle}>
                <div className='flex justify-between items-start'>
                    <div className='w-[54px] h-[54px] rounded-full bg-primary border-2 border-accent text-white flex items-center justify-center text-sm font-extrabold'>HIS</div>
                    <div className='text-right'>
                        <b className='text-xs text-primary block'>HETEP-IAOUT SERVICES</b>
                        <div className='text-[9.5px] text-slate-400 uppercase tracking-wide mt-0.5'>Service d'aide à domicile</div>
                    </div>
                </div>
                <div className='text-center mt-6'>
                    <span className='inline-block text-[10px] font-bold tracking-wide text-primary bg-primary/10 border border-primary/20 rounded-full px-3.5 py-1'>DOCUMENT DE PRISE EN CHARGE</span>
                </div>
                <div className='text-center mt-4'>
                    <div className='font-bold text-[22px] leading-tight' style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: '#a4231a' }}>Projet Individualisé d'Aide<br />et d'Accompagnement</div>
                    <div className='font-semibold text-base mt-2' style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Mme {nomComplet.toUpperCase()}</div>
                    <div className='text-[11px] text-slate-400 mt-1'>
                        {b.dateNaissance && `Né(e) le ${formatDateFr(b.dateNaissance)}${ageVal !== null ? ` · ${ageVal} ans` : ''} · `}{b.adresse}
                    </div>
                </div>
                <div className='h-[180px] rounded-2xl mt-5 relative overflow-hidden' style={{ boxShadow: '0 14px 34px -14px rgba(20,30,50,.35)', background: 'linear-gradient(135deg,#dfe7f2 0%,#eef2f8 45%,#f6ecd9 75%,#f1ddd6 100%)' }}>
                    <div className='absolute inset-0 flex items-center justify-center text-[10px] italic text-slate-400' style={{ background: 'repeating-linear-gradient(135deg, rgba(27,54,93,.04) 0 12px, transparent 12px 24px)' }}>
                        📷 photo à charger
                    </div>
                </div>
                <div className='text-center mt-5'>
                    <b className='text-sm text-primary' style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>HETEP IAOUT SERVICES (HIS)</b>
                    <div className='italic text-slate-400 text-[11px] mt-0.5'>« L'utilité sur le chemin de la sérénité »</div>
                </div>
                <div className='grid grid-cols-3 gap-2.5 mt-5'>
                    <div className='border border-border rounded-lg px-3 py-2.5'><span className='block text-[8px] font-bold uppercase text-muted-foreground mb-1.5'>Réalisé le</span><b className='text-xs'>{p.meta.realiseLe || '—'}</b></div>
                    <div className='border border-border rounded-lg px-3 py-2.5'><span className='block text-[8px] font-bold uppercase text-muted-foreground mb-1.5'>Réalisé par</span><b className='text-xs'>{p.meta.realisePar || '—'}</b></div>
                    <div className='border border-border rounded-lg px-3 py-2.5'><span className='block text-[8px] font-bold uppercase text-muted-foreground mb-1.5'>Responsable de secteur</span><b className='text-xs'>{responsableSecteurNom || '—'}</b></div>
                </div>
            </div>

            {/* page 2 */}
            <div className='rounded-md border border-border bg-white shadow-sm px-6 py-5' style={docStyle}>
                {entete}
                <SectionTitre n='01'>Identité du bénéficiaire</SectionTitre>
                <div className='rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5'>
                    <InfoItem label='Nom(s)' value={b.nom} /><InfoItem label='Prénom(s)' value={b.prenom} />
                    <InfoItem label='Date de naissance' value={b.dateNaissance ? `${formatDateFr(b.dateNaissance)}${ageVal !== null ? ` (${ageVal} ans)` : ''}` : null} />
                    <InfoItem label='Téléphone' value={b.telephone} />
                    <div className='col-span-2'><InfoItem label='Adresse' value={b.adresse} /></div>
                    <InfoItem label='Pathologie' value={b.pathologie} /><InfoItem label='Médecin traitant' value={b.medecinTraitant} />
                    <div className='col-span-2'><InfoItem label='Traitement(s)' value={b.traitements} /></div>
                </div>
                <SectionTitre n='02'>Identité du tuteur</SectionTitre>
                <div className='rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5'>
                    <InfoItem label='Nom(s)' value={t.nom} /><InfoItem label='Prénom(s)' value={t.prenom} />
                    <InfoItem label='Lien avec le bénéficiaire' value={t.lien} /><InfoItem label='Téléphone' value={t.telephone} />
                    <InfoItem label='Téléphone fixe' value={t.telephoneFixe} /><InfoItem label='E-mail' value={t.mail} />
                    <div className='col-span-2'><InfoItem label='Adresse' value={t.adresse} /></div>
                </div>
                <SectionTitre n='03'>Historique de la pathologie ou de sa survenance</SectionTitre>
                <p className='text-[12px] leading-relaxed text-slate-600 whitespace-pre-line'>{p.historique || '—'}</p>
            </div>

            {/* page 3 */}
            <div className='rounded-md border border-border bg-white shadow-sm px-6 py-5' style={docStyle}>
                {entete}
                <SectionTitre n='04'>Organisation des prestations</SectionTitre>
                <p className='text-[12px] leading-relaxed text-slate-600 mb-3'>HIS intervient <b>{st.passages} fois par semaine</b> chez {b.nom ? `Mme ${b.nom}` : 'le/la bénéficiaire'} selon le planning ci-dessous.</p>
                <div className='grid grid-cols-4 gap-2.5 mb-3.5'>
                    <div className='rounded-lg bg-slate-50 px-3 py-2.5'><b className='block text-[19px] font-extrabold text-primary leading-none'>{st.passages}</b><span className='block text-[8px] font-bold uppercase text-muted-foreground mt-1'>Passages / semaine</span></div>
                    <div className='rounded-lg bg-slate-50 px-3 py-2.5'><b className='block text-[19px] font-extrabold text-primary leading-none'>{st.heures}</b><span className='block text-[8px] font-bold uppercase text-muted-foreground mt-1'>Heures / semaine</span></div>
                    <div className='rounded-lg bg-slate-50 px-3 py-2.5'><b className='block text-[19px] font-extrabold text-primary leading-none'>{st.jours}</b><span className='block text-[8px] font-bold uppercase text-muted-foreground mt-1'>Jours d'intervention</span></div>
                    <div className='rounded-lg px-3 py-2.5' style={{ background: '#fbeae8' }}><b className='block text-[19px] font-extrabold leading-none' style={{ color: '#a4231a' }}>{st.moy}</b><span className='block text-[8px] font-bold uppercase text-muted-foreground mt-1'>Durée moy. passage</span></div>
                </div>
                <TableauPlanning creneaux={p.planning.creneaux} />

                <SectionTitre n='05'>Description des interventions</SectionTitre>
                <p className='text-[12px] leading-relaxed text-slate-600'>{p.interventions.description || '—'}</p>
                {tagsPresents.length > 0 && (
                    <div className='flex flex-wrap gap-1.5 mt-2.5'>
                        {tagsPresents.map((tag, i) => <span key={i} className='text-[10.5px] font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1'>{tag}</span>)}
                    </div>
                )}

                <SectionTitre n='06'>Objectifs de la prise en charge</SectionTitre>
                <p className='text-[12px] leading-relaxed text-slate-600'>{p.objectifs || '—'}</p>

                {(p.moments.length > 0 || p.procedures.length > 0) && (
                    <>
                        <div className='flex items-center gap-2 mt-5 mb-1'>
                            <span className='shrink-0 w-[21px] h-[21px] rounded-md text-white text-[10.5px] font-bold flex items-center justify-center' style={{ background: '#a4231a' }}>+</span>
                            <span className='italic font-semibold text-[15px]' style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: '#a4231a' }}>Programme détaillé</span>
                        </div>
                        <div className='h-[1.5px] mb-3' style={{ background: '#a4231a', opacity: .35 }} />
                        {p.moments.map((m) => (
                            <div key={m.id}>
                                <p className='text-[12px] font-bold mb-0.5'>{m.titre || 'Moment'} :</p>
                                <ListeApercu etapes={m.etapes} numerote={m.type !== 'puces'} />
                            </div>
                        ))}
                        {p.procedures.length > 0 && p.procSpecifiquesTitre && <p className='text-[12px] font-bold mt-2'>{p.procSpecifiquesTitre} :</p>}
                        {p.procedures.map((pr) => (
                            <div key={pr.id}>
                                <p className='text-[12px] font-bold mb-0.5'>{pr.nom || 'Procédure'} :</p>
                                <ListeApercu etapes={pr.etapes} numerote={pr.type !== 'puces'} />
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* page 4 */}
            <div className='rounded-md border border-border bg-white shadow-sm px-6 py-5' style={docStyle}>
                {entete}
                <SectionTitre n='07'>Dispositif à mettre en place</SectionTitre>
                <table className='w-full text-[11.5px]'>
                    <tbody>
                        {[
                            ['Cahier de courses', d.cahierCourses], ['Cahier de liaison', d.cahierLiaison], ['Remise de clé', d.remiseCle],
                        ].map(([label, val]) => (
                            <tr key={label} className='border-b border-slate-100'>
                                <td className='py-2 font-bold w-[46%]'>{label}</td>
                                <td className='py-2'>{val ? <span className='inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2.5 py-0.5' style={{ color: '#1f7a45', background: '#e4f5ea' }}>Oui</span> : <span className='inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2.5 py-0.5 text-muted-foreground bg-muted'>Non</span>}</td>
                            </tr>
                        ))}
                        {[
                            ["En cas d'absence ou de retard", d.absenceRetard], ['Niveau de remplacement', d.niveauRemplacement], ['Comportements particuliers', d.comportements], ['Autres', d.autres],
                        ].map(([label, val]) => (
                            <tr key={label} className='border-b border-slate-100'><td className='py-2 font-bold w-[46%] align-top'>{label}</td><td className='py-2 align-top'>{val || '—'}</td></tr>
                        ))}
                    </tbody>
                </table>

                {p.aSavoir && (
                    <div className='mt-4 rounded-lg border p-3.5' style={{ borderColor: '#a4231a', background: '#fbeae8' }}>
                        <b className='text-[9.5px] font-bold uppercase tracking-wide' style={{ color: '#a4231a' }}>À savoir · PS</b>
                        <p className='italic text-[12px] mt-1.5 leading-relaxed' style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: '#4a2420' }}>{p.aSavoir}</p>
                    </div>
                )}

                <div className='grid grid-cols-2 gap-2.5 mt-4'>
                    <div className={`rounded-lg border-[1.5px] px-3 py-2.5 flex items-center gap-2 text-[11.5px] font-semibold ${p.decision === 'accepte' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <span className={`w-[15px] h-[15px] rounded-[4px] border-[1.5px] flex items-center justify-center text-[9px] text-white shrink-0 ${p.decision === 'accepte' ? 'bg-primary border-primary' : 'border-slate-300'}`}>{p.decision === 'accepte' && '✓'}</span>
                        Le bénéficiaire accepte le projet
                    </div>
                    <div className={`rounded-lg border-[1.5px] px-3 py-2.5 flex items-center gap-2 text-[11.5px] font-semibold ${p.decision === 'refuse' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <span className={`w-[15px] h-[15px] rounded-[4px] border-[1.5px] flex items-center justify-center text-[9px] text-white shrink-0 ${p.decision === 'refuse' ? 'bg-primary border-primary' : 'border-slate-300'}`}>{p.decision === 'refuse' && '✓'}</span>
                        Le bénéficiaire refuse le projet
                    </div>
                </div>
                <div className='flex gap-7 mt-4 text-[11px] text-muted-foreground'>
                    <div>Fait à<br /><b className='text-foreground'>{p.faitA || '—'}</b></div>
                    <div>Le<br /><b className='text-foreground'>{p.faitLe ? formatDateFr(p.faitLe) : '—'}</b></div>
                </div>
                <div className='grid grid-cols-2 gap-3.5 mt-3.5'>
                    <div className='rounded-lg border border-dashed border-border h-[70px] px-2.5 py-2 text-[9.5px] font-bold text-muted-foreground uppercase'>Signature du représentant<span className='block mt-7 text-[10.5px] font-semibold text-foreground normal-case'>HETEP-IAOUT SERVICES</span></div>
                    <div className='rounded-lg border border-dashed border-border h-[70px] px-2.5 py-2 text-[9.5px] font-bold text-muted-foreground uppercase'>Signature du bénéficiaire<span className='block mt-7 text-[10.5px] font-semibold text-foreground normal-case'>Mme {nomComplet}</span></div>
                </div>
            </div>
        </div>
    );
}

function ProtocolePai() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { hasPermission, isAdministrator } = usePermissions();
    const peutGererPai = isAdministrator || hasPermission('gerer_pai');
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
                setP(data.protocole && Object.keys(data.protocole).length ? { ...protocoleVide(data), ...data.protocole } : protocoleVide(data));
            } else {
                toast.error("Ce dossier n'est pas accessible");
            }
        }).catch(() => toast.error('Erreur de chargement')).finally(() => setLoading(false));
    }, [id, estNouveau]);

    useEffect(() => { fetchDossier(); }, [fetchDossier]);

    useEffect(() => {
        getPersonnels().then(async (res) => {
            if (res.status === 200) {
                const data = await res.json();
                setResponsables(data.filter((pers) => pers.user?.roles?.some((r) => r.code_role?.startsWith(PREFIXE_CODE_ROLE_RESPONSABLE_SECTEUR))));
            }
        }).catch(() => {});
    }, []);

    if (!peutGererPai && !loading) {
        return <div className='max-w-2xl mx-auto py-16 text-center text-muted-foreground'>Vous n'avez pas la permission de rédiger un protocole de prise en charge.</div>;
    }
    if (loading || !p) {
        return <div className='flex items-center justify-center py-16 text-muted-foreground'><LuLoader className='animate-spin' size={22} /></div>;
    }

    function majSection(cle, valeur) { setP({ ...p, [cle]: valeur }); }
    function majChamp(section, champ, valeur) { setP({ ...p, [section]: { ...p[section], [champ]: valeur } }); }

    const responsableSecteurNom = estNouveau
        ? responsables.find((r) => String(r.user?.id) === String(responsableSecteurId)) ? `${responsables.find((r) => String(r.user?.id) === String(responsableSecteurId)).prenom} ${responsables.find((r) => String(r.user?.id) === String(responsableSecteurId)).nom}` : ''
        : dossier?.responsable_secteur?.nom;

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
            const blob = await genererPdfProtocolePai(p, { responsableSecteur: responsableSecteurNom });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PIAA - ${(p.beneficiaire.prenom + ' ' + p.beneficiaire.nom).trim() || dossier?.titre || 'bénéficiaire'}.pdf`;
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
                            <>{dossier.titre}{dossier.protocole_maj_le && ` · dernière mise à jour le ${new Date(dossier.protocole_maj_le).toLocaleDateString('fr-FR')}${dossier.protocole_maj_par ? ' par ' + dossier.protocole_maj_par : ''}`}</>
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
                                    <Champ label='Médecin traitant' value={p.beneficiaire.medecinTraitant} onChange={(v) => majChamp('beneficiaire', 'medecinTraitant', v)} />
                                </div>
                                <Champ label='Adresse' value={p.beneficiaire.adresse} onChange={(v) => majChamp('beneficiaire', 'adresse', v)} />
                                <Champ label='Traitement(s)' value={p.beneficiaire.traitements} onChange={(v) => majChamp('beneficiaire', 'traitements', v)} area />
                                <div className='grid sm:grid-cols-2 gap-3 pt-2 border-t border-border'>
                                    <Champ label='Réalisé par' value={p.meta.realisePar} onChange={(v) => majChamp('meta', 'realisePar', v)} />
                                    {estNouveau ? (
                                        <div>
                                            <label className={LABEL_CLASSES}>Responsable secteur <span className='text-destructive'>*</span></label>
                                            <MenuDeroulant className='w-full' boutonClassName='w-full' value={responsableSecteurId} onChange={setResponsableSecteurId} placeholder='Sélectionner...' options={responsables.map((pers) => ({ value: pers.user?.id, label: `${pers.prenom} ${pers.nom}` }))} />
                                        </div>
                                    ) : (
                                        <div><label className={LABEL_CLASSES}>Responsable secteur</label><p className='text-sm py-2 text-muted-foreground'>{dossier.responsable_secteur?.nom || '—'} <span className='text-xs'>(modifiable depuis la page du dossier)</span></p></div>
                                    )}
                                </div>
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
                                <div className='sm:col-span-2'><Champ label='Adresse' value={p.tuteur.adresse} onChange={(v) => majChamp('tuteur', 'adresse', v)} /></div>
                                <p className='sm:col-span-2 text-xs text-muted-foreground -mt-1'>Laissez vide si aucun tuteur — la rubrique affichera des tirets, comme sur votre gabarit.</p>
                            </div>
                        )}

                        {ETAPES_FORM[etape].cle === 'historique' && (
                            <div>
                                <p className='text-xs text-muted-foreground mb-2'>Un paragraphe libre, repris tel quel dans le document.</p>
                                <Champ label='Historique de la pathologie ou de sa survenance' value={p.historique} onChange={(v) => majSection('historique', v)} area rows={6} />
                            </div>
                        )}

                        {ETAPES_FORM[etape].cle === 'planning' && (
                            <div>
                                <p className='text-xs text-muted-foreground mb-3'>Ajoutez un créneau par passage dans la semaine — le tableau et les 4 chiffres se calculent automatiquement.</p>
                                <EditeurPlanning creneaux={p.planning.creneaux} onChange={(v) => majSection('planning', { creneaux: v })} />
                            </div>
                        )}

                        {ETAPES_FORM[etape].cle === 'interventions' && (
                            <div>
                                <p className='text-xs text-muted-foreground mb-2'>Un court paragraphe, puis des étiquettes pour résumer le type d'aide.</p>
                                <Champ label='Paragraphe' value={p.interventions.description} onChange={(v) => majChamp('interventions', 'description', v)} area rows={3} />
                                <label className={`${LABEL_CLASSES} mt-3`}>Étiquettes</label>
                                <div className='flex flex-wrap gap-1.5 mb-2'>
                                    {p.interventions.tags.map((tag, i) => (
                                        <span key={i} className='inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full pl-3 pr-1.5 py-1'>
                                            <input type='text' value={tag} onChange={(e) => { const tags = [...p.interventions.tags]; tags[i] = e.target.value; majChamp('interventions', 'tags', tags); }} className='bg-transparent border-none outline-none text-xs font-semibold w-24' />
                                            <button type='button' onClick={() => majChamp('interventions', 'tags', p.interventions.tags.filter((_, idx) => idx !== i))} className='w-4 h-4 rounded-full flex items-center justify-center hover:bg-destructive hover:text-white transition-colors'>✕</button>
                                        </span>
                                    ))}
                                </div>
                                <button type='button' onClick={() => majChamp('interventions', 'tags', [...p.interventions.tags, 'Nouvelle étiquette'])} className='text-xs font-semibold text-primary border border-dashed border-primary/40 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors'>+ Étiquette</button>
                            </div>
                        )}

                        {ETAPES_FORM[etape].cle === 'programme' && (
                            <div>
                                <p className='text-xs text-muted-foreground mb-3'>Pour les prises en charge lourdes nécessitant un déroulé précis, geste par geste. Laissez vide pour un accompagnement simple — la rubrique n'apparaît pas dans le document si rien n'est rempli.</p>
                                {p.moments.map((m) => (
                                    <BlocEtapes key={m.id} bloc={m} nomChamp='titre'
                                        onChangeTitre={(v) => majSection('moments', p.moments.map((x) => (x.id === m.id ? { ...x, titre: v } : x)))}
                                        onChangeType={(v) => majSection('moments', p.moments.map((x) => (x.id === m.id ? { ...x, type: v } : x)))}
                                        onRemoveBloc={() => majSection('moments', p.moments.filter((x) => x.id !== m.id))}
                                        onChangeEtapes={(etapes) => majSection('moments', p.moments.map((x) => (x.id === m.id ? { ...x, etapes } : x)))} />
                                ))}
                                <button type='button' onClick={() => majSection('moments', [...p.moments, { id: uid(), titre: '', type: 'numerotee', etapes: [creerEtape()] }])} className='w-full text-center text-xs font-semibold text-primary border border-dashed border-primary/40 rounded-lg py-2 hover:bg-primary/5 transition-colors mb-5'>+ Ajouter un moment de la journée</button>

                                <Champ label='Titre de la sous-section procédures' value={p.procSpecifiquesTitre} onChange={(v) => majSection('procSpecifiquesTitre', v)} />
                                <div className='flex flex-wrap gap-1.5 my-3'>
                                    {Object.keys(MODELES_PROCEDURES).map((nom) => (
                                        <button key={nom} type='button' onClick={() => majSection('procedures', [...p.procedures, creerBlocModele(nom, MODELES_PROCEDURES[nom])])} className='text-[11px] font-semibold text-primary border border-primary rounded-full px-2.5 py-1 hover:bg-primary hover:text-white transition-colors'>+ Insérer « {nom} »</button>
                                    ))}
                                </div>
                                {p.procedures.map((pr) => (
                                    <BlocEtapes key={pr.id} bloc={pr} nomChamp='nom'
                                        onChangeTitre={(v) => majSection('procedures', p.procedures.map((x) => (x.id === pr.id ? { ...x, nom: v } : x)))}
                                        onChangeType={(v) => majSection('procedures', p.procedures.map((x) => (x.id === pr.id ? { ...x, type: v } : x)))}
                                        onRemoveBloc={() => majSection('procedures', p.procedures.filter((x) => x.id !== pr.id))}
                                        onChangeEtapes={(etapes) => majSection('procedures', p.procedures.map((x) => (x.id === pr.id ? { ...x, etapes } : x)))} />
                                ))}
                                <button type='button' onClick={() => majSection('procedures', [...p.procedures, { id: uid(), nom: '', type: 'numerotee', etapes: [creerEtape()] }])} className='w-full text-center text-xs font-semibold text-primary border border-dashed border-primary/40 rounded-lg py-2 hover:bg-primary/5 transition-colors'>+ Ajouter une procédure vierge</button>
                            </div>
                        )}

                        {ETAPES_FORM[etape].cle === 'objectifs' && (
                            <div>
                                <p className='text-xs text-muted-foreground mb-2'>Un paragraphe libre.</p>
                                <Champ label='Objectifs de la prise en charge' value={p.objectifs} onChange={(v) => majSection('objectifs', v)} area rows={5} />
                            </div>
                        )}

                        {ETAPES_FORM[etape].cle === 'dispositif' && (
                            <div className='flex flex-col gap-3'>
                                {[['cahierCourses', 'Cahier de courses'], ['cahierLiaison', 'Cahier de liaison'], ['remiseCle', 'Remise de clé']].map(([champ, label]) => (
                                    <div key={champ} className='flex items-center justify-between gap-3 py-2 border-b border-border'>
                                        <span className='text-sm font-medium'>{label}</span>
                                        <SegmentedToggle value={p.dispositif[champ] ? 'oui' : 'non'} onChange={(v) => majChamp('dispositif', champ, v === 'oui')} options={[{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }]} />
                                    </div>
                                ))}
                                <Champ label="En cas d'absence ou de retard" area value={p.dispositif.absenceRetard} onChange={(v) => majChamp('dispositif', 'absenceRetard', v)} />
                                <Champ label='Niveau de remplacement' value={p.dispositif.niveauRemplacement} onChange={(v) => majChamp('dispositif', 'niveauRemplacement', v)} />
                                <Champ label='Comportements particuliers' area value={p.dispositif.comportements} onChange={(v) => majChamp('dispositif', 'comportements', v)} />
                                <Champ label='Autres' area value={p.dispositif.autres} onChange={(v) => majChamp('dispositif', 'autres', v)} />
                                <Champ label='À savoir (encadré en fin de document)' area rows={3} value={p.aSavoir} onChange={(v) => majSection('aSavoir', v)} />
                                <div className='grid sm:grid-cols-2 gap-3 pt-2 border-t border-border'>
                                    <Champ label='Fait à' value={p.faitA} onChange={(v) => majSection('faitA', v)} />
                                    <Champ label='Le' type='date' value={p.faitLe} onChange={(v) => majSection('faitLe', v)} />
                                </div>
                                <div>
                                    <label className={LABEL_CLASSES}>Décision</label>
                                    <SegmentedToggle value={p.decision} onChange={(v) => majSection('decision', v)} options={[{ value: 'accepte', label: 'Accepte' }, { value: 'refuse', label: 'Refuse' }]} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border bg-muted/20'>
                        <button type='button' disabled={etape === 0} onClick={() => setEtape(etape - 1)} className='inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground disabled:opacity-40 hover:text-foreground transition-colors'><LuChevronLeft size={14} /> Précédent</button>
                        <button type='button' disabled={etape === ETAPES_FORM.length - 1} onClick={() => setEtape(etape + 1)} className='inline-flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-40 hover:underline'>Suivant <LuChevronRight size={14} /></button>
                    </div>
                </div>

                <div className={`${vueMobile !== 'apercu' ? 'hidden lg:block' : ''}`}>
                    <Apercu p={p} responsableSecteurNom={responsableSecteurNom} />
                </div>
            </div>
        </div>
    );
}

export default ProtocolePai;
