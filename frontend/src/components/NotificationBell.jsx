import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuBell, LuShare2, LuClipboardCheck, LuRefreshCw, LuCheck, LuInbox, LuBuilding2, LuDownload, LuAlertTriangle } from 'react-icons/lu';
import { getNotifications, getUnreadNotificationsCount, markNotificationAsRead, markAllNotificationsAsRead } from '../api/routes/notification';
import { timeAgo } from '../utils/fileTypeIcons';
import { playNotificationSound } from '../utils/notificationSound';

const TYPE_VISUAL = {
    partage: { icon: LuShare2, tint: 'bg-primary/10 text-primary' },
    a_valider: { icon: LuClipboardCheck, tint: 'bg-accent/20 text-accent-foreground' },
    statut: { icon: LuRefreshCw, tint: 'bg-green-500/10 text-green-600' },
    transmission_service: { icon: LuBuilding2, tint: 'bg-accent/20 text-accent-foreground' },
    export_pret: { icon: LuDownload, tint: 'bg-green-500/10 text-green-600' },
    export_echoue: { icon: LuAlertTriangle, tint: 'bg-destructive/10 text-destructive' },
};

const POLL_INTERVAL_MS = 30000;

function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const rootRef = useRef(null);
    const navigate = useNavigate();
    const previousUnreadCount = useRef(null);

    const fetchUnreadCount = useCallback(() => {
        getUnreadNotificationsCount()
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!data) return;
                // Ne joue le son que si le compteur augmente après un premier chargement
                // (évite de sonner à l'ouverture de la page ou quand on lit des notifs).
                if (previousUnreadCount.current !== null && data.count > previousUnreadCount.current) {
                    playNotificationSound();
                }
                previousUnreadCount.current = data.count;
                setUnreadCount(data.count);
            })
            .catch(() => {});
    }, []);

    const fetchNotifications = useCallback(() => {
        setLoading(true);
        getNotifications(20)
            .then(res => res.ok ? res.json() : [])
            .then(data => setNotifications(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    useEffect(() => {
        if (open) fetchNotifications();
    }, [open, fetchNotifications]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function handleItemClick(notification) {
        if (!notification.read_at) {
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n));
            setUnreadCount(prev => {
                const next = Math.max(0, prev - 1);
                previousUnreadCount.current = next;
                return next;
            });
            markNotificationAsRead(notification.id).catch(() => {});
        }
        setOpen(false);
        const lien = notification.data?.lien;
        if (!lien) return;
        // Un lien absolu (ex: fichier signé côté backend) doit être ouvert en
        // navigation normale, pas interprété comme une route interne du SPA.
        if (/^https?:\/\//.test(lien)) {
            window.location.href = lien;
        } else {
            navigate(lien);
        }
    }

    function handleMarkAllRead() {
        setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
        setUnreadCount(0);
        previousUnreadCount.current = 0;
        markAllNotificationsAsRead().catch(() => {});
    }

    return (
        <div className='relative' ref={rootRef}>
            <button
                className='relative text-muted-foreground hover:text-foreground transition-colors'
                onClick={() => setOpen(o => !o)}
            >
                <LuBell size={19} />
                {unreadCount > 0 && (
                    <span className='absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[10px] font-semibold leading-none'>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className='fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-auto mt-0 sm:mt-2 w-auto sm:w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden'>
                    <div className='flex items-center justify-between px-4 py-3 border-b border-border'>
                        <span className='font-semibold text-sm text-foreground'>Notifications</span>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className='flex items-center gap-1 text-xs text-primary hover:underline'
                            >
                                <LuCheck size={13} /> Tout marquer comme lu
                            </button>
                        )}
                    </div>

                    <div className='max-h-96 overflow-y-auto'>
                        {loading && (
                            <div className='py-8 text-center text-sm text-muted-foreground'>Chargement...</div>
                        )}
                        {!loading && notifications.length === 0 && (
                            <div className='flex flex-col items-center gap-2 py-10 text-muted-foreground'>
                                <LuInbox size={28} />
                                <span className='text-sm'>Aucune notification</span>
                            </div>
                        )}
                        {!loading && notifications.map(notification => {
                            const visual = TYPE_VISUAL[notification.data?.type] || TYPE_VISUAL.statut;
                            const Icon = visual.icon;
                            const isUnread = !notification.read_at;
                            return (
                                <button
                                    key={notification.id}
                                    onClick={() => handleItemClick(notification)}
                                    className={`flex w-full gap-3 px-4 py-3 text-left border-b border-border/60 last:border-0 hover:bg-muted/60 transition-colors ${isUnread ? 'bg-primary/5' : ''}`}
                                >
                                    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${visual.tint}`}>
                                        <Icon size={16} />
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-sm font-medium text-foreground truncate'>{notification.data?.titre}</p>
                                        <p className='text-xs text-muted-foreground line-clamp-2'>{notification.data?.message}</p>
                                        <p className='text-[11px] text-muted-foreground/70 mt-1'>{timeAgo(notification.created_at)}</p>
                                    </div>
                                    {isUnread && <span className='flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5' />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default NotificationBell;
