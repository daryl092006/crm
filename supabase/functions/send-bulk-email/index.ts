import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}


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
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role, full_name')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) throw new Error("User profile not found");
        if (!['admin', 'superagent'].includes(profile.role)) {
            throw new Error("Forbidden: Only admins and superagents can send bulk emails");
        }

        // Get payload parameters
        const { campaignId } = await req.json()
        if (!campaignId) throw new Error("Missing campaignId parameter");

        // Fetch email campaign details
        const { data: campaign, error: campaignError } = await supabaseAdmin
            .from('email_campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();

        if (campaignError || !campaign) throw new Error("Email campaign not found");

        // Update campaign status to sending
        await supabaseAdmin
            .from('email_campaigns')
            .update({ status: 'sending', started_at: new Date().toISOString() })
            .eq('id', campaignId);

        // Fetch all pending valid recipients
        const { data: recipients, error: recError } = await supabaseAdmin
            .from('email_recipients')
            .select('*')
            .eq('email_campaign_id', campaignId)
            .eq('status', 'pending')
            .eq('validation_status', 'valid');

        if (recError) throw recError;

        // Fetch attachments
        const { data: attachments, error: attachError } = await supabaseAdmin
            .from('email_attachments')
            .select('*')
            .eq('email_campaign_id', campaignId);

        if (attachError) throw attachError;

        // Download and format attachments
        const resendAttachments = [];
        for (const attachment of (attachments || [])) {
            const { data: fileBlob, error: fileError } = await supabaseAdmin
                .storage
                .from(attachment.storage_bucket || 'email-attachments')
                .download(attachment.file_path);

            if (fileError) {
                console.error(`Failed to download attachment ${attachment.file_name}:`, fileError.message);
                continue;
            }

            const buffer = await fileBlob.arrayBuffer();
            const base64Content = btoa(String.fromCharCode(...new Uint8Array(buffer)));

            resendAttachments.push({
                content: base64Content,
                filename: attachment.file_name,
            });
        }

        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (!resendKey) throw new Error("RESEND_API_KEY secret manquant dans les variables Supabase");
        const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'contact@escen.university';
        const fromName = Deno.env.get('RESEND_FROM_NAME') || 'Direction ESCEN';

        let sentCount = 0;
        let failedCount = 0;

        // Helper to replace placeholders
        const replacePlaceholders = (text: string, recipient: any) => {
            if (!text) return "";
            return text
                .replace(/\{\{first_name\}\}/g, recipient.first_name || "")
                .replace(/\{\{last_name\}\}/g, recipient.last_name || "")
                .replace(/\{\{full_name\}\}/g, recipient.full_name || recipient.first_name ? `${recipient.first_name} ${recipient.last_name || ''}` : "")
                .replace(/\{\{email\}\}/g, recipient.email || "")
                .replace(/\{\{phone\}\}/g, recipient.phone || "")
                .replace(/\{\{program_name\}\}/g, recipient.program_name || "")
                .replace(/\{\{campaign_name\}\}/g, recipient.campaign_name || "")
                .replace(/\{\{source\}\}/g, recipient.source || "");
        };

        // Template officiel ESCEN — Header & Footer brandés avec icônes SVG inline
        const buildEscenEmailHtml = (bodyContent: string, footerNote = "Ceci est un email envoyé par la direction ESCEN via EliteCRM."): string => `
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

        // Process recipients sequentially or in small parallel batches
        for (const recipient of (recipients || [])) {
            const personalizedSubject = replacePlaceholders(campaign.subject, recipient);
            const personalizedBody = replacePlaceholders(campaign.body, recipient);
            // Wrap in the official ESCEN branded layout
            const finalHtml = buildEscenEmailHtml(personalizedBody);

            // Update recipient status to sending
            await supabaseAdmin
                .from('email_recipients')
                .update({ status: 'sending' })
                .eq('id', recipient.id);

            try {
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: `${campaign.sender_name || fromName} <${campaign.sender_email || fromEmail}>`,
                        to: [recipient.email],
                        subject: personalizedSubject,
                        html: finalHtml,
                        attachments: resendAttachments
                    })
                });

                const resData = await res.json();

                if (res.ok) {
                    sentCount++;
                    // Update recipient
                    await supabaseAdmin
                        .from('email_recipients')
                        .update({
                            status: 'sent',
                            personalized_subject: personalizedSubject,
                            personalized_body: personalizedBody
                        })
                        .eq('id', recipient.id);

                    // Insert Send Log
                    await supabaseAdmin
                        .from('email_send_logs')
                        .insert({
                            email_campaign_id: campaignId,
                            recipient_id: recipient.id,
                            lead_id: recipient.lead_id,
                            email: recipient.email,
                            provider: 'resend',
                            provider_message_id: resData.id,
                            status: 'sent',
                            sent_at: new Date().toISOString()
                        });

                    // Add lead interaction if it maps to an existing CRM lead
                    if (recipient.lead_id) {
                        await supabaseAdmin
                            .from('lead_interactions')
                            .insert({
                                lead_id: recipient.lead_id,
                                campaign_id: campaign.crm_campaign_id,
                                agent_id: user.id,
                                type: 'email',
                                direction: 'outbound',
                                result: 'delivered',
                                subject: personalizedSubject,
                                content: `Email envoyé via campagne "${campaign.name}".\n\nObjet: ${personalizedSubject}\n\nMessage: ${personalizedBody.replace(/<[^>]*>/g, '')}`,
                                created_by: user.id
                            });
                    }
                } else {
                    failedCount++;
                    const errMsg = resData.message || JSON.stringify(resData);
                    
                    // Update recipient
                    await supabaseAdmin
                        .from('email_recipients')
                        .update({ status: 'failed' })
                        .eq('id', recipient.id);

                    // Insert Send Log
                    await supabaseAdmin
                        .from('email_send_logs')
                        .insert({
                            email_campaign_id: campaignId,
                            recipient_id: recipient.id,
                            lead_id: recipient.lead_id,
                            email: recipient.email,
                            provider: 'resend',
                            status: 'failed',
                            error_message: errMsg
                        });
                }
            } catch (err: any) {
                failedCount++;
                // Update recipient
                await supabaseAdmin
                    .from('email_recipients')
                    .update({ status: 'failed' })
                    .eq('id', recipient.id);

                // Insert Send Log
                await supabaseAdmin
                    .from('email_send_logs')
                    .insert({
                        email_campaign_id: campaignId,
                        recipient_id: recipient.id,
                        lead_id: recipient.lead_id,
                        email: recipient.email,
                        provider: 'resend',
                        status: 'failed',
                        error_message: err.message
                    });
            }
        }

        // Finalize email campaign record
        const finalStatus = failedCount === (recipients || []).length && (recipients || []).length > 0 ? 'failed' : 'sent';
        
        await supabaseAdmin
            .from('email_campaigns')
            .update({
                status: finalStatus,
                completed_at: new Date().toISOString(),
                sent_count: sentCount,
                failed_count: failedCount
            })
            .eq('id', campaignId);

        // Add audit log entry
        await supabaseAdmin.rpc('create_audit_log', {
            p_action: 'send_mass_emails',
            p_entity_type: 'email_campaigns',
            p_entity_id: campaignId,
            p_campaign_id: campaign.crm_campaign_id || null,
            p_metadata: { sent_count: sentCount, failed_count: failedCount },
            p_status: 'success'
        });

        return new Response(JSON.stringify({
            success: true,
            sent_count: sentCount,
            failed_count: failedCount,
            status: finalStatus
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
