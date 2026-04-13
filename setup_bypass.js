
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const DEFAULT_ID = '00000000-0000-0000-0000-000000000000';

async function setupBypassData() {
    console.log('--- Initialisation du mode Bypass ---');
    
    // 1. Force Update/Create Default Organization (ESCEN)
    console.log('Mise à jour de l\'organisation par défaut : ESCEN...');
    const { error: upsertError } = await supabase
        .from('organizations')
        .upsert({ 
            id: DEFAULT_ID, 
            name: 'ESCEN CRM', 
            domain: 'escen.university' 
        });

    if (upsertError) console.error('Erreur mise à jour org:', upsertError);
    else console.log('Organisation ESCEN opérationnelle.');

    // 2. Add Statuses if empty
    const { data: statuses } = await supabase.from('lead_statuses').select('id');
    if (!statuses || statuses.length === 0) {
        console.log('Initialisation des statuts...');
        const defaultStatuses = [
            { id: 'nouveau', label: 'Nouveau', color: '#6366f1', is_default: true, sort_order: 1, organization_id: DEFAULT_ID },
            { id: 'contacte', label: 'Contacté', color: '#10b981', is_default: false, sort_order: 2, organization_id: DEFAULT_ID },
            { id: 'interesse', label: 'Intéressé', color: '#8b5cf6', is_default: false, sort_order: 3, organization_id: DEFAULT_ID },
            { id: 'inscrit', label: 'Inscrit', color: '#22c55e', is_default: false, sort_order: 4, organization_id: DEFAULT_ID },
            { id: 'perdu', label: 'Perdu', color: '#ef4444', is_default: false, sort_order: 5, organization_id: DEFAULT_ID }
        ];
        await supabase.from('lead_statuses').insert(defaultStatuses);
    }

    console.log('--- Fin de configuration ---');
}

setupBypassData();
