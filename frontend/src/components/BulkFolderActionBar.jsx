import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { LuX, LuDownload, LuPin, LuTrash2 } from 'react-icons/lu';
import { downloadCategorie, favoriCategorie, deleteCategorieById } from '../api/routes/categorie';
import { useConfirm } from '../contexts/ConfirmDialogContext';

/**
 * Barre d'actions groupées pour les dossiers sélectionnés dans Home.jsx —
 * même principe que BulkActionBar (documents), en réutilisant les endpoints
 * unitaires existants un par un plutôt qu'un nouvel endpoint "en masse" côté
 * backend (les dossiers ne se comptent jamais par centaines).
 */
function BulkFolderActionBar({ dossiers, selectedIds, onClear, onChanged }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const count = selectedIds.size;
  if (count === 0) return null;

  const selectionnes = dossiers.filter((d) => selectedIds.has(d.id));

  async function bulkTelecharger() {
    setBusy(true);
    for (const d of selectionnes) {
      try { await downloadCategorie(d.id); } catch (error) { console.log(error); }
    }
    setBusy(false);
    toast.success(t('bulkFolder.telechargementDemande', { count }));
    onClear();
  }

  async function bulkEpingler() {
    setBusy(true);
    for (const d of selectionnes) {
      try { await favoriCategorie(d.id); } catch (error) { console.log(error); }
    }
    setBusy(false);
    toast.success(t('bulkFolder.epingle', { count }));
    onClear();
    onChanged && onChanged();
  }

  async function bulkSupprimer() {
    if (!await confirm({ message: t('bulkFolder.confirmSupprimer', { count }), danger: true, confirmLabel: t('bulkFolder.supprimer') })) return;
    setBusy(true);
    let ok = 0;
    for (const d of selectionnes) {
      try {
        const res = await deleteCategorieById(d.id);
        if (res.status === 200) ok++;
      } catch (error) { console.log(error); }
    }
    setBusy(false);
    if (ok > 0) toast.success(t('bulkFolder.supprime', { count: ok }));
    if (ok < selectionnes.length) toast.error(t('bulkFolder.nonSupprimes', { count: selectionnes.length - ok }));
    onClear();
    onChanged && onChanged();
  }

  return (
    <div className='sticky top-0 z-10 flex items-center justify-between flex-wrap gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 mb-4'>
      <div className='flex items-center gap-2 text-sm font-medium'>
        <span className='flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold'>{count}</span>
        {t('bulkFolder.selectionnes', { count })}
      </div>
      <div className='flex items-center gap-2'>
        <button disabled={busy} onClick={bulkTelecharger} className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60'>
          <LuDownload size={14} /> {t('bulkFolder.telecharger')}
        </button>
        <button disabled={busy} onClick={bulkEpingler} className='inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60'>
          <LuPin size={14} /> {t('bulkFolder.epingler')}
        </button>
        <button disabled={busy} onClick={bulkSupprimer} className='inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 text-destructive px-3 py-1.5 text-sm font-medium hover:bg-destructive/10 transition-colors disabled:opacity-60'>
          <LuTrash2 size={14} /> {t('bulkFolder.supprimer')}
        </button>
        <button onClick={onClear} className='flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'>
          <LuX size={15} />
        </button>
      </div>
    </div>
  );
}

export default BulkFolderActionBar;
