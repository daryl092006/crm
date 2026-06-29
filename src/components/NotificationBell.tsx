import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellRing } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';

interface Notification {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    link?: string;
}

interface NotificationBellProps {
    userId: string;
    onNavigate?: (tab: string) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId, onNavigate }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const { addToast } = useToast();
    
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    const fetchNotifications = useCallback(async () => {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (!error && data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    }, [userId]);

    useEffect(() => {
        fetchNotifications();

        // --- ABONNEMENT TEMPS RÉEL (REALTIME) ---
        const channel = supabase
            .channel('notifications_realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`
            }, (payload: any) => {
                const newNotif = payload.new as Notification;
                setNotifications(prev => [newNotif, ...prev].slice(0, 10));
                setUnreadCount(prev => prev + 1);
                addToast(`${newNotif.title}`, "info");
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId, fetchNotifications, addToast]);

    const handleToggleDropdown = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: `${rect.bottom + 8}px`,
                left: `${Math.max(12, rect.right - 300)}px`, // Sécurité pour éviter de dépasser à gauche de l'écran
                width: '300px',
                zIndex: 99999,
            });
        }
        setIsOpen(!isOpen);
    };

    const markAsRead = async (id: string) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllRead = async () => {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    // Rendu du menu de notification dans un Portal attaché au body
    const renderDropdown = () => {
        if (!isOpen) return null;

        return createPortal(
            <>
                <div
                    onClick={() => setIsOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
                />
                <div style={{
                    ...dropdownStyle,
                    background: 'var(--bg-card)',
                    borderRadius: '16px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                    border: '1px solid var(--border)',
                    overflow: 'hidden',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div style={{ padding: '15px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'white' }}>Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                Tout marquer lu
                            </button>
                        )}
                    </div>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Bell size={24} style={{ opacity: 0.2, marginBottom: '10px' }} />
                                <p style={{ fontSize: '0.85rem' }}>Aucune notification</p>
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => {
                                        if (!notif.is_read) markAsRead(notif.id);
                                        if (notif.link && onNavigate) onNavigate(notif.link);
                                        setIsOpen(false);
                                    }}
                                    style={{
                                        padding: '12px 15px',
                                        borderBottom: '1px solid var(--border)',
                                        background: notif.is_read ? 'transparent' : 'rgba(99, 102, 241, 0.05)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        position: 'relative'
                                    }}
                                >
                                    {!notif.is_read && <div style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)' }} />}
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '2px', color: notif.is_read ? 'var(--text-muted)' : 'white' }}>
                                        {notif.title}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                        {notif.message}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', marginTop: '5px' }}>
                                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </>,
            document.body
        );
    };

    return (
        <div style={{ position: 'relative', zIndex: 1000 }}>
            <button
                ref={buttonRef}
                onClick={handleToggleDropdown}
                style={{
                    position: 'relative',
                    background: 'transparent',
                    border: 'none',
                    padding: '8px',
                    cursor: 'pointer',
                    color: unreadCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
                    transition: 'all 0.2s'
                }}
            >
                {unreadCount > 0 ? <BellRing size={22} className="animate-pulse" /> : <Bell size={22} />}
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 700,
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'grid',
                        placeItems: 'center',
                        border: '2px solid var(--card-bg)'
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {renderDropdown()}
        </div>
    );
};

export default NotificationBell;
