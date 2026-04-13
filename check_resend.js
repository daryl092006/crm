const API_KEY = 're_ds6bumgs_B9mBv3fhrZ9iUo1rHoMQn5Ei';

async function checkDomains() {
    console.log("🔍 RECONNAISSANCE DES DOMAINES RESEND EN COURS...");
    try {
        const response = await fetch('https://api.resend.com/domains', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            console.log(`✅ DOMAINES TROUVÉS : ${data.data.length}`);
            data.data.forEach(d => {
                console.log(`- DOMAINE : ${d.name} (${d.status === 'verified' ? '✅ VALIDÉ' : '⏳ EN ATTENTE'})`);
                console.log(`  REGION : ${d.region}`);
                console.log(`  ID : ${d.id}`);
            });
        } else if (data.data && data.data.length === 0) {
            console.log("⚠️ AUCUN DOMAINE ENREGISTRÉ CHEZ RESEND !");
            console.log("Il faut ajouter ton domaine (ex: escen.fr) dans le dashboard Resend (Section Domains).");
        } else {
            console.log("❌ ERREUR API :", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("❌ ERREUR DE CONNEXION :", e.message);
    }
}

checkDomains();
