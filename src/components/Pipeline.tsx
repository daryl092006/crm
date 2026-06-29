import React, { useState } from 'react';
import { MoreHorizontal, ArrowRight } from 'lucide-react';
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
    programs: import('../types').Program[];
    classifications: import('../types').ProspectClassification[];
    sources: import('../types').ProspectSource[];
}

const Pipeline: React.FC<PipelineProps> = ({ profile, leads, setLeads, campaigns, agents, statuses, programs, classifications, sources }) => {
    const { addToast } = useToast();
    const { showConfirm } = usePopup();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedStatusId, setSelectedStatusId] = useState<string | undefined>(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedLeadForOutcome, setSelectedLeadForOutcome] = useState<any | null>(null);

    const isAdmin = profile?.role === 'admin';
    const myLeads = isAdmin ? leads : leads.filter(l => l.agentId === profile?.id);

    const moveLead = async (leadId: string, newStatusId: string) => {
        const { error } = await supabase
            .from('leads')
            .update({ status_id: newStatusId })
            .eq('id', leadId);

        if (error) {
            addToast("Erreur lors du déplacement : " + (error as Error).message, "error");
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
        <div className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.04em' }}>Pipeline Dynamique</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>Gestion visuelle du parcours de recrutement university.</p>
                </div>
                <div className="card" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '18px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>{isAdmin ? 'Total Actifs' : 'Mes Leads'}</div>
                        <div style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--primary)' }}>{myLeads.filter(l => l.statusId !== 'perdu').length}</div>
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
                leads={leads}
                profile={profile}
                showConfirm={showConfirm}
                statuses={statuses}
                programs={programs}
                classifications={classifications}
                sources={sources}
            />

            <div style={{
                display: 'flex',
                gap: '1.5rem',
                minHeight: '75vh',
                overflowX: 'auto',
                padding: '0.5rem',
                paddingBottom: '2.5rem',
                alignItems: 'flex-start',
                scrollbarWidth: 'none', // Standard
                msOverflowStyle: 'none' // IE
            }} className="no-scrollbar">
                <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                {[
                    { name: "QUALIFICATION", color: 'var(--warning)', keywords: ['nouveau', 'injoignable', 'repondeur', 'faux_numero', 'hors_cible', 'refus_categorique', 'refus_repondre', 'pas_interesse', 'inscrit_ailleurs', 'pas_moyens', 'annee_prochaine', 'pas_disponible', 'whatsapp'] },
                    { name: "INFORMATION", color: 'var(--accent)', keywords: ['interesse', 'rappel', 'reflexion', 'reorientation'] },
                    { name: "CANDIDATURE", color: 'var(--primary)', keywords: ['rdv_planifie', 'dossier_recu'] },
                    { name: "ADMISSION", color: 'var(--success)', keywords: ['admis', 'inscription_attente', 'inscrit'] }
                ].map((phase) => {
                    const phaseStatuses = statuses.filter(s =>
                        phase.keywords.some(k => s.id.toLowerCase().includes(k) || s.label.toLowerCase().includes(k))
                    );

                    if (phaseStatuses.length === 0) return null;

                    return (
                        <div key={phase.name} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flexShrink: 0 }}>
                            <div style={{
                                fontSize: '0.75rem',
                                fontWeight: 900,
                                color: 'white',
                                letterSpacing: '0.1em',
                                background: phase.color,
                                padding: '10px 20px',
                                borderRadius: '12px',
                                width: '100%',
                                textAlign: 'center',
                                boxShadow: `0 4px 15px ${phase.color}30`
                            }}>
                                {phase.name}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {phaseStatuses.map((status) => {
                                    const leadsInStatus = myLeads.filter(d => d.statusId === status.id);
                                    return (
                                        <div key={status.id} style={{
                                            flex: '0 0 300px',
                                            width: '300px',          /* force explicit width */
                                            maxWidth: '300px',       /* prevent blowout */
                                            overflow: 'hidden',      /* clip overflowing names */
                                            background: 'rgba(255,255,255,0.02)',
                                            borderRadius: '24px',
                                            padding: '1.25rem',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            minHeight: '400px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '1rem'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '0.5rem'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.color, boxShadow: `0 0 8px ${status.color}` }}></div>
                                                    <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{status.label}</h3>
                                                </div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 900, background: 'rgba(255, 255, 255, 0.05)', padding: '4px 10px', borderRadius: '8px', color: 'var(--text-muted)' }}>
                                                    {leadsInStatus.length}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {leadsInStatus.map((lead) => (
                                                    <div key={lead.id} className="card" style={{
                                                        padding: '1.25rem',
                                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        borderLeft: `3px solid ${status.color}`,
                                                        background: 'var(--bg-card)',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                                        cursor: 'pointer',
                                                        overflow: 'hidden',
                                                        minWidth: 0
                                                    }} onClick={() => setSelectedLeadForOutcome(lead)}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>{lead.country || 'Inconnu'}</span>
                                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 900, color: (lead.score || 0) > 50 ? 'var(--success)' : 'var(--text-muted)' }}>{lead.score || 0} PTS</span>
                                                            </div>
                                                        </div>

                                                        <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{lead.firstName} {lead.lastName}</h4>
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{lead.fieldOfInterest || 'Spécialité à définir'}</p>

                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{lead.phone}</div>
                                                            <ArrowRight size={14} color="var(--primary)" />
                                                        </div>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => openModalForStatus(status.id)}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.02)',
                                                        border: '1px dashed rgba(255,255,255,0.1)',
                                                        borderRadius: '16px',
                                                        padding: '1rem',
                                                        color: 'var(--text-muted)',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
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
            />
        </div>
    );
};

export default Pipeline;
