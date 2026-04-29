import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import LeadModal from './LeadModal';
import { supabase } from '../supabaseClient';
import type { StudentLead, LeadStatus, Campaign, Agent } from '../types';
import { useToast } from './Toast';
import { usePopup } from './Popup';
import OutcomeModal from './OutcomeModal';

interface PipelineProps {
    profile: import('../types').Profile | null;
    leads: StudentLead[];
    setLeads: React.Dispatch<React.SetStateAction<StudentLead[]>>;
    campaigns?: Campaign[];
    agents: Agent[];
    statuses: LeadStatus[];
}

const Pipeline: React.FC<PipelineProps> = ({ profile, leads, setLeads, campaigns, agents, statuses }) => {
    const { addToast } = useToast();
    const { showConfirm } = usePopup();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedStatusId, setSelectedStatusId] = useState<string | undefined>(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedLeadForOutcome, setSelectedLeadForOutcome] = useState<any | null>(null);

    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'super_agent';
    const isObserver = profile?.role === 'observer';
    const canSeeAll = isAdmin || isObserver;
    const myLeads = canSeeAll ? leads : leads.filter(l => l.agentId === profile?.id);

    const moveLead = async (leadId: string, newStatusId: string) => {
        if (isObserver) {
            addToast("Action non autorisée : Les observateurs ne peuvent pas modifier les statuts.", "warning");
            return;
        }
        const { error } = await supabase
            .from('leads')
            .update({ status_id: newStatusId })
            .eq('id', leadId);

        if (error) {
            addToast("Erreur lors du déplacement : " + (error as Error).message, "error");
            return;
        }

        const newStatus = statuses.find(s => s.id === newStatusId);
        const lead = leads.find(l => l.id === leadId);
        const adminSuffix = (profile?.id !== lead?.agentId && isAdmin) ? ` (par Admin: ${profile?.full_name})` : '';

        await supabase.from('lead_interactions').insert({
            lead_id: leadId,
            agent_id: profile?.id || lead?.agentId,
            type: 'status_change',
            content: `Pipeline : Déplacement vers ${newStatus?.label || newStatusId}` + adminSuffix
        });

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

    const PHASES = [
        { name: 'Qualification', color: '#6366f1', keywords: ['nouveau', 'injoignable', 'repondeur', 'faux_numero', 'hors_cible', 'refus_categorique', 'refus_repondre', 'pas_interesse', 'inscrit_ailleurs', 'pas_moyens', 'annee_prochaine', 'pas_disponible', 'whatsapp'] },
        { name: 'Information', color: '#22d3ee', keywords: ['interesse', 'rappel', 'reflexion', 'reorientation'] },
        { name: 'Candidature', color: '#f59e0b', keywords: ['rdv_planifie', 'dossier_recu'] },
        { name: 'Décision', color: '#10b981', keywords: ['admis', 'inscription_attente', 'inscrit'] },
    ];

    return (
        <div className="animate-fade">
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.04em', color: 'white', marginBottom: '0.5rem' }}>
                        Pipeline <span style={{ color: 'var(--primary)' }}>Commercial</span>
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
                        {myLeads.filter(l => l.statusId !== 'perdu').length} opportunités actives à travers {PHASES.length} étapes clés du parcours.
                    </p>
                </div>
                <div className="card glassmorphism" style={{ padding: '0.75rem 1.25rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>Vue en temps réel</span>
                </div>
            </div>

            <LeadModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleAddLead}
                initialStatusId={selectedStatusId}
                campaigns={campaigns || []}
                agents={agents}
                leads={leads}
                profile={profile}
                showConfirm={showConfirm}
                statuses={statuses}
            />

            {/* Kanban Board Container */}
            <div style={{
                display: 'flex',
                gap: '1.5rem',
                overflowX: 'auto',
                paddingBottom: '2rem',
                alignItems: 'flex-start',
                minHeight: '75vh'
            }}>
                {PHASES.map((phase) => {
                    const phaseStatuses = statuses.filter(s =>
                        phase.keywords.some(k => s.id.toLowerCase().includes(k) || s.label.toLowerCase().includes(k))
                    );
                    if (phaseStatuses.length === 0) return null;

                    return (
                        <div key={phase.name} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Phase Label Header */}
                            <div style={{
                                fontSize: '0.7rem', fontWeight: 900,
                                letterSpacing: '0.15em', textTransform: 'uppercase',
                                color: phase.color,
                                background: `${phase.color}10`,
                                border: `1px solid ${phase.color}25`,
                                padding: '6px 16px', borderRadius: '100px',
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                alignSelf: 'flex-start',
                            }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: phase.color }} />
                                {phase.name}
                            </div>

                            {/* Columns within Phase */}
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {phaseStatuses.map((status) => {
                                    const columnLeads = myLeads.filter(d => d.statusId === status.id);
                                    return (
                                        <div key={status.id} style={{
                                            width: '280px', flexShrink: 0,
                                            background: 'rgba(255,255,255,0.01)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '24px',
                                            display: 'flex', flexDirection: 'column',
                                            maxHeight: '70vh',
                                            transition: 'border-color 0.2s',
                                        }}>
                                            {/* Column Header */}
                                            <div style={{
                                                padding: '1.25rem',
                                                borderBottom: '1px solid var(--border)',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                background: 'rgba(255,255,255,0.01)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: status.color, boxShadow: `0 0 8px ${status.color}80` }} />
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                                        {status.label}
                                                    </span>
                                                </div>
                                                <div style={{
                                                    fontSize: '0.75rem', fontWeight: 800,
                                                    background: 'var(--border)',
                                                    padding: '2px 8px', borderRadius: '8px',
                                                    color: 'var(--text-muted)'
                                                }}>
                                                    {columnLeads.length}
                                                </div>
                                            </div>

                                            {/* Cards Scrollable Area */}
                                            <div style={{
                                                flex: 1, overflowY: 'auto',
                                                padding: '0.75rem',
                                                display: 'flex', flexDirection: 'column', gap: '0.75rem'
                                            }}>
                                                {columnLeads.map((lead) => (
                                                    <div key={lead.id}
                                                        className="card"
                                                        style={{
                                                            padding: '1.25rem',
                                                            cursor: 'pointer',
                                                            border: '1px solid var(--border)',
                                                            background: 'rgba(255,255,255,0.02)',
                                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        }}
                                                        onMouseEnter={e => {
                                                            e.currentTarget.style.borderColor = status.color;
                                                            e.currentTarget.style.transform = 'translateY(-3px)';
                                                            e.currentTarget.style.boxShadow = `0 10px 20px -10px ${status.color}40`;
                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                                        }}
                                                        onMouseLeave={e => {
                                                            e.currentTarget.style.borderColor = 'var(--border)';
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                            e.currentTarget.style.boxShadow = 'none';
                                                            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                                        }}
                                                    >
                                                        {/* Lead Avatar & Name */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                                            <div style={{
                                                                width: '32px', height: '32px', borderRadius: '10px',
                                                                background: `linear-gradient(135deg, ${status.color}20, ${status.color}40)`,
                                                                display: 'grid', placeItems: 'center',
                                                                fontSize: '0.75rem', fontWeight: 800, color: status.color,
                                                                border: `1px solid ${status.color}30`
                                                            }}>
                                                                {lead.firstName[0]}{lead.lastName[0]}
                                                            </div>
                                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {lead.firstName} {lead.lastName}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Details Grid */}
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
                                                            {lead.fieldOfInterest && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--border)' }} />
                                                                    {lead.fieldOfInterest}
                                                                </div>
                                                            )}
                                                            {lead.phone && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                                    {lead.phone}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Move Action */}
                                                        <select
                                                            value={lead.statusId}
                                                            onChange={(e) => { e.stopPropagation(); moveLead(lead.id, e.target.value); }}
                                                            onClick={e => e.stopPropagation()}
                                                            className="input"
                                                            style={{
                                                                width: '100%',
                                                                fontSize: '0.7rem',
                                                                height: '32px',
                                                                padding: '0 0.5rem',
                                                                borderRadius: '8px',
                                                                background: 'rgba(0,0,0,0.2)',
                                                                fontWeight: 700,
                                                                border: '1px solid var(--border)'
                                                            }}
                                                        >
                                                            {[...statuses].sort((a, b) => a.label.localeCompare(b.label)).map(s => (
                                                                <option key={s.id} value={s.id}>{s.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ))}

                                                {/* Add Quick Lead */}
                                                <button
                                                    onClick={() => openModalForStatus(status.id)}
                                                    className="btn btn-ghost"
                                                    style={{
                                                        width: '100%',
                                                        border: '1px dashed var(--border)',
                                                        borderRadius: '12px',
                                                        padding: '0.75rem',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 700,
                                                        color: 'var(--text-muted)',
                                                        marginTop: '0.25rem'
                                                    }}
                                                >
                                                    + Nouveau Prospect
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <OutcomeModal
                isOpen={!!selectedLeadForOutcome}
                lead={selectedLeadForOutcome}
                onClose={() => setSelectedLeadForOutcome(null)}
                onUpdate={(leadId, updates) => {
                    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
                }}
                profile={profile}
                statuses={statuses}
            />
        </div>
    );
};

export default Pipeline;
