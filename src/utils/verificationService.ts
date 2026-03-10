import type { StudentLead } from '../types';
import { parsePhoneNumber, isValidNumber } from 'libphonenumber-js';

/**
 * Service de Vérification Téléphonique "Intelligent"
 * 
 * Stratégie :
 * 1. Nettoyage et Parsing strict du numéro (Format International E.164).
 * 2. Détection du type de ligne (Mobile vs Fixe).
 * 3. Heuristique CRM : Si c'est un Mobile Valide => C'est un numéro WhatsApp.
 */
export const verifyPhoneNumber = async (phone: string): Promise<StudentLead['phoneVerification']> => {
    // Nettoyage : on garde le "+" initial éventuel et les chiffres
    const cleanPhone = phone.trim();

    if (!cleanPhone || cleanPhone.length < 5) return 'Invalide';

    try {
        // Parsing (ajoute le + si manquant pour forcer le format intl)
        const rawNumber = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
        const phoneNumber = parsePhoneNumber(rawNumber);

        // 1. Est-ce un numéro mathématiquement possible ?
        if (!phoneNumber || !isValidNumber(phoneNumber.number)) {
            return 'Invalide';
        }

        // 2. Quel est le type de ligne ?
        const type = phoneNumber.getType();

        // Stratégie "Strict Format & Manual Confirm" :
        // On valide que le numéro est techniquement parfait (Indicatif correct, longueur correcte, Mobile).
        // Mais on ne marque pas automatiquement "WhatsApp" (Vert). On marque "Valide" (Bleu).
        // C'est l'utilisateur qui confirmera manuellement la présence sur WhatsApp.
        if (type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE') {
            return 'Valide';
        }

        // Les fixes sont aussi valides techniquement (pour les appels).
        if (type === 'FIXED_LINE') {
            return 'Valide';
        }

        // Autres (Numéros surtaxés, Pagers, VoIP, Inconnu...)
        return 'Inconnu';

    } catch (error) {
        // Échec critique du parsing (ex: lettres dans le numéro)
        return 'Invalide';
    }
};
