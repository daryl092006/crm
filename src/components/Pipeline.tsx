import React, { useState } from 'react';
import { MoreHorizontal, ArrowRight } from 'lucide-react';
import LeadModal from './LeadModal';
import CommunicationCenter from './CommunicationCenter';

import type { StudentLead, LeadStatus, Interaction, Campaign, Agent } from '../types';

interface PipelineProps {
    leads: StudentLead[];
    setLeads: React.Dispatch<React.SetStateAction<StudentLead[]>>;
    campaigns?: Campaign[];
    agents: Agent[];
}

const Pipeline: React.FC<PipelineProps> = ({ leads, setLeads, campaigns, agents }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<LeadStatus | undefined>(undefined);

    const moveLead = (leadId: string, newStatus: LeadStatus) => {
        setLeads(prev => prev.map(lead =>
            lead.id === leadId ? { ...lead, status: newStatus } : lead
        ));
    };

    const handleAddLead = (lead: StudentLead) => {
        setLeads(prev => [...prev, lead]);
    };

    const openModalForStatus = (status: LeadStatus) => {
        setSelectedStatus(status);
        setIsAddModalOpen(true);
    };

    const columns: { id: LeadStatus; title: string; color: string }[] = [
        { id: 'Nouveau', title: 'Nouveau', color: 'var(--primary)' },
        { id: 'Contacté', title: 'Contacté', color: 'var(--warning)' },
        { id: 'Intéressé', title: 'Intéressé', color: 'var(--accent)' },
        { id: 'Dossier envoyé', title: 'Dossier Envoyé', color: '#8b5cf6' },
        { id: 'Dossier reçu', title: 'Dossier Reçu', color: '#c026d3' },
        { id: 'Inscrit', title: 'Inscrit', color: 'var(--success)' },
        { id: 'Perdu', title: 'Perdu', color: 'var(--danger)' },
        { id: 'Faux Numéro', title: 'Faux Numéro', color: '#dc2626' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Pipeline Recrutement</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Vue visuelle du parcours d'inscription des étudiants.</p>
                </div>
                <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Candidats actifs</div>
                        <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{leads.filter(l => l.status !== 'Perdu').length}</div>
                    </div>
                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Taux de conversion</div>
                        <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--success)' }}>24%</div>
                    </div>
                </div>
            </div>

            <LeadModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleAddLead}
                initialStatus={selectedStatus}
                campaigns={campaigns || []}
                agents={agents}
                allLeads={leads}
            />

            <div style={{
                display: 'flex',
                gap: '1.25rem',
                minHeight: '75vh',
                overflowX: 'auto',
                paddingBottom: '2rem',
                alignItems: 'flex-start'
            }}>
                {columns.map((column) => (
                    <div key={column.id} style={{
                        flex: '0 0 280px',
                        background: 'rgba(255,255,255,0.01)',
                        borderRadius: '16px',
                        padding: '1rem',
                        border: '1px solid var(--border)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1.25rem',
                            padding: '0 0.5rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: column.color }}></div>
                                <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{column.title}</h3>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>
                                {leads.filter(d => d.status === column.id).length}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            {leads.filter(d => d.status === column.id).map((lead) => (
                                <div key={lead.id} className="card" style={{
                                    padding: '1rem',
                                    cursor: 'move',
                                    transition: 'all 0.2s ease',
                                    borderTop: `2px solid ${column.color}`,
                                    background: 'var(--bg-card)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{lead.country}</span>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <select
                                                value={lead.status}
                                                onChange={(e) => moveLead(lead.id, e.target.value as LeadStatus)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'var(--text-muted)',
                                                    fontSize: '0.7rem',
                                                    cursor: 'pointer',
                                                    outline: 'none'
                                                }}
                                            >
                                                {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                            </select>
                                            <MoreHorizontal size={14} color="var(--text-muted)" />
                                        </div>
                                    </div>

                                    <h4 style={{ fontSize: '0.9375rem', marginBottom: '0.25rem', fontWeight: 600 }}>{lead.firstName} {lead.lastName}</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{lead.fieldOfInterest} - {lead.level}</p>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            {lead.agentId && (
                                                <div
                                                    title={`Assigné à : ${agents.find(a => a.id === lead.agentId)?.name || 'Inconnu'}`}
                                                    style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '50%',
                                                        background: 'var(--primary)',
                                                        fontSize: '0.65rem',
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        fontWeight: 700,
                                                        color: 'white',
                                                        border: '1px solid var(--border)'
                                                    }}
                                                >
                                                    {agents.find(a => a.id === lead.agentId)?.name.split(' ').map(n => n[0]).join('') || '?'}
                                                </div>
                                            )}
                                            <CommunicationCenter
                                                phone={lead.phone}
                                                status={lead.phoneVerification}
                                                onAction={(type) => {
                                                    if (type === 'Confirm') {
                                                        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, phoneVerification: 'WhatsApp' } : l));
                                                        return;
                                                    }
                                                    if (type === 'Verify') {
                                                        return;
                                                    }
                                                    const newInt = {
                                                        id: `int-${Date.now()}`,
                                                        type: type as Interaction['type'],
                                                        content: `Contact sortant via ${type}`,
                                                        date: new Date().toISOString(),
                                                        agentName: 'Moi'
                                                    };
                                                    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, interactions: [newInt, ...l.interactions] } : l));
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Détails</span>
                                            <ArrowRight size={12} color="var(--text-muted)" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => openModalForStatus(column.id)}
                                style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px dashed var(--border)',
                                    borderRadius: '12px',
                                    padding: '0.75rem',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.8125rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }} onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
                                + Ajouter un candidat
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Pipeline;
