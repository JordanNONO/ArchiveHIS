import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  LuSearch, LuLoader, LuFileDown, LuFileSpreadsheet, LuPlus, LuPencil, LuTrash2, LuChevronLeft, LuChevronRight,
  LuAlertTriangle, LuCheck, LuLock, LuUnlock, LuSend, LuCalendarClock, LuCalendarDays, LuArrowLeftRight, LuArrowLeft, LuShieldAlert,
} from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import FiligraneHIS from '../components/FiligraneHIS';
import FluctuationRhForm from '../components/FluctuationRhForm';
import { usePermissions } from '../hooks/usePermissions';
import { getDisplayName, getInitials } from '../utils/common';
import { correspondARequete } from '../utils/recherche';
import { controlerMois, echeancesAVenir } from '../utils/controlesFluctuationRh';
import { exporterFluctuationExcel, exporterFluctuationPdf } from '../utils/exportFluctuationRh';
import {
  getFluctuationsRh, getMoisFluctuationsRh, getSalariesFluctuationsRh, deleteFluctuationRh, changerStatutMoisFluctuationRh,
} from '../api/routes/fluctuationRh';
import {
  SECTION_PAR_CLE, GROUPES_FLUCTUATION, TONS, ICONE_TON, cleLibelleChamp, moisCourant, decalerMois, libelleMois,
  formatDateCourte, formatMontant,
} from '../constants/fluctuationRh';

const ETAPES = ['brouillon', 'valide', 'transmis'];

function nomUtilisateur(u) {
  if (!u) return '';
  return getDisplayName({ personnel: u.personnels?.[0] }) || u.nom || '';
}

/**
 * Fluctuation RH — éléments variables de paie du mois. Remplace le classeur
 * Google Sheets "FLUCTUATION 2025/2026" (un onglet par mois) : mêmes
 * sections, même lecture "par mois", plus les contrôles automatiques, le
 * circuit validation RH -> transmission paie, et les exports Excel/PDF.
 */
