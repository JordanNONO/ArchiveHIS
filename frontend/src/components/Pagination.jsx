import React from 'react';

const Pagination = ({ currentPage, totalPages, onPageChange }) => (
  <div className="join">
    {Array.from({ length: totalPages }, (_, index) => (
      <button
        key={index}
        className={`join-item btn ${currentPage === index + 1 ? 'btn-active' : ''}`}
        onClick={() => onPageChange(index + 1)}
      >
        {index + 1}
      </button>
    ))}
  </div>
);

export default Pagination;
