import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuX, LuLoader } from 'react-icons/lu';
import { SECTIONS_FLUCTUATION, SECTION_PAR_CLE, cleLibelleChamp, libelleMois } from '../constants/fluctuationRh';
import { createFluctuationRh, updateFluctuationRh } from '../api/routes/fluctuationRh';

const VIDE = { salarie: '', date_debut: '', date_fin: '', motif: '', heures: '', montant: '', observations: '' };

function versFormulaire(ligne) {
  if (!ligne) return VIDE;
  const f = { ...VIDE };
  for (const cle of Object.keys(VIDE)) {
    const v = ligne[cle];
    f[cle] = v === null || v === undefined ? '' : (cle.startsWith('date_') ? String(v).slice(0, 10) : String(v));
  }
  return f;
}

/**
 * Ajout/modification d'une ligne de fluctuation RH, en fenêtre — les champs
 * affichés suivent la section choisie (voir SECTIONS_FLUCTUATION). En ajout,
 * "Enregistrer et continuer" garde la fenêtre ouverte sur la même section
 * pour enchaîner plusieurs saisies (ex. tous les congés du mois).
 */
function FluctuationRhForm({ mois, sectionInitiale, ligne, salaries, onFerme, onEnregistre }) {
  const { t, i18n } = useTranslation();
  const [section, setSection] = useState(ligne?.section || sectionInitiale || 'absence');
  const [form, setForm] = useState(() => {
    const f = versFormulaire(ligne);
    if (!ligne && SECTION_PAR_CLE[section]?.motifParDefaut) f.motif = SECTION_PAR_CLE[section].motifParDefaut;
    return f;
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState({});
  const premierChampRef = useRef(null);
  const config = SECTION_PAR_CLE[section];

  useEffect(() => { premierChampRef.current?.focus(); }, []);

  useEffect(() => {
    function echap(e) { if (e.key === 'Escape' && !envoi) onFerme(); }
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [envoi, onFerme]);

  function changerSection(cle) {
    setSection(cle);
    if (!ligne && !form.motif && SECTION_PAR_CLE[cle]?.motifParDefaut) {
      setForm((f) => ({ ...f, motif: SECTION_PAR_CLE[cle].motifParDefaut }));
    }
  }

  function maj(champ, valeur) {
    setForm((f) => ({ ...f, [champ]: valeur }));
    if (erreurs[champ]) setErreurs((e) => ({ ...e, [champ]: null }));
  }

  async function enregistrer(continuer) {
    const nouvellesErreurs = {};
    if (!form.salarie.trim()) nouvellesErreurs.salarie = t('fluctuationRh.erreurSalarie');
    if (form.date_debut && form.date_fin && form.date_fin < form.date_debut) nouvellesErreurs.date_fin = t('fluctuationRh.erreurDates');
    if (Object.keys(nouvellesErreurs).length) {
      setErreurs(nouvellesErreurs);
      return;
    }

    // Seuls les champs de la section partent : un champ masqué (ex. montant
    // resté rempli après un changement de section) ne doit pas être enregistré.
    const donnees = { section };
    for (const champ of Object.keys(VIDE)) {
      const v = config.champs.includes(champ) ? form[champ].trim() : '';
      donnees[champ] = v === '' ? null : (champ === 'montant' ? Number(v.replace(',', '.')) : v);
    }

    setEnvoi(true);
    const res = await (ligne ? updateFluctuationRh(ligne.id, donnees) : createFluctuationRh({ ...donnees, mois })).catch(() => null);
    setEnvoi(false);

    if (res?.ok) {
      toast.success(ligne ? t('fluctuationRh.ligneModifiee') : t('fluctuationRh.ligneAjoutee'));
      onEnregistre();
      if (continuer) {
        setForm({ ...VIDE, motif: config.motifParDefaut || '' });
        premierChampRef.current?.focus();
      } else {
        onFerme();
      }
      return;
    }
    const corps = await res?.json().catch(() => null);
    toast.error(corps?.error || corps?.message || t('commun.erreurGenerique'));
  }

  const classeChamp = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
  const classeLabel = 'text-xs font-semibold text-muted-foreground';

  // Fonction de rendu (pas un composant <Champ/>) : un composant déclaré ici
  // serait recréé à chaque frappe et le champ perdrait le focus.
  function rendreChamp(champ) {
    const libelle = t(`fluctuationRh.${cleLibelleChamp(section, champ)}`);
    const erreur = erreurs[champ];
    if (champ === 'salarie') return null;
    return (
      <label key={`${section}-${champ}`} className={`flex flex-col gap-1 ${champ === 'observations' ? 'sm:col-span-2' : ''}`}>
        <span className={classeLabel}>{libelle}</span>
        {champ === 'observations' ? (
          <textarea rows={2} value={form.observations} onChange={(e) => maj('observations', e.target.value)} className={`${classeChamp} resize-none`} placeholder={t(`fluctuationRh.aideObservations_${section}`, { defaultValue: '' })} />
        ) : champ === 'motif' ? (
          <>
            <input list={`motifs-${section}`} value={form.motif} onChange={(e) => maj('motif', e.target.value)} className={classeChamp} placeholder={t('fluctuationRh.choisirOuSaisir')} />
            <datalist id={`motifs-${section}`}>
              {(config.motifs || []).map((m) => <option key={m} value={m} />)}
            </datalist>
          </>
        ) : champ.startsWith('date_') ? (
          <input type='date' value={form[champ]} onChange={(e) => maj(champ, e.target.value)} className={`${classeChamp} ${erreur ? 'border-destructive' : ''}`} />
        ) : champ === 'montant' ? (
          <div className='relative'>
            <input inputMode='decimal' value={form.montant} onChange={(e) => maj('montant', e.target.value.replace(/[^\d.,]/g, ''))} className={`${classeChamp} pr-8 tabular-nums`} placeholder='0,00' />
            <span className='absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>€</span>
          </div>
        ) : (
          <input value={form[champ]} onChange={(e) => maj(champ, e.target.value)} className={classeChamp} placeholder={champ === 'heures' ? '151,67 h' : ''} />
        )}
        {erreur && <span className='text-xs text-destructive'>{erreur}</span>}
      </label>
    );
  }

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/50' onClick={() => !envoi && onFerme()} />
      <div role='dialog' aria-modal='true' className='relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl'>
        <div className='flex items-start justify-between gap-3 mb-4'>
          <div>
            <h3 className='text-base font-semibold text-foreground'>{ligne ? t('fluctuationRh.modifierLigne') : t('fluctuationRh.ajouterLigne')}</h3>
            <p className='text-xs text-muted-foreground mt-0.5'>{libelleMois(mois, i18n.language)}</p>
          </div>
          <button onClick={onFerme} disabled={envoi} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition-colors' title={t('fluctuationRh.fermer')}>
            <LuX size={16} />
          </button>
        </div>

        <div className='flex flex-col gap-3'>
          <label className='flex flex-col gap-1'>
            <span className={classeLabel}>{t('fluctuationRh.section')}</span>
            <select value={section} onChange={(e) => changerSection(e.target.value)} className={classeChamp}>
              {SECTIONS_FLUCTUATION.map((s) => <option key={s.cle} value={s.cle}>{t(`fluctuationRh.section_${s.cle}`)}</option>)}
            </select>
          </label>

          <label className='flex flex-col gap-1'>
            <span className={classeLabel}>{t('fluctuationRh.colSalarie')} *</span>
            <input
              ref={premierChampRef}
              list='fluctuation-salaries'
              value={form.salarie}
              onChange={(e) => maj('salarie', e.target.value)}
              placeholder={t('fluctuationRh.placeholderSalarie')}
              className={`${classeChamp} ${erreurs.salarie ? 'border-destructive' : ''}`}
            />
            <datalist id='fluctuation-salaries'>
              {salaries.map((n) => <option key={n} value={n} />)}
            </datalist>
            {erreurs.salarie && <span className='text-xs text-destructive'>{erreurs.salarie}</span>}
          </label>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            {config.champs.map((champ) => rendreChamp(champ))}
          </div>
        </div>

        <div className='flex flex-wrap justify-end gap-2 mt-5'>
          <button onClick={onFerme} disabled={envoi} className='btn btn-sm btn-ghost'>{t('fluctuationRh.annuler')}</button>
          {!ligne && (
            <button onClick={() => enregistrer(true)} disabled={envoi} className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60'>
              {t('fluctuationRh.enregistrerEtContinuer')}
            </button>
          )}
          <button onClick={() => enregistrer(false)} disabled={envoi} className='inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60'>
            {envoi && <LuLoader size={14} className='animate-spin' />}
            {t('fluctuationRh.enregistrer')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FluctuationRhForm;
