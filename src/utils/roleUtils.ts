/**
 * roleUtils.ts — Utilitaires centralisés pour la gestion des rôles
 * TASK-DB-001 — Refonte du système de rôles
 *
 * Ce fichier centralise toute la logique de vérification des permissions
 * basée sur les rôles. Tous les composants doivent importer les helpers
 * depuis ici plutôt que de comparer directement profile?.role === 'admin'.
 *
 * Rôles disponibles :
 *   admin       → Accès total plateforme
 *   direction   → Lecture seule tableaux de bord
 *   superagent  → Responsable communication / gestion campagnes
 *   agent       → Agent de terrain
 *   superviseur → Suivi et lecture étendue
 */

import type { UserRole } from '../types';

// =========================================================
// Libellés en français pour chaque rôle
// =========================================================
export const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Administrateur',
    direction: 'Direction',
    superagent: 'Responsable communication',
    agent: 'Agent',
    superviseur: 'Superviseur',
};

// =========================================================
// Descriptions pour les formulaires d'invitation
// =========================================================
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
    admin: 'Accès total à la plateforme : gestion des utilisateurs, paramètres et campagnes.',
    direction: 'Consultation des tableaux de bord et statistiques. Lecture seule.',
    superagent: 'Création de campagnes, import de prospects, suivi et affectation des agents.',
    agent: 'Gestion des prospects assignés, contact via WhatsApp, appel et email.',
    superviseur: 'Suivi de l\'activité de l\'équipe et lecture étendue. Modification limitée.',
};

// =========================================================
// Vérifications de permissions — à utiliser dans les composants
// =========================================================

/** L'utilisateur a-t-il les droits d'administration complète ? */
export const isAdmin = (role?: UserRole | string | null): boolean =>
    role === 'admin';

/** L'utilisateur a-t-il accès à la gestion des campagnes et de l'équipe ? */
export const canManageCampaigns = (role?: UserRole | string | null): boolean =>
    role === 'admin' || role === 'superagent';

/** L'utilisateur peut-il voir le dashboard global ? */
export const canViewGlobalDashboard = (role?: UserRole | string | null): boolean =>
    role === 'admin' || role === 'direction' || role === 'superviseur' || role === 'superagent';

/** L'utilisateur peut-il modifier les données des prospects ? */
export const canEditLeads = (role?: UserRole | string | null): boolean =>
    role === 'admin' || role === 'superagent' || role === 'agent';

/** L'utilisateur peut-il affecter des prospects à des agents ? */
export const canAssignLeads = (role?: UserRole | string | null): boolean =>
    role === 'admin' || role === 'superagent';

/** L'utilisateur peut-il accéder à la section "Mon Équipe" ? */
export const canManageTeam = (role?: UserRole | string | null): boolean =>
    role === 'admin' || role === 'superagent';

/** L'utilisateur peut-il accéder aux paramètres globaux ? */
export const canAccessSettings = (role?: UserRole | string | null): boolean =>
    role === 'admin';

/** L'utilisateur est-il un simple agent (accès restreint à ses propres leads) ? */
export const isAgentOnly = (role?: UserRole | string | null): boolean =>
    role === 'agent';

// =========================================================
// Options pour les sélecteurs de rôle dans les formulaires
// =========================================================
export const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
    { value: 'admin',       label: ROLE_LABELS.admin,       description: ROLE_DESCRIPTIONS.admin       },
    { value: 'direction',   label: ROLE_LABELS.direction,   description: ROLE_DESCRIPTIONS.direction   },
    { value: 'superagent',  label: ROLE_LABELS.superagent,  description: ROLE_DESCRIPTIONS.superagent  },
    { value: 'agent',       label: ROLE_LABELS.agent,       description: ROLE_DESCRIPTIONS.agent       },
    { value: 'superviseur', label: ROLE_LABELS.superviseur, description: ROLE_DESCRIPTIONS.superviseur },
];
