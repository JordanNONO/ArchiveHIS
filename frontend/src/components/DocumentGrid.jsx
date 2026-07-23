import React from 'react';
import DocumentContextMenu from './DocumentContextMenu';
import { Link } from 'react-router-dom';
import StatutBadge from './StatutBadge';

const DocumentGrid = ({ documents, getFileIcon }) => (
  <div className="grid sm:grid-cols-5 max-md:grid-cols-3 grid-cols-2 max-h-[70vh] overflow-x-hidden overflow-y-auto md:grid-cols-5 lg:grid-cols-8 gap-5 py-8">
    {documents.map((doc, k) => (
      <DocumentContextMenu key={k} doc={doc}>
        <Link to={"/view/"+doc.id+"/"+String(doc.chemin_stockage_serveur).split(".").at(1)}>
        <div className="flex flex-col items-center cursor-pointer duration-200 hover:bg-accent/30 p-5 rounded-lg relative" title={`${doc.titre_document}.${doc.chemin_stockage_serveur.split('.').pop()}`}>
          <StatutBadge statut={doc.status_doc} className="absolute top-0 right-0" />
          <div className="text-6xl">
            {getFileIcon(doc.chemin_stockage_serveur)}
          </div>
          <div className="text-center text-sm px-5" title={`${doc.titre_document}.${doc.chemin_stockage_serveur.split('.').pop()}`}>
            {`${doc.titre_document.substring(0, 8)}[...].${doc.chemin_stockage_serveur.split('.').pop()}`}
          </div>
        </div>
        </Link>
      </DocumentContextMenu>
    ))}
  </div>
);

export default DocumentGrid;
