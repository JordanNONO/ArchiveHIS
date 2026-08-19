import { GET_FORMATION_API, UPDATE_FORMATION_API } from "..";

export async function getFormation() {
    const { url, ...meta } = GET_FORMATION_API;
    return await fetch(url, { ...meta, credentials: 'include' });
}

/**
 * @param {{ titre?: string, description?: string }} data
 * @param {{ video?: File, pdf?: File }} fichiers
 */
export async function updateFormation(data, fichiers) {
    const { url, ...meta } = UPDATE_FORMATION_API;

    const formData = new FormData();
    for (const key in data) {
        if (data[key] !== undefined && data[key] !== null) {
            formData.append(key, data[key]);
        }
    }
    if (fichiers?.video) formData.append('video', fichiers.video);
    if (fichiers?.pdf) formData.append('pdf', fichiers.pdf);

    return await fetch(url, { ...meta, body: formData });
}
