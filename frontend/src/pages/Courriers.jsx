import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LuSearch, LuLoader, LuFileDown, LuFileSpreadsheet, LuArrowUp, LuArrowDown, LuArrowUpDown, LuMailPlus, LuPencil, LuTrash2, LuBellRing, LuSlidersHorizontal, LuCheck, LuX } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import FiligraneHIS from '../components/FiligraneHIS';
import CourrierForm from '../components/CourrierForm';
import Pagination from '../components/Pagination';
import MenuDeroulant from '../components/MenuDeroulant';
import { getDocument, deleteDocument, relancerCourrier } from '../api/routes/document';
import { correspondARequete } from '../utils/recherche';
import { colonnesPdf, colonnesExcel, exporterCourriersPdf, exporterCourriersExcel } from '../utils/exportCourriers';
import FiltrePeriode from '../components/FiltrePeriode';
import { PERIODE_VIDE, dateDansPeriode } from '../utils/periodes';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../contexts/ConfirmDialogContext';
import { useColonnesPersonnalisees } from '../hooks/useColonnesPersonnalisees';

const COURRIERS_PAR_PAGE = 13;

// Couleurs propres à cette page (pas d'import depuis Statistiques.jsx : sa
// palette équivalente y est une constante locale non exportée, et contient
// de toute façon une clé "N\C" bugguée — l'échappement '\C' en JS ne produit
// pas un antislash littéral, donc elle ne matche jamais la vraie valeur
// "N/C" renvoyée par le backend).
const ETAT_STYLES = {
  'En attente': 'text-amber-700',
  'Enregistré': 'text-blue-700',
  'Déclaré': 'text-cyan-700',
  'Déposé': 'text-purple-700',
  'Payé': 'text-green-700',
  'Prélèvement': 'text-yellow-700',
  'Traité': 'text-slate-600',
  'N/C': 'text-muted-foreground',
};

// Colonnes du registre — toutes les infos propres au courrier (voir la
// migration add_courrier_fields_to_document_archives_table), avec un
// accesseur dédié pour le tri (types différents : texte, date, nombre).
function construireColonnes(t) {
  return [
    { cle: 'numero_registre', label: t('courriers.colNumero') },
    { cle: 'date_envoi', label: t('courriers.colDateEnvoi'), type: 'date' },
    { cle: 'date_reception', label: t('courriers.colDateReception'), type: 'date' },
    { cle: 'deadline_courrier', label: t('courriers.colEcheance'), type: 'date' },
    { cle: 'sens_courrier', label: t('courriers.colSens') },
    { cle: 'code_reference', label: t('courriers.colReference') },
    { cle: 'objet', label: t('courriers.colObjet') },
    { cle: 'resume', label: t('courriers.colContenu') },
    { cle: 'type_envoi', label: t('courriers.colTypeEnvoi') },
    { cle: 'numero_recommande', label: t('courriers.colNumeroRecommande') },
    { cle: 'expediteur_nom', label: t('courriers.colExpediteur') },
    { cle: 'expediteur_adresse', label: t('courriers.colAdresseExpediteur') },
    { cle: 'destinataire_nom', label: t('courriers.colDestinataire') },
    { cle: 'destinataire_adresse', label: t('courriers.colAdresseDestinataire') },
    { cle: 'nombre_documents', label: t('courriers.colNbDocuments'), type: 'nombre' },
    { cle: 'montant', label: t('courriers.colMontant'), type: 'nombre' },
    { cle: 'etat_courrier', label: t('courriers.colEtat') },
    { cle: 'auteur', label: t('courriers.colAuteur') },
  ];
}

// Date "effective" d'un courrier pour le filtre par période — un courrier
// entrant n'a de sens qu'avec sa date de réception, un sortant qu'avec sa
// date d'envoi (l'autre champ reste vide, voir CourrierForm.jsx).
function dateEffectiveCourrier(c) {
  return c.sens_courrier === 'sortant' ? c.date_envoi : c.date_reception;
}

function valeurCellule(c, cle) {
  if (cle === 'sens_courrier' || cle === 'etat_courrier' || cle === 'numero_registre') return null; // rendu à part
  const v = c[cle];
  if (v === null || v === undefined || v === '') return '—';
  if (cle === 'date_envoi' || cle === 'date_reception' || cle === 'deadline_courrier') {
    return new Date(v).toLocaleDateString('fr-FR');
  }
  if (cle === 'montant') return `${Number(v).toLocaleString('fr-FR')} €`;
  return v;
}

