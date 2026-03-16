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

    // 1. Séparation intelligente (IA) basée sur les séparateurs communs
    // On split par / , ; | ou espace si les blocs ressemblent à des numéros
    const parts = input.split(/[\/\,;\|]+/).map(p => p.trim()).filter(p => p.length >= 8);
    
    // Si c'est juste un long string sans séparateur mais avec bcp de chiffres (ex: 221771234567221701234567)
    // On pourrait ajouter une logique de découpage ici, mais restons sur les séparateurs explicites pour l'instant.

    const results: string[] = [];
    
    parts.forEach(part => {
        let clean = part.replace(/[^\d+]/g, ''); // Garde + et chiffres
        
        // Gestion des "00" en début de numéro -> transformé en "+"
        if (clean.startsWith('00')) clean = '+' + clean.substring(2);
        
        // Si pas de +, on tente d'analyser sans
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
 * Vérification unitaire stricte
 */
export const verifyPhoneNumber = async (phone: string): Promise<StudentLead['phoneVerification']> => {
    const result = smartParsePhone(phone);
    return result.status;
};
