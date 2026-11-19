import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getCategorie } from '../api/routes/categorie';
import { getCourrierCompteurs } from '../api/routes/document';
import { getAppelsCompteurs } from '../api/routes/appel';
import { getChequesCompteurs } from '../api/routes/cheque';

const RAFRAICHISSEMENT_MS = 2 * 60 * 1000;
const ECART_MINIMUM_MS = 30 * 1000;

const lireJson = (promesse) => promesse.then((res) => (res.ok ? res.json() : null)).catch(() => null);

/**
 * Les compteurs affichés dans le menu et la barre du haut — mêmes chiffres
 * et même calcul que les cartes du tableau de bord (Home.jsx) : « à
 * traiter » = documents soumis/en cours + rejetés/expirés, courriers en
 * attente, appels et chèques à traiter.
 *
 * Rafraîchis à chaque changement de page (au plus une fois toutes les 30 s)
 * et toutes les 2 minutes : assez frais pour guider, sans marteler le
 * serveur. `actif` faux (compte dépôt) : rien n'est chargé.
 */
export function useCompteursNavigation(actif) {
    const location = useLocation();
    const [compteurs, setCompteurs] = useState({ documents: 0, courriers: 0, appels: 0, cheques: 0 });
    const dernierChargement = useRef(0);

    const charger = useCallback(async () => {
        dernierChargement.current = Date.now();
        const [categories, courriers, appels, cheques] = await Promise.all([
            lireJson(getCategorie()),
            lireJson(getCourrierCompteurs()),
            lireJson(getAppelsCompteurs()),
            lireJson(getChequesCompteurs()),
        ]);
        setCompteurs((avant) => ({
            documents: Array.isArray(categories)
                ? categories.reduce((somme, d) => somme + (d.documents_attention_count ?? 0) + (d.documents_en_cours_count ?? 0), 0)
                : avant.documents,
            courriers: courriers?.en_attente ?? avant.courriers,
            appels: appels?.a_traiter ?? avant.appels,
            cheques: cheques?.a_traiter ?? avant.cheques,
        }));
    }, []);

    useEffect(() => {
        if (!actif) return undefined;
        const minuterie = setInterval(charger, RAFRAICHISSEMENT_MS);
        return () => clearInterval(minuterie);
    }, [actif, charger]);

    useEffect(() => {
        if (!actif || Date.now() - dernierChargement.current < ECART_MINIMUM_MS) return;
        charger();
    }, [actif, charger, location.pathname]);

    return compteurs;
}
