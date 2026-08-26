import React, { useState } from 'react';
import { ContextMenuTrigger, ContextMenu, ContextMenuItem, ContextMenuContent, ContextMenuShortcut } from '../ui/ui/context-menu';
import { LuFileEdit, LuShare2, LuTrash2, LuDownload, LuPanelRight, LuFolderInput, LuPin, LuPinOff } from 'react-icons/lu';
import ShareDocumentModal from './ShareDocumentModal';
import { usePermissions } from '../hooks/usePermissions';
import { getDocumentLienFichier, favoriDocument, defavoriDocument } from '../api/routes/document';
import { toast } from 'react-toastify';

const DocumentContextMenu = ({ doc, children, onRename, onDelete, onApercu, onMove, onChanged }) => {
    const { role, isAdministrator, hasPermission } = usePermissions();
    const canManageDocument = isAdministrator || hasPermission('archiver_documents');
    const [shareOpen, setShareOpen] = useState(false);

    async function onToggleFavori() {
        try {
            const appel = doc.is_favorite ? defavoriDocument : favoriDocument;
            const res = await appel(doc.id);
            if (res.status === 200) {
                onChanged && onChanged();
            } else {
                toast.error('Une erreur est survenue');
            }
        } catch (error) {
            console.log(error);
            toast.error('Une erreur est survenue');
        }
    }

    async function onDownload() {
        try {
            const res = await getDocumentLienFichier(doc.id);
            if (res.status === 200) {
                const data = await res.json();
                window.location.href = data.telechargement;
            } else {
                toast.error('Le téléchargement a échoué');
            }
        } catch (error) {
            console.log(error);
            toast.error('Une erreur est survenue');
        }
    }

    return (
        <>
            <ContextMenu>
              <ContextMenuTrigger>
                {children}
              </ContextMenuTrigger>
              {role ?
              <ContextMenuContent className="w-64">
                {onApercu && (
                  <ContextMenuItem inset onClick={() => onApercu(doc)}>
                    Aperçu rapide
                    <ContextMenuShortcut><LuPanelRight /></ContextMenuShortcut>
                  </ContextMenuItem>
                )}
                <ContextMenuItem inset onClick={onDownload}>
                  Télécharger le document
                  <ContextMenuShortcut><LuDownload /></ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem inset onClick={() => setShareOpen(true)}>
                  Partager le document
                  <ContextMenuShortcut><LuShare2 /></ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem inset onClick={onToggleFavori}>
                  {doc.is_favorite ? 'Retirer des favoris' : 'Épingler en favori'}
                  <ContextMenuShortcut>{doc.is_favorite ? <LuPinOff /> : <LuPin />}</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem inset disabled={!canManageDocument} onClick={onRename}>
                  Renommer le document
                  <ContextMenuShortcut><LuFileEdit /></ContextMenuShortcut>
                </ContextMenuItem>
                {onMove && (
                  <ContextMenuItem inset disabled={!canManageDocument} onClick={onMove}>
                    Déplacer le document
                    <ContextMenuShortcut><LuFolderInput /></ContextMenuShortcut>
                  </ContextMenuItem>
                )}
                <ContextMenuItem inset disabled={!canManageDocument} onClick={onDelete}>
                  <div className="text-destructive">
                    Supprimer le document
                  </div>
                  <ContextMenuShortcut><LuTrash2 /></ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuContent>
              :''}
            </ContextMenu>
            <ShareDocumentModal doc={doc} isOpen={shareOpen} onClose={() => setShareOpen(false)} />
        </>
      );
}

export default DocumentContextMenu;
