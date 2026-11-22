import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuLock } from 'react-icons/lu';
import { estDejaInstallee } from '../utils/installation';

/**
 * Premier lancement depuis le raccourci de l'écran d'accueil — demande
 * explicite 2026-11-22 : rappel des règles de confidentialité, à accepter
 * une seule fois par personne et par appareil (localStorage).
 */
function cle(userId) {
  return `his_confidentialite_lancement_${userId || 'inconnu'}`;
}

export default function RappelConfidentialiteLancement({ userId }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!userId || !estDejaInstallee()) return;
    try {
      if (!localStorage.getItem(cle(userId))) setOuvert(true);
    } catch { /* stockage indisponible : pas de rappel plutôt qu'à chaque ouverture */ }
  }, [userId]);

  useEffect(() => {
    const boite = dialogRef.current;
    if (ouvert && boite && !boite.open) boite.showModal();
  }, [ouvert]);

  function accepter() {
    try { localStorage.setItem(cle(userId), new Date().toISOString()); } catch { /* idem */ }
    dialogRef.current?.close();
    setOuvert(false);
  }

  if (!ouvert) return null;

  return (
    <dialog
      ref={dialogRef}
      data-sans-historique=''
      // Pas de fermeture par Échap ni clic à côté : le rappel doit être lu.
      onCancel={(e) => e.preventDefault()}
      className='w-[calc(100%-32px)] max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl backdrop:bg-black/50'
    >
      <div className='flex items-start gap-3'>
        <span className='flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary'>
          <LuLock size={20} />
        </span>
        <div className='min-w-0 pt-1'>
          <h2 className='text-base font-semibold text-foreground'>{t('confidentialite.lancementTitre')}</h2>
          <p className='mt-2 text-sm text-muted-foreground'>{t('confidentialite.lancementTexte')}</p>
          <ul className='mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1'>
            <li>{t('confidentialite.lancementPoint1')}</li>
            <li>{t('confidentialite.lancementPoint2')}</li>
            <li>{t('confidentialite.lancementPoint3')}</li>
          </ul>
        </div>
      </div>
      <div className='mt-5 flex justify-end'>
        <button
          type='button'
          onClick={accepter}
          className='rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90'
        >
          {t('confidentialite.lancementAccepter')}
        </button>
      </div>
    </dialog>
  );
}
