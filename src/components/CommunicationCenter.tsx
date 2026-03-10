import React, { useState, useRef, useEffect } from 'react';
import { Phone, MessageCircle, X } from 'lucide-react';

interface CommunicationCenterProps {
    phone: string;
    status?: 'Inconnu' | 'Valide' | 'Invalide' | 'WhatsApp';
    onAction?: (type: 'Appel' | 'WhatsApp' | 'SMS' | 'Verify' | 'Confirm') => void;
}

const CommunicationCenter: React.FC<CommunicationCenterProps> = ({ phone, status = 'Inconnu', onAction }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const formattedPhone = phone.replace(/\s+/g, '').replace(/^\+/, '');

    const getStatusColor = () => {
        switch (status) {
            case 'Valide': return '#3b82f6';
            case 'WhatsApp': return '#25D366';
            case 'Invalide': return '#ef4444';
            default: return 'var(--text-muted)';
        }
    };

    const handleVerifySync = () => {
        // Opens WhatsApp for manual probing
        window.open(`https://wa.me/${formattedPhone}`, '_blank');
        if (onAction) onAction('Verify');
    };

    const handleConfirm = () => {
        if (onAction) onAction('Confirm');
    };

    const actions = [
        {
            id: 'gsm',
            icon: <Phone size={16} />,
            label: 'Appel GSM',
            href: `tel:${formattedPhone}`,
            color: 'var(--primary)',
            type: 'Appel' as const
        },
        {
            id: 'whatsapp',
            icon: <MessageCircle size={16} />,
            label: 'WhatsApp',
            href: `https://wa.me/${formattedPhone}`,
            color: '#25D366',
            type: 'WhatsApp' as const,
            hidden: status === 'Invalide'
        },
        {
            id: 'sms',
            icon: <MessageCircle size={16} />,
            label: 'Envoyer SMS',
            href: `sms:${formattedPhone}`,
            color: 'var(--accent)',
            type: 'SMS' as const
        }
    ].filter(a => !a.hidden);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div style={{ position: 'relative' }} ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: 'none',
                    border: 'none',
                    color: getStatusColor(),
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
                <Phone size={14} />
                {status !== 'Inconnu' && (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getStatusColor() }} />
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '8px',
                    zIndex: 1000,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                    minWidth: '200px',
                    marginTop: '8px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Contact & Vérification</span>
                        <X size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsOpen(false)} />
                    </div>

                    <div style={{ padding: '8px', marginBottom: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.75rem' }}>Statut: <span style={{ color: getStatusColor(), fontWeight: 600 }}>{status === 'Valide' ? 'Format Valide' : status}</span></div>
                            {status !== 'WhatsApp' && (
                                <button
                                    onClick={handleVerifySync}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        color: 'white',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Tester WhatsApp
                                </button>
                            )}
                        </div>
                        {status !== 'WhatsApp' && status !== 'Invalide' && (
                            <button
                                onClick={handleConfirm}
                                style={{
                                    width: '100%',
                                    background: '#25D366',
                                    border: 'none',
                                    color: 'white',
                                    padding: '6px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px'
                                }}
                            >
                                <MessageCircle size={14} />
                                Confirmer sur WhatsApp
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {actions.map(action => (
                            <a
                                key={action.id}
                                href={action.href}
                                onClick={() => {
                                    if (onAction) onAction(action.type);
                                    setIsOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    color: 'white',
                                    textDecoration: 'none',
                                    fontSize: '0.875rem',
                                    transition: 'background 0.2s ease'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ color: action.color }}>{action.icon}</div>
                                {action.label}
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunicationCenter;
