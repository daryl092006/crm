import React from 'react';
import { X, Clock, MessageSquare, Phone, RefreshCw, Calendar } from 'lucide-react';
import type { StudentLead } from '../types';

interface LeadHistoryModalProps {
    isOpen: boolean;
    lead: StudentLead | null;
    onClose: () => void;
    onAddNote: (content: string) => Promise<void>;
}

const LeadHistoryModal: React.FC<LeadHistoryModalProps> = ({ isOpen, lead, onClose, onAddNote }) => {
    const [newNote, setNewNote] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    if (!isOpen || !lead) return null;

    const handleAddNote = async () => {
        if (!newNote.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await onAddNote(newNote.trim());
            setNewNote('');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Combiner les notes de la colonne 'notes' et les interactions réelles
    // Si la colonne notes contient du texte, on le simule comme une interaction de type "legacy"
    // On trie par date décroissante
    const allEvents = [
        ...(lead.interactions || []).map(i => ({
            ...i,
            isInteraction: true
        })),
        // Si lead.notes existe, on l'ajoute comme point de départ ou note globale si elle n'est pas déjà dans les interactions
        ...(lead.notes ? [{
            id: 'legacy-notes',
            type: 'note' as const,
            content: lead.notes,
            createdAt: lead.createdAt, // Ou une date estimée
            isInteraction: false
        }] : [])
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const getIcon = (type: string) => {
        switch (type) {
            case 'call': return <Phone size={16} />;
            case 'whatsapp': return <MessageSquare size={16} />;
            case 'sms': return <MessageSquare size={16} />;
            case 'status_change': return <RefreshCw size={16} />;
            case 'note': return <MessageSquare size={16} />;
            default: return <Clock size={16} />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'call': return 'Appel';
            case 'whatsapp': return 'WhatsApp';
            case 'sms': return 'SMS';
            case 'status_change': return 'Changement de statut';
            case 'note': return 'Note Manuel';
            default: return 'Activité';
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center', zIndex: 2000, padding: '2rem'
        }} onClick={onClose}>
            <div className="card glassmorphism" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                
                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Historique : {lead.firstName} {lead.lastName}</h2>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Fil d'actualité complet du prospect</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {allEvents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <Clock size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>Aucun historique pour le moment.</p>
                        </div>
                    ) : (
                        allEvents.map((event, idx) => (
                            <div key={event.id + idx} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                                {/* Timeline line */}
                                {idx !== allEvents.length - 1 && (
                                    <div style={{ position: 'absolute', left: '17px', top: '35px', bottom: '-20px', width: '2px', background: 'rgba(255,255,255,0.05)' }}></div>
                                )}
                                
                                <div style={{ 
                                    width: '36px', height: '36px', borderRadius: '12px', 
                                    background: event.type === 'status_change' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    display: 'grid', placeItems: 'center', color: event.type === 'status_change' ? 'var(--primary)' : 'var(--text-muted)',
                                    flexShrink: 0, zIndex: 1
                                }}>
                                    {getIcon(event.type)}
                                </div>

                                <div style={{ flex: 1, paddingBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                            {getTypeLabel(event.type)}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Calendar size={12} />
                                            {new Date(event.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div style={{ 
                                        background: 'rgba(255,255,255,0.02)', 
                                        padding: '12px', 
                                        borderRadius: '12px', 
                                        border: '1px solid rgba(255,255,255,0.04)',
                                        color: 'white',
                                        fontSize: '0.925rem',
                                        lineHeight: 1.5,
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {event.content}
                                    </div>
                                    {event.isInteraction === false && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--warning)', marginTop: '4px', fontWeight: 600 }}>
                                            * Note globale du dossier
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <textarea 
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="Ajouter une observation importante..."
                        disabled={isSubmitting}
                        style={{ 
                            width: '100%', 
                            minHeight: '80px', 
                            background: 'rgba(0,0,0,0.2)', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            borderRadius: '12px', 
                            padding: '12px', 
                            color: 'white', 
                            fontSize: '0.9rem',
                            resize: 'none' 
                        }}
                    />
                    <button 
                        onClick={handleAddNote}
                        disabled={isSubmitting || !newNote.trim()}
                        className="btn btn-primary" 
                        style={{ width: '100%', justifyContent: 'center', opacity: (isSubmitting || !newNote.trim()) ? 0.5 : 1 }}
                    >
                        {isSubmitting ? 'Enregistrement...' : 'Publier la note'}
                    </button>
                    <button onClick={onClose} className="btn" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600, marginTop: '5px' }}>
                        Fermer l'historique
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LeadHistoryModal;
