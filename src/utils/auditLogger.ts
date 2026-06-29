import { supabase } from '../supabaseClient';
import type { AuditLogStatus } from '../types';

interface LogOptions {
    entityId?: string;
    campaignId?: string;
    oldValues?: any;
    newValues?: any;
    metadata?: any;
    status?: AuditLogStatus;
    errorMessage?: string;
}

/**
 * Journalise une action importante du CRM dans la table public.audit_logs via RPC
 */
export async function logAction(
    action: string,
    entityType: string,
    options: LogOptions = {}
): Promise<string | null> {
    try {
        const { data, error } = await supabase.rpc('create_audit_log', {
            p_action: action,
            p_entity_type: entityType,
            p_entity_id: options.entityId || null,
            p_campaign_id: options.campaignId || null,
            p_old_values: options.oldValues ? options.oldValues : null,
            p_new_values: options.newValues ? options.newValues : null,
            p_metadata: options.metadata || {},
            p_status: options.status || 'success',
            p_error_message: options.errorMessage || null
        });

        if (error) {
            console.error('Audit logger failure:', error.message);
            return null;
        }

        return data as string;
    } catch (err: any) {
        console.error('Audit logger unexpected error:', err.message);
        return null;
    }
}
