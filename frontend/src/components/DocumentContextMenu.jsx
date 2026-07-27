import React, { useState } from 'react';
import { ContextMenuTrigger, ContextMenu, ContextMenuItem, ContextMenuContent, ContextMenuShortcut } from '../ui/ui/context-menu';
import { LuFileEdit, LuShare2, LuTrash2, LuDownload } from 'react-icons/lu';
import ShareDocumentModal from './ShareDocumentModal';
import { usePermissions } from '../hooks/usePermissions';
import { GET_DOCUMENTS_API } from '../api';

const DocumentContextMenu = ({ doc, children, onRename, onDelete }) => {
    const { role, isAdministrator, hasPermission } = usePermissions();
    const canManageDocument = isAdministrator || hasPermission('archiver_documents');
    const [shareOpen, setShareOpen] = useState(false);

    return (
        <>
            <ContextMenu>
              <ContextMenuTrigger>
                {children}
              </ContextMenuTrigger>
              {role ?
              <ContextMenuContent className="w-64">
                <ContextMenuItem inset onClick={() => { window.location.href = `${GET_DOCUMENTS_API.url}/${doc.id}?download=1` }}>
                  Télécharger le document
                  <ContextMenuShortcut><LuDownload /></ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem inset onClick={() => setShareOpen(true)}>
                  Partager le document
                  <ContextMenuShortcut><LuShare2 /></ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem inset disabled={!canManageDocument} onClick={onRename}>
                  Renommer le document
                  <ContextMenuShortcut><LuFileEdit /></ContextMenuShortcut>
                </ContextMenuItem>
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
