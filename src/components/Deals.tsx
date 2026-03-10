import React from 'react';
import { DollarSign, MoreHorizontal, ArrowRight } from 'lucide-react';

interface Deal {
    id: number;
    title: string;
    company: string;
    value: string;
    stage: string;
}

const Deals: React.FC = () => {
    const columns = [
        { id: 'prospecting', title: 'Prospection' },
        { id: 'qualification', title: 'Qualification' },
        { id: 'proposal', title: 'Proposition' },
        { id: 'negotiation', title: 'Négociation' },
        { id: 'closed', title: 'Gagné' },
    ];

    const deals: Deal[] = [
        { id: 1, title: 'Extension BioLab', company: 'BioLab', value: '€12,000', stage: 'qualification' },
        { id: 2, title: 'Projet Cloud TechFlow', company: 'TechFlow', value: '€25,000', stage: 'negotiation' },
        { id: 3, title: 'Maintenance Annuelle', company: 'BuildIt', value: '€5,000', stage: 'prospecting' },
        { id: 4, title: 'Service Créatif Octobre', company: 'Creative Agency', value: '€8,500', stage: 'proposal' },
        { id: 5, title: 'Licences Enterprise', company: 'FastCorp', value: '€45,000', stage: 'negotiation' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Opportunités</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Suivez le progrès de vos ventes dans le pipeline.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Pipeline:</span>
                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>€95,500</span>
                    </div>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '1rem',
                minHeight: '70vh',
                overflowX: 'auto',
                paddingBottom: '1rem'
            }}>
                {columns.map((column) => (
                    <div key={column.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.5rem 0.25rem',
                            borderBottom: '2px solid var(--border)'
                        }}>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{column.title}</h3>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                {deals.filter(d => d.stage === column.id).length}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {deals.filter(d => d.stage === column.id).map((deal) => (
                                <div key={deal.id} className="card" style={{ padding: '1rem', cursor: 'pointer', transition: 'transform 0.1s' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>{deal.company}</span>
                                        <MoreHorizontal size={14} color="var(--text-muted)" />
                                    </div>
                                    <h4 style={{ fontSize: '0.925rem', marginBottom: '0.75rem', fontWeight: 500 }}>{deal.title}</h4>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)' }}>
                                            <DollarSign size={14} />
                                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{deal.value}</span>
                                        </div>
                                        <ArrowRight size={14} color="var(--text-muted)" />
                                    </div>
                                </div>
                            ))}
                            <button style={{
                                background: 'transparent',
                                border: '1px dashed var(--border)',
                                borderRadius: '8px',
                                padding: '0.75rem',
                                color: 'var(--text-muted)',
                                fontSize: '0.875rem',
                                cursor: 'pointer'
                            }}>
                                + Ajouter
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Deals;
