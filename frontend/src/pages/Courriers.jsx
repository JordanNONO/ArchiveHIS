import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuMail, LuSearch, LuLoader, LuFileDown, LuFileSpreadsheet, LuArrowUp, LuArrowDown, LuArrowUpDown, LuSend, LuInbox, LuWallet } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import { getDocument } from '../api/routes/document';
import { correspondARequete } from '../utils/recherche';
import { colonnesPdf, colonnesExcel, exporterCourriersPdf, exporterCourriersExcel } from '../utils/exportCourriers';

// Couleurs propres à cette page (pas d'import depuis Statistiques.jsx : sa
// palette équivalente y est une constante locale non exportée, et contient
// de toute façon une clé "N\C" bugguée — l'échappement '\C' en JS ne produit
// pas un antislash littéral, donc elle ne matche jamais la vraie valeur
// "N/C" renvoyée par le backend).
const ETAT_STYLES = {
  'En attente': 'bg-amber-500/10 text-amber-600',
  'Enregistré': 'bg-blue-500/10 text-blue-600',
  'Déposé': 'bg-purple-500/10 text-purple-600',
  'Payé': 'bg-green-600/10 text-green-700',
  'Prélèvement': 'bg-yellow-500/10 text-yellow-700',
  'Traité': 'bg-slate-500/10 text-slate-600',
  'N/C': 'bg-muted text-muted-foreground',
};

