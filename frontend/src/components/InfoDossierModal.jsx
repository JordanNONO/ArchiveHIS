import React, { useEffect, useRef } from 'react';
import { LuFileText, LuFolderTree, LuCalendarDays, LuClock, LuLock } from 'react-icons/lu';

/**
 * Panneau d'informations d'un dossier — calculé entièrement à partir de
 * données déjà en mémoire côté appelant (Home.jsx / OpenFolder.jsx), aucun
 * appel réseau dédié : compteurs par statut déjà renvoyés par l'API
 * catégories, date de création du modèle Eloquent, dernier document ajouté
 * déduit de la liste déjà chargée.
 */
function InfoDossierModal({ infos, isOpen, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  return (
    <dialog ref={dialogRef} className="modal" onClose={() => onClose && onClose()}>
      <div className="modal-box rounded-2xl max-w-md">
        <form method="dialog">
          <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h1 className='text-lg font-semibold mb-1 truncate pr-8'>{infos?.label}</h1>
        {infos?.verrouille && (
          <p className='inline-flex items-center gap-1.5 text-xs font-semibold text-destructive bg-destructive/10 rounded-full px-2.5 py-1 mb-3'>
            <LuLock size={12} /> Verrouillé{infos?.verrouillePar ? ` par ${infos.verrouillePar}` : ''}
          </p>
        )}

        <div className='grid grid-cols-3 gap-2 my-4'>
          <div className='rounded-xl border border-border p-3 text-center'>
            <p className='text-lg font-semibold leading-none'>{infos?.total ?? 0}</p>
            <p className='text-[11px] text-muted-foreground mt-1'>Documents</p>
          </div>
          <div className='rounded-xl border border-border p-3 text-center'>
            <p className='text-lg font-semibold leading-none text-destructive'>{infos?.attention ?? 0}</p>
            <p className='text-[11px] text-muted-foreground mt-1'>À traiter</p>
          </div>
          <div className='rounded-xl border border-border p-3 text-center'>
            <p className='text-lg font-semibold leading-none text-green-600'>{infos?.traites ?? 0}</p>
            <p className='text-[11px] text-muted-foreground mt-1'>Traités</p>
          </div>
        </div>

        <div className='flex flex-col gap-2.5 text-sm'>
          {infos?.sousDossiers != null && (
            <div className='flex items-center gap-2.5 text-muted-foreground'>
              <LuFolderTree size={15} className='shrink-0' />
              <span>{infos.sousDossiers} sous-dossier{infos.sousDossiers !== 1 ? 's' : ''}</span>
            </div>
          )}
          {infos?.creeLe && (
            <div className='flex items-center gap-2.5 text-muted-foreground'>
              <LuCalendarDays size={15} className='shrink-0' />
              <span>Créé le {new Date(infos.creeLe).toLocaleDateString('fr-FR')}</span>
            </div>
          )}
          {infos?.dernierAjout && (
            <div className='flex items-center gap-2.5 text-muted-foreground'>
              <LuClock size={15} className='shrink-0' />
              <span>Dernier ajout le {new Date(infos.dernierAjout).toLocaleDateString('fr-FR')}</span>
            </div>
          )}
          {!infos?.dernierAjout && infos?.total === 0 && (
            <div className='flex items-center gap-2.5 text-muted-foreground'>
              <LuFileText size={15} className='shrink-0' />
              <span>Aucun document déposé pour l'instant</span>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

export default InfoDossierModal;
