import { ASSISTANT_MESSAGE_API } from '..';

/**
 * Envoie un message à l'assistant documentaire (bulle de chat, voir
 * AssistantChat.jsx) — `historique` est la conversation déjà échangée dans
 * cette session de chat (reconstruite côté client, jamais persistée côté
 * serveur), au format [{ role: 'user'|'assistant', contenu: string }].
 */
export async function envoyerMessageAssistant(message, historique) {
    const { url, ...meta } = ASSISTANT_MESSAGE_API;
    return await fetch(url, { ...meta, body: JSON.stringify({ message, historique }), credentials: 'include' });
}
