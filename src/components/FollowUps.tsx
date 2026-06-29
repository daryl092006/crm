import React, { useState, useEffect } from 'react';
import { Clock, Check, Trash2, Calendar, Phone, AlertCircle, User, Award } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import type { LeadFollowUp, Agent, StudentLead } from '../types';

interface FollowUpsProps {
    profile: import('../types').Profile | null;
    agents: Agent[];
    leads: StudentLead[];
    onRefresh?: () => Promise<void>;
}

const FollowUps: React.FC<FollowUpsProps> = ({ profile, agents, leads, onRefresh }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [followUps, setFollowUps] = useState<LeadFollowUp[]>([]);
    const [filter, setFilter] = useState<'pending' | 'completed' | 'cancelled' | 'all'>('pending');
    const [agentFilter, setAgentFilter] = useState<string>('all');
    
    // Outcome states when completing a follow-up
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [resultText, setResultText] = useState('');
    const [resultStatus, setResultStatus] = useState('successful');

    const isAdmin = ['admin', 'superagent', 'direction', 'superviseur'].includes(profile?.role || '');

    const fetchFollowUps = async () => {
        if (followUps.length === 0) {
            setLoading(true);
        }
        try {
            let query = supabase.from('lead_follow_ups').select('*');
            
            // Si c'est un agent simple, on filtre par son ID
            if (!isAdmin && profile?.id) {
                query = query.eq('assigned_to', profile.id);
            } else if (agentFilter !== 'all') {
                query = query.eq('assigned_to', agentFilter);
            }

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query.order('due_at', { ascending: true });
            if (error) throw error;

            setFollowUps(data || []);
        } catch (err: any) {
            addToast("Erreur lors du chargement des relances : " + err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFollowUps();
    }, [filter, agentFilter, profile]);

    const handleCompleteFollowUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!completingId) return;

        const followUp = followUps.find(f => f.id === completingId);
        if (!followUp) return;

        setLoading(true);
        try {
            // 1. Clore la relance dans lead_follow_ups
            const { error: followUpError } = await supabase
                .from('lead_follow_ups')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    completed_by: profile?.id || null,
                    result: resultStatus
                })
                .eq('id', completingId);

            if (followUpError) throw followUpError;

            // 2. Insérer l'interaction correspondante dans lead_interactions
            const cleanResult = resultStatus === 'successful' ? 'abouti' : 'non abouti';
            await supabase.from('lead_interactions').insert({
                lead_id: followUp.lead_id,
                agent_id: profile?.id || null,
                type: 'follow_up',
                content: `RELANCE EFFECTUÉE : Relance (${followUp.follow_up_type}) marquée comme complétée. Résultat : ${cleanResult}. Note : ${resultText || 'Aucune note.'}`,
                result: resultStatus,
                created_by: profile?.id || null
            });

            addToast("Relance marquée comme effectuée !", "success");
            setCompletingId(null);
            setResultText('');
            fetchFollowUps();
            if (onRefresh) onRefresh();
        } catch (err: any) {
            addToast("Erreur : " + err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleCancelFollowUp = async (id: string) => {
        const confirmed = window.confirm("Êtes-vous sûr de vouloir annuler cette relance ?");
        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('lead_follow_ups')
                .update({ status: 'cancelled' })
                .eq('id', id);

            if (error) throw error;
            addToast("Relance annulée.", "info");
            fetchFollowUps();
        } catch (err: any) {
            addToast("Erreur : " + err.message, "error");
        }
    };

    // Séparateur de retards / relances futures
    const isOverdue = (dateStr: string) => {
        return new Date(dateStr) < new Date() && filter === 'pending';
    };

    return (
        <div className="animate-fade">
            <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 950, letterSpacing: '-0.04em' }}>Relances Prospects</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Pilotez et suivez vos relances téléphoniques, WhatsApp et par email.</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    {/* Filtre de Conseiller (Admin/Superagent uniquement) */}
                    {isAdmin && (
                        <select
                            value={agentFilter}
                            onChange={e => setAgentFilter(e.target.value)}
                            style={{ padding: '0.625rem 1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', fontWeight: 600 }}
                        >
                            <option value="all">Tous les conseillers</option>
                            {agents.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    )}

                    {/* Filtre de Statuts */}
                    <select
                        value={filter}
                        onChange={e => setFilter(e.target.value as any)}
                        style={{ padding: '0.625rem 1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', fontWeight: 600 }}
                    >
                        <option value="pending">En attente (À faire)</option>
                        <option value="completed">Terminées</option>
                        <option value="cancelled">Annulées</option>
                        <option value="all">Toutes</option>
                    </select>
                </div>
            </div>

            {/* Liste principale */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {followUps.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                        <Clock size={40} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Aucune relance</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '6px' }}>Tout est à jour ! Planifiez de nouvelles relances depuis les fiches de prospects.</p>
                    </div>
                ) : (
                    followUps.map((f) => {
                        const lead = leads.find(l => l.id === f.lead_id);
                        const assignedAgent = agents.find(a => a.id === f.assigned_to);
                        const overdue = isOverdue(f.due_at);

                        return (
                            <div
                                key={f.id}
                                className="card"
                                style={{
                                    padding: '1.5rem',
                                    borderLeft: overdue ? '4px solid #ef4444' : '4px solid var(--primary)',
                                    background: overdue ? 'rgba(239, 68, 68, 0.02)' : 'var(--bg-card)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '1.5rem',
                                    flexWrap: 'wrap'
                                }}
                            >
                                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                                    <div style={{
                                        padding: '0.75rem',
                                        background: overdue ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                        borderRadius: '12px',
                                        color: overdue ? '#ef4444' : 'var(--primary)'
                                    }}>
                                        {f.follow_up_type === 'call' ? <Phone size={20} /> : <Calendar size={20} />}
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white' }}>
                                                {lead ? `${lead.firstName} ${lead.lastName}` : 'Prospect Inconnu'}
                                            </span>
                                            {overdue && (
                                                <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <AlertCircle size={10} /> En retard
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', marginTop: '6px', fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                            <span>Échéance : {new Date(f.due_at).toLocaleString()}</span>
                                            <span>Type : {f.follow_up_type === 'call' ? 'Appel téléphonique' : f.follow_up_type}</span>
                                            <span>Priorité : {f.priority}</span>
                                        </div>
                                        {f.note && (
                                            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'white', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                Consigne : {f.note}
                                            </p>
                                        )}
                                        {isAdmin && assignedAgent && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                <User size={12} /> Assigné à : <strong style={{ color: 'white' }}>{assignedAgent.name}</strong>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                {f.status === 'pending' && (
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button
                                            onClick={() => setCompletingId(f.id)}
                                            className="btn"
                                            style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '0.625rem 1.25rem', fontWeight: 700 }}
                                        >
                                            <Check size={16} /> Clôturer
                                        </button>
                                        <button
                                            onClick={() => handleCancelFollowUp(f.id)}
                                            className="btn"
                                            style={{ background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '0.5rem' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal de Clôture / Compte-rendu de relance */}
            {completingId && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                    display: 'grid', placeItems: 'center', zIndex: 3000, backdropFilter: 'blur(8px)'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Compte-rendu de relance</h3>
                        
                        <form onSubmit={handleCompleteFollowUp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Résultat du contact</label>
                                <select
                                    value={resultStatus}
                                    onChange={e => setResultStatus(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                                >
                                    <option value="successful" style={{background: '#1a1b1e'}}>Rendez-vous / Contact réussi</option>
                                    <option value="no_answer" style={{background: '#1a1b1e'}}>Pas de réponse / Répondeur</option>
                                    <option value="unreachable" style={{background: '#1a1b1e'}}>Injoignable / Faux numéro</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Note de l'échange</label>
                                <textarea
                                    value={resultText}
                                    onChange={e => setResultText(e.target.value)}
                                    placeholder="Indiquez ce que le prospect a répondu (ex: souhaite être rappelé en juillet)..."
                                    required
                                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white', minHeight: '100px', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setCompletingId(null)} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white' }}>Annuler</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Valider</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FollowUps;
