import {
    GET_CONVERSATIONS_API, GET_PERSONNES_MESSAGERIE_API, DEMARRER_CONVERSATION_API,
    GET_MESSAGES_API, ENVOYER_MESSAGE_API, MARQUER_CONVERSATION_LUE_API,
} from "..";

/**
 * Messagerie interne entre collègues — conversations à deux (voir
 * backend/app/Http/Controllers/MessagerieController.php).
 */
export async function getConversations() {
    const { url, ...meta } = GET_CONVERSATIONS_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}

export async function getPersonnesMessagerie() {
    const { url, ...meta } = GET_PERSONNES_MESSAGERIE_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}

export async function demarrerConversation(destinataireId) {
    const { url, ...meta } = DEMARRER_CONVERSATION_API;
    return await fetch(url, { ...meta, body: JSON.stringify({ destinataire_id: destinataireId }), credentials: 'include' })
}

export async function getMessages(conversationId) {
    const { url, ...meta } = GET_MESSAGES_API;
    return await fetch(url + `/${conversationId}/messages`, { ...meta, credentials: 'include' })
}

export async function envoyerMessage(conversationId, contenu) {
    const { url, ...meta } = ENVOYER_MESSAGE_API;
    return await fetch(url + `/${conversationId}/messages`, { ...meta, body: JSON.stringify({ contenu }), credentials: 'include' })
}

export async function marquerConversationLue(conversationId) {
    const { url, ...meta } = MARQUER_CONVERSATION_LUE_API;
    return await fetch(url + `/${conversationId}/lu`, { ...meta, credentials: 'include' })
}
