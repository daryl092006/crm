import React, { useState, useEffect } from 'react';
import { X, Mail, Phone, MapPin, CheckCircle2, Calendar, Video, Map, Info, MessageSquare, Target, Activity, Database } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import type { StudentLead, LeadStatus } from '../types';
import { sendEmail } from '../services/emailService';

interface LeadDetailsModalProps {
    lead: StudentLead;
    isOpen: boolean;
    onClose: () => void;
    statuses: LeadStatus[];
    onUpdate: () => Promise<void>;
    profile: import('../types').Profile | null;
}

const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({ lead, isOpen, onClose, statuses, onUpdate, profile }) => {
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

    const qualificationSteps = [
        { id: 'qualification', label: 'Qualification', color: 'var(--primary)' },
        { id: 'information', label: 'Information', color: 'var(--accent)' },
        { id: 'candidature', label: 'Candidature', color: 'var(--warning)' },
        { id: 'decision', label: 'Décision', color: 'var(--success)' }
    ];

    const currentStepIndex = React.useMemo(() => {
        const sid = (statusId || '').toLowerCase();
        if (['admis', 'inscription_attente', 'inscrit'].includes(sid)) return 3;
        if (['rdv_planifie', 'dossier_recu'].includes(sid)) return 2;
        if (['interesse', 'rappel', 'reflexion', 'reorientation'].includes(sid)) return 1;
        return 0;
    }, [statusId]);

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
            const { error: updateError } = await supabase
                .from('leads')
                .update({
                    status_id: statusId,
                    field_of_interest: selectedField,
                    study_level: selectedLevel,
                    last_interaction_at: new Date().toISOString()
                })
                .eq('id', lead.id);
            if (updateError) throw updateError;

            // --- AUTOMATISATION EMAIL ---
            const lowerStatus = statusId.toLowerCase();
            if (lowerStatus.includes('injoignable')) {
                await sendEmail(lead.email, 'injoignable', lead.firstName);
                addToast("Email de relance (Injoignable) envoyé !", "info");
            } else if (lowerStatus.includes('repondeur') || lowerStatus.includes('répondeur')) {
                await sendEmail(lead.email, 'repondeur', lead.firstName);
                addToast("Email de relance (Répondeur) envoyé !", "info");
            } else if (lowerStatus.includes('interessé') || lowerStatus.includes('interesse') || lowerStatus.includes('documentation') || lowerStatus.includes('brochure')) {
                await sendEmail(lead.email, 'documentation', lead.firstName);
                addToast("Template M365 (Documentation) envoyé !", "success");
            }
            // -----------------------------

            if ((statusId.toLowerCase().includes('rendez-vous') || statusId.toLowerCase().includes('rappel') || statusId.toLowerCase().includes('cours')) && appointmentDate) {
                const isAppointment = statusId.toLowerCase().includes('rendez-vous');
                const isAdmin = profile?.role === 'super_admin' || profile?.role === 'super_agent';
                const isAdminChange = profile?.id !== lead.agentId && isAdmin;
                const adminSuffix = isAdminChange ? ` (par Admin: ${profile?.full_name})` : '';
                
                const { error: interactionError } = await supabase
                    .from('lead_interactions')
                    .insert({
                        lead_id: lead.id,
                        agent_id: profile?.id || lead.agentId,
                        type: isAppointment ? 'appointment' : 'reminder',
                        content: (isAppointment
                            ? `🗓️ RDV PLANIFIÉ : ${new Date(appointmentDate).toLocaleString()} - Format : ${appointmentType}`
                            : `☎️ RAPPEL PLANIFIÉ : ${new Date(appointmentDate).toLocaleString()}`) + adminSuffix
                    });
                if (interactionError) throw interactionError;
            }

            if (note.trim()) {
                const isAdmin = profile?.role === 'super_admin' || profile?.role === 'super_agent';
                const isAdminChange = profile?.id !== lead.agentId && isAdmin;
                const adminSuffix = isAdminChange ? ` (par Admin: ${profile?.full_name})` : '';
                
                const { error: noteError } = await supabase
                    .from('lead_interactions')
                    .insert({
                        lead_id: lead.id,
                        agent_id: profile?.id || lead.agentId,
                        type: 'note',
                        content: note + adminSuffix
                    });
                if (noteError) throw noteError;
            }

            if (statusId !== lead.statusId) {
                const newStatus = statuses.find(s => s.id === statusId)?.label || statusId;
                const isAdmin = profile?.role === 'super_admin' || profile?.role === 'super_agent';
                const isAdminChange = profile?.id !== lead.agentId && isAdmin;
                const adminSuffix = isAdminChange ? ` (par Admin: ${profile?.full_name})` : '';
                
                await supabase.from('lead_interactions').insert({
                    lead_id: lead.id,
                    agent_id: profile?.id || lead.agentId,
                    type: 'status_change',
                    content: `Statut modifié en : ${newStatus}` + adminSuffix
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)', display: 'grid', placeItems: 'center', zIndex: 2000, padding: '1rem' }} onClick={onClose}>
            <div className="card" style={{ width: '95vw', maxWidth: '1100px', height: '94vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0, background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '32px', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>

                {/* Modal Header Premium */}
                <div style={{ padding: '2rem 2.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <div style={{ 
                            width: '80px', height: '80px', borderRadius: '22px', 
                            background: 'linear-gradient(135deg, var(--primary), var(--accent))', 
                            display: 'grid', placeItems: 'center', fontWeight: 950, color: 'white', fontSize: '1.75rem', 
                            boxShadow: '0 8px 20px -5px var(--primary-glow)',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                            {lead.firstName[0]}{lead.lastName[0]}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                <h2 style={{ fontSize: '2rem', fontWeight: 950, letterSpacing: '-0.03em', color: 'white' }}>{lead.firstName} {lead.lastName}</h2>
                                <div style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>#{lead.id.slice(0, 8)}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                                    <MapPin size={14} /> {lead.city}, {lead.country}
                                </div>
                                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--border)' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                                    <Target size={14} /> {lead.campaignId || 'Campagne Directe'}
                                </div>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost" style={{ width: '52px', height: '52px', padding: 0, borderRadius: '16px', border: '1px solid var(--border)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Funnel Progress Visualization */}
                <div style={{ padding: '1rem 2.5rem', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                    {qualificationSteps.map((step, idx) => {
                        const isActive = idx <= currentStepIndex;
                        return (
                            <div key={step.id} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isActive ? 1 : 0.4 }}>
                                <div style={{ 
                                    width: '100%', height: '4px', background: isActive ? step.color : 'rgba(255,255,255,0.05)', 
                                    borderRadius: '2px', marginBottom: '12px',
                                    boxShadow: isActive ? `0 0 10px ${step.color}80` : 'none'
                                }} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: isActive ? 'white' : 'var(--text-muted)' }}>{step.label}</span>
                                {idx === currentStepIndex && (
                                    <div style={{ position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)', width: '12px', height: '12px', borderRadius: '50%', background: 'white', border: `3px solid ${step.color}` }} />
                                )}
                            </div>
                        );
                    })}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '3rem' }}>
                        
                        {/* LEFT COLUMN: CORE ACTIONS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                            
                            {/* Contact Section */}
                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                    <Info size={18} color="var(--primary)" />
                                    <h3 style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coordonnées & Réseau</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Email de contact</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white', fontWeight: 700 }}>
                                            <Mail size={16} /> {lead.email}
                                        </div>
                                    </div>
                                    <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Téléphone Direct</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white', fontWeight: 700 }}>
                                            <Phone size={16} /> {lead.phone}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Additional Info Section (Dynamic) */}
                            {Object.entries(lead).filter(([key, value]) => {
                                const standardKeys = [
                                    'id', 'firstName', 'lastName', 'email', 'phone', 'city', 'country', 
                                    'statusId', 'status', 'fieldOfInterest', 'level', 'notes', 'score',
                                    'campaignId', 'organizationId', 'agentId', 'agent', 
                                    'createdAt', 'updatedAt', 'lastInteractionAt', 'metadata', 
                                    'interactions', 'tasks', 'phone_verification', 'is_archived',
                                    'first_name', 'last_name', 'status_id', 'organization_id', 'campaign_id',
                                    'agent_id', 'field_of_interest', 'study_level', 'last_interaction_at', 'created_at'
                                ];
                                return !standardKeys.includes(key) && value !== null && value !== '' && typeof value !== 'object';
                            }).length > 0 && (
                                <section>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                        <Database size={18} color="var(--success)" />
                                        <h3 style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Informations de la Source</h3>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        {Object.entries(lead).filter(([key, value]) => {
                                            const standardKeys = [
                                                'id', 'firstName', 'lastName', 'email', 'phone', 'city', 'country', 
                                                'statusId', 'status', 'fieldOfInterest', 'level', 'notes', 'score',
                                                'campaign_id', 'organization_id', 'campaign_id', 'agent_id', 'field_of_interest', 'study_level', 'last_interaction_at', 'created_at',
                                                'campaignId', 'organizationId', 'agentId', 'agent', 
                                                'createdAt', 'updatedAt', 'lastInteractionAt', 'metadata', 
                                                'interactions', 'tasks', 'phone_verification', 'is_archived',
                                                'first_name', 'last_name', 'status_id'
                                            ];
                                            return !standardKeys.includes(key) && value !== null && value !== '' && typeof value !== 'object';
                                        }).map(([key, value]) => (
                                            <div key={key} className="card" style={{ padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)' }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>{key}</div>
                                                <div style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>{String(value)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Status Section */}
                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                    <Activity size={18} color="var(--accent)" />
                                    <h3 style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gestion du Statut & Qualification</h3>
                                </div>
                                <div className="card" style={{ padding: '2rem', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border)', borderRadius: '24px' }}>
                                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', marginBottom: '1rem', display: 'block' }}>Changer le Statut CRM</label>
                                        <select
                                            value={statusId}
                                            onChange={e => setStatusId(e.target.value)}
                                            disabled={profile?.role === 'observer'}
                                            style={{ width: '100%', height: '52px', fontWeight: 700, fontSize: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '14px', border: '2px solid var(--border)', opacity: profile?.role === 'observer' ? 0.6 : 1 }}
                                        >
                                            {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                    </div>

                                    {(statusId.toLowerCase().includes('inscrit') || statusId.toLowerCase().includes('confirme') || statusId.toLowerCase().includes('orientation')) && (
                                        <div className="animate-fade" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Niveau Cible</label>
                                                <select value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)} className="input" style={{ width: '100%', background: 'rgba(0,0,0,0.2)', height: '44px', fontWeight: 600 }}>
                                                    <option value="">Sélectionner...</option>
                                                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Filière Spécialisée</label>
                                                <select value={selectedField} onChange={e => setSelectedField(e.target.value)} className="input" style={{ width: '100%', background: 'rgba(0,0,0,0.2)', height: '44px', fontWeight: 600 }}>
                                                    <option value="">Sélectionner...</option>
                                                    {LICENSE_STREAMS.map(f => <option key={f} value={f}>{f}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {(statusId.toLowerCase().includes('rendez-vous') || statusId.toLowerCase().includes('rappel') || statusId.toLowerCase().includes('cours')) && (
                                        <div className="animate-fade" style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
                                                <div className="form-group">
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Échéance Planifiée</label>
                                                    <input type="datetime-local" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} className="input" style={{ width: '100%', background: 'rgba(0,0,0,0.2)', height: '44px', color: 'white', fontWeight: 700 }} />
                                                </div>
                                                {statusId.toLowerCase().includes('rendez-vous') && (
                                                    <div className="form-group">
                                                        <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Format</label>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                            <button onClick={() => setAppointmentType('En Ligne')} className={appointmentType === 'En Ligne' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: '0.75rem', padding: '0.5rem', height: '44px' }}>
                                                                <Video size={14} /> En Ligne
                                                            </button>
                                                            <button onClick={() => setAppointmentType('Présentiel')} className={appointmentType === 'Présentiel' ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: '0.75rem', padding: '0.5rem', height: '44px' }}>
                                                                <Map size={14} /> Campus
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* RIGHT COLUMN: TIMELINE & NOTES */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                            <section style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                                    <MessageSquare size={18} color="var(--warning)" />
                                    <h3 style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes & Historique</h3>
                                </div>
                                <div className="card" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <textarea
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        placeholder="Rédiger une note de suivi stratégique..."
                                        disabled={profile?.role === 'observer'}
                                        className="input"
                                        style={{ width: '100%', minHeight: '120px', padding: '1.25rem', marginBottom: '2rem', background: 'rgba(0,0,0,0.2)', resize: 'none', border: '1px solid var(--border)', fontSize: '0.95rem', lineHeight: 1.6, opacity: profile?.role === 'observer' ? 0.6 : 1 }}
                                    />

                                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', paddingRight: '0.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {history.length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '20px', fontSize: '0.9rem' }}>
                                                    <Activity size={32} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                                    <p>Aucune interaction enregistrée</p>
                                                </div>
                                            ) : (
                                                history.map((h) => (
                                                    <div key={h.id} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', borderLeft: '4px solid var(--primary)', position: 'relative' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>{new Date(h.created_at).toLocaleString()}</div>
                                                            <div style={{ fontSize: '0.65rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 900 }}>{h.type}</div>
                                                        </div>
                                                        <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, fontWeight: 500 }}>{h.content}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '2rem 2.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
                    <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.75rem 2rem', fontWeight: 700 }}>{profile?.role === 'observer' ? 'Fermer' : 'Annuler'}</button>
                    {profile?.role !== 'observer' && (
                        <button
                            onClick={handleUpdate}
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ padding: '0.75rem 3rem', fontWeight: 900, borderRadius: '14px', fontSize: '1rem', boxShadow: '0 8px 20px -5px var(--primary-glow)' }}
                        >
                            {loading ? 'Traitement Intelligence...' : 'Valider les Changements'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeadDetailsModal;
