import { controlerMois, chainerAbsences, grouperParSalarie, joursDansLeMois } from './controlesFluctuationRh';

const MOIS = '2026-10';

function absence(id, date_debut, date_fin, motif, salarie = 'NJOYA CHRISTELLE') {
    return { id, section: 'absence', salarie, motif, date_debut, date_fin };
}

/** Les ids signalés en chevauchement, pour ce mois. */
function chevauchements(lignes) {
    return controlerMois(lignes, MOIS)
        .filter((a) => a.type === 'chevauchement')
        .map((a) => a.ids.slice().sort((x, y) => x - y));
}

/** L'affichage obtenu : [id, estProlongation] dans l'ordre du tableau. */
function affichage(lignes) {
    return chainerAbsences(lignes).map(({ ligne, estProlongation }) => [ligne.id, estProlongation]);
}

describe('une prolongation qui démarre le jour de la fin précédente', () => {
    // Le cas réel : 13/10 → 20/10 puis 20/10 → 31/10, même salariée.
    const lignes = [
        absence(1, '2026-10-13', '2026-10-20', 'Arrêt maladie initial'),
        absence(2, '2026-10-20', '2026-10-31', 'Prolongation arrêt maladie'),
    ];

    test("n'est plus signalée en chevauchement", () => {
        expect(chevauchements(lignes)).toEqual([]);
    });

    test('reste affichée en chaîne, la prolongation sous son arrêt', () => {
        expect(affichage(lignes)).toEqual([[1, false], [2, true]]);
    });
});

describe('les motifs sans le mot « Prolongation »', () => {
    test('un congé parental reconduit est chaîné et ne déclenche plus rien', () => {
        const lignes = [
            absence(1, '2026-10-01', '2026-10-31', 'Congé parental'),
            absence(2, '2026-10-31', '2026-11-30', 'Congé parental'),
        ];
        expect(chevauchements(lignes)).toEqual([]);
        expect(affichage(lignes)).toEqual([[1, false], [2, true]]);
    });

    test('un mi-temps thérapeutique renouvelé aussi', () => {
        const lignes = [
            absence(1, '2026-10-05', '2026-10-15', 'Mi-temps thérapeutique'),
            absence(2, '2026-10-15', '2026-10-28', 'Mi-temps thérapeutique'),
        ];
        expect(chevauchements(lignes)).toEqual([]);
        expect(affichage(lignes)).toEqual([[1, false], [2, true]]);
    });
});

describe('ce qui doit continuer à être signalé', () => {
    test('deux motifs différents qui partagent un jour restent un chevauchement', () => {
        const lignes = [
            absence(1, '2026-10-13', '2026-10-20', 'Absence injustifiée'),
            absence(2, '2026-10-20', '2026-10-31', 'Arrêt maladie initial'),
        ];
        expect(chevauchements(lignes)).toEqual([[1, 2]]);
        expect(affichage(lignes).map(([, p]) => p)).toEqual([false, false]);
    });

    test('un vrai recouvrement de plusieurs jours, même motif, reste signalé', () => {
        const lignes = [
            absence(1, '2026-10-01', '2026-10-15', 'Arrêt maladie initial'),
            absence(2, '2026-10-10', '2026-10-20', 'Arrêt maladie initial'),
        ];
        expect(chevauchements(lignes)).toEqual([[1, 2]]);
    });

    test('deux salariés différents ne sont jamais chaînés', () => {
        const lignes = [
            absence(1, '2026-10-13', '2026-10-20', 'Arrêt maladie initial', 'MADI LYNDA'),
            absence(2, '2026-10-20', '2026-10-31', 'Prolongation arrêt maladie', 'NJOYA CHRISTELLE'),
        ];
        expect(affichage(lignes).map(([, p]) => p)).toEqual([false, false]);
    });

    test('un trou de deux jours coupe la chaîne', () => {
        const lignes = [
            absence(1, '2026-10-01', '2026-10-10', 'Arrêt maladie initial'),
            absence(2, '2026-10-12', '2026-10-20', 'Prolongation arrêt maladie'),
        ];
        expect(affichage(lignes).map(([, p]) => p)).toEqual([false, false]);
    });

    test('les congés gardent le comportement précédent (hors du périmètre validé)', () => {
        const lignes = [
            { id: 1, section: 'conge', salarie: 'MADI LYNDA', motif: 'Congés payés', date_debut: '2026-10-05', date_fin: '2026-10-16' },
            { id: 2, section: 'conge', salarie: 'MADI LYNDA', motif: 'Congés payés', date_debut: '2026-10-16', date_fin: '2026-10-23' },
        ];
        expect(chevauchements(lignes)).toEqual([[1, 2]]);
    });
});

