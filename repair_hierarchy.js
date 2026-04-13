
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const BYPASS_ID = '00000000-0000-0000-0000-000000000000';
const AMAH_EMAIL = 'a.amah@escen.university';

async function fixHierarchy() {
    console.log('--- RESTRUCTURATION HIÉRARCHIQUE ESCEN CRM ---');

    // 1. On remet l'ID Bypass sur le Directorat
    await supabase.from('profiles').update({
        full_name: 'Direction / Système',
        email: 'admin@escen.university',
        role: 'admin',
        organization_id: BYPASS_ID
    }).eq('id', BYPASS_ID);
    console.log('✅ Badge Directeur ré-étalonné.');

    // 2. On cherche le compte AUTH d'Amah par son email (C'est lui qui doit être l'Agent)
    // Comme on ne peut pas le lister facilement, on va tenter de créer son profil 
    // s'il existe une ligne avec son email.
    
    const { data: authUser } = await supabase.auth.signUp({
        email: AMAH_EMAIL,
        password: 'ChangeMe2026!' // S'il existe déjà, on aura son ID
    });

    const trueAmahId = authUser?.user?.id;
    if (trueAmahId && trueAmahId !== BYPASS_ID) {
        console.log('ID Officiel d\'Amah identifié : ' + trueAmahId);
        
        await supabase.from('profiles').upsert({
            id: trueAmahId,
            full_name: 'AKPADJA Tete Amah',
            email: AMAH_EMAIL,
            role: 'agent',
            organization_id: BYPASS_ID
        });
        
        // On transfère ses leads vers son VRAI ID
        await supabase.from('leads').update({ agent_id: trueAmahId }).eq('agent_id', BYPASS_ID);
        console.log('🛡️ Rôle d\'Agent activé et prospects transférés pour AKPADJA Tete Amah.');
    } else {
        console.log('⚠️ Impossible d\'identifier le VRAI identifiant d\'Amah. Est-il bien inscrit ?');
    }
}

fixHierarchy();
