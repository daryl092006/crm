import React from 'react';
import {
    LayoutDashboard,
    LayoutList,
    GraduationCap,
    Target,
    UserSquare2,
    Settings,
    LogOut,
    Clock,
    Shield,
    Mail,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
    profile: import('../types').Profile | null;
    onNavigate?: () => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

// Mapping id → route
const TAB_ROUTES: Record<string, string> = {
    dashboard: '/',
    pipeline: '/pipeline',
    leads: '/leads',
    followups: '/followups',
    email_campaigns: '/email-campaigns',
    auditlogs: '/audit-logs',
    campaigns: '/campaigns',
    agents: '/agents',
    settings: '/settings',
    profile: '/profile',
};

const Sidebar: React.FC<SidebarProps> = ({ 
    profile, 
    onNavigate, 
    isCollapsed = false, 
    onToggleCollapse 
}) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const isAdmin = profile?.role === 'admin';
    const isForced = profile?.must_change_password === true;

    const isActive = (id: string) => {
        const route = TAB_ROUTES[id];
        if (!route) return false;
        if (route === '/') return pathname === '/';
        return pathname.startsWith(route);
    };

    const handleNavigate = (id: string) => {
        if (isForced && id !== 'profile') return;
        const route = TAB_ROUTES[id];
        if (route) {
            navigate(route);
            onNavigate?.();
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const menuItems: { id: string; label: string; icon: any }[] = [
        { id: 'dashboard', label: ['admin', 'direction', 'superviseur', 'superagent'].includes(profile?.role || '') ? 'Tableau de Bord' : 'Mon Dashboard', icon: LayoutDashboard },
        { id: 'pipeline', label: 'Pipeline IA', icon: LayoutList },
        { id: 'leads', label: 'Prospects (Liste)', icon: GraduationCap },
        { id: 'followups', label: 'Relances', icon: Clock },
        ...((['admin', 'superagent', 'direction', 'superviseur'].includes(profile?.role || ''))
            ? [{ id: 'email_campaigns', label: 'Campagnes Email', icon: Mail }]
            : []),
        ...((['admin', 'direction', 'superagent', 'superviseur'].includes(profile?.role || ''))
            ? [{ id: 'auditlogs', label: 'Journal d\'activité', icon: Shield }]
            : []),
        ...((['admin', 'superagent'].includes(profile?.role || ''))
            ? [{ id: 'campaigns', label: 'Campagnes', icon: Target }]
            : []),
        ...((['admin', 'superagent'].includes(profile?.role || ''))
            ? [{ id: 'agents', label: 'Mon Équipe', icon: UserSquare2 }]
            : []),
    ];

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Header / Logo */}
            <div style={{ 
                marginBottom: '2.5rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: isCollapsed ? 'center' : 'space-between',
                padding: isCollapsed ? '0' : '0 0.5rem',
                gap: '0.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        borderRadius: '8px',
                        display: 'grid',
                        placeItems: 'center',
                        boxShadow: '0 4px 12px var(--primary-glow)',
                        flexShrink: 0
                    }}>
                        <Target size={18} color="white" />
                    </div>
                    {!isCollapsed && (
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>
                            ESCEN CRM
                        </h2>
                    )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {!isCollapsed && profile?.id && (
                        <NotificationBell
                            userId={profile.id}
                            onNavigate={(tab) => handleNavigate(tab)}
                        />
                    )}
                    {onToggleCollapse && (
                        <button
                            onClick={onToggleCollapse}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '6px',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                borderRadius: '8px',
                                transition: 'all 0.2s'
                            }}
                            className="desktop-only"
                            title={isCollapsed ? "Déplier la barre" : "Plier la barre"}
                        >
                            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation principal */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {menuItems.map((item) => {
                    const active = isActive(item.id);
                    return (
                        <button
                            key={item.id}
                            id={`tour-${item.id}`}
                            onClick={() => handleNavigate(item.id)}
                            title={isCollapsed ? item.label : undefined}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: isCollapsed ? 'center' : 'flex-start',
                                gap: isCollapsed ? '0' : '0.75rem',
                                padding: '0.75rem 1rem',
                                borderRadius: '12px',
                                border: 'none',
                                background: active ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                color: active ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: (isForced && item.id !== 'profile') ? 'not-allowed' : 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                fontWeight: active ? 600 : 400,
                                opacity: (isForced && item.id !== 'profile') ? 0.5 : 1,
                                width: '100%'
                            }}
                        >
                            <item.icon size={20} strokeWidth={active ? 2.5 : 2} style={{ flexShrink: 0 }} />
                            {!isCollapsed && <span style={{ fontSize: '0.925rem', whiteSpace: 'nowrap' }}>{item.label}</span>}
                        </button>
                    );
                })}
            </nav>

            {/* Pied de la Sidebar (Profil, Paramètres, Déconnexion, Toggle) */}
            <div style={{ 
                marginTop: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.25rem', 
                padding: '1rem 0', 
                borderTop: '1px solid var(--border)' 
            }}>
                {!isCollapsed && (
                    <div style={{ padding: '0 1rem', marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ESCEN CRM v2.0</div>
                    </div>
                )}

                {/* Profil */}
                <button
                    onClick={() => handleNavigate('profile')}
                    id="tour-profile"
                    title={isCollapsed ? "Mon Profil" : undefined}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: isCollapsed ? '0' : '0.75rem',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: isActive('profile') ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                        color: isActive('profile') ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        borderRadius: '12px',
                        transition: 'all 0.2s',
                        fontWeight: isActive('profile') ? 600 : 400,
                        width: '100%'
                    }}
                >
                    <UserSquare2 size={20} style={{ flexShrink: 0 }} />
                    {!isCollapsed && <span style={{ fontSize: '0.925rem', whiteSpace: 'nowrap' }}>Mon Profil</span>}
                </button>

                {/* Paramètres */}
                {isAdmin && (
                    <button
                        onClick={() => handleNavigate('settings')}
                        id="tour-settings"
                        title={isCollapsed ? "Paramètres" : undefined}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isCollapsed ? 'center' : 'flex-start',
                            gap: isCollapsed ? '0' : '0.75rem',
                            padding: '0.75rem 1rem',
                            border: 'none',
                            background: isActive('settings') ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                            color: isActive('settings') ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: isForced ? 'not-allowed' : 'pointer',
                            borderRadius: '12px',
                            transition: 'all 0.2s',
                            fontWeight: isActive('settings') ? 600 : 400,
                            opacity: isForced ? 0.5 : 1,
                            width: '100%'
                        }}
                    >
                        <Settings size={20} style={{ flexShrink: 0 }} />
                        {!isCollapsed && <span style={{ fontSize: '0.925rem', whiteSpace: 'nowrap' }}>Paramètres</span>}
                    </button>
                )}

                {/* Déconnexion */}
                <button
                    onClick={() => {
                        console.log("Forcing logout...");
                        localStorage.clear();
                        sessionStorage.clear();
                        window.location.replace('/');
                    }}
                    title={isCollapsed ? "Déconnexion" : undefined}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: isCollapsed ? '0' : '0.75rem',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'transparent',
                        color: '#ef4444',
                        cursor: 'pointer',
                        borderRadius: '10px',
                        width: '100%'
                    }}
                >
                    <LogOut size={20} style={{ flexShrink: 0 }} />
                    {!isCollapsed && <span style={{ fontSize: '0.925rem', whiteSpace: 'nowrap' }}>Déconnexion</span>}
                </button>

            </div>
        </div>
    );
};

export default Sidebar;
