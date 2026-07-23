import React from 'react';
import DocumentContextMenu from './DocumentContextMenu';
import { Link } from 'react-router-dom';

const DocumentGrid = ({ documents, getFileIcon }) => (
  <div className="grid sm:grid-cols-5 max-md:grid-cols-3 grid-cols-2 max-h-[70vh] overflow-x-hidden overflow-y-auto md:grid-cols-5 lg:grid-cols-8 gap-5 py-8">
    {documents.map((doc, k) => (
      <DocumentContextMenu key={k} doc={doc}>
        <Link to={"/view/"+doc.id+"/"+String(doc.file_path).split(".").at(1)}>
        <div className="flex flex-col items-center cursor-pointer duration-200 hover:bg-amber-500/30 p-5 rounded-lg " title={`${doc.titre}.${doc.file_path.split('.').pop()}`}>
          <div className="text-6xl">
            {getFileIcon(doc.file_path)}
          </div>
          <div className="text-center text-sm px-5" title={`${doc.titre}.${doc.file_path.split('.').pop()}`}>
            {`${doc.titre.substring(0, 8)}[...].${doc.file_path.split('.').pop()}`}
          </div>
        </div>
        </Link>
      </DocumentContextMenu>
    ))}
  </div>
);

export default DocumentGrid;
