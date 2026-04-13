
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ryzgxhfwuxpvnoxvscbk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emd4aGZ3dXhwdm5veHZzY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDgzMjgsImV4cCI6MjA4ODcyNDMyOH0.raMGoau9uxCzHzQlIqrDMIEbwXp8QHJ6ZvCjuCgAPyY';
const supabase = createClient(supabaseUrl, supabaseKey);

const EMAIL = 'darylggt23@gmail.com';
const PASS = 'DarylEscen2026!';
const ORG_ID = '00000000-0000-0000-0000-000000000000';

async function createAdmin() {
    console.log('--- ACTIVATION ADMIN darylggt23@gmail.com ---');

    // 1. Créer le compte Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: EMAIL,
        password: PASS,
        options: {
            data: {
                full_name: 'Direction ESCEN',
                role: 'admin',
                organization_id: ORG_ID
            }
        }
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
            console.log('ℹ️ Le compte Auth existe déjà.');
        } else {
            console.error('❌ Erreur Auth:', authError.message);
            return;
        }
    } else {
        console.log('✅ Compte Auth créé avec succès.');
    }

    // 2. Récupérer l'ID de l'utilisateur (soit le nouveau, soit l'existant)
    // Comme on est en anon key, on ne peut pas lister, mais le signUp ou signIn nous donne l'ID.
    let userId = authData?.user?.id;

    if (!userId) {
        // Si déjà inscrit, on tente un signIn pour avoir l'ID
        const { data: signInData } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASS });
        userId = signInData?.user?.id;
    }

    if (userId) {
        console.log('🚀 ID Utilisateur obtenu:', userId);

        // 3. Supprimer le placeholder s'il existe et insérer le vrai profil
        // On tente d'abord de voir si un profil avec ce mail existe déjà avec un mauvais ID
        await supabase.from('profiles').delete().eq('email', EMAIL);
        
        const { error: profileError } = await supabase.from('profiles').insert({
            id: userId,
            email: EMAIL,
            full_name: 'Direction ESCEN',
            role: 'admin',
            organization_id: ORG_ID,
            is_active: true,
            must_change_password: true
        });

        if (profileError) {
            console.error('❌ Erreur Profil:', profileError.message);
        } else {
            console.log('✅ Profil lié à l\'organisation ESCEN avec succès !');
        }
    }
}

createAdmin();