// Colonnes du tableau à l'écran — toutes les infos propres au courrier
// (voir la migration add_courrier_fields_to_document_archives_table), avec
// un accesseur dédié pour le tri (types différents : texte, date, nombre).
function construireColonnes(t) {
  return [
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
  if (cle === 'sens_courrier') return null; // rendu à part (badge)
  if (cle === 'etat_courrier') return null; // rendu à part (badge)
  const v = c[cle];
  if (v === null || v === undefined || v === '') return '—';
  if (cle === 'date_envoi' || cle === 'date_reception' || cle === 'deadline_courrier') {
    return new Date(v).toLocaleDateString('fr-FR');
  }
  if (cle === 'montant') return `${Number(v).toLocaleString('fr-FR')} €`;
  return v;
}

/**
 * Vue tableau dédiée aux courriers (entrants + sortants) — toutes les infos
 * de chaque courrier enregistré dans l'appli en un coup d'œil, avec tri par
 * colonne, statistiques rapides, et export PDF/Excel, comme l'ancien suivi
 * sur Google Sheets qu'elle remplace.
 */
function Courriers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [courriers, setCourriers] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [sens, setSens] = useState('tous');
  const [etat, setEtat] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState({ cle: 'date_envoi', sens: 'desc' });

  const colonnes = useMemo(() => construireColonnes(t), [t]);

  useEffect(() => {
    getDocument()
      .then((res) => (res.status === 200 ? res.json() : []))
      .then((data) => setCourriers((Array.isArray(data) ? data : []).filter((d) => d.sens_courrier)))
      .catch(() => {})
      .finally(() => setChargement(false));
  }, []);

  const etatsDisponibles = useMemo(
    () => [...new Set(courriers.map((c) => c.etat_courrier).filter(Boolean))],
    [courriers]
  );

  const courriersFiltres = useMemo(() => {
    return courriers
      .filter((c) => sens === 'tous' || c.sens_courrier === sens)
      .filter((c) => etat === 'tous' || c.etat_courrier === etat)
      .filter((c) => !recherche.trim() || correspondARequete(
        [c.objet, c.expediteur_nom, c.destinataire_nom, c.code_reference, c.titre_document, c.auteur],
        recherche
      ));
  }, [courriers, sens, etat, recherche]);

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

  const stats = useMemo(() => {
    const entrants = courriersFiltres.filter((c) => c.sens_courrier === 'entrant').length;
    const sortants = courriersFiltres.filter((c) => c.sens_courrier === 'sortant').length;
    const montantTotal = courriersFiltres.reduce((somme, c) => somme + (Number(c.montant) || 0), 0);
    return { entrants, sortants, montantTotal };
  }, [courriersFiltres]);

  function trierPar(cle) {
    setTri((prev) => prev.cle === cle ? { cle, sens: prev.sens === 'asc' ? 'desc' : 'asc' } : { cle, sens: 'asc' });
  }

  function IconeTri({ cle }) {
    if (tri.cle !== cle) return <LuArrowUpDown size={12} className='text-muted-foreground/40' />;
    return tri.sens === 'asc' ? <LuArrowUp size={12} className='text-primary' /> : <LuArrowDown size={12} className='text-primary' />;
  }

  function ouvrir(doc) {
    const extension = String(doc.chemin_stockage_serveur).split('.').at(1);
    navigate(`/view/${doc.id}/${extension}`);
  }

  return (
    <div className='flex flex-col flex-grow py-6 gap-4'>
      <Breadcrumbs where={t('sidebar.courriers')} />

      <div className='flex items-center justify-between flex-wrap gap-3'>
        <h2 className='text-2xl font-semibold text-foreground flex items-center gap-2'>
          <LuMail size={22} className='text-primary' />
          {t('sidebar.courriers')}
        </h2>
        <div className='flex items-center gap-2'>
          <button
            onClick={() => exporterCourriersExcel(courriersAffiches, colonnesExcel(t))}
            disabled={courriersAffiches.length === 0}
            className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <LuFileSpreadsheet size={15} /> {t('courriers.exporterExcel')}
          </button>
          <button
            onClick={() => exporterCourriersPdf(courriersAffiches, colonnesPdf(t), t('sidebar.courriers'))}
            disabled={courriersAffiches.length === 0}
            className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <LuFileDown size={15} /> {t('courriers.exporterPdf')}
          </button>
        </div>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
        <div className='flex items-center gap-3 rounded-2xl border border-border bg-card p-4'>
          <div className='flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0'><LuInbox size={18} /></div>
          <div><p className='text-lg font-semibold text-foreground leading-none'>{stats.entrants}</p><p className='text-xs text-muted-foreground mt-0.5'>{t('courrier.courrierEntrant')}</p></div>
        </div>
        <div className='flex items-center gap-3 rounded-2xl border border-border bg-card p-4'>
          <div className='flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary shrink-0'><LuSend size={18} /></div>
          <div><p className='text-lg font-semibold text-foreground leading-none'>{stats.sortants}</p><p className='text-xs text-muted-foreground mt-0.5'>{t('courrier.courrierSortant')}</p></div>
        </div>
        <div className='flex items-center gap-3 rounded-2xl border border-border bg-card p-4'>
          <div className='flex items-center justify-center w-10 h-10 rounded-xl bg-green-600/10 text-green-700 shrink-0'><LuWallet size={18} /></div>
          <div><p className='text-lg font-semibold text-foreground leading-none tabular-nums'>{stats.montantTotal.toLocaleString('fr-FR')} €</p><p className='text-xs text-muted-foreground mt-0.5'>{t('courriers.montantTotal')}</p></div>
        </div>
      </div>

      <div className='flex items-center gap-2.5 flex-wrap rounded-2xl border border-border bg-card px-3.5 py-2.5'>
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
        <span className='text-xs text-muted-foreground ml-auto'>
          {t('courriers.nResultats', { count: courriersAffiches.length })}
        </span>
      </div>

      <div className='rounded-2xl border border-border bg-card overflow-hidden'>
        {chargement ? (
          <div className='flex items-center justify-center py-16'>
            <LuLoader className='animate-spin text-muted-foreground' size={22} />
          </div>
        ) : courriersAffiches.length === 0 ? (
          <p className='text-sm text-muted-foreground text-center py-16'>{t('courriers.aucunCourrier')}</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm whitespace-nowrap'>
              <thead>
                <tr className='border-b border-border text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                  {colonnes.map((col) => (
                    <th key={col.cle} className='px-4 py-3 sticky top-0 bg-card'>
                      <button onClick={() => trierPar(col.cle)} className='inline-flex items-center gap-1 hover:text-foreground transition-colors'>
                        {col.label} <IconeTri cle={col.cle} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courriersAffiches.map((c, index) => (
                  <tr
                    key={c.id}
                    onClick={() => ouvrir(c)}
                    className={`border-b border-border last:border-0 cursor-pointer hover:bg-muted/60 transition-colors ${index % 2 === 1 ? 'bg-muted/20' : ''}`}
                  >
                    <td className='px-4 py-2.5'>
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${c.sens_courrier === 'sortant' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                        {c.sens_courrier === 'sortant' ? t('courrier.courrierSortant') : t('courrier.courrierEntrant')}
                      </span>
                    </td>
                    <td className='px-4 py-2.5 font-mono text-xs text-muted-foreground'>{valeurCellule(c, 'code_reference')}</td>
                    <td className='px-4 py-2.5 max-w-xs truncate' title={c.objet}>{valeurCellule(c, 'objet')}</td>
                    <td className='px-4 py-2.5 max-w-xs truncate text-muted-foreground' title={c.resume}>{valeurCellule(c, 'resume')}</td>
                    <td className='px-4 py-2.5 text-muted-foreground'>{valeurCellule(c, 'type_envoi')}</td>
                    <td className='px-4 py-2.5 text-muted-foreground'>{valeurCellule(c, 'numero_recommande')}</td>
                    <td className='px-4 py-2.5 max-w-[160px] truncate' title={c.expediteur_nom}>{valeurCellule(c, 'expediteur_nom')}</td>
                    <td className='px-4 py-2.5 max-w-[160px] truncate text-muted-foreground' title={c.expediteur_adresse}>{valeurCellule(c, 'expediteur_adresse')}</td>
                    <td className='px-4 py-2.5 max-w-[160px] truncate' title={c.destinataire_nom}>{valeurCellule(c, 'destinataire_nom')}</td>
                    <td className='px-4 py-2.5 max-w-[160px] truncate text-muted-foreground' title={c.destinataire_adresse}>{valeurCellule(c, 'destinataire_adresse')}</td>
                    <td className='px-4 py-2.5 text-muted-foreground tabular-nums'>{valeurCellule(c, 'date_envoi')}</td>
                    <td className='px-4 py-2.5 text-muted-foreground tabular-nums'>{valeurCellule(c, 'date_reception')}</td>
                    <td className='px-4 py-2.5 tabular-nums text-center'>{valeurCellule(c, 'nombre_documents')}</td>
                    <td className='px-4 py-2.5 tabular-nums'>{valeurCellule(c, 'montant')}</td>
                    <td className='px-4 py-2.5'>
                      {c.etat_courrier ? (
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${ETAT_STYLES[c.etat_courrier] || 'bg-muted text-muted-foreground'}`}>
                          {c.etat_courrier}
                        </span>
                      ) : '—'}
                    </td>
                    <td className='px-4 py-2.5 text-muted-foreground tabular-nums'>{valeurCellule(c, 'deadline_courrier')}</td>
                    <td className='px-4 py-2.5 text-muted-foreground'>{valeurCellule(c, 'auteur')}</td>
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
