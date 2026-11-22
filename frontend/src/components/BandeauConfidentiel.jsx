import { useTranslation } from 'react-i18next';
import { LuLock } from 'react-icons/lu';

/** Rappel discret affiché sur chaque document ouvert — demande explicite 2026-11-22. */
export default function BandeauConfidentiel() {
  const { t } = useTranslation();
  return (
    <div className='flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'>
      <LuLock size={14} className='flex-shrink-0' />
      <span>{t('confidentialite.bandeau')}</span>
    </div>
  );
}
