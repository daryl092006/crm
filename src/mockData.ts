import type { StudentLead, Campaign, Agent } from './types';

export const CAMPAIGNS: Campaign[] = [
    { id: 'camp-1', name: 'Rentrée 2026 - Master Data', type: 'Social', startDate: '2026-01-01' },
    { id: 'camp-2', name: 'TikTok Ads - Juin', type: 'Social', startDate: '2026-02-01' },
    { id: 'camp-3', name: 'Salon de l\'Étudiant Paris', type: 'Salon', startDate: '2025-11-20' },
];

export const AGENTS: Agent[] = [
    { id: 'agent-1', name: 'Amine Benali', email: 'amine@elitecrm.com', leadsAssigned: 45, overdueTasksCount: 2, capacityWeight: 2, conversionRate: 18.5 },
    { id: 'agent-2', name: 'Sarah Dubois', email: 'sarah@elitecrm.com', leadsAssigned: 32, overdueTasksCount: 0, capacityWeight: 1, conversionRate: 22.1 },
    { id: 'agent-3', name: 'Koffi Traoré', email: 'koffi@elitecrm.com', leadsAssigned: 50, overdueTasksCount: 5, capacityWeight: 3, conversionRate: 15.2 },
];

export const MOCK_LEADS: StudentLead[] = [
    {
        id: 'lead-1',
        firstName: 'Alice',
        lastName: 'Moreau',
        phone: '+33 6 12 34 56 78',
        email: 'alice.m@gmail.com',
        country: 'France',
        city: 'Lyon',
        fieldOfInterest: 'Intelligence Artificielle & Génie Logiciel',
        level: 'Licence 3',
        source: 'TikTok',
        status: 'Nouveau',
        campaignId: 'camp-2',
        agentId: 'agent-1',
        notes: 'Très intéressée par le Master IA.',
        interactions: [
            { id: 'int-1', type: 'Note', content: 'Inscrite via pub TikTok', date: '2026-02-10T10:00:00Z', agentName: 'System' }
        ],
        createdAt: '2026-02-10T10:00:00Z'
    },
    {
        id: 'lead-2',
        firstName: 'Moussa',
        lastName: 'Diop',
        phone: '+221 77 123 45 67',
        email: 'm.diop@yahoo.sn',
        country: 'Sénégal',
        city: 'Dakar',
        fieldOfInterest: 'Finance Digitale',
        level: 'Master 1',
        source: 'Facebook',
        status: 'Contacté',
        campaignId: 'camp-1',
        agentId: 'agent-2',
        notes: 'Besoin d\'info sur les bourses.',
        interactions: [
            { id: 'int-2', type: 'WhatsApp', content: 'Premier contact WhatsApp établi.', date: '2026-02-11T14:30:00Z', agentName: 'Sarah Dubois' }
        ],
        createdAt: '2026-02-05T09:00:00Z'
    },
    {
        id: 'lead-3',
        firstName: 'Emma',
        lastName: 'Wilson',
        phone: '+44 7911 123456',
        email: 'emma.wils@outlook.com',
        country: 'Royaume-Uni',
        city: 'London',
        fieldOfInterest: 'Marketing Digital & E-commerce',
        level: 'Licence 1',
        source: 'Salon',
        status: 'Dossier envoyé',
        campaignId: 'camp-3',
        agentId: 'agent-3',
        notes: 'Dossier complet reçu, en attente de validation.',
        interactions: [
            { id: 'int-3', type: 'Email', content: 'Dossier envoyé à l\'étudiante.', date: '2026-02-12T08:15:00Z', agentName: 'Koffi Traoré' }
        ],
        createdAt: '2026-01-15T11:00:00Z'
    },
    {
        id: 'lead-4',
        firstName: 'Jean',
        lastName: 'Kouassi',
        phone: '+225 07 08 09 10 11',
        email: 'jean.k@gmail.com',
        country: 'Côte d\'Ivoire',
        city: 'Abidjan',
        fieldOfInterest: 'Management de Projet Numérique',
        level: 'Master 2',
        source: 'Référencement',
        status: 'Inscrit',
        campaignId: 'camp-1',
        agentId: 'agent-1',
        notes: 'Inscription finale confirmée.',
        interactions: [],
        createdAt: '2025-12-20T16:00:00Z'
    }
];
