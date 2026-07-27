import { FaFilePdf, FaFileWord, FaFileExcel, FaFilePowerpoint, FaFileImage, FaFileLines, FaFileZipper, FaFile } from 'react-icons/fa6';

const ICONS_BY_EXT = {
  pdf: { icon: FaFilePdf, tint: 'bg-destructive/10 text-destructive' },
  doc: { icon: FaFileWord, tint: 'bg-primary/10 text-primary' },
  docx: { icon: FaFileWord, tint: 'bg-primary/10 text-primary' },
  odt: { icon: FaFileWord, tint: 'bg-primary/10 text-primary' },
  xls: { icon: FaFileExcel, tint: 'bg-green-500/10 text-green-600' },
  xlsx: { icon: FaFileExcel, tint: 'bg-green-500/10 text-green-600' },
  csv: { icon: FaFileExcel, tint: 'bg-green-500/10 text-green-600' },
  ods: { icon: FaFileExcel, tint: 'bg-green-500/10 text-green-600' },
  ppt: { icon: FaFilePowerpoint, tint: 'bg-accent/20 text-accent-foreground' },
  pptx: { icon: FaFilePowerpoint, tint: 'bg-accent/20 text-accent-foreground' },
  odp: { icon: FaFilePowerpoint, tint: 'bg-accent/20 text-accent-foreground' },
  jpg: { icon: FaFileImage, tint: 'bg-sky-500/10 text-sky-600' },
  jpeg: { icon: FaFileImage, tint: 'bg-sky-500/10 text-sky-600' },
  png: { icon: FaFileImage, tint: 'bg-sky-500/10 text-sky-600' },
  txt: { icon: FaFileLines, tint: 'bg-muted text-muted-foreground' },
  rtf: { icon: FaFileLines, tint: 'bg-muted text-muted-foreground' },
  zip: { icon: FaFileZipper, tint: 'bg-amber-500/10 text-amber-600' },
};

/**
 * Icône + couleur associées à une extension de fichier (ou un chemin/nom de fichier).
 */
export function getFileTypeVisual(nameOrExtension) {
  const ext = String(nameOrExtension || '').split('.').pop()?.toLowerCase();
  return ICONS_BY_EXT[ext] || { icon: FaFile, tint: 'bg-muted text-muted-foreground' };
}

/**
 * Texte relatif court en français ("à l'instant", "il y a 2h", "il y a 3j"...).
 */
export function timeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString();
}
