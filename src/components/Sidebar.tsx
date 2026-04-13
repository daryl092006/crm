import React from 'react';
import { supabase } from '../supabaseClient';
import {
    LayoutDashboard,
    LayoutList,
    GraduationCap,
    Target,
    UserSquare2,
    Settings,
    LogOut
} from 'lucide-react';
import NotificationBell from './NotificationBell';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    profile: import('../types').Profile | null;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, profile }) => {
    const isAdmin = profile?.role === 'admin';
    const isForced = profile?.must_change_password === true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const menuItems: { id: string; label: string; icon: any }[] = [
        { id: 'dashboard', label: isAdmin ? 'Tableau de Bord' : 'Mon Dashboard', icon: LayoutDashboard },
        { id: 'pipeline', label: 'Pipeline IA', icon: LayoutList },
        { id: 'leads', label: 'Prospects (Liste)', icon: GraduationCap },
        { id: 'campaigns', label: 'Campagnes', icon: Target },
        ...(isAdmin ? [{ id: 'agents', label: 'Mon Équipe', icon: UserSquare2 }] : []),
    ];

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        borderRadius: '8px',
                        display: 'grid',
                        placeItems: 'center',
                        boxShadow: '0 4px 12px var(--primary-glow)'
                    }}>
                        <Target size={18} color="white" />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em' }}>ESCEN CRM</h2>
                </div>
                {profile?.id && <NotificationBell userId={profile.id} onNavigate={setActiveTab} />}
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        id={`tour - ${item.id} `}
                        onClick={() => !isForced && setActiveTab(item.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === item.id ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                            color: activeTab === item.id ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: isForced ? 'not-allowed' : 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            fontWeight: activeTab === item.id ? 600 : 400,
                            opacity: isForced ? 0.5 : 1
                        }}
                    >
                        <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                        <span style={{ fontSize: '0.925rem' }}>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '1rem 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Elite CRM v2.0</div>
                </div>

                <button
                    onClick={() => setActiveTab('profile')}
                    id="tour-profile"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: activeTab === 'profile' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                        color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        borderRadius: '12px',
                        transition: 'all 0.2s',
                        fontWeight: activeTab === 'profile' ? 600 : 400,
                    }}
                >
                    <UserSquare2 size={20} />
                    <span style={{ fontSize: '0.925rem' }}>Mon Profil</span>
                </button>

                {isAdmin && (
                    <button
                        onClick={() => !isForced && setActiveTab('settings')}
                        id="tour-settings"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            border: 'none',
                            background: activeTab === 'settings' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                            color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: isForced ? 'not-allowed' : 'pointer',
                            borderRadius: '12px',
                            transition: 'all 0.2s',
                            fontWeight: activeTab === 'settings' ? 600 : 400,
                            opacity: isForced ? 0.5 : 1
                        }}
                    >
                        <Settings size={20} />
                        <span style={{ fontSize: '0.925rem' }}>Paramètres</span>
                    </button>
                )}
                <button
                    onClick={() => {
                        console.log("Forcing logout...");
                        localStorage.clear();
                        sessionStorage.clear();
                        window.location.replace('/');
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'transparent',
                        color: '#ef4444',
                        cursor: 'pointer',
                        borderRadius: '10px',
                    }}
                >
                    <LogOut size={20} />
                    <span style={{ fontSize: '0.925rem' }}>Déconnexion</span>
                </button>
            </div>
        </div >
    );
};

export default Sidebar;
