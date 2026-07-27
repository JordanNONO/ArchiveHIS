import React from 'react';
import { Link } from 'react-router-dom';
import { LuFileQuestion } from 'react-icons/lu';

function NotFound() {
  return (
    <div className='flex flex-col items-center justify-center gap-3 w-full py-24 text-center'>
      <div className='flex items-center justify-center w-16 h-16 rounded-full bg-muted text-muted-foreground'>
        <LuFileQuestion size={28} />
      </div>
      <h2 className='text-xl font-semibold text-foreground mt-2'>Page introuvable</h2>
      <p className='text-sm text-muted-foreground max-w-sm'>
        La page que vous recherchez n'existe pas ou a été déplacée.
      </p>
      <Link
        to='/'
        className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors mt-3'
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}

export default NotFound;
