import React, { useState } from 'react';
import { UserSquare2, TrendingUp, Award, MoreVertical, Trash2 } from 'lucide-react';
import { usePopup } from './Popup';
import type { Agent, Campaign } from '../types';
import { useToast } from './Toast';
import AgentStatsModal from './AgentStatsModal';
import AddAgentModal from './AddAgentModal';
import InvitationsManagerModal from './InvitationsManagerModal';
import { supabase } from '../supabaseClient';

interface AgentsProps {
    profile: import('../types').Profile | null;
    agents: Agent[];
    leads: import('../types').StudentLead[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLeads: React.Dispatch<React.SetStateAction<any[]>>;
    campaigns: Campaign[];
    statuses: import('../types').LeadStatus[];
    onRefresh?: () => Promise<void>;
}

const Agents: React.FC<AgentsProps> = ({ profile, agents, leads, setLeads, campaigns, statuses, onRefresh }) => {
    const { addToast } = useToast();
    const { showConfirm } = usePopup();
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isInviteManagerOpen, setIsInviteManagerOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);


    const handleUpdateRole = async (agentId: string, newRole: string) => {
        if (agentId === profile?.id) {
            addToast("Vous ne pouvez pas modifier votre propre rôle.", "warning");
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', agentId);

            if (error) throw error;
            addToast("Rôle mis à jour avec succès", "success");
            if (onRefresh) await onRefresh();
        } catch (error: unknown) {
            addToast((error as Error).message, "error");
        }
    };


    const handleDeleteAgent = async (agentId: string, agentName: string) => {
        const confirmed = await showConfirm(
            "Supprimer le conseiller",
            `ATTENTION : Vous allez supprimer ${agentName}. Cela effacera aussi TOUT son historique d'interactions et désassignera ses leads. Voulez-vous continuer ?`,
            "error"
        );

        if (!confirmed) return;

        setIsDeleting(agentId);
        try {
            // 1. Calcul de la réattribution
            const activeOtherAgents = agents.filter(a => a.id !== agentId && a.isActive);
            const agentLeads = leads.filter(l => l.agentId === agentId);

            if (activeOtherAgents.length > 0 && agentLeads.length > 0) {
                addToast(`Réattribution de ${agentLeads.length} prospects en cours...`, "info");

                // Répartition Round-Robin
                for (let i = 0; i < agentLeads.length; i++) {
                    const targetAgent = activeOtherAgents[i % activeOtherAgents.length];
                    await supabase
                        .from('leads')
                        .update({ agent_id: targetAgent.id })
                        .eq('id', agentLeads[i].id);
                }
            } else if (activeOtherAgents.length === 0 && agentLeads.length > 0) {
                // Si plus aucun agent, on désassigne (met à null)
                await supabase
                    .from('leads')
                    .update({ agent_id: null })
                    .eq('agent_id', agentId);
            }

            // 2. Supprimer les interactions liées à cet agent
            await supabase
                .from('lead_interactions')
                .delete()
                .eq('agent_id', agentId);

            // 3. Supprimer le profil final
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', agentId);

            if (error) throw error;

            addToast(`${agentName} supprimé. Ses prospects ont été réassignés aux agents actifs.`, "success");
            if (onRefresh) await onRefresh();
        } catch (error: unknown) {
            addToast((error as Error).message || "Erreur lors de la suppression complète", "error");
        } finally {
            setIsDeleting(null);
        }
    };


