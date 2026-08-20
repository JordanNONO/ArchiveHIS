import React, { useEffect, useState } from 'react';
import { LuX, LuFileQuestion, LuLoader2 } from 'react-icons/lu';
import { getDocumentLienFichier } from '../api/routes/document';
import PdfPageViewer from './PdfPageViewer';
import StatutBadge from './StatutBadge';

/**
 * Panneau latéral d'aperçu d'un document — un clic sur une tuile (DocumentGrid)
 * ou une ligne (DocumentList) affiche son contenu réel ici (première page pour
 * un PDF via PdfPageViewer déjà utilisé par DocView.jsx, l'image elle-même
 * pour une photo) sans ouvrir la fiche complète. Uniquement pour les
 * documents — un dossier continue de s'ouvrir normalement au clic.
 */
function DocumentApercuPanel({ document: doc, onClose }) {
  const [lien, setLien] = useState(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (!doc) {
      setLien(null);
      return;
    }
    setChargement(true);
    setLien(null);
    getDocumentLienFichier(doc.id).then(async (res) => {
      if (res.status === 200) setLien(await res.json());
    }).catch((err) => console.log(err)).finally(() => setChargement(false));
  }, [doc]);

  if (!doc) return null;

  const extension = String(doc.chemin_stockage_serveur).split('.').pop().toLowerCase();
  const taille = doc.taille > 1024 * 1024 ? `${(doc.taille / (1024 * 1024)).toFixed(2)} Mo` : `${((doc.taille ?? 0) / 1024).toFixed(2)} Ko`;

  function contenu() {
    if (chargement || !lien) {
      return (
        <div className='flex items-center justify-center h-56'>
          <LuLoader2 className='animate-spin text-muted-foreground' size={24} />
        </div>
      );
    }
    if (extension === 'pdf') {
      return <PdfPageViewer url={lien.affichage} />;
    }
    if (['jpg', 'jpeg', 'png'].includes(extension)) {
      return <img src={lien.affichage} alt={doc.titre_document} className='w-full max-h-[75vh] object-contain rounded-lg bg-muted' />;
    }
    return (
      <div className='flex flex-col items-center gap-2 py-14 text-muted-foreground'>
        <LuFileQuestion size={28} strokeWidth={1.5} />
        <span className='text-xs'>Aperçu non disponible pour ce type de fichier</span>
      </div>
    );
  }

  return (
    // 640px sur grand écran (288px à l'origine, 480px insuffisant encore
    // signalé) : le cadre étroit rendait un PDF quasi illisible —
    // PdfPageViewer s'adapte automatiquement à la largeur disponible, donc
    // l'élargir suffit à réellement voir le contenu.
    <div className='w-full lg:w-[640px] shrink-0 rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto'>
      <div className='flex items-start justify-between gap-2'>
        <p className='text-sm font-semibold text-foreground truncate' title={doc.titre_document}>{doc.titre_document}</p>
        <button onClick={onClose} className='flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0'>
          <LuX size={14} />
        </button>
      </div>
      {contenu()}
      <div className='flex items-center justify-between text-xs text-muted-foreground'>
        <span>{extension.toUpperCase()} · {taille}</span>
        <StatutBadge statut={doc.status_doc} className='!px-1.5 !py-0.5 !text-[10px]' />
      </div>
    </div>
  );
}

export default DocumentApercuPanel;
