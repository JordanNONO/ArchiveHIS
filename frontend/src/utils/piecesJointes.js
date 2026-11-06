/**
 * Pièces jointes d'un document — ce qu'elles prouvent, leur poids, qui les a
 * versées. Mêmes valeurs que DocumentPieceJointe::TYPES côté serveur : les
 * deux listes doivent rester identiques, sinon la validation refuse un type
 * que l'interface propose.
 */

export const TYPES_PIECE = ['paiement', 'recu', 'facture', 'courrier', 'autre'];

/** Libellé traduit d'un type, avec repli sur « Autre » pour les pièces d'avant ce champ. */
export function libelleTypePiece(t, type) {
    return t(`piecesJointes.type_${TYPES_PIECE.includes(type) ? type : 'autre'}`);
}

export function optionsTypePiece(t) {
    return TYPES_PIECE.map((valeur) => ({ value: valeur, label: libelleTypePiece(t, valeur) }));
}

/**
 * Type deviné d'après le nom du fichier, pour éviter de le choisir à la main
 * dans le cas le plus courant. Reste modifiable : ce n'est qu'une proposition.
 * Par défaut « preuve de paiement », parce que c'est ce qu'on joint neuf fois
 * sur dix en traitant un courrier entrant.
 */
export function devinerTypePiece(nomFichier) {
    const nom = String(nomFichier || '').toLowerCase();
    if (/factur|invoice/.test(nom)) return 'facture';
    if (/recu|reçu|quittance/.test(nom)) return 'recu';
    if (/scan|courrier|lettre/.test(nom)) return 'courrier';
    return 'paiement';
}

/** « 184 Ko », « 1,2 Mo » — en-dessous du kilo-octet on affiche quand même 1 Ko plutôt que 0. */
export function formaterTaille(octets) {
    const valeur = Number(octets);
    if (!Number.isFinite(valeur) || valeur <= 0) return '—';
    if (valeur >= 1024 * 1024) return `${(valeur / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
    return `${Math.max(1, Math.round(valeur / 1024))} Ko`;
}

/** Extension en majuscules, pour la vignette quand le fichier n'est pas une image. */
export function extensionCourte(nomFichier) {
    const morceaux = String(nomFichier || '').split('.');
    return morceaux.length > 1 ? morceaux.pop().toUpperCase().slice(0, 4) : '?';
}

/**
 * Nom lisible d'un utilisateur renvoyé par le serveur : le vrai nom de
 * salarié quand la fiche personnel est liée, sinon l'identifiant de
 * connexion. Même résolution que les versions et les consultations (voir
 * DocView.jsx) — le serveur charge `personnels` avec l'utilisateur.
 */
export function nomUtilisateur(utilisateur, repli = '') {
    if (!utilisateur) return repli;
    const personnel = utilisateur.personnels?.[0];
    if (personnel?.nom || personnel?.prenom) {
        return `${personnel.prenom || ''} ${personnel.nom || ''}`.trim();
    }
    return utilisateur.nom || repli;
}

/** Qui a versé la pièce au dossier. */
export function nomAjoutePar(piece, repli = '') {
    return nomUtilisateur(piece?.ajoute_par, repli);
}
