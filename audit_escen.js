
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function audit() {
    console.log('--- Système d\'Audit ESCEN CRM ---');

    // 1. On corrige le nom de l'organisation par défaut pour qu'au login on voit "ESCEN CRM"
    await supabase.from('organizations').update({ 
        name: 'ESCEN CRM', 
        domain: 'escen.university' 
    }).eq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Organisation ESCEN CRM validée.');

    // 2. On vérifie les profils
    const { data: profiles } = await supabase.from('profiles').select('*');
    
    profiles?.forEach(async p => {
        // Si c'est Amah, on force son rôle à "agent" ! 🛡️
        if (p.full_name?.toLowerCase().includes('akpadja') || p.email === 'a.amah@escen.university') {
            if (p.role !== 'agent') {
                await supabase.from('profiles').update({ role: 'agent' }).eq('id', p.id);
                console.log('🛡️ Rôle d\'Agent sécurisé pour ' + p.full_name);
            } else {
                console.log('✅ Rôle d\'Agent déjà actif pour ' + p.full_name);
            }
        }
        
        // Si c'est l'admin, on s'assure qu'il est bien admin !
        if (p.email?.includes('admin')) {
            await supabase.from('profiles').update({ role: 'admin' }).eq('id', p.id);
            console.log('👑 Rôle d\'Administrateur validé pour ' + p.full_name);
        }
    });
}

audit();
