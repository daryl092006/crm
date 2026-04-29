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

    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'super_agent';
    const isObserver = profile?.role === 'observer';
    const canSeeAll = isAdmin || isObserver;
    const myLeads = canSeeAll ? leads : leads.filter(l => l.agentId === profile?.id);

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

            <div className="filter-bar">
                <div className="search-wrapper" style={{ flex: 1, minWidth: '220px' }}>
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Rechercher un prospect..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '2.5rem' }}
                    />
                </div>
                <select
                    value={campaignFilter}
                    onChange={(e) => handleCampaignFilterChange(e.target.value)}
                    style={{ minWidth: '180px' }}
                >
                    <option value="all">Toutes les Campagnes</option>
                    {(canSeeAll ? campaigns : campaigns.filter(c => leads.some(l => l.campaignId === c.id && l.agentId === profile?.id))).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => handleStatusFilterChange(e.target.value)}
                    style={{ minWidth: '180px' }}
                >
                    <option value="all">Tous les Statuts</option>
                    {statuses.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                </select>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {filteredLeads.length} résultat{filteredLeads.length !== 1 ? 's' : ''}
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
                            <tr key={lead.id} onClick={() => setSelectedLead(lead)}
                            className="hover-row"
                            style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                        >
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
                                <td onClick={e => e.stopPropagation()}>
                                    <button className="btn btn-ghost" style={{ padding: '0.4rem 0.875rem', fontSize: '0.75rem', fontWeight: 700 }}>
                                        Voir
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
                    profile={profile}
                />
            )}
        </div>
    );
};

export default Leads;
