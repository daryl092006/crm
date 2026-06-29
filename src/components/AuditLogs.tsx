import React, { useState, useEffect } from 'react';
import { Shield, Eye, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import type { AuditLog, Agent } from '../types';

interface AuditLogsProps {
    profile: import('../types').Profile | null;
    agents: Agent[];
}

const AuditLogs: React.FC<AuditLogsProps> = ({ profile, agents }) => {
    const { addToast } = useToast();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Filtres
    const [actionFilter, setActionFilter] = useState('all');
    const [entityFilter, setEntityFilter] = useState('all');
    const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [searchActor, setSearchActor] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const isAdmin = ['admin', 'direction', 'superagent', 'superviseur'].includes(profile?.role || '');

    const fetchLogs = async () => {
        if (logs.length === 0) {
            setLoading(true);
        }
        try {
            let query = supabase.from('audit_logs').select('*');

            // Filtrer par acteur (si l'utilisateur est un simple agent, RLS restreint déjà, mais on force au cas où)
            if (!isAdmin && profile?.id) {
                query = query.eq('actor_id', profile.id);
            }

            if (actionFilter !== 'all') {
                query = query.eq('action', actionFilter);
            }

            if (entityFilter !== 'all') {
                query = query.eq('entity_type', entityFilter);
            }

            // Filtrage temporel
            if (periodFilter !== 'all') {
                const now = new Date();
                let since = new Date();
                if (periodFilter === 'today') {
                    since.setHours(0, 0, 0, 0);
                } else if (periodFilter === 'week') {
                    since.setDate(now.getDate() - 7);
                } else if (periodFilter === 'month') {
                    since.setMonth(now.getMonth() - 1);
                }
                query = query.gte('created_at', since.toISOString());
            }

            const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
            if (error) throw error;

            let filteredData = data || [];
            // Filtre par acteur (recherche textuelle sur le nom de l'agent si admin)
            if (isAdmin && searchActor.trim()) {
                filteredData = filteredData.filter(log => {
                    const agentName = agents.find(a => a.id === log.actor_id)?.name || 'Système';
                    return agentName.toLowerCase().includes(searchActor.toLowerCase().trim());
                });
            }

            setLogs(filteredData);
        } catch (err: any) {
            addToast("Erreur lors de la récupération des logs d'audit : " + err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [actionFilter, entityFilter, periodFilter, searchActor, profile]);

    return (
        <div className="animate-fade">
            <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontSize: 'clamp(1.375rem, 3.5vw, 2.25rem)', fontWeight: 950, letterSpacing: '-0.04em', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <Shield size={28} color="var(--primary)" style={{ flexShrink: 0 }} />
                        Journal d'Activité &amp; Audit Logs
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Consultez la traçabilité complète des actions, modifications et imports du CRM.</p>
                </div>
                <button onClick={fetchLogs} className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', flexShrink: 0 }}>
                    <RefreshCw size={16} /> Rafraîchir
                </button>
            </div>

            {/* BARRE DE FILTRES D'AUDIT */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    
                    {/* Filtre Période */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase' }}>Période</label>
                        <select
                            value={periodFilter}
                            onChange={e => setPeriodFilter(e.target.value as any)}
                            style={{ width: '100%', padding: '0.625rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }}
                        >
                            <option value="all">🌍 Historique complet</option>
                            <option value="today">📅 Aujourd'hui</option>
                            <option value="week">🗓️ 7 derniers jours</option>
                            <option value="month">📅 30 derniers jours</option>
                        </select>
                    </div>

                    {/* Filtre Type d'Action */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase' }}>Action</label>
                        <select
                            value={actionFilter}
                            onChange={e => setActionFilter(e.target.value)}
                            style={{ width: '100%', padding: '0.625rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }}
                        >
                            <option value="all">Toutes les actions</option>
                            <option value="create">🆕 Création</option>
                            <option value="update">✏️ Modification</option>
                            <option value="reassign">👤 Réaffectation</option>
                            <option value="status_change">📊 Changement statut</option>
                            <option value="import">📥 Importation</option>
                        </select>
                    </div>

                    {/* Filtre Type d'Entité */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase' }}>Entité</label>
                        <select
                            value={entityFilter}
                            onChange={e => setEntityFilter(e.target.value)}
                            style={{ width: '100%', padding: '0.625rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }}
                        >
                            <option value="all">Toutes les entités</option>
                            <option value="lead">🎓 Prospect (Lead)</option>
                            <option value="campaign">📊 Campagne</option>
                            <option value="import">📥 Importation</option>
                            <option value="template">✉️ Modèle de message</option>
                        </select>
                    </div>

                    {/* Filtre Acteur (uniquement visible pour les rôles étendus) */}
                    {isAdmin && (
                        <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase' }}>Acteur / Auteur</label>
                            <input
                                type="text"
                                placeholder="Rechercher un agent..."
                                value={searchActor}
                                onChange={e => setSearchActor(e.target.value)}
                                style={{ width: '100%', padding: '0.625rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* TABLEAU DES LOGS D'AUDIT */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Date & Heure</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Acteur</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Action</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Entité</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>ID Entité</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: 800, textAlign: 'center' }}>Détails</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chargement des logs d'audit...</td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucun log d'activité trouvé pour les filtres sélectionnés.</td>
                                </tr>
                            ) : (
                                logs.map((log) => {
                                    const actorName = agents.find(a => a.id === log.actor_id)?.name || 'Système / Admin';
                                    return (
                                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '1rem 1.5rem', color: 'white' }}>{new Date(log.created_at).toLocaleString()}</td>
                                            <td style={{ padding: '1rem 1.5rem', fontWeight: 700 }}>
                                                {actorName}
                                                <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>Role: {log.actor_role}</span>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <span style={{
                                                    background: log.action === 'create' ? 'rgba(34, 197, 94, 0.1)' : log.action === 'update' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                    color: log.action === 'create' ? '#22c55e' : log.action === 'update' ? 'var(--primary)' : '#f59e0b',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    fontWeight: 800,
                                                    fontSize: '0.75rem',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>{log.entity_type}</td>
                                            <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{log.entity_id ? log.entity_id.slice(0, 8) : 'N/A'}</td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="btn"
                                                    style={{ background: 'rgba(255,255,255,0.05)', color: 'white', padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
                                                >
                                                    <Eye size={14} /> Voir JSON
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DETAIL JSON DE LOG */}
            {selectedLog && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                    display: 'grid', placeItems: 'center', zIndex: 3000, backdropFilter: 'blur(8px)', padding: '1rem'
                }} onClick={() => setSelectedLog(null)}>
                    <div className="card animate-fade" style={{ width: '100%', maxWidth: '600px', background: '#0a0a0a', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Détail des valeurs modifiées</h3>
                            <button onClick={() => setSelectedLog(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
                        </div>
                        
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '60vh', overflowY: 'auto' }}>
                            <div>
                                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 800 }}>Valeurs précédentes (Avant)</h4>
                                <pre style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '10px', color: '#ef4444', overflowX: 'auto', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                    {JSON.stringify(selectedLog.old_values, null, 2) || 'Aucune valeur stockée.'}
                                </pre>
                            </div>

                            <div>
                                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 800 }}>Valeurs nouvelles (Après)</h4>
                                <pre style={{ background: 'rgba(34, 197, 94, 0.03)', border: '1px solid rgba(34, 197, 94, 0.1)', padding: '1rem', borderRadius: '10px', color: '#22c55e', overflowX: 'auto', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                    {JSON.stringify(selectedLog.new_values, null, 2) || 'Aucune valeur stockée.'}
                                </pre>
                            </div>

                            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                                <div>
                                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 800 }}>Métadonnées complémentaires</h4>
                                    <pre style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '10px', color: 'white', overflowX: 'auto', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                        {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.01)' }}>
                            <button onClick={() => setSelectedLog(null)} className="btn btn-primary" style={{ padding: '0.625rem 1.5rem' }}>Fermer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogs;
