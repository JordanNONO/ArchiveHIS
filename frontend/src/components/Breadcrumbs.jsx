import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuArrowLeft } from 'react-icons/lu';

const Breadcrumbs = ({ where, backTo }) => {
  const navigate = useNavigate();

  function goBack() {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  }

  return (
    <div className='flex items-center gap-2'>
      <button
        onClick={goBack}
        title='Retour'
        className='flex items-center justify-center w-7 h-7 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0'
      >
        <LuArrowLeft size={14} />
      </button>
      <div className="breadcrumbs text-sm text-muted-foreground py-0 min-h-0">
        <ul>
          <li><Link to="/" className="hover:text-primary transition-colors">HIS Archives</Link></li>
          <li className="text-foreground font-medium">{where}</li>
        </ul>
      </div>
    </div>
  );
};

export default Breadcrumbs;
