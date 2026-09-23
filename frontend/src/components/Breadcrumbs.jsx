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
    <div className='flex items-center gap-1.5 flex-wrap'>
      <button
        onClick={goBack}
        title='Retour'
        className='flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors shrink-0'
      >
        <LuArrowLeft size={14} />
      </button>
      <Link
        to="/"
        className='text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors'
      >
        HIS Archives
      </Link>
      <span className='text-muted-foreground/50 text-xs'>›</span>
      <span className='text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/20 text-primary'>
        {where}
      </span>
    </div>
  );
};

export default Breadcrumbs;
