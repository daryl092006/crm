import XLSX from 'xlsx';

const data = [
  {
    "Prénom": "Alice",
    "Nom": "Dupont",
    "Email": "alice.dupont@example.com",
    "Téléphone": "+22899999901",
    "WhatsApp": "+22899999901",
    "Ville": "Lomé",
    "Pays": "Togo",
    "Filière": "ia_gl",
    "Niveau": "Master"
  },
  {
    "Prénom": "Bob",
    "Nom": "Smith",
    "Email": "bob.smith@example.com",
    "Téléphone": "+22899999902",
    "WhatsApp": "+22899999902",
    "Ville": "Dakar",
    "Pays": "Sénégal",
    "Filière": "mkt_eco",
    "Niveau": "Licence"
  }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Leads");
XLSX.writeFile(wb, "test_import.xlsx");
console.log("test_import.xlsx created successfully!");
