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
 *
 * Accents ignorés (« reclamation » trouve « Réclamation »). Pour filtrer une
 * liste, préférer filtrerParRequete() à un .filter(correspondARequete) :
 * la tolérance aux fautes n'y sert que de repli quand rien ne correspond
 * exactement — retour utilisateur, les recherches doivent « faire ressortir
 * l'information précise », pas des quasi-homonymes à côté du bon résultat.
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

/** Minuscules sans accents : « Élodie » et « elodie » sont le même mot. */
export function normaliserTexte(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase();
}

/**
 * Seuil de tolérance proportionnel à la longueur du mot recherché : une
 * lettre de différence sur un mot de 4 lettres change tout, alors que sur un
 * mot de 10 lettres, 2 fautes restent clairement la même intention. Aucune
 * tolérance sous 4 lettres (« rh », « cv », « pai » : trop courts pour deviner).
 */
function procheAvecFautes(mot, terme) {
  if (terme.length < 4) return mot === terme;
  const seuil = terme.length <= 6 ? 1 : 2;
  return distanceBornee(mot, terme, seuil) <= seuil;
}

const SEPARATEURS_MOTS = /[\s,.;:()/\\\-_"'’]+/;

/**
 * Découpe une requête en groupes OU de clauses ET — ex: `jean OU "paul dupont"`
 * devient [[{texte:'jean', exact:false}], [{texte:'paul dupont', exact:true}]].
 */
function parserRequete(requete) {
  const tokens = requete.match(/"[^"]+"|\S+/g) || [];
  const groupes = [[]];
  for (const tok of tokens) {
    const exact = tok.startsWith('"') && tok.endsWith('"') && tok.length > 1;
    const texte = normaliserTexte(exact ? tok.slice(1, -1) : tok).trim();
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

function preparer(champs) {
  const texteComplet = champs.filter((c) => c !== null && c !== undefined && c !== '').map(normaliserTexte).join(' ');
  return { texteComplet, mots: texteComplet.split(SEPARATEURS_MOTS).filter(Boolean) };
}

function clauseCorrespond(clause, { texteComplet, mots }, tolerant) {
  if (texteComplet.includes(clause.texte)) return true;
  if (clause.exact || !tolerant) return false;
  return mots.some((mot) => procheAvecFautes(mot, clause.texte));
}

function correspondPrepare(groupes, prepare, tolerant) {
  if (!prepare.texteComplet) return false;
  return groupes.some((groupeET) => groupeET.every((clause) => clauseCorrespond(clause, prepare, tolerant)));
}

/**
 * `champs` : liste des valeurs de terrain à interroger (titre, auteur, résumé...).
 * `requete` : texte tapé par l'utilisateur, syntaxe ci-dessus.
 * `options.tolerant` (vrai par défaut) : accepter les fautes de frappe.
 */
export function correspondARequete(champs, requete, { tolerant = true } = {}) {
  const brut = String(requete || '').trim();
  if (!brut) return true;

  const groupes = parserRequete(brut);
  if (groupes.length === 0) return true;

  return correspondPrepare(groupes, preparer(champs), tolerant);
}

/**
 * Pertinence d'une ligne pour une requête — plus c'est haut, plus c'est
 * précis : mot identique > début de mot > morceau de mot > faute de frappe,
 * et un peu plus quand ça tombe dans le premier champ (le "titre" de la
 * ligne : nom, objet, libellé...).
 */
function scorePertinence(groupes, champs) {
  const prepare = preparer(champs);
  const premier = preparer(champs.slice(0, 1));
  let meilleur = 0;
  for (const groupeET of groupes) {
    let total = 0;
    for (const clause of groupeET) {
      let s = 0;
      if (prepare.mots.includes(clause.texte)) s = 4;
      else if (prepare.mots.some((m) => m.startsWith(clause.texte))) s = 3;
      else if (prepare.texteComplet.includes(clause.texte)) s = 2;
      else if (!clause.exact && prepare.mots.some((m) => procheAvecFautes(m, clause.texte))) s = 1;
      if (s > 0 && premier.texteComplet.includes(clause.texte)) s += 1;
      total += s;
    }
    meilleur = Math.max(meilleur, total);
  }
  return meilleur;
}

/**
 * Filtre une liste avec une requête, en privilégiant la précision :
 * - d'abord les lignes qui correspondent EXACTEMENT (accents ignorés) ;
 * - seulement si aucune ne correspond, repli sur la tolérance aux fautes.
 * `champsDe(element)` renvoie les champs à interroger, le plus important en
 * premier. `options.trierParPertinence` : renvoie les plus pertinents en tête
 * (listes de suggestions, recherche globale) ; sinon l'ordre d'origine est
 * conservé (tableaux qui ont déjà leur propre tri par colonne).
 */
export function filtrerParRequete(liste, champsDe, requete, { trierParPertinence = false } = {}) {
  const brut = String(requete || '').trim();
  if (!brut) return liste;
  const groupes = parserRequete(brut);
  if (groupes.length === 0) return liste;

  const avecChamps = liste.map((element) => ({ element, champs: champsDe(element) }));
  let retenus = avecChamps.filter(({ champs }) => correspondPrepare(groupes, preparer(champs), false));
  if (retenus.length === 0) {
    retenus = avecChamps.filter(({ champs }) => correspondPrepare(groupes, preparer(champs), true));
  }

  if (trierParPertinence) {
    retenus = retenus
      .map((r, index) => ({ ...r, index, score: scorePertinence(groupes, r.champs) }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
  }
  return retenus.map((r) => r.element);
}
