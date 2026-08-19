/**
 * Les sous-dossiers peuvent être imbriqués (voir OpenFolder.jsx) — une liste
 * à plat sans indication de hiérarchie serait ambiguë dans un <select> (ex:
 * "CV" et son enfant "Promesse d'embauche" auraient l'air de deux dossiers
 * indépendants). On les remet dans l'ordre parent → enfants, avec une
 * profondeur pour indenter visuellement selon le niveau.
 */
export function typesAvecHierarchie(types) {
    const parEnfantsDe = new Map();
    types.forEach((t) => {
        const cle = t.parent_id || null;
        if (!parEnfantsDe.has(cle)) parEnfantsDe.set(cle, []);
        parEnfantsDe.get(cle).push(t);
    });
    const resultat = [];
    function visiter(parentId, profondeur) {
        (parEnfantsDe.get(parentId) || [])
            .sort((a, b) => a.libelle.localeCompare(b.libelle))
            .forEach((t) => {
                resultat.push({ ...t, profondeur });
                visiter(t.id, profondeur + 1);
            });
    }
    visiter(null, 0);
    return resultat;
}
