import https from 'https';

const API_KEY = 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';
const payload = JSON.stringify({
    from: 'Support Informatique ESCEN <support.informatique@escen.university>',
    to: ['darylggt23@gmail.com'],
    subject: 'TEST V3 EliteCRM - Delivrabilite Finale',
    html: '<h1>TEST V3 REUSSI !</h1><p>Ce message utilise l\'importation ES Module pour ton domaine <b>escen.university</b>.</p>'
});

// Utilisation de Buffer.byteLength pour la taille correcte en octets avec les caractères spéciaux
const byteLength = Buffer.byteLength(payload);

const options = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/emails',
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': byteLength
    }
};

console.log("🚀 TENTATIVE D'ENVOI V3 (FIX Poids Octets) EN COURS...");

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log("✅ EMAIL ENVOYÉ AVEC SUCCÈS (Status " + res.statusCode + ")");
            try {
                console.log("ID :", JSON.parse(data).id);
            } catch (e) {
                console.log("Data brute :", data);
            }
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
