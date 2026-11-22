import { useEffect, useMemo, useState } from 'react';

/**
 * Filigrane posé sur un document ouvert — demande explicite 2026-11-22.
 *
 * Nom de la personne connectée + date et heure, en diagonale, répétés et
 * très clairs : une capture d'écran envoyée sur WhatsApp montre d'où elle
 * vient. Le téléphone ne prévient jamais une application web d'une capture,
 * c'est donc ce marquage permanent qui dissuade.
 *
 * pointer-events-none : il ne gêne ni le défilement, ni le zoom, ni les
 * clics sur le document. Le parent doit être en position relative.
 */
function libelleUtilisateur() {
  try {
    const u = JSON.parse(sessionStorage.getItem('user') || '{}');
    const p = u.personnel || {};
    const nom = [p.prenom, p.nom].filter(Boolean).join(' ').trim();
    return nom || u.nom || u.mail || '';
  } catch {
    return '';
  }
}

function horodatage() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function echapper(texte) {
  return texte.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default function FiligraneConfidentiel({ fixe = false }) {
  const [heure, setHeure] = useState(horodatage);

  // L'heure suit la consultation : une capture faite 40 minutes plus tard
  // porte la bonne heure.
  useEffect(() => {
    const minuterie = setInterval(() => setHeure(horodatage()), 60000);
    return () => clearInterval(minuterie);
  }, []);

  const fond = useMemo(() => {
    const nom = echapper(libelleUtilisateur());
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">`
      + `<g transform="rotate(-30 160 100)" fill="#6b7280" fill-opacity="0.16" font-family="Arial, sans-serif" text-anchor="middle">`
      + `<text x="160" y="96" font-size="17" font-weight="700">${nom}</text>`
      + `<text x="160" y="118" font-size="13">${echapper(heure)}</text>`
      + `</g></svg>`;
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }, [heure]);

  return (
    <div
      aria-hidden='true'
      className={`${fixe ? 'fixed' : 'absolute'} inset-0 z-[5] pointer-events-none select-none`}
      style={{ backgroundImage: fond, backgroundRepeat: 'repeat' }}
    />
  );
}
