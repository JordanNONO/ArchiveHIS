import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuCalendarRange } from 'react-icons/lu';
import { PRESETS_PERIODE } from '../utils/periodes';

/**
 * Filtre par période façon Power BI, réutilisé identiquement sur les 3
 * registres (Appels, Chèques, Courriers) — voir utils/periodes.js pour le
 * calcul des plages. `valeur`/`onChange` suivent le format
 * `{ preset, debut, fin }` (debut/fin en "YYYY-MM-DD", uniquement utilisés
 * quand preset === 'personnalise').
 */
function FiltrePeriode({ valeur, onChange }) {
  const { t } = useTranslation();

  function changerPreset(preset) {
    onChange({ ...valeur, preset });
  }

  return (
    <div className='flex items-center gap-1.5 flex-wrap'>
      <LuCalendarRange size={15} className='text-muted-foreground shrink-0' />
      <select value={valeur.preset} onChange={(e) => changerPreset(e.target.value)} className='select select-bordered select-sm'>
        {PRESETS_PERIODE.map((p) => (
          <option key={p} value={p}>{t(`filtrePeriode.${p}`)}</option>
        ))}
      </select>
      {valeur.preset === 'personnalise' && (
        <>
          <input
            type='date'
            value={valeur.debut || ''}
            onChange={(e) => onChange({ ...valeur, debut: e.target.value })}
            className='rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
          />
          <span className='text-xs text-muted-foreground'>{t('filtrePeriode.a')}</span>
          <input
            type='date'
            value={valeur.fin || ''}
            onChange={(e) => onChange({ ...valeur, fin: e.target.value })}
            className='rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
          />
        </>
      )}
    </div>
  );
}

export default FiltrePeriode;
