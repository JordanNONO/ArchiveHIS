import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import hisLogo from '../assets/his-logo.png';
import { chargerImageDataUrl } from './pdfImages';
import { SECTIONS_FLUCTUATION, cleLibelleChamp, formatDateCourte, libelleMois } from '../constants/fluctuationRh';

function valeurChamp(ligne, champ) {
  const v = ligne[champ];
  if (v === null || v === undefined || v === '') return '';
  if (champ === 'date_debut' || champ === 'date_fin') return formatDateCourte(v);
  if (champ === 'montant') {
    // Espace normale à la place de l'espace fine insécable de fr-FR (non
    // gérée par la police Helvetica de jsPDF, voir exportCheques.js).
    return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ') + ' €';
  }
  return String(v);
}

/** Sections non vides, dans l'ordre du tableur, avec leurs lignes. */
function sectionsRemplies(lignes) {
  return SECTIONS_FLUCTUATION
    .map((s) => ({ ...s, lignes: lignes.filter((l) => l.section === s.cle) }))
    .filter((s) => s.lignes.length > 0);
}

/**
 * Même présentation que l'onglet du Google Sheet d'origine : titre de
 * section, ligne d'en-tête "N° | Salarié | ...", lignes, ligne vide.
 */
export function exporterFluctuationExcel(lignes, mois, t) {
  const aoa = [[`${t('fluctuationRh.titre')} — ${libelleMois(mois)}`], []];
  for (const s of sectionsRemplies(lignes)) {
    aoa.push([t(`fluctuationRh.section_${s.cle}`).toUpperCase()]);
    aoa.push(['N°', ...s.champs.map((c) => t(`fluctuationRh.${cleLibelleChamp(s.cle, c)}`))]);
    s.lignes.forEach((l, i) => aoa.push([i + 1, ...s.champs.map((c) => valeurChamp(l, c))]));
    aoa.push([]);
  }
  const feuille = XLSX.utils.aoa_to_sheet(aoa);
  feuille['!cols'] = [{ wch: 5 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 40 }];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, libelleMois(mois).slice(0, 31));
  XLSX.writeFile(classeur, `fluctuation_rh_${mois}.xlsx`);
}

/** PDF A4 paysage, une section après l'autre, en-tête de colonnes répété à chaque saut de page. */
export async function exporterFluctuationPdf(lignes, mois, t, statutLibelle) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const marge = 12;
  const largeurPage = doc.internal.pageSize.getWidth();
  const hauteurPage = doc.internal.pageSize.getHeight();
  const largeurUtile = largeurPage - marge * 2;
  // Position verticale partagée par les fonctions de dessin (objet const
  // plutôt qu'un let modifié dans la boucle des sections, voir no-loop-func).
  const curseur = { y: 16 };

  const logoDataUrl = await chargerImageDataUrl(hisLogo, 480);
  function dessinerFiligrane() {
    if (!logoDataUrl) return;
    const l = 120;
    const h = l * (1767 / 2755);
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    doc.addImage(logoDataUrl, 'PNG', (largeurPage - l) / 2, (hauteurPage - h) / 2, l, h);
    doc.setGState(new doc.GState({ opacity: 1 }));
  }
  function nouvellePageSiBesoin(hauteur) {
    if (curseur.y + hauteur > hauteurPage - 12) {
      doc.addPage();
      dessinerFiligrane();
      curseur.y = 16;
      return true;
    }
    return false;
  }

  dessinerFiligrane();
  doc.setFontSize(15);
  doc.setTextColor(27, 54, 93);
  doc.text(`${t('fluctuationRh.titre')} — ${libelleMois(mois)}`, marge, curseur.y);
  curseur.y += 6;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`${statutLibelle} · ${t('fluctuationRh.pdfGenereLe', { date: new Date().toLocaleDateString('fr-FR') })} · ${t('fluctuationRh.nLignes', { count: lignes.length })}`, marge, curseur.y);
  doc.setTextColor(0);
  curseur.y += 8;

  for (const s of sectionsRemplies(lignes)) {
    // Largeurs : N° étroit, salarié et observations plus larges.
    const poids = s.champs.map((c) => (c === 'salarie' ? 2.2 : c === 'observations' ? 3 : c === 'motif' ? 2.2 : 1.2));
    const total = 0.5 + poids.reduce((a, b) => a + b, 0);
    const largeurs = [0.5, ...poids].map((p) => (p / total) * largeurUtile);

    function entete() {
      doc.setFillColor(238, 242, 247);
      doc.rect(marge, curseur.y - 4, largeurUtile, 6, 'F');
      doc.setFont(undefined, 'bold');
      doc.setFontSize(7.5);
      let x = marge;
      ['N°', ...s.champs.map((c) => t(`fluctuationRh.${cleLibelleChamp(s.cle, c)}`))].forEach((libelle, i) => {
        doc.text(libelle, x + 1.5, curseur.y);
        x += largeurs[i];
      });
      doc.setFont(undefined, 'normal');
      curseur.y += 5.5;
    }

    nouvellePageSiBesoin(20);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(27, 54, 93);
    doc.text(`${t(`fluctuationRh.section_${s.cle}`)} (${s.lignes.length})`, marge, curseur.y);
    doc.setTextColor(0);
    doc.setFont(undefined, 'normal');
    curseur.y += 5;
    entete();

    s.lignes.forEach((l, index) => {
      doc.setFontSize(7.5);
      const cellules = [String(index + 1), ...s.champs.map((c) => valeurChamp(l, c))];
      const morceaux = cellules.map((texte, i) => doc.splitTextToSize(texte || '—', largeurs[i] - 3).slice(0, 4));
      const hauteur = Math.max(...morceaux.map((m) => m.length)) * 3.4 + 1.6;
      if (nouvellePageSiBesoin(hauteur)) entete();
      if (index % 2 === 1) {
        doc.setFillColor(248, 249, 251);
        doc.rect(marge, curseur.y - 3.6, largeurUtile, hauteur, 'F');
      }
      let x = marge;
      morceaux.forEach((m, i) => {
        doc.text(m, x + 1.5, curseur.y);
        x += largeurs[i];
      });
      curseur.y += hauteur;
    });
    curseur.y += 5;
  }

  doc.save(`fluctuation_rh_${mois}.pdf`);
}
