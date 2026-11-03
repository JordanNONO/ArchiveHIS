import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuLoader, LuTrash2, LuDownload, LuSave, LuChevronLeft, LuChevronRight, LuFileUp, LuCheck, LuPenLine, LuImagePlus, LuRotateCcw } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import MenuDeroulant from '../components/MenuDeroulant';
import ApercuPdfPai from '../components/ApercuPdfPai';
import SignaturePad from '../components/SignaturePad';
import { getPaiDossier, updatePaiProtocole, creerPaiAvecProtocole } from '../api/routes/pai';
import { getPersonnels } from '../api/routes/personnel';
import { genererPdfProtocolePai, phraseInterventions, civiliteBeneficiaire } from '../utils/protocolePaiPdf';
import { importerPaiDepuisPdf } from '../utils/importPaiPdf';
import { usePermissions } from '../hooks/usePermissions';
import photoCouverture from '../assets/pai-couverture.jpg';

// Préfixe plutôt que nom exact : "RS" (générique) et ses déclinaisons par
// spécialité partagent le même accès — même règle que Pai.jsx/PaiDetail.jsx.
const PREFIXE_CODE_ROLE_RESPONSABLE_SECTEUR = 'RS';

const JOURS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const JOURS_LABEL = { LUN: 'Lundi', MAR: 'Mardi', MER: 'Mercredi', JEU: 'Jeudi', VEN: 'Vendredi', SAM: 'Samedi', DIM: 'Dimanche' };

// Raccourcis de saisie : un clic remplit (ou complète) le champ, toujours modifiable ensuite.
const PATHOLOGIES = ['Personne âgée', 'Handicap', 'Alzheimer', 'Post-hospitalisation', "Perte d'autonomie"];
const INTERVENTIONS = ['Aide à la toilette', 'Aide au ménage', 'Actes du quotidien', 'Aide au repas', 'Courses', 'Aide au lever / coucher', 'Accompagnement extérieur', 'Garde de nuit'];
const OBJECTIFS = ["Maintien de l'autonomie", 'Maintien à domicile', "Rompre l'isolement", 'Sécuriser le quotidien'];
const LIENS_TUTEUR = ['Fils / Fille', 'Petit-fils / Petite-fille', 'Conjoint(e)', 'Tuteur légal', 'Curateur', 'Autre'];
const NIVEAUX_REMPLACEMENT = [
    ['Application de la cotation 1', 'Cotation 1 — remplaçable sans prévenir'],
    ['Application de la cotation 2', 'Cotation 2'],
    ['Application de la cotation 3', 'Cotation 3'],
    ['Application de la cotation 4', 'Cotation 4 — prévenir avant remplacement'],
    ['Application de la cotation 5', 'Cotation 5 — non remplaçable'],
];

// Procédures techniques standardisées, réutilisées d'un bénéficiaire à
// l'autre — insérées en un clic depuis le "Programme détaillé" plutôt
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

// Les 4 étapes du formulaire, et la rubrique du PDF que l'aperçu affiche
// quand on arrive sur chacune.
const ETAPES = [
    { n: 1, titre: 'Identité', sous: 'Bénéficiaire · Tuteur', rubrique: 'Identité du bénéficiaire' },
    { n: 2, titre: 'Prise en charge', sous: 'Historique · Planning · Interventions', rubrique: 'Historique de la pathologie ou de sa survenance' },
    { n: 3, titre: 'Objectifs & dispositif', sous: 'Objectifs · Dispositif · Consignes', rubrique: 'Objectifs de la prise en charge' },
    { n: 4, titre: 'Validation', sous: 'Réalisation · Signatures', rubrique: 'Page de garde' },
];

