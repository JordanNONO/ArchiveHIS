import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import {
    DELAI_ACCORD_MS,
    PREFIXES_ACCORD,
    RACCOURCIS,
    estAutorise,
    estToucheSimple,
    normaliserTouche,
    signatureEffective,
    signatureEvenement,
} from '../utils/raccourcis';

/**
 * Gestionnaire central des raccourcis clavier : UN seul écouteur `keydown`
 * pour toute l'application, au lieu d'un par composant.
 *
 * Ce qu'il garantit, et qu'un écouteur isolé ne peut pas garantir :
 *  - le garde-fou de saisie : une touche nue tapée dans un champ est du
 *    texte, jamais un raccourci (taper « Note de service N » ne doit pas
 *    ouvrir un nouveau dossier) ;
 *  - l'absence de collision : deux actions ne peuvent pas réclamer la même
 *    touche, le catalogue l'interdit et la page /raccourcis le montre ;
 *  - les accords « G puis D », impossibles à tenir proprement à plusieurs
 *    écouteurs indépendants ;
 *  - une touche sans preneur n'est pas avalée : sans gestionnaire inscrit,
 *    on ne fait pas preventDefault, le navigateur garde son comportement.
 *
 * Les préférences vivent dans localStorage, par compte — même convention que
 * la largeur de la barre latérale (his_largeur_sidebar) et l'ordre du menu
 * (his_ordre_sidebar). Elles sont donc propres à ce navigateur : c'est dit
 * tel quel dans la page, pas promis comme un réglage de compte.
 */

const PREFS_DEFAUT = { toucheSimple: true, barreAide: true, annonce: false, surcharges: {} };

// Valeur de repli : un composant monté hors du fournisseur (page de partage
// externe, par exemple) ne doit pas planter — il n'a simplement pas de
// raccourcis.
const REPLI = {
    prefs: PREFS_DEFAUT,
    majPrefs: () => {},
    reinitialiser: () => {},
    enregistrer: () => () => {},
    panneauOuvert: false,
    setPanneauOuvert: () => {},
    droits: { hasPermission: () => false, isAdministrator: false },
};

const ContexteRaccourcis = createContext(REPLI);

export function useRaccourcis() {
    return useContext(ContexteRaccourcis);
}

/**
 * Inscrit le gestionnaire d'un raccourci 'local' tant que le composant est
 * monté. Le dernier inscrit gagne : si deux listes sont à l'écran, c'est la
 * plus récemment montée qui répond — comportement attendu pour un panneau ou
 * une liste ouverte par-dessus une autre.
 */
export function useRaccourci(id, gestionnaire, actif = true) {
    const { enregistrer } = useRaccourcis();
    const ref = useRef(gestionnaire);
    ref.current = gestionnaire;
    useEffect(() => {
        if (!actif) return undefined;
        return enregistrer(id, (...args) => ref.current?.(...args));
    }, [id, actif, enregistrer]);
}

function clePrefs() {
    const utilisateur = JSON.parse(sessionStorage.getItem('user') || '{}');
    return `his_raccourcis_${utilisateur?.id || 'moi'}`;
}

function lirePrefs() {
    try {
        const brut = JSON.parse(localStorage.getItem(clePrefs()) || '{}');
        return { ...PREFS_DEFAUT, ...brut, surcharges: { ...(brut.surcharges || {}) } };
    } catch (e) {
        return { ...PREFS_DEFAUT };
    }
}

/**
 * Le curseur est-il dans une zone de saisie ? Couvre aussi les éditeurs
 * riches (contenteditable) et les composants qui se déclarent comme champ
 * texte pour les lecteurs d'écran.
 */
function dansUneSaisie(cible) {
    if (!cible || typeof cible.closest !== 'function') return false;
    if (cible.isContentEditable) return true;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName)) return true;
    return !!cible.closest('[contenteditable="true"], [role="textbox"], [role="searchbox"]');
}

