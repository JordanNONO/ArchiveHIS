/**
 * Filtre par période façon Power BI (retour utilisateur) pour les registres
 * (Appels, Chèques, Courriers) — un préréglage (aujourd'hui, ce mois-ci...)
 * ou une plage personnalisée, réutilisé identiquement partout via
 * FiltrePeriode.jsx.
 */
export const PRESETS_PERIODE = ['tous', 'aujourdhui', 'hier', 'cette_semaine', 'semaine_derniere', 'ce_mois', 'mois_dernier', 'cette_annee', 'annee_derniere', 'personnalise'];

export const PERIODE_VIDE = { preset: 'tous', debut: '', fin: '' };

function debutJour(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function finJour(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// Semaine calée sur lundi (norme française), pas dimanche.
function debutSemaine(d) {
  const x = debutJour(d);
  const jour = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - jour);
  return x;
}

function plagePourPreset(preset) {
  const maintenant = new Date();
  switch (preset) {
    case 'aujourdhui':
      return { debut: debutJour(maintenant), fin: finJour(maintenant) };
    case 'hier': {
      const h = new Date(maintenant);
      h.setDate(h.getDate() - 1);
      return { debut: debutJour(h), fin: finJour(h) };
    }
    case 'cette_semaine': {
      const debut = debutSemaine(maintenant);
      const fin = new Date(debut);
      fin.setDate(fin.getDate() + 6);
      return { debut, fin: finJour(fin) };
    }
    case 'semaine_derniere': {
      const debut = debutSemaine(maintenant);
      debut.setDate(debut.getDate() - 7);
      const fin = new Date(debut);
      fin.setDate(fin.getDate() + 6);
      return { debut, fin: finJour(fin) };
    }
    case 'ce_mois':
      return {
        debut: debutJour(new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)),
        fin: finJour(new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0)),
      };
    case 'mois_dernier':
      return {
        debut: debutJour(new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1)),
        fin: finJour(new Date(maintenant.getFullYear(), maintenant.getMonth(), 0)),
      };
    case 'cette_annee':
      return {
        debut: debutJour(new Date(maintenant.getFullYear(), 0, 1)),
        fin: finJour(new Date(maintenant.getFullYear(), 11, 31)),
      };
    case 'annee_derniere':
      return {
        debut: debutJour(new Date(maintenant.getFullYear() - 1, 0, 1)),
        fin: finJour(new Date(maintenant.getFullYear() - 1, 11, 31)),
      };
    default:
      return null;
  }
}

/**
 * `valeurDate` : n'importe quel format que `new Date()` sait parser (date
 * SQL "YYYY-MM-DD", ISO avec heure...). `periode` : voir FiltrePeriode.jsx,
 * `{ preset, debut, fin }`. Un `preset` custom sans debut NI fin (ligne pas
 * encore paramétrée) laisse tout passer, comme "tous".
 */
export function dateDansPeriode(valeurDate, periode) {
  if (!periode || periode.preset === 'tous') return true;

  if (periode.preset === 'personnalise') {
    if (!periode.debut && !periode.fin) return true;
    if (!valeurDate) return false;
    const d = new Date(valeurDate);
    if (periode.debut && d < debutJour(periode.debut)) return false;
    if (periode.fin && d > finJour(periode.fin)) return false;
    return true;
  }

  if (!valeurDate) return false;
  const plage = plagePourPreset(periode.preset);
  if (!plage) return true;
  const d = new Date(valeurDate);
  return d >= plage.debut && d <= plage.fin;
}
