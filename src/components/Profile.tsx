import React, { useState } from 'react';
import { User, Mail, Shield, Camera, Save, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from './Toast';
import { supabase } from '../supabaseClient';


import type { StudentLead, LeadStatus } from '../types';

interface ProfileProps {
    profile: any;
    leads: StudentLead[];
    statuses: LeadStatus[];
    onUpdate: () => Promise<void>;
}

const Profile: React.FC<ProfileProps> = ({ profile, leads, onUpdate }) => {
    const { addToast } = useToast();
    const [name, setName] = useState(profile?.full_name || 'Utilisateur');
    const [email, setEmail] = useState(profile?.email || '');
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const handleSave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: name,
                    email: email
                })
                .eq('id', profile.id);

            if (error) throw error;
            addToast("Profil mis à jour avec succès !", "success");
            await onUpdate();
        } catch (error: any) {
            addToast(error.message, "error");
        } finally {
            setLoading(false);
        }
    };


    return (
        <div style={{ maxWidth: '800px' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Mon Profil</h1>
                <p style={{ color: 'var(--text-muted)' }}>Gérez vos informations personnelles et vos préférences de sécurité.</p>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: 'white',
                            boxShadow: '0 8px 16px var(--primary-glow)'
                        }}>
                            {name.split(' ').map((n: string) => n[0]).join('') || '?'}
                        </div>
                        <button style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            color: 'white',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer'
                        }}>
                            <Camera size={16} />
                        </button>
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>{name}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            Membre Élite CRM • Rejoins le {new Date(profile?.created_at).toLocaleDateString()}
                        </p>
                    </div>

                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>Nom Complet</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    color: 'white',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>Adresse Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    color: 'white',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <Shield size={20} color="#a78bfa" />
                        <h4 style={{ fontWeight: 600 }}>Rôles & Permissions</h4>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Vous avez un compte <strong>Collaborateur</strong>. Dans cette version unifiée, tout le monde dispose d'un accès complet aux données pour une gestion fluide et transparente.
                    </p>

                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h4 style={{ fontWeight: 600 }}>Guide d'utilisation</h4>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Besoin d'un rappel sur le fonctionnement d'Élite CRM ?</p>
                        </div>
                        <button
                            onClick={() => {
                                localStorage.removeItem('elite_crm_tour_seen');
                                window.location.reload();
                            }}
                            className="btn"
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}
                        >
                            <Sparkles size={16} color="var(--primary)" /> Redémarrer le guide
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={loading}
                        style={{ padding: '0.75rem 2rem' }}
                    >
                        <Save size={18} /> {loading ? 'Enregistrement...' : 'Enregistrer les changements'}
                    </button>
                </div>

            </div>

            <div style={{ marginTop: '3rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Mes Prospects Assignés</h2>
                <p style={{ color: 'var(--text-muted)' }}>Liste des contacts dont vous êtes responsable.</p>
            </div>

            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>PROSPECT</th>
                            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>CONTACT</th>
                            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>STATUT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(() => {
                            const myLeads = leads.filter(l => l.agentId === profile.id);
                            const startIndex = (currentPage - 1) * itemsPerPage;
                            return myLeads.slice(startIndex, startIndex + itemsPerPage);
                        })().map(lead => (
                            <tr key={lead.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontWeight: 600 }}>{lead.firstName} {lead.lastName}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.city}, {lead.country}</div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ fontSize: '0.875rem' }}>{lead.email}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{lead.phone}</div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: lead.status?.color || 'white',
                                        background: `${lead.status?.color}22`
                                    }}>
                                        {lead.status?.label || lead.statusId}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {leads.filter(l => l.agentId === profile.id).length === 0 && (
                            <tr>
                                <td colSpan={3} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Vous n'avez aucun prospect assigné pour le moment.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {(() => {
                    const myLeads = leads.filter(l => l.agentId === profile.id);
                    const totalPages = Math.ceil(myLeads.length / itemsPerPage);
                    if (totalPages <= 1) return null;

                    return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Afficher</span>
                                <select 
                                    value={itemsPerPage} 
                                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    style={{ padding: '4px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                                >
                                    {[10, 20, 50].map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: currentPage === 1 ? 'rgba(255,255,255,0.1)' : 'white', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{currentPage} / {totalPages}</span>
                                <button 
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: currentPage === totalPages ? 'rgba(255,255,255,0.1)' : 'white', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default Profile;
