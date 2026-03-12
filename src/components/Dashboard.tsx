import { Users, GraduationCap, Target, PieChart, Download } from 'lucide-react';
import type { StudentLead, Campaign } from '../types';
import * as XLSX from 'xlsx';
import { useToast } from './Toast';
import { useState } from 'react';
import LeadExportModal from './LeadExportModal';


interface DashboardProps {
    leads: StudentLead[];
    campaigns: Campaign[];
}

const Dashboard: React.FC<DashboardProps> = ({ leads, campaigns }) => {
    const { addToast } = useToast();
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    const totalLeads = leads.length;
    const inscritLeads = leads.filter(l => l.statusId === 'inscrit').length;
    const convRate = totalLeads > 0 ? ((inscritLeads / totalLeads) * 100).toFixed(1) : '0';

    const stats = [
        { label: 'Total Prospects', value: totalLeads.toString(), icon: Users, color: 'var(--primary)' },
        { label: 'Taux de Conversion (Inscrits)', value: `${convRate}%`, icon: Target, color: 'var(--success)' },
        { label: 'Campagnes Actives', value: campaigns.filter(c => c.isActive).length.toString(), icon: GraduationCap, color: 'var(--accent)' },
        { label: 'Dossiers Envoyés', value: leads.filter(l => l.statusId === 'dossier_envoye').length.toString(), icon: PieChart, color: 'var(--warning)' },
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

        const dataToExport = leads.map(l => {
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
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Vue d'Ensemble</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Analyse des performances de recrutement EliteCRM.</p>
                </div>
                <button onClick={() => setIsExportModalOpen(true)} className="btn" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Download size={18} /> Exporter Rapport Global
                </button>

            </div>

            <div className="stat-grid">
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

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Répartition par Ville</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {Array.from(new Set(leads.map(l => l.city))).slice(0, 4).map((city) => {
                            if (!city) return null;
                            const count = leads.filter(l => l.city === city).length;
                            const percentage = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;

                            return (
                                <div key={city}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 500 }}>{city}</span>
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
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '2rem' }}>Dernières Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {leads
                            .flatMap(l => (l.interactions || []).map(i => ({ ...i, leadName: `${l.firstName} ${l.lastName}`, leadStatus: l.status })))
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .slice(0, 4)
                            .map((action, i) => (
                                <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--glass)', border: '1px solid var(--glass-border)', display: 'grid', placeItems: 'center' }}>
                                        <GraduationCap size={20} color="var(--primary)" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{action.leadName}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                            {action.content}
                                        </p>
                                    </div>
                                    <div style={{
                                        fontSize: '0.7rem',
                                        color: action.leadStatus?.color || 'var(--text-muted)',
                                        background: `${action.leadStatus?.color}11` || 'transparent',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontWeight: 600
                                    }}>
                                        {new Date(action.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        {leads.every(l => !l.interactions?.length) && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>Aucune interaction récente.</p>
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

