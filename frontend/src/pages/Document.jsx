import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LuSearch } from 'react-icons/lu';
import Breadcrumbs from '../components/Breadcrumbs';
import ViewToggleButtons from '../components/ViewToggleButtons';
import DocumentGrid from '../components/DocumentGrid';
import DocumentList from '../components/DocumentList';
import Pagination from '../components/Pagination';
import { getDocument } from '../api/routes/document';
import { correspondARequete } from '../utils/recherche';
import { useGrillePagination } from '../hooks/useGrillePagination';
import { FaFilePdf, FaFileWord, FaFileExcel, FaFilePowerpoint, FaFileImage, FaFileLines, FaFileZipper, FaFile } from 'react-icons/fa6';

function Document() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState([]);
  const [view, setView] = useState(searchParams.get('vue') || 'grid');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  // En grille, autant de documents que l'écran peut en afficher (voir
  // useGrillePagination) ; la liste garde ses 12 lignes.
  const grille = useGrillePagination();
  const documentsPerPage = view === 'grid' ? grille.parPage : 12;
  // Le texte tapé vivait seulement dans le DOM de l'input (non contrôlé),
  // jamais en état — ouvrir un document (démonte cette page) le perdait pour
  // de vrai, impossible à restaurer au retour (retour utilisateur : "c'est
  // comme ça partout"). Vit maintenant dans l'URL, comme OpenFolder.jsx.
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const fetchDocuments = async () => {
    try {
      const res = await getDocument();
      if (res.status === 200) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des documents:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    const params = {};
    if (view !== 'grid') params.vue = view;
    if (searchTerm) params.q = searchTerm;
    if (currentPage !== 1) params.page = String(currentPage);
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, searchTerm, currentPage]);

  // Même comportement qu'avant (repli sur la liste complète si 0 résultat),
  // juste recalculé à partir de documents/searchTerm au lieu d'un state à
  // part tenu à jour à la main — searchTerm doit pouvoir être restauré
  // depuis l'URL sans dépendre d'un événement onChange pour exister.
  const searchValue = useMemo(() => {
    if (!searchTerm.trim()) return documents;
    const match = documents.filter((d) => correspondARequete([d.titre_document], searchTerm));
    return match.length > 0 ? match : documents;
  }, [documents, searchTerm]);

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
    setSearchTerm(e.target.value);
  }

  // Agrandir la fenêtre réduit le nombre de pages : on ne reste pas bloqué sur
  // une page qui n'existe plus.
  const totalPages = Math.ceil(searchValue.length / documentsPerPage);
  const pageAffichee = Math.max(1, Math.min(currentPage, totalPages));
  const indexOfLastDocument = pageAffichee * documentsPerPage;
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
            value={searchTerm}
            onChange={searchDocument}
            className="w-full rounded-lg bg-muted border-none pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            placeholder="Chercher un document..."
            title='Astuce : "phrase exacte" entre guillemets, mot1 OU mot2 — fautes de frappe tolérées'
          />
        </div>
        <ViewToggleButtons view={view} setView={setView} />
      </div>
      <div ref={grille.ref}>
        {view === 'grid' ? (
          <DocumentGrid documents={currentDocuments} getFileIcon={getFileIcon} onChanged={fetchDocuments} colonnes={grille.colonnes} />
        ) : (
          <DocumentList documents={currentDocuments} getFileIcon={getFileIcon} onChanged={fetchDocuments} />
        )}
      </div>
      <Pagination
        currentPage={pageAffichee}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

export default Document;
