import { GraduationCap, Target, PieChart, Download, Users, TrendingUp } from 'lucide-react';
import type { StudentLead, Campaign } from '../types';
import * as XLSX from 'xlsx';
import { useToast } from './Toast';
import { useState } from 'react';
import LeadExportModal from './LeadExportModal';


interface DashboardProps {
    leads: StudentLead[];
    campaigns: Campaign[];
    statuses: any[];
}

const Dashboard: React.FC<DashboardProps> = ({ leads, campaigns, statuses }) => {
    const { addToast } = useToast();
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [showAllStatus, setShowAllStatus] = useState(false);
    const [selectedCampaignId, setSelectedCampaignId] = useState('all');

    const filteredLeads = selectedCampaignId === 'all' 
        ? leads 
        : leads.filter(l => l.campaignId === selectedCampaignId);

    const totalLeads = filteredLeads.length;
    const inscritLeads = filteredLeads.filter(l => l.statusId === 'inscrit' || l.statusId === 'inscription_confirmee').length;
    const convRate = totalLeads > 0 ? ((inscritLeads / totalLeads) * 100).toFixed(1) : '0';

    // Unified Phase categorization logic
    const getPhaseLeads = (keywords: string[]) => 
        filteredLeads.filter(l => keywords.some(k => (l.statusId || '').toLowerCase().includes(k) || (l.status?.label || '').toLowerCase().includes(k)));

    const qualificationLeads = getPhaseLeads(['nouveau', 'injoignable', 'repondeur', 'faux_numero', 'hors_cible', 'refus_categorique', 'refus_repondre', 'pas_interesse', 'inscrit_ailleurs', 'pas_moyens', 'annee_prochaine', 'pas_disponible']);
    const informationLeads = getPhaseLeads(['interesse', 'rappel', 'reflexion', 'reorientation']);
    const candidatureLeads = getPhaseLeads(['rdv_planifie', 'dossier_recu']);
    const admissionLeads = getPhaseLeads(['admis', 'inscription_attente', 'inscrit']);

    const stats = [
        { label: 'Total Prospects', value: totalLeads.toString(), icon: Users, color: 'var(--primary)' },
        { label: 'En Qualification', value: qualificationLeads.length.toString(), icon: Target, color: 'var(--warning)' },
        { label: 'Dossiers Candidats', value: candidatureLeads.length.toString(), icon: PieChart, color: 'var(--accent)' },
        { label: 'Taux de Conversion Admission', value: `${convRate}%`, icon: GraduationCap, color: 'var(--success)' },
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
            const row: Record<string, any> = {};
            selectedColumns.forEach(colId => {
                const label = columnMap[colId] || colId;
                if (colId === 'statusId') {
                    row[label] = l.status?.label || l.statusId;
                } else if (colId === 'createdAt') {
                    row[label] = new Date(l.createdAt).toLocaleDateString();
                } else {
                    row[label] = (l as any)[colId];
                }
            });
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Rapport Global");
        XLSX.writeFile(workbook, `rapport_crm_${new Date().toISOString().split('T')[0]}.xlsx`);
        addToast("Rapport global exporté avec succès !", "success");
        setIsExportModalOpen(false);
    };


    return (
        <div className="animate-fade">
            <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Tableau de Bord Université</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Suivi du tunnel de recrutement et des inscriptions.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <select 
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        className="input"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '12px', padding: '0 1rem', height: '42px', minWidth: '200px', cursor: 'pointer' }}
                    >
                        <option value="all">Toutes les Campagnes</option>
                        {campaigns.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <button onClick={() => setIsExportModalOpen(true)} className="btn" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Download size={18} /> Exporter Rapport
                    </button>
                </div>
            </div>

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2rem' }}>
                {stats.map((stat, index) => (
                    <div key={index} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                                    <stat.icon size={20} color={stat.color} />
                                </div>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{stat.label}</p>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem' }}>{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>Tunnel de Recrutement (Phases)</h3>
                <div style={{ display: 'flex', gap: '8px', height: '60px', borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', padding: '4px' }}>
                    {phases.map((phase, i) => {
                        const width = totalLeads > 0 ? (phase.count / totalLeads) * 100 : 25;
                        return (
                            <div key={phase.name} style={{ 
                                width: `${width}%`, 
                                background: phase.color, 
                                opacity: 0.8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '80px',
                                transition: 'all 0.5s ease',
                                borderRadius: i === 0 ? '8px 4px 4px 8px' : i === phases.length - 1 ? '4px 8px 8px 4px' : '4px',
                                position: 'relative'
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(0,0,0,0.6)' }}>{phase.count}</div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>{phase.name}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', padding: '0 0.5rem' }}>
                    {phases.map(p => (
                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }}></div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                {/* POINT GLOBAL DES STATUTS */}
                <div className="card" style={{ gridColumn: 'span 2' }}>
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
                            {showAllStatus ? 'Réduire la vue' : 'Voir tous les détails (21)'}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                        {[
                            { id: 'inscrit', label: 'Inscrit', color: 'var(--success)' },
                            { id: 'admis', label: 'Admis', color: 'var(--accent)' },
                            { id: 'nouveau', label: 'Nouveau', color: 'var(--primary)' },
                            { id: 'injoignable', label: 'Injoignable', color: '#94a3b8' }
                        ].map(st => {
                            const count = leads.filter(l => (l.statusId || '').toLowerCase().includes(st.id)).length;
                            return (
                                <div key={st.id} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{st.label}</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 950, color: 'white' }}>{filteredLeads.filter(l => (l.statusId || '').toLowerCase().includes(st.id)).length}</div>
                                </div>
                            );
                        })}
                    </div>

                    {showAllStatus && (
                        <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '2rem', background: 'rgba(0,0,0,0.2)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', animation: 'slideDown 0.3s ease-out' }}>
                            {statuses.map(s => {
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
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '2rem' }}>Activités de Scoring Récentes</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {filteredLeads
                            .filter(l => (l.interactions || []).some(i => i.content.includes('Score')))
                            .flatMap(l => (l.interactions || []).filter(i => i.content.includes('Score')).map(i => ({ ...i, leadName: `${l.firstName} ${l.lastName}`, leadStatus: l.status })))
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .slice(0, 4)
                            .map((action, i) => (
                                <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', display: 'grid', placeItems: 'center' }}>
                                        <TrendingUp size={20} color="var(--success)" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{action.leadName}</p>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700 }}>+{action.content.split('+')[1]}</span>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                            {action.content.split('.')[0]}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        {filteredLeads.every(l => !l.interactions?.some(i => i.content.includes('Score'))) && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>Aucun scoring récent.</p>
                        )}
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

