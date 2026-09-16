import { ASSISTANT_MESSAGE_API, ASSISTANT_HISTORIQUE_API, ASSISTANT_EFFACER_HISTORIQUE_API } from '..';

/**
 * Envoie un message à l'assistant documentaire (bulle de chat, voir
 * AssistantChat.jsx) — l'historique est désormais tenu côté serveur (voir
 * AssistantController), jamais renvoyé depuis le client.
 */
export async function envoyerMessageAssistant(message) {
    const { url, ...meta } = ASSISTANT_MESSAGE_API;
    return await fetch(url, { ...meta, body: JSON.stringify({ message }), credentials: 'include' });
}

/** Conversation déjà persistée pour la personne connectée, la plus ancienne en premier. */
export async function getHistoriqueAssistant() {
    const { url, ...meta } = ASSISTANT_HISTORIQUE_API;
    return await fetch(url, { ...meta, credentials: 'include' });
}

/** Efface l'historique de conversation de la personne connectée ("nouvelle conversation"). */
export async function effacerHistoriqueAssistant() {
    const { url, ...meta } = ASSISTANT_EFFACER_HISTORIQUE_API;
    return await fetch(url, { ...meta, credentials: 'include' });
}
