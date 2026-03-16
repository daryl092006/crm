export interface LeadStatus {
    id: string;
    label: string;
    color: string;
    isDefault?: boolean;
    sortOrder: number;
}

export type InteractionType = 'note' | 'whatsapp' | 'email' | 'call' | 'sms' | 'status_change';

export interface Interaction {
    id: string;
    leadId: string;
    agentId?: string;
    type: InteractionType;
    content: string;
    createdAt: string;
}

export interface Task {
    id: string;
    leadId: string;
    agentId: string;
    title: string;
    dueDate: string;
    isCompleted: boolean;
    priority: 'low' | 'medium' | 'high';
}

export type LeadSource = 'Facebook' | 'TikTok' | 'Instagram' | 'Salon' | 'Référencement' | 'Agent' | 'Importation' | 'Autre';

export type StudyField =
    | 'Finance Digitale'
    | 'Marketing Digital & E-commerce'
    | 'Intelligence Artificielle & Génie Logiciel'
    | 'Management de Projet Numérique'
    | 'Management de Projet & Transformation Digitale'
    | 'Marketing Digital'
    | 'Executive Master en Finance Digitale'
    | 'Autre';

export interface StudentLead {
    id: string;
    organizationId: string;
    campaignId: string;
    agentId?: string;
    statusId: string;

    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    city: string;
    country: string;
    fieldOfInterest: StudyField;
    level: string;

    score: number;
    notes?: string;
    metadata?: Record<string, any>;
    lastInteractionAt: string;
    createdAt: string;
    phoneVerification?: 'Valide' | 'Invalide' | 'Inconnu';

    // Virtual fields (dynamically loaded)
    status?: LeadStatus;
    interactions?: Interaction[];
    tasks?: Task[];
}

export interface Campaign {
    id: string;
    organizationId: string;
    name: string;
    source: string;
    budget?: number;
    startDate: string;
    endDate?: string;
    isActive: boolean;
    column_mappings?: { field: string; label: string }[];
}

export interface Agent {
    id: string;
    organizationId: string;
    name: string;
    email: string;
    role: 'admin' | 'agent';
    capacityWeight: number;
    avatarUrl?: string;
    // Metrics calculated from leads
    leadsAssigned: number;
    overdueTasksCount: number;
    conversionRate: number;
    avgResponseTime?: number; // In hours
}

export interface Template {
    id: string;
    organizationId: string;
    title: string;
    content: string;
    category: 'whatsapp' | 'email' | 'sms';
    createdAt: string;
}

export interface Sequence {
    id: string;
    organizationId: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    stepsCount?: number;
    activeLeadsCount?: number;
}

