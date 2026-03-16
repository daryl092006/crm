import React, { useState, useRef, useEffect } from 'react';
import { Phone, MessageCircle, X } from 'lucide-react';

interface CommunicationCenterProps {
    phone: string;
    label?: string;
    status?: 'Inconnu' | 'Valide' | 'Invalide' | 'WhatsApp';
    onAction?: (type: 'Appel' | 'WhatsApp' | 'SMS' | 'Verify' | 'Confirm') => void;
}

const CommunicationCenter: React.FC<CommunicationCenterProps> = ({ phone, label, status = 'Inconnu', onAction }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const normalizedDigits = phone.replace(/\D/g, ''); // Uniquement les chiffres pour WhatsApp
    const fullInternational = phone.startsWith('+') ? phone : `+${phone}`; // Format complet avec +

    const getStatusColor = () => {
        switch (status) {
            case 'Valide': return '#3b82f6';
            case 'WhatsApp': return '#25D366';
            case 'Invalide': return '#ef4444';
            default: return 'var(--text-muted)';
        }
    };

    const handleVerifySync = () => {
        window.open(`https://wa.me/${normalizedDigits}`, '_blank');
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
            href: `tel:${fullInternational}`,
            color: 'var(--primary)',
            type: 'Appel' as const
        },
        {
            id: 'whatsapp',
            icon: <MessageCircle size={16} />,
            label: 'WhatsApp',
            href: `https://wa.me/${normalizedDigits}`,
            color: '#25D366',
            type: 'WhatsApp' as const,
            hidden: status === 'Invalide'
        },
        {
            id: 'sms',
            icon: <MessageCircle size={16} />,
            label: 'Envoyer SMS',
            href: `sms:${fullInternational}`,
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
                    color: label ? 'var(--text-main)' : getStatusColor(),
                    fontWeight: label ? 600 : 400,
                    fontSize: label ? '0.875rem' : 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: label ? '4px 8px' : '4px',
                    borderRadius: '4px',
                    transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
                {label || <Phone size={14} />}
                {status !== 'Inconnu' && (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getStatusColor() }} />
                )}
            </button>

            {isOpen && isMobile && (
                <div 
                    className="overlay show" 
                    onClick={() => setIsOpen(false)} 
                    style={{ zIndex: 1100 }}
                />
            )}

            {isOpen && (
                <div style={{
                    position: isMobile ? 'fixed' : 'absolute',
                    top: isMobile ? 'auto' : '100%',
                    bottom: isMobile ? 0 : 'auto',
                    left: isMobile ? 0 : 'auto',
                    right: 0,
                    background: 'var(--bg-card)',
                    border: isMobile ? 'none' : '1px solid var(--border)',
                    borderTopLeftRadius: isMobile ? '24px' : '12px',
                    borderTopRightRadius: isMobile ? '24px' : '12px',
                    borderRadius: isMobile ? '24px 24px 0 0' : '12px',
                    padding: isMobile ? '1.5rem' : '8px',
                    zIndex: 1200,
                    boxShadow: isMobile ? '0 -10px 40px rgba(0,0,0,0.6)' : '0 10px 25px rgba(0,0,0,0.3)',
                    minWidth: isMobile ? '100%' : '200px',
                    marginTop: isMobile ? 0 : '8px',
                    animation: isMobile ? 'slideUp 0.3s ease-out' : 'none'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '1.5rem' : '8px', padding: '0 8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: isMobile ? '1.1rem' : '0.75rem', fontWeight: 800, color: 'white' }}>Contact & Actions</span>
                            {isMobile && <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{phone}</span>}
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'white' }}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div style={{ padding: isMobile ? '1rem' : '8px', marginBottom: isMobile ? '1.5rem' : '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ fontSize: isMobile ? '0.9rem' : '0.75rem' }}>Statut: <span style={{ color: getStatusColor(), fontWeight: 600 }}>{status === 'Valide' ? 'Format Valide' : status}</span></div>
                            {status !== 'WhatsApp' && (
                                <button
                                    onClick={handleVerifySync}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        color: 'white',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        fontSize: isMobile ? '0.8rem' : '0.7rem',
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
                                    padding: '12px',
                                    borderRadius: '12px',
                                    fontSize: '0.9rem',
                                    fontWeight: 750,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <MessageCircle size={18} />
                                Confirmer sur WhatsApp
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                    gap: '14px',
                                    padding: '14px 18px',
                                    borderRadius: '14px',
                                    color: 'white',
                                    textDecoration: 'none',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    background: isMobile ? 'rgba(255,255,255,0.02)' : 'transparent',
                                    transition: 'all 0.2s ease',
                                    border: isMobile ? '1px solid rgba(255,255,255,0.03)' : 'none'
                                }}
                            >
                                <div style={{ 
                                    width: '36px', 
                                    height: '36px', 
                                    borderRadius: '10px', 
                                    background: `${action.color}15`, 
                                    display: 'grid', 
                                    placeItems: 'center',
                                    color: action.color 
                                }}>
                                    {action.icon}
                                </div>
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
