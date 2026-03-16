import type { StudentLead } from '../types';
import { parsePhoneNumber, isValidNumber } from 'libphonenumber-js';

/**
 * Service de Vérification & Conformité Téléphonique (IA-Powered Logic)
 * 
 * Ce service agit comme un assistant intelligent pour :
 * 1. Détecter et séparer les numéros multiples dans une cellule.
 * 2. Nettoyer et normaliser au format international E.164.
 * 3. Valider la viabilité technique (Mobile vs Fixe).
 */

export interface SmartPhoneResult {
    primary: string;
    others: string[];
    status: StudentLead['phoneVerification'];
    note: string;
}

/**
 * Analyse "IA" intelligente du champ téléphone
 * Gère les formats : "771234567 / 701234567", "+22177... ; 00336...", etc.
 */
export const smartParsePhone = (input: string): SmartPhoneResult => {
    if (!input) return { primary: '', others: [], status: 'Invalide', note: '' };

    // 1. Nettoyage des résidus de formules Excel (le signe = au début)
    let raw = input.trim();
    if (raw.startsWith('=')) raw = raw.substring(1).trim();
    // Enlever les guillemets si Excel a exporté en ="771234567"
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.substring(1, raw.length - 1).trim();

    // 2. Détection des erreurs Excel fatales
    if (raw.includes('#ERROR!') || raw.includes('#REF!') || raw.includes('#VALEUR!')) {
        return { primary: '', others: [], status: 'Invalide', note: 'Erreur de formule Excel détectée' };
    }

    // 3. Gestion de la notation scientifique (ex: 655+08 -> 655000000)
    if (raw.includes('+') && !raw.startsWith('+') && /\d+\+\d+/.test(raw)) {
        const partsSci = raw.split('+');
        const base = partsSci[0];
        const exp = parseInt(partsSci[1]);
        if (!isNaN(exp) && exp > 5) {
            raw = base.padEnd(base.length + (exp - (base.length - 1)), '0');
        }
    }

    // 4. Séparation intelligente (IA) basée sur les séparateurs communs
    let parts = raw.split(/[\/\,;\|]+/).map(p => p.trim()).filter(p => p.length >= 7);
    
    // --- NOUVEAU : Détection de numéros "collés" sans séparateur ---
    // Si on a un bloc très long, on cherche des indicatifs pays qui se suivent
    const commonPrefixes = ['221', '222', '223', '224', '225', '226', '227', '228', '229', '237', '241', '242', '243', '33', '32', '41', '212', '213', '216'];
    
    let refinedParts: string[] = [];
    parts.forEach(p => {
        let foundSplit = false;
        const digitsOnly = p.replace(/\D/g, '');
        
        if (digitsOnly.length >= 15) {
            for (const prefix of commonPrefixes) {
                const index = digitsOnly.indexOf(prefix, 7); 
                if (index !== -1) {
                    refinedParts.push(digitsOnly.substring(0, index));
                    refinedParts.push(digitsOnly.substring(index));
                    foundSplit = true;
                    break;
                }
            }
        }
        
        if (!foundSplit) {
            refinedParts.push(p);
        }
    });
    parts = refinedParts;

    const results: string[] = [];
    
    parts.forEach(part => {
        let clean = part.replace(/[^\d+]/g, ''); // Garde + et chiffres
        
        // Gestion des "00" en début de numéro -> transformé en "+"
        if (clean.startsWith('00')) clean = '+' + clean.substring(2);

        // --- IA : Cas Spécifique BÉNIN (+229) ULTRA-STRICT ---
        // Le Bénin est passé à 10 chiffres (préfixe mandatory 01).
        const d = clean.replace(/\D/g, '');
        if (d.startsWith('229')) {
            let local = d.substring(3); // On garde ce qui vient après 229

            // Cas 1: AnCôte d'Ivoireen format à 8 chiffres (ex: 97123456) -> devient 0197123456
            if (local.length === 8) {
                local = '01' + local;
            } 
            // Cas 2: Format Excel tronqué (ex: 197123456 au lieu de 0197123456) -> devient 0197123456
            else if (local.length === 9 && local.startsWith('1')) {
                local = '0' + local;
            }
            // Cas 3: Format 9 chiffres sans le 1 (ex: 097...) -> devient 0197...
            else if (local.length === 9 && local.startsWith('0') && !local.startsWith('01')) {
                local = '01' + local.substring(1);
            }
            // Cas 4: Déjà 10 chiffres mais sans le 0 (rare)
            else if (local.length === 10 && !local.startsWith('0')) {
                // on ne touche pas si on ne sait pas, mais la règle c'est 01 au début
            }

            // Reconstruction propre : +229 + local (qui doit faire 10 chiffres commençant par 01)
            clean = '+229' + local;
        }
        
        results.push(clean);
    });

    if (results.length === 0) return { primary: input, others: [], status: 'Invalide', note: 'Format illisible' };

    const primary = results[0];
    const others = results.slice(1);
    
    // Vérification Technique
    let status: StudentLead['phoneVerification'] = 'Inconnu';
    try {
        const testNum = primary.startsWith('+') ? primary : `+${primary}`;
        const phoneNumber = parsePhoneNumber(testNum);
        if (phoneNumber && isValidNumber(phoneNumber.number)) {
            status = 'Valide';
        } else {
            status = 'Invalide';
        }
    } catch (e) {
        status = 'Invalide';
    }

    return {
        primary,
        others,
        status,
        note: others.length > 0 ? ` [IA: ${others.length} numéros additionnels détectés]` : ''
    };
};

/**
 * Nettoyage profond pour éviter les erreurs "unsupported Unicode escape sequence" (\u0000)
 * PostgREST / PostgreSQL rejette les caractères nuls dans les chaînes JSONB.
 */
export const sanitizeForPostgres = <T,>(data: T): T => {
    if (typeof data === 'string') {
        // Supprime le caractère nul \u0000 ET toutes les séquences de contrôle bizarres
        // qui font vomir Postgres (unsupported Unicode escape sequence)
        return data
            .replace(/\0/g, '')               // Byte nul réel
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Caractères de contrôle non-imprimables
            .replace(/\\u0000/g, '')          // Séquence textuelle \u3000
            .trim() as unknown as T;
    }
    
    if (Array.isArray(data)) {
        return data.map(v => sanitizeForPostgres(v)) as unknown as T;
    }
    
    if (data !== null && typeof data === 'object') {
        const obj = { ...data } as Record<string, any>;
        for (const key in obj) {
            // Nettoyage de la clé ET de la valeur
            const cleanKey = typeof key === 'string' ? key.replace(/\0/g, '') : key;
            obj[cleanKey] = sanitizeForPostgres(obj[key]);
            if (cleanKey !== key) delete obj[key];
        }
        return obj as unknown as T;
    }
    
    return data;
};

/**
 * Vérification unitaire stricte
 */
export const verifyPhoneNumber = async (phone: string): Promise<StudentLead['phoneVerification']> => {
    const result = smartParsePhone(phone);
    return result.status;
};
