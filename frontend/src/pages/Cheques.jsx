import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuSearch, LuLoader, LuFileDown, LuFileSpreadsheet, LuArrowUp, LuArrowDown, LuArrowUpDown, LuLandmark, LuCheck, LuX, LuPencil, LuTrash2, LuInfo, LuChevronRight, LuChevronDown } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import FiligraneHIS from '../components/FiligraneHIS';
import ChequeForm from '../components/ChequeForm';
import { getCheques, marquerChequeTraite, deleteCheque } from '../api/routes/cheque';
import { getDisplayName } from '../utils/common';
import { correspondARequete } from '../utils/recherche';
import { colonnesPdf, colonnesExcel, exporterChequesPdf, exporterChequesExcel } from '../utils/exportCheques';
import { useConfirm } from '../contexts/ConfirmDialogContext';
import FiltrePeriode from '../components/FiltrePeriode';
import { PERIODE_VIDE, dateDansPeriode } from '../utils/periodes';

function construireColonnes(t) {
  return [
    { cle: 'numero_registre', label: t('cheques.colNumero') },
    { cle: 'date_emission', label: t('cheques.colDateEmission'), type: 'date' },
    { cle: 'date_depot', label: t('cheques.colDateDepot'), type: 'date' },
    { cle: 'numero_bordereau_remise', label: t('cheques.colBordereau') },
    { cle: 'banque_depot', label: t('cheques.colBanqueDepot') },
    { cle: 'numero_cheque', label: t('cheques.colNumeroCheque') },
    { cle: 'banque_emettrice', label: t('cheques.colBanqueEmettrice') },
    { cle: 'nom_emetteur', label: t('cheques.colEmetteur') },
    { cle: 'nom_beneficiaire', label: t('cheques.colBeneficiaire') },
    { cle: 'montant', label: t('cheques.colMontant') },
    { cle: 'facture_reglee', label: t('cheques.colFactureReglee') },
    { cle: 'agent', label: t('cheques.colAgent') },
    { cle: 'traite', label: t('cheques.colTraite') },
  ];
}

