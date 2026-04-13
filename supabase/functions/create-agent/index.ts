import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RESEND_API_KEY = "re_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei"

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { fullName, email, organizationId } = await req.json()
        const tempPassword = Math.random().toString(36).substring(2, 8)

        // 1. CRÉATION AUTH (SERVICE_ROLE)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: fullName }
        })

        if (authError) throw authError;

        // 2. CRÉATION PROFIL
        await supabaseAdmin.from('profiles').insert([{
            id: authData.user.id,
            email: email,
            full_name: fullName,
            organization_id: organizationId,
            role: 'agent',
            is_active: true,
            must_change_password: true
        }])

        // 3. ENVOI EMAIL VIA RESEND
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: 'EliteCRM Support <contact@escen.university>',
                to: [email],
                subject: '🔑 Vos accès EliteCRM - ESCEN',
                html: `<h1>Bienvenue ${fullName} !</h1><p>Identifiant : <b>${email}</b></p><p>Mot de passe : <b>${tempPassword}</b></p>`
            })
        })

        const resData = await res.json()

        return new Response(JSON.stringify({ success: true, res: resData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
