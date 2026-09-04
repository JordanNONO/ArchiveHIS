import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuSearch, LuLoader, LuFileDown, LuFileSpreadsheet, LuArrowUp, LuArrowDown, LuArrowUpDown } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import FiligraneHIS from '../components/FiligraneHIS';
import { getDocument } from '../api/routes/document';
import { correspondARequete } from '../utils/recherche';
import { colonnesPdf, colonnesExcel, exporterCourriersPdf, exporterCourriersExcel } from '../utils/exportCourriers';

// Couleurs propres à cette page (pas d'import depuis Statistiques.jsx : sa
// palette équivalente y est une constante locale non exportée, et contient
// de toute façon une clé "N\C" bugguée — l'échappement '\C' en JS ne produit
// pas un antislash littéral, donc elle ne matche jamais la vraie valeur
// "N/C" renvoyée par le backend).
const ETAT_STYLES = {
  'En attente': 'text-amber-700',
  'Enregistré': 'text-blue-700',
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
    { cle: 'date_envoi', label: t('courriers.colDateEnvoi'), type: 'date' },
    { cle: 'date_reception', label: t('courriers.colDateReception'), type: 'date' },
    { cle: 'nombre_documents', label: t('courriers.colNbDocuments'), type: 'nombre' },
    { cle: 'montant', label: t('courriers.colMontant'), type: 'nombre' },
    { cle: 'etat_courrier', label: t('courriers.colEtat') },
    { cle: 'deadline_courrier', label: t('courriers.colEcheance'), type: 'date' },
    { cle: 'auteur', label: t('courriers.colAuteur') },
  ];
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
  const [courriers, setCourriers] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [sens, setSens] = useState('tous');
  const [etat, setEtat] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState({ cle: 'numero_registre', sens: 'asc' });

  const colonnes = useMemo(() => construireColonnes(t), [t]);

  useEffect(() => {
    getDocument()
      .then((res) => (res.status === 200 ? res.json() : []))
      .then((data) => setCourriers((Array.isArray(data) ? data : []).filter((d) => d.sens_courrier)))
      .catch(() => {})
      .finally(() => setChargement(false));
  }, []);

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
      .filter((c) => !recherche.trim() || correspondARequete(
        [c.objet, c.expediteur_nom, c.destinataire_nom, c.code_reference, c.titre_document, c.auteur],
        recherche
      ));
  }, [courriersNumerotes, sens, etat, recherche]);

  const courriersAffiches = useMemo(() => {
    const colonneTri = colonnes.find((col) => col.cle === tri.cle);
    const copie = [...courriersFiltres];
    copie.sort((a, b) => {
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

  function trierPar(cle) {
    setTri((prev) => prev.cle === cle ? { cle, sens: prev.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: 'asc' });
  }

  function IconeTri({ cle }) {
    if (tri.cle !== cle) return <LuArrowUpDown size={11} className='text-muted-foreground/40' />;
    return tri.sens === 'asc' ? <LuArrowUp size={11} className='text-foreground' /> : <LuArrowDown size={11} className='text-foreground' />;
  }

  function ouvrir(doc) {
    const extension = String(doc.chemin_stockage_serveur).split('.').at(1);
    navigate(`/view/${doc.id}/${extension}`);
  }

  return (
    <div className='flex flex-col flex-grow py-6 gap-4'>
      <FiligraneHIS fixe />
      <Breadcrumbs where={t('sidebar.courriers')} />

      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div>
          <h2 className='text-2xl font-semibold text-foreground'>{t('courriers.registreTitre')}</h2>
          <p className='text-sm text-muted-foreground mt-0.5'>{t('courriers.nResultats', { count: courriersAffiches.length })}</p>
        </div>
        <div className='flex items-center gap-2'>
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
        </div>
      </div>

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
        <select value={sens} onChange={(e) => setSens(e.target.value)} className='select select-bordered select-sm'>
          <option value='tous'>{t('courriers.tousLesSens')}</option>
          <option value='entrant'>{t('courrier.courrierEntrant')}</option>
          <option value='sortant'>{t('courrier.courrierSortant')}</option>
        </select>
        <select value={etat} onChange={(e) => setEtat(e.target.value)} className='select select-bordered select-sm'>
          <option value='tous'>{t('courriers.tousLesEtats')}</option>
          {etatsDisponibles.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
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
                  {colonnes.map((col) => (
                    <th key={col.cle} className='px-3 py-2.5 border border-border sticky top-0 bg-muted/60'>
                      <button onClick={() => trierPar(col.cle)} className='inline-flex items-center gap-1 hover:text-foreground transition-colors'>
                        {col.label} <IconeTri cle={col.cle} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courriersAffiches.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => ouvrir(c)}
                    className='cursor-pointer hover:bg-muted/40 transition-colors odd:bg-background even:bg-muted/10'
                  >
                    <td className='px-3 py-2 border border-border font-mono text-xs text-muted-foreground'>{c.numero_registre}</td>
                    <td className='px-3 py-2 border border-border text-xs font-semibold'>
                      {c.sens_courrier === 'sortant' ? t('courriers.abrevSortant') : t('courriers.abrevEntrant')}
                    </td>
                    <td className='px-3 py-2 border border-border font-mono text-xs text-muted-foreground'>{valeurCellule(c, 'code_reference')}</td>
                    <td className='px-3 py-2 border border-border max-w-xs truncate' title={c.objet}>{valeurCellule(c, 'objet')}</td>
                    <td className='px-3 py-2 border border-border max-w-xs truncate text-muted-foreground' title={c.resume}>{valeurCellule(c, 'resume')}</td>
                    <td className='px-3 py-2 border border-border text-muted-foreground'>{valeurCellule(c, 'type_envoi')}</td>
                    <td className='px-3 py-2 border border-border text-muted-foreground'>{valeurCellule(c, 'numero_recommande')}</td>
                    <td className='px-3 py-2 border border-border max-w-[160px] truncate' title={c.expediteur_nom}>{valeurCellule(c, 'expediteur_nom')}</td>
                    <td className='px-3 py-2 border border-border max-w-[160px] truncate text-muted-foreground' title={c.expediteur_adresse}>{valeurCellule(c, 'expediteur_adresse')}</td>
                    <td className='px-3 py-2 border border-border max-w-[160px] truncate' title={c.destinataire_nom}>{valeurCellule(c, 'destinataire_nom')}</td>
                    <td className='px-3 py-2 border border-border max-w-[160px] truncate text-muted-foreground' title={c.destinataire_adresse}>{valeurCellule(c, 'destinataire_adresse')}</td>
                    <td className='px-3 py-2 border border-border text-muted-foreground tabular-nums'>{valeurCellule(c, 'date_envoi')}</td>
                    <td className='px-3 py-2 border border-border text-muted-foreground tabular-nums'>{valeurCellule(c, 'date_reception')}</td>
                    <td className='px-3 py-2 border border-border tabular-nums text-center'>{valeurCellule(c, 'nombre_documents')}</td>
                    <td className='px-3 py-2 border border-border tabular-nums'>{valeurCellule(c, 'montant')}</td>
                    <td className={`px-3 py-2 border border-border font-medium ${ETAT_STYLES[c.etat_courrier] || 'text-muted-foreground'}`}>
                      {c.etat_courrier || '—'}
                    </td>
                    <td className='px-3 py-2 border border-border text-muted-foreground tabular-nums'>{valeurCellule(c, 'deadline_courrier')}</td>
                    <td className='px-3 py-2 border border-border text-muted-foreground'>{valeurCellule(c, 'auteur')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Courriers;
