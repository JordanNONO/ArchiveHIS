import React from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

// Première, dernière, page courante et ses voisines directes — au-delà, un
// "…" plutôt qu'un bouton par page (sinon une liste de 40 pages devient
// injustement large et illisible).
function pagesAAfficher(currentPage, totalPages) {
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  const pages = pagesAAfficher(currentPage, totalPages);

  return (
    <div className="flex items-center gap-1.5 mt-6">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <LuChevronLeft size={16} />
      </button>

      {pages.map((page, index) => {
        const precedent = pages[index - 1];
        const saut = precedent != null && page - precedent > 1;
        return (
          <React.Fragment key={page}>
            {saut && <span className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">…</span>}
            <button
              type="button"
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${currentPage === page ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
            >
              {page}
            </button>
          </React.Fragment>
        );
      })}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <LuChevronRight size={16} />
      </button>
    </div>
  );
};

export default Pagination;
