import React from 'react';
import DocumentContextMenu from './DocumentContextMenu';
import { useNavigate } from 'react-router-dom';

const DocumentList = ({ documents, getFileIcon }) => {
  const navigate = useNavigate()
  return (
  
    <div className="overflow-x-auto">
      <table className="table py-3 mb-3">
        <thead>
          <tr>
            <th></th>
            <th>Nom du fichier</th>
            <th>Taille du fichier</th>
            <th>Date de création du fichier</th>
            <th>Date d'archivage</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, k) => (
            <tr key={k} className='hover:bg-amber-500/30 rounded' onClick={()=>navigate(`/view/${doc.id}/${String(doc.file_path).split(".").at(1)}`)}>
              <th>
                <DocumentContextMenu doc={doc}>
                  <div className='text-xl'>
                    {getFileIcon(doc.file_path)}
                  </div>
                </DocumentContextMenu>
              </th>
              <td>
                <DocumentContextMenu doc={doc}>
                  {`${doc.titre}.${doc.file_path.split('.').pop()}`}
                </DocumentContextMenu>
              </td>
              <td>{doc?.taille > 1024 * 1024 ? `${(doc.taille / (1024 * 1024)).toFixed(2)} Mo` : `${(doc.taille / 1024).toFixed(2)} Ko`}</td>
              <td>{doc?.file_create_date}</td>
              <td>
                {new Date(doc?.created_at).getDate().toString().padStart(2, '0')}/{(new Date(doc?.created_at).getMonth() + 1).toString().padStart(2, '0')}/{new Date(doc?.created_at).getFullYear()} - {new Date(doc?.created_at).getUTCHours()}:{new Date(doc?.created_at).getMinutes()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
};

export default DocumentList;
