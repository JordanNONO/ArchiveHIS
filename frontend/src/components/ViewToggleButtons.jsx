import React from 'react';
import { IoApps, IoList } from 'react-icons/io5';

const ViewToggleButtons = ({ view, setView }) => (
  <div className='inline-flex items-center gap-1 rounded-lg bg-muted p-1'>
    <button
      onClick={() => setView('grid')}
      className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${view === 'grid' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <IoApps size={16} />
    </button>
    <button
      onClick={() => setView('list')}
      className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${view === 'list' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <IoList size={16} />
    </button>
  </div>
);

export default ViewToggleButtons;
