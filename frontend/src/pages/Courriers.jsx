import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuMail, LuSearch, LuLoader } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import { getDocument } from '../api/routes/document';
import { correspondARequete } from '../utils/recherche';

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

/**
 * Vue tableau dédiée aux courriers (entrants + sortants) — toutes les infos
 * de chaque courrier enregistré dans l'appli en un coup d'œil, comme
 * l'ancien suivi sur Google Sheets qu'elle remplace, plutôt que d'avoir à
 * ouvrir chaque dossier "Courriers entrants/sortants" un par un.
 */
function Courriers() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [courriers, setCourriers] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [sens, setSens] = useState('tous');
  const [etat, setEtat] = useState('tous');
  const [recherche, setRecherche] = useState('');

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

  const courriersAffiches = useMemo(() => {
    return courriers
      .filter((c) => sens === 'tous' || c.sens_courrier === sens)
      .filter((c) => etat === 'tous' || c.etat_courrier === etat)
      .filter((c) => !recherche.trim() || correspondARequete(
        [c.objet, c.expediteur_nom, c.destinataire_nom, c.code_reference, c.titre_document],
        recherche
      ))
      .sort((a, b) => new Date(b.date_envoi || b.date_reception || b.created_at) - new Date(a.date_envoi || a.date_reception || a.created_at));
  }, [courriers, sens, etat, recherche]);

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
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-border text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                  <th className='px-4 py-3'>{t('courriers.colSens')}</th>
                  <th className='px-4 py-3'>{t('courriers.colDate')}</th>
                  <th className='px-4 py-3'>{t('courriers.colObjet')}</th>
                  <th className='px-4 py-3'>{t('courriers.colCorrespondant')}</th>
                  <th className='px-4 py-3'>{t('courriers.colMontant')}</th>
                  <th className='px-4 py-3'>{t('courriers.colEtat')}</th>
                  <th className='px-4 py-3'>{t('courriers.colAuteur')}</th>
                </tr>
              </thead>
              <tbody>
                {courriersAffiches.map((c) => {
                  const date = c.sens_courrier === 'sortant' ? c.date_envoi : c.date_reception;
                  const correspondant = c.sens_courrier === 'sortant' ? c.destinataire_nom : c.expediteur_nom;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => ouvrir(c)}
                      className='border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors'
                    >
                      <td className='px-4 py-2.5'>
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${c.sens_courrier === 'sortant' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                          {c.sens_courrier === 'sortant' ? t('courrier.courrierSortant') : t('courrier.courrierEntrant')}
                        </span>
                      </td>
                      <td className='px-4 py-2.5 text-muted-foreground tabular-nums'>
                        {date ? new Date(date).toLocaleDateString(i18n.language) : '—'}
                      </td>
                      <td className='px-4 py-2.5 max-w-xs truncate' title={c.objet}>{c.objet || c.titre_document}</td>
                      <td className='px-4 py-2.5 text-muted-foreground max-w-[180px] truncate' title={correspondant}>{correspondant || '—'}</td>
                      <td className='px-4 py-2.5 tabular-nums'>{c.montant ? `${Number(c.montant).toLocaleString(i18n.language)} €` : '—'}</td>
                      <td className='px-4 py-2.5'>
                        {c.etat_courrier ? (
                          <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${ETAT_STYLES[c.etat_courrier] || 'bg-muted text-muted-foreground'}`}>
                            {c.etat_courrier}
                          </span>
                        ) : '—'}
                      </td>
                      <td className='px-4 py-2.5 text-muted-foreground'>{c.auteur || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Courriers;
