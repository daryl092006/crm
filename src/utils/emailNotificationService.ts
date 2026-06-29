const RESEND_API_KEY = "re_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei";

const buildEscenEmailHtml = (fullName: string, campaignName: string, count: number): string => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESCEN EliteCRM</title>
</head>
<body style="margin:0; padding:0; background-color:#f0f4f8; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="max-width:600px; margin:40px auto; background:#fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top:4px solid #6366f1;">
    
    <!-- HEADER -->
    <div style="background-color:#202a51; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">EliteCRM</h1>
      <p style="color: #6cc6e2; font-size: 12px; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.1em;">Notification de plateforme</p>
    </div>

    <!-- CONTENT -->
    <div style="padding: 32px 24px; line-height: 1.6; color: #333333; font-size: 15px;">
      <h2 style="color: #6366f1; margin-top: 0; font-size: 20px;">Nouveaux prospects assignés ! 🎯</h2>
      <p style="margin-top: 16px;">Bonjour <strong>${fullName}</strong>,</p>
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
    </div>

    <!-- FOOTER -->
    <div style="background-color:#202a51; padding: 24px; border-top: 1px solid #dbe7f0;">
      <p style="font-size:12px; color:#6cc6e2; text-align:center; margin:0 0 12px 0; letter-spacing:0.05em; text-transform:uppercase; font-weight: 600;">Suivez-nous</p>
      <p style="text-align:center; margin:0 0 16px 0;">
        <a href="https://www.facebook.com/escenofficiel" target="_blank" style="margin:0 10px; text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" width="20" alt="Facebook" style="vertical-align:middle;">
        </a>
        <a href="https://www.instagram.com/escenofficiel?igsh=aGk4eWl6OGkycHd6" target="_blank" style="margin:0 10px; text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733558.png" width="20" alt="Instagram" style="vertical-align:middle;">
        </a>
        <a href="https://www.linkedin.com/company/escenofficiel/" target="_blank" style="margin:0 10px; text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733561.png" width="20" alt="LinkedIn" style="vertical-align:middle;">
        </a>
        <a href="https://wa.me/22898012727" target="_blank" style="margin:0 10px; text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733585.png" width="20" alt="WhatsApp" style="vertical-align:middle;">
        </a>
      </p>
      <p style="text-align:center; margin:0; font-size:11px; color:#a5b4fc; line-height: 1.4;">
        © ESCEN — École Pionnière de l'Économie Numérique en Afrique francophone<br/>
        Ceci est une notification automatique de votre espace de travail EliteCRM.
      </p>
    </div>

  </div>
</body>
</html>`;

export const notifyAgentLeads = async (
    agentEmail: string,
    agentName: string,
    campaignName: string,
    count: number
) => {
    try {
        const htmlContent = buildEscenEmailHtml(agentName, campaignName, count);
        
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'EliteCRM Support <contact@escen.university>',
                to: [agentEmail],
                subject: `🎯 Nouveaux prospects assignés (${count}) - EliteCRM`,
                html: htmlContent
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Error from Resend');
        }
        
        console.log(`Email successfully sent to ${agentEmail}`);
        return true;
    } catch (error) {
        console.error("Failed to send notification email directly:", error);
        return false;
    }
};

const buildEscenWelcomeHtml = (fullName: string, email: string, tempPassword: string): string => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESCEN EliteCRM</title>
</head>
<body style="margin:0; padding:0; background-color:#f0f4f8; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <div style="max-width:600px; margin:40px auto; background:#fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top:4px solid #6366f1;">
    
    <!-- HEADER -->
    <div style="background-color:#202a51; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">EliteCRM</h1>
      <p style="color: #6cc6e2; font-size: 12px; margin: 5px 0 0 0; text-transform: uppercase; letter-spacing: 0.1em;">Accès plateforme</p>
    </div>

    <!-- CONTENT -->
    <div style="padding: 32px 24px; line-height: 1.6; color: #333333; font-size: 15px;">
      <h2 style="color: #6366f1; margin-top: 0; font-size: 20px;">Bienvenue sur EliteCRM ! 🔑</h2>
      <p style="margin-top: 16px;">Bonjour <strong>${fullName}</strong>,</p>
      <p>Votre compte collaborateur vient d'être créé sur la plateforme CRM de l'ESCEN par un administrateur.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Identifiant de connexion :</p>
          <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0f172a;">${email}</p>
          
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Mot de passe temporaire :</p>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #6366f1; font-family: monospace; letter-spacing: 0.05em;">${tempPassword}</p>
      </div>

      <p style="color: #f59e0b; font-weight: 600; font-size: 14px; margin: 16px 0;">
          ⚠️ Lors de votre première connexion, il vous sera demandé de configurer votre mot de passe personnel.
      </p>

      <p style="text-align: center; margin: 30px 0 10px 0;">
          <a href="https://escen-crm.vercel.app/" style="display: inline-block; padding: 12px 28px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px rgba(99,102,241,0.2);">
              Se connecter à EliteCRM
          </a>
      </p>
    </div>

    <!-- FOOTER -->
    <div style="background-color:#202a51; padding: 24px; border-top: 1px solid #dbe7f0;">
      <p style="font-size:12px; color:#6cc6e2; text-align:center; margin:0 0 12px 0; letter-spacing:0.05em; text-transform:uppercase; font-weight: 600;">Suivez-nous</p>
      <p style="text-align:center; margin:0 0 16px 0;">
        <a href="https://www.facebook.com/escenofficiel" target="_blank" style="margin:0 10px; text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" width="20" alt="Facebook" style="vertical-align:middle;">
        </a>
        <a href="https://www.instagram.com/escenofficiel?igsh=aGk4eWl6OGkycHd6" target="_blank" style="margin:0 10px; text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733558.png" width="20" alt="Instagram" style="vertical-align:middle;">
        </a>
        <a href="https://www.linkedin.com/company/escenofficiel/" target="_blank" style="margin:0 10px; text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733561.png" width="20" alt="LinkedIn" style="vertical-align:middle;">
        </a>
        <a href="https://wa.me/22898012727" target="_blank" style="margin:0 10px; text-decoration:none;">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733585.png" width="20" alt="WhatsApp" style="vertical-align:middle;">
        </a>
      </p>
      <p style="text-align:center; margin:0; font-size:11px; color:#a5b4fc; line-height: 1.4;">
        © ESCEN — École Pionnière de l'Économie Numérique en Afrique francophone<br/>
        Ceci est une notification automatique de votre espace de travail EliteCRM.
      </p>
    </div>

  </div>
</body>
</html>`;

export const notifyAgentAccess = async (
    agentEmail: string,
    agentName: string,
    tempPassword: string
) => {
    try {
        const htmlContent = buildEscenWelcomeHtml(agentName, agentEmail, tempPassword);
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'EliteCRM Support <contact@escen.university>',
                to: [agentEmail],
                subject: '🔑 Vos accès EliteCRM - ESCEN',
                html: htmlContent
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Error from Resend');
        }
        
        console.log(`Welcome email successfully sent to ${agentEmail}`);
        return true;
    } catch (error) {
        console.error("Failed to send welcome email directly:", error);
        return false;
    }
};
