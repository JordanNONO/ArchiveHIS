import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { getDisplayName } from './common';
import hisLogo from '../assets/his-logo.png';
import { chargerImageDataUrl } from './pdfImages';

function personneConcernee(a) {
  if (a.personnel_concerne) return `${a.personnel_concerne.prenom || ''} ${a.personnel_concerne.nom || ''}`.trim();
  return a.personne_concernee_texte || '';
}

function nomAgent(a) {
  return getDisplayName({ personnel: a.utilisateur?.personnels?.[0] }) || a.utilisateur?.nom || '';
}

function formatDate(valeur) {
  if (!valeur) return '';
  return new Date(valeur).toLocaleDateString('fr-FR');
}

/**
 * Colonnes "papier" : sous-ensemble lisible pour un PDF paysage A4 — même
 * principe que exportCourriers.js (colonnesPdf), l'export Excel garde tous
 * les champs.
 */
export function colonnesPdf(t) {
  return [
    { label: t('appelsTelephoniques.colDate'), valeur: (a) => formatDate(a.date_appel) },
    { label: t('appelsTelephoniques.colHeure'), valeur: (a) => a.heure_appel },
    { label: t('appelsTelephoniques.colAppelant'), valeur: (a) => a.appelant_nom },
    { label: t('appelsTelephoniques.colTelephone'), valeur: (a) => a.appelant_telephone },
    { label: t('appelsTelephoniques.colOrganisation'), valeur: (a) => a.appelant_organisation },
    { label: t('appelsTelephoniques.colObjet'), valeur: (a) => a.objet },
    { label: t('appelsTelephoniques.colPersonneConcernee'), valeur: (a) => personneConcernee(a) },
    { label: t('appelsTelephoniques.colAction'), valeur: (a) => a.action },
  ];
}

/** Export Excel : littéralement tous les champs du registre des appels. */
export function colonnesExcel(t) {
  return [
    { label: t('appelsTelephoniques.colDate'), valeur: (a) => formatDate(a.date_appel) },
    { label: t('appelsTelephoniques.colHeure'), valeur: (a) => a.heure_appel },
    { label: t('appelsTelephoniques.colAgent'), valeur: (a) => nomAgent(a) },
    { label: t('appelsTelephoniques.colAppelant'), valeur: (a) => a.appelant_nom },
    { label: t('appelsTelephoniques.colTelephone'), valeur: (a) => a.appelant_telephone },
    { label: t('appelsTelephoniques.colOrganisation'), valeur: (a) => a.appelant_organisation },
    { label: t('appelsTelephoniques.colQualite'), valeur: (a) => a.appelant_qualite },
    { label: t('appelsTelephoniques.colEmail'), valeur: (a) => a.appelant_email },
    { label: t('appelsTelephoniques.colObjet'), valeur: (a) => a.objet },
    { label: t('appelsTelephoniques.colMessage'), valeur: (a) => a.message },
    { label: t('appelsTelephoniques.colPersonneConcernee'), valeur: (a) => personneConcernee(a) },
    { label: t('appelsTelephoniques.colAction'), valeur: (a) => a.action },
    { label: t('appelsTelephoniques.colTraite'), valeur: (a) => a.traite_le ? formatDate(a.traite_le) : '' },
  ];
}

/**
 * Tableau dessiné à la main, même gabarit que exporterCourriersPdf() —
 * en-tête répété à chaque page, colonnes de largeur égale.
 */
export async function exporterAppelsPdf(appels, colonnes, titre) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const marge = 10;
  const largeurPage = doc.internal.pageSize.getWidth();
  const hauteurPage = doc.internal.pageSize.getHeight();
  const largeurUtile = largeurPage - marge * 2;
  const largeurCol = largeurUtile / colonnes.length;
  let y = 15;

  // Filigrane HIS — même traitement que exportCourriers.js : logo centré en
  // transparence, sur chaque page.
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
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — ${appels.length} appel(s)`, marge, y);
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

  appels.forEach((a, index) => {
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
      const brut = col.valeur(a);
      const texte = brut === null || brut === undefined || brut === '' ? '—' : String(brut);
      doc.text(texte.length > 26 ? texte.slice(0, 25) + '…' : texte, marge + i * largeurCol + 1.5, y);
    });
    y += 5.5;
  });

  doc.save(`appels_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exporterAppelsExcel(appels, colonnes) {
  const lignes = appels.map((a) => {
    const ligne = {};
    colonnes.forEach((col) => { ligne[col.label] = col.valeur(a) ?? ''; });
    return ligne;
  });
  const feuille = XLSX.utils.json_to_sheet(lignes);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, 'Appels');
  XLSX.writeFile(classeur, `appels_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
