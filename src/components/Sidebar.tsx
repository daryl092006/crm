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
    const role = profile?.role;
    const isSuperAdmin = role === 'super_admin';
    const isSuperAgent = role === 'super_agent';
    const isObserver = role === 'observer';
    const isAdmin = isSuperAdmin || isSuperAgent; // Pour la compatibilité des boutons
    
    const isForced = profile?.must_change_password === true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const menuItems: { id: string; label: string; icon: any }[] = [
        { id: 'dashboard', label: isAdmin || isObserver ? 'Tableau de Bord' : 'Mon Dashboard', icon: LayoutDashboard },
        { id: 'pipeline', label: 'Pipeline', icon: LayoutList },
        { id: 'leads', label: 'Prospects', icon: GraduationCap },
        { id: 'campaigns', label: 'Campagnes', icon: Target },
        ...(isAdmin ? [{ id: 'agents', label: 'Mon Équipe', icon: UserSquare2 }] : []),
    ];

    const navBtnStyle = (id: string): React.CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        padding: '0.75rem 1rem',
        borderRadius: '14px',
        border: '1px solid transparent',
        background: activeTab === id ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
        borderColor: activeTab === id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
        color: activeTab === id ? 'white' : 'var(--text-muted)',
        cursor: isForced ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        fontWeight: activeTab === id ? 800 : 500,
        fontSize: '0.9rem',
        fontFamily: 'inherit',
        opacity: isForced ? 0.45 : 1,
        width: '100%',
        boxShadow: activeTab === id ? '0 4px 15px -5px rgba(99, 102, 241, 0.4)' : 'none',
    });

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '1.5rem 1.25rem' }}>

            {/* Brand Logo Section */}
            <div style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '36px', height: '36px',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        borderRadius: '12px', display: 'grid', placeItems: 'center',
                        boxShadow: '0 8px 20px -5px var(--primary-glow)',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        <Target size={20} color="white" />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 950, letterSpacing: '-0.04em', color: 'white', lineHeight: 1 }}>
                            ESCEN
                        </div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '2px' }}>
                            CRM SYSTEM
                        </div>
                    </div>
                </div>
                {profile?.id && (
                    <div style={{ transform: 'scale(1.1)' }}>
                        <NotificationBell userId={profile.id} onNavigate={setActiveTab} />
                    </div>
                )}
            </div>

            {/* Navigation Menu */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        id={`tour-${item.id}`}
                        onClick={() => !isForced && setActiveTab(item.id)}
                        style={navBtnStyle(item.id)}
                        onMouseEnter={e => {
                            if (activeTab !== item.id) {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.color = 'white';
                                e.currentTarget.style.transform = 'translateX(4px)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (activeTab !== item.id) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-muted)';
                                e.currentTarget.style.transform = 'translateX(0)';
                            }
                        }}
                    >
                        <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} color={activeTab === item.id ? 'var(--primary)' : 'currentColor'} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* Sidebar Footer / User Profile */}
            <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                
                {profile && (
                    <div style={{ 
                        padding: '0.75rem', 
                        background: 'rgba(255,255,255,0.02)', 
                        borderRadius: '16px', 
                        marginBottom: '1rem',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <div style={{ 
                            width: '32px', height: '32px', borderRadius: '10px', 
                            background: 'var(--primary)', display: 'grid', placeItems: 'center',
                            fontSize: '0.8rem', fontWeight: 900, color: 'white'
                        }}>
                            {profile.full_name?.[0] || 'U'}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {profile.full_name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {isSuperAdmin ? 'Super Administrateur' : 
                                 isSuperAgent ? 'Super Agent' : 
                                 isObserver ? 'Observateur' : 'Agent Commercial'}
                            </div>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => setActiveTab('profile')}
                    id="tour-profile"
                    style={navBtnStyle('profile')}
                >
                    <UserSquare2 size={20} color={activeTab === 'profile' ? 'var(--primary)' : 'currentColor'} />
                    <span>Profil & Compte</span>
                </button>

                {isAdmin && (
                    <button
                        onClick={() => !isForced && setActiveTab('settings')}
                        id="tour-settings"
                        style={navBtnStyle('settings')}
                    >
                        <Settings size={20} color={activeTab === 'settings' ? 'var(--primary)' : 'currentColor'} />
                        <span>Réglages Plateforme</span>
                    </button>
                )}

                <button
                    onClick={() => {
                        localStorage.clear();
                        sessionStorage.clear();
                        window.location.replace('/');
                    }}
                    className="btn btn-ghost"
                    style={{
                        marginTop: '0.5rem',
                        justifyContent: 'flex-start',
                        padding: '0.75rem 1rem',
                        color: 'var(--danger)',
                        borderRadius: '14px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        gap: '0.875rem'
                    }}
                >
                    <LogOut size={20} />
                    <span>Déconnexion</span>
                </button>

                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.1em' }}>
                        VERSION 2.0.4 PREMIUM
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