// Classe + contenu propres à chaque colonne personnalisable (hors numero_registre,
// verrouillée en première position — voir CLES_COLONNES_VERROUILLEES) : permet de
// rendre les cellules par simple boucle sur l'ordre choisi par la personne
// (voir PersonnaliserColonnes), au lieu d'une suite de <td> figée dans le JSX.
const CLASSES_CELLULE = {
  date_envoi: 'text-muted-foreground tabular-nums',
  date_reception: 'text-muted-foreground tabular-nums',
  deadline_courrier: 'text-muted-foreground tabular-nums',
  sens_courrier: 'text-xs font-semibold',
  code_reference: 'font-mono text-xs text-muted-foreground',
  objet: 'max-w-xs truncate',
  resume: 'max-w-xs truncate text-muted-foreground',
  type_envoi: 'text-muted-foreground',
  numero_recommande: 'text-muted-foreground',
  expediteur_nom: 'max-w-[160px] truncate',
  expediteur_adresse: 'max-w-[160px] truncate text-muted-foreground',
  destinataire_nom: 'max-w-[160px] truncate',
  destinataire_adresse: 'max-w-[160px] truncate text-muted-foreground',
  nombre_documents: 'tabular-nums text-center',
  montant: 'tabular-nums',
  auteur: 'text-muted-foreground',
};
const CLES_AVEC_TITRE = ['objet', 'resume', 'expediteur_nom', 'expediteur_adresse', 'destinataire_nom', 'destinataire_adresse'];

function contenuCellule(c, cle, t) {
  if (cle === 'sens_courrier') return c.sens_courrier === 'sortant' ? t('courriers.abrevSortant') : t('courriers.abrevEntrant');
  if (cle === 'etat_courrier') {
    return <span className={`font-medium ${ETAT_STYLES[c.etat_courrier] || 'text-muted-foreground'}`}>{c.etat_courrier || '—'}</span>;
  }
  return valeurCellule(c, cle);
}

/**
 * En-tête de colonne directement glissable pour réordonner — même principe
 * que LienSidebarTriable (Sidebar.jsx) et CarteStat (Home.jsx) : le délai
 * d'activation (rester appuyé ~350ms sans bouger, voir capteursColonnes)
 * distingue déjà un simple clic (trie la colonne) d'un vrai glissement, pas
 * besoin d'un bouton "personnaliser" séparé pour entrer dans un mode dédié.
 * Le bouton masquer (✕) n'apparaît qu'en mode édition (editionColonnes).
 */
function EnteteColonneTriable({ col, trier, iconeTri, editable, onMasquer }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.cle });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 20 : undefined };
  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className='px-3 py-2.5 border border-border sticky top-0 bg-muted/60 cursor-grab active:cursor-grabbing touch-manipulation select-none'
    >
      <span className='inline-flex items-center gap-1'>
        <button onClick={trier} className='inline-flex items-center gap-1 hover:text-foreground transition-colors'>
          {col.label} {iconeTri}
        </button>
        {editable && (
          <button onClick={(e) => { e.stopPropagation(); onMasquer(col.cle); }} className='flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors'>
            <LuX size={10} />
          </button>
        )}
      </span>
    </th>
  );
}

/**
 * Registre des courriers (entrants + sortants) — présentation volontairement
 * sobre façon registre papier plutôt que tableau de bord coloré (retour
 * direct du personnel : "ça ne ressemble pas à un registre") : numérotation
 * séquentielle par sens (E-001, S-001...) dans l'ordre chronologique de
 * dépôt, quadrillage complet, couleurs réduites au minimum. Tri par colonne
 * et export PDF/Excel conservés — c'est le fond qui doit rester un vrai
 * registre consultable, pas la capacité de trier/exporter.
 */
