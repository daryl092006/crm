export type LeadStatus = 'Nouveau' | 'Contacté' | 'Intéressé' | 'Dossier envoyé' | 'Dossier reçu' | 'Inscrit' | 'Perdu' | 'Faux Numéro';

export type LeadSource = 'Facebook' | 'TikTok' | 'Instagram' | 'Salon' | 'Référencement' | 'Agent' | 'Importation' | 'Autre';

export type FilePath =
    | 'Finance Digitale'
    | 'Marketing Digital & E-commerce'
    | 'Intelligence Artificielle & Génie Logiciel'
    | 'Management de Projet Numérique'
    | 'Management de Projet & Transformation Digitale'
    | 'Marketing Digital'
    | 'Executive Master en Finance Digitale'
    | 'Autre';

export interface Interaction {
    id: string;
    type: 'Note' | 'Email' | 'WhatsApp' | 'SMS' | 'Appel';
    content: string;
    date: string;
    agentName: string;
}

export interface StudentLead {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    country: string;
    city: string;
    fieldOfInterest: FilePath;
    level: string; // e.g., Licence 1, Master 2
    source: LeadSource;
    status: LeadStatus;
    campaignId: string;
    agentId?: string;
    phoneVerification?: 'Inconnu' | 'Valide' | 'Invalide' | 'WhatsApp';
    notes: string;
    interactions: Interaction[];
    createdAt: string;
}

export interface Campaign {
    id: string;
    name: string;
    startDate: string;
    endDate?: string;
    budget?: number;
    type: 'Social' | 'Salon' | 'General';
}

export interface Agent {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    leadsAssigned: number;
    overdueTasksCount: number;
    capacityWeight: number; // 1 = Junior, 2 = Standard, 3 = Senior/Elite
    conversionRate: number;
}
