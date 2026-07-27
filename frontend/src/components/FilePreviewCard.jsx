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
 * nom, taille, et un bouton pour le retirer de la sélection.
 */
function FilePreviewCard({ file, onRemove }) {
  if (!file) return null;
  const { icon: Icon, tint } = getFileTypeVisual(file.name);

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
