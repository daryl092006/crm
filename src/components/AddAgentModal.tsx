
import React, { useState } from 'react';
import { X, User, Mail, Shield } from 'lucide-react';
import type { UserRole } from '../types';

// Définition des rôles disponibles avec libellés et descriptions
const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
    {
        value: 'admin',
        label: 'Administrateur',
        description: 'Accès total à la plateforme, gestion des utilisateurs et paramètres.'
    },
    {
        value: 'direction',
        label: 'Direction',
        description: 'Consultation des tableaux de bord et statistiques. Lecture seule.'
    },
    {
        value: 'superagent',
        label: 'Responsable communication',
        description: 'Création de campagnes, import de prospects, suivi des agents.'
    },
    {
        value: 'agent',
        label: 'Agent',
        description: 'Gestion des prospects assignés, contact WhatsApp/appel/email.'
    },
    {
        value: 'superviseur',
        label: 'Superviseur',
        description: 'Suivi de l\'activité et lecture étendue. Modification limitée.'
    },
];

interface AddAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (fullName: string, email: string, role: UserRole) => Promise<void>;
}

const AddAgentModal: React.FC<AddAgentModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('agent');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onAdd(fullName, email, role);
            setFullName('');
            setEmail('');
            setRole('agent');
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const selectedRoleOption = ROLE_OPTIONS.find(r => r.value === role);

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    <X size={20} />
                </button>

                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Ajouter un Membre</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Le membre sera créé immédiatement et recevra ses accès par email.
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Nom complet */}
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                            Nom Complet
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="ex: Jean Dupont"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem 0.75rem 2.75rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    color: 'white'
                                }}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                            Adresse Email
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ex: membre@escen.university"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem 0.75rem 2.75rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    color: 'white'
                                }}
                            />
                        </div>
                    </div>

                    {/* Sélecteur de rôle */}
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                            Rôle
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Shield size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value as UserRole)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem 0.75rem 2.75rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    color: 'white',
                                    appearance: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                {ROLE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value} style={{ background: '#1a1b1e' }}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Description du rôle sélectionné */}
                        {selectedRoleOption && (
                            <p style={{
                                marginTop: '0.5rem',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                padding: '0.5rem 0.75rem',
                                background: 'rgba(99, 102, 241, 0.05)',
                                borderRadius: '8px',
                                border: '1px solid rgba(99, 102, 241, 0.15)',
                                lineHeight: 1.5
                            }}>
                                {selectedRoleOption.description}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '0.5rem', padding: '1rem' }}
                    >
                        {loading ? 'Création en cours...' : 'Ajouter le Membre'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddAgentModal;
