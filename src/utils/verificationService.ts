import type { StudentLead } from '../types';
import { parsePhoneNumber, isValidNumber } from 'libphonenumber-js';

export interface SmartPhoneResult {
    primary: string;
    others: string[];
    status: StudentLead['phoneVerification'] | 'Numéro non normalisé';
    note: string;
    detectedCountry?: string;
    isExplicit: boolean; // True si commence par + ou 00
}

export const COUNTRIES_DB = [
    { id: '221', name: 'Sénégal', keywords: ['SENEGAL', 'SEN', 'SN', 'RUFISQUE'] },
    { id: '225', name: 'Côte d\'Ivoire', keywords: ['COTE D IVOIRE', 'COTE D\'IVOIRE', 'COTE D’IVOIRE', 'IVORY COAST', 'CI', 'CIV', 'BOUAKE', 'SAN-PEDRO'] },
    { id: '243', name: 'RDC', keywords: ['RDC', 'DRC', 'REPUBLIQUE DEMOCRATIQUE DU CONGO', 'CONGO KINSHASA', 'ZAIRE', 'CONGO K', 'COD', 'GOMA', 'LUBUMBASHI', 'AIRTEL RDC'] },
    { id: '242', name: 'Congo-Brazzaville', keywords: ['CONGO BRAZZA', 'CONGO-BRAZZAVILLE', 'REPUBLIQUE DU CONGO', 'COG', 'CONGO B', 'POINTE-NOIRE'] },
    { id: '212', name: 'Maroc', keywords: ['MAROC', 'MOROCCO', 'MAR', 'CASABLANCA', 'RABAT', 'MARRAKECH', 'FES', 'TANGIER', 'AGADIR'] },
    { id: '33', name: 'France', keywords: ['FRANCE', 'FR', 'FRA', 'PARIS', 'LYON', 'MARSEILLE'] },
    { id: '237', name: 'Cameroun', keywords: ['CAMEROUN', 'CAMEROON', 'CMR', 'GAROUA', 'MAROUA', 'BAFOUSSAM', 'YAOUNDE', 'YAOUDE', 'YDE', 'YAOUDÉ'] },
    { id: '241', name: 'Gabon', keywords: ['GABON', 'GAB', 'PORT-GENTIL'] },
    { id: '223', name: 'Mali', keywords: ['MALI', 'MLI', 'SIKASSO'] },
    { id: '224', name: 'Guinée', keywords: ['GUINEE', 'GUINEA', 'GIN'] },
    { id: '228', name: 'Togo', keywords: ['TOGO', 'TG', 'TGO'] },
    { id: '229', name: 'Bénin', keywords: ['BENIN', 'BJ', 'BEN'] },
    { id: '226', name: 'Burkina Faso', keywords: ['BURKINA', 'BF', 'BFA'] },
    { id: '227', name: 'Niger', keywords: ['NIGER', 'NE', 'NER'] },
    { id: '222', name: 'Mauritanie', keywords: ['MAURITANIE', 'MR', 'MRT'] },
    { id: '235', name: 'Tchad', keywords: ['TCHAD', 'CHAD', 'TD', 'TCD'] },
    { id: '216', name: 'Tunisie', keywords: ['TUNISIE', 'TUNISIA', 'TUNIS'] },
    { id: '213', name: 'Algérie', keywords: ['ALGERIE', 'ALGERIA', 'ALGER'] },
    { id: '261', name: 'Madagascar', keywords: ['MADAGASCAR', 'MDG'] },
    { id: '230', name: 'Maurice', keywords: ['MAURICE', 'MAURITIUS', 'MUS'] },
    { id: '254', name: 'Kenya', keywords: ['KENYA', 'KEN', 'NAIROBI'] }
];

