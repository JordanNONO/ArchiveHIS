import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FaFilePdf, FaFileWord, FaFileExcel, FaFilePowerpoint, FaFile } from 'react-icons/fa6';
import { getCategorieById } from '../api/routes/categorie';
import DocumentList from '../components/DocumentList';
import DocumentGrid from '../components/DocumentGrid';
import ViewToggleButtons from '../components/ViewToggleButtons';
import Breadcrumbs from '../components/Breadcrumbs';
import Pagination from '../components/Pagination';
function OpenFolder() {
    const {id} = useParams()
    const [documents, setDocuments] = useState([]);
    const [categorie, setCategorie] = useState({});
    const [view,setView] = useState('grid')
    const [currentPage, setCurrentPage] = useState(1);
    const documentsPerPage = 10;
    const fetchDocuments = () => {
        getCategorieById(id)
            .then(async (res) => {
                if (res.status === 200) {
                    const {documents,dossier} = await res.json();
                    setDocuments(documents);
                    setCategorie(dossier)
                }
            })
            .catch((err) => console.log(err));
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
    const indexOfLastDocument = currentPage * documentsPerPage;
  const indexOfFirstDocument = indexOfLastDocument - documentsPerPage;
  const currentDocuments = documents.slice(indexOfFirstDocument, indexOfLastDocument);

    return (
        <div className='w-full'>
      <Breadcrumbs where={categorie?.label} />
      <ViewToggleButtons view={view} setView={setView} />
      {view === 'grid' ? (
        <DocumentGrid documents={currentDocuments} getFileIcon={getFileIcon} />
      ) : (
        <DocumentList documents={currentDocuments} getFileIcon={getFileIcon} />
      )}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(documents.length / documentsPerPage)}
        onPageChange={setCurrentPage}
      />
    </div>
    );
}

export default OpenFolder