/**
 * Départage, commun aux trois registres (courriers, chèques, appels).
 *
 * Les trois trient côté navigateur et renvoyaient 0 sur les ex æquo : l'ordre
 * retombait alors sur celui du serveur, qu'un `sort()` stable conserve mais
 * qui n'a aucune raison d'être l'ordre de saisie. Concrètement, quatre
 * courriers datés du même jour s'affichaient dans un ordre qui n'était ni
 * celui des dates ni celui des enregistrements (retour utilisateur
 * 2026-11-10 : « ça ne classe pas toujours le courrier enregistré récemment
 * en première ligne »).
 *
 * Règle : à valeur égale, le dernier saisi passe devant. Toujours du plus
 * récent au plus ancien, même quand le tri principal est croissant — c'est la
 * demande, pas une symétrie à respecter : quel que soit le classement choisi,
 * ce qu'on vient d'enregistrer doit se trouver en haut de son groupe.
 *
 * `created_at` d'abord, l'id ensuite. L'id seul suffirait presque (il croît
 * avec les insertions) mais `created_at` reste la donnée qui porte le sens ;
 * l'id tranche les saisies de la même seconde, et sert de repli quand le
 * serveur ne renvoie pas `created_at` pour ce registre.
 */
export function departagerParSaisie(a, b) {
    const va = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const vb = b?.created_at ? new Date(b.created_at).getTime() : 0;
    if (va !== vb) return vb - va;
    return (Number(b?.id) || 0) - (Number(a?.id) || 0);
}
