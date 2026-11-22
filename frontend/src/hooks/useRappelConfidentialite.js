import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../contexts/ConfirmDialogContext';

/**
 * Rappel de confidentialité avant qu'un document sorte de l'application
 * (téléchargement, impression) — demande explicite 2026-11-22.
 *
 * Une fois accepté, il ne revient plus jusqu'à la fermeture de l'onglet
 * (sessionStorage) : un administrateur qui télécharge vingt bulletins ne
 * doit pas cliquer vingt fois sur « Continuer ».
 */
const CLE = 'his_rappel_confidentialite_accepte';

export function useRappelConfidentialite() {
  const confirm = useConfirm();
  const { t } = useTranslation();

  return useCallback(async () => {
    try {
      if (sessionStorage.getItem(CLE)) return true;
    } catch { /* stockage indisponible : on redemande */ }

    const ok = await confirm({
      title: t('confidentialite.rappelTitre'),
      message: t('confidentialite.rappelTexte'),
      confirmLabel: t('confidentialite.continuer'),
      cancelLabel: t('confidentialite.annuler'),
    });
    if (ok) {
      try { sessionStorage.setItem(CLE, '1'); } catch { /* idem */ }
    }
    return ok;
  }, [confirm, t]);
}
