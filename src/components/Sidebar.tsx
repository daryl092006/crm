import React from 'react';
import { supabase } from '../supabaseClient';
import {
    LayoutDashboard,
    Target,

    MessageSquare,
    UserSquare2,
    Settings,
    LogOut
} from 'lucide-react';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    role: 'admin' | 'agent';
    setRole: (role: 'admin' | 'agent') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, role, setRole }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'campaigns', label: 'Campagnes', icon: Target },
        ...(role === 'admin' ? [{ id: 'agents', label: 'Équipe / Agents', icon: UserSquare2 }] : []),
        { id: 'messaging', label: 'Messagerie', icon: MessageSquare },
    ];

    return (
        <div className="sidebar">
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
                <div style={{ marginBottom: '1rem', padding: '0 1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Mode Actuel :</div>
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px' }}>
                        <button
                            onClick={() => setRole('agent')}
                            style={{ flex: 1, border: 'none', background: role === 'agent' ? 'var(--primary)' : 'transparent', color: role === 'agent' ? 'white' : 'var(--text-muted)', borderRadius: '6px', padding: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                            Agent
                        </button>
                        <button
                            onClick={() => setRole('admin')}
                            style={{ flex: 1, border: 'none', background: role === 'admin' ? 'var(--primary)' : 'transparent', color: role === 'admin' ? 'white' : 'var(--text-muted)', borderRadius: '6px', padding: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                            Admin
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => alert('Paramètres bientôt disponibles')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        borderRadius: '10px',
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
