import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPlus, LuX } from 'react-icons/lu';
import MenuDeroulant from './MenuDeroulant';

/**
 * Saisie d'un congé posé en PLUSIEURS périodes (ex. du 3 au 6, puis du 16 au
 * 17) — voir FluctuationRhForm.jsx. Jusqu'ici une ligne de congé n'avait
 * qu'un seul couple Du/Au : il fallait saisir autant de lignes que de
 * morceaux, et recompter le total à la main.
 *
 * Deux façons de saisir, synchronisées en permanence : la liste de périodes,
 * et le calendrier du mois où un clic ajoute ou retire un jour. Après chaque
 * clic les jours retenus sont recomposés en périodes contiguës, pour qu'on ne
 * se retrouve jamais avec quinze périodes d'un jour.
 *
 * Le décompte en jours ouvrés ou calendaires ne sert qu'à lire le total : il
 * n'est pas enregistré, seules les périodes le sont.
 */

const JOURS_ENTETE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const deuxChiffres = (n) => String(n).padStart(2, '0');

/** "2026-11" + 7 → "2026-11-07" */
function dateIso(mois, jour) {
  return `${mois}-${deuxChiffres(jour)}`;
}

/** Numéro de jour d'une date ISO du mois courant, null si vide. */
function numeroJour(valeur) {
  return valeur ? Number(String(valeur).slice(8, 10)) : null;
}

function estWeekEnd(annee, moisIndex, jour) {
  const j = new Date(annee, moisIndex, jour).getDay();
  return j === 0 || j === 6;
}

/** Jours contigus → périodes : [3,4,5,16] donne du 3 au 5, puis le 16. */
function recomposer(jours) {
  const tries = [...jours].sort((a, b) => a - b);
  const periodes = [];
  tries.forEach((jour) => {
    const derniere = periodes[periodes.length - 1];
    if (derniere && derniere.fin === jour - 1) derniere.fin = jour;
    else periodes.push({ debut: jour, fin: jour });
  });
  return periodes;
}

