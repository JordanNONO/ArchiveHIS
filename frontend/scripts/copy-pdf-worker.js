// Copie le worker pdfjs-dist dans public/ après chaque install — auto-hébergé
// plutôt que chargé depuis un CDN (voir components/PdfPageViewer.jsx),
// cohérent avec le reste de l'app. Node pur (pas de commande shell) pour
// rester portable entre postes de dev (Windows/Mac/Linux) et CI.
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const destination = path.join(__dirname, '..', 'public', 'pdf.worker.min.mjs');

try {
  fs.copyFileSync(source, destination);
  console.log('pdf.worker.min.mjs copié dans public/');
} catch (error) {
  console.warn('Impossible de copier pdf.worker.min.mjs (visionneuse PDF page par page indisponible) :', error.message);
}
