import React, { useEffect, useState } from 'react';
import { X, Mail, Clock, CheckCircle2, RefreshCw, Trash2, Shield } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { usePopup } from './Popup';

interface Invitation {
    id: string;
    email: string;
    role: 'admin' | 'agent';
    status: 'pending' | 'accepted' | 'expired';
    created_at: string;
}

interface InvitationsManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const InvitationsManagerModal: React.FC<InvitationsManagerModalProps> = ({ isOpen, onClose }) => {
    const { addToast } = useToast();
    const { showConfirm } = usePopup();
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchInvitations = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('invitations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setInvitations(data || []);
        } catch (error: any) {
            addToast(error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchInvitations();
    }, [isOpen]);

    const deleteInvitation = async (id: string) => {
        const confirmed = await showConfirm("Supprimer l'invitation", "Êtes-vous sûr de vouloir annuler cette invitation ? L'utilisateur ne pourra plus s'inscrire avec ce lien.", "error");
        if (!confirmed) return;

        try {
            const { error } = await supabase.from('invitations').delete().eq('id', id);
            if (error) throw error;
            setInvitations(invitations.filter(i => i.id !== id));
            addToast("Invitation supprimée", "success");
        } catch (error: any) {
            addToast(error.message, "error");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1100,
            padding: '1rem'
        }} onClick={onClose}>
            <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Invitations de l'Équipe</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Suivez l'état des comptes en attente.</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>Chargement...</div>
                    ) : invitations.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <Mail size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>Aucune invitation en cours.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {invitations.map((inv) => (
                                <div key={inv.id} style={{
                                    padding: '1rem',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <div style={{ padding: '0.5rem', background: inv.status === 'accepted' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)', borderRadius: '10px' }}>
                                            {inv.status === 'accepted' ? <CheckCircle2 size={20} color="var(--success)" /> : <Clock size={20} color="var(--warning)" />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {inv.email}
                                                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                    {inv.role}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                Envoyée le {new Date(inv.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        {inv.status === 'pending' && (
                                            <button
                                                onClick={() => addToast("Lien de rappel envoyé (Simulation)", "info")}
                                                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <RefreshCw size={14} /> Rappeler
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteInvitation(inv.id)}
                                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>
                        <Shield size={12} style={{ marginRight: '4px' }} />
                        Les codes Supabase Auth expirent après 24h par défaut.
                    </p>
                    <button onClick={onClose} className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}>Fermer</button>
                </div>
            </div>
        </div>
    );
};

export default InvitationsManagerModal;