describe('robustesse', () => {
    test('trois périodes à la suite forment une seule chaîne ordonnée', () => {
        const lignes = [
            absence(3, '2026-10-21', '2026-10-31', 'Prolongation arrêt maladie'),
            absence(1, '2026-10-01', '2026-10-10', 'Arrêt maladie initial'),
            absence(2, '2026-10-10', '2026-10-21', 'Prolongation arrêt maladie'),
        ];
        expect(affichage(lignes)).toEqual([[1, false], [2, true], [3, true]]);
        expect(chevauchements(lignes)).toEqual([]);
    });

    test('deux lignes identiques sur une journée restent toutes deux affichées', () => {
        // Chacune est « la suite » de l'autre : sans garde-fou, aucune n'est
        // tête de chaîne et le tableau les perdrait toutes les deux.
        const lignes = [
            absence(1, '2026-10-20', '2026-10-20', 'Arrêt maladie initial'),
            absence(2, '2026-10-20', '2026-10-20', 'Arrêt maladie initial'),
        ];
        expect(affichage(lignes).map(([id]) => id).sort()).toEqual([1, 2]);
        expect(controlerMois(lignes, MOIS).some((a) => a.type === 'doublon')).toBe(true);
    });

    test('une ligne sans date de fin ne casse rien', () => {
        const lignes = [
            absence(1, '2026-10-13', null, 'Arrêt maladie initial'),
            absence(2, '2026-10-20', '2026-10-31', 'Prolongation arrêt maladie'),
        ];
        expect(() => affichage(lignes)).not.toThrow();
        expect(() => chevauchements(lignes)).not.toThrow();
    });

    test('une liste vide ne casse rien', () => {
        expect(chainerAbsences([])).toEqual([]);
        expect(controlerMois([], MOIS)).toEqual([]);
    });
});

describe('regroupement par salarié', () => {
    const items = (lignes) => lignes.map((ligne) => ({ ligne, estProlongation: false }));

    test('arrêt maladie puis absence injustifiée du même salarié : un seul groupe, dans l ordre des dates', () => {
        const lignes = [
            absence(3, '2026-10-20', '2026-10-21', 'Absence injustifiée'),
            absence(9, '2026-10-12', '2026-10-12', 'Absence autorisée', 'AWASSI JEAN'),
            absence(1, '2026-10-01', '2026-10-08', 'Arrêt maladie initial'),
        ];
        const groupes = grouperParSalarie(items(lignes));
        expect(groupes.map((g) => g.items.map((x) => x.ligne.id))).toEqual([[1, 3], [9]]);
    });

    test('le groupe prend la place de sa première ligne, accents et majuscules ignorés', () => {
        const lignes = [
            absence(1, '2026-10-02', '2026-10-03', 'Arrêt maladie initial', 'Élodie Martin'),
            absence(2, '2026-10-05', '2026-10-05', 'Absence autorisée', 'AWASSI JEAN'),
            absence(3, '2026-10-09', '2026-10-09', 'Absence injustifiée', 'ELODIE  MARTIN'),
        ];
        const groupes = grouperParSalarie(items(lignes));
        expect(groupes.map((g) => g.items.map((x) => x.ligne.id))).toEqual([[1, 3], [2]]);
    });

    test('les alertes ne changent pas : un chevauchement entre deux motifs reste signalé', () => {
        const lignes = [
            absence(1, '2026-10-01', '2026-10-10', 'Arrêt maladie initial'),
            absence(2, '2026-10-08', '2026-10-09', 'Absence injustifiée'),
        ];
        expect(grouperParSalarie(items(lignes))).toHaveLength(1);
        expect(chevauchements(lignes)).toEqual([[1, 2]]);
    });
});

describe('jours comptés dans le mois', () => {
    test('une prolongation qui reprend le jour de la fin ne double pas ce jour', () => {
        const lignes = [
            absence(1, '2026-10-01', '2026-10-08', 'Arrêt maladie initial'),
            absence(2, '2026-10-08', '2026-10-15', 'Prolongation arrêt maladie'),
            absence(3, '2026-10-20', '2026-10-21', 'Absence injustifiée'),
        ];
        expect(joursDansLeMois(lignes, MOIS)).toBe(17);
    });

    test('un arrêt qui déborde sur le mois suivant ne compte que sa part du mois', () => {
        expect(joursDansLeMois([absence(1, '2026-10-29', '2026-11-10', 'Arrêt maladie initial')], MOIS)).toBe(3);
    });

    test('un congé posé en plusieurs périodes compte chacune', () => {
        const conge = { id: 1, section: 'conge', salarie: 'X', date_debut: '2026-10-03', date_fin: '2026-10-17', periodes: [{ du: '2026-10-03', au: '2026-10-06' }, { du: '2026-10-16', au: '2026-10-17' }] };
        expect(joursDansLeMois([conge], MOIS)).toBe(6);
    });

    test('une ligne sans date ne casse rien', () => {
        expect(joursDansLeMois([absence(1, null, null, 'Arrêt maladie initial')], MOIS)).toBe(0);
    });
});
