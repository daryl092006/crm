import React from 'react';
import { Settings as SettingsIcon, Shield, Bell, Database, Users } from 'lucide-react';

const Settings: React.FC = () => {
    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Paramètres du Workspace</h1>
                <p style={{ color: 'var(--text-muted)' }}>Gérez votre organisation, vos intégrations et vos préférences.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div className="card">
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px' }}>
                            <Shield size={24} color="var(--primary)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Sécurité & Rôles</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Gérez les permissions et l'accès des conseillers.</p>
                        </div>
                    </div>
                    <button className="btn" style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: 'white' }}>Configurer</button>
                </div>

                <div className="card">
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px' }}>
                            <Bell size={24} color="var(--warning)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Notifications</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Configurez les alertes WhatsApp et Email système.</p>
                        </div>
                    </div>
                    <button className="btn" style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: 'white' }}>Gérer</button>
                </div>

                <div className="card">
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>
                            <Database size={24} color="var(--success)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Intégrations (API)</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Connectez Meta Ads, TikTok et vos outils d'envoi.</p>
                        </div>
                    </div>
                    <button className="btn" style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: 'white' }}>Connecter</button>
                </div>

                <div className="card">
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px' }}>
                            <Users size={24} color="#8b5cf6" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Profil Entreprise</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Informations légales et branding EliteCRM.</p>
                        </div>
                    </div>
                    <button className="btn" style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: 'white' }}>Éditer</button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
