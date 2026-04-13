import React, { useState, useEffect } from 'react';
import { X, Mail, Phone, MapPin, CheckCircle2, Calendar, Video, Map } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import type { StudentLead, LeadStatus } from '../types';

interface LeadDetailsModalProps {
    lead: StudentLead;
    isOpen: boolean;
    onClose: () => void;
    statuses: LeadStatus[];
    onUpdate: () => Promise<void>;
}

const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({ lead, isOpen, onClose, statuses, onUpdate }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [statusId, setStatusId] = useState(lead.statusId);
    const [selectedField, setSelectedField] = useState<string>(lead.fieldOfInterest || '');
    const [selectedLevel, setSelectedLevel] = useState<string>(lead.level || '');
    const [note, setNote] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentType, setAppointmentType] = useState('En Ligne');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [history, setHistory] = useState<any[]>([]);

    const LICENSE_STREAMS = [
        "IA & Génie Logiciel",
        "Marketing Digital & E-commerce",
        "Management de Projet Numérique",
        "Finance Digitale"
    ];

    const LEVELS = ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2"];

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
            setStatusId(lead.statusId);
            setSelectedField(lead.fieldOfInterest || '');
            setSelectedLevel(lead.level || '');
            setAppointmentDate('');
            setAppointmentType('En Ligne');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, lead]);

    const fetchHistory = async () => {
        const { data } = await supabase
            .from('lead_interactions')
            .select('*')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false });
        if (data) setHistory(data);
    };

    const handleUpdate = async () => {
        setLoading(true);
        try {
            // 1. Mettre à jour le prospect
            const { error: updateError } = await supabase
                .from('leads')
                .update({
                    status_id: statusId,
                    field_of_interest: selectedField,
                    level: selectedLevel,
                    last_interaction_at: new Date().toISOString()
                })
                .eq('id', lead.id);
            if (updateError) throw updateError;

            // 2. Ajouter les détails du rendez-vous / rappel si concerné
            if ((statusId.toLowerCase().includes('rendez-vous') || statusId.toLowerCase().includes('rappel') || statusId.toLowerCase().includes('cours')) && appointmentDate) {
                const isAppointment = statusId.toLowerCase().includes('rendez-vous');
                const { error: interactionError } = await supabase
                    .from('lead_interactions')
                    .insert({
                        lead_id: lead.id,
                        agent_id: lead.agentId,
                        type: isAppointment ? 'appointment' : 'reminder',
                        content: isAppointment
                            ? `🗓️ RDV PLANIFIÉ : ${new Date(appointmentDate).toLocaleString()} - Format : ${appointmentType}`
                            : `☎️ RAPPEL PLANIFIÉ : ${new Date(appointmentDate).toLocaleString()}`
                    });
                if (interactionError) throw interactionError;
            }

            // 3. Ajouter la note si présente
            if (note.trim()) {
                const { error: noteError } = await supabase
                    .from('lead_interactions')
                    .insert({
                        lead_id: lead.id,
                        agent_id: lead.agentId,
                        type: 'note',
                        content: note
                    });
                if (noteError) throw noteError;
            }

            // 3. Ajouter une interaction de changement de statut si le statut a changé
            if (statusId !== lead.statusId) {
                const newStatus = statuses.find(s => s.id === statusId)?.label || statusId;
                await supabase.from('lead_interactions').insert({
                    lead_id: lead.id,
                    agent_id: lead.agentId,
                    type: 'status_change',
                    content: `Statut modifié en : ${newStatus}`
                });
            }

            addToast("Fiche mise à jour avec succès !", "success");
            setNote('');
            await onUpdate();
            onClose();
        } catch (error: unknown) {
            addToast((error as Error).message, "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center',
            zIndex: 2000, padding: '1rem'
        }} onClick={onClose}>
            <div className="card" style={{
                width: '100%', maxWidth: '800px', maxHeight: '90vh',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                background: '#0a0a0a', border: '1px solid var(--border)'
            }} onClick={e => e.stopPropagation()}>

                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary)', display: 'grid', placeItems: 'center', fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>
                            {lead.firstName[0]}{lead.lastName[0]}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{lead.firstName} {lead.lastName}</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Dossier prospect #{lead.id.slice(0, 8)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', padding: '2rem' }}>

                    {/* Colonne GAUCHE : INFOS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Coordonnées</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'white' }}>
                                    <Mail size={18} color="var(--primary)" /> {lead.email}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'white' }}>
                                    <Phone size={18} color="var(--primary)" /> {lead.phone}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'white' }}>
                                    <MapPin size={18} color="var(--primary)" /> {lead.city}, {lead.country}
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Filière & Niveau</label>
                            <p style={{ fontWeight: 600 }}>{lead.fieldOfInterest}</p>
                            <p style={{ color: 'var(--text-muted)' }}>{lead.level}</p>
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Statut du dossier</label>
                            <select
                                value={statusId}
                                onChange={e => setStatusId(e.target.value)}
                                style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                            >
                                {statuses.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        {(statusId.toLowerCase().includes('inscrit') || statusId.toLowerCase().includes('confirme') || statusId.toLowerCase().includes('orientation')) && (
                            <div className="animate-fade" style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.1)', marginTop: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--success)', marginBottom: '1.25rem' }}>
                                    <CheckCircle2 size={18} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                        {statusId.toLowerCase().includes('orientation') ? 'Détails de la Réorientation' : 'Détails de l\'Inscription'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Niveau d'entrée</label>
                                        <select
                                            value={selectedLevel}
                                            onChange={e => setSelectedLevel(e.target.value)}
                                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: 'white' }}
                                        >
                                            <option value="">Sélectionner le niveau...</option>
                                            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Filière Spécialisée</label>
                                        <select
                                            value={selectedField}
                                            onChange={e => setSelectedField(e.target.value)}
                                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: 'white' }}
                                        >
                                            <option value="">Sélectionner la filière...</option>
                                            {LICENSE_STREAMS.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                        {(statusId.toLowerCase().includes('rendez-vous') || statusId.toLowerCase().includes('rappel') || statusId.toLowerCase().includes('cours')) && (
                            <div className="animate-fade" style={{ padding: '1.5rem', background: statusId.toLowerCase().includes('rendez-vous') ? 'rgba(99, 102, 241, 0.05)' : 'rgba(245, 158, 11, 0.05)', borderRadius: '16px', border: statusId.toLowerCase().includes('rendez-vous') ? '1px solid rgba(99, 102, 241, 0.1)' : '1px solid rgba(245, 158, 11, 0.1)', marginTop: '0.8rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: statusId.toLowerCase().includes('rendez-vous') ? 'var(--primary)' : 'var(--warning)', marginBottom: '1.25rem' }}>
                                    {statusId.toLowerCase().includes('rendez-vous') ? <Calendar size={18} /> : <Phone size={18} />}
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                        {statusId.toLowerCase().includes('rendez-vous') ? 'Planification du Rendez-vous' : 'Planification du Rappel'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Prévu le : (Date et Heure)</label>
                                        <input
                                            type="datetime-local"
                                            value={appointmentDate}
                                            onChange={e => setAppointmentDate(e.target.value)}
                                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: statusId.toLowerCase().includes('rendez-vous') ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', color: 'white' }}
                                        />
                                    </div>
                                    {statusId.toLowerCase().includes('rendez-vous') && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <button
                                                onClick={() => setAppointmentType('En Ligne')}
                                                style={{
                                                    padding: '0.625rem',
                                                    borderRadius: '10px',
                                                    border: '1px solid ' + (appointmentType === 'En Ligne' ? 'var(--primary)' : 'var(--border)'),
                                                    background: appointmentType === 'En Ligne' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Video size={14} /> En Ligne
                                            </button>
                                            <button
                                                onClick={() => setAppointmentType('Présentiel')}
                                                style={{
                                                    padding: '0.625rem',
                                                    borderRadius: '10px',
                                                    border: '1px solid ' + (appointmentType === 'Présentiel' ? 'var(--primary)' : 'var(--border)'),
                                                    background: appointmentType === 'Présentiel' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Map size={14} /> Campus
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Colonne DROITE : ACTIONS & HISTORIQUE */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Ajouter une note de suivi</label>
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Compte-rendu de l'appel, questions posées..."
                                style={{ width: '100%', minHeight: '120px', padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', color: 'white', resize: 'none' }}
                            />
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Historique des activités</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {history.length === 0 ? (
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Aucun historique pour ce prospect.</p>
                                ) : (
                                    history.map((h) => (
                                        <div key={h.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                                {new Date(h.created_at).toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '0.875rem' }}>{h.content}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                    <button onClick={onClose} className="btn" style={{ background: 'transparent', color: 'white' }}>Annuler</button>
                    <button
                        onClick={handleUpdate}
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem 2rem', fontWeight: 700 }}
                    >
                        {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LeadDetailsModal;
