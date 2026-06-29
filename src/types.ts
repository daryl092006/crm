// =========================================================
// Système de rôles — 5 niveaux (TASK-DB-001)
// =========================================================
export type UserRole =
    | 'admin'       // Accès total plateforme
    | 'direction'   // Lecture seule tableaux de bord
    | 'superagent'  // Responsable communication / gestion campagnes
    | 'agent'       // Agent de terrain
    | 'superviseur'; // Suivi et lecture étendue

export interface LeadStatus {
    id: string;
    label: string;
    color: string;
    isDefault?: boolean;
    sortOrder: number;
}

export type InteractionType = 'note' | 'whatsapp' | 'email' | 'call' | 'sms' | 'status_change' | 'appointment' | 'reminder' | 'meeting' | 'follow_up' | 'no_answer' | 'other';

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
    whatsapp?: string | null;
    email: string;
    city: string;
    country: string;
    fieldOfInterest: StudyField;
    level: string;
    source?: string | null;

    score: number;
    notes?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
    lastInteractionAt: string;
    createdAt: string;
    phoneVerification?: 'Valide' | 'Invalide' | 'Inconnu';

    programId?: string | null;
    classificationId?: string | null;
    sourceId?: string | null;

    // Virtual fields (dynamically loaded)
    status?: LeadStatus;
    interactions?: Interaction[];
    tasks?: Task[];
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export interface Campaign {
    id: string;
    organizationId: string;
    name: string;
    description?: string | null;
    source: string;
    budget?: number;
    startDate: string;
    endDate?: string | null;
    status: CampaignStatus;
    isActive: boolean; // conservé pour rétrocompatibilité
    objective?: number | null;
    agent_id?: string;
    column_mappings?: { field: string; label: string }[];
    archivedAt?: string | null;
    metadata?: Record<string, any>;
}

export interface Agent {
    id: string;
    organizationId: string;
    name: string;
    email: string;
    role: UserRole;
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
    role: UserRole;
    email: string;
    must_change_password?: boolean;
    created_at?: string;
}

export interface Program {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    level?: string | null;
    department?: string | null;
    isActive: boolean;
}

export interface ProspectClassification {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    color?: string | null;
    sortOrder: number;
    isActive: boolean;
    isDefault: boolean;
}

export interface ProspectSource {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    isActive: boolean;
}


export type InteractionResult =
  | 'successful'
  | 'no_answer'
  | 'interested'
  | 'not_interested'
  | 'callback_requested'
  | 'wrong_number'
  | 'unreachable'
  | 'converted'
  | 'pending'
  | 'other';

export type FollowUpStatus =
  | 'pending'
  | 'completed'
  | 'cancelled'
  | 'overdue';

export type FollowUpPriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent';

export interface LeadInteraction {
  id: string;
  lead_id: string;
  campaign_id?: string | null;
  agent_id?: string | null;
  interaction_type: InteractionType;
  direction?: 'inbound' | 'outbound';
  result?: InteractionResult | string | null;
  subject?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
}

export interface LeadFollowUp {
  id: string;
  lead_id: string;
  campaign_id?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  due_at: string;
  follow_up_type: string;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  note?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  result?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type MessageChannel = 'whatsapp' | 'email' | 'sms' | 'call_note' | 'internal_note';

export interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  category: MessageChannel;
  subject?: string | null;
  description?: string | null;
  campaign_id?: string | null;
  program_id?: string | null;
  source_id?: string | null;
  status_id?: string | null;
  is_active: boolean;
  is_default: boolean;
  organization_id?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface FollowUpScenario {
  id: string;
  name: string;
  description?: string | null;
  trigger_type: string;
  delay_days: number;
  channel: string;
  template_id?: string | null;
  is_active: boolean;
  campaign_id?: string | null;
  organization_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type AuditLogStatus = 'success' | 'failed' | 'warning';

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  campaign_id?: string | null;
  organization_id?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  metadata?: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
  status: AuditLogStatus;
  error_message?: string | null;
  created_at: string;
}

export type EmailCampaignStatus =
  | 'draft'
  | 'ready'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type EmailTargetType =
  | 'crm_campaign'
  | 'crm_filter'
  | 'external_import'
  | 'manual_list';

export type EmailRecipientStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type EmailValidationStatus =
  | 'valid'
  | 'invalid'
  | 'duplicate'
  | 'missing_email';

export interface EmailCampaign {
  id: string;
  name: string;
  description?: string | null;
  subject: string;
  body: string;
  template_id?: string | null;
  crm_campaign_id?: string | null;
  sender_name?: string | null;
  sender_email?: string | null;
  status: EmailCampaignStatus;
  target_type: EmailTargetType;
  filters?: Record<string, any>;
  total_recipients: number;
  valid_recipients: number;
  invalid_recipients: number;
  duplicate_recipients: number;
  queued_count: number;
  sent_count: number;
  failed_count: number;
  created_by?: string | null;
  organization_id?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string | null;
}

export interface EmailRecipient {
  id: string;
  email_campaign_id: string;
  lead_id?: string | null;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  source?: string | null;
  program_name?: string | null;
  campaign_name?: string | null;
  status: EmailRecipientStatus;
  validation_status: EmailValidationStatus;
  validation_error?: string | null;
  is_duplicate: boolean;
  personalized_subject?: string | null;
  personalized_body?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string | null;
}

export interface EmailAttachment {
  id: string;
  email_campaign_id: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  storage_bucket?: string | null;
  uploaded_by?: string | null;
  created_at: string;
}

export interface EmailSendLog {
  id: string;
  email_campaign_id: string;
  recipient_id?: string | null;
  lead_id?: string | null;
  email: string;
  provider?: string | null;
  provider_message_id?: string | null;
  status: string;
  error_message?: string | null;
  sent_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

