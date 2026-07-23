import React from 'react';
import { ContextMenuTrigger, ContextMenu, ContextMenuItem, ContextMenuContent, ContextMenuShortcut } from '../ui/ui/context-menu';
import { LuFileEdit, LuShare2, LuTrash2 } from 'react-icons/lu';
import { shareDocument } from '../api/routes/document';
import { toast } from 'react-toastify';
import { usePermissions } from '../hooks/usePermissions';

const DocumentContextMenu = ({ doc, children }) => {
    function shareDoc(){
      shareDocument({permissions:"read"},doc?.id).then((res)=>{
        if (res.status===200) {
          toast.success("document partagé avec succès")
        }
      })
    }
    const { role, isAdministrator, hasPermission } = usePermissions();
    const canManageDocument = isAdministrator || hasPermission('archiver_documents');
    return (
        <ContextMenu>
          <ContextMenuTrigger>
            {children}
          </ContextMenuTrigger>
          {role ?
          <ContextMenuContent className="w-64">
            <ContextMenuItem inset onClick={shareDoc}>
              Partager le document
              <ContextMenuShortcut><LuShare2 /></ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem inset disabled={!canManageDocument}>
              Renommer le document
              <ContextMenuShortcut><LuFileEdit /></ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem inset disabled={!canManageDocument}>
              <div className="text-destructive">
                Supprimer le document
              </div>
              <ContextMenuShortcut><LuTrash2 /></ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
          :''}
        </ContextMenu>
      );
}

export default DocumentContextMenu;