function formatMontant(v) {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function valeurCellule(c, cle) {
  if (['montant', 'traite', 'numero_registre', 'agent'].includes(cle)) return null; // rendu à part
  const v = c[cle];
  if (v === null || v === undefined || v === '') return '—';
  if (cle === 'date_emission' || cle === 'date_depot') return new Date(v).toLocaleDateString('fr-FR');
  return v;
}

/**
 * Registre des chèques reçus — même charpente que AppelsTelephoniques.jsx
 * (quadrillage complet, tri par colonne, export PDF/Excel, formulaire de
 * saisie qui reste ouvert pour enchaîner). Remplace le tableur "État des
 * chèques" (Excel, un onglet par mois) utilisé jusqu'ici.
 */
function Cheques() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cheques, setCheques] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [formOuvert, setFormOuvert] = useState(false);
  const [chequeEnEdition, setChequeEnEdition] = useState(null);
  const [chequeATraiter, setChequeATraiter] = useState(null);
  const [noteTraitement, setNoteTraitement] = useState('');
  const [traitementEnCours, setTraitementEnCours] = useState(false);
  const [traiteFiltre, setTraiteFiltre] = useState('tous');
  const [periode, setPeriode] = useState(PERIODE_VIDE);
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState({ cle: 'numero_registre', sens: 'desc' });
  const [groupesOuverts, setGroupesOuverts] = useState(() => new Set());
  const formRef = useRef(null);

  function toggleGroupe(cle) {
    setGroupesOuverts((prec) => {
      const suivant = new Set(prec);
      if (suivant.has(cle)) suivant.delete(cle); else suivant.add(cle);
      return suivant;
    });
  }

  const colonnes = useMemo(() => construireColonnes(t), [t]);

  function fetchCheques() {
    return getCheques()
      .then((res) => (res.status === 200 ? res.json() : []))
      .then((data) => setCheques(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setChargement(false));
  }

  useEffect(() => { fetchCheques(); }, []);

  const chequesNumerotes = useMemo(
    () => cheques.map((c) => ({ ...c, numero_registre: String(c.id).padStart(4, '0'), agent: getDisplayName({ personnel: c.utilisateur?.personnels?.[0] }) || c.utilisateur?.nom || '' })),
    [cheques]
  );

  const chequesFiltres = useMemo(() => {
    return chequesNumerotes
      .filter((c) => traiteFiltre === 'tous' || (traiteFiltre === 'traite' ? c.traite_le : !c.traite_le))
      .filter((c) => dateDansPeriode(c.date_emission, periode))
      .filter((c) => !recherche.trim() || correspondARequete(
        [
          c.numero_bordereau_remise,
          c.banque_depot,
          c.numero_cheque,
          c.banque_emettrice,
          c.nom_emetteur,
          c.nom_beneficiaire,
          c.facture_reglee,
        ],
        recherche
      ));
  }, [chequesNumerotes, traiteFiltre, periode, recherche]);

  const chequesAffiches = useMemo(() => {
    const copie = [...chequesFiltres];
    copie.sort((a, b) => {
      let va = a[tri.cle];
      let vb = b[tri.cle];
      if (tri.cle === 'date_emission' || tri.cle === 'date_depot') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else if (tri.cle === 'montant') {
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
  }, [chequesFiltres, tri]);

  // Un même bordereau + banque de dépôt regroupe plusieurs chèques déposés
  // ensemble (voir ChequeForm.jsx, jusqu'à 5 par lot) — au lieu de lister
  // séparément chaque chèque du lot, on affiche une seule ligne récapitulative
  // qui se déplie au clic. Un bordereau qui n'a (encore) qu'un seul chèque
  // reste affiché normalement, sans repli inutile. Les groupes gardent la
  // position de leur premier chèque rencontré, pour rester cohérents avec
  // n'importe quelle colonne de tri choisie.
  const lignesTableau = useMemo(() => {
    const groupes = new Map();
    for (const c of chequesAffiches) {
      if (!c.numero_bordereau_remise || !c.banque_depot) continue;
      const cle = `${c.numero_bordereau_remise}__${c.banque_depot}`;
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(c);
    }
    const clesGroupees = new Set([...groupes.entries()].filter(([, arr]) => arr.length >= 2).map(([cle]) => cle));

    const lignes = [];
    const clesDejaEmises = new Set();
    for (const c of chequesAffiches) {
      const cle = c.numero_bordereau_remise && c.banque_depot ? `${c.numero_bordereau_remise}__${c.banque_depot}` : null;
      if (cle && clesGroupees.has(cle)) {
        if (clesDejaEmises.has(cle)) continue;
        clesDejaEmises.add(cle);
        lignes.push({ type: 'groupe', cle, cheques: groupes.get(cle) });
      } else {
        lignes.push({ type: 'seul', cheque: c });
      }
    }
    return lignes;
  }, [chequesAffiches]);

  function trierPar(cle) {
    setTri((prev) => prev.cle === cle ? { cle, sens: prev.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: 'asc' });
  }

  function IconeTri({ cle }) {
    if (tri.cle !== cle) return <LuArrowUpDown size={11} className='text-muted-foreground/40' />;
    return tri.sens === 'asc' ? <LuArrowUp size={11} className='text-foreground' /> : <LuArrowDown size={11} className='text-foreground' />;
  }

  /** Ligne d'un chèque individuel — `imbriquee` (chèque déplié sous une ligne de lot) ajoute juste un léger décalage/teinte pour signaler l'appartenance au groupe. */
  function LigneCheque({ c, imbriquee }) {
    return (
      <tr className={imbriquee ? 'bg-primary/[0.03]' : 'odd:bg-background even:bg-muted/10'}>
        <td className={`px-3 py-2 border border-border font-mono text-xs text-muted-foreground ${imbriquee ? 'pl-6' : ''}`}>{c.numero_registre}</td>
        <td className='px-3 py-2 border border-border text-muted-foreground tabular-nums'>{valeurCellule(c, 'date_emission')}</td>
        <td className='px-3 py-2 border border-border text-muted-foreground tabular-nums'>{valeurCellule(c, 'date_depot')}</td>
        <td className='px-3 py-2 border border-border text-muted-foreground'>{valeurCellule(c, 'numero_bordereau_remise')}</td>
        <td className='px-3 py-2 border border-border max-w-[140px] truncate text-muted-foreground' title={c.banque_depot}>{valeurCellule(c, 'banque_depot')}</td>
        <td className='px-3 py-2 border border-border font-medium'>{valeurCellule(c, 'numero_cheque')}</td>
        <td className='px-3 py-2 border border-border max-w-[140px] truncate text-muted-foreground' title={c.banque_emettrice}>{valeurCellule(c, 'banque_emettrice')}</td>
        <td className='px-3 py-2 border border-border max-w-[160px] truncate font-medium' title={c.nom_emetteur}>{valeurCellule(c, 'nom_emetteur')}</td>
        <td className='px-3 py-2 border border-border max-w-[160px] truncate text-muted-foreground' title={c.nom_beneficiaire}>{valeurCellule(c, 'nom_beneficiaire')}</td>
        <td className='px-3 py-2 border border-border font-medium tabular-nums'>{formatMontant(c.montant)}</td>
        <td className='px-3 py-2 border border-border max-w-[160px] truncate text-muted-foreground' title={c.facture_reglee}>{valeurCellule(c, 'facture_reglee')}</td>
        <td className='px-3 py-2 border border-border text-muted-foreground'>{c.agent || '—'}</td>
        <td className='px-3 py-2 border border-border'>
          {c.traite_le ? (
            <span className='inline-flex items-center gap-1 text-green-700 text-xs font-medium'>
              <LuCheck size={13} /> {t('cheques.traite')}
              {c.note_traitement && <LuInfo size={12} className='text-green-700/70' title={c.note_traitement} />}
            </span>
          ) : (
            <button
              onClick={(e) => ouvrirMarquerTraite(c, e)}
              className='inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors'
            >
              <LuX size={13} /> {t('cheques.marquerTraite')}
            </button>
          )}
        </td>
        <td className='px-3 py-2 border border-border'>
          <div className='flex items-center gap-1'>
            <button
              onClick={() => ouvrirModification(c)}
              title={t('cheques.modifier')}
              className='flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
            >
              <LuPencil size={13} />
            </button>
            <button
              onClick={(e) => supprimerCheque(c, e)}
              title={t('cheques.supprimer')}
              className='flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors'
            >
              <LuTrash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  /** Ligne récapitulative d'un lot de chèques (même bordereau + banque de dépôt) — se déplie au clic pour révéler chaque LigneCheque du lot. */
  function LigneGroupeBordereau({ groupe }) {
    const { cle, cheques: chequesDuLot } = groupe;
    const ouvert = groupesOuverts.has(cle);
    const total = chequesDuLot.reduce((s, c) => s + (Number(c.montant) || 0), 0);
    const traites = chequesDuLot.filter((c) => c.traite_le).length;
    const premier = chequesDuLot[0];
    // Aperçu au survol (title natif) : la liste des chèques du lot, pour un
    // coup d'œil rapide sans avoir à déplier la ligne.
    const apercuSurvol = chequesDuLot
      .map((c) => `${c.numero_cheque} — ${c.nom_emetteur} — ${formatMontant(c.montant)}`)
      .join('\n');

    return (
      <tr onClick={() => toggleGroupe(cle)} title={apercuSurvol} className='bg-muted/40 hover:bg-muted/60 cursor-pointer font-medium transition-colors'>
        <td className='px-3 py-2 border border-border text-muted-foreground'>
          {ouvert ? <LuChevronDown size={14} /> : <LuChevronRight size={14} />}
        </td>
        <td className='px-3 py-2 border border-border text-muted-foreground'>—</td>
        <td className='px-3 py-2 border border-border text-muted-foreground tabular-nums'>{valeurCellule(premier, 'date_depot')}</td>
        <td className='px-3 py-2 border border-border'>{premier.numero_bordereau_remise}</td>
        <td className='px-3 py-2 border border-border max-w-[140px] truncate' title={premier.banque_depot}>{premier.banque_depot}</td>
        <td className='px-3 py-2 border border-border'>{t('cheques.chequesDuLot', { count: chequesDuLot.length })}</td>
        <td className='px-3 py-2 border border-border text-muted-foreground'>—</td>
        <td className='px-3 py-2 border border-border text-muted-foreground'>—</td>
        <td className='px-3 py-2 border border-border text-muted-foreground'>—</td>
        <td className='px-3 py-2 border border-border tabular-nums'>{formatMontant(total)}</td>
        <td className='px-3 py-2 border border-border text-muted-foreground'>—</td>
        <td className='px-3 py-2 border border-border text-muted-foreground'>—</td>
        <td className='px-3 py-2 border border-border'>
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${traites === chequesDuLot.length ? 'text-green-700' : 'text-muted-foreground'}`}>
            {traites === chequesDuLot.length && <LuCheck size={13} />}
            {t('cheques.traitesSurTotal', { traites, total: chequesDuLot.length })}
          </span>
        </td>
        <td className='px-3 py-2 border border-border'></td>
      </tr>
    );
  }

  function ouvrirMarquerTraite(c, e) {
    e.stopPropagation();
    setNoteTraitement('');
    setChequeATraiter(c);
  }

  async function confirmerTraitement() {
    if (!chequeATraiter) return;
    setTraitementEnCours(true);
    const res = await marquerChequeTraite(chequeATraiter.id, noteTraitement.trim()).catch(() => null);
    setTraitementEnCours(false);
    if (res?.status === 200) {
      toast.success(t('cheques.chequeMarqueTraite'));
      setChequeATraiter(null);
      fetchCheques();
    } else {
      toast.error(t('commun.erreurGenerique'));
    }
  }

  async function supprimerCheque(c, e) {
    e.stopPropagation();
    if (!await confirm({ message: t('cheques.confirmerSuppression'), danger: true })) return;
    const res = await deleteCheque(c.id).catch(() => null);
    if (res?.status === 200) {
      toast.success(t('cheques.chequeSupprime'));
      fetchCheques();
    } else {
      toast.error(t('commun.erreurGenerique'));
    }
  }

  function ouvrirNouveauCheque() {
    setChequeEnEdition(null);
    setFormOuvert((v) => !v);
  }

  function ouvrirModification(c) {
    setFormOuvert(false);
    setChequeEnEdition(c);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  useEffect(() => {
    const chequeIdCible = searchParams.get('cheque');
    if (!chequeIdCible || cheques.length === 0) return;
    const cible = cheques.find((c) => String(c.id) === chequeIdCible);
    if (cible) ouvrirModification(cible);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheques]);

  function chequeModifie() {
    setChequeEnEdition(null);
    fetchCheques();
  }

  const totalMontant = useMemo(() => chequesAffiches.reduce((somme, c) => somme + (Number(c.montant) || 0), 0), [chequesAffiches]);

  return (
    <div className='flex flex-col flex-grow py-6 gap-4'>
      <FiligraneHIS fixe opacite={0.12} />
      <Breadcrumbs where={t('sidebar.cheques')} />

      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div>
          <h2 className='text-2xl font-semibold text-foreground'>{t('cheques.registreTitre')}</h2>
          <p className='text-sm text-muted-foreground mt-0.5'>
            {t('cheques.nResultats', { count: chequesAffiches.length })} — {t('cheques.totalMontant', { montant: formatMontant(totalMontant) })}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={ouvrirNouveauCheque}
            className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors'
          >
            <LuLandmark size={15} /> {formOuvert ? t('cheques.fermerFormulaire') : t('cheques.nouveauCheque')}
          </button>
          <button
            onClick={() => exporterChequesExcel(chequesAffiches, colonnesExcel(t))}
            disabled={chequesAffiches.length === 0}
            className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <LuFileSpreadsheet size={15} /> {t('cheques.exporterExcel')}
          </button>
          <button
            onClick={() => exporterChequesPdf(chequesAffiches, colonnesPdf(t), t('cheques.registreTitre'))}
            disabled={chequesAffiches.length === 0}
            className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <LuFileDown size={15} /> {t('cheques.exporterPdf')}
          </button>
        </div>
      </div>

      {formOuvert && (
        <ChequeForm
          onEnregistre={fetchCheques}
          historiqueCheques={cheques}
          onModifierChequeDuLot={ouvrirModification}
          onSupprimerChequeDuLot={supprimerCheque}
        />
      )}
      {chequeEnEdition && (
        <div ref={formRef}>
          <ChequeForm
            chequeAModifier={chequeEnEdition}
            historiqueCheques={cheques}
            onModifie={chequeModifie}
            onAnnulerModification={() => setChequeEnEdition(null)}
          />
        </div>
      )}

      <div className='flex items-center gap-2.5 flex-wrap rounded-lg border border-border bg-card px-3.5 py-2.5'>
        <div className='relative flex-grow min-w-[200px] max-w-sm'>
          <LuSearch size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
          <input
            type='text'
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('cheques.rechercher')}
            className='w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
          />
        </div>
        <select value={traiteFiltre} onChange={(e) => setTraiteFiltre(e.target.value)} className='select select-bordered select-sm'>
          <option value='tous'>{t('cheques.tousLesEtats')}</option>
          <option value='a_traiter'>{t('cheques.aTraiter')}</option>
          <option value='traite'>{t('cheques.traite')}</option>
        </select>
        <FiltrePeriode valeur={periode} onChange={setPeriode} />
      </div>

      <div className='rounded-lg border border-border bg-card overflow-hidden'>
        {chargement ? (
          <div className='flex items-center justify-center py-16'>
            <LuLoader className='animate-spin text-muted-foreground' size={22} />
          </div>
        ) : chequesAffiches.length === 0 ? (
          <p className='text-sm text-muted-foreground text-center py-16'>{t('cheques.aucunCheque')}</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm whitespace-nowrap border-collapse'>
              <thead>
                <tr className='bg-muted/60 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                  {colonnes.map((col) => (
                    <th key={col.cle} className='px-3 py-2.5 border border-border sticky top-0 bg-muted/60'>
                      <button onClick={() => trierPar(col.cle)} className='inline-flex items-center gap-1 hover:text-foreground transition-colors'>
                        {col.label} <IconeTri cle={col.cle} />
                      </button>
                    </th>
                  ))}
                  <th className='px-3 py-2.5 border border-border sticky top-0 bg-muted/60'></th>
                </tr>
              </thead>
              <tbody>
                {lignesTableau.map((ligne) => ligne.type === 'seul' ? (
                  <LigneCheque key={ligne.cheque.id} c={ligne.cheque} />
                ) : (
                  <React.Fragment key={ligne.cle}>
                    <LigneGroupeBordereau groupe={ligne} />
                    {groupesOuverts.has(ligne.cle) && ligne.cheques.map((c) => (
                      <LigneCheque key={c.id} c={c} imbriquee />
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {chequeATraiter && (
        <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
          <div className='absolute inset-0 bg-black/50' onClick={() => setChequeATraiter(null)} />
          <div className='relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl flex flex-col gap-3'>
            <div>
              <h3 className='text-base font-semibold text-foreground'>{t('cheques.traiterTitre')}</h3>
              <p className='text-sm text-muted-foreground mt-1'>{t('cheques.traiterDescription', { numero: chequeATraiter.numero_cheque })}</p>
            </div>
            <textarea
              value={noteTraitement}
              onChange={(e) => setNoteTraitement(e.target.value)}
              placeholder={t('cheques.traiterNotePlaceholder')}
              rows={3}
              autoFocus
              className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none'
            />
            <div className='flex justify-end gap-2 mt-1'>
              <button onClick={() => setChequeATraiter(null)} className='btn btn-sm btn-ghost'>
                {t('cheques.annuler')}
              </button>
              <button
                onClick={confirmerTraitement}
                disabled={traitementEnCours}
                className='btn btn-sm bg-primary text-white border-0 hover:opacity-90 disabled:opacity-60'
              >
                {traitementEnCours ? t('chequeForm.enregistrementEnCours') : t('cheques.marquerTraite')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cheques;
