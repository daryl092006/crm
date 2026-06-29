import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { UserRole } from '../types';

interface RequirePermissionProps {
    role: UserRole | string | null | undefined;
    allowedRoles: UserRole[];
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({
    role,
    allowedRoles,
    fallback,
    children
}) => {
    const isAllowed = role && allowedRoles.includes(role as UserRole);

    if (!isAllowed) {
        if (fallback) return <>{fallback}</>;

        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem 2rem',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px dashed var(--border)',
                borderRadius: '24px',
                margin: '2rem 0'
            }}>
                <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '50%',
                    color: '#ef4444',
                    marginBottom: '1.5rem',
                    display: 'grid',
                    placeItems: 'center'
                }}>
                    <ShieldAlert size={48} />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', color: 'white' }}>Accès non autorisé</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    Votre rôle actuel <strong>({role || 'Inconnu'})</strong> ne possède pas les permissions requises pour accéder à ce module.
                </p>
            </div>
        );
    }

    return <>{children}</>;
};

export default RequirePermission;
