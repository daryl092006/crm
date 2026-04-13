const API_KEY = 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';

async function sendTestEmail() {
    console.log("🚀 TENTATIVE D'ENVOI D'EMAIL TEST VIA RESEND...");
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Support Informatique ESCEN <support.informatique@escen.university>',
                to: ['darylggt23@gmail.com'], // Ton mail pour le test
                subject: '🧪 TEST EliteCRM - Vérification de Délivrabilité',
                html: '<h1>TEST RÉUSSI !</h1><p>Ceci est un message de confirmation pour ton domaine <b>escen.university</b>.</p>'
            })
        });
        const data = await response.json();
        
        if (response.ok) {
            console.log("✅ EMAIL ENVOYÉ AVEC SUCCÈS !");
            console.log("ID :", data.id);
        } else {
            console.log("❌ ERREUR RESEND :", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("❌ ERREUR DE CONNEXION :", e.message);
    }
}

sendTestEmail();
