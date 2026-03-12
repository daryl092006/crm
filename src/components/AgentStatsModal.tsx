import React, { useState } from 'react';
import { X, Clock, Target, CheckCircle2, Mail, Download, Edit2 } from 'lucide-react';
import type { Agent, Campaign } from '../types';
import CommunicationCenter from './CommunicationCenter';
import { supabase } from '../supabaseClient';
import Pipeline from './Pipeline';
import LeadExportModal from './LeadExportModal';
import { usePopup } from './Popup';
import * as XLSX from 'xlsx';
import { useToast } from './Toast';


interface AgentStatsModalProps {
    agent: Agent | null;
    leads: any[];
    setLeads: React.Dispatch<React.SetStateAction<any[]>>;
    statuses: any[];
    campaigns: Campaign[];
    agents: Agent[];
    profile: any;
    onClose: () => void;
}

const AgentStatsModal: React.FC<AgentStatsModalProps> = ({ agent, leads, setLeads, statuses, campaigns, agents, profile, onClose }) => {
    const { addToast } = useToast();
    const { showConfirm, showPrompt } = usePopup();
    const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);


    if (!agent) return null;

    const handleUpdateStatus = async (leadId: string, newStatusId: string) => {
        // Optimistic update
        const newStatus = statuses.find(s => s.id === newStatusId);
        setLeads((prev: any[]) => prev.map(lead =>
            lead.id === leadId ? { ...lead, statusId: newStatusId, status: newStatus } : lead
        ));

        const { error } = await supabase.from('leads').update({ status_id: newStatusId }).eq('id', leadId);
        if (error) {
            addToast(error.message, "error");
        }
    };

    const handleEditNote = async (leadId: string, currentNote: string) => {
        const newPart = await showPrompt(
            "Ajouter une note",
            "Saisissez votre nouveau message (le plus récent apparaîtra en haut)",
            ""
        );

        if (newPart !== null && newPart.trim() !== "") {
            const now = new Date();
            const months = ['janv.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
            const timestamp = `${now.getDate()} ${months[now.getMonth()]}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            const appendedNote = currentNote 
                ? `[${timestamp}] ${newPart}\n──────────────\n${currentNote}`
                : `[${timestamp}] ${newPart}`;

            const { error } = await supabase
                .from('leads')
                .update({ notes: appendedNote })
                .eq('id', leadId);

            if (error) {
                addToast("Erreur lors de la mise à jour de la note : " + error.message, "error");
            } else {
                setLeads((prev: any[]) => prev.map(l => l.id === leadId ? { ...l, notes: appendedNote } : l));
                addToast("Note ajoutée", "success");
            }
        }
    };

    const handleSetPhoneStatus = async (leadId: string, currentMetadata: any, status: boolean | string | undefined) => {
        const newMetadata = { ...(currentMetadata || {}), hasWhatsApp: status };

        const { error } = await supabase
            .from('leads')
            .update({ metadata: newMetadata })
            .eq('id', leadId);

        if (error) {
            addToast("Erreur lors de la mise à jour du statut : " + error.message, "error");
        } else {
            setLeads((prev: any[]) => prev.map(l => l.id === leadId ? { ...l, metadata: newMetadata } : l));
            addToast(`Statut mis à jour`, "info");
        }
    };

    const handleReassignAgent = async (leadId: string, newAgentId: string) => {
        const confirmed = await showConfirm(
            "Réassignation",
            "Êtes-vous sûr de vouloir transférer ce prospect à un autre conseiller ?",
            "info"
        );

        if (confirmed) {
            setLeads((prev: any[]) => prev.map(lead =>
                lead.id === leadId ? { ...lead, agentId: newAgentId } : lead
            ));

            const { error } = await supabase.from('leads').update({ agent_id: newAgentId }).eq('id', leadId);
            if (error) {
                addToast("Erreur lors de la réassignation : " + error.message, "error");
            } else {
                addToast("Prospect réassigné avec succès.", "success");
            }
        }
    };

    const handleExport = (selectedColumns: string[]) => {
        if (!agent) return;

        const columnMap: Record<string, string> = {
            'firstName': 'Prénom',
            'lastName': 'Nom',
            'email': 'Email',
            'phone': 'Téléphone',
            'country': 'Pays',
            'city': 'Ville',
            'fieldOfInterest': 'Filière',
            'level': 'Niveau',
            'statusId': 'Statut',
            'notes': 'Notes',
            'score': 'Score',
            'createdAt': 'Date Ajout'
        };

        const dataToExport = leads.map(l => {
            const row: Record<string, any> = {};
            selectedColumns.forEach(colId => {
                const label = columnMap[colId] || colId;
                if (colId === 'statusId') {
                    row[label] = l.status?.label || l.statusId;
                } else if (colId === 'createdAt') {
                    row[label] = new Date(l.createdAt).toLocaleDateString();
                } else {
                    row[label] = (l as any)[colId];
                }
            });
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Mes Prospects");
        XLSX.writeFile(workbook, `prospects_${agent.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
        addToast("Prospects exportés avec succès !", "success");
        setIsExportModalOpen(false);
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
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <button 
                                onClick={() => setIsExportModalOpen(true)} 
                                className="btn" 
                                style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Download size={16} /> Exporter
                            </button>
                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
                                <button onClick={() => setViewMode('list')} className={`btn ${viewMode === 'list' ? 'btn-primary' : ''}`} style={{ padding: '4px 12px', fontSize: '0.8125rem' }}>Liste</button>
                                <button onClick={() => setViewMode('pipeline')} className={`btn ${viewMode === 'pipeline' ? 'btn-primary' : ''}`} style={{ padding: '4px 12px', fontSize: '0.8125rem' }}>Pipeline</button>
                            </div>
                        </div>
                    </div>


                    {viewMode === 'list' ? (
                        <div className="card" style={{ padding: 0, background: 'rgba(255,255,255,0.01)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                                    <tr>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Prospect</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Numéro</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Statut / Gestion</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Conseiller</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Statut Numéro</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Notes (Historique)</th>
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
                                                    label={lead.phone || 'N/A'}
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
                                                    {statuses
                                                        .filter(s => !s.label.toLowerCase().includes('faux'))
                                                        .map((s: any) => (
                                                            <option key={s.id} value={s.id} style={{ background: '#1a1b1e' }}>{s.label}</option>
                                                        ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <select
                                                    value={lead.agentId}
                                                    onChange={(e) => handleReassignAgent(lead.id, e.target.value)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid var(--border)',
                                                        color: 'white',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer',
                                                        maxWidth: '120px'
                                                    }}
                                                >
                                                    {agents.map((a: Agent) => (
                                                        <option key={a.id} value={a.id} style={{ background: '#1a1b1e' }}>{a.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <select
                                                    value={lead.metadata?.hasWhatsApp === undefined ? 'none' : String(lead.metadata?.hasWhatsApp)}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const status = val === 'true' ? true : val === 'false' ? false : val === 'wrong' ? 'wrong' : undefined;
                                                        handleSetPhoneStatus(lead.id, lead.metadata, status);
                                                    }}
                                                    style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        background: lead.metadata?.hasWhatsApp === true 
                                                            ? 'rgba(34, 197, 94, 0.1)' 
                                                            : lead.metadata?.hasWhatsApp === false 
                                                                ? 'rgba(239, 68, 68, 0.1)' 
                                                                : lead.metadata?.hasWhatsApp === 'wrong'
                                                                    ? 'rgba(249, 115, 22, 0.1)'
                                                                    : 'rgba(255, 255, 255, 0.05)',
                                                        color: lead.metadata?.hasWhatsApp === true 
                                                            ? '#22c55e' 
                                                            : lead.metadata?.hasWhatsApp === false 
                                                                ? '#ef4444' 
                                                                : lead.metadata?.hasWhatsApp === 'wrong'
                                                                    ? '#f97316'
                                                                    : 'var(--text-muted)',
                                                        border: '1px solid var(--border)',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer',
                                                        outline: 'none',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    <option value="none" style={{ background: '#1a1b1e', color: 'var(--text-muted)' }}>Vérifier</option>
                                                    <option value="true" style={{ background: '#1a1b1e', color: '#22c55e' }}>WhatsApp</option>
                                                    <option value="false" style={{ background: '#1a1b1e', color: '#ef4444' }}>Pas WA</option>
                                                    <option value="wrong" style={{ background: '#1a1b1e', color: '#f97316' }}>Faux Numéro</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '1rem', minWidth: '200px' }}>
                                                <div 
                                                    onClick={() => handleEditNote(lead.id, lead.notes || '')}
                                                    style={{ 
                                                        fontSize: '0.75rem', 
                                                        color: lead.notes ? 'var(--text-main)' : 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        background: lead.notes ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                                                        padding: lead.notes ? '8px' : '0',
                                                        borderRadius: '8px',
                                                        border: lead.notes ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                                                        maxWidth: '300px',
                                                        maxHeight: '80px',
                                                        overflowY: 'auto',
                                                        whiteSpace: 'pre-wrap',
                                                        lineHeight: '1.4'
                                                    }}
                                                    title={lead.notes || "Ajouter une note"}
                                                >
                                                    {lead.notes ? (
                                                        <div style={{ position: 'relative' }}>
                                                            {lead.notes.split('\n──────────────\n')[0]}
                                                            {lead.notes.includes('\n──────────────\n') && (
                                                                <div style={{ marginTop: '4px', fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600 }}>
                                                                    + Historique...
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Edit2 size={12} /> Ajouter une note
                                                        </span>
                                                    )}
                                                </div>
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

                <LeadExportModal 
                    isOpen={isExportModalOpen} 
                    onClose={() => setIsExportModalOpen(false)}
                    onExport={handleExport}
                />
            </div>

        </div>
    );
};

export default AgentStatsModal;
