import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Polyfill pour les navigateurs plus anciens (ex: Firefox < 121, Chrome < 119)
// qui ne connaissent pas encore Promise.withResolvers — utilisé en interne par
// pdfjs-dist pour l'affichage des PDF, sans quoi la visionneuse plante.
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Clic sur une notification système alors que cet onglet est déjà ouvert mais
// pas (encore) contrôlé par sw.js : le service worker ne peut pas le faire
// naviguer lui-même et nous envoie l'adresse. On reste dans CE même onglet,
// où la connexion est déjà active (voir ouvrir() dans public/sw.js).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, url } = event.data || {};
    if (type !== 'his-naviguer' || typeof url !== 'string') return;
    try {
      const cible = new URL(url, window.location.origin);
      if (cible.origin === window.location.origin) window.location.assign(cible.href);
    } catch { /* adresse illisible, on ignore */ }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
