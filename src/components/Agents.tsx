import React, { useState } from 'react';
import { UserSquare2, TrendingUp, Award, MoreVertical } from 'lucide-react';
import type { Agent, Campaign } from '../types';
import { useToast } from './Toast';
import AgentStatsModal from './AgentStatsModal';
import AddAgentModal from './AddAgentModal';
import InvitationsManagerModal from './InvitationsManagerModal';
import { supabase } from '../supabaseClient';

interface AgentsProps {
    profile: any;
    agents: Agent[];
    leads: any[];
    setLeads: React.Dispatch<React.SetStateAction<any[]>>;
    campaigns: Campaign[];
    statuses: any[];
    onRefresh?: () => Promise<void>;
}

const Agents: React.FC<AgentsProps> = ({ profile, agents, leads, setLeads, campaigns, statuses, onRefresh }) => {
    const { addToast } = useToast();
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isInviteManagerOpen, setIsInviteManagerOpen] = useState(false);


    const handleAddAgent = async (fullName: string) => {
        try {
            if (!profile?.organization_id) throw new Error("ID d'organisation introuvable");

            const { error } = await supabase
                .from('profiles')
                .insert([{
                    full_name: fullName,
                    role: 'agent',
                    organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000',
                    is_active: true
                }]);

            if (error) throw error;

            addToast(`${fullName} a été ajouté à l'équipe !`, "success");
            if (onRefresh) await onRefresh();
            setIsAddModalOpen(false);
        } catch (error: any) {
            addToast(error.message || "Erreur lors de la création de l'agent", "error");
            throw error;
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Équipe de Conseillers</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Gérez les performances et l'attribution des prospects.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="btn btn-primary"
                        style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                    >
                        <UserSquare2 size={18} />
                        Ajouter un Agent
                    </button>
                </div>
            </div>


            <div className="stat-grid">

                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Agent Top Performance</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
                                {(() => {
                                    if (agents.length === 0) return 'Aucun agent';
                                    const topAgent = [...agents].sort((a, b) => b.conversionRate - a.conversionRate)[0];
                                    if (topAgent && topAgent.conversionRate > 0) return topAgent.name;
                                    return 'À définir';
                                })()}
                            </h3>
                        </div>
                        <Award size={24} color="#ffd700" />
                    </div>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Délai moyen de relance</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
                                {agents.length > 0
                                    ? (agents.reduce((acc, a) => acc + (a.avgResponseTime || 0), 0) / agents.length).toFixed(1)
                                    : 0}h
                            </h3>
                        </div>
                        <TrendingUp size={24} color="var(--success)" />
                    </div>
                </div>
            </div>

            <div className="card" style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: '800px' }}>
                    <thead>
                        <tr>
                            <th>Conseiller</th>
                            <th>Capacité</th>
                            <th>Charge (Leads)</th>
                            <th>Action (Alertes)</th>
                            <th>Conv. %</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agents.map((agent) => (
                            <tr key={agent.id}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: 'var(--primary)',
                                            display: 'grid',
                                            placeItems: 'center',
                                            fontWeight: 700,
                                            color: 'white',
                                            fontSize: '0.875rem',
                                            opacity: agent.capacityWeight === 1 ? 0.7 : 1
                                        }}>
                                            {agent.name.split(' ').map(n => n[0]).join('')}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{agent.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{agent.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        background: agent.capacityWeight === 3 ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                                        color: agent.capacityWeight === 3 ? '#a78bfa' : 'white',
                                        border: agent.capacityWeight === 3 ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid var(--border)'
                                    }}>
                                        {agent.capacityWeight === 3 ? 'Senior (x3)' : agent.capacityWeight === 2 ? 'Standard (x2)' : 'Junior (x1)'}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 700 }}>{agent.leadsAssigned} leads</div>
                                    <div style={{ width: '100px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '0.5rem' }}>
                                        <div style={{ width: `${Math.min((agent.leadsAssigned / (agent.capacityWeight * 20)) * 100, 100)}%`, height: '100%', background: agent.leadsAssigned > (agent.capacityWeight * 20) ? 'var(--danger)' : 'var(--primary)', borderRadius: '2px' }}></div>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {agent.overdueTasksCount > 0 ? (
                                            <span style={{ color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <TrendingUp size={14} style={{ transform: 'rotate(90deg)' }} />
                                                {agent.overdueTasksCount} en retard
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>À jour</span>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>{agent.conversionRate}%</div>
                                </td>
                                <td>
                                    <button
                                        onClick={() => setSelectedAgent(agent)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                    >
                                        <MoreVertical size={18} />
                                    </button>
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
                campaigns={campaigns}
                profile={profile}
                statuses={statuses}
                onClose={() => setSelectedAgent(null)}
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
