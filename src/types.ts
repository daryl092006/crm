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

    score?: number; // deprecated, kept for DB compat
    notes?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    agent_id?: string;
    column_mappings?: { field: string; label: string }[];
}

export interface Agent {
    id: string;
    organizationId: string;
    name: string;
    email: string;
    role: 'super_admin' | 'super_agent' | 'agent' | 'observer';
    capacityWeight: number;
    avatarUrl?: string;
    isActive: boolean;
    // Metrics calculated from leads
    leadsAssigned: number;
    overdueTasksCount: number;
    conversionRate: number;
    avgResponseTime?: number; // In hours
    mustChangePassword?: boolean;
    capacity_weight?: number;
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


export interface Profile {
    id: string;
    organization_id: string;
    organization_name?: string;
    full_name: string;
    role: 'super_admin' | 'super_agent' | 'agent' | 'observer';
    email: string;
    must_change_password?: boolean;
    created_at?: string;
}