function Courriers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const confirm = useConfirm();
  // Lecture ouverte à tout le personnel interne (voir routes/api.php), mais
  // modifier/supprimer reste réservé à qui peut créer un courrier (même
  // permission que l'archivage, creer_documents) — ces boutons se masquent
  // pour tous les autres plutôt que d'afficher une action qui échouerait
  // silencieusement côté serveur.
  const { hasPermission, isAdministrator } = usePermissions();
  const peutGererCourriers = isAdministrator || hasPermission('creer_documents');
  // Même permission que les boutons de résolution d'un courrier (voir
  // DocView.jsx/DocumentController::resoudreCourrier()) — pas creer_documents,
  // qui concerne la création/modification, pas le suivi d'un courrier existant.
  const peutRelancer = isAdministrator || hasPermission('traiter_courrier');
  const [relanceEnCours, setRelanceEnCours] = useState(null);
  const [courriers, setCourriers] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [sens, setSens] = useState(searchParams.get('sens') || 'tous');
  const [etat, setEtat] = useState(searchParams.get('etat') || 'tous');
  const [periode, setPeriode] = useState(() => (searchParams.get('periodePreset')
    ? { preset: searchParams.get('periodePreset'), debut: searchParams.get('periodeDebut') || '', fin: searchParams.get('periodeFin') || '' }
    : PERIODE_VIDE));
  const [recherche, setRecherche] = useState(searchParams.get('q') || '');
  // Par défaut : date la plus récente en premier (date de réception pour un
  // entrant, d'envoi pour un sortant — voir dateEffectiveCourrier()), pas le
  // numéro de registre — retour utilisateur : "on devrait plus se concentrer
  // sur la date de réception la plus récente".
  const [tri, setTri] = useState({ cle: searchParams.get('triCle') || 'date_effective', sens: searchParams.get('triSens') || 'desc' });
  const [pageActuelle, setPageActuelle] = useState(Number(searchParams.get('page')) || 1);
  const [courrierEnEdition, setCourrierEnEdition] = useState(null);

  // Revient toujours en page 1 quand un filtre change — sinon on peut se
  // retrouver sur une page devenue vide après avoir filtré la liste (même
  // motif que AppelsTelephoniques.jsx). Pas au tout premier rendu : sinon la
  // page restaurée depuis l'URL (voir plus bas) serait aussitôt écrasée.
  const premierRenduFiltres = useRef(true);
  useEffect(() => {
    if (premierRenduFiltres.current) { premierRenduFiltres.current = false; return; }
    setPageActuelle(1);
  }, [sens, etat, periode, recherche]);

  // Ouvrir un courrier (navigate vers /view/...) démonte cette page — au
  // retour, elle remonte de zéro et sans ceci, recherche/filtres/page
  // repartaient à leur valeur par défaut (retour utilisateur : "c'est comme
  // ça partout"). Même principe que OpenFolder.jsx/FluctuationRh.jsx : l'état
  // vit dans l'URL plutôt que dans un simple useState.
  useEffect(() => {
    const params = {};
    if (sens !== 'tous') params.sens = sens;
    if (etat !== 'tous') params.etat = etat;
    if (periode.preset !== 'tous') {
      params.periodePreset = periode.preset;
      if (periode.debut) params.periodeDebut = periode.debut;
      if (periode.fin) params.periodeFin = periode.fin;
    }
    if (recherche) params.q = recherche;
    if (tri.cle !== 'date_effective') params.triCle = tri.cle;
    if (tri.sens !== 'desc') params.triSens = tri.sens;
    if (pageActuelle !== 1) params.page = String(pageActuelle);
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sens, etat, periode, recherche, tri, pageActuelle]);

  // numero_registre reste verrouillée en première colonne (numérotation façon
  // registre papier, voir courriersNumerotes) — seul le reste est personnalisable.
  const colonnes = useMemo(() => construireColonnes(t), [t]);
  const colonnesParDefaut = useMemo(() => colonnes.filter((c) => c.cle !== 'numero_registre'), [colonnes]);
  const { colonnesTriees, colonnesVisibles, ordre, setOrdre, cachees, setCachees } = useColonnesPersonnalisees('his_colonnes_courriers', colonnesParDefaut);
  const colonnesCachees = colonnesTriees.filter((c) => cachees.includes(c.cle));
  const [editionColonnes, setEditionColonnes] = useState(false);
  // Même délai d'activation que LienSidebarTriable/CarteStat (rester appuyé
  // ~350ms sans bouger) : un simple clic continue de trier la colonne, un
  // vrai glissement la réordonne — pas de mode dédié à activer pour ça.
  const capteursColonnes = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 350, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 6 } }),
  );
  function onDragEndColonnes(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ancienIndex = ordre.indexOf(active.id);
    const nouvelIndex = ordre.indexOf(over.id);
    setOrdre(arrayMove(ordre, ancienIndex, nouvelIndex));
  }

  function fetchCourriers() {
    return getDocument()
      .then((res) => (res.status === 200 ? res.json() : []))
      .then((data) => setCourriers((Array.isArray(data) ? data : []).filter((d) => d.sens_courrier)))
      .catch(() => {})
      .finally(() => setChargement(false));
  }

  useEffect(() => { fetchCourriers(); }, []);

  // Numérotation façon registre papier : un compteur par sens (E-001, E-002...
  // / S-001, S-002...), dans l'ordre chronologique de dépôt — exactement
  // comme on numéroterait au fil de l'eau dans un vrai registre, pas un
  // simple index d'affichage qui changerait selon le tri/filtre courant.
  const courriersNumerotes = useMemo(() => {
    const parSens = { entrant: [], sortant: [] };
    [...courriers]
      .sort((a, b) => new Date(a.date_envoi || a.date_reception || a.created_at) - new Date(b.date_envoi || b.date_reception || b.created_at))
      .forEach((c) => parSens[c.sens_courrier]?.push(c));

    const numeros = new Map();
    Object.entries(parSens).forEach(([s, liste]) => {
      liste.forEach((c, i) => numeros.set(c.id, `${s === 'entrant' ? 'E' : 'S'}-${String(i + 1).padStart(3, '0')}`));
    });
    return courriers.map((c) => ({ ...c, numero_registre: numeros.get(c.id) }));
  }, [courriers]);

  const etatsDisponibles = useMemo(
    () => [...new Set(courriers.map((c) => c.etat_courrier).filter(Boolean))],
    [courriers]
  );

  const courriersFiltres = useMemo(() => {
    return courriersNumerotes
      .filter((c) => sens === 'tous' || c.sens_courrier === sens)
      .filter((c) => etat === 'tous' || c.etat_courrier === etat)
      .filter((c) => dateDansPeriode(dateEffectiveCourrier(c), periode))
      .filter((c) => !recherche.trim() || correspondARequete(
        [c.objet, c.expediteur_nom, c.destinataire_nom, c.code_reference, c.titre_document, c.auteur],
        recherche
      ));
  }, [courriersNumerotes, sens, etat, periode, recherche]);

  const courriersAffiches = useMemo(() => {
    const colonneTri = colonnes.find((col) => col.cle === tri.cle);
    const copie = [...courriersFiltres];
    copie.sort((a, b) => {
      if (tri.cle === 'date_effective') {
        const va = dateEffectiveCourrier(a) ? new Date(dateEffectiveCourrier(a)).getTime() : 0;
        const vb = dateEffectiveCourrier(b) ? new Date(dateEffectiveCourrier(b)).getTime() : 0;
        if (va < vb) return tri.sens === 'asc' ? -1 : 1;
        if (va > vb) return tri.sens === 'asc' ? 1 : -1;
        return 0;
      }
      let va = a[tri.cle];
      let vb = b[tri.cle];
      if (colonneTri?.type === 'date') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else if (colonneTri?.type === 'nombre') {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      } else {
        va = (va || '').toString().toLowerCase();
        vb = (vb || '').toString().toLowerCase();
      }
      if (va < vb) return tri.sens === 'asc' ? -1 : 1;
      if (va > vb) return tri.sens === 'asc' ? 1 : -1;
      return 0;
    });
    return copie;
  }, [courriersFiltres, tri, colonnes]);

  // Pagination : le compteur/export continuent d'utiliser courriersAffiches
  // (la liste filtrée complète), seul le tableau affiché est découpé par page.
  const totalPages = Math.max(1, Math.ceil(courriersAffiches.length / COURRIERS_PAR_PAGE));
  const courriersPage = useMemo(() => {
    const debut = (pageActuelle - 1) * COURRIERS_PAR_PAGE;
    return courriersAffiches.slice(debut, debut + COURRIERS_PAR_PAGE);
  }, [courriersAffiches, pageActuelle]);

  function trierPar(cle) {
    setTri((prev) => prev.cle === cle ? { cle, sens: prev.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: 'asc' });
  }

  function IconeTri({ cle }) {
    if (tri.cle !== cle) return <LuArrowUpDown size={11} className='text-muted-foreground/40' />;
    return tri.sens === 'asc' ? <LuArrowUp size={11} className='text-foreground' /> : <LuArrowDown size={11} className='text-foreground' />;
  }

  function ouvrir(doc) {
    const extension = String(doc.chemin_stockage_serveur).split('.').pop();
    navigate(`/view/${doc.id}/${extension}`);
  }

  function ouvrirNouveauCourrier() {
    // Repart d'un formulaire vierge même si un courrier restait en édition
    // (fermeture par ÉCHAP/clic extérieur sans passer par le bouton "✕").
    setCourrierEnEdition(null);
    document.getElementById('nouveauCourrier')?.showModal();
  }

  function ouvrirModification(c, e) {
    e.stopPropagation();
    setCourrierEnEdition(c);
    document.getElementById('nouveauCourrier')?.showModal();
  }

  async function supprimerCourrier(c, e) {
    e.stopPropagation();
    if (!await confirm({ message: t('courriers.confirmerSuppression'), danger: true })) return;
    const res = await deleteDocument(c.id).catch(() => null);
    if (res?.status === 200) {
      toast.success(t('courriers.courrierSupprime'));
      fetchCourriers();
    } else {
      toast.error(t('commun.erreurGenerique'));
    }
  }

  async function relancerCourrierAction(c, e) {
    e.stopPropagation();
    setRelanceEnCours(c.id);
    const res = await relancerCourrier(c.id).catch(() => null);
    setRelanceEnCours(null);
    if (res?.status === 200) {
      toast.success(t('courriers.rappelEnvoye'));
    } else {
      const data = await res?.json().catch(() => ({}));
      toast.error(data?.error || t('commun.erreurGenerique'));
    }
  }

  return (
    <div className='flex flex-col flex-grow py-6 gap-4'>
      <FiligraneHIS fixe opacite={0.12} />
      <Breadcrumbs where={t('sidebar.courriers')} />

      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div>
          <h2 className='text-2xl font-semibold text-foreground'>{t('courriers.registreTitre')}</h2>
          <p className='text-sm text-muted-foreground mt-0.5'>{t('courriers.nResultats', { count: courriersAffiches.length })}</p>
        </div>
        <div className='flex items-center gap-2'>
          {peutGererCourriers && (
            <button
              onClick={ouvrirNouveauCourrier}
              className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'
            >
              <LuMailPlus size={15} /> {t('courrier.nouveauCourrier')}
            </button>
          )}
          <button
            onClick={() => exporterCourriersExcel(courriersAffiches, colonnesExcel(t))}
            disabled={courriersAffiches.length === 0}
            className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <LuFileSpreadsheet size={15} /> {t('courriers.exporterExcel')}
          </button>
          <button
            onClick={() => exporterCourriersPdf(courriersAffiches, colonnesPdf(t), t('courriers.registreTitre'))}
            disabled={courriersAffiches.length === 0}
            className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <LuFileDown size={15} /> {t('courriers.exporterPdf')}
          </button>
          <button
            type='button'
            onClick={() => setEditionColonnes((v) => !v)}
            title={editionColonnes ? t('commun.terminerPersonnalisation') : t('commun.personnaliserColonnes')}
            className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${editionColonnes ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'}`}
          >
            {editionColonnes ? <LuCheck size={15} /> : <LuSlidersHorizontal size={15} />}
          </button>
        </div>
      </div>

      {editionColonnes && colonnesCachees.length > 0 && (
        <div className='flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-card px-3.5 py-2.5'>
          <span className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>{t('commun.colonnesMasquees')}</span>
          {colonnesCachees.map((col) => (
            <button
              key={col.cle}
              type='button'
              onClick={() => setCachees(cachees.filter((c) => c !== col.cle))}
              className='inline-flex items-center gap-1.5 text-xs font-medium rounded-full border border-dashed border-border bg-background px-2.5 py-1.5 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors'
            >
              <span className='text-primary font-bold'>+</span> {col.label}
            </button>
          ))}
        </div>
      )}

      <div className='flex items-center gap-2.5 flex-wrap rounded-lg border border-border bg-card px-3.5 py-2.5'>
        <div className='relative flex-grow min-w-[200px] max-w-sm'>
          <LuSearch size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
          <input
            type='text'
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('courriers.rechercher')}
            className='w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
          />
        </div>
        <MenuDeroulant
          value={sens}
          onChange={setSens}
          options={[
            { value: 'tous', label: t('courriers.tousLesSens') },
            { value: 'entrant', label: t('courrier.courrierEntrant') },
            { value: 'sortant', label: t('courrier.courrierSortant') },
          ]}
        />
        <MenuDeroulant
          value={etat}
          onChange={setEtat}
          options={[
            { value: 'tous', label: t('courriers.tousLesEtats') },
            ...etatsDisponibles.map((e) => ({ value: e, label: e })),
          ]}
        />
        <FiltrePeriode valeur={periode} onChange={setPeriode} />
      </div>

      <div className='rounded-lg border border-border bg-card overflow-hidden'>
        {chargement ? (
          <div className='flex items-center justify-center py-16'>
            <LuLoader className='animate-spin text-muted-foreground' size={22} />
          </div>
        ) : courriersAffiches.length === 0 ? (
          <p className='text-sm text-muted-foreground text-center py-16'>{t('courriers.aucunCourrier')}</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm whitespace-nowrap border-collapse'>
              <thead>
                <tr className='bg-muted/60 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                  <th className='px-3 py-2.5 border border-border sticky top-0 bg-muted/60'>
                    <button onClick={() => trierPar('numero_registre')} className='inline-flex items-center gap-1 hover:text-foreground transition-colors'>
                      {t('courriers.colNumero')} <IconeTri cle='numero_registre' />
                    </button>
                  </th>
                  <DndContext sensors={capteursColonnes} collisionDetection={closestCenter} onDragEnd={onDragEndColonnes}>
                    <SortableContext items={ordre} strategy={horizontalListSortingStrategy}>
                      {colonnesVisibles.map((col) => (
                        <EnteteColonneTriable
                          key={col.cle}
                          col={col}
                          trier={() => trierPar(col.cle)}
                          iconeTri={<IconeTri cle={col.cle} />}
                          editable={editionColonnes}
                          onMasquer={(cle) => setCachees([...cachees, cle])}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  {(peutGererCourriers || peutRelancer) && <th className='px-3 py-2.5 border border-border sticky top-0 bg-muted/60'></th>}
                </tr>
              </thead>
              <tbody>
                {courriersPage.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => ouvrir(c)}
                    className='cursor-pointer hover:bg-muted/40 transition-colors odd:bg-background even:bg-muted/10'
                  >
                    <td className='px-3 py-2 border border-border font-mono text-xs text-muted-foreground'>{c.numero_registre}</td>
                    {colonnesVisibles.map((col) => (
                      <td
                        key={col.cle}
                        className={`px-3 py-2 border border-border ${CLASSES_CELLULE[col.cle] || ''}`}
                        title={CLES_AVEC_TITRE.includes(col.cle) ? (c[col.cle] || undefined) : undefined}
                      >
                        {contenuCellule(c, col.cle, t)}
                      </td>
                    ))}
                    {(peutGererCourriers || peutRelancer) && (
                      <td className='px-3 py-2 border border-border'>
                        <div className='flex items-center gap-1'>
                          {peutRelancer && c.sens_courrier === 'entrant' && c.etat_courrier === 'En attente' && (
                            <button
                              onClick={(e) => relancerCourrierAction(c, e)}
                              disabled={relanceEnCours === c.id}
                              title={t('courriers.relancer')}
                              className='flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground transition-colors disabled:opacity-40'
                            >
                              {relanceEnCours === c.id ? <LuLoader size={13} className='animate-spin' /> : <LuBellRing size={13} />}
                            </button>
                          )}
                          {peutGererCourriers && (
                            <>
                              <button
                                onClick={(e) => ouvrirModification(c, e)}
                                title={t('courriers.modifier')}
                                className='flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
                              >
                                <LuPencil size={13} />
                              </button>
                              <button
                                onClick={(e) => supprimerCourrier(c, e)}
                                title={t('courriers.supprimer')}
                                className='flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors'
                              >
                                <LuTrash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination currentPage={pageActuelle} totalPages={totalPages} onPageChange={setPageActuelle} />

      <CourrierForm
        onArchive={fetchCourriers}
        courrierAModifier={courrierEnEdition}
        onModifie={() => { setCourrierEnEdition(null); fetchCourriers(); }}
      />
    </div>
  );
}

export default Courriers;
