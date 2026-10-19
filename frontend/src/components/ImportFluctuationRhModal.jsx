import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuX, LuLoader, LuFileSpreadsheet, LuUpload, LuAlertTriangle, LuLock } from 'react-icons/lu';
import { lireClasseurFluctuation } from '../utils/importFluctuationRh';
import { importerFluctuationsRh } from '../api/routes/fluctuationRh';
import { libelleMois } from '../constants/fluctuationRh';

/**
 * Import du classeur Google Sheets "FLUCTUATION" (Fichier > Télécharger >
 * Microsoft Excel .xlsx). Chaque onglet = un mois ; aperçu de ce qui sera
 * importé avant d'écrire quoi que ce soit (voir utils/importFluctuationRh.js).
 *
 * moisExistants : [{ mois: "AAAA-MM-01", statut, total }] — pour prévenir
 * qu'un mois a déjà des lignes (remplacées si la case est cochée) ou qu'il
 * est validé (jamais touché par l'import).
 */
function ImportFluctuationRhModal({ moisExistants, onFerme, onImporte }) {
  const { t, i18n } = useTranslation();
  const [lecture, setLecture] = useState(false);
  const [onglets, setOnglets] = useState(null);
  const [nomFichier, setNomFichier] = useState('');
  const [remplacer, setRemplacer] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  const existants = useMemo(() => new Map(moisExistants.map((m) => [m.mois.slice(0, 7), m])), [moisExistants]);

  async function choisirFichier(e) {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    setNomFichier(fichier.name);
    setLecture(true);
    try {
      const resultat = await lireClasseurFluctuation(fichier);
      setOnglets(resultat.map((o, i) => ({
        ...o,
        id: i,
        coche: Boolean(o.mois) && o.lignes.length > 0 && existants.get(o.mois)?.statut !== 'valide' && existants.get(o.mois)?.statut !== 'transmis',
      })));
    } catch {
      toast.error(t('fluctuationRh.importFichierIllisible'));
      setOnglets(null);
    }
    setLecture(false);
  }

  function majOnglet(id, changement) {
    setOnglets((liste) => liste.map((o) => (o.id === id ? { ...o, ...changement } : o)));
  }

  const selection = (onglets || []).filter((o) => o.coche && o.mois);
  const totalLignes = selection.reduce((s, o) => s + o.lignes.length, 0);
  const moisEnDouble = useMemo(() => {
    const vus = new Set();
    const doubles = new Set();
    for (const o of selection) { if (vus.has(o.mois)) doubles.add(o.mois); vus.add(o.mois); }
    return doubles;
  }, [selection]);

  async function importer() {
    if (!selection.length || moisEnDouble.size) return;
    setEnvoi(true);
    const blocs = selection.map((o) => ({ mois: o.mois, lignes: o.lignes }));
    const res = await importerFluctuationsRh(blocs, remplacer).catch(() => null);
    setEnvoi(false);
    if (!res?.ok) {
      const corps = await res?.json().catch(() => null);
      toast.error(corps?.message || corps?.error || t('commun.erreurGenerique'));
      return;
    }
    const { importes, ignores } = await res.json();
    toast.success(t('fluctuationRh.importReussi', { lignes: importes.reduce((s, m) => s + m.lignes, 0), mois: importes.length }));
    if (ignores.length) toast.warn(t('fluctuationRh.importMoisIgnores', { count: ignores.length }));
    onImporte(importes.length ? importes[importes.length - 1].mois.slice(0, 7) : null);
  }

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/50' onClick={() => !envoi && onFerme()} />
      <div role='dialog' aria-modal='true' className='relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-card shadow-xl'>
        <div className='flex items-start justify-between gap-3 p-5 pb-3'>
          <div>
            <h3 className='text-base font-semibold text-foreground'>{t('fluctuationRh.importTitre')}</h3>
            <p className='text-xs text-muted-foreground mt-0.5 max-w-xl'>{t('fluctuationRh.importAide')}</p>
          </div>
          <button onClick={onFerme} disabled={envoi} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0' title={t('fluctuationRh.fermer')}>
            <LuX size={16} />
          </button>
        </div>

        <div className='px-5 pb-3'>
          <label className='flex items-center gap-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.03] transition-colors px-4 py-4 cursor-pointer'>
            <span className='flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center'>
              {lecture ? <LuLoader size={18} className='animate-spin' /> : <LuFileSpreadsheet size={18} />}
            </span>
            <span className='min-w-0'>
              <span className='block text-sm font-medium text-foreground truncate'>{nomFichier || t('fluctuationRh.importChoisir')}</span>
              <span className='block text-xs text-muted-foreground'>{t('fluctuationRh.importFormats')}</span>
            </span>
            <input type='file' accept='.xlsx,.xls,.csv' onChange={choisirFichier} className='sr-only' />
          </label>
        </div>

        {onglets && (
          <div className='flex-1 min-h-0 overflow-y-auto px-5'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
                  <th className='py-2 pr-2 w-8'></th>
                  <th className='py-2 pr-2'>{t('fluctuationRh.importOnglet')}</th>
                  <th className='py-2 pr-2'>{t('fluctuationRh.importMois')}</th>
                  <th className='py-2 pr-2 text-right'>{t('fluctuationRh.importLignes')}</th>
                  <th className='py-2'>{t('fluctuationRh.importRemarques')}</th>
                </tr>
              </thead>
              <tbody>
                {onglets.map((o) => {
                  const existant = o.mois ? existants.get(o.mois) : null;
                  const verrouille = existant && existant.statut !== 'brouillon';
                  return (
                    <tr key={o.id} className={`border-t border-border ${o.coche ? '' : 'opacity-55'}`}>
                      <td className='py-2 pr-2'>
                        <input type='checkbox' checked={o.coche} disabled={verrouille || !o.mois} onChange={(e) => majOnglet(o.id, { coche: e.target.checked })} className='checkbox checkbox-sm checkbox-primary' aria-label={o.onglet} />
                      </td>
                      <td className='py-2 pr-2 font-medium whitespace-nowrap'>{o.onglet.trim()}</td>
                      <td className='py-2 pr-2'>
                        <input
                          type='month'
                          value={o.mois || ''}
                          onChange={(e) => {
                            const choisi = e.target.value || null;
                            const statutChoisi = choisi ? existants.get(choisi)?.statut : null;
                            // Un onglet dont on vient de préciser le mois est coché d'office (sauf mois validé).
                            majOnglet(o.id, { mois: choisi, coche: Boolean(choisi) && o.lignes.length > 0 && (!statutChoisi || statutChoisi === 'brouillon') });
                          }}
                          className='rounded-md border border-border bg-background px-2 py-1 text-xs'
                        />
                        {o.mois && <span className='block text-[11px] text-muted-foreground mt-0.5'>{libelleMois(o.mois, i18n.language)}</span>}
                      </td>
                      <td className='py-2 pr-2 text-right tabular-nums font-medium'>{o.lignes.length}</td>
                      <td className='py-2 text-xs'>
                        <div className='flex flex-col gap-0.5'>
                          {verrouille && <span className='inline-flex items-center gap-1 text-muted-foreground'><LuLock size={11} /> {t('fluctuationRh.importMoisValide')}</span>}
                          {!verrouille && existant?.total > 0 && (
                            <span className='text-amber-700 dark:text-amber-400'>
                              {remplacer ? t('fluctuationRh.importRemplace', { count: existant.total }) : t('fluctuationRh.importAjoute', { count: existant.total })}
                            </span>
                          )}
                          {!o.mois && <span className='text-destructive'>{t('fluctuationRh.importMoisInconnu')}</span>}
                          {o.mois && moisEnDouble.has(o.mois) && o.coche && <span className='text-destructive'>{t('fluctuationRh.importMoisEnDouble')}</span>}
                          {o.titresInconnus.length > 0 && (
                            <span className='inline-flex items-start gap-1 text-amber-700 dark:text-amber-400'>
                              <LuAlertTriangle size={11} className='mt-0.5 shrink-0' />
                              {t('fluctuationRh.importSectionsIgnorees', { sections: o.titresInconnus.join(', ') })}
                            </span>
                          )}
                          {!verrouille && !existant?.total && o.mois && !o.titresInconnus.length && <span className='text-muted-foreground'>—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className='flex flex-wrap items-center justify-between gap-3 p-5 pt-4 border-t border-border mt-3'>
          <label className='inline-flex items-center gap-2 text-sm text-foreground'>
            <input type='checkbox' checked={remplacer} onChange={(e) => setRemplacer(e.target.checked)} className='checkbox checkbox-sm checkbox-primary' />
            {t('fluctuationRh.importRemplacer')}
          </label>
          <div className='flex gap-2'>
            <button onClick={onFerme} disabled={envoi} className='btn btn-sm btn-ghost'>{t('fluctuationRh.annuler')}</button>
            <button
              onClick={importer}
              disabled={envoi || !selection.length || moisEnDouble.size > 0}
              className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {envoi ? <LuLoader size={14} className='animate-spin' /> : <LuUpload size={14} />}
              {t('fluctuationRh.importBouton', { lignes: totalLignes, count: selection.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportFluctuationRhModal;
