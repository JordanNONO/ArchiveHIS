import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

/**
 * Colonnes "papier" : un sous-ensemble lisible pour un PDF (13 colonnes
 * brutes sur une page A4, même en paysage, deviendrait illisible) — l'export
 * Excel, lui, garde tous les champs (voir COLONNES_EXCEL), une feuille de
 * calcul étant justement faite pour des données larges qu'on filtre/trie
 * soi-même ensuite.
 */
export function colonnesPdf(t) {
  return [
    { label: t('courriers.colSens'), valeur: (c) => c.sens_courrier === 'sortant' ? t('courrier.courrierSortant') : t('courrier.courrierEntrant') },
    { label: t('courriers.colDate'), valeur: (c) => formatDate(c.sens_courrier === 'sortant' ? c.date_envoi : c.date_reception) },
    { label: t('courriers.colReference'), valeur: (c) => c.code_reference },
    { label: t('courriers.colObjet'), valeur: (c) => c.objet || c.titre_document },
    { label: t('courriers.colCorrespondant'), valeur: (c) => c.sens_courrier === 'sortant' ? c.destinataire_nom : c.expediteur_nom },
    { label: t('courriers.colMontant'), valeur: (c) => c.montant ? `${Number(c.montant).toLocaleString('fr-FR')} €` : '' },
    { label: t('courriers.colEtat'), valeur: (c) => c.etat_courrier },
    { label: t('courriers.colAuteur'), valeur: (c) => c.auteur },
  ];
}

/** Export Excel : littéralement tous les champs propres au courrier. */
export function colonnesExcel(t) {
  return [
    { label: t('courriers.colSens'), valeur: (c) => c.sens_courrier === 'sortant' ? t('courrier.courrierSortant') : t('courrier.courrierEntrant') },
    { label: t('courriers.colReference'), valeur: (c) => c.code_reference },
    { label: t('courriers.colObjet'), valeur: (c) => c.objet || c.titre_document },
    { label: t('courriers.colTypeEnvoi'), valeur: (c) => c.type_envoi },
    { label: t('courriers.colNumeroRecommande'), valeur: (c) => c.numero_recommande },
    { label: t('courriers.colExpediteur'), valeur: (c) => c.expediteur_nom },
    { label: t('courriers.colAdresseExpediteur'), valeur: (c) => c.expediteur_adresse },
    { label: t('courriers.colDestinataire'), valeur: (c) => c.destinataire_nom },
    { label: t('courriers.colAdresseDestinataire'), valeur: (c) => c.destinataire_adresse },
    { label: t('courriers.colDateEnvoi'), valeur: (c) => formatDate(c.date_envoi) },
    { label: t('courriers.colDateReception'), valeur: (c) => formatDate(c.date_reception) },
    { label: t('courriers.colNbDocuments'), valeur: (c) => c.nombre_documents },
    { label: t('courriers.colMontant'), valeur: (c) => c.montant ?? '' },
    { label: t('courriers.colEtat'), valeur: (c) => c.etat_courrier },
    { label: t('courriers.colEcheance'), valeur: (c) => formatDate(c.deadline_courrier) },
    { label: t('courriers.colAuteur'), valeur: (c) => c.auteur },
    { label: t('courriers.colConfidentialite'), valeur: (c) => c.niveau_confidentialite },
  ];
}

function formatDate(valeur) {
  if (!valeur) return '';
  return new Date(valeur).toLocaleDateString('fr-FR');
}

/**
 * Tableau dessiné à la main (pas de plugin autotable installé) : en-tête
 * répété à chaque nouvelle page, colonnes de largeur égale, texte tronqué
 * pour ne jamais chevaucher la colonne suivante.
 */
export function exporterCourriersPdf(courriers, colonnes, titre) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const marge = 10;
  const largeurPage = doc.internal.pageSize.getWidth();
  const hauteurPage = doc.internal.pageSize.getHeight();
  const largeurUtile = largeurPage - marge * 2;
  const largeurCol = largeurUtile / colonnes.length;
  let y = 15;

  doc.setFontSize(14);
  doc.text(titre, marge, y);
  y += 7;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — ${courriers.length} courrier(s)`, marge, y);
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

  courriers.forEach((c, index) => {
    if (y > hauteurPage - 12) {
      doc.addPage();
      y = 15;
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

  doc.save(`courriers_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exporterCourriersExcel(courriers, colonnes) {
  const lignes = courriers.map((c) => {
    const ligne = {};
    colonnes.forEach((col) => { ligne[col.label] = col.valeur(c) ?? ''; });
    return ligne;
  });
  const feuille = XLSX.utils.json_to_sheet(lignes);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, 'Courriers');
  XLSX.writeFile(classeur, `courriers_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
