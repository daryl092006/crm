// --- CONFIGURATION ---
const SUPABASE_URL = "https://ryzgxhfwuxpvnoxvscbk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5emd4aGZ3dXhwdm5veHZzY2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDgzMjgsImV4cCI6MjA4ODcyNDMyOH0.raMGoau9uxCzHzQlIqrDMIEbwXp8QHJ6ZvCjuCgAPyY";
const ORG_ID = "00000000-0000-0000-0000-000000000000";
const CAMPAIGN_ID = "61474de0-607e-4434-b639-b52760f6f508";

const MAPPINGS = [
  { "field": "firstName", "label": "Prénom" },
  { "field": "lastName", "label": "Nom" },
  { "field": "email", "label": "Email" },
  { "field": "phone", "label": "Numéro de téléphone" },
  { "field": "phone", "label": "Numéro de téléphone whatsApp" },
  { "field": "country", "label": "Pays de résidence" },
  { "field": "Profession", "label": "Profession" },   
  { "field": "Hondorateur", "label": "Hondorateur" }, 
  { "field": "notes", "label": "Score et niveau" },   
  { "field": "notes", "label": "Source" }             
];

function envoyerLigneVersCRM(data, headers) {
  const emailIdx = headers.indexOf("email");
  if (emailIdx === -1 || !data[emailIdx]) {
    console.warn("⚠️ Pas d'email trouvé dans cette ligne.");
    return;
  }

  const email = data[emailIdx].toString().trim().toLowerCase();
  const leadData = {
    email: email,
    campaign_id: CAMPAIGN_ID,
    organization_id: ORG_ID,
    status_id: 'nouveau',
    notes: ""
  };
  
  MAPPINGS.forEach(m => {
    const idx = headers.indexOf(m.label.toLowerCase().trim());
    if (idx !== -1 && data[idx]) {
      const val = data[idx];
      if (m.field === 'firstName') leadData.first_name = val;
      else if (m.field === 'lastName') leadData.last_name = val;
      else if (m.field === 'email') leadData.email = val;
      else if (m.field === 'phone') leadData.phone = val;
      else if (m.field === 'country') leadData.country = val;
      else if (m.field === 'Profession') leadData.Profession = val;
      else if (m.field === 'Hondorateur') leadData.Hondorateur = val;
      else leadData.notes += `${m.label}: ${val}\n`;
    }
  });

  const options = {
    method: "post",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": "resolution=ignore-duplicates" 
    },
    payload: JSON.stringify(leadData),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/leads?on_conflict=email,organization_id", options);
  const code = response.getResponseCode();
  const resText = response.getContentText();

  if (code >= 200 && code < 300) {
    console.log("✅ Succès pour " + email + " (Code " + code + ")");
  } else if (code === 409) {
    console.warn("⏭️ Doublon ignoré pour " + email);
  } else {
    console.error("❌ Erreur pour " + email + " (Code " + code + ") : " + resText);
    throw new Error("Erreur Supabase: " + resText);
  }
}

function importerToutLeContenu() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => h.toString().toLowerCase().trim());
  let count = 0;
  for (let i = 1; i < rows.length; i++) { 
    try { 
      envoyerLigneVersCRM(rows[i], headers); 
      count++;
    } catch(e) { 
      SpreadsheetApp.getUi().alert("Erreur à la ligne " + (i+1) + " : " + e.message);
      return; 
    } 
  }
  SpreadsheetApp.getUi().alert("Importation terminée ! " + count + " lignes traitées.");
}

function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().toLowerCase().trim());
  const data = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  envoyerLigneVersCRM(data, headers);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🚀 CRM ESCEN').addItem('Lancer Import', 'importerToutLeContenu').addToUi();
}
