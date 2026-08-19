import React, { useEffect, useRef, useState } from 'react';
import { init } from 'pptx-preview';
import { LuLoader2, LuAlertTriangle, LuChevronLeft, LuChevronRight } from 'react-icons/lu';

/**
 * Aperçu PowerPoint — rendu réel des diapositives (texte, images, mise en
 * page) via pptx-preview. Remplace l'ancienne version qui se contentait
 * d'extraire le JSON brut des diapositives et de l'afficher tel quel
 * (illisible) — voir git history.
 *
 * Une diapositive à la fois, comme PdfPageViewer.jsx pour les PDF — pas les
 * calculer/rendre toutes au chargement : pour un fichier volumineux (images
 * en haute résolution par diapositive), ça bloquait l'interface plusieurs
 * secondes avant le moindre affichage. On charge le fichier (analyse seule,
 * rapide), on affiche juste la diapositive courante, et Précédent/Suivant
 * n'en calculent qu'une nouvelle à chaque fois.
 */
const PptxReader = ({ fileUrl }) => {
  const conteneurRef = useRef(null);
  const previewerRef = useRef(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur(false);
    setIndex(0);
    setTotal(0);

    fetch(fileUrl)
      .then((reponse) => reponse.arrayBuffer())
      .then(async (buffer) => {
        if (annule || !conteneurRef.current) return;
        conteneurRef.current.innerHTML = '';
        const largeur = Math.min(conteneurRef.current.clientWidth || 900, 960);
        const previewer = init(conteneurRef.current, {
          width: largeur,
          height: Math.round(largeur * 9 / 16),
          mode: 'slide',
        });
        previewerRef.current = previewer;

        await previewer.load(buffer);
        if (annule) return;

        if (!previewer.slideCount) {
          setErreur(true);
          return;
        }

        previewer.renderSingleSlide(0);
        setTotal(previewer.slideCount);
      })
      .catch(() => { if (!annule) setErreur(true); })
      .finally(() => { if (!annule) setChargement(false); });

    return () => {
      annule = true;
      try { previewerRef.current?.destroy(); } catch { /* déjà détruit */ }
      previewerRef.current = null;
    };
  }, [fileUrl]);

  function allerA(nouvelIndex) {
    const previewer = previewerRef.current;
    if (!previewer || nouvelIndex < 0 || nouvelIndex >= total) return;
    previewer.removeCurrentSlide();
    previewer.renderSingleSlide(nouvelIndex);
    setIndex(nouvelIndex);
  }

  return (
    <div className='w-full flex flex-col items-center gap-3'>
      {chargement && (
        <div className='flex flex-col items-center justify-center gap-3 h-[50vh] w-full'>
          <LuLoader2 className='animate-spin text-muted-foreground' size={28} />
          <p className='text-sm text-muted-foreground'>Génération de l'aperçu…</p>
        </div>
      )}

      {erreur && (
        <div className='flex flex-col items-center justify-center gap-2 h-[30vh] w-full text-center text-muted-foreground'>
          <LuAlertTriangle size={24} />
          <p className='text-sm'>L'aperçu de ce fichier PowerPoint n'a pas pu être généré. Téléchargez-le pour l'ouvrir.</p>
        </div>
      )}

      <div
        id='pptx-preview-container'
        ref={conteneurRef}
        className={`w-full max-w-[960px] rounded-lg border border-border bg-muted/30 overflow-hidden ${chargement || erreur ? 'hidden' : ''}`}
      />

      {!chargement && !erreur && total > 1 && (
        <div className='flex items-center gap-3'>
          <button
            type='button'
            disabled={index <= 0}
            onClick={() => allerA(index - 1)}
            className='flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
          >
            <LuChevronLeft size={16} />
          </button>
          <span className='text-sm font-medium text-muted-foreground tabular-nums'>Diapositive {index + 1} / {total}</span>
          <button
            type='button'
            disabled={index >= total - 1}
            onClick={() => allerA(index + 1)}
            className='flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
          >
            <LuChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PptxReader;
