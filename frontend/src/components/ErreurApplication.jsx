import { useEffect, useState } from 'react';
import { useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuLoader2, LuRefreshCw } from 'react-icons/lu';
import { estErreurDeVersion, rechargerPourNouvelleVersion } from '../utils/chargementPage';

/**
 * Remplace l'écran brut « Unexpected Application Error! » de React Router.
 * Ancienne version encore en mémoire après un déploiement : rechargement
 * automatique (voir utils/chargementPage.js). Autre erreur : un message
 * clair avec un bouton pour recharger, sans pile technique à l'écran.
 */
export default function ErreurApplication() {
  const erreur = useRouteError();
  const { t } = useTranslation();
  const versionPerimee = estErreurDeVersion(erreur);
  const [recharge, setRecharge] = useState(false);

  useEffect(() => {
    if (versionPerimee && rechargerPourNouvelleVersion()) setRecharge(true);
    // eslint-disable-next-line no-console
    console.error(erreur);
  }, [erreur, versionPerimee]);

  if (recharge) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-white'>
        <LuLoader2 className='animate-spin text-gray-400' size={24} />
      </div>
    );
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-white px-4'>
      <div className='w-full max-w-sm text-center'>
        <h1 className='text-lg font-semibold text-gray-900'>
          {versionPerimee
            ? t('erreurApplication.nouvelleVersion', 'Une nouvelle version est disponible')
            : t('erreurApplication.titre', 'Un problème est survenu')}
        </h1>
        <p className='mt-2 text-sm text-gray-600'>
          {t('erreurApplication.texte', "Rechargez la page pour continuer. Si le problème revient, prévenez l'administrateur.")}
        </p>
        <button
          type='button'
          onClick={() => window.location.reload()}
          className='mt-5 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white'
        >
          <LuRefreshCw size={16} />
          {t('erreurApplication.recharger', 'Recharger')}
        </button>
      </div>
    </div>
  );
}
