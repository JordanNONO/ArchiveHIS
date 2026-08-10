// Classes Tailwind partagées pour le réglage "Taille des tuiles" de la barre
// d'outils (voir DossierToolbar.jsx) — un seul endroit pour Home.jsx et
// OpenFolder.jsx, qui utilisent toutes les deux des grilles de tuiles h-[…]px.
export const DENSITE_HAUTEUR = { compact: 'h-[128px]', normal: 'h-[172px]', grand: 'h-[210px]' };

export const DENSITE_COLS = {
  compact: 'grid lg:grid-cols-6 md:grid-cols-4 sm:grid-cols-3 grid-cols-2 gap-3 w-full',
  normal: 'grid lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-2 gap-4 w-full',
  grand: 'grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4 w-full',
};
