import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Template officiel ESCEN — Header & Footer brandés avec icônes SVG inline
const buildEscenEmailHtml = (bodyContent: string, footerNote = "Ceci est une notification automatique de votre espace de travail EliteCRM."): string => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESCEN EliteCRM</title>
</head>
<body style="margin:0; padding:0; background-color:#eef2f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- ═══ HEADER ═══ -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a2240 0%, #202a51 60%, #2d3f7a 100%); padding: 28px 32px; text-align: center; border-bottom: 3px solid #6366f1;">
              <div style="display:inline-block; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:10px 20px; margin-bottom:10px;">
                <span style="color:#ffffff; font-size:20px; font-weight:800; letter-spacing:0.05em; text-transform:uppercase;">ESCEN</span>
                <span style="color:#6cc6e2; font-size:20px; font-weight:300; margin-left:6px;">EliteCRM</span>
              </div>
              <p style="color:#94a8d0; font-size:11px; margin:4px 0 0 0; text-transform:uppercase; letter-spacing:0.12em;">École Pionnière de l'Économie Numérique</p>
            </td>
          </tr>

          <!-- ═══ BODY ═══ -->
          <tr>
            <td style="padding: 36px 40px; color:#1e293b; font-size:15px; line-height:1.7;">
              ${bodyContent}
            </td>
          </tr>

          <!-- ═══ DIVIDER ═══ -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height:1px; background:linear-gradient(90deg, transparent, #e2e8f0, transparent);"></div>
            </td>
          </tr>

          <!-- ═══ FOOTER ═══ -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a2240 0%, #202a51 100%); padding: 28px 32px; text-align:center;">

              <p style="color:#7c9bc4; font-size:11px; text-transform:uppercase; letter-spacing:0.12em; margin:0 0 16px 0; font-weight:600;">Retrouvez-nous sur</p>

              <!-- Réseaux sociaux — icônes PNG compatibles tous clients email -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px auto;">
                <tr>
                  <!-- Facebook -->
                  <td style="padding: 0 6px;">
                    <a href="https://www.facebook.com/escenofficiel" target="_blank" style="display:inline-block; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:50%; width:36px; height:36px; text-align:center; text-decoration:none;" title="Facebook">
                      <img src="https://img.icons8.com/ios-filled/20/6cc6e2/facebook-new.png" width="20" height="20" alt="Facebook" style="display:block; margin:8px auto 0 auto; border:0;" />
                    </a>
                  </td>
                  <!-- Instagram -->
                  <td style="padding: 0 6px;">
                    <a href="https://www.instagram.com/escenofficiel?igsh=aGk4eWl6OGkycHd6" target="_blank" style="display:inline-block; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:50%; width:36px; height:36px; text-align:center; text-decoration:none;" title="Instagram">
                      <img src="https://img.icons8.com/ios-filled/20/6cc6e2/instagram-new.png" width="20" height="20" alt="Instagram" style="display:block; margin:8px auto 0 auto; border:0;" />
                    </a>
                  </td>
                  <!-- LinkedIn -->
                  <td style="padding: 0 6px;">
                    <a href="https://www.linkedin.com/company/escenofficiel/" target="_blank" style="display:inline-block; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:50%; width:36px; height:36px; text-align:center; text-decoration:none;" title="LinkedIn">
                      <img src="https://img.icons8.com/ios-filled/20/6cc6e2/linkedin.png" width="20" height="20" alt="LinkedIn" style="display:block; margin:8px auto 0 auto; border:0;" />
                    </a>
                  </td>
                  <!-- WhatsApp -->
                  <td style="padding: 0 6px;">
                    <a href="https://wa.me/22898012727" target="_blank" style="display:inline-block; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:50%; width:36px; height:36px; text-align:center; text-decoration:none;" title="WhatsApp">
                      <img src="https://img.icons8.com/ios-filled/20/6cc6e2/whatsapp.png" width="20" height="20" alt="WhatsApp" style="display:block; margin:8px auto 0 auto; border:0;" />
                    </a>
                  </td>
                  <!-- TikTok -->
                  <td style="padding: 0 6px;">
                    <a href="http://tiktok.com/@escen_university" target="_blank" style="display:inline-block; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:50%; width:36px; height:36px; text-align:center; text-decoration:none;" title="TikTok">
                      <img src="https://img.icons8.com/ios-filled/20/6cc6e2/tiktok.png" width="20" height="20" alt="TikTok" style="display:block; margin:8px auto 0 auto; border:0;" />
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#94a8d0; font-size:12px; font-weight:700; margin:0 0 4px 0; text-transform:uppercase; letter-spacing:0.08em;">ESCEN</p>
              <p style="color:#7c9bc4; font-size:11px; margin:0 0 12px 0;">École Pionnière de l'Économie Numérique en Afrique francophone</p>
              <p style="color:#4a6080; font-size:10px; margin:0; line-height:1.5;">${footerNote}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders })
    }

    try {
        // Initialize Supabase Admin Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // Authenticate User using their JWT
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error("Missing Authorization header");

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) throw new Error("Unauthorized user access");

        // Fetch User Profile and Role
        const { data: callerProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role, full_name')
            .eq('id', user.id)
            .single();

        if (profileError || !callerProfile) throw new Error("User profile not found");
        if (!['admin', 'superagent'].includes(callerProfile.role)) {
            throw new Error("Forbidden: Only admins and superagents can create agents");
        }

        // Get payload parameters
        const { fullName, email, organizationId, role = 'agent' } = await req.json()
        if (!fullName || !email || !organizationId) {
            throw new Error("Missing required parameters: fullName, email, organizationId");
        }

        const tempPassword = Math.random().toString(36).substring(2, 8)

        // 1. CRÉATION AUTH (SERVICE_ROLE)
        // suppress_email_confirmation: true empêche Supabase d'envoyer son propre email basique
        // On gère l'envoi manuellement via Resend avec le template HTML ESCEN
        const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: tempPassword,
            email_confirm: true,
            email_change_confirm: false,
            user_metadata: { full_name: fullName },
            app_metadata: { provider: 'email' }
        })

        if (authCreateError) throw authCreateError;

        // 2. CRÉATION PROFIL
        await supabaseAdmin.from('profiles').insert([{
            id: authData.user.id,
            email: email,
            full_name: fullName,
            organization_id: organizationId,
            role: role,
            is_active: true,
            must_change_password: true
        }])

        // 3. Corps du mail personnalisé
        const bodyContent = `
            <h2 style="color: #6366f1; margin-top: 0; font-size: 20px;">Bienvenue sur EliteCRM</h2>
            <p style="margin-top: 16px;">Bonjour <strong>${fullName}</strong>,</p>
            <p>Votre compte collaborateur vient d'être créé sur la plateforme CRM de l'ESCEN par un administrateur.</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Identifiant de connexion :</p>
                <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0f172a;">${email}</p>
                
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Mot de passe temporaire :</p>
                <p style="margin: 0; font-size: 18px; font-weight: bold; color: #6366f1; font-family: monospace; letter-spacing: 0.05em;">${tempPassword}</p>
            </div>

            <p style="color: #f59e0b; font-weight: 600; font-size: 14px; margin: 16px 0;">
                Lors de votre première connexion, il vous sera demandé de configurer votre mot de passe personnel.
            </p>

            <p style="text-align: center; margin: 30px 0 10px 0;">
                <a href="https://escen-crm.vercel.app/" style="display: inline-block; padding: 12px 28px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px rgba(99,102,241,0.2);">
                    Se connecter à EliteCRM
                </a>
            </p>
        `;

        const finalHtml = buildEscenEmailHtml(bodyContent)

        // 4. ENVOI EMAIL VIA RESEND (clé depuis les secrets Supabase)
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (!resendKey) throw new Error("RESEND_API_KEY secret manquant dans les variables Supabase");
        const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'contact@escen.university';
        const fromName = Deno.env.get('RESEND_FROM_NAME') || 'EliteCRM Support';

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: `${fromName} <${fromEmail}>`,
                to: [email],
                subject: 'Vos accès EliteCRM - ESCEN',
                html: finalHtml
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
