import { departagerParSaisie } from './tri';

/** Trie une liste par date décroissante AVEC le départage, comme les registres. */
function trierCommeUnRegistre(liste, cle = 'date') {
    return [...liste].sort((a, b) => {
        const va = a[cle] ? new Date(a[cle]).getTime() : 0;
        const vb = b[cle] ? new Date(b[cle]).getTime() : 0;
        if (va < vb) return 1;
        if (va > vb) return -1;
        return departagerParSaisie(a, b);
    }).map((c) => c.id);
}

describe('departagerParSaisie', () => {
    test('le dernier saisi passe devant', () => {
        const ancien = { id: 1, created_at: '2026-11-04 09:00:00' };
        const recent = { id: 2, created_at: '2026-11-09 09:00:00' };
        expect(departagerParSaisie(ancien, recent)).toBeGreaterThan(0);
        expect(departagerParSaisie(recent, ancien)).toBeLessThan(0);
    });

    test("l'id tranche deux saisies de la même seconde", () => {
        const a = { id: 10, created_at: '2026-11-04 09:00:00' };
        const b = { id: 11, created_at: '2026-11-04 09:00:00' };
        expect(departagerParSaisie(a, b)).toBeGreaterThan(0);
    });

    test("se rabat sur l'id quand created_at manque", () => {
        expect(departagerParSaisie({ id: 3 }, { id: 7 })).toBeGreaterThan(0);
        expect(departagerParSaisie({ id: 7 }, { id: 3 })).toBeLessThan(0);
    });

    test('ne renvoie 0 que pour deux lignes réellement identiques', () => {
        const ligne = { id: 5, created_at: '2026-11-04 09:00:00' };
        expect(departagerParSaisie(ligne, { ...ligne })).toBe(0);
    });

    test('ne casse pas sur un objet vide ou absent', () => {
        expect(() => departagerParSaisie({}, {})).not.toThrow();
        expect(departagerParSaisie({}, {})).toBe(0);
        expect(() => departagerParSaisie(undefined, undefined)).not.toThrow();
    });

    test('quatre courriers du même jour sortent du plus récemment saisi au plus ancien', () => {
        const meme = '2026-11-06';
        const courriers = [
            { id: 1002, date: meme, created_at: '2026-11-06 09:00:00' },
            { id: 1001, date: meme, created_at: '2026-11-06 14:00:00' },
            { id: 1003, date: meme, created_at: '2026-11-06 11:00:00' },
            { id: 1000, date: meme, created_at: '2026-11-06 08:00:00' },
        ];
        expect(trierCommeUnRegistre(courriers)).toEqual([1001, 1003, 1002, 1000]);
    });

    test('le départage ne prend jamais le pas sur la date', () => {
        const courriers = [
            { id: 1, date: '2026-11-10', created_at: '2026-11-01 09:00:00' },
            { id: 2, date: '2026-11-04', created_at: '2026-11-09 09:00:00' },
        ];
        // Le plus récemment saisi (id 2) reste derrière : sa date est plus ancienne.
        expect(trierCommeUnRegistre(courriers)).toEqual([1, 2]);
    });

    test('le tri reste stable : deux passages donnent le même ordre', () => {
        const courriers = [
            { id: 1, date: '2026-11-06', created_at: '2026-11-06 09:00:00' },
            { id: 2, date: '2026-11-06', created_at: '2026-11-06 09:00:00' },
            { id: 3, date: '2026-11-06', created_at: '2026-11-06 11:00:00' },
        ];
        const premier = trierCommeUnRegistre(courriers);
        const second = trierCommeUnRegistre([...courriers].reverse());
        expect(premier).toEqual(second);
    });
});
