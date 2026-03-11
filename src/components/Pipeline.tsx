import React, { useState } from 'react';
import { MoreHorizontal, ArrowRight } from 'lucide-react';
import LeadModal from './LeadModal';
import CommunicationCenter from './CommunicationCenter';
import { supabase } from '../supabaseClient';
import type { StudentLead, LeadStatus, Interaction, InteractionType, Campaign, Agent } from '../types';
import { useToast } from './Toast';

interface PipelineProps {
    profile: any;
    leads: StudentLead[];
    setLeads: React.Dispatch<React.SetStateAction<StudentLead[]>>;
    campaigns?: Campaign[];
    agents: Agent[];
    statuses: LeadStatus[];
}

const Pipeline: React.FC<PipelineProps> = ({ profile, leads, setLeads, campaigns, agents, statuses }) => {
    const { addToast } = useToast();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedStatusId, setSelectedStatusId] = useState<string | undefined>(undefined);

    const moveLead = async (leadId: string, newStatusId: string) => {
        const { error } = await supabase
            .from('leads')
            .update({ status_id: newStatusId })
            .eq('id', leadId);

        if (error) {
            addToast("Erreur lors du déplacement : " + error.message, "error");
            return;
        }

        const newStatus = statuses.find(s => s.id === newStatusId);
        setLeads(prev => prev.map(lead =>
            lead.id === leadId ? { ...lead, statusId: newStatusId, status: newStatus } : lead
        ));
        addToast("Statut mis à jour", "success");
    };

    const handleAddLead = (lead: StudentLead) => {
        setLeads(prev => [...prev, lead]);
    };

    const openModalForStatus = (statusId: string) => {
        setSelectedStatusId(statusId);
        setIsAddModalOpen(true);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Pipeline Recrutement</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Vue visuelle du parcours d'inscription EliteCRM.</p>
                </div>
                <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prospects actifs</div>
                        <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{leads.filter(l => l.statusId !== 'perdu').length}</div>
                    </div>
                </div>
            </div>

            <LeadModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleAddLead}
                initialStatusId={selectedStatusId}
                campaigns={campaigns || []}
                agents={agents}
                profile={profile}
            />

            <div style={{
                display: 'flex',
                gap: '1.25rem',
                minHeight: '75vh',
                overflowX: 'auto',
                paddingBottom: '2rem',
                alignItems: 'flex-start'
            }}>
                {statuses.map((status) => (
                    <div key={status.id} style={{
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
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.color }}></div>
                                <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{status.label}</h3>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>
                                {leads.filter(d => d.statusId === status.id).length}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            {leads.filter(d => d.statusId === status.id).map((lead) => (
                                <div key={lead.id} className="card" style={{
                                    padding: '1rem',
                                    transition: 'all 0.2s ease',
                                    borderTop: `2px solid ${status.color}`,
                                    background: 'var(--bg-card)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{lead.country}</span>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <select
                                                value={lead.statusId}
                                                onChange={(e) => moveLead(lead.id, e.target.value)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'var(--text-muted)',
                                                    fontSize: '0.7rem',
                                                    cursor: 'pointer',
                                                    outline: 'none'
                                                }}
                                            >
                                                {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                            </select>
                                            <MoreHorizontal size={14} color="var(--text-muted)" />
                                        </div>
                                    </div>

                                    <h4 style={{ fontSize: '0.9375rem', marginBottom: '0.25rem', fontWeight: 600 }}>{lead.firstName} {lead.lastName}</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{lead.fieldOfInterest}</p>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <CommunicationCenter
                                                phone={lead.phone}
                                                onAction={async (type) => {
                                                    const interactionType = {
                                                        'Appel': 'call',
                                                        'WhatsApp': 'whatsapp',
                                                        'SMS': 'sms',
                                                        'Verify': 'note',
                                                        'Confirm': 'note'
                                                    }[type] as InteractionType;

                                                    const newInt: Interaction = {
                                                        id: `int-${Date.now()}`,
                                                        leadId: lead.id,
                                                        agentId: lead.agentId,
                                                        type: interactionType,
                                                        content: `Contact via ${type}`,
                                                        createdAt: new Date().toISOString()
                                                    };

                                                    await supabase.from('lead_interactions').insert({
                                                        lead_id: lead.id,
                                                        agent_id: lead.agentId,
                                                        type: interactionType,
                                                        content: `Contact via ${type}`
                                                    });

                                                    setLeads(prev => prev.map(l => l.id === lead.id ? {
                                                        ...l,
                                                        interactions: [newInt, ...(l.interactions || [])]
                                                    } : l));
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{lead.score} pts</span>
                                            <ArrowRight size={12} color="var(--text-muted)" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => openModalForStatus(status.id)}
                                className="btn-add-lead-ghost"
                                style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px dashed var(--border)',
                                    borderRadius: '12px',
                                    padding: '0.75rem',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.8125rem',
                                    cursor: 'pointer'
                                }}>
                                + Ajouter
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Pipeline;
