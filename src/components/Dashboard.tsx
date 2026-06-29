import { GraduationCap, Download, Users, TrendingUp, Clock, AlertCircle, Award, Sliders } from 'lucide-react';
import type { StudentLead, Campaign } from '../types';
import * as XLSX from 'xlsx';
import { useToast } from './Toast';
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import LeadExportModal from './LeadExportModal';
import { isNewLead, isInscribedLead, isAdmittedLead, isFailedLead } from '../utils/leadUtils';


interface DashboardProps {
    leads: StudentLead[];
    campaigns: Campaign[];
    statuses: import('../types').LeadStatus[];
    setActiveTab?: (tab: string) => void;
    setStatusFilter?: (status: string) => void;
    selectedCampaignId: string;
    setSelectedCampaignId: (id: string) => void;
    profile: import('../types').Profile | null;
}

const Dashboard: React.FC<DashboardProps> = ({
    leads,
    campaigns,
    statuses,
    setActiveTab,
    setStatusFilter,
    selectedCampaignId,
    setSelectedCampaignId,
    profile
}) => {
    const { addToast } = useToast();
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [showAllStatus, setShowAllStatus] = useState(false);

    // Filtres avancés
    const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [agentFilter, setAgentFilter] = useState<string>('all');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [programFilter, setProgramFilter] = useState<string>('all');
    
    // States statistiques dynamiques
    const [todayFollowUps, setTodayFollowUps] = useState<any[]>([]);
    const [overdueFollowUps, setOverdueFollowUps] = useState<any[]>([]);
    const [todayInteractions, setTodayInteractions] = useState<{ call: number; whatsapp: number; email: number; total: number }>({ call: 0, whatsapp: 0, email: 0, total: 0 });
    const [agentsList, setAgentsList] = useState<any[]>([]);
    const [programsList, setProgramsList] = useState<any[]>([]);
    const [sourcesList, setSourcesList] = useState<any[]>([]);
    const [loadingStats, setLoadingStats] = useState(true);

    const isAgent = profile?.role === 'agent';
    const isExtendedRole = ['admin', 'superagent', 'direction', 'superviseur'].includes(profile?.role || '');

    // Récupérer les listes pour filtres et charger les stats
    useEffect(() => {
        const fetchFiltersAndStats = async () => {
            if (programsList.length === 0 && todayFollowUps.length === 0) {
                setLoadingStats(true);
            }
            try {
                // 1. Charger les listes de référentiels pour les filtres
                const { data: pData } = await supabase.from('programs').select('id, name');
                if (pData) setProgramsList(pData);

                const { data: sData } = await supabase.from('prospect_sources').select('id, name');
                if (sData) setSourcesList(sData);

                const { data: aData } = await supabase.from('profiles').select('id, full_name, role');
                if (aData) setAgentsList(aData.filter(u => u.role === 'agent'));

                // 2. Charger les relances (follow-ups)
                let followUpQuery = supabase.from('lead_follow_ups').select('*').eq('status', 'pending');
                if (isAgent) {
                    followUpQuery = followUpQuery.eq('assigned_to', profile?.id);
                }
                const { data: fuData } = await supabase.from('lead_follow_ups').select('*, leads(first_name, last_name)').eq('status', 'pending');
                
                if (fuData) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const now = new Date();

                    // Filtrer par assignation pour les agents
                    const myFu = isAgent ? fuData.filter(f => f.assigned_to === profile?.id) : fuData;

                    const todayFu = myFu.filter(f => f.due_at.startsWith(todayStr));
                    const overdueFu = myFu.filter(f => new Date(f.due_at) < now && !f.due_at.startsWith(todayStr));

                    setTodayFollowUps(todayFu);
                    setOverdueFollowUps(overdueFu);
                }

                // 3. Charger les interactions du jour
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                let interQuery = supabase.from('lead_interactions').select('*').gte('created_at', todayStart.toISOString());
                if (isAgent) {
                    interQuery = interQuery.eq('agent_id', profile?.id);
                }
                const { data: interData } = await interQuery;
                if (interData) {
                    const calls = interData.filter(i => i.type === 'call').length;
                    const whatsapps = interData.filter(i => i.type === 'whatsapp').length;
                    const emails = interData.filter(i => i.type === 'email').length;
                    setTodayInteractions({
                        call: calls,
                        whatsapp: whatsapps,
                        email: emails,
                        total: interData.length
                    });
                }

            } catch (err) {
                console.error(err);
            } finally {
                setLoadingStats(false);
            }
        };

        fetchFiltersAndStats();
    }, [profile, isAgent]);

    // Filtrer les leads selon le rôle et les filtres
    const myLeads = isAgent ? leads.filter(l => l.agentId === profile?.id) : leads;

    const filteredLeads = myLeads.filter(l => {
        // Filtre Campagne
        if (selectedCampaignId !== 'all' && String(l.campaignId) !== String(selectedCampaignId)) {
            return false;
        }
        // Filtre Conseiller / Agent
        if (isExtendedRole && agentFilter !== 'all' && l.agentId !== agentFilter) {
            return false;
        }
        // Filtre Source
        if (sourceFilter !== 'all' && l.sourceId !== sourceFilter) {
            return false;
        }
        // Filtre Programme
        if (programFilter !== 'all' && l.programId !== programFilter) {
            return false;
        }
        // Filtre Période de création du prospect
        if (periodFilter !== 'all') {
            const date = new Date(l.createdAt);
            const now = new Date();
            if (periodFilter === 'today') {
                if (date.toDateString() !== now.toDateString()) return false;
            } else if (periodFilter === 'week') {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(now.getDate() - 7);
                if (date < oneWeekAgo) return false;
            } else if (periodFilter === 'month') {
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(now.getMonth() - 1);
                if (date < oneMonthAgo) return false;
            }
        }
        return true;
    });

    const totalLeads = filteredLeads.length;
    const assignedLeads = filteredLeads.filter(l => l.agentId).length;
    const unassignedLeads = totalLeads - assignedLeads;
    const inscritLeads = filteredLeads.filter(l => isInscribedLead(l) || isAdmittedLead(l)).length;
    const convRate = totalLeads > 0 ? ((inscritLeads / totalLeads) * 100).toFixed(1) : '0';

    const getPhaseLeads = (keywords: string[]) =>
        filteredLeads.filter(l => {
            const sid = (l.statusId || '').toLowerCase();
            const slabel = (l.status?.label || '').toLowerCase();
            return keywords.some(k => sid.includes(k) || slabel.includes(k));
        });

    const qualificationLeads = filteredLeads.filter(isNewLead);
    const informationLeads = getPhaseLeads(['interesse', 'rappel', 'reflexion', 'reorientation', 'annee_prochaine', 'prochaine']);
    const candidatureLeads = getPhaseLeads(['rdv_planifie', 'dossier_recu', 'candidature']);
    const admissionLeads = filteredLeads.filter(l => isInscribedLead(l) || isAdmittedLead(l));

    const stats = [
        { id: 'all', label: 'Total Prospects', value: totalLeads.toString(), icon: Users, color: 'var(--primary)' },
        { id: 'assigned', label: 'Assignés', value: assignedLeads.toString(), icon: Award, color: 'var(--accent)' },
        { id: 'unassigned', label: 'Non Assignés', value: unassignedLeads.toString(), icon: AlertCircle, color: 'var(--warning)' },
        { id: 'inscrit', label: 'Taux de Conversion', value: `${convRate}%`, icon: GraduationCap, color: 'var(--success)' },
    ];

    const phases = [
        { name: "Qualification", count: qualificationLeads.length, color: 'var(--warning)' },
        { name: "Information", count: informationLeads.length, color: 'var(--accent)' },
        { name: "Candidature", count: candidatureLeads.length, color: 'var(--primary)' },
        { name: "Décision & Inscriptions", count: admissionLeads.length, color: 'var(--success)' },
    ];

    const handleExport = (selectedColumns: string[]) => {
        const columnMap: Record<string, string> = {
            'firstName': 'Prénom',
            'lastName': 'Nom',
            'email': 'Email',
            'phone': 'Téléphone',
            'country': 'Pays',
            'city': 'Ville',
            'fieldOfInterest': 'Filière',
            'level': 'Niveau',
            'statusId': 'Statut',
            'notes': 'Notes',
            'score': 'Score',
            'createdAt': 'Date Ajout'
        };

        const dataToExport = filteredLeads.map(l => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const row: Record<string, any> = {};
            selectedColumns.forEach(colId => {
                const label = columnMap[colId] || colId;
                if (colId === 'statusId') {
                    row[label] = l.status?.label || l.statusId;
                } else if (colId === 'createdAt') {
                    row[label] = new Date(l.createdAt).toLocaleDateString();
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    row[label] = (l as any)[colId];
                }
            });
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);

        // --- ADD SUMMARY SHEET (CHIFFRES) ---
        const summaryData = statuses.map(s => ({
            'Statut': s.label,
            'Nombre de Prospects': filteredLeads.filter(l => l.statusId === s.id).length
        }));
        summaryData.push({
            'Statut': 'TOTAL',
            'Nombre de Prospects': filteredLeads.length
        });
        const summarySheet = XLSX.utils.json_to_sheet(summaryData);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Récapitulatif (Chiffres)");
        XLSX.utils.book_append_sheet(workbook, worksheet, "Détails Prospects");

        XLSX.writeFile(workbook, `rapport_crm_${new Date().toISOString().split('T')[0]}.xlsx`);
        addToast("Rapport (Chiffres + Détails) exporté avec succès !", "success");
        setIsExportModalOpen(false);
    };

    const handleQuickExport = () => {
        const columns = ['firstName', 'lastName', 'email', 'phone', 'country', 'city', 'fieldOfInterest', 'level', 'statusId', 'createdAt'];
        handleExport(columns);
    };


    return (
        <div className="animate-fade">
            <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <div style={{ padding: '0.75rem', background: 'var(--primary)', borderRadius: '16px', display: 'grid', placeItems: 'center', boxShadow: '0 8px 16px var(--primary-glow)', flexShrink: 0 }}>
                            <TrendingUp size={24} color="white" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 950, letterSpacing: '-0.04em', lineHeight: 1 }}>ESCEN Analytics</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.8rem, 2vw, 1rem)', fontWeight: 500, marginTop: '4px' }}>Pilotage stratégique du recrutement université.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* BARRE DE FILTRES AVANCÉS */}
            <div className="card" style={{ marginBottom: '2.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sliders size={18} color="var(--primary)" />
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtres analytiques</span>
                    </div>
                    <button onClick={handleQuickExport} className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.8rem' }}>
                        <Download size={14} /> Exporter XLS
                    </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {/* Filtre Période de création */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase' }}>Date d'ajout</label>
                        <select
                            value={periodFilter}
                            onChange={e => setPeriodFilter(e.target.value as any)}
                            style={{ width: '100%', padding: '0.625rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }}
                        >
                            <option value="all">Historique complet</option>
                            <option value="today">Aujourd'hui</option>
                            <option value="week">7 derniers jours</option>
                            <option value="month">30 derniers jours</option>
                        </select>
                    </div>

                    {/* Filtre Campagne */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase' }}>Campagne</label>
                        <select
                            value={selectedCampaignId}
                            onChange={e => setSelectedCampaignId(e.target.value)}
                            style={{ width: '100%', padding: '0.625rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }}
                        >
                            <option value="all">Toutes les campagnes</option>
                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Filtre Conseiller (Masqué pour les simples agents) */}
                    {isExtendedRole && (
                        <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase' }}>Conseiller / Agent</label>
                            <select
                                value={agentFilter}
                                onChange={e => setAgentFilter(e.target.value)}
                                style={{ width: '100%', padding: '0.625rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }}
                            >
                                <option value="all">Tous les conseillers</option>
                                {agentsList.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Filtre Source d'acquisition */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase' }}>Source d'acquisition</label>
                        <select
                            value={sourceFilter}
                            onChange={e => setSourceFilter(e.target.value)}
                            style={{ width: '100%', padding: '0.625rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }}
                        >
                            <option value="all">Toutes les sources</option>
                            {sourcesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    {/* Filtre Programme */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 700, textTransform: 'uppercase' }}>Programme d'intérêt</label>
                        <select
                            value={programFilter}
                            onChange={e => setProgramFilter(e.target.value)}
                            style={{ width: '100%', padding: '0.625rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.85rem' }}
                        >
                            <option value="all">Toutes les filières</option>
                            {programsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="stat-grid" style={{ marginBottom: '3rem' }}>
                {stats.map((stat, index) => (
                    <div
                        key={index}
                        className="card"
                        onClick={() => {
                            if (setActiveTab && setStatusFilter) {
                                setStatusFilter(stat.id);
                                setActiveTab('leads');
                            }
                        }}
                        style={{
                            position: 'relative',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            padding: '2rem',
                            border: '1px solid rgba(255,255,255,0.03)',
                            background: 'linear-gradient(145deg, var(--bg-card), rgba(255,255,255,0.02))',
                            borderRadius: '24px'
                        }}
                    >
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div style={{
                                    padding: '12px',
                                    background: `${stat.color}15`,
                                    borderRadius: '16px',
                                    border: `1px solid ${stat.color}30`
                                }}>
                                    <stat.icon size={22} color={stat.color} />
                                </div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aperçu</div>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>{stat.label}</p>
                            <h3 style={{ fontSize: '2.5rem', fontWeight: 950, marginTop: '0.25rem', letterSpacing: '-0.04em' }}>{stat.value}</h3>
                        </div>
                        <div style={{ position: 'absolute', bottom: '-40px', right: '-40px', width: '120px', height: '120px', background: stat.color, filter: 'blur(80px)', opacity: 0.08 }}></div>
                    </div>
                ))}
            </div>

            {/* ACTIVITÉ DU JOUR & RELANCES CRITIQUES */}
            <div className="grid-responsive-layout" style={{ marginBottom: '3rem' }}>
                
                {/* 1. RELANCES DU CONSEILLER (Du jour & En retard) */}
                <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Clock size={22} color="var(--primary)" />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Mes Relances Prioritaires</h3>
                        </div>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                            {overdueFollowUps.length} en retard
                        </span>
                    </div>

                    {loadingStats ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chargement des relances...</p>
                    ) : (todayFollowUps.length === 0 && overdueFollowUps.length === 0) ? (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aucune relance en attente pour aujourd'hui !</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto' }}>
                            {/* Les retards en premier */}
                            {overdueFollowUps.map(f => (
                                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.03)', borderRadius: '12px', borderLeft: '3px solid #ef4444' }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>{f.leads ? `${f.leads.first_name} ${f.leads.last_name || ''}` : 'Prospect'}</p>
                                        <p style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>Dépasé le : {new Date(f.due_at).toLocaleDateString()}</p>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>{f.follow_up_type === 'call' ? 'Appel' : f.follow_up_type}</span>
                                </div>
                            ))}

                            {/* Relances du jour */}
                            {todayFollowUps.map(f => (
                                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: '3px solid var(--primary)' }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>{f.leads ? `${f.leads.first_name} ${f.leads.last_name || ''}` : 'Prospect'}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aujourd'hui à {new Date(f.due_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>{f.follow_up_type === 'call' ? 'Appel' : f.follow_up_type}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. ACTIONS & INTERACTIONS RÉALISÉES AUJOURD'HUI */}
                <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TrendingUp size={22} color="var(--primary)" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Activité d'aujourd'hui</h3>
                    </div>

                    <div className="grid-responsive-2">
                        <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.1)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: 800 }}>Appels</span>
                            <span style={{ fontSize: '1.75rem', fontWeight: 950, color: 'white' }}>{todayInteractions.call}</span>
                        </div>
                        <div style={{ padding: '1rem', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '16px', border: '1px solid rgba(34, 197, 94, 0.1)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 800 }}>WhatsApps</span>
                            <span style={{ fontSize: '1.75rem', fontWeight: 950, color: 'white' }}>{todayInteractions.whatsapp}</span>
                        </div>
                        <div style={{ padding: '1rem', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '16px', border: '1px solid rgba(168, 85, 247, 0.1)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: 800 }}>Emails</span>
                            <span style={{ fontSize: '1.75rem', fontWeight: 950, color: 'white' }}>{todayInteractions.email}</span>
                        </div>
                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800 }}>Total Actions</span>
                            <span style={{ fontSize: '1.75rem', fontWeight: 950, color: 'white' }}>{todayInteractions.total}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '3rem', padding: '2.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Tunnel de Recrutement Stratégique</h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Conversion des leads par phase opérationnelle.</p>
                    </div>
                </div>
                <div className="recruitment-tunnel">
                    {phases.map((phase, i) => {
                        const width = totalLeads > 0 ? (phase.count / totalLeads) * 100 : 25;
                        return (
                            <div
                                key={phase.name}
                                className="recruitment-tunnel-segment"
                                style={{
                                    width: `${width}%`,
                                    background: phase.color,
                                    opacity: 0.9,
                                    borderRadius: i === 0 ? '12px 6px 6px 12px' : i === phases.length - 1 ? '6px 12px 12px 6px' : '6px',
                                    position: 'relative',
                                }} title={`${phase.name}: ${phase.count}`}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 950, color: 'rgba(0,0,0,0.7)' }}>{phase.count}</div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{phase.name}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', padding: '0 0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {phases.map(p => (
                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color, boxShadow: `0 0 10px ${p.color}40`, flexShrink: 0 }}></div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>{p.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                {/* POINT GLOBAL DES STATUTS */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px' }}>
                                <TrendingUp size={24} color="var(--primary)" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Point Global des Statuts</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Répartition précise de chaque étape du tunnel</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAllStatus(!showAllStatus)}
                            className="btn"
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '12px', fontSize: '0.875rem' }}
                        >
                            {showAllStatus ? 'Réduire la vue' : `Voir tous les détails (${statuses.length})`}
                        </button>
                    </div>

                    <div className="stat-grid" style={{ gap: '1.25rem' }}>
                        {[
                            { id: 'inscrit', label: 'Inscrit', color: 'var(--success)' },
                            { id: 'admis', label: 'Admis', color: 'var(--accent)' },
                            { id: 'nouveau', label: 'Nouveau', color: 'var(--primary)' },
                            { id: 'injoignable', label: 'Relance Nécessaire', color: '#f59e0b' },
                            { id: 'whatsapp_indisponible', label: 'Hors WhatsApp', color: '#94a3b8' }
                        ].map(st => {
                            const count = filteredLeads.filter(l => {
                                if (st.id === 'nouveau') return isNewLead(l);
                                if (st.id === 'inscrit') return isInscribedLead(l);
                                if (st.id === 'admis') return isAdmittedLead(l);
                                if (st.id === 'injoignable') return isFailedLead(l);
                                if (st.id === 'whatsapp_indisponible') {
                                    const sid = (l.statusId || '').toLowerCase();
                                    const slabel = (l.status?.label || '').toLowerCase();
                                    return sid === st.id || slabel === st.label.toLowerCase() || slabel.includes('whatsapp') || sid.includes('whatsapp');
                                }
                                return false;
                            }).length;

                            return (
                                <div key={st.id} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{st.label}</div>
                                    <div style={{ fontSize: '2.25rem', fontWeight: 950, color: 'white', letterSpacing: '-0.025em' }}>{count}</div>
                                    <div style={{ width: '100%', height: '4px', background: `${st.color}20`, borderRadius: '2px', marginTop: '4px' }}>
                                        <div style={{ width: totalLeads > 0 ? `${(count / totalLeads) * 100}%` : '0%', height: '100%', background: st.color, borderRadius: '2px' }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {showAllStatus && (
                        <div className="stat-grid" style={{ marginTop: '2.5rem', gap: '1rem', padding: '2rem', background: 'rgba(0,0,0,0.2)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', animation: 'slideDown 0.3s ease-out' }}>
                            {[...statuses].sort((a, b) => a.label.localeCompare(b.label)).map(s => {
                                return (
                                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px' }}>{s.label}</span>
                                        <span style={{ fontWeight: 900, color: 'white', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>{filteredLeads.filter(l => l.statusId === s.id).length}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Répartition par Filière</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {Array.from(new Set(filteredLeads.map(l => l.fieldOfInterest))).slice(0, 5).map((field) => {
                            if (!field) return null;
                            const count = filteredLeads.filter(l => l.fieldOfInterest === field).length;
                            const percentage = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;

                            return (
                                <div key={field}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 500 }}>{field}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>{percentage}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                                        <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--primary)', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '2rem' }}>Dernières Inscriptions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {filteredLeads
                            .filter(l => ['inscrit', 'confirme'].some(k => (l.statusId || '').includes(k)))
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .slice(0, 4)
                            .map((l, i) => (
                                <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'grid', placeItems: 'center' }}>
                                        <GraduationCap size={20} color="var(--success)" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{l.firstName} {l.lastName}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.fieldOfInterest || 'Spécialité à définir'}</p>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

            </div>
            <LeadExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onExport={handleExport}
            />
        </div>
    );
};

export default Dashboard;

