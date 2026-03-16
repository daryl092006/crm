import React from 'react';
import { supabase } from '../supabaseClient';
import {
    LayoutDashboard,
    Target,

    UserSquare2,
    Settings,
    LogOut
} from 'lucide-react';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
    const menuItems: { id: string; label: string; icon: any }[] = [
        { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
        { id: 'campaigns', label: 'Campagnes', icon: Target },
        { id: 'agents', label: 'Conseillers', icon: UserSquare2 },
    ];

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em' }}>EliteCRM</h2>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        id={`tour - ${item.id} `}
                        onClick={() => setActiveTab(item.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: activeTab === item.id ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                            color: activeTab === item.id ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            fontWeight: activeTab === item.id ? 600 : 400,
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

                <button
                    onClick={() => setActiveTab('settings')}
                    id="tour-settings"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: activeTab === 'settings' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                        color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        borderRadius: '12px',
                        transition: 'all 0.2s',
                        fontWeight: activeTab === 'settings' ? 600 : 400,
                    }}
                >
                    <Settings size={20} />
                    <span style={{ fontSize: '0.925rem' }}>Paramètres</span>
                </button>
                <button
                    onClick={async () => {
                        const { error } = await supabase.auth.signOut();
                        if (error) alert(error.message);
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
        </div>
    );
};

export default Sidebar;