export const CITIES_DB = [
    { name: 'Yaoundé', country: 'Cameroun', keywords: ['YAOUNDE', 'YAOUDE', 'YDE', 'YOUNDE', 'YAOUDÉ'], isUnique: true },
    { name: 'Douala', country: 'Cameroun', keywords: ['DOUALA'], isUnique: true },
    { name: 'Abidjan', country: 'Côte d\'Ivoire', keywords: ['ABIDJAN', 'ABJ'], isUnique: true },
    { name: 'Dakar', country: 'Sénégal', keywords: ['DAKAR', 'DKR'], isUnique: true },
    { name: 'Kinshasa', country: 'RDC', keywords: ['KINSHASA', 'KIN'], isUnique: true },
    { name: 'Lomé', country: 'Togo', keywords: ['LOME'], isUnique: true },
    { name: 'Brazzaville', country: 'Congo-Brazzaville', keywords: ['BRAZZAVILLE'], isUnique: true },
    { name: 'Libreville', country: 'Gabon', keywords: ['LIBREVILLE', 'LBV'], isUnique: true },
    { name: 'Conakry', country: 'Guinée', keywords: ['CONAKRY'], isUnique: true },
    { name: 'Bamako', country: 'Mali', keywords: ['BAMAKO'], isUnique: true },
    { name: 'Ouagadougou', country: 'Burkina Faso', keywords: ['OUAGADOUGOU'], isUnique: true },
    { name: 'Cotonou', country: 'Bénin', keywords: ['COTONOU'], isUnique: true },
    { name: 'Niamey', country: 'Niger', keywords: ['NIAMEY'], isUnique: true },
    { name: 'Ndjamena', country: 'Tchad', keywords: ['NDJAMENA'], isUnique: true },
    { name: 'Casablanca', country: 'Maroc', keywords: ['CASABLANCA', 'CASA'], isUnique: true }
];

