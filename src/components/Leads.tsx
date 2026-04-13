import React, { useState } from 'react';
import { Search, Filter, MoreHorizontal, Target, Phone, Clock } from 'lucide-react';
import type { StudentLead, LeadStatus } from '../types';
import LeadDetailsModal from './LeadDetailsModal';

interface LeadsProps {
    leads: StudentLead[];
    statuses: LeadStatus[];
    campaigns: import('../types').Campaign[];
    onRefresh?: () => Promise<void>;
    profile: import('../types').Profile | null;
    initialStatusFilter?: string;
    onFilterChange?: (status: string) => void;
    initialCampaignFilter?: string;
    onCampaignChange?: (campaignId: string) => void;
}

const Leads: React.FC<LeadsProps> = ({
    leads,
    statuses,
    campaigns,
    onRefresh,
    profile,
    initialStatusFilter,
    onFilterChange,
    initialCampaignFilter,
    onCampaignChange
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'all');
    const [campaignFilter, setCampaignFilter] = useState(initialCampaignFilter || 'all');
    const [selectedLead, setSelectedLead] = useState<StudentLead | null>(null);

    // Sync state with prop if it changes externally
    React.useEffect(() => {
        if (initialStatusFilter) setStatusFilter(initialStatusFilter);
        if (initialCampaignFilter) setCampaignFilter(initialCampaignFilter);
    }, [initialStatusFilter, initialCampaignFilter]);

    const handleStatusFilterChange = (newStatus: string) => {
        setStatusFilter(newStatus);
        if (onFilterChange) onFilterChange(newStatus);
    };

    const handleCampaignFilterChange = (newCampaignId: string) => {
        setCampaignFilter(newCampaignId);
        if (onCampaignChange) onCampaignChange(newCampaignId);
    };

    const isAdmin = profile?.role === 'admin';
    const myLeads = isAdmin ? leads : leads.filter(l => l.agentId === profile?.id);

    const filteredLeads = myLeads.filter(l => {
        const matchesSearch =
            `${l.firstName} ${l.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (l.email && l.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (l.phone && l.phone.includes(searchTerm));

        const matchesStatus = statusFilter === 'all' || l.statusId === statusFilter;
        const matchesCampaign = campaignFilter === 'all' || String(l.campaignId) === String(campaignFilter);

        return matchesSearch && matchesStatus && matchesCampaign;
    });

    return (
        <div className="animate-fade">
            <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 800 }}>Gestion des Prospects</h1>
                    <p style={{ color: 'var(--text-muted)' }}>{filteredLeads.length} prospects dans votre liste de suivi.</p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Rechercher un prospect (nom, email, téléphone)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', color: 'white' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem', minWidth: '220px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0 1rem', alignItems: 'center' }}>
                        <Target size={18} color="var(--text-muted)" />
                        <select
                            value={campaignFilter}
                            onChange={(e) => handleCampaignFilterChange(e.target.value)}
                            style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', color: 'white', outline: 'none' }}
                        >
                            <option value="all">Toutes les Campagnes</option>
                            {(() => {
                                const displayedOptions = isAdmin
                                    ? campaigns
                                    : campaigns.filter(c => leads.some(l => l.campaignId === c.id && l.agentId === profile?.id));

                                return displayedOptions?.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ));
                            })()}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '0.8rem', minWidth: '220px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0 1rem', alignItems: 'center' }}>
                        <Filter size={18} color="var(--text-muted)" />
                        <select
                            value={statusFilter}
                            onChange={(e) => handleStatusFilterChange(e.target.value)}
                            style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', color: 'white', outline: 'none' }}
                        >
                            <option value="all">Tous les Statuts</option>
                            {statuses.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="table-container">
                <table style={{ minWidth: '900px' }}>
                    <thead>
                        <tr>
                            <th>Prospect</th>
                            <th>Téléphone</th>
                            <th>Statut Actuel</th>
                            <th>Dernière Interaction</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLeads.map((lead) => (
                            <tr key={lead.id} onClick={() => setSelectedLead(lead)} style={{
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)', display: 'grid', placeItems: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                                            {lead.firstName[0]}{lead.lastName[0]}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{lead.firstName} {lead.lastName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', display: 'grid', placeItems: 'center' }}>
                                            <Phone size={14} color="#10b981" />
                                        </div>
                                        <span style={{ color: 'white', fontWeight: 600 }}>{lead.phone || 'Non renseigné'}</span>
                                    </div>
                                </td>
                                <td>
                                    <span style={{
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        background: `${lead.status?.color || '#333'}15`,
                                        color: lead.status?.color || '#999',
                                        border: `1px solid ${lead.status?.color || '#333'}30`
                                    }}>
                                        {lead.status?.label || 'Inconnu'}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                                        <Clock size={14} />
                                        {lead.lastInteractionAt ? new Date(lead.lastInteractionAt).toLocaleDateString() : 'Aujourd\'hui'}
                                    </div>
                                </td>
                                <td>
                                    <button className="btn" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', color: 'var(--text-muted)' }}>
                                        <MoreHorizontal size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedLead && (
                <LeadDetailsModal
                    lead={selectedLead}
                    isOpen={!!selectedLead}
                    onClose={() => setSelectedLead(null)}
                    statuses={statuses}
                    onUpdate={async () => {
                        if (onRefresh) await onRefresh();
                    }}
                />
            )}
        </div>
    );
};

export default Leads;
