/**
 * Point de décision UNIQUE de la visionneuse : à partir d'un nom de fichier
 * (et du type réel enregistré en base), dire comment afficher le document.
 *
 * Avant, chaque extension avait son `case` dans DocView.jsx et tout ce qui
 * n'y figurait pas tombait sur « format non pris en charge » — y compris des
 * fichiers Excel parfaitement lisibles par OnlyOffice, déjà intégré par
 * ailleurs. Une seule table, une seule règle.
 */

export const GENRES_FICHIER = [
  // Bureautique : ouvert par le serveur OnlyOffice (voir ApercuOffice.jsx).
  { genre: 'office', extensions: ['docx', 'doc', 'odt', 'rtf', 'xlsx', 'xls', 'ods', 'csv', 'pptx', 'ppt', 'odp'] },
  { genre: 'pdf', extensions: ['pdf'] },
  { genre: 'image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
  { genre: 'video', extensions: ['mp4', 'webm', 'mov'] },
  { genre: 'audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] },
  { genre: 'archive', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] },
  // `txt` reste affiché tel quel plutôt que via OnlyOffice : un fichier texte
  // n'a pas de mise en forme à restituer, et l'iframe est instantanée.
  { genre: 'texte', extensions: ['txt'] },
];

/** Intitulé propre d'une archive, pour ne pas afficher un simple « .7Z ». */
export const LIBELLES_ARCHIVE = {
  zip: 'Archive ZIP',
  rar: 'Archive RAR',
  '7z': 'Archive 7-Zip',
  tar: 'Archive TAR',
  gz: 'Archive GZIP',
};

/** `documentType` attendu par OnlyOffice, déduit de l'extension. */
export const TYPE_ONLYOFFICE = {
  xlsx: 'cell', xls: 'cell', ods: 'cell', csv: 'cell',
  docx: 'word', doc: 'word', odt: 'word', rtf: 'word',
  pptx: 'slide', ppt: 'slide', odp: 'slide',
};

/** Extension en minuscules, prise après le DERNIER point. */
export function extensionDe(nom) {
  const s = String(nom || '');
  const i = s.lastIndexOf('.');
  return i > 0 ? s.slice(i + 1).toLowerCase() : '';
}

/**
 * `nom` : nom de fichier d'origine (porte l'extension fiable).
 * `extensionSecours` : extension déduite du chemin de stockage, utilisée
 * quand le nom d'origine manque sur les documents anciens.
 *
 * Renvoie { extension, genre, libelle } — `libelle` est ce qu'on montre à
 * l'utilisateur quand le fichier n'a pas d'aperçu.
 */
export function genreFichier(nom, extensionSecours = '') {
  const extension = extensionDe(nom) || String(extensionSecours || '').toLowerCase();
  const trouve = GENRES_FICHIER.find((g) => g.extensions.includes(extension));
  const genre = trouve ? trouve.genre : 'autre';

  return {
    extension,
    genre,
    libelle: genre === 'archive'
      ? (LIBELLES_ARCHIVE[extension] || `Archive .${extension.toUpperCase()}`)
      : (extension ? `Fichier .${extension.toUpperCase()}` : 'Fichier'),
  };
}
