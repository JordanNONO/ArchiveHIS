import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { getDisplayName } from './common';
import hisLogo from '../assets/his-logo.png';
import { chargerImageDataUrl } from './pdfImages';

function nomAgent(c) {
  return getDisplayName({ personnel: c.utilisateur?.personnels?.[0] }) || c.utilisateur?.nom || '';
}

function formatDate(valeur) {
  if (!valeur) return '';
  return new Date(valeur).toLocaleDateString('fr-FR');
}

function formatMontant(v) {
  if (v === null || v === undefined || v === '') return '';
  // toLocaleString('fr-FR') sépare les milliers avec une espace fine
  // insécable (U+202F) — les polices standard de jsPDF (Helvetica) ne la
  // reconnaissent pas et affichent un caractère de remplacement à la place
  // (vu en PDF : "14/464,59" au lieu de "14 464,59"). Remplacée par une
  // espace normale, sans risque pour Excel/l'écran qui l'affichaient déjà
  // correctement de toute façon.
  return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ');
}

/**
 * Colonnes "papier" : sous-ensemble lisible pour un PDF paysage A4 — même
 * principe que exportAppels.js, l'export Excel garde tous les champs.
 */
export function colonnesPdf(t) {
  return [
    { label: t('cheques.colDateEmission'), valeur: (c) => formatDate(c.date_emission) },
    { label: t('cheques.colNumeroCheque'), valeur: (c) => c.numero_cheque },
    { label: t('cheques.colBanqueEmettrice'), valeur: (c) => c.banque_emettrice },
    { label: t('cheques.colEmetteur'), valeur: (c) => c.nom_emetteur },
    { label: t('cheques.colBanqueDepot'), valeur: (c) => c.banque_depot },
    { label: t('cheques.colMontant'), valeur: (c) => formatMontant(c.montant) },
    { label: t('cheques.colFactureReglee'), valeur: (c) => c.facture_reglee },
  ];
}

/** Export Excel : littéralement tous les champs du registre des chèques. */
export function colonnesExcel(t) {
  return [
    { label: t('cheques.colDateEmission'), valeur: (c) => formatDate(c.date_emission) },
    { label: t('cheques.colDateDepot'), valeur: (c) => formatDate(c.date_depot) },
    { label: t('cheques.colBordereau'), valeur: (c) => c.numero_bordereau_remise },
    { label: t('cheques.colBanqueDepot'), valeur: (c) => c.banque_depot },
    { label: t('cheques.colNumeroCheque'), valeur: (c) => c.numero_cheque },
    { label: t('cheques.colBanqueEmettrice'), valeur: (c) => c.banque_emettrice },
    { label: t('cheques.colEmetteur'), valeur: (c) => c.nom_emetteur },
    { label: t('cheques.colBeneficiaire'), valeur: (c) => c.nom_beneficiaire },
    { label: t('cheques.colMontant'), valeur: (c) => formatMontant(c.montant) },
    { label: t('cheques.colFactureReglee'), valeur: (c) => c.facture_reglee },
    { label: t('cheques.colAgent'), valeur: (c) => nomAgent(c) },
    { label: t('cheques.colTraite'), valeur: (c) => c.traite_le ? formatDate(c.traite_le) : '' },
    { label: t('cheques.colNoteTraitement'), valeur: (c) => c.note_traitement },
  ];
}

/**
 * Tableau dessiné à la main, même gabarit que exporterAppelsPdf() — en-tête
 * répété à chaque page, colonnes de largeur égale.
 */
export async function exporterChequesPdf(cheques, colonnes, titre) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const marge = 10;
  const largeurPage = doc.internal.pageSize.getWidth();
  const hauteurPage = doc.internal.pageSize.getHeight();
  const largeurUtile = largeurPage - marge * 2;
  const largeurCol = largeurUtile / colonnes.length;
  let y = 15;

  const logoDataUrl = await chargerImageDataUrl(hisLogo, 480);
  function dessinerFiligrane() {
    if (!logoDataUrl) return;
    const filigraneLargeur = 120;
    const filigraneHauteur = filigraneLargeur * (1767 / 2755);
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    doc.addImage(logoDataUrl, 'PNG', (largeurPage - filigraneLargeur) / 2, (hauteurPage - filigraneHauteur) / 2, filigraneLargeur, filigraneHauteur);
    doc.setGState(new doc.GState({ opacity: 1 }));
  }
  dessinerFiligrane();

  doc.setFontSize(14);
  doc.text(titre, marge, y);
  y += 7;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — ${cheques.length} chèque(s)`, marge, y);
  doc.setTextColor(0);
  y += 7;

  function dessinerEntete() {
    doc.setFillColor(235, 235, 240);
    doc.rect(marge, y - 4, largeurUtile, 6, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(7.5);
    colonnes.forEach((col, i) => doc.text(col.label, marge + i * largeurCol + 1.5, y));
    doc.setFont(undefined, 'normal');
    y += 6;
  }

  dessinerEntete();

  cheques.forEach((c, index) => {
    if (y > hauteurPage - 12) {
      doc.addPage();
      y = 15;
      dessinerFiligrane();
      dessinerEntete();
    }
    if (index % 2 === 1) {
      doc.setFillColor(248, 248, 250);
      doc.rect(marge, y - 4, largeurUtile, 5.5, 'F');
    }
    colonnes.forEach((col, i) => {
      const brut = col.valeur(c);
      const texte = brut === null || brut === undefined || brut === '' ? '—' : String(brut);
      doc.text(texte.length > 26 ? texte.slice(0, 25) + '…' : texte, marge + i * largeurCol + 1.5, y);
    });
    y += 5.5;
  });

  doc.save(`cheques_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exporterChequesExcel(cheques, colonnes) {
  const lignes = cheques.map((c) => {
    const ligne = {};
    colonnes.forEach((col) => { ligne[col.label] = col.valeur(c) ?? ''; });
    return ligne;
  });
  const feuille = XLSX.utils.json_to_sheet(lignes);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, 'Cheques');
  XLSX.writeFile(classeur, `cheques_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
