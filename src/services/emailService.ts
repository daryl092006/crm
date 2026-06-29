
const RESEND_API_KEY = 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';

interface EmailTemplate {
    subject: string;
    html: string;
}

export const EMAIL_TEMPLATES: Record<string, (name: string) => EmailTemplate> = {
    injoignable: (name: string) => ({
        subject: `Tentative de contact - ESCEN University`,
        html: `
            <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #6366f1;">Bonjour ${name},</h2>
                <p>J'ai tenté de vous joindre par téléphone aujourd'hui concernant votre demande d'admission à l'<b>ESCEN</b>, mais je n'ai pas réussi à vous avoir.</p>
                <p>Je reviendrai vers vous très prochainement. En attendant, n'hésitez pas à me proposer un créneau qui vous conviendrait par retour de mail ou sur WhatsApp.</p>
                <p>Bien cordialement,<br><b>L'équipe des Conseillers ESCEN</b></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 0.8rem; color: #666;">Ceci est un message automatique de suivi.</p>
            </div>
        `
    }),
    repondeur: (name: string) => ({
        subject: `Message déposé sur votre répondeur - ESCEN`,
        html: `
            <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #6366f1;">Bonjour ${name},</h2>
                <p>Je vous ai laissé un message sur votre répondeur il y a quelques instants.</p>
                <p>Je souhaitais faire le point avec vous sur votre projet de formation. Vous pouvez me rappeler sur ce numéro ou me contacter par mail dès que vous êtes disponible.</p>
                <p>À très vite,<br><b>L'équipe ESCEN</b></p>
            </div>
        `
    }),
    documentation: (name: string) => ({
        subject: `Microsoft 365 : Connaissez-vous réellement votre niveau ? - ESCEN`,
        html: `
            <div style="font-family: Arial, sans-serif; font-size:14px; color:#333; padding:20px; max-width:600px; margin:auto; background:#fff; border: 1px solid #eee;">
              <p>Bonjour <b>${name}</b>,</p>
              <p>
                Utilisez-vous Microsoft 365 (Teams, Outlook, OneDrive, SharePoint)
                et connaissez-vous réellement votre niveau ?
              </p>
              <p>
                L’ESCEN vous propose un programme certifiant Microsoft 365
                structuré en 3 niveaux progressifs.
              </p>
              <div style="background:#f1f3f6; padding:12px; border-left:4px solid #01b4d5;">
                <p style="margin: 5px 0;"><b>✔ Formation 100% pratique</b></p>
                <p style="margin: 5px 0;"><b>✔ Certificat à chaque niveau</b></p>
                <p style="margin: 5px 0;"><b>✔ Apprentissage professionnel</b></p>
              </div>
              <p style="margin-top:15px;">
                Test gratuit pour connaître votre niveau réel.
              </p>
              <div style="text-align:center; margin:30px 0;">
                <a href="https://escen.university/test-m365"
                   style="background:#01b4d5; color:#fff; padding:15px 25px;
                          text-decoration:none; border-radius:5px; font-weight:bold;">
                  Accéder au test gratuit
                </a>
              </div>
              <p style="color:#b00020;">
                Contact : <a href="mailto:support.informatique@escen.university" style="color:#b00020;">support.informatique@escen.university</a> | +228 98 01 27 27
              </p>
              <hr style="margin:25px 0; border:none; border-top:1px solid #ddd;">
              <p style="text-align:center; font-weight:bold; margin-bottom: 10px;">Suivez-nous</p>
              <div style="text-align:center;">
                <a href="https://www.facebook.com/escenofficiel" style="margin:0 6px;"><img src="https://img.icons8.com/ios-filled/28/01b4d5/facebook-new.png" width="28"></a>
                <a href="https://www.instagram.com/escenofficiel" style="margin:0 6px;"><img src="https://img.icons8.com/ios-filled/28/01b4d5/instagram-new.png" width="28"></a>
                <a href="https://www.linkedin.com/company/escenofficiel/" style="margin:0 6px;"><img src="https://img.icons8.com/ios-filled/28/01b4d5/linkedin.png" width="28"></a>
                <a href="https://wa.me/22898012727" style="margin:0 6px;"><img src="https://img.icons8.com/ios-filled/28/01b4d5/whatsapp.png" width="28"></a>
                <a href="https://tiktok.com/@escen_university" style="margin:0 6px;"><img src="https://img.icons8.com/ios-filled/28/01b4d5/tiktok.png" width="28"></a>
              </div>
            </div>
        `
    })
};

export const sendEmail = async (to: string, templateKey: string, name: string) => {
    const templateFn = EMAIL_TEMPLATES[templateKey];
    if (!templateFn) throw new Error("Template non trouvé");

    const { subject, html } = templateFn(name);

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Admissions ESCEN <support.informatique@escen.university>',
                to: [to],
                subject: subject,
                html: html,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            console.warn("Resend API issue (absorbé pour le CRM):", data.message || "Erreur d'envoi");
            return { success: false };
        }
        return { success: true, data };
    } catch (error) {
        console.warn("Erreur réseau Email (probablement CORS - absorbée pour ne pas bloquer le CRM):", error);
        return { success: false };
    }
};
