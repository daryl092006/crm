import React, { useState } from 'react';
import { UserSquare2, TrendingUp, Award, MoreVertical, Trash2, Search, Users } from 'lucide-react';
import { usePopup } from './Popup';
import type { Agent, Campaign, UserRole } from '../types';
import { useToast } from './Toast';
import AgentStatsModal from './AgentStatsModal';
import AddAgentModal from './AddAgentModal';
import InvitationsManagerModal from './InvitationsManagerModal';
import { supabase } from '../supabaseClient';
import { notifyAgentAccess } from '../utils/emailNotificationService';

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
    const [searchTerm, setSearchTerm] = useState('');


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


    const handleAddAgent = async (fullName: string, email: string, role: UserRole = 'agent') => {
        try {
            if (!profile?.organization_id) throw new Error("ID d'organisation introuvable");

            addToast(`Création en cours pour ${fullName}...`, "info");

            // Récupère le token JWT de la session active de l'utilisateur connecté
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Session expirée, veuillez vous reconnecter.");

            const response = await fetch('https://ryzgxhfwuxpvnoxvscbk.supabase.co/functions/v1/create-agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    fullName,
                    email: email.trim(),
                    role,           // Transmet le rôle choisi (TASK-DB-001)
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

    const getAvatarGradient = (name: string) => {
        const colors = [
            'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', // Indigo/Purple
            'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', // Blue
            'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald
            'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', // Pink
            'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber
            'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', // Cyan
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    };

    const filteredAgents = agents.filter(agent => 
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        agent.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 800, background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>
                        Équipe de Conseillers
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.95rem' }}>Gérez les performances et l'attribution des prospects en temps réel.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                    <button
                        onClick={() => setIsInviteManagerOpen(true)}
                        className="btn"
                        style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: 'white',
                            padding: '12px 18px',
                            borderRadius: '12px',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center'
                        }}
                    >
                        Invitations
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="btn btn-primary"
                        style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '12px 20px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
                    >
                        <UserSquare2 size={18} />
                        Ajouter un Agent
                    </button>
                </div>
            </div>

            {/* Stat Grid with Modern Radial Gradients & Glows */}
            <div className="stat-grid" style={{ marginBottom: '2.5rem' }}>
                {/* Stat 1: Top Agent */}
                <div className="glass-card" style={{
                    background: 'radial-gradient(130% 100% at 0% 0%, rgba(99, 102, 241, 0.12) 0%, rgba(20, 20, 23, 0.4) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.18)',
                    borderRadius: '24px',
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
                }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent Top Performance</p>
                        <h3 style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '0.5rem', letterSpacing: '-0.01em' }}>
                            {(() => {
                                if (agents.length === 0) return 'Aucun agent';
                                const topAgent = [...agents].sort((a, b) => b.conversionRate - a.conversionRate)[0];
                                if (topAgent && topAgent.conversionRate > 0) return topAgent.name;
                                return 'À définir';
                            })()}
                        </h3>
                    </div>
                    <div style={{ background: 'rgba(255, 215, 0, 0.1)', padding: '12px', borderRadius: '16px' }}>
                        <Award size={26} color="#ffd700" />
                    </div>
                </div>

                {/* Stat 2: Avg Response Time */}
                <div className="glass-card" style={{
                    background: 'radial-gradient(130% 100% at 0% 0%, rgba(16, 185, 129, 0.12) 0%, rgba(20, 20, 23, 0.4) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.18)',
                    borderRadius: '24px',
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
                }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Délai moyen de relance</p>
                        <h3 style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '0.5rem', letterSpacing: '-0.01em' }}>
                            {agents.length > 0
                                ? (agents.reduce((acc, a) => acc + (a.avgResponseTime || 0), 0) / agents.length).toFixed(1)
                                : 0}h
                        </h3>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '16px' }}>
                        <TrendingUp size={26} color="var(--success)" />
                    </div>
                </div>

                {/* Stat 3: Total Agents & Capacity */}
                <div className="glass-card" style={{
                    background: 'radial-gradient(130% 100% at 0% 0%, rgba(34, 211, 238, 0.12) 0%, rgba(20, 20, 23, 0.4) 100%)',
                    border: '1px solid rgba(34, 211, 238, 0.18)',
                    borderRadius: '24px',
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
                }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Effectif Actif</p>
                        <h3 style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '0.5rem', letterSpacing: '-0.01em' }}>
                            {agents.filter(a => a.isActive).length} / {agents.length} Agents
                        </h3>
                    </div>
                    <div style={{ background: 'rgba(34, 211, 238, 0.1)', padding: '12px', borderRadius: '16px' }}>
                        <Users size={26} color="var(--accent)" />
                    </div>
                </div>
            </div>

            {/* Filter / Search Bar */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Rechercher un conseiller par nom ou email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 16px 12px 48px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '14px',
                            color: 'white',
                            fontSize: '0.9rem',
                            outline: 'none',
                            transition: 'all 0.2s ease',
                        }}
                    />
                </div>
            </div>

            {/* Table Redesign */}
            <div className="table-container" style={{ border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px', background: 'rgba(10, 10, 12, 0.4)' }}>
                <table style={{ minWidth: '800px', borderCollapse: 'separate', borderSpacing: '0' }}>
                    <thead>
                        <tr>
                            <th style={{ background: 'rgba(15, 16, 20, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem 1.5rem' }}>Conseiller</th>
                            <th style={{ background: 'rgba(15, 16, 20, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem 1.5rem' }}>Capacité</th>
                            <th style={{ background: 'rgba(15, 16, 20, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem 1.5rem' }}>Charge (Leads)</th>
                            <th style={{ background: 'rgba(15, 16, 20, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem 1.5rem' }}>Alertes / Tâches</th>
                            <th style={{ background: 'rgba(15, 16, 20, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem 1.5rem' }}>Conv. %</th>
                            <th style={{ background: 'rgba(15, 16, 20, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.25rem 1.5rem', width: '100px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAgents.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                    Aucun conseiller trouvé.
                                </td>
                            </tr>
                        ) : (
                            filteredAgents.map((agent) => {
                                // Dynamic leads progress bar calculations
                                const maxExpectedLeads = agent.capacityWeight * 20;
                                const chargePercent = Math.min((agent.leadsAssigned / maxExpectedLeads) * 100, 100);
                                
                                // Color dynamically updated based on the load
                                let chargeColor = 'var(--success)';
                                if (chargePercent > 85) {
                                    chargeColor = 'var(--danger)';
                                } else if (chargePercent > 55) {
                                    chargeColor = 'var(--warning)';
                                }

                                return (
                                    <tr key={agent.id} style={{ transition: 'background 0.2s ease' }}>
                                        <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '12px',
                                                    background: getAvatarGradient(agent.name),
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    fontWeight: 700,
                                                    color: 'white',
                                                    fontSize: '0.95rem',
                                                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                                                    opacity: agent.isActive ? 1 : 0.6
                                                }}>
                                                    {agent.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {agent.name}
                                                        {!agent.isActive && (
                                                            <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px' }}>Inactif</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{agent.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <span style={{
                                                padding: '5px 10px',
                                                borderRadius: '8px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                background: agent.capacityWeight === 3 
                                                    ? 'rgba(167, 139, 250, 0.1)' 
                                                    : agent.capacityWeight === 2 
                                                        ? 'rgba(16, 185, 129, 0.1)' 
                                                        : 'rgba(59, 130, 246, 0.1)',
                                                color: agent.capacityWeight === 3 
                                                    ? '#c084fc' 
                                                    : agent.capacityWeight === 2 
                                                        ? '#34d399' 
                                                        : '#60a5fa',
                                                border: agent.capacityWeight === 3 
                                                    ? '1px solid rgba(167, 139, 250, 0.2)' 
                                                    : agent.capacityWeight === 2 
                                                        ? '1px solid rgba(16, 185, 129, 0.2)' 
                                                        : '1px solid rgba(59, 130, 246, 0.2)'
                                            }}>
                                                {agent.capacityWeight === 3 ? 'Senior (x3)' : agent.capacityWeight === 2 ? 'Standard (x2)' : 'Junior (x1)'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', width: '120px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{agent.leadsAssigned}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ {maxExpectedLeads}</span>
                                                </div>
                                                <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${chargePercent}%`, height: '100%', background: chargeColor, borderRadius: '10px', transition: 'width 0.4s ease' }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            {agent.overdueTasksCount > 0 ? (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                                    color: '#f87171',
                                                    padding: '4px 10px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700
                                                }}>
                                                    <TrendingUp size={12} style={{ transform: 'rotate(90deg)' }} />
                                                    {agent.overdueTasksCount} en retard
                                                </span>
                                            ) : (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'rgba(16, 185, 129, 0.1)',
                                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                                    color: '#34d399',
                                                    padding: '4px 10px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700
                                                }}>
                                                    À jour
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.95rem' }}>{agent.conversionRate}%</div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => setSelectedAgent(agent)}
                                                    className="btn"
                                                    style={{
                                                        padding: '8px',
                                                        background: 'rgba(255,255,255,0.02)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        color: 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        borderRadius: '8px',
                                                        transition: 'all 0.2s ease',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    title="Statistiques & Détails"
                                                >
                                                    <MoreVertical size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAgent(agent.id, agent.name)}
                                                    disabled={isDeleting === agent.id}
                                                    className="btn"
                                                    style={{
                                                        padding: '8px',
                                                        background: 'rgba(239, 68, 68, 0.08)',
                                                        border: '1px solid rgba(239, 68, 68, 0.18)',
                                                        color: '#f87171',
                                                        cursor: 'pointer',
                                                        borderRadius: '8px',
                                                        transition: 'all 0.2s ease',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    title="Supprimer le conseiller"
                                                >
                                                    <Trash2 size={16} className={isDeleting === agent.id ? 'animate-spin' : ''} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
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
                profile={profile}
                onClose={() => setSelectedAgent(null)}
                onRefresh={onRefresh}
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
