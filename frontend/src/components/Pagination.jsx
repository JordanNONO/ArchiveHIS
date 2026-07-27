import React from 'react';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1 mt-6">
      {Array.from({ length: totalPages }, (_, index) => (
        <button
          key={index}
          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === index + 1 ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
          onClick={() => onPageChange(index + 1)}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
};

export default Pagination;
