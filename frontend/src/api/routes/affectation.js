import { MES_AUXILIAIRES_API } from "..";

/**
 * Auxiliaires (intervenants) affectés au bénéficiaire connecté — voir
 * "Qualité de la prestation" (NotationAuxiliaires.jsx).
 */
export async function getMesAuxiliaires() {
    const { url, ...meta } = MES_AUXILIAIRES_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}
