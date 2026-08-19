import { GET_VAPID_PUBLIC_KEY_API, CREATE_PUSH_SUBSCRIPTION_API, DELETE_PUSH_SUBSCRIPTION_API } from '..';

export async function getVapidPublicKey() {
    const { url, ...meta } = GET_VAPID_PUBLIC_KEY_API;
    return await fetch(url, { ...meta, credentials: 'include' });
}

export async function createPushSubscription(subscription) {
    const { url, ...meta } = CREATE_PUSH_SUBSCRIPTION_API;
    return await fetch(url, { ...meta, credentials: 'include', body: JSON.stringify(subscription) });
}

export async function deletePushSubscription(endpoint) {
    const { url, ...meta } = DELETE_PUSH_SUBSCRIPTION_API;
    return await fetch(url, { ...meta, credentials: 'include', body: JSON.stringify({ endpoint }) });
}