let compteurId = 0;
function uid() { compteurId += 1; return `n${Date.now()}_${compteurId}`; }
function creerEtape(label = '', texte = '') { return { id: uid(), label, texte, sous: [] }; }
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
// meta.realiseLe est stocké au format jj/mm/aaaa (imprimé tel quel) ; le champ date travaille en aaaa-mm-jj.
function frVersIso(fr) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(fr || '');
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}
function isoVersFr(iso) {
    const p = (iso || '').split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '';
}
function hhmmToMin(t) { if (!t) return 0; const p = t.split(':'); return (+p[0]) * 60 + (+(p[1] || 0)); }
function fmtDureeMin(min) { const h = Math.floor(min / 60), m = Math.round(min % 60); return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`; }
function dureeCreneaux(creneaux) { return creneaux.reduce((s, c) => s + Math.max(0, hhmmToMin(c.fin) - hhmmToMin(c.debut)), 0); }

function protocoleVide(dossier) {
    const parties = (dossier?.nom_beneficiaire || '').trim().split(/\s+/);
    const nom = parties.length > 1 ? parties.pop() : '';
    const prenom = parties.join(' ');
    return {
        beneficiaire: { civilite: 'Mme', nom, prenom, dateNaissance: '', telephone: '', adresse: '', codePostal: '', ville: '', pathologie: '', medecinTraitant: '', traitements: '' },
        aTuteur: false,
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
        auxiliaires: '',
        decision: null,
        faitA: 'La Courneuve',
        faitLe: '',
        // null = la photo du modèle HIS (assets/pai-couverture.jpg) ; sinon
        // une image choisie par l'utilisateur, en dataURL JPEG compressée.
        photoCouverture: null,
        // Tracés signés à l'écran (dataURL PNG, voir SignaturePad) — repris
        // tels quels dans les cadres de signature du PDF. Rester à null
        // laisse les cadres vides, à signer sur le document imprimé.
        signatures: { his: null, beneficiaire: null },
        meta: { realiseLe: new Date().toLocaleDateString('fr-FR'), realisePar: '' },
    };
}

/** Protocole enregistré (ou importé, partiel) complété par les valeurs par défaut — sous-objets compris. */
function completerProtocole(base, donnees) {
    if (!donnees) return base;
    const fusion = { ...base, ...donnees };
    ['beneficiaire', 'tuteur', 'interventions', 'dispositif', 'meta', 'signatures'].forEach((cle) => { fusion[cle] = { ...base[cle], ...(donnees[cle] || {}) }; });
    fusion.planning = { creneaux: (donnees.planning?.creneaux || base.planning.creneaux).map((c) => ({ id: uid(), label: '', ...c })) };
    // Dossiers enregistrés avant l'interrupteur "A un tuteur" : actif s'il y a déjà un tuteur saisi.
    if (typeof donnees.aTuteur !== 'boolean') fusion.aTuteur = Object.values(fusion.tuteur).some((v) => String(v || '').trim());
    return fusion;
}

// La photo voyage dans le JSON `protocole` (chiffré en base, relu à chaque
// ouverture) : on la réduit avant de la stocker, sinon une photo de
// téléphone de 5 Mo alourdirait chaque enregistrement et chaque aperçu.
const PHOTO_LARGEUR_MAX = 1400;

function compresserImage(fichier) {
    return new Promise((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onerror = () => reject(new Error('lecture impossible'));
        lecteur.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('image illisible'));
            img.onload = () => {
                const echelle = Math.min(1, PHOTO_LARGEUR_MAX / img.width);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * echelle);
                canvas.height = Math.round(img.height * echelle);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.82));
            };
            img.src = lecteur.result;
        };
        lecteur.readAsDataURL(fichier);
    });
}

const CHAMP_CLASSES = 'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
const LABEL_CLASSES = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5';
const CARTE_CLASSES = 'rounded-2xl border border-border bg-card p-5 flex flex-col gap-4';
const PUCE_RACCOURCI_CLASSES = 'h-8 px-3 rounded-full border border-dashed border-border text-xs font-medium text-primary hover:bg-primary/5 transition-colors';
const BOUTON_OUTLINE_CLASSES = 'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg border border-primary/40 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors';

/**
 * Un cadre de signature de l'étape « Validation ». Tant que personne n'a
 * signé, il reste le cadre en pointillés du gabarit papier (le PAI peut
 * toujours être signé à la main sur le document imprimé) ; « Signer sur
 * l'écran » ouvre le pavé tactile partagé avec les congés, et le tracé
 * obtenu part tel quel dans le PDF.
 */
function CaseSignature({ label, valeur, onChange }) {
    const [ouvert, setOuvert] = useState(false);

    if (ouvert && !valeur) {
        return (
            <div className='rounded-xl border border-border p-3 flex flex-col gap-2'>
                <span className='text-sm font-semibold text-foreground'>{label}</span>
                <SignaturePad onChange={(dataUrl) => { if (dataUrl) { onChange(dataUrl); setOuvert(false); } }} />
                <button type='button' onClick={() => setOuvert(false)} className='self-end text-xs text-muted-foreground hover:text-foreground transition-colors'>Annuler</button>
            </div>
        );
    }

    if (valeur) {
        return (
            <div className='rounded-xl border border-border p-3 flex flex-col gap-2'>
                <span className='text-sm font-semibold text-foreground'>{label}</span>
                <img src={valeur} alt={`Signature enregistrée : ${label}`} className='h-[72px] w-full object-contain rounded-lg bg-white border border-border' />
                <button type='button' onClick={() => onChange(null)} className='self-end inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors'>
                    <LuRotateCcw size={12} /> Recommencer
                </button>
            </div>
        );
    }

    return (
        <div className='h-[110px] rounded-xl border border-dashed border-slate-400 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground text-center px-3'>
            <span className='font-semibold text-foreground'>{label}</span>
            <button type='button' onClick={() => setOuvert(true)} className={BOUTON_OUTLINE_CLASSES}>
                <LuPenLine size={14} /> Signer sur l'écran
            </button>
        </div>
    );
}

function Champ({ label, value, onChange, type = 'text', area = false, rows = 3, placeholder, requis, aide }) {
    return (
        <label className='block'>
            <span className={LABEL_CLASSES}>
                {label}{requis && <span className='text-destructive'> *</span>}
                {aide && <span className='ml-1.5 normal-case tracking-normal font-medium'>{aide}</span>}
            </span>
            {area ? (
                <textarea rows={rows} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${CHAMP_CLASSES} leading-relaxed`} />
            ) : (
                <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={CHAMP_CLASSES} />
            )}
        </label>
    );
}

