import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LuArrowLeft } from 'react-icons/lu';
import { GROUPES_NAVIGATION } from '../constants/navigation';

/**
 * Bouton retour en tête de page. Le nom de la page est déjà le titre de la
 * barre du haut (Navbar.jsx) : on ne le répète ici que sur une sous-page
 * (un dossier, un document, une fiche PAI…), où `where` apporte une vraie
 * précision. Rien du tout sur le tableau de bord, d'où l'on ne revient nulle
 * part.
 */
const Breadcrumbs = ({ where, backTo }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (pathname === '/') return null;
  const pagePrincipale = GROUPES_NAVIGATION.some((g) => g.liens.some((l) => l.to === pathname));

  return (
    <div className='flex items-center gap-1.5'>
      <button
        type='button'
        onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
        title='Retour'
        aria-label='Retour'
        className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground'
      >
        <LuArrowLeft size={14} />
      </button>
      {!pagePrincipale && where && (
        <span className='truncate rounded-full bg-accent/20 px-2.5 py-1 text-xs font-semibold text-primary'>{where}</span>
      )}
    </div>
  );
};

export default Breadcrumbs;
