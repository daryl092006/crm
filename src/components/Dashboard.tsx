import { GraduationCap, Target, PieChart, Download, Users, TrendingUp, Mail } from 'lucide-react';
import type { StudentLead, Campaign } from '../types';
import * as XLSX from 'xlsx';
import { useToast } from './Toast';
import { useState } from 'react';
import LeadExportModal from './LeadExportModal';


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

    const isAdmin = profile?.role === 'admin';
    const myLeads = isAdmin ? leads : leads.filter(l => l.agentId === profile?.id);

    const filteredLeads = selectedCampaignId === 'all'
        ? myLeads
        : myLeads.filter(l => String(l.campaignId) === String(selectedCampaignId));

    const totalLeads = filteredLeads.length;
    const inscritLeads = filteredLeads.filter(l => {
        const sid = (l.statusId || '').toLowerCase();
        const slabel = (l.status?.label || '').toLowerCase();
        return ['admis', 'inscrit', 'confirme'].some(k => sid.includes(k) || slabel.includes(k));
    }).length;
    const convRate = totalLeads > 0 ? ((inscritLeads / totalLeads) * 100).toFixed(1) : '0';

    const getPhaseLeads = (keywords: string[]) =>
        filteredLeads.filter(l => {
            const sid = (l.statusId || '').toLowerCase();
            const slabel = (l.status?.label || '').toLowerCase();
            return keywords.some(k => sid.includes(k) || slabel.includes(k));
        });

    const qualificationLeads = filteredLeads.filter(l => {
        const sid = (l.statusId || '').toLowerCase();
        const slabel = (l.status?.label || '').toLowerCase();
        return sid === 'nouveau' || sid === '' || sid === 'non_contacte' || slabel.includes('nouveau') || slabel.includes('non contacté') || slabel.includes('pas contacté');
    });
    const informationLeads = getPhaseLeads(['interesse', 'rappel', 'reflexion', 'reorientation', 'annee_prochaine', 'prochaine']);
    const candidatureLeads = getPhaseLeads(['rdv_planifie', 'dossier_recu', 'candidature']);
    const admissionLeads = getPhaseLeads(['admis', 'inscrit', 'confirme', 'admission']);

    const stats = [
        { id: 'all', label: 'Total Prospects', value: totalLeads.toString(), icon: Users, color: 'var(--primary)' },
        {
            id: 'nouveau', label: 'Non Contactés', value: filteredLeads.filter(l => {
                const sid = (l.statusId || '').toLowerCase();
                const slabel = (l.status?.label || '').toLowerCase();
                return sid === 'nouveau' || sid === '' || sid === 'non_contacte' || slabel.includes('nouveau') || slabel.includes('non contacté') || slabel.includes('pas contacté');
            }).length.toString(), icon: Mail, color: '#f87171'
        },
        { id: 'en_qualification', label: 'En Qualification', value: qualificationLeads.length.toString(), icon: Target, color: 'var(--warning)' },
        { id: 'candidature', label: 'Dossiers Candidats', value: candidatureLeads.length.toString(), icon: PieChart, color: 'var(--accent)' },
        { id: 'inscrit', label: 'Taux de Conversion Admission', value: `${convRate}%`, icon: GraduationCap, color: 'var(--success)' },
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
            <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ flex: '1 1 300px' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Tableau de Bord Université</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Suivi du tunnel de recrutement et des inscriptions.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <button
                        onClick={() => setSelectedCampaignId('all')}
                        style={{
                            padding: '0.625rem 1.25rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: selectedCampaignId === 'all' ? 'var(--primary)' : 'transparent',
                            color: selectedCampaignId === 'all' ? 'white' : 'var(--text-muted)',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Vue d'ensemble
                    </button>
                    {(() => {
                        const displayedCampaignButtons = isAdmin
                            ? campaigns
                            : campaigns.filter(c => leads.some(l => l.campaignId === c.id && l.agentId === profile?.id));

                        return displayedCampaignButtons.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setSelectedCampaignId(c.id)}
                                style={{
                                    padding: '0.625rem 1.25rem',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: selectedCampaignId === c.id ? 'var(--primary)' : 'transparent',
                                    color: selectedCampaignId === c.id ? 'white' : 'var(--text-muted)',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {c.name}
                            </button>
                        ));
                    })()}
                    <div style={{ width: '1px', background: 'var(--border)', margin: '0 0.5rem' }}></div>
                    <button onClick={handleQuickExport} className="btn" style={{ padding: '0.625rem 1rem', background: 'rgba(255, 255, 255, 0.05)', color: 'white', display: 'flex', gap: '8px', alignItems: 'center', border: 'none' }}>
                        <Download size={18} /> Export
                    </button>
                </div>
            </div>

            <div className="stat-grid" style={{ marginBottom: '2rem' }}>
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
                        style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
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

                    <div className="stat-grid" style={{ gap: '1.5rem' }}>
                        {[
                            { id: 'inscrit', label: 'Inscrit', color: 'var(--success)' },
                            { id: 'admis', label: 'Admis', color: 'var(--accent)' },
                            { id: 'nouveau', label: 'Nouveau (Non Contacté)', color: 'var(--primary)' },
                            { id: 'injoignable', label: 'Injoignable/ Ne répond pas', color: '#f59e0b' },
                            { id: 'whatsapp_indisponible', label: 'WhatsApp Indisponible', color: '#94a3b8' }
                        ].map(st => {
                            return (
                                <div key={st.id} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{st.label}</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 950, color: 'white' }}>{
                                        filteredLeads.filter(l => {
                                            const sid = (l.statusId || '').toLowerCase();
                                            const slabel = (l.status?.label || '').toLowerCase();
                                            // Robust matching for "Non Contacté" / "Nouveau"
                                            if (st.id === 'nouveau') return sid === 'nouveau' || sid === '' || sid === 'non_contacte' || slabel.includes('nouveau') || slabel.includes('non contacté') || slabel.includes('pas contacté');

                                            // Robust matching for "Inscrit / Admis"
                                            if (st.id === 'inscrit') return ['inscrit', 'confirme'].some(k => sid.includes(k) || slabel.includes(k));
                                            if (st.id === 'admis') return sid === 'admis' || slabel.includes('admis');

                                            // Label fallback match
                                            return sid === st.id || slabel === st.label.toLowerCase() || (st.id === 'whatsapp_indisponible' && (slabel.includes('whatsapp') || sid.includes('whatsapp')));
                                        }).length
                                    }</div>
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