    const handleAddAgent = async (fullName: string, email: string, role: string) => {
        try {
            if (!profile?.organization_id) throw new Error("ID d'organisation introuvable");

            addToast(`🚀 Création immédiate pour ${fullName}...`, "info");

            const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emd4aGZ3dXhwdm5veHZzY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDgzMjgsImV4cCI6MjA4ODcyNDMyOH0.raMGoau9uxCzHzQlIqrDMIEbwXp8QHJ6ZvCjuCgAPyY';

            // --- APPEL "BYPASS" (Utilise la clé anon comme jeton maître) ---
            const response = await fetch('https://ryzgxhfwuxpvnoxvscbk.supabase.co/functions/v1/create-agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${anonKey}`,
                    'apikey': anonKey
                },
                body: JSON.stringify({
                    fullName,
                    email: email.trim(),
                    role,
                    organizationId: profile.organization_id
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Erreur serveur (${response.status})`);
            }

            const data = await response.json();
            if (data?.error) throw new Error(data.error);

            addToast(`${fullName} créé avec succès ! Ses accès ont été mailés.`, "success");
            if (onRefresh) await onRefresh();
            setIsAddModalOpen(false);
        } catch (error: unknown) {
            console.error("Create agent error:", error);
            addToast((error as Error).message || "Erreur lors de la création de l'agent", "error");
            throw error;
        }
    };

    return (
        <div className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Équipe de Conseillers</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem', fontSize: '0.875rem' }}>Performances et attribution des prospects.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary">
                        <UserSquare2 size={16} /> Ajouter un Agent
                    </button>
                </div>
            </div>


            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '1.5rem' }}>
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Performance</p>
                            <h3 style={{ fontSize: '1.375rem', fontWeight: 800, marginTop: '0.5rem' }}>
                                {(() => {
                                    if (agents.length === 0) return 'Aucun agent';
                                    const topAgent = [...agents].sort((a, b) => b.conversionRate - a.conversionRate)[0];
                                    if (topAgent && topAgent.conversionRate > 0) return topAgent.name;
                                    return 'À définir';
                                })()}
                            </h3>
                        </div>
                        <div style={{ padding: '8px', background: 'rgba(255,215,0,0.1)', borderRadius: '10px', border: '1px solid rgba(255,215,0,0.2)' }}>
                            <Award size={20} color="#ffd700" />
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Délai moyen de relance</p>
                            <h3 style={{ fontSize: '1.875rem', fontWeight: 900, marginTop: '0.5rem', letterSpacing: '-0.02em' }}>
                                {agents.length > 0
                                    ? (agents.reduce((acc, a) => acc + (a.avgResponseTime || 0), 0) / agents.length).toFixed(1)
                                    : 0}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '3px' }}>h</span>
                            </h3>
                        </div>
                        <div style={{ padding: '8px', background: 'rgba(16,185,129,0.1)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <TrendingUp size={20} color="var(--success)" />
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agents actifs</p>
                            <h3 style={{ fontSize: '1.875rem', fontWeight: 900, marginTop: '0.5rem', letterSpacing: '-0.02em' }}>
                                {agents.filter(a => a.isActive).length}
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '4px' }}>/ {agents.length}</span>
                            </h3>
                        </div>
                        <div style={{ padding: '8px', background: 'rgba(99,102,241,0.1)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)' }}>
                            <UserSquare2 size={20} color="var(--primary)" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Conseiller</th>
                            <th>Rôle</th>
                            <th>Niveau</th>
                            <th>Charge</th>
                            <th>Conv. %</th>
                            <th style={{ width: '120px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agents.map((agent) => (
                            <tr key={agent.id} className="hover-row">
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '38px', height: '38px', borderRadius: '12px',
                                            background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
                                            display: 'grid', placeItems: 'center',
                                            fontWeight: 800, color: 'white', fontSize: '0.8rem',
                                            flexShrink: 0,
                                        }}>
                                            {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{agent.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>{agent.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <select
                                        value={agent.role}
                                        onChange={(e) => handleUpdateRole(agent.id, e.target.value)}
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            color: 'white',
                                            fontSize: '0.75rem',
                                            padding: '4px 8px',
                                            fontWeight: 600
                                        }}
                                    >
                                        <option value="agent">Agent</option>
                                        <option value="super_agent">Super Agent</option>
                                        <option value="observer">Observateur</option>
                                        <option value="super_admin">Super Admin</option>
                                    </select>
                                </td>
                                <td>
                                    <span style={{
                                        padding: '3px 9px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                                        background: agent.capacityWeight === 3 ? 'rgba(139,92,246,0.12)' : agent.capacityWeight === 2 ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.05)',
                                        color: agent.capacityWeight === 3 ? '#a78bfa' : agent.capacityWeight === 2 ? 'var(--primary)' : 'var(--text-muted)',
                                        border: `1px solid ${agent.capacityWeight === 3 ? 'rgba(139,92,246,0.25)' : agent.capacityWeight === 2 ? 'rgba(99,102,241,0.25)' : 'var(--border)'}`,
                                    }}>
                                        {agent.capacityWeight === 3 ? 'Senior' : agent.capacityWeight === 2 ? 'Standard' : 'Junior'}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '5px' }}>{agent.leadsAssigned} prospects</div>
                                    <div style={{ width: '90px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                                        <div style={{
                                            width: `${Math.min((agent.leadsAssigned / (agent.capacityWeight * 20)) * 100, 100)}%`,
                                            height: '100%',
                                            background: agent.leadsAssigned > (agent.capacityWeight * 20) ? 'var(--danger)' : 'var(--primary)',
                                            borderRadius: '2px',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                </td>
                                <td>
                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: agent.conversionRate > 20 ? 'var(--success)' : agent.conversionRate > 10 ? 'var(--warning)' : 'var(--text-muted)' }}>
                                        {agent.conversionRate}%
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                                        <button
                                            onClick={() => setSelectedAgent(agent)}
                                            className="btn btn-ghost"
                                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 700 }}
                                        >
                                            Stats
                                        </button>
                                        <button
                                            onClick={() => handleDeleteAgent(agent.id, agent.name)}
                                            disabled={isDeleting === agent.id}
                                            className="btn btn-danger"
                                            style={{ padding: '0.4rem 0.625rem', fontSize: '0.75rem' }}
                                            title="Supprimer"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AgentStatsModal
                agent={selectedAgent}
                leads={leads.filter(l => l.agentId === selectedAgent?.id)}
                setLeads={setLeads}
                statuses={statuses}
                agents={agents}
                campaigns={campaigns}
                onClose={() => setSelectedAgent(null)}
                onRefresh={onRefresh}
                profile={profile}
            />

            <AddAgentModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddAgent}
            />

            <InvitationsManagerModal
                isOpen={isInviteManagerOpen}
                onClose={() => setIsInviteManagerOpen(false)}
            />
        </div>
    );
};

export default Agents;
