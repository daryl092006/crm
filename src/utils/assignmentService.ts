import type { StudentLead, Agent } from '../types';

/**
 * Logique d'assignation automatique des leads.
 * Règle : Assigne au conseiller qui a le moins de leads "ouverts".
 * Définition d'un lead ouvert : Tout statut SAUF 'Inscrit' et 'Perdu'.
 * Bonus : En cas d'égalité, départage par le moins de tâches en retard (overdue).
 */
export const getBestAgentForLead = (agents: Agent[], leads: StudentLead[]): Agent | null => {
    if (!agents || agents.length === 0) return null;

    // 1. Calculer le nombre de leads ouverts par agent
    const agentsWithOpenLeads = agents.map(agent => {
        const openLeadsCount = leads.filter(lead =>
            lead.agentId === agent.id &&
            lead.statusId !== 'inscrit' &&
            lead.statusId !== 'perdu' &&
            lead.statusId !== 'faux_numero'
        ).length;

        return {
            ...agent,
            openLeadsCount,
            loadScore: openLeadsCount / (agent.capacityWeight || 1)
        };
    });

    // 2. Trier les agents : 
    // Priorité 1 : Le score de charge le plus bas (le plus de dispo par rapport à sa capacité)
    // Priorité 2 : Moins de tâches overdue
    const sortedAgents = [...agentsWithOpenLeads].sort((a, b) => {
        if (a.loadScore !== b.loadScore) {
            return a.loadScore - b.loadScore;
        }
        return a.overdueTasksCount - b.overdueTasksCount;
    });

    return sortedAgents[0];
};
