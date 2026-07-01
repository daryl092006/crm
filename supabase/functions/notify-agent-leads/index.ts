import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RESEND_API_KEY = "re_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei"

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

              <!-- Réseaux sociaux avec SVG inline — aucune dépendance CDN -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px auto;">
                <tr>
                  <!-- Facebook -->
                  <td style="padding: 0 8px;">
                    <a href="https://www.facebook.com/escenofficiel" target="_blank" style="display:inline-block; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:50%; width:36px; height:36px; line-height:36px; text-align:center; text-decoration:none;" title="Facebook">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#6cc6e2" style="vertical-align:middle; margin-top:10px;">
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                      </svg>
                    </a>
                  </td>
                  <!-- Instagram -->
                  <td style="padding: 0 8px;">
                    <a href="https://www.instagram.com/escenofficiel?igsh=aGk4eWl6OGkycHd6" target="_blank" style="display:inline-block; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:50%; width:36px; height:36px; line-height:36px; text-align:center; text-decoration:none;" title="Instagram">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6cc6e2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-top:10px;">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                        <circle cx="12" cy="12" r="4"/>
                        <circle cx="17.5" cy="6.5" r="1" fill="#6cc6e2" stroke="none"/>
                      </svg>
                    </a>
                  </td>
                  <!-- LinkedIn -->
                  <td style="padding: 0 8px;">
                    <a href="https://www.linkedin.com/company/escenofficiel/" target="_blank" style="display:inline-block; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:50%; width:36px; height:36px; line-height:36px; text-align:center; text-decoration:none;" title="LinkedIn">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#6cc6e2" style="vertical-align:middle; margin-top:10px;">
                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                        <rect x="2" y="9" width="4" height="12"/>
                        <circle cx="4" cy="4" r="2"/>
                      </svg>
                    </a>
                  </td>
                  <!-- WhatsApp -->
                  <td style="padding: 0 8px;">
                    <a href="https://wa.me/22898012727" target="_blank" style="display:inline-block; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:50%; width:36px; height:36px; line-height:36px; text-align:center; text-decoration:none;" title="WhatsApp">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#6cc6e2" style="vertical-align:middle; margin-top:10px;">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                      </svg>
                    </a>
                  </td>
                  <!-- TikTok -->
                  <td style="padding: 0 8px;">
                    <a href="http://tiktok.com/@escen_university" target="_blank" style="display:inline-block; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:50%; width:36px; height:36px; line-height:36px; text-align:center; text-decoration:none;" title="TikTok">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#6cc6e2" style="vertical-align:middle; margin-top:10px;">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.88a8.22 8.22 0 0 0 4.81 1.54V7a4.85 4.85 0 0 1-1.04-.31z"/>
                      </svg>
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
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const body = await req.json() as any
        const agentId = body.agentId || body.agent_id
        const campaignId = body.campaignId || body.campaign_id
        const count = body.count

        if (!agentId) {
            throw new Error("Missing agentId")
        }

        // 1. Récupérer les infos de l'agent
        const { data: agent, error: agentError } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .eq('id', agentId)
            .single()

        if (agentError || !agent) throw new Error("Agent not found: " + agentError?.message);

        // 2. Récupérer le nom de la campagne si fournie
        let campaignName = "Attribution Directe"
        if (campaignId) {
            const { data: campaign } = await supabaseAdmin
                .from('campaigns')
                .select('name')
                .eq('id', campaignId)
                .single()
            if (campaign) {
                campaignName = campaign.name
            }
        }

        // 3. Corps du mail personnalisé
        const bodyContent = `
            <h2 style="color: #6366f1; margin-top: 0; font-size: 20px;">Nouveaux prospects assignés ! 🎯</h2>
            <p style="margin-top: 16px;">Bonjour <strong>${agent.full_name}</strong>,</p>
            <p>De nouveaux prospects viennent de vous être affectés sur votre espace de travail.</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Campagne / Source :</p>
                <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0f172a;">${campaignName}</p>
                
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Volume attribué :</p>
                <p style="margin: 0; font-size: 24px; font-weight: 900; color: #6366f1;">${count} prospect${count > 1 ? 's' : ''}</p>
            </div>

            <p>Nous vous invitons à vous connecter afin de débuter la prise de contact (appels, WhatsApp, e-mails).</p>
            
            <p style="text-align: center; margin: 30px 0 10px 0;">
                <a href="https://escen-crm.vercel.app/" style="display: inline-block; padding: 12px 28px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px rgba(99,102,241,0.2);">
                    Ouvrir mon EliteCRM
                </a>
            </p>
        `;

        const finalHtml = buildEscenEmailHtml(bodyContent);

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${RESEND_API_KEY}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                from: 'EliteCRM Support <contact@escen.university>',
                to: [agent.email],
                subject: `🎯 Nouveaux prospects assignés (${count}) - EliteCRM`,
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
