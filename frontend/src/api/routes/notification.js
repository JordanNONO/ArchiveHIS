import { GET_NOTIFICATIONS_API, GET_NOTIFICATIONS_UNREAD_COUNT_API, MARK_NOTIFICATION_READ_API, MARK_ALL_NOTIFICATIONS_READ_API } from "..";

export async function getNotifications(limit = 20) {
    const { url, ...meta } = GET_NOTIFICATIONS_API;
    return await fetch(url + `?limit=${limit}`, { ...meta, credentials: 'include' })
}

export async function getUnreadNotificationsCount() {
    const { url, ...meta } = GET_NOTIFICATIONS_UNREAD_COUNT_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}

export async function markNotificationAsRead(id) {
    const { url, ...meta } = MARK_NOTIFICATION_READ_API;
    return await fetch(url + `/${id}/read`, { ...meta, credentials: 'include' })
}

export async function markAllNotificationsAsRead() {
    const { url, ...meta } = MARK_ALL_NOTIFICATIONS_READ_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}
