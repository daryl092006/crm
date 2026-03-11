import React, { useState } from 'react';
import { X, Clock, Target, CheckCircle2, Mail } from 'lucide-react';
import type { Agent, Campaign } from '../types';
import CommunicationCenter from './CommunicationCenter';
import { supabase } from '../supabaseClient';
import Pipeline from './Pipeline';

interface AgentStatsModalProps {
    agent: Agent | null;
    leads: any[];
    setLeads: React.Dispatch<React.SetStateAction<any[]>>;
    statuses: any[];
    campaigns: Campaign[];
    profile: any;
    onClose: () => void;
}

const AgentStatsModal: React.FC<AgentStatsModalProps> = ({ agent, leads, setLeads, statuses, campaigns, profile, onClose }) => {
    const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');

    if (!agent) return null;

    const handleUpdateStatus = async (leadId: string, newStatusId: string) => {
        // Optimistic update
        const newStatus = statuses.find(s => s.id === newStatusId);
        setLeads((prev: any[]) => prev.map(lead =>
            lead.id === leadId ? { ...lead, statusId: newStatusId, status: newStatus } : lead
        ));

        const { error } = await supabase.from('leads').update({ status_id: newStatusId }).eq('id', leadId);
        if (error) {
            alert(error.message);
            // On rollback if needed, but not strictly required for MVP
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: '2rem'
        }} onClick={onClose}>
            <div className="card" style={{ width: '100%', maxWidth: '90vw', maxHeight: '95vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            color: 'white',
                            fontSize: '1.25rem'
                        }}>
                            {agent.name.split(' ').map((n: any) => n[0]).join('')}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Espace Conseiller : {agent.name}</h2>
                            <p style={{ color: 'var(--text-muted)' }}>Gérez vos prospects et suivez vos performances en direct.</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
                    <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                            <Target size={16} /> Volume Assigné
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{agent.leadsAssigned}</div>
                    </div>
                    <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--success)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                            <CheckCircle2 size={16} /> Taux de Conv.
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{agent.conversionRate}%</div>
                    </div>
                    <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                            <Clock size={16} /> Tâches
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{agent.overdueTasksCount}</div>
                    </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Mes Prospects Assignés ({leads.length})</h3>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
                            <button onClick={() => setViewMode('list')} className={`btn ${viewMode === 'list' ? 'btn-primary' : ''}`} style={{ padding: '4px 12px', fontSize: '0.8125rem' }}>Liste</button>
                            <button onClick={() => setViewMode('pipeline')} className={`btn ${viewMode === 'pipeline' ? 'btn-primary' : ''}`} style={{ padding: '4px 12px', fontSize: '0.8125rem' }}>Pipeline</button>
                        </div>
                    </div>

                    {viewMode === 'list' ? (
                        <div className="card" style={{ padding: 0, background: 'rgba(255,255,255,0.01)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    <tr>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Prospect</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions Directes</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Statut / Gestion</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leads.length > 0 ? leads.map((lead: any) => (
                                        <tr key={lead.id} style={{ borderTop: '1px solid var(--border)' }}>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 600 }}>{lead.firstName} {lead.lastName}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12} /> {lead.email}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <CommunicationCenter
                                                    phone={lead.phone}
                                                    onAction={async (type: any) => {
                                                        const interactionType = ({
                                                            'Appel': 'call',
                                                            'WhatsApp': 'whatsapp',
                                                            'SMS': 'sms',
                                                            'Verify': 'note',
                                                            'Confirm': 'note'
                                                        } as any)[type];
                                                        await supabase.from('lead_interactions').insert({
                                                            lead_id: lead.id,
                                                            agent_id: lead.agentId,
                                                            type: interactionType || 'note',
                                                            content: `Action depuis l'espace conseiller: ${type}`
                                                        });
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <select
                                                    value={lead.statusId}
                                                    onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid var(--border)',
                                                        color: 'white',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {statuses.map((s: any) => (
                                                        <option key={s.id} value={s.id} style={{ background: '#1a1b1e' }}>{s.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {new Date(lead.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                Aucun prospect assigné actuellement.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', overflowX: 'auto' }}>
                            <Pipeline
                                leads={leads}
                                agents={[agent as any]}
                                statuses={statuses}
                                profile={profile}
                                setLeads={setLeads}
                                campaigns={campaigns}
                            />
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={onClose}>Fermer l'espace conseiller</button>
                </div>
            </div>
        </div>
    );
};

export default AgentStatsModal;
