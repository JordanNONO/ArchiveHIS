import React, { useState, useEffect, useRef, useCallback } from 'react';
import mammoth from 'mammoth';

/**
 * `onFinAtteinte` (optionnel) : signale que l'utilisateur a défilé jusqu'en
 * bas du document — via un onScroll sur le propre conteneur défilant de ce
 * composant (contrairement au PDF en plein écran, ce div n'est jamais le
 * conteneur parent de DocView.jsx, donc pas besoin d'IntersectionObserver ici).
 * Si le document est assez court pour tenir sans défiler, considéré lu dès
 * son affichage (sinon onFinAtteinte ne se déclencherait jamais).
 */
const DocxReader = ({ fileUrl, onFinAtteinte }) => {
  const [content, setContent] = useState('');
  const conteneurRef = useRef(null);
  const finDejaSignaleeRef = useRef(false);

  useEffect(() => {
    finDejaSignaleeRef.current = false;
    fetch(fileUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          mammoth.convertToHtml({ arrayBuffer: e.target.result })
            .then((result) => setContent(result.value))
            .catch((err) => console.error(err));
        };
        reader.readAsArrayBuffer(blob);
      })
      .catch((err) => console.error(err));
  }, [fileUrl]);

  const signalerSiFin = useCallback(() => {
    const el = conteneurRef.current;
    if (!el || finDejaSignaleeRef.current) return;
    const procheDuBas = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (procheDuBas) {
      finDejaSignaleeRef.current = true;
      onFinAtteinte?.();
    }
  }, [onFinAtteinte]);

  // Document assez court pour tenir sans défiler : déjà entièrement visible.
  useEffect(() => {
    if (content) signalerSiFin();
  }, [content, signalerSiFin]);

  return <div>
    <div ref={conteneurRef} onScroll={signalerSiFin} className='max-h-[80vh] overflow-auto p-2 rounded-lg' dangerouslySetInnerHTML={{ __html: content }} />
  </div>;
};

export default DocxReader;
