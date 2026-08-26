import React from 'react';
import { LuX } from 'react-icons/lu';
import { getFileTypeVisual } from '../utils/fileTypeIcons';

function formatSize(bytes) {
  if (!bytes) return '0 Ko';
  return bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
    : `${(bytes / 1024).toFixed(0)} Ko`;
}

/**
 * Aperçu visuel d'un fichier sélectionné avant envoi : icône colorée selon le type,
 * nom, taille, et un bouton pour le retirer de la sélection. `compact` réduit
 * la carte à une ligne dense — utile quand plusieurs fichiers s'accumulent
 * dans la même liste (voir ArchiverDocumentModal.jsx en mode "lot"), où
 * empiler des cartes en pleine taille prendrait toute la hauteur de la modale.
 */
function FilePreviewCard({ file, onRemove, compact = false }) {
  if (!file) return null;
  const { icon: Icon, tint } = getFileTypeVisual(file.name);

  if (compact) {
    return (
      <div className='flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5'>
        <div className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${tint}`}>
          <Icon size={14} />
        </div>
        <p className='flex-grow text-xs font-medium text-foreground truncate'>{file.name}</p>
        <p className='text-[11px] text-muted-foreground shrink-0'>{formatSize(file.size)}</p>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className='flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0'
          >
            <LuX size={13} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className='flex items-center gap-3 rounded-xl border border-border bg-card p-3'>
      <div className={`flex items-center justify-center w-11 h-11 rounded-lg shrink-0 ${tint}`}>
        <Icon size={20} />
      </div>
      <div className='flex-grow overflow-hidden'>
        <p className='text-sm font-medium text-foreground truncate'>{file.name}</p>
        <p className='text-xs text-muted-foreground'>{formatSize(file.size)}</p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className='flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0'
        >
          <LuX size={15} />
        </button>
      )}
    </div>
  );
}

export default FilePreviewCard;