function ChampSelect({ label, value, onChange, options, requis }) {
    // Une valeur saisie avant les listes déroulantes reste proposée, pour ne rien perdre.
    const toutes = value && !options.some(([v]) => v === value) ? [[value, value], ...options] : options;
    return (
        <label className='block'>
            <span className={LABEL_CLASSES}>{label}{requis && <span className='text-destructive'> *</span>}</span>
            <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={CHAMP_CLASSES}>
                <option value=''>Sélectionner…</option>
                {toutes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
        </label>
    );
}

function SegmentedToggle({ value, onChange, options, label }) {
    return (
        <div role='group' aria-label={label} className='inline-flex gap-1 rounded-xl bg-muted p-1'>
            {options.map((o) => (
                <button key={String(o.value)} type='button' aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={`h-9 px-3.5 rounded-lg text-sm font-semibold transition-colors ${value === o.value ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function PhraseGeneree({ children }) {
    return <div className='rounded-lg bg-primary/5 px-3.5 py-3 text-sm text-primary'>{children}</div>;
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
                                    <button type='button' onClick={() => retirerSous(s.id)} aria-label='Retirer la sous-étape' className='shrink-0 text-muted-foreground hover:text-destructive transition-colors'><LuTrash2 size={13} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                    <button type='button' onClick={ajouterSous} className='self-start text-[11px] font-semibold text-primary hover:underline pl-5'>+ sous-étape</button>
                </div>
                <button type='button' onClick={onRemove} aria-label="Retirer l'étape" className='shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors'>✕</button>
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
                <button type='button' onClick={onRemoveBloc} aria-label='Supprimer le bloc' className='shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors'><LuTrash2 size={14} /></button>
            </div>
            <div className='mb-2'><SegmentedToggle label='Type de liste' value={bloc.type} onChange={onChangeType} options={[{ value: 'numerotee', label: '① Numéroté' }, { value: 'puces', label: '• Puces' }]} /></div>
            {bloc.etapes.map((e, i) => (
                <EtapeItem key={e.id} etape={e} numero={i + 1} numerote={bloc.type !== 'puces'} onChange={(n) => majEtape(e.id, n)} onRemove={() => retirerEtape(e.id)} />
            ))}
            <button type='button' onClick={() => onChangeEtapes([...bloc.etapes, creerEtape()])} className='text-xs font-semibold text-primary border border-dashed border-primary/40 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors'>+ Étape</button>
        </div>
    );
}

// ---------------- planning : une ligne par jour de la semaine ----------------

function EditeurPlanning({ creneaux, onChange }) {
    function basculerJour(jour) {
        if (creneaux.some((c) => c.jour === jour)) {
            onChange(creneaux.filter((c) => c.jour !== jour));
            return;
        }
        const modele = creneaux[0] || { debut: '09:00', fin: '11:00' };
        const nouveaux = [...creneaux, { id: uid(), jour, debut: modele.debut, fin: modele.fin, label: '' }];
        onChange(nouveaux.sort((a, b) => JOURS.indexOf(a.jour) - JOURS.indexOf(b.jour)));
    }
    function maj(id, champ, val) { onChange(creneaux.map((c) => (c.id === id ? { ...c, [champ]: val } : c))); }
    function ajouterCreneau(jour) {
        const dernier = creneaux.filter((c) => c.jour === jour).pop();
        const debut = dernier?.fin || '14:00';
        const fin = `${String(Math.min(23, Math.floor(hhmmToMin(debut) / 60) + 1)).padStart(2, '0')}:${debut.split(':')[1] || '00'}`;
        const idx = creneaux.indexOf(dernier);
        const copie = [...creneaux];
        copie.splice(idx + 1, 0, { id: uid(), jour, debut, fin, label: '' });
        onChange(copie);
    }

    return (
        <div className='flex flex-col gap-1.5'>
            {JOURS.map((jour) => {
                const crJour = creneaux.filter((c) => c.jour === jour);
                const actif = crJour.length > 0;
                return (
                    <div key={jour} className={`flex flex-wrap items-start gap-x-3.5 gap-y-1 rounded-xl px-3 py-1 ${actif ? 'bg-primary/5' : ''}`}>
                        <button type='button' onClick={() => basculerJour(jour)} aria-pressed={actif} className='flex items-center gap-2.5 min-w-[140px] h-11 text-sm font-semibold text-foreground'>
                            <span className={`w-[22px] h-[22px] rounded-md flex items-center justify-center border ${actif ? 'bg-primary border-primary text-white' : 'bg-background border-slate-400'}`}>{actif && <LuCheck size={14} />}</span>
                            {JOURS_LABEL[jour]}
                        </button>
                        {actif && (
                            <div className='flex flex-col gap-1.5 py-1.5 flex-1 min-w-[260px]'>
                                {crJour.map((c, i) => (
                                    <div key={c.id} className='flex flex-wrap items-center gap-2'>
                                        <input type='time' aria-label={`${JOURS_LABEL[jour]} — début`} value={c.debut} onChange={(e) => maj(c.id, 'debut', e.target.value)} className={`${CHAMP_CLASSES} !w-[118px] !py-2`} />
                                        <span className='text-sm text-muted-foreground'>à</span>
                                        <input type='time' aria-label={`${JOURS_LABEL[jour]} — fin`} value={c.fin} onChange={(e) => maj(c.id, 'fin', e.target.value)} className={`${CHAMP_CLASSES} !w-[118px] !py-2`} />
                                        <span className='text-xs text-muted-foreground tabular-nums w-10'>{fmtDureeMin(dureeCreneaux([c]))}</span>
                                        <input type='text' aria-label={`${JOURS_LABEL[jour]} — libellé`} value={c.label} onChange={(e) => maj(c.id, 'label', e.target.value)} placeholder='Ex. Toilette · ménage' className={`${CHAMP_CLASSES} !py-2 flex-1 min-w-[120px]`} />
                                        {crJour.length > 1 && (
                                            <button type='button' onClick={() => onChange(creneaux.filter((x) => x.id !== c.id))} aria-label='Retirer ce créneau' className='w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive transition-colors'>✕</button>
                                        )}
                                        {i === crJour.length - 1 && (
                                            <button type='button' onClick={() => ajouterCreneau(jour)} className='text-xs font-semibold text-primary hover:underline'>+ créneau</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ProtocolePai() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { hasPermission, isAdministrator } = usePermissions();
    const peutGererPai = isAdministrator || hasPermission('gerer_pai');
    const estNouveau = id === 'nouveau';

    const [dossier, setDossier] = useState(null);
    const [loading, setLoading] = useState(!estNouveau);
    const [p, setP] = useState(estNouveau ? protocoleVide(null) : null);
    const [etape, setEtape] = useState(1);
    const [cible, setCible] = useState({ rubrique: ETAPES[0].rubrique, cle: 0 });
    const [vueMobile, setVueMobile] = useState('form');
    const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
    const [exportEnCours, setExportEnCours] = useState(false);
    const [importEnCours, setImportEnCours] = useState(false);
    const [responsables, setResponsables] = useState([]);
    const [responsableSecteurId, setResponsableSecteurId] = useState('');
    const [nouvelleIntervention, setNouvelleIntervention] = useState('');
    const enregistreRef = useRef(estNouveau ? JSON.stringify(protocoleVide(null)) : null);
    const fichierRef = useRef(null);
    const fichierPhoto = useRef(null);

    const fetchDossier = useCallback(() => {
        if (estNouveau) return;
        setLoading(true);
        getPaiDossier(id).then(async (res) => {
            if (res.status === 200) {
                const data = await res.json();
                const protocole = data.protocole && Object.keys(data.protocole).length ? completerProtocole(protocoleVide(data), data.protocole) : protocoleVide(data);
                setDossier(data);
                setP(protocole);
                enregistreRef.current = JSON.stringify(protocole);
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

    const responsableChoisi = responsables.find((r) => String(r.user?.id) === String(responsableSecteurId));
    const responsableSecteurNom = estNouveau ? (responsableChoisi ? `${responsableChoisi.prenom} ${responsableChoisi.nom}` : '') : dossier?.responsable_secteur?.nom;
    const extraPdf = useMemo(() => ({ responsableSecteur: responsableSecteurNom }), [responsableSecteurNom]);

    function allerEtape(n) {
        setEtape(n);
        setCible((c) => ({ rubrique: ETAPES[n - 1].rubrique, cle: c.cle + 1 }));
        setVueMobile('form');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // L'aperçu suit la rubrique en cours de saisie (au focus d'un champ).
    function suivre(rubrique) {
        return () => setCible((c) => (c.rubrique === rubrique ? c : { rubrique, cle: c.cle + 1 }));
    }

    const importerFichier = useCallback(async (fichier) => {
        if (!fichier) return;
        try {
            setImportEnCours(true);
            const { protocole, source, nbChamps } = await importerPaiDepuisPdf(fichier);
            setP((actuel) => completerProtocole(protocoleVide(dossier), source === 'hisdocs' ? protocole : { ...protocole, faitA: protocole.faitA || actuel?.faitA, meta: { ...actuel?.meta, ...protocole.meta } }));
            setEtape(1);
            setCible((c) => ({ rubrique: ETAPES[0].rubrique, cle: c.cle + 1 }));
            toast.success(source === 'hisdocs'
                ? 'PAI importé à l\'identique : vous pouvez le continuer.'
                : `PAI importé : ${nbChamps} champ(s) repris du PDF. Vérifiez-les, complétez le reste puis enregistrez.`);
        } catch (e) {
            toast.error(e?.message || "Ce PDF n'a pas pu être lu");
        } finally {
            setImportEnCours(false);
        }
    }, [dossier]);

    // Fichier choisi depuis la liste des PAI (Pai.jsx, icône d'import) : importé dès l'arrivée ici.
    useEffect(() => {
        const fichier = location.state?.fichierPai;
        if (!fichier || loading) return;
        navigate(location.pathname, { replace: true, state: null });
        importerFichier(fichier);
    }, [location.state, location.pathname, loading, navigate, importerFichier]);

    if (!peutGererPai && !loading) {
        return <div className='max-w-2xl mx-auto py-16 text-center text-muted-foreground'>Vous n'avez pas la permission de rédiger un protocole de prise en charge.</div>;
    }
    if (loading || !p) {
        return <div className='flex items-center justify-center py-16 text-muted-foreground'><LuLoader className='animate-spin' size={22} /></div>;
    }

    function majSection(cle, valeur) { setP({ ...p, [cle]: valeur }); }
    function majChamp(section, champ, valeur) { setP({ ...p, [section]: { ...p[section], [champ]: valeur } }); }

    const b = p.beneficiaire;
    const civ = civiliteBeneficiaire(p);
    const nomMaj = (b.nom || '').toUpperCase();
    const nomAffiche = `${civ} ${nomMaj || '[NOM]'} ${b.prenom || ''}`.trim();
    const ageVal = age(b.dateNaissance);
    const creneaux = p.planning.creneaux;
    const nbJours = new Set(creneaux.map((c) => c.jour)).size;
    const tags = p.interventions.tags.filter((t) => t.trim());
    const optionsInterventions = [...INTERVENTIONS, ...tags.filter((t) => !INTERVENTIONS.includes(t))];

    const requis = [
        [1, 'Nom', b.nom], [1, 'Prénom', b.prenom], [1, 'Date de naissance', b.dateNaissance], [1, 'Adresse', b.adresse], [1, 'Pathologie', b.pathologie],
        [2, 'Historique', p.historique], [2, "Au moins un jour d'intervention", creneaux.length], [2, 'Au moins une intervention', tags.length || p.interventions.description],
        [3, 'Objectifs', p.objectifs], [3, "En cas d'absence ou de retard", p.dispositif.absenceRetard], [3, 'Niveau de remplacement', p.dispositif.niveauRemplacement],
        [4, 'Réalisé le', p.meta.realiseLe], [4, 'Fait à', p.faitA], [4, 'Réalisé par', p.meta.realisePar], [4, 'Responsable secteur', estNouveau ? responsableSecteurId : true],
    ];
    const manquants = requis.filter(([, , v]) => !String(v || '').trim());
    const nbRemplis = requis.length - manquants.length;
    const modifie = JSON.stringify(p) !== enregistreRef.current;

    async function enregistrer() {
        if (estNouveau) {
            if (!b.nom.trim() && !b.prenom.trim()) {
                toast.error('Indiquez au moins le nom du bénéficiaire (étape Identité).');
                allerEtape(1);
                return;
            }
            if (!responsableSecteurId) {
                toast.error('Sélectionnez un responsable secteur (étape Validation).');
                allerEtape(4);
                return;
            }
        }
        try {
            setEnregistrementEnCours(true);
            const res = estNouveau ? await creerPaiAvecProtocole(responsableSecteurId, p) : await updatePaiProtocole(id, p);
            if (res.status === 200 || res.status === 201) {
                const data = await res.json();
                enregistreRef.current = JSON.stringify(p);
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
            const blob = await genererPdfProtocolePai(p, extraPdf);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PIAA - ${(b.prenom + ' ' + b.nom).trim() || dossier?.titre || 'bénéficiaire'}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error("L'export a échoué");
        } finally {
            setExportEnCours(false);
        }
    }

    function demanderImport() {
        if (modifie && !window.confirm('Remplacer le contenu actuel du formulaire par celui du PDF ? Les modifications non enregistrées seront perdues.')) return;
        fichierRef.current?.click();
    }

    function basculerIntervention(tag) {
        majChamp('interventions', 'tags', tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
    }
    function ajouterIntervention() {
        const t = nouvelleIntervention.trim();
        if (t && !tags.includes(t)) majChamp('interventions', 'tags', [...tags, t]);
        setNouvelleIntervention('');
    }
    function harmoniserHoraires() {
        if (!creneaux.length) return;
        const { debut, fin } = creneaux[0];
        majSection('planning', { creneaux: creneaux.map((c) => ({ ...c, debut, fin })) });
    }

    return (
        <div className='flex flex-col w-full gap-5 py-4'>
            <Breadcrumbs where={estNouveau ? 'Nouveau protocole' : `Protocole — ${dossier.titre}`} />

            <header className='flex flex-wrap items-center justify-between gap-4'>
                <div className='flex flex-col gap-1 min-w-0'>
                    <h1 className='text-2xl font-bold text-foreground'>Projet individualisé d'aide et d'accompagnement — {nomAffiche}</h1>
                    <p className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${modifie ? 'bg-amber-500' : 'bg-green-600'}`} />
                        {modifie ? 'Modifications non enregistrées' : estNouveau ? 'Nouveau protocole' : `Enregistré${dossier.protocole_maj_le ? ` le ${new Date(dossier.protocole_maj_le).toLocaleDateString('fr-FR')}${dossier.protocole_maj_par ? ' par ' + dossier.protocole_maj_par : ''}` : ''}`}
                        {' · '}{nbRemplis}/{requis.length} champs obligatoires remplis
                    </p>
                </div>
                <div className='flex flex-wrap items-center gap-2.5'>
                    <input ref={fichierRef} type='file' accept='application/pdf,.pdf' className='hidden' onChange={(e) => { importerFichier(e.target.files?.[0]); e.target.value = ''; }} />
                    <button type='button' onClick={demanderImport} disabled={importEnCours} aria-label='Importer un PAI depuis un PDF' title='Importer un PAI depuis un PDF pour le continuer' className='w-11 h-11 flex items-center justify-center rounded-xl border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50'>
                        {importEnCours ? <LuLoader size={18} className='animate-spin' /> : <LuFileUp size={18} />}
                    </button>
                    <button type='button' onClick={() => navigate(estNouveau ? '/pai' : -1)} className='h-11 px-4 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-muted transition-colors'>
                        {estNouveau ? 'Annuler' : 'Retour au dossier'}
                    </button>
                    <button type='button' onClick={exporterPdf} disabled={exportEnCours} className='inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-primary bg-background text-sm font-semibold text-primary hover:bg-primary/5 transition-colors disabled:opacity-50'>
                        <LuDownload size={15} /> {exportEnCours ? 'Export...' : 'Télécharger le PDF'}
                    </button>
                    <button type='button' onClick={enregistrer} disabled={enregistrementEnCours} className='inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                        <LuSave size={15} /> {enregistrementEnCours ? 'Enregistrement...' : 'Enregistrer le PAI'}
                    </button>
                </div>
            </header>

            <div className='grid gap-5 items-start lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_minmax(340px,440px)]'>
                {/* étapes */}
                <nav aria-label='Étapes du PAI' className='rounded-2xl border border-border bg-card p-3 flex flex-col gap-2 lg:sticky lg:top-4'>
                    <div className='grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-1.5'>
                        {ETAPES.map((e) => {
                            const champs = requis.filter(([n]) => n === e.n);
                            const faits = champs.filter(([, , v]) => String(v || '').trim()).length;
                            const complet = faits === champs.length;
                            const courant = etape === e.n;
                            return (
                                <button key={e.n} type='button' onClick={() => allerEtape(e.n)} aria-current={courant ? 'step' : undefined} className={`flex items-center gap-3 w-full min-h-[60px] p-2.5 rounded-xl border text-left transition-colors ${courant ? 'bg-accent/15 border-accent' : 'border-transparent hover:bg-muted'}`}>
                                    <span className={`w-[30px] h-[30px] shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold ${courant ? 'bg-accent text-accent-foreground' : complet ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                                        {complet && !courant ? <LuCheck size={15} /> : e.n}
                                    </span>
                                    <span className='flex flex-col gap-0.5 flex-1 min-w-0'>
                                        <span className='text-sm font-semibold text-foreground'>{e.titre}</span>
                                        <span className='hidden lg:block text-xs text-muted-foreground'>{e.sous}</span>
                                    </span>
                                    <span className={`shrink-0 text-xs font-semibold tabular-nums rounded-full px-2 py-0.5 ${complet ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>{faits}/{champs.length}</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className='hidden lg:block mt-1 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900'>
                        La mise en page du PDF reste celle du modèle HIS : seuls la saisie et le contrôle changent.
                    </p>
                </nav>

                <div className='lg:hidden flex gap-2'>
                    <button type='button' onClick={() => setVueMobile('form')} aria-pressed={vueMobile === 'form'} className={`flex-1 text-sm font-semibold rounded-xl h-11 border ${vueMobile === 'form' ? 'bg-primary text-white border-primary' : 'border-border bg-background text-muted-foreground'}`}>Formulaire</button>
                    <button type='button' onClick={() => setVueMobile('apercu')} aria-pressed={vueMobile === 'apercu'} className={`flex-1 text-sm font-semibold rounded-xl h-11 border ${vueMobile === 'apercu' ? 'bg-primary text-white border-primary' : 'border-border bg-background text-muted-foreground'}`}>Aperçu PDF</button>
                </div>

                {/* formulaire */}
                <main className={`min-w-0 flex flex-col gap-4 ${vueMobile !== 'form' ? 'hidden lg:flex' : ''}`}>
                    {etape === 1 && (
                        <>
                            <section className={CARTE_CLASSES} onFocusCapture={suivre('Identité du bénéficiaire')}>
                                <div className='flex flex-wrap items-center justify-between gap-3'>
                                    <h2 className='text-lg font-semibold text-foreground'>Identité du bénéficiaire</h2>
                                    <SegmentedToggle label='Civilité' value={civ} onChange={(v) => majChamp('beneficiaire', 'civilite', v)} options={[{ value: 'Mme', label: 'Madame' }, { value: 'M.', label: 'Monsieur' }]} />
                                </div>
                                <div className='grid sm:grid-cols-2 gap-3.5'>
                                    <Champ label='Nom' requis value={b.nom} onChange={(v) => majChamp('beneficiaire', 'nom', v)} />
                                    <Champ label='Prénom' requis value={b.prenom} onChange={(v) => majChamp('beneficiaire', 'prenom', v)} />
                                    <Champ label='Date de naissance' requis aide={ageVal !== null ? `· ${ageVal} ans` : null} type='date' value={b.dateNaissance} onChange={(v) => majChamp('beneficiaire', 'dateNaissance', v)} />
                                    <Champ label='Téléphone' type='tel' placeholder='06 00 00 00 00' value={b.telephone} onChange={(v) => majChamp('beneficiaire', 'telephone', v)} />
                                </div>
                                <Champ label='Adresse' requis placeholder='N° et rue' value={b.adresse} onChange={(v) => majChamp('beneficiaire', 'adresse', v)} />
                                <div className='grid sm:grid-cols-3 gap-3.5'>
                                    <Champ label='Code postal' value={b.codePostal} onChange={(v) => majChamp('beneficiaire', 'codePostal', v)} />
                                    <div className='sm:col-span-2'>
                                        <Champ label='Ville' value={b.ville} onChange={(v) => majChamp('beneficiaire', 'ville', v)} />
                                    </div>
                                </div>
                                <div className='flex flex-col gap-2'>
                                    <Champ label='Pathologie' requis value={b.pathologie} onChange={(v) => majChamp('beneficiaire', 'pathologie', v)} />
                                    <div className='flex flex-wrap gap-1.5'>
                                        {PATHOLOGIES.map((pa) => <button key={pa} type='button' onClick={() => majChamp('beneficiaire', 'pathologie', pa)} className={PUCE_RACCOURCI_CLASSES}>+ {pa}</button>)}
                                    </div>
                                </div>
                                <div className='grid sm:grid-cols-2 gap-3.5'>
                                    <Champ label='Médecin traitant' value={b.medecinTraitant} onChange={(v) => majChamp('beneficiaire', 'medecinTraitant', v)} />
                                    <Champ label='Traitement(s)' value={b.traitements} onChange={(v) => majChamp('beneficiaire', 'traitements', v)} />
                                </div>
                            </section>

                            <section className={CARTE_CLASSES} onFocusCapture={suivre('Identité du tuteur')}>
                                <div className='flex flex-wrap items-center justify-between gap-3'>
                                    <div>
                                        <h2 className='text-lg font-semibold text-foreground'>Identité du tuteur / représentant</h2>
                                        <p className='text-sm text-muted-foreground'>Désactivé : la rubrique reste dans le PDF, avec des champs vides.</p>
                                    </div>
                                    <button type='button' onClick={() => majSection('aTuteur', !p.aTuteur)} aria-pressed={p.aTuteur} className='flex items-center gap-2.5 h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground'>
                                        <span className={`relative inline-block w-10 h-6 rounded-full transition-colors ${p.aTuteur ? 'bg-primary' : 'bg-slate-300'}`}>
                                            <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all ${p.aTuteur ? 'left-[19px]' : 'left-[3px]'}`} />
                                        </span>
                                        A un tuteur
                                    </button>
                                </div>
                                {p.aTuteur && (
                                    <div className='grid sm:grid-cols-2 gap-3.5'>
                                        <Champ label='Nom' value={p.tuteur.nom} onChange={(v) => majChamp('tuteur', 'nom', v)} />
                                        <Champ label='Prénom' value={p.tuteur.prenom} onChange={(v) => majChamp('tuteur', 'prenom', v)} />
                                        <ChampSelect label='Lien avec le bénéficiaire' value={p.tuteur.lien} onChange={(v) => majChamp('tuteur', 'lien', v)} options={LIENS_TUTEUR.map((l) => [l, l])} />
                                        <Champ label='Téléphone portable' type='tel' value={p.tuteur.telephone} onChange={(v) => majChamp('tuteur', 'telephone', v)} />
                                        <Champ label='Téléphone fixe' type='tel' value={p.tuteur.telephoneFixe} onChange={(v) => majChamp('tuteur', 'telephoneFixe', v)} />
                                        <Champ label='E-mail' type='email' value={p.tuteur.mail} onChange={(v) => majChamp('tuteur', 'mail', v)} />
                                        <div className='sm:col-span-2'><Champ label='Adresse' value={p.tuteur.adresse} onChange={(v) => majChamp('tuteur', 'adresse', v)} /></div>
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {etape === 2 && (
                        <>
                            <section className={CARTE_CLASSES} onFocusCapture={suivre('Historique de la pathologie ou de sa survenance')}>
                                <h2 className='text-lg font-semibold text-foreground'>Historique de la pathologie ou de sa survenance <span className='text-destructive'>*</span></h2>
                                <textarea rows={4} aria-label='Historique de la pathologie' value={p.historique} onChange={(e) => majSection('historique', e.target.value)} className={`${CHAMP_CLASSES} leading-relaxed`} />
                                <div>
                                    <button type='button' onClick={() => majSection('historique', `${civ === 'Mme' ? 'Madame' : 'Monsieur'} ${nomMaj} ${b.prenom} est une personne ${civ === 'Mme' ? 'âgée' : 'âgé'}.`.replace(/\s+/g, ' '))} className='h-9 px-3 rounded-lg border border-border bg-muted/40 text-sm text-primary hover:bg-muted transition-colors'>Insérer la phrase type</button>
                                </div>
                            </section>

                            <section className={CARTE_CLASSES} onFocusCapture={suivre('Organisation des prestations')}>
                                <div className='flex flex-wrap items-center justify-between gap-3'>
                                    <h2 className='text-lg font-semibold text-foreground'>Organisation des prestations <span className='text-destructive'>*</span></h2>
                                    <button type='button' onClick={harmoniserHoraires} disabled={creneaux.length < 2} className='h-9 px-3 rounded-lg border border-border bg-muted/40 text-sm text-primary hover:bg-muted transition-colors disabled:opacity-40'>Même horaire pour tous les jours cochés</button>
                                </div>
                                <EditeurPlanning creneaux={creneaux} onChange={(v) => majSection('planning', { creneaux: v })} />
                                <PhraseGeneree>
                                    Phrase générée : « HIS intervient {creneaux.length} fois par semaine chez {b.nom ? `${civ} ${b.nom}` : 'le/la bénéficiaire'} selon le planning ci-dessous. » · {fmtDureeMin(dureeCreneaux(creneaux))} / semaine sur {nbJours} jour{nbJours > 1 ? 's' : ''}
                                </PhraseGeneree>
                            </section>

                            <section className={CARTE_CLASSES} onFocusCapture={suivre('Description des interventions')}>
                                <h2 className='text-lg font-semibold text-foreground'>Description des interventions <span className='text-destructive'>*</span></h2>
                                <div className='flex flex-wrap gap-2'>
                                    {optionsInterventions.map((tag) => {
                                        const actif = tags.includes(tag);
                                        return (
                                            <button key={tag} type='button' onClick={() => basculerIntervention(tag)} aria-pressed={actif} className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full border text-sm transition-colors ${actif ? 'bg-primary border-primary text-white' : 'bg-background border-border text-primary hover:bg-primary/5'}`}>
                                                {actif ? <LuCheck size={14} /> : '+'} {tag}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className='flex gap-2'>
                                    <input type='text' aria-label='Autre intervention' value={nouvelleIntervention} onChange={(e) => setNouvelleIntervention(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ajouterIntervention(); } }} placeholder='Autre intervention…' className={`${CHAMP_CLASSES} !py-2 max-w-xs`} />
                                    <button type='button' onClick={ajouterIntervention} disabled={!nouvelleIntervention.trim()} className='h-10 px-3 rounded-lg border border-border text-sm font-semibold text-primary hover:bg-muted disabled:opacity-40 transition-colors'>Ajouter</button>
                                </div>
                                <Champ label='Paragraphe (optionnel)' area placeholder='Laissé vide, la phrase générée ci-dessous est reprise dans le PDF.' value={p.interventions.description} onChange={(v) => majChamp('interventions', 'description', v)} />
                                {!p.interventions.description.trim() && (
                                    <PhraseGeneree>Phrase générée : « {phraseInterventions(p) || 'choisissez au moins une intervention'} »</PhraseGeneree>
                                )}
                            </section>

                            <details className='rounded-2xl border border-border bg-card group' open={p.moments.length > 0 || p.procedures.length > 0} onFocusCapture={suivre('Programme détaillé')}>
                                <summary className='cursor-pointer list-none p-5 flex items-center justify-between gap-3'>
                                    <span>
                                        <span className='block text-lg font-semibold text-foreground'>Programme détaillé <span className='text-sm font-normal text-muted-foreground'>(optionnel)</span></span>
                                        <span className='block text-sm text-muted-foreground'>Pour les prises en charge lourdes, geste par geste. Absent du PDF si rien n'est rempli.</span>
                                    </span>
                                    <LuChevronRight size={18} className='shrink-0 text-muted-foreground transition-transform group-open:rotate-90' />
                                </summary>
                                <div className='px-5 pb-5'>
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
                            </details>
                        </>
                    )}

                    {etape === 3 && (
                        <>
                            <section className={CARTE_CLASSES} onFocusCapture={suivre('Objectifs de la prise en charge')}>
                                <h2 className='text-lg font-semibold text-foreground'>Objectifs de la prise en charge <span className='text-destructive'>*</span></h2>
                                <textarea rows={4} aria-label='Objectifs de la prise en charge' value={p.objectifs} onChange={(e) => majSection('objectifs', e.target.value)} className={`${CHAMP_CLASSES} leading-relaxed`} />
                                <div className='flex flex-wrap gap-1.5'>
                                    {OBJECTIFS.map((o) => (
                                        <button key={o} type='button' onClick={() => majSection('objectifs', `${p.objectifs ? p.objectifs + ' ' : ''}${civ} ${nomMaj} souhaite : ${o.toLowerCase()}.`)} className={PUCE_RACCOURCI_CLASSES}>+ {o}</button>
                                    ))}
                                </div>
                            </section>

                            <section className={CARTE_CLASSES} onFocusCapture={suivre('Dispositif à mettre en place')}>
                                <h2 className='text-lg font-semibold text-foreground'>Dispositif à mettre en place</h2>
                                <div className='flex flex-col'>
                                    {[['cahierCourses', 'Cahier de courses'], ['cahierLiaison', 'Cahier de liaison'], ['remiseCle', 'Remise de clé']].map(([champ, label]) => (
                                        <div key={champ} className='flex flex-wrap items-center justify-between gap-3 py-1.5 border-b border-border last:border-b-0'>
                                            <span className='text-sm font-semibold text-foreground'>{label}</span>
                                            <SegmentedToggle label={label} value={p.dispositif[champ] ? 'oui' : 'non'} onChange={(v) => majChamp('dispositif', champ, v === 'oui')} options={[{ value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }]} />
                                        </div>
                                    ))}
                                </div>
                                <div className='grid sm:grid-cols-2 gap-3.5'>
                                    <Champ label="En cas d'absence ou de retard" requis value={p.dispositif.absenceRetard} onChange={(v) => majChamp('dispositif', 'absenceRetard', v)} placeholder='Ex. Avertir HIS, pour le remplacement' />
                                    <ChampSelect label='Niveau de remplacement' requis value={p.dispositif.niveauRemplacement} onChange={(v) => majChamp('dispositif', 'niveauRemplacement', v)} options={NIVEAUX_REMPLACEMENT} />
                                </div>
                                <Champ label='Comportements particuliers / conduite à tenir' area value={p.dispositif.comportements} onChange={(v) => majChamp('dispositif', 'comportements', v)} />
                                <Champ label='Autres (dysfonctionnements, goûts de la personne…)' area value={p.dispositif.autres} onChange={(v) => majChamp('dispositif', 'autres', v)} />
                            </section>

                            <section className='rounded-2xl border border-amber-200 bg-amber-50 p-5 flex flex-col gap-3' onFocusCapture={suivre('Dispositif à mettre en place')}>
                                <div>
                                    <h2 className='text-lg font-semibold text-amber-950'>Consignes importantes (PS)</h2>
                                    <p className='text-sm text-amber-900'>Imprimées dans l'encadré « À savoir » du PDF.</p>
                                </div>
                                <textarea rows={3} aria-label='Consignes importantes' value={p.aSavoir} onChange={(e) => majSection('aSavoir', e.target.value)} className={`${CHAMP_CLASSES} leading-relaxed`} />
                                <label className='block'>
                                    <span className='block text-xs font-semibold text-amber-900 uppercase tracking-wide mb-1.5'>Auxiliaires attitrées</span>
                                    <input type='text' value={p.auxiliaires || ''} onChange={(e) => majSection('auxiliaires', e.target.value)} placeholder='Ex. DUPONT Marie, MARTIN Awa' className={CHAMP_CLASSES} />
                                </label>
                            </section>
                        </>
                    )}

                    {etape === 4 && (
                        <>
                            <section className={CARTE_CLASSES} onFocusCapture={suivre('Page de garde')}>
                                <h2 className='text-lg font-semibold text-foreground'>Réalisation</h2>
                                <div className='flex flex-wrap items-center gap-3.5 rounded-xl border border-border bg-muted/30 p-3'>
                                    <img src={p.photoCouverture || photoCouverture} alt='Couverture actuelle du PAI' className='w-[120px] h-[84px] object-cover rounded-md' />
                                    <div className='flex flex-col gap-1 flex-1 min-w-[180px]'>
                                        <span className='text-sm font-semibold text-foreground'>Photo de couverture (page 1)</span>
                                        <span className='text-sm text-muted-foreground'>
                                            {p.photoCouverture ? 'Photo personnalisée.' : 'Reprise du modèle HIS.'} Logo et labels sont ajoutés automatiquement sur chaque page.
                                        </span>
                                        {p.photoCouverture && (
                                            <button type='button' onClick={() => majSection('photoCouverture', null)} className='self-start text-xs text-muted-foreground hover:text-destructive transition-colors'>
                                                Remettre celle du modèle
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        ref={fichierPhoto}
                                        type='file'
                                        accept='image/*'
                                        className='hidden'
                                        onChange={async (e) => {
                                            const fichier = e.target.files?.[0];
                                            e.target.value = '';
                                            if (!fichier) return;
                                            try {
                                                majSection('photoCouverture', await compresserImage(fichier));
                                            } catch {
                                                toast.error('Cette image n\'a pas pu être lue.');
                                            }
                                        }}
                                    />
                                    <button type='button' onClick={() => fichierPhoto.current?.click()} className={BOUTON_OUTLINE_CLASSES}>
                                        <LuImagePlus size={14} /> Changer la photo
                                    </button>
                                </div>
                                <div className='grid sm:grid-cols-2 gap-3.5'>
                                    <Champ label='Réalisé le' requis type='date' value={frVersIso(p.meta.realiseLe) || ''} onChange={(v) => majChamp('meta', 'realiseLe', isoVersFr(v))} />
                                    <Champ label='Fait à' requis value={p.faitA} onChange={(v) => majSection('faitA', v)} />
                                    <Champ label='Réalisé par' requis value={p.meta.realisePar} onChange={(v) => majChamp('meta', 'realisePar', v)} />
                                    {estNouveau ? (
                                        <div>
                                            <span className={LABEL_CLASSES}>Responsable secteur <span className='text-destructive'>*</span></span>
                                            <MenuDeroulant className='w-full' boutonClassName='w-full' value={responsableSecteurId} onChange={setResponsableSecteurId} placeholder='Sélectionner...' options={responsables.map((pers) => ({ value: pers.user?.id, label: `${pers.prenom} ${pers.nom}` }))} />
                                        </div>
                                    ) : (
                                        <div>
                                            <span className={LABEL_CLASSES}>Responsable secteur</span>
                                            <p className='text-sm py-2.5 text-foreground'>{dossier.responsable_secteur?.nom || '—'} <span className='text-xs text-muted-foreground'>(modifiable depuis la page du dossier)</span></p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className={CARTE_CLASSES} onFocusCapture={suivre('Décision et signatures')}>
                                <h2 className='text-lg font-semibold text-foreground'>Décision du bénéficiaire</h2>
                                <div role='group' aria-label='Décision' className='flex flex-wrap gap-2'>
                                    {[['accepte', 'Accepte le projet'], ['refuse', 'Refuse le projet'], [null, 'En attente']].map(([v, l]) => (
                                        <button key={l} type='button' onClick={() => majSection('decision', v)} aria-pressed={p.decision === v} className={`h-11 px-4 rounded-xl border text-sm font-semibold transition-colors ${p.decision === v ? 'bg-primary border-primary text-white' : 'bg-background border-border text-foreground hover:bg-muted'}`}>{l}</button>
                                    ))}
                                </div>
                                <div className='sm:max-w-[50%]'>
                                    <Champ label='Le' type='date' value={p.faitLe} onChange={(v) => majSection('faitLe', v)} />
                                </div>
                                <div className='grid sm:grid-cols-2 gap-3.5'>
                                    {[['his', 'Signature du représentant HIS'], ['beneficiaire', 'Signature du bénéficiaire']].map(([cle, label]) => (
                                        <CaseSignature
                                            key={cle}
                                            label={label}
                                            valeur={p.signatures?.[cle] || null}
                                            onChange={(dataUrl) => majChamp('signatures', cle, dataUrl)}
                                        />
                                    ))}
                                </div>
                            </section>

                            <section className={CARTE_CLASSES}>
                                <h2 className='text-lg font-semibold text-foreground'>Vérification avant enregistrement</h2>
                                {manquants.length === 0 ? (
                                    <div className='rounded-xl bg-green-50 px-3.5 py-3 text-sm text-green-800'>Tous les champs obligatoires sont remplis. Le PDF est prêt.</div>
                                ) : (
                                    <div className='flex flex-col gap-2'>
                                        {manquants.map(([n, label]) => (
                                            <button key={label} type='button' onClick={() => allerEtape(n)} className='flex items-center justify-between gap-3 min-h-[44px] px-3.5 rounded-xl border border-orange-200 bg-orange-50 text-sm text-orange-900 text-left hover:bg-orange-100 transition-colors'>
                                                <span>Manquant : {label}</span>
                                                <span className='font-semibold shrink-0'>Étape {n} →</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    <div className='flex justify-between gap-2.5'>
                        <button type='button' disabled={etape === 1} onClick={() => allerEtape(etape - 1)} className='inline-flex items-center gap-1.5 h-11 px-4 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-40 transition-colors'>
                            <LuChevronLeft size={15} /> Précédent
                        </button>
                        {etape < ETAPES.length ? (
                            <button type='button' onClick={() => allerEtape(etape + 1)} className='inline-flex items-center gap-1.5 h-11 px-5 rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary/90 transition-colors'>
                                Suivant <LuChevronRight size={15} />
                            </button>
                        ) : (
                            <button type='button' onClick={enregistrer} disabled={enregistrementEnCours} className='inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
                                <LuSave size={15} /> {enregistrementEnCours ? 'Enregistrement...' : 'Enregistrer le PAI'}
                            </button>
                        )}
                    </div>
                </main>

                {/* aperçu */}
                <aside aria-label='Aperçu du PDF' className={`lg:col-span-2 xl:col-span-1 w-full max-w-[520px] mx-auto xl:max-w-none xl:sticky xl:top-4 ${vueMobile !== 'apercu' ? 'hidden lg:block' : ''}`}>
                    <ApercuPdfPai protocole={p} extra={extraPdf} rubriqueCible={cible.rubrique} cleCible={cible.cle} />
                </aside>
            </div>
        </div>
    );
}

export default ProtocolePai;
