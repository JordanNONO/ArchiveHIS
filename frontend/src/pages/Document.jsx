import React, { useEffect, useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import ViewToggleButtons from '../components/ViewToggleButtons';
import DocumentGrid from '../components/DocumentGrid';
import DocumentList from '../components/DocumentList';
import Pagination from '../components/Pagination';
import { getDocument } from '../api/routes/document';
import { FaFilePdf, FaFileWord, FaFileExcel, FaFilePowerpoint, FaFile } from 'react-icons/fa6';

function Document() {
  const [documents, setDocuments] = useState([]);
  const [view, setView] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const documentsPerPage = view==='grid'? 10:8;
  const [searchValue,setSearchValue] = useState([])
  const fetchDocuments = async () => {
    try {
      const res = await getDocument();
      if (res.status === 200) {
        const data = await res.json();
        setDocuments(data);
        setSearchValue(data)
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des documents:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const getFileIcon = (filePath) => {
    const fileExtension = filePath.split('.').pop();
    switch (fileExtension) {
      case 'pdf':
        return <FaFilePdf className="text-red-600" />;
      case 'doc':
      case 'docx':
        return <FaFileWord className="text-blue-600" />;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return <FaFileExcel className="text-green-600" />;
      case 'ppt':
      case 'pptx':
        return <FaFilePowerpoint className="text-orange-600" />;
      default:
        return <FaFile />;
    }
  };
  function searchDocument(e) {
    e.preventDefault()
    const value = e.target.value;
    const copyDos = [...documents];
    if (value!=="") {
      
      const match = copyDos.filter((d)=>String(d.titre).toLocaleLowerCase().includes(value.toLocaleLowerCase()));
      if (match.length>0) {
        setSearchValue(match)
        return
      }else{
        setSearchValue(documents)
       return
      }
    }else{
      setSearchValue(documents)
      return
    }
  }

  const indexOfLastDocument = currentPage * documentsPerPage;
  const indexOfFirstDocument = indexOfLastDocument - documentsPerPage;
  const currentDocuments = searchValue.slice(indexOfFirstDocument, indexOfLastDocument);

  return (
    <div className='w-full'>
      <Breadcrumbs where={"Documents"} />
      <ViewToggleButtons view={view} setView={setView} />
      <div className="flex justify-between items-center">
        <div>
          <label className="input input-sm  input-bordered flex items-center gap-2">
            <input type="text" onChange={searchDocument} className="grow w-full focus:w-48 hover:w-48 duration-300" placeholder="Chercher un document..." />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-4 w-4 opacity-70">
              <path
                fillRule="evenodd"
                d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
                clipRule="evenodd" />
            </svg>
          </label>
        </div>
      </div>
      {view === 'grid' ? (
        <DocumentGrid documents={currentDocuments} getFileIcon={getFileIcon} />
      ) : (
        <DocumentList documents={currentDocuments} getFileIcon={getFileIcon} />
      )}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(searchValue.length / documentsPerPage)}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

export default Document;