function PeriodesConge({ mois, periodes, onChange, erreurServeur }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('ouvres');

  const [annee, moisIndex] = useMemo(() => {
    const [a, m] = mois.split('-').map(Number);
    return [a, m - 1];
  }, [mois]);

  const nbJoursMois = useMemo(() => new Date(annee, moisIndex + 1, 0).getDate(), [annee, moisIndex]);

  const compter = (periode) => {
    const du = numeroJour(periode.du);
    const au = numeroJour(periode.au);
    if (!du || !au || au < du) return 0;
    let n = 0;
    for (let j = du; j <= au; j += 1) {
      if (mode === 'calendaires' || !estWeekEnd(annee, moisIndex, j)) n += 1;
    }
    return n;
  };

  // Un jour compté deux fois fausserait le total de congés du salarié : le
  // chevauchement est signalé sur la période fautive, pas seulement au serveur.
  const chevauche = (index) => {
    const a = periodes[index];
    if (!a.du || !a.au) return false;
    return periodes.some((b, j) => j !== index && b.du && b.au && a.du <= b.au && b.du <= a.au);
  };

  const joursRetenus = useMemo(() => {
    const set = new Set();
    periodes.forEach((p) => {
      const du = numeroJour(p.du);
      const au = numeroJour(p.au);
      if (du && au && au >= du) for (let j = du; j <= au; j += 1) set.add(j);
    });
    return set;
  }, [periodes]);

  const total = periodes.reduce((somme, p) => somme + compter(p), 0);
  const nbRemplies = periodes.filter((p) => p.du && p.au).length;

  function majPeriode(index, champ, valeur) {
    const suite = periodes.map((p, i) => (i === index ? { ...p, [champ]: valeur } : p));
    // Poser une seule journée est le cas courant : la fin suit le début tant
    // qu'elle n'a pas été renseignée.
    if (champ === 'du' && valeur && !suite[index].au) suite[index].au = valeur;
    onChange(suite);
  }

  function basculerJour(jour) {
    const set = new Set(joursRetenus);
    if (set.has(jour)) set.delete(jour);
    else set.add(jour);
    onChange(recomposer([...set]).map((p) => ({ du: dateIso(mois, p.debut), au: dateIso(mois, p.fin) })));
  }

  const decalage = (new Date(annee, moisIndex, 1).getDay() + 6) % 7;

  return (
    <div className='sm:col-span-2 flex flex-col gap-2.5'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-xs font-semibold text-muted-foreground'>{t('fluctuationRh.periodesConge')}</span>
        <span className='rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-foreground tabular-nums'>
          {t('fluctuationRh.totalPeriodes', { count: total, periodes: nbRemplies })}
        </span>
      </div>

      <div className='flex flex-col gap-2'>
        {periodes.map((periode, index) => {
          const inverse = periode.du && periode.au && periode.au < periode.du;
          const croise = chevauche(index);
          const faute = inverse || croise;
          return (
            <div key={index}>
              <div className={`flex flex-wrap items-center gap-2 rounded-lg border p-2 ${faute ? 'border-destructive bg-destructive/[0.06]' : 'border-border bg-muted/30'}`}>
                <span className='w-6 h-6 shrink-0 rounded-full bg-primary text-white grid place-items-center text-[11px] font-bold'>{index + 1}</span>
                <input
                  type='date'
                  aria-label={t('fluctuationRh.colDu')}
                  min={dateIso(mois, 1)}
                  max={dateIso(mois, nbJoursMois)}
                  value={periode.du || ''}
                  onChange={(e) => majPeriode(index, 'du', e.target.value)}
                  className='flex-1 min-w-[130px] rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                />
                <input
                  type='date'
                  aria-label={t('fluctuationRh.colAu')}
                  min={dateIso(mois, 1)}
                  max={dateIso(mois, nbJoursMois)}
                  value={periode.au || ''}
                  onChange={(e) => majPeriode(index, 'au', e.target.value)}
                  className='flex-1 min-w-[130px] rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
                />
                <span className='shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary tabular-nums'>
                  {t('fluctuationRh.nJours', { count: compter(periode) })}
                </span>
                <button
                  type='button'
                  onClick={() => onChange(periodes.filter((_, i) => i !== index))}
                  disabled={periodes.length === 1}
                  aria-label={t('fluctuationRh.supprimerPeriode')}
                  className='w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors'
                >
                  <LuX size={14} />
                </button>
              </div>
              {faute && (
                <p className='mt-1 ml-8 text-xs text-destructive'>
                  {inverse ? t('fluctuationRh.erreurDates') : t('fluctuationRh.erreurChevauchement')}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type='button'
        onClick={() => onChange([...periodes, { du: '', au: '' }])}
        className='flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors'
      >
        <LuPlus size={15} /> {t('fluctuationRh.ajouterPeriode')}
      </button>

      <div className='rounded-xl border border-border p-3'>
        <div className='flex flex-wrap items-baseline justify-between gap-1.5 mb-2'>
          <span className='text-sm font-semibold text-foreground'>{t('fluctuationRh.apercuMois')}</span>
          <span className='text-xs text-muted-foreground'>{t('fluctuationRh.apercuAide')}</span>
        </div>
        <div className='grid grid-cols-7 gap-1 text-center'>
          {JOURS_ENTETE.map((lettre, i) => (
            <span key={i} className='py-0.5 text-[11px] font-semibold text-muted-foreground'>{lettre}</span>
          ))}
          {Array.from({ length: decalage }, (_, i) => <span key={`vide-${i}`} />)}
          {Array.from({ length: nbJoursMois }, (_, i) => {
            const jour = i + 1;
            const retenu = joursRetenus.has(jour);
            const weekEnd = estWeekEnd(annee, moisIndex, jour);
            return (
              <button
                key={jour}
                type='button'
                onClick={() => basculerJour(jour)}
                aria-pressed={retenu}
                className={`rounded-md border border-transparent py-1.5 text-sm transition-colors hover:border-primary/50 ${
                  retenu
                    ? (weekEnd ? 'bg-primary/60 text-white' : 'bg-primary text-white')
                    : (weekEnd ? 'text-muted-foreground' : 'text-foreground')
                }`}
              >
                {jour}
              </button>
            );
          })}
        </div>
        <div className='flex flex-wrap gap-3.5 mt-2 text-[11px] text-muted-foreground'>
          <span className='inline-flex items-center gap-1.5'>
            <i className='inline-block w-2.5 h-2.5 rounded-sm bg-primary' /> {t('fluctuationRh.legendeJourConge')}
          </span>
          <span className='inline-flex items-center gap-1.5'>
            <i className='inline-block w-2.5 h-2.5 rounded-sm bg-primary/60' /> {t('fluctuationRh.legendeWeekEnd')}
          </span>
        </div>
      </div>

      <label className='flex flex-col gap-1 sm:max-w-[50%]'>
        <span className='text-xs font-semibold text-muted-foreground'>{t('fluctuationRh.decompte')}</span>
        <MenuDeroulant
          value={mode}
          onChange={setMode}
          options={[
            { value: 'ouvres', label: t('fluctuationRh.joursOuvres') },
            { value: 'calendaires', label: t('fluctuationRh.joursCalendaires') },
          ]}
        />
      </label>

      {erreurServeur && <p className='text-xs text-destructive'>{erreurServeur}</p>}
    </div>
  );
}

export default PeriodesConge;