export function RaccourcisProvider({ children }) {
    const navigate = useNavigate();
    const { hasPermission, isAdministrator } = usePermissions();
    const [prefs, setPrefs] = useState(lirePrefs);
    const [panneauOuvert, setPanneauOuvert] = useState(false);
    // Les gestionnaires vivent dans une ref : s'inscrire ne doit pas
    // provoquer de rendu, et l'écouteur doit toujours lire la liste à jour.
    const gestionnaires = useRef(new Map());
    const accord = useRef(null);

    const droits = useMemo(() => ({ hasPermission, isAdministrator }), [hasPermission, isAdministrator]);

    const majPrefs = useCallback((modif) => {
        setPrefs((avant) => {
            const suite = { ...avant, ...modif };
            try {
                localStorage.setItem(clePrefs(), JSON.stringify(suite));
            } catch (e) {
                /* navigation privée, quota plein : le réglage reste valable pour la session */
            }
            return suite;
        });
    }, []);

    const reinitialiser = useCallback(() => majPrefs({ surcharges: {} }), [majPrefs]);

    const enregistrer = useCallback((id, fn) => {
        const liste = gestionnaires.current.get(id) || [];
        gestionnaires.current.set(id, [...liste, fn]);
        return () => {
            gestionnaires.current.set(id, (gestionnaires.current.get(id) || []).filter((f) => f !== fn));
        };
    }, []);

    // Index signature → raccourci, surcharges personnelles appliquées.
    const index = useMemo(() => {
        const sortie = new Map();
        RACCOURCIS.forEach((r) => {
            if (r.gere === 'reserve' || r.gere === 'externe') return;
            if (!estAutorise(r, droits)) return;
            sortie.set(signatureEffective(r, prefs.surcharges), r);
        });
        return sortie;
    }, [droits, prefs.surcharges]);

    useEffect(() => {
        function surTouche(e) {
            // Un composant qui a déjà traité la touche (dialogue, éditeur) a la
            // priorité : on ne repasse pas derrière lui.
            if (e.defaultPrevented) return;
            // Alt reste au navigateur et au système : on ne s'en sert jamais.
            if (e.altKey) return;

            const touche = normaliserTouche(e.key);
            // Une touche de modification seule n'est jamais un raccourci.
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

            const avecCtrl = e.ctrlKey || e.metaKey;
            if (dansUneSaisie(e.target) && !avecCtrl) {
                accord.current = null;
                return;
            }

            let signature = signatureEvenement(e);

            // Accords « G puis une lettre ».
            const enAttente = accord.current && Date.now() - accord.current.depuis < DELAI_ACCORD_MS
                ? accord.current.prefixe
                : null;
            accord.current = null;
            if (enAttente && !avecCtrl) {
                signature = `${enAttente} ${touche}`;
            } else if (!avecCtrl && PREFIXES_ACCORD.includes(touche) && prefs.toucheSimple) {
                // On arme sans rien consommer : un G isolé n'a aucun autre rôle.
                accord.current = { prefixe: touche, depuis: Date.now() };
                return;
            }

            const raccourci = index.get(signature);
            if (!raccourci) return;
            if (!prefs.toucheSimple && !raccourci.toujours && estToucheSimple(signature)) return;

            if (raccourci.gere === 'provider') {
                e.preventDefault();
                if (raccourci.id === 'panneau') setPanneauOuvert((v) => !v);
                else if (raccourci.id === 'page') navigate('/raccourcis');
                else if (raccourci.route) navigate(raccourci.route);
                return;
            }

            // 'local' : sans composant inscrit, la touche garde son sens
            // habituel (Entrée valide un formulaire, ⌫ revient en arrière…).
            const inscrits = gestionnaires.current.get(raccourci.id) || [];
            const dernier = inscrits[inscrits.length - 1];
            if (!dernier) return;
            e.preventDefault();
            dernier(e);
        }

        document.addEventListener('keydown', surTouche);
        return () => document.removeEventListener('keydown', surTouche);
    }, [index, navigate, prefs.toucheSimple]);

    const valeur = useMemo(
        () => ({ prefs, majPrefs, reinitialiser, enregistrer, panneauOuvert, setPanneauOuvert, droits }),
        [prefs, majPrefs, reinitialiser, enregistrer, panneauOuvert, droits],
    );

    return <ContexteRaccourcis.Provider value={valeur}>{children}</ContexteRaccourcis.Provider>;
}

export default RaccourcisProvider;
