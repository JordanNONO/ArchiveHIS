import React from 'react';
import { getFileIcon } from '../utils/fileIcons';
import { ContextMenuTrigger, ContextMenu, ContextMenuItem, ContextMenuContent, ContextMenuShortcut } from '../ui/ui/context-menu';
import { LuFileEdit, LuShare2, LuTrash2 } from 'react-icons/lu';

function DocumentItem({ doc }) {
    const user = JSON.parse(sessionStorage.getItem("user"))
    return (
        <ContextMenu>
            <ContextMenuTrigger>
                <div className="flex flex-col items-center " title={`${doc.titre}.${doc.file_path.split('.').pop()}`}>
                    <div className="text-6xl">
                        {getFileIcon(doc.file_path)}
                    </div>
                    <div className="text-center" title={`${doc.titre}.${doc.file_path.split('.').pop()}`}>
                        {`${doc.titre.substring(0, 10)}(...).${doc.file_path.split('.').pop()}`}
                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-64">
                <ContextMenuItem inset>
                    Partager le document
                    <ContextMenuShortcut><LuShare2 /></ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem inset className="disabled:cursor-not-allowed" disabled>
                    Renommer le document
                    <ContextMenuShortcut><LuFileEdit /></ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem inset>
                    <div className="text-red-500">
                        Supprimer le document
                    </div>
                    <ContextMenuShortcut><LuTrash2 /></ContextMenuShortcut>
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}

export default DocumentItem;
