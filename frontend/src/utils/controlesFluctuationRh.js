/**
 * Contrôles automatiques sur les lignes d'un mois de fluctuation RH — les
 * erreurs qu'on retrouvait à la main dans le Google Sheet (doublons, arrêts
 * qui se chevauchent, année mal tapée, colonne oubliée). Purement indicatif :
 * rien n'est bloqué, la ligne est juste signalée.
 *
 * Renvoie [{ type, ids: [id...], salarie }] — le libellé est traduit par
 * l'appelant (fluctuationRh.controle_<type>).
 */

const PERIODES = ['absence', 'conge'];
const AVEC_DATE_DANS_LE_MOIS = ['absence', 'conge', 'ferie'];

function cleNom(nom) {
  return String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function jour(iso) {
  return iso ? String(iso).slice(0, 10) : null;
}

function ecartJours(a, b) {
  return Math.round((new Date(a) - new Date(b)) / 86400000);
}

export function controlerMois(lignes, mois) {
  const alertes = [];
  const debutMois = `${mois}-01`;
  const [a, m] = mois.split('-').map(Number);
  const finMois = jour(new Date(Date.UTC(a, m, 0)).toISOString());

  // Doublons stricts
  const vues = new Map();
  for (const l of lignes) {
    const cle = [l.section, cleNom(l.salarie), jour(l.date_debut), jour(l.date_fin), cleNom(l.motif), l.montant ?? ''].join('|');
    if (vues.has(cle)) vues.get(cle).push(l.id); else vues.set(cle, [l.id]);
  }
  for (const [cle, ids] of vues) {
    if (ids.length > 1) alertes.push({ type: 'doublon', ids, salarie: lignes.find((l) => l.id === ids[0]).salarie, cle });
  }
  const dejaDoublon = new Set(alertes.flatMap((x) => x.ids.slice(1)));

  // Périodes qui se chevauchent pour un même salarié (absences + congés)
  const parSalarie = new Map();
  for (const l of lignes) {
    if (!PERIODES.includes(l.section) || !l.date_debut || dejaDoublon.has(l.id)) continue;
    const k = cleNom(l.salarie);
    if (!parSalarie.has(k)) parSalarie.set(k, []);
    parSalarie.get(k).push(l);
  }
  for (const periodes of parSalarie.values()) {
    for (let i = 0; i < periodes.length; i++) {
      for (let j = i + 1; j < periodes.length; j++) {
        const p = periodes[i];
        const q = periodes[j];
        const finP = jour(p.date_fin) || jour(p.date_debut);
        const finQ = jour(q.date_fin) || jour(q.date_debut);
        if (jour(p.date_debut) <= finQ && jour(q.date_debut) <= finP) {
          alertes.push({ type: 'chevauchement', ids: [p.id, q.id], salarie: p.salarie });
        }
      }
    }
  }

  for (const l of lignes) {
    const debut = jour(l.date_debut);
    const fin = jour(l.date_fin);

    if (debut && fin && fin < debut) {
      alertes.push({ type: 'finAvantDebut', ids: [l.id], salarie: l.salarie });
      continue;
    }

    // Année probablement mal tapée (02/02/2025 au lieu de 2026) : date à
    // plus de 10 mois du mois traité.
    const dateTestee = l.section === 'sortie' ? fin : (['stagiaire', 'formation', 'entree'].includes(l.section) ? null : debut);
    if (dateTestee && (ecartJours(debutMois, dateTestee) > 300 || ecartJours(dateTestee, finMois) > 300)) {
      alertes.push({ type: 'anneeSuspecte', ids: [l.id], salarie: l.salarie });
      continue;
    }

    if (AVEC_DATE_DANS_LE_MOIS.includes(l.section) && debut) {
      const finPeriode = fin || debut;
      if (finPeriode < debutMois || debut > finMois) {
        alertes.push({ type: 'horsMois', ids: [l.id], salarie: l.salarie });
        continue;
      }
    }

    const manquant =
      (l.section === 'sortie' && !fin) ||
      (['entree', 'absence', 'conge', 'avenant', 'ferie', 'discipline'].includes(l.section) && !debut) ||
      (['acompte', 'retenue'].includes(l.section) && (l.montant === null || l.montant === undefined || l.montant === ''));
    if (manquant) alertes.push({ type: 'champManquant', ids: [l.id], salarie: l.salarie });
  }

  return alertes;
}

/**
 * Échéances à venir signalées dans le mois : fins de CDD, de congé
 * maternité/parental, de formation... (date de fin postérieure au mois).
 */
export function echeancesAVenir(lignes, mois) {
  const [a, m] = mois.split('-').map(Number);
  const finMois = jour(new Date(Date.UTC(a, m, 0)).toISOString());
  return lignes
    .filter((l) => l.date_fin && jour(l.date_fin) > finMois && ['entree', 'absence', 'conge', 'formation', 'stagiaire'].includes(l.section))
    .sort((x, y) => jour(x.date_fin).localeCompare(jour(y.date_fin)));
}
