/**
 * Recherche tolérante aux fautes de frappe, avec opérateurs ET/OU et phrases
 * exactes entre guillemets — remplace les .includes() bruts utilisés jusque-là
 * (Home.jsx, OpenFolder.jsx, Document.jsx), qui ne toléraient ni faute de
 * frappe ni requête structurée.
 *
 * Syntaxe reconnue :
 *   jean dupont          → contient "jean" ET "dupont" (quelque part, dans
 *                           n'importe quel ordre, fautes de frappe tolérées)
 *   jean OU dupont        → contient "jean" OU "dupont"
 *   "fiche de paie"       → phrase exacte (pas de tolérance aux fautes)
 *   contrat OU "avenant signé"   → combinable
 */

/**
 * Distance de Levenshtein bornée : on arrête dès que le seuil est dépassé,
 * pour rester rapide même sur un gros volume de mots (pas besoin de la
 * distance exacte au-delà du seuil, juste de savoir si on est en-dessous).
 */
function distanceBornee(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let precedente = new Array(b.length + 1);
  let courante = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) precedente[j] = j;

  for (let i = 1; i <= a.length; i++) {
    courante[0] = i;
    let minLigne = courante[0];
    for (let j = 1; j <= b.length; j++) {
      courante[j] = a[i - 1] === b[j - 1]
        ? precedente[j - 1]
        : 1 + Math.min(precedente[j - 1], precedente[j], courante[j - 1]);
      if (courante[j] < minLigne) minLigne = courante[j];
    }
    if (minLigne > max) return max + 1;
    [precedente, courante] = [courante, precedente];
  }
  return precedente[b.length];
}

/**
 * Seuil de tolérance proportionnel à la longueur du mot recherché : une
 * lettre de différence sur un mot de 4 lettres change tout, alors que sur un
 * mot de 10 lettres, 2 fautes restent clairement la même intention.
 */
function procheAvecFautes(mot, terme) {
  if (terme.length < 3) return mot === terme;
  if (mot.includes(terme)) return true;
  const seuil = terme.length <= 5 ? 1 : terme.length <= 9 ? 2 : 3;
  return distanceBornee(mot, terme, seuil) <= seuil;
}

const SEPARATEURS_MOTS = /[\s,.;:()/\\\-_"]+/;

/**
 * Découpe une requête en groupes OU de clauses ET — ex: `jean OU "paul dupont"`
 * devient [[{texte:'jean', exact:false}], [{texte:'paul dupont', exact:true}]].
 */
function parserRequete(requete) {
  const tokens = requete.match(/"[^"]+"|\S+/g) || [];
  const groupes = [[]];
  for (const tok of tokens) {
    const exact = tok.startsWith('"') && tok.endsWith('"') && tok.length > 1;
    const texte = (exact ? tok.slice(1, -1) : tok).toLocaleLowerCase().trim();
    if (!texte) continue;
    if (!exact && (texte === 'ou' || texte === 'or')) {
      groupes.push([]);
      continue;
    }
    if (!exact && (texte === 'et' || texte === 'and')) continue; // implicite déjà
    groupes[groupes.length - 1].push({ texte, exact });
  }
  return groupes.filter((g) => g.length > 0);
}

/**
 * `champs` : liste des valeurs de terrain à interroger (titre, auteur, résumé...).
 * `requete` : texte tapé par l'utilisateur, syntaxe ci-dessus.
 */
export function correspondARequete(champs, requete) {
  const brut = String(requete || '').trim();
  if (!brut) return true;

  const groupes = parserRequete(brut);
  if (groupes.length === 0) return true;

  const texteComplet = champs.filter(Boolean).join(' ').toLocaleLowerCase();
  if (!texteComplet) return false;
  const mots = texteComplet.split(SEPARATEURS_MOTS).filter(Boolean);

  return groupes.some((groupeET) => groupeET.every((clause) => {
    if (clause.exact) return texteComplet.includes(clause.texte);
    if (texteComplet.includes(clause.texte)) return true;
    return mots.some((mot) => procheAvecFautes(mot, clause.texte));
  }));
}
