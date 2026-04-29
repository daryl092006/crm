import { GraduationCap, Target, PieChart, Download, Users, TrendingUp, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
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

    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'super_agent' || profile?.role === 'observer';
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
            {/* Header Section */}
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.04em', color: 'white', marginBottom: '0.5rem' }}>
                        Dashboard <span style={{ color: 'var(--primary)' }}>Analytique</span>
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
                        Bienvenue, {profile?.full_name || 'Utilisateur'}. Voici l'état de votre tunnel.
                    </p>
                </div>
                <button onClick={handleQuickExport} className="btn btn-ghost" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '14px', height: '44px' }}>
                    <Download size={18} /> Rapports
                </button>
            </div>

            {/* Bandeau de campagnes coulissant (Sur sa propre ligne) */}
            <div style={{ marginBottom: '2.5rem', position: 'relative' }} className="campaign-carousel">
                {/* Flèche Gauche (Absolute) */}
                <button 
                    id="scroll-left"
                    onClick={() => {
                        const container = document.getElementById('campaign-scroll');
                        if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
                    }}
                    style={{
                        position: 'absolute',
                        left: '-20px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 10,
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'none', 
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'white',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        transition: 'all 0.2s'
                    }}
                >
                    <ChevronLeft size={24} />
                </button>

                <div 
                    id="campaign-scroll"
                    className="no-scrollbar" 
                    style={{ 
                        display: 'flex', 
                        overflowX: 'auto', 
                        padding: '10px 0',
                        gap: '12px',
                        scrollBehavior: 'smooth',
                        WebkitOverflowScrolling: 'touch',
                        flexWrap: 'nowrap',
                        maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent 100%)'
                    }}
                    onScroll={(e) => {
                        const target = e.currentTarget;
                        const leftBtn = document.getElementById('scroll-left');
                        const rightBtn = document.getElementById('scroll-right');
                        if (leftBtn) leftBtn.style.display = target.scrollLeft > 20 ? 'flex' : 'none';
                        if (rightBtn) rightBtn.style.display = target.scrollLeft < (target.scrollWidth - target.clientWidth - 20) ? 'flex' : 'none';
                    }}
                >
                    {[{ id: 'all', name: "🌍 Global" }, ...campaigns.filter(c => isAdmin || leads.some(l => l.campaignId === c.id && l.agentId === profile?.id))].map(c => (
                        <button
                            key={c.id}
                            onClick={() => setSelectedCampaignId(c.id)}
                            style={{
                                padding: '12px 28px',
                                borderRadius: '18px',
                                border: '1px solid',
                                borderColor: selectedCampaignId === c.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                background: selectedCampaignId === c.id ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                                color: selectedCampaignId === c.id ? 'white' : 'var(--text-muted)',
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                whiteSpace: 'nowrap',
                                boxShadow: selectedCampaignId === c.id ? '0 10px 25px -5px rgba(99, 102, 241, 0.4)' : 'none',
                                flexShrink: 0
                            }}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>

                {/* Flèche Droite (Absolute) */}
                <button 
                    id="scroll-right"
                    onClick={() => {
                        const container = document.getElementById('campaign-scroll');
                        if (container) container.scrollBy({ left: 300, behavior: 'smooth' });
                    }}
                    style={{
                        position: 'absolute',
                        right: '-20px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 10,
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'white',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        transition: 'all 0.2s'
                    }}
                >
                    <ChevronRight size={24} />
                </button>
            </div>

            {/* Key Performance Indicators */}
            <div className="stat-grid" style={{ marginBottom: '2.5rem', gap: '1.5rem' }}>
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
                        style={{ cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = stat.color; e.currentTarget.style.boxShadow = `0 10px 25px -10px ${stat.color}30`; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `${stat.color}10`, border: `1px solid ${stat.color}20`, display: 'grid', placeItems: 'center', marginBottom: '1.5rem' }}>
                            <stat.icon size={22} color={stat.color} />
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>{stat.label}</div>
                        <div style={{ fontSize: '2.25rem', fontWeight: 950, color: 'white', letterSpacing: '-0.02em' }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Recruiting Funnel Visualizer */}
            <div className="card" style={{ marginBottom: '2.5rem', padding: '2rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 850, color: 'white' }}>Tunnel de Recrutement Stratégique</h3>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {phases.map(p => (
                            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{p.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', height: '80px', borderRadius: '20px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', padding: '6px' }}>
                    {phases.map((phase, i) => {
                        const width = totalLeads > 0 ? (phase.count / totalLeads) * 100 : 25;
                        return (
                            <div key={phase.name} style={{
                                width: `${Math.max(width, 10)}%`,
                                background: phase.color,
                                opacity: 0.9,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                                borderRadius: i === 0 ? '14px 4px 4px 14px' : i === phases.length - 1 ? '4px 14px 14px 4px' : '4px',
                                position: 'relative'
                            }}>
                                <div style={{ textAlign: 'center', padding: '0 10px' }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 900, color: 'rgba(0,0,0,0.8)' }}>{phase.count}</div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden' }}>{phase.name}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Detailed Status Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2.5rem', alignItems: 'start' }}>
                <div className="card" style={{ padding: '2rem', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                            <div style={{ width: '48px', height: '48px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '14px', display: 'grid', placeItems: 'center', color: 'var(--primary)' }}>
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'white' }}>Performance par Statut</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Répartition granulaire du flux de prospects</p>
                            </div>
                        </div>
                        <button onClick={() => setShowAllStatus(!showAllStatus)} className="btn btn-ghost" style={{ border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                            {showAllStatus ? 'Vue Simplifiée' : `Détails (${statuses.length})`}
                        </button>
                    </div>

                    <div className="stat-grid" style={{ gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        {[
                            { id: 'inscrit', label: 'Inscriptions', color: 'var(--success)' },
                            { id: 'admis', label: 'Admissions', color: 'var(--accent)' },
                            { id: 'nouveau', label: 'Nouveaux', color: 'var(--primary)' },
                            { id: 'injoignable', label: 'Injoignables', color: '#f59e0b' }
                        ].map(st => (
                            <div key={st.id} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', transition: 'all 0.2s' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>{st.label}</div>
                                <div style={{ fontSize: '2.25rem', fontWeight: 950, color: 'white' }}>
                                    {filteredLeads.filter(l => {
                                        const sid = (l.statusId || '').toLowerCase();
                                        const slabel = (l.status?.label || '').toLowerCase();
                                        if (st.id === 'nouveau') return sid === 'nouveau' || sid === '' || sid === 'non_contacte' || slabel.includes('nouveau') || slabel.includes('non contacté');
                                        if (st.id === 'inscrit') return ['inscrit', 'confirme'].some(k => sid.includes(k) || slabel.includes(k));
                                        if (st.id === 'admis') return sid === 'admis' || slabel.includes('admis');
                                        return sid === st.id || slabel === st.label.toLowerCase();
                                    }).length}
                                </div>
                                <div style={{ height: '4px', width: '40px', background: st.color, borderRadius: '4px', marginTop: '1rem' }} />
                            </div>
                        ))}
                    </div>

                    {showAllStatus && (
                        <div className="animate-fade" style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: '24px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                {[...statuses].sort((a, b) => a.label.localeCompare(b.label)).map(s => {
                                    const count = filteredLeads.filter(l => l.statusId === s.id).length;
                                    return (
                                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                                            <span style={{ fontWeight: 900, color: 'white', fontSize: '0.9rem' }}>{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Field Breakdown */}
                    <div className="card" style={{ padding: '2rem', border: '1px solid var(--border)' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'white', marginBottom: '2rem' }}>Répartition par Filière</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                            {Array.from(new Set(filteredLeads.map(l => l.fieldOfInterest))).filter(Boolean).slice(0, 5).map((field) => {
                                const count = filteredLeads.filter(l => l.fieldOfInterest === field).length;
                                const percentage = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                                return (
                                    <div key={field}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.6rem', fontWeight: 700 }}>
                                            <span style={{ color: 'white' }}>{field}</span>
                                            <span style={{ color: 'var(--primary)' }}>{percentage}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', overflow: 'hidden' }}>
                                            <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--primary)', borderRadius: '10px', boxShadow: '0 0 10px var(--primary-glow)' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Latest Inscriptions */}
                    <div className="card" style={{ padding: '2rem', border: '1px solid var(--border)' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'white', marginBottom: '2rem' }}>Inscriptions Récentes</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {filteredLeads
                                .filter(l => ['inscrit', 'confirme'].some(k => (l.statusId || '').toLowerCase().includes(k)))
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                .slice(0, 4)
                                .map((l, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', paddingBottom: '1.25rem', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'grid', placeItems: 'center' }}>
                                            <GraduationCap size={22} color="var(--success)" />
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.firstName} {l.lastName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{l.fieldOfInterest || 'Spécialité à définir'}</div>
                                        </div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{new Date(l.createdAt).toLocaleDateString()}</div>
                                    </div>
                                ))}
                        </div>
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

