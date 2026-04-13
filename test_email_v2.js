const https = require('https');

const API_KEY = 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
const payload = JSON.stringify({
    from: 'Support Informatique ESCEN <support.informatique@escen.university>',
    to: ['darylggt23@gmail.com'],
    subject: '🧪 TEST V2 EliteCRM - Force de Délivrabilité',
    html: '<h1>TEST V2 RÉUSSI !</h1><p>Ce message utilise le moteur de secours HTTPS pour ton domaine <b>escen.university</b>.</p>'
});

const options = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/emails',
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': payload.length
    }
};

console.log("🚀 TENTATIVE D'ENVOI V2 (HTTPS) EN COURS...");

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log("✅ EMAIL ENVOYÉ AVEC SUCCÈS (Status " + res.statusCode + ")");
            console.log("ID :", JSON.parse(data).id);
        } else {
            console.log("❌ ERREUR API RESEND (" + res.statusCode + ") :");
            console.log(data);
        }
    });
});

req.on('error', (e) => {
    console.error("❌ ERREUR DE CONNEXION RÉSEAU :", e.message);
});

req.write(payload);
req.end();