function FluctuationRh() {
  const { t, i18n } = useTranslation();
  const { hasPermission, isAdministrator } = usePermissions();
  const autorise = isAdministrator || hasPermission('gerer_fluctuation_rh');
  const [searchParams, setSearchParams] = useSearchParams();
  const [mois, setMois] = useState(() => (/^\d{4}-\d{2}$/.test(searchParams.get('mois') || '') ? searchParams.get('mois') : null));
  const [lignes, setLignes] = useState([]);
  const [statut, setStatut] = useState({ statut: 'brouillon' });
  const [listeMois, setListeMois] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [chargement, setChargement] = useState(true);
  // null = vue d'ensemble (tuiles de section) ; une clé de section = vue
  // détail (tableau de cette section seule) — remplace l'ancien système
  // d'onglets (retour utilisateur : préférer une vraie page d'accueil par
  // tuiles, façon sélecteur de catégories, à une rangée d'onglets).
  const [sectionOuverte, setSectionOuverte] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [formulaire, setFormulaire] = useState(null); // { ligne?, section? }
  const [ligneASupprimer, setLigneASupprimer] = useState(null);
  const [actionEnCours, setActionEnCours] = useState(false);
  const [ligneSurlignee, setLigneSurlignee] = useState(null);
  // Contrôles automatiques / Échéances à venir / Année : plus de colonne de
  // droite — 3 icônes égales dans une barre collée en bas, un seul contenu
  // affiché à la fois au-dessus de la barre (retour utilisateur, croquis à
  // l'appui). null = rien d'ouvert.
  const [panneauOuvert, setPanneauOuvert] = useState(null);
  function togglePanneau(cle) {
    setPanneauOuvert((prec) => (prec === cle ? null : cle));
  }

  const chargerListeMois = useCallback(() => {
    return getMoisFluctuationsRh()
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { setListeMois(Array.isArray(data) ? data : []); return Array.isArray(data) ? data : []; })
      .catch(() => []);
  }, []);

  const chargerMois = useCallback((m) => {
    if (!m) return Promise.resolve();
    setChargement(true);
    return getFluctuationsRh(m)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setLignes(data?.lignes || []);
        setStatut(data?.statut || { statut: 'brouillon' });
      })
      .catch(() => {})
      .finally(() => setChargement(false));
  }, []);

  function rechargerSalaries() {
    getSalariesFluctuationsRh().then((r) => (r.ok ? r.json() : [])).then((d) => setSalaries(Array.isArray(d) ? d : [])).catch(() => {});
  }

  // Premier affichage : le mois en cours s'il a déjà des lignes, sinon le
  // dernier mois renseigné — ouvrir sur un mois vide alors que le tableau du
  // mois précédent est plein n'aide personne.
  useEffect(() => {
    if (!autorise) return;
    rechargerSalaries();
    chargerListeMois().then((liste) => {
      if (mois) return;
      const courant = moisCourant();
      const avecDonnees = liste.filter((x) => x.total > 0).map((x) => x.mois.slice(0, 7));
      const choix = avecDonnees.includes(courant) ? courant : (avecDonnees.find((x) => x <= courant) || avecDonnees[0] || courant);
      setMois(choix);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorise]);

  useEffect(() => {
    if (!mois || !autorise) return;
    // Changement de mois : on vide le tableau pour ne pas afficher les lignes
    // du mois précédent sous le nom du nouveau pendant le chargement.
    setLignes([]);
    chargerMois(mois);
    setSearchParams({ mois }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mois, autorise]);

  // Arrivée depuis une notification (voir RenouvellementEssaiNotification) :
  // /fluctuation-rh?mois=AAAA-MM&ligne=<id>. Même principe que les appels
  // (AppelsTelephoniques.jsx) — bon mois, bonne section, défilement jusqu'à la
  // ligne et surlignage temporaire — mais en violet, pour ne pas confondre avec
  // l'ambre des appels. `ligne` est mémorisé à part car l'effet ci-dessus
  // réécrit l'URL avec le seul `mois`. Dépend de searchParams pour marcher
  // aussi quand on est déjà sur la page et qu'on clique une autre notification.
  const [ligneCible, setLigneCible] = useState(() => searchParams.get('ligne'));
  const [ligneNotifiee, setLigneNotifiee] = useState(null);
  useEffect(() => {
    const cible = searchParams.get('ligne');
    if (!cible) return;
    const moisUrl = searchParams.get('mois');
    if (/^\d{4}-\d{2}$/.test(moisUrl || '') && moisUrl !== mois) setMois(moisUrl);
    setLigneCible(cible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!ligneCible || chargement || lignes.length === 0) return;
    const ligne = lignes.find((l) => String(l.id) === String(ligneCible));
    if (!ligne) return;
    setLigneCible(null);
    setPanneauOuvert(null);
    setRecherche('');
    setSectionOuverte(ligne.section);
    setLigneNotifiee(ligne.id);
  }, [ligneCible, lignes, chargement]);

  useEffect(() => {
    if (!ligneNotifiee) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`fluctuation-ligne-${ligneNotifiee}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    const minuteur = setTimeout(() => setLigneNotifiee(null), 4000);
    return () => { cancelAnimationFrame(frame); clearTimeout(minuteur); };
  }, [ligneNotifiee, sectionOuverte]);

  function rafraichir() {
    chargerMois(mois);
    chargerListeMois();
    rechargerSalaries();
  }

  const verrouille = statut.statut !== 'brouillon';
  const alertes = useMemo(() => (mois ? controlerMois(lignes, mois) : []), [lignes, mois]);
  const alertesParLigne = useMemo(() => {
    const m = new Map();
    for (const a of alertes) for (const id of a.ids) m.set(id, [...(m.get(id) || []), a.type]);
    return m;
  }, [alertes]);
  const echeances = useMemo(() => (mois ? echeancesAVenir(lignes, mois) : []), [lignes, mois]);

  const lignesFiltrees = useMemo(() => lignes.filter((l) => !recherche.trim() || correspondARequete(
    [l.salarie, l.motif, l.observations, l.heures, t(`fluctuationRh.section_${l.section}`)], recherche,
  )), [lignes, recherche, t]);

  const compteParSection = useMemo(() => {
    const c = {};
    for (const l of lignes) c[l.section] = (c[l.section] || 0) + 1;
    return c;
  }, [lignes]);

  /** Salariés distincts concernés par une section ce mois-ci — alimente la pile d'avatars de sa tuile (vue d'ensemble). */
  const salariesParSection = useMemo(() => {
    const m = {};
    for (const l of lignes) {
      if (!m[l.section]) m[l.section] = [];
      if (!m[l.section].includes(l.salarie)) m[l.section].push(l.salarie);
    }
    return m;
  }, [lignes]);

  async function changerStatut(action) {
    setActionEnCours(true);
    const res = await changerStatutMoisFluctuationRh(mois, action).catch(() => null);
    setActionEnCours(false);
    if (res?.ok) {
      setStatut(await res.json());
      chargerListeMois();
      toast.success(t(`fluctuationRh.statutChange_${action}`));
    } else {
      const corps = await res?.json().catch(() => null);
      toast.error(corps?.error || t('commun.erreurGenerique'));
    }
  }

  async function confirmerSuppression() {
    if (!ligneASupprimer) return;
    setActionEnCours(true);
    const res = await deleteFluctuationRh(ligneASupprimer.id).catch(() => null);
    setActionEnCours(false);
    if (res?.ok) {
      toast.success(t('fluctuationRh.ligneSupprimee'));
      setLigneASupprimer(null);
      rafraichir();
    } else {
      const corps = await res?.json().catch(() => null);
      toast.error(corps?.error || t('commun.erreurGenerique'));
    }
  }

  function allerALigne(a) {
    const ligne = lignes.find((l) => l.id === a.ids[0]);
    if (!ligne) return;
    setPanneauOuvert(null);
    setRecherche('');
    setSectionOuverte(ligne.section);
    setLigneSurlignee(ligne.id);
    requestAnimationFrame(() => document.getElementById(`fluctuation-ligne-${ligne.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    setTimeout(() => setLigneSurlignee(null), 2500);
  }

  function valeurCellule(l, champ) {
    const v = l[champ];
    if (v === null || v === undefined || v === '') return <span className='text-muted-foreground/50'>—</span>;
    if (champ === 'date_debut' || champ === 'date_fin') return <span className='tabular-nums'>{formatDateCourte(v)}</span>;
    if (champ === 'montant') return <span className='tabular-nums font-medium'>{formatMontant(v)}</span>;
    if (champ === 'motif') {
      return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium whitespace-normal ${TONS[SECTION_PAR_CLE[l.section].ton]}`}>{v}</span>;
    }
    if (champ === 'salarie') return <span className='font-semibold text-foreground'>{v}</span>;
    return <span className='whitespace-pre-line'>{v}</span>;
  }

  function rendreTableSection(s) {
    const lignesSection = lignesFiltrees.filter((l) => l.section === s.cle);
    return (
      <div key={s.cle} className='flex flex-col'>
        {lignesSection.length === 0 ? (
          <div className='flex flex-col items-center gap-2 py-14 text-center'>
            <p className='text-sm text-muted-foreground'>{recherche ? t('fluctuationRh.aucunResultat') : t('fluctuationRh.sectionVide')}</p>
            {!verrouille && !recherche && (
              <button onClick={() => setFormulaire({ section: s.cle })} className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors'>
                <LuPlus size={14} /> {t('fluctuationRh.ajouterDans', { section: t(`fluctuationRh.section_${s.cle}`) })}
              </button>
            )}
          </div>
        ) : (
          <div className='overflow-x-auto rounded-lg border border-border'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='bg-muted/60 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide'>
                  <th className='px-3 py-2 border-b border-border w-12'>N°</th>
                  {s.champs.map((c) => (
                    <th key={c} className={`px-3 py-2 border-b border-border whitespace-nowrap ${c === 'montant' ? 'text-right' : ''}`}>{t(`fluctuationRh.${cleLibelleChamp(s.cle, c)}`)}</th>
                  ))}
                  {/* Colonne d'actions collée à droite : reste visible même quand le tableau défile horizontalement (écran étroit). */}
                  <th className='px-3 py-2 border-b border-border w-20 sticky right-0 bg-muted'></th>
                </tr>
              </thead>
              <tbody>
                {lignesSection.map((l, i) => {
                  const types = alertesParLigne.get(l.id);
                  return (
                    <tr
                      key={l.id}
                      id={`fluctuation-ligne-${l.id}`}
                      className={`align-top transition-colors ${ligneSurlignee === l.id ? 'bg-accent/30' : types ? 'bg-amber-500/[0.07] hover:bg-amber-500/[0.12]' : 'odd:bg-background even:bg-muted/10 hover:bg-muted/40'}`}
                      style={ligneNotifiee === l.id ? {
                        backgroundColor: 'rgba(124,58,237,0.18)',
                        boxShadow: 'inset 0 0 0 2px rgba(124,58,237,0.6)',
                        transition: 'background-color 700ms ease, box-shadow 700ms ease',
                      } : undefined}
                    >
                      <td className='px-3 py-2 border-b border-border text-xs text-muted-foreground tabular-nums'>
                        <span className='inline-flex items-center gap-1'>
                          {i + 1}
                          {types && (
                            <span title={types.map((x) => t(`fluctuationRh.controle_${x}`)).join('\n')} className='text-amber-600 dark:text-amber-400'>
                              <LuAlertTriangle size={12} />
                            </span>
                          )}
                        </span>
                      </td>
                      {s.champs.map((c) => (
                        <td key={c} className={`px-3 py-2 border-b border-border ${c === 'montant' ? 'text-right' : ''} ${c === 'observations' ? 'min-w-[200px] max-w-[360px] text-muted-foreground text-xs' : c === 'salarie' ? 'min-w-[180px]' : 'whitespace-nowrap'}`}>
                          {valeurCellule(l, c)}
                        </td>
                      ))}
                      <td className='px-2 py-1.5 border-b border-border sticky right-0 bg-card'>
                        {!verrouille && (
                          <div className='flex items-center gap-0.5 justify-end'>
                            <button onClick={() => setFormulaire({ ligne: l })} title={t('fluctuationRh.modifier')} className='flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
                              <LuPencil size={13} />
                            </button>
                            <button onClick={() => setLigneASupprimer(l)} title={t('fluctuationRh.supprimer')} className='flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors'>
                              <LuTrash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (!autorise) {
    return (
      <div className='flex flex-col flex-grow py-6 gap-4'>
        <Breadcrumbs where={t('sidebar.fluctuationRh')} />
        <div className='flex flex-col items-center gap-3 py-20 text-center'>
          <span className='w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center'><LuShieldAlert size={22} /></span>
          <h2 className='text-lg font-semibold'>{t('fluctuationRh.accesReserveTitre')}</h2>
          <p className='text-sm text-muted-foreground max-w-md'>{t('fluctuationRh.accesReserveTexte')}</p>
        </div>
      </div>
    );
  }

  const indexEtape = ETAPES.indexOf(statut.statut);
  const aucuneDonnee = !chargement && lignes.length === 0;
  const anneeAffichee = mois ? Number(mois.slice(0, 4)) : new Date().getFullYear();
  const moisParCle = new Map(listeMois.map((m) => [m.mois.slice(0, 7), m]));

  return (
    <div className='flex flex-col flex-grow py-6 gap-4'>
      <FiligraneHIS fixe opacite={0.08} />
      <Breadcrumbs where={t('sidebar.fluctuationRh')} />

      {/* En-tête */}
      <div className='flex items-start justify-between flex-wrap gap-3'>
        <div>
          <h2 className='text-2xl font-semibold text-foreground'>{t('fluctuationRh.titre')}</h2>
          <p className='text-sm text-muted-foreground mt-0.5'>{t('fluctuationRh.sousTitre')}</p>
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          <button onClick={() => exporterFluctuationExcel(lignes, mois, t)} disabled={!lignes.length} className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'>
            <LuFileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={() => exporterFluctuationPdf(lignes, mois, t, t(`fluctuationRh.statut_${statut.statut}`))} disabled={!lignes.length} className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'>
            <LuFileDown size={15} /> PDF
          </button>
        </div>
      </div>

      {/* Barre du mois + circuit de validation */}
      <div className='flex items-center gap-3 flex-wrap rounded-xl border border-border bg-card px-3.5 py-3'>
        <div className='flex items-center gap-1'>
          <button onClick={() => setMois((m) => decalerMois(m, -1))} title={t('fluctuationRh.moisPrecedent')} className='flex items-center justify-center w-8 h-8 rounded-lg border border-border hover:bg-muted transition-colors'>
            <LuChevronLeft size={16} />
          </button>
          <label className='relative'>
            <span className='block min-w-[150px] text-center text-base font-semibold text-foreground px-2'>{mois ? libelleMois(mois, i18n.language) : '…'}</span>
            <input type='month' value={mois || ''} onChange={(e) => e.target.value && setMois(e.target.value)} className='absolute inset-0 opacity-0 cursor-pointer' aria-label={t('fluctuationRh.choisirMois')} />
          </label>
          <button onClick={() => setMois((m) => decalerMois(m, 1))} title={t('fluctuationRh.moisSuivant')} className='flex items-center justify-center w-8 h-8 rounded-lg border border-border hover:bg-muted transition-colors'>
            <LuChevronRight size={16} />
          </button>
        </div>

        <ol className='flex items-center gap-1 ml-auto flex-wrap'>
          {ETAPES.map((etape, i) => {
            const faite = i < indexEtape || (i === indexEtape && etape === 'transmis');
            const courante = i === indexEtape && etape !== 'transmis';
            return (
              <li key={etape} className='flex items-center gap-1'>
                {i > 0 && <span className={`w-5 h-px ${i <= indexEtape ? 'bg-green-500' : 'bg-border'}`} />}
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${faite ? 'bg-green-500/10 text-green-700 dark:text-green-400' : courante ? 'bg-accent/25 text-foreground' : 'text-muted-foreground'}`}>
                  {faite ? <LuCheck size={12} /> : <span className='tabular-nums'>{i + 1}</span>}
                  {t(`fluctuationRh.etape_${etape}`)}
                </span>
              </li>
            );
          })}
        </ol>

        <div className='flex items-center gap-2'>
          {statut.statut === 'brouillon' && (
            <button onClick={() => changerStatut('valider')} disabled={actionEnCours || !lignes.length} className='inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity'>
              <LuLock size={14} /> {t('fluctuationRh.validerMois')}
            </button>
          )}
          {statut.statut === 'valide' && (
            <button onClick={() => changerStatut('transmettre')} disabled={actionEnCours} className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors'>
              <LuSend size={14} /> {t('fluctuationRh.transmettrePaie')}
            </button>
          )}
          {statut.statut !== 'brouillon' && (
            <button onClick={() => changerStatut('rouvrir')} disabled={actionEnCours} className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors'>
              <LuUnlock size={14} /> {t('fluctuationRh.rouvrir')}
            </button>
          )}
        </div>
      </div>

      {verrouille && (
        <div className='flex items-start gap-2 rounded-lg border border-green-500/25 bg-green-500/[0.06] px-3.5 py-2.5 text-sm'>
          <LuLock size={15} className='text-green-600 mt-0.5 shrink-0' />
          <p className='text-foreground'>
            {statut.statut === 'transmis'
              ? t('fluctuationRh.bandeauTransmis', { date: statut.transmis_le ? new Date(statut.transmis_le).toLocaleDateString('fr-FR') : '', nom: nomUtilisateur(statut.transmis_par) })
              : t('fluctuationRh.bandeauValide', { date: statut.valide_le ? new Date(statut.valide_le).toLocaleDateString('fr-FR') : '', nom: nomUtilisateur(statut.valide_par) })}
          </p>
        </div>
      )}

      <div className='flex flex-col gap-4'>
        {/* Tableau — plus de colonne de droite, voir la barre d'icônes
            collée en bas de page pour Contrôles/Échéances/Année. */}
        <div className='min-w-0 rounded-xl border border-border bg-card'>
          {chargement && !lignes.length ? (
            <div className='flex items-center justify-center py-16'><LuLoader className='animate-spin text-muted-foreground' size={22} /></div>
          ) : aucuneDonnee ? (
            <div className='flex flex-col items-center gap-3 py-16 text-center px-4'>
              <span className='w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center'><LuArrowLeftRight size={20} /></span>
              <p className='text-sm font-medium text-foreground'>{t('fluctuationRh.moisVideTitre', { mois: libelleMois(mois, i18n.language) })}</p>
              <p className='text-sm text-muted-foreground max-w-md'>{t('fluctuationRh.moisVideTexte')}</p>
              <button onClick={() => setFormulaire({ section: 'entree' })} className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors mt-1'>
                <LuPlus size={15} /> {t('fluctuationRh.ajouterLigne')}
              </button>
            </div>
          ) : sectionOuverte ? (
            // ===== Vue détail d'une section — on clique une tuile de la vue
            // d'ensemble pour arriver ici (voir plus bas), jamais l'inverse :
            // rien n'est caché, juste rangé derrière un clic volontaire. =====
            (() => {
              const s = SECTION_PAR_CLE[sectionOuverte];
              const Icone = s.icone;
              return (
                <div className='flex flex-col p-4 gap-4'>
                  <button onClick={() => { setSectionOuverte(null); setRecherche(''); }} className='inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'>
                    <LuArrowLeft size={14} /> {t('fluctuationRh.retourSections')}
                  </button>

                  {/* Onglets de navigation latérale — passer d'une section à
                      l'autre sans revenir à la vue d'ensemble à chaque fois
                      (retour utilisateur). La vue d'ensemble en tuiles reste
                      la porte d'entrée ; ceci n'est qu'un raccourci une fois
                      déjà dans une section. */}
                  <div className='flex gap-1.5 overflow-x-auto pb-1 -mb-1'>
                    {GROUPES_FLUCTUATION.flatMap((groupe) => groupe.sections).map((cle) => {
                      const sOnglet = SECTION_PAR_CLE[cle];
                      const actif = cle === sectionOuverte;
                      const n = compteParSection[cle] || 0;
                      return (
                        <button
                          key={cle}
                          onClick={() => { setSectionOuverte(cle); setRecherche(''); }}
                          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${actif ? 'border-primary bg-primary text-white' : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                        >
                          {t(`fluctuationRh.section_${sOnglet.cle}`)}
                          <span className={`rounded-full px-1.5 text-[10.5px] tabular-nums ${actif ? 'bg-white/20' : 'bg-muted'}`}>{n}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className='flex items-center gap-3'>
                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ICONE_TON[s.ton]}`}>
                      <Icone size={19} />
                    </span>
                    <h3 className='text-xl font-semibold text-foreground'>{t(`fluctuationRh.section_${s.cle}`)}</h3>
                    {!verrouille && (
                      <button onClick={() => setFormulaire({ section: s.cle })} className='ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'>
                        <LuPlus size={15} /> {t('fluctuationRh.ajouter')}
                      </button>
                    )}
                  </div>
                  <div className='relative max-w-sm'>
                    <LuSearch size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
                    <input type='text' value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t('fluctuationRh.rechercher')} className='w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30' />
                  </div>
                  {rendreTableSection(s)}
                </div>
              );
            })()
          ) : (
            // ===== Vue d'ensemble : une tuile par section, façon sélecteur
            // de catégories (retour utilisateur) — regroupées comme avant,
            // chacune avec son icône, son compteur et les salariés concernés
            // ce mois-ci en un coup d'œil. =====
            <div className='p-4 flex flex-col gap-6'>
              {GROUPES_FLUCTUATION.map((groupe) => (
                <div key={groupe.cle}>
                  <p className='text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5'>{t(`fluctuationRh.groupe_${groupe.cle}`)}</p>
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                    {groupe.sections.map((cle, i) => {
                      const s = SECTION_PAR_CLE[cle];
                      const Icone = s.icone;
                      const n = compteParSection[cle] || 0;
                      const salariesSection = salariesParSection[cle] || [];
                      return (
                        <button
                          key={cle}
                          onClick={() => setSectionOuverte(cle)}
                          style={{ animationDelay: `${i * 0.04}s` }}
                          className='animate-tuile-apparait relative text-left border border-primary/25 rounded-xl p-4 bg-card hover:bg-muted/40 hover:border-primary/45 hover:-translate-y-0.5 transition-all'
                        >
                          <span className={`absolute top-3.5 right-3.5 min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold tabular-nums flex items-center justify-center ${n ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{n}</span>
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${ICONE_TON[s.ton]}`}>
                            <Icone size={17} />
                          </span>
                          <h4 className='text-sm font-semibold text-foreground mb-0.5'>{t(`fluctuationRh.section_${cle}`)}</h4>
                          <p className='text-xs text-muted-foreground leading-snug'>{t(`fluctuationRh.description_${cle}`)}</p>
                          {salariesSection.length > 0 && (
                            <div className='flex items-center mt-3'>
                              {salariesSection.slice(0, 3).map((nom, idx) => (
                                <span key={nom} style={{ marginLeft: idx === 0 ? 0 : -6 }} className='w-[22px] h-[22px] rounded-full bg-primary text-white text-[8.5px] font-bold flex items-center justify-center border-2 border-card'>
                                  {getInitials(nom)}
                                </span>
                              ))}
                              {salariesSection.length > 3 && (
                                <span className='text-[10.5px] text-muted-foreground ml-1.5'>+{salariesSection.length - 3}</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Contrôles automatiques / Échéances à venir / Année — 3 icônes
          égales dans une barre collée en bas de page (retour utilisateur,
          croquis à l'appui) au lieu d'une colonne de droite. Un seul
          contenu affiché à la fois, juste au-dessus de la barre. */}
      <div className='sticky bottom-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 mt-2'>
        {panneauOuvert && (
          <div className='mx-4 sm:mx-6 lg:mx-8 mb-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden'>
            {panneauOuvert === 'controles' && (
              <>
                <div className='flex items-center gap-2 px-3.5 py-3 border-b border-border'>
                  <LuAlertTriangle size={15} className={alertes.length ? 'text-amber-600' : 'text-muted-foreground'} />
                  <h3 className='text-sm font-semibold'>{t('fluctuationRh.controlesTitre')}</h3>
                </div>
                {alertes.length === 0 ? (
                  <p className='flex items-center gap-2 px-3.5 py-3 text-sm text-muted-foreground'><LuCheck size={14} className='text-green-600' /> {t('fluctuationRh.controlesOk')}</p>
                ) : (
                  <ul className='max-h-[260px] overflow-y-auto divide-y divide-border'>
                    {alertes.map((a, i) => (
                      <li key={i}>
                        <button onClick={() => allerALigne(a)} className='w-full text-left px-3.5 py-2.5 hover:bg-muted/50 transition-colors'>
                          <span className='block text-xs font-semibold text-foreground'>{t(`fluctuationRh.controle_${a.type}`)}</span>
                          <span className='block text-xs text-muted-foreground truncate'>
                            {a.salarie} · {t(`fluctuationRh.section_${lignes.find((l) => l.id === a.ids[0])?.section}`)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {panneauOuvert === 'echeances' && (
              <>
                <div className='flex items-center gap-2 px-3.5 py-3 border-b border-border'>
                  <LuCalendarClock size={15} className='text-primary' />
                  <h3 className='text-sm font-semibold'>{t('fluctuationRh.echeancesTitre')}</h3>
                </div>
                {echeances.length === 0 ? (
                  <p className='px-3.5 py-3 text-sm text-muted-foreground'>{t('fluctuationRh.echeancesVide')}</p>
                ) : (
                  <ul className='max-h-[260px] overflow-y-auto divide-y divide-border'>
                    {echeances.map((l) => (
                      <li key={l.id} className='px-3.5 py-2'>
                        <span className='flex items-baseline justify-between gap-2'>
                          <span className='text-xs font-semibold text-foreground truncate'>{l.salarie}</span>
                          <span className='text-xs tabular-nums text-muted-foreground shrink-0'>{formatDateCourte(l.date_fin)}</span>
                        </span>
                        <span className='block text-xs text-muted-foreground truncate'>{l.motif || t(`fluctuationRh.section_${l.section}`)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {panneauOuvert === 'annee' && (
              <>
                <div className='flex items-center gap-2 px-3.5 py-3 border-b border-border'>
                  <h3 className='text-sm font-semibold flex-1 min-w-0 truncate'>{t('fluctuationRh.anneeTitre', { annee: anneeAffichee })}</h3>
                  <div className='flex gap-1 shrink-0'>
                    <button onClick={() => setMois(`${anneeAffichee - 1}-${mois.slice(5)}`)} className='flex items-center justify-center w-6 h-6 rounded-md hover:bg-muted' title={String(anneeAffichee - 1)}><LuChevronLeft size={13} /></button>
                    <button onClick={() => setMois(`${anneeAffichee + 1}-${mois.slice(5)}`)} className='flex items-center justify-center w-6 h-6 rounded-md hover:bg-muted' title={String(anneeAffichee + 1)}><LuChevronRight size={13} /></button>
                  </div>
                </div>
                <div className='grid grid-cols-4 sm:grid-cols-6 gap-1.5 p-3'>
                  {Array.from({ length: 12 }, (_, i) => {
                    const cle = `${anneeAffichee}-${String(i + 1).padStart(2, '0')}`;
                    const infos = moisParCle.get(cle);
                    const actif = cle === mois;
                    const court = new Date(anneeAffichee, i, 1).toLocaleDateString(i18n.language, { month: 'short' });
                    return (
                      <button
                        key={cle}
                        onClick={() => setMois(cle)}
                        className={`relative rounded-lg border px-1 py-1.5 text-center transition-colors ${actif ? 'border-primary bg-primary text-white' : 'border-border hover:bg-muted'}`}
                      >
                        <span className='block text-[11px] font-medium capitalize'>{court.replace('.', '')}</span>
                        <span className={`block text-[11px] tabular-nums ${actif ? 'text-white/80' : 'text-muted-foreground'}`}>{infos?.total || '·'}</span>
                        {infos && infos.statut !== 'brouillon' && (
                          <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${infos.statut === 'transmis' ? 'bg-green-500' : 'bg-accent'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className='flex flex-wrap gap-x-3 gap-y-1 px-3.5 pb-3 text-[11px] text-muted-foreground'>
                  <span className='inline-flex items-center gap-1'><span className='w-1.5 h-1.5 rounded-full bg-accent' /> {t('fluctuationRh.statut_valide')}</span>
                  <span className='inline-flex items-center gap-1'><span className='w-1.5 h-1.5 rounded-full bg-green-500' /> {t('fluctuationRh.statut_transmis')}</span>
                </div>
              </>
            )}
          </div>
        )}

        <div className='mx-4 sm:mx-6 lg:mx-8 mb-4 flex rounded-xl border border-border bg-card shadow-lg overflow-hidden'>
          <button onClick={() => togglePanneau('controles')} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 border-r border-border transition-colors ${panneauOuvert === 'controles' ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:bg-muted'}`}>
            <span className='relative'>
              <LuAlertTriangle size={17} />
              {alertes.length > 0 && (
                <span className='absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-amber-500 text-white text-[8.5px] font-bold flex items-center justify-center'>{alertes.length}</span>
              )}
            </span>
            <span className='text-[10px] font-semibold'>{t('fluctuationRh.controlesTitre')}</span>
          </button>
          <button onClick={() => togglePanneau('echeances')} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 border-r border-border transition-colors ${panneauOuvert === 'echeances' ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:bg-muted'}`}>
            <LuCalendarClock size={17} />
            <span className='text-[10px] font-semibold'>{t('fluctuationRh.echeancesTitre')}</span>
          </button>
          <button onClick={() => togglePanneau('annee')} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${panneauOuvert === 'annee' ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:bg-muted'}`}>
            <LuCalendarDays size={17} />
            <span className='text-[10px] font-semibold'>{t('fluctuationRh.anneeTitre', { annee: anneeAffichee })}</span>
          </button>
        </div>
      </div>

      {formulaire && (
        <FluctuationRhForm
          mois={mois}
          sectionInitiale={formulaire.section}
          ligne={formulaire.ligne}
          salaries={salaries}
          onFerme={() => setFormulaire(null)}
          onEnregistre={rafraichir}
        />
      )}

      {ligneASupprimer && (
        <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
          <div className='absolute inset-0 bg-black/50' onClick={() => !actionEnCours && setLigneASupprimer(null)} />
          <div role='dialog' aria-modal='true' className='relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl'>
            <div className='flex items-start gap-3'>
              <span className='flex-shrink-0 w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center'><LuTrash2 size={17} /></span>
              <div className='min-w-0'>
                <h3 className='text-base font-semibold'>{t('fluctuationRh.supprimerTitre')}</h3>
                <p className='text-sm text-muted-foreground mt-1'>
                  {t(`fluctuationRh.section_${ligneASupprimer.section}`)} · <span className='font-medium text-foreground'>{ligneASupprimer.salarie}</span>
                  {ligneASupprimer.motif ? ` · ${ligneASupprimer.motif}` : ''}
                </p>
              </div>
            </div>
            <div className='flex justify-end gap-2 mt-5'>
              <button onClick={() => setLigneASupprimer(null)} disabled={actionEnCours} className='btn btn-sm btn-ghost'>{t('fluctuationRh.annuler')}</button>
              <button onClick={confirmerSuppression} disabled={actionEnCours} className='inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity'>
                <LuTrash2 size={14} /> {t('fluctuationRh.supprimer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FluctuationRh;