const eliteNormalize = (text: string): string => {
    return text
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[’‘`´]/g, "'") 
        .replace(/[^\w\s']/g, '')
        .toUpperCase();
};

export const resolveCityToCountry = (text: string): { country: string; isUnique: boolean } | null => {
    if (!text) return null;
    const clean = eliteNormalize(text);
    
    // 1. City DB check FIRST (pour l'isUnique)
    const foundCity = CITIES_DB.find(c => {
        const cityNorm = eliteNormalize(c.name);
        return c.keywords?.some(k => eliteNormalize(k) === clean) || cityNorm === clean;
    });
    if (foundCity) return { country: foundCity.country, isUnique: foundCity.isUnique || false };

    // 2. Keywords check (Pays)
    const countryByKeyword = COUNTRIES_DB.find(c => {
        const normName = eliteNormalize(c.name);
        return c.keywords.some(k => eliteNormalize(k) === clean || clean === eliteNormalize(k)) || normName === clean;
    });
    if (countryByKeyword) return { country: countryByKeyword.name, isUnique: false };

    return null;
};

export const smartParsePhone = (input: string): SmartPhoneResult => {
    if (!input) return { primary: '', others: [], status: 'Invalide', note: '', isExplicit: false };
    
    let raw = input.trim();
    if (raw.startsWith('=')) raw = raw.substring(1).trim();
    const isExplicit = raw.startsWith('+') || raw.startsWith('00');
    let cleanDigits = raw.replace(/[\s\-\(\)\.]/g, '');
    if (cleanDigits.startsWith('00')) cleanDigits = '+' + cleanDigits.substring(2);
    
    let parts = cleanDigits.split(/[\/\,;\|]+/).map(p => p.trim()).filter(p => p.length >= 7);
    const results: string[] = [];
    
    parts.forEach(part => {
        let clean = part;
        const d = part.replace(/\D/g, '');
        if (!clean.startsWith('+')) {
            const sortedCountries = [...COUNTRIES_DB].sort((a,b) => b.id.length - a.id.length);
            for (const c of sortedCountries) {
                if (d.startsWith(c.id) && d.length >= (c.id.length + 7)) {
                    clean = '+' + d;
                    break;
                }
            }
        }
        results.push(clean);
    });

    const primary = results[0] || '';
    let detectedCountry: string | undefined = undefined;
    const digits = primary.replace(/\D/g, '');
    for (const c of [...COUNTRIES_DB].sort((a,b) => b.id.length - a.id.length)) {
        if (digits.startsWith(c.id)) {
            detectedCountry = c.name;
            break;
        }
    }
    
    let status: StudentLead['phoneVerification'] | 'Numéro non normalisé' = 'Inconnu';
    try {
        const testNum = primary.startsWith('+') ? primary : '+' + primary;
        const parsed = parsePhoneNumber(testNum);
        status = (parsed && isValidNumber(parsed.number)) ? 'Valide' : 'Invalide';
    } catch (e) { status = 'Invalide'; }

    return { primary, others: results.slice(1), status, note: '', detectedCountry, isExplicit };
};

export const sanitizeForPostgres = <T,>(data: T): T => {
    if (typeof data === 'string') return data.replace(/\0/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '').trim() as unknown as T;
    if (Array.isArray(data)) return data.map(v => sanitizeForPostgres(v)) as unknown as T;
    if (data !== null && typeof data === 'object') {
        const obj = { ...data } as any;
        for (const k in obj) obj[k] = sanitizeForPostgres(obj[k]);
        return obj as T;
    }
    return data;
};

/**
 * IA SYSTEME ELITE (TRIANGULATION 2/3 + POIDS + PRIORITE ABSOLUE)
 */
export const resolveGeographicTruth = (
    phoneDetectedCountry?: string, 
    countryField?: string, 
    cityField?: string,
    isPhoneExplicit: boolean = false
): { winner: string | null; status: 'coherence' | 'incoherence' | 'insuffisant' } => {
    
    const phoneVote = phoneDetectedCountry || null;
    const countryInfo = resolveCityToCountry(countryField || '');
    const cityInfo = resolveCityToCountry(cityField || '');
    
    // Experts avec Poids ÉLITE
    const experts = [
        { name: phoneVote, weight: isPhoneExplicit ? 10.0 : 1.2, src: 'phone', isUnique: false },
        { name: countryInfo?.country || null, weight: countryInfo?.isUnique ? 4.0 : 1.5, src: 'country', isUnique: !!countryInfo?.isUnique },
        { name: cityInfo?.country || null, weight: cityInfo?.isUnique ? 4.0 : 1.5, src: 'city', isUnique: !!cityInfo?.isUnique }
    ];

    const activeExperts = experts.filter(e => e.name);
    if (activeExperts.length === 0) return { winner: null, status: 'insuffisant' };

    // --- PRIORITÉ ABSOLUE ÉLITE (Règle 3 & 5) ---
    // 1. Si le téléphone a un indicatif EXPLICITE (+ ou 00), il a priorité ABSOLUE (Règle Elite).
    if (isPhoneExplicit && phoneVote) {
        return { winner: phoneVote, status: 'coherence' };
    }

    // 2. Si l'indicatif (même sans +) concorde avec le PAYS ou la VILLE, il gagne immédiatement.
    if (phoneVote && (phoneVote === cityInfo?.country || phoneVote === countryInfo?.country)) {
        return { winner: phoneVote, status: 'coherence' };
    }

    // 3. Si une VILLE UNIQUE est détectée, elle prend le relais pour les numéros locaux.
    const uniqueExpert = activeExperts.find(e => (e.src === 'city' || e.src === 'country') && e.isUnique);
    if (uniqueExpert && uniqueExpert.name) {
        return { winner: uniqueExpert.name, status: 'coherence' };
    }

    // 2. Détection de la Majorité de Nombre (Règle des 2/3)
    const countryCounts: Record<string, number> = {};
    activeExperts.forEach(e => {
        if (e.name) countryCounts[e.name] = (countryCounts[e.name] || 0) + 1;
    });

    let winnerByCount: string | null = null;
    let maxCount = 0;
    for (const [c, count] of Object.entries(countryCounts)) {
        if (count > maxCount) {
            maxCount = count;
            winnerByCount = c;
        } else if (count === maxCount) {
            winnerByCount = null; // Égalité de nombre
        }
    }

    if (winnerByCount && maxCount >= 2) {
        return { winner: winnerByCount, status: 'coherence' };
    }

    // 3. Arbitrage par Poids 
    const countryScores: Record<string, number> = {};
    activeExperts.forEach(e => {
        if (e.name) countryScores[e.name] = (countryScores[e.name] || 0) + e.weight;
    });

    let winnerByWeight: string | null = null;
    let maxScore = 0;
    for (const [c, score] of Object.entries(countryScores)) {
        if (score > maxScore) {
            maxScore = score;
            winnerByWeight = c;
        } else if (score === maxScore) {
            winnerByWeight = null; // Égalité de poids
        }
    }

    if (winnerByWeight) {
        const sortedScores = Object.values(countryScores).sort((a,b) => b-a);
        const secondScore = sortedScores[1] || 0;
        if (maxScore > secondScore + 0.5) {
            return { winner: winnerByWeight, status: 'coherence' };
        }
    }

    return { winner: null, status: 'incoherence' };
};

export const verifyPhoneNumber = async (phone: string): Promise<StudentLead['phoneVerification']> => {
    const result = smartParsePhone(phone);
    return result.status === 'Numéro non normalisé' ? 'Inconnu' : result.status;
};
