import React, { useEffect, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import ViewToggleButtons from '../components/ViewToggleButtons';
import DocumentGrid from '../components/DocumentGrid';
import DocumentList from '../components/DocumentList';
import Pagination from '../components/Pagination';
import { getDocument } from '../api/routes/document';
import { FaFilePdf, FaFileWord, FaFileExcel, FaFilePowerpoint, FaFileImage, FaFileLines, FaFileZipper, FaFile } from 'react-icons/fa6';

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
      case 'odt':
        return <FaFileWord className="text-blue-600" />;
      case 'xls':
      case 'xlsx':
      case 'csv':
      case 'ods':
        return <FaFileExcel className="text-green-600" />;
      case 'ppt':
      case 'pptx':
      case 'odp':
        return <FaFilePowerpoint className="text-orange-600" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
        return <FaFileImage className="text-sky-600" />;
      case 'txt':
      case 'rtf':
        return <FaFileLines className="text-slate-500" />;
      case 'zip':
        return <FaFileZipper className="text-amber-600" />;
      default:
        return <FaFile />;
    }
  };
  function searchDocument(e) {
    e.preventDefault()
    const value = e.target.value;
    const copyDos = [...documents];
    if (value!=="") {
      
      const match = copyDos.filter((d)=>String(d.titre_document).toLocaleLowerCase().includes(value.toLocaleLowerCase()));
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
    <div className='w-full py-6'>
      <Breadcrumbs where={"Documents"} />
      <h2 className='text-2xl font-semibold text-foreground mt-1 mb-6'>Documents</h2>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className='relative w-full sm:w-64'>
          <LuSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' size={16} />
          <input
            type="text"
            onChange={searchDocument}
            className="w-full rounded-lg bg-muted border-none pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            placeholder="Chercher un document..."
          />
        </div>
        <ViewToggleButtons view={view} setView={setView} />
      </div>
      {view === 'grid' ? (
        <DocumentGrid documents={currentDocuments} getFileIcon={getFileIcon} onChanged={fetchDocuments} />
      ) : (
        <DocumentList documents={currentDocuments} getFileIcon={getFileIcon} onChanged={fetchDocuments} />
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
