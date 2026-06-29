import React, { useState } from 'react';
import { Search, Filter, MoreHorizontal, Target, Phone, Clock, User } from 'lucide-react';
import type { StudentLead, LeadStatus, Agent } from '../types';
import LeadDetailsModal from './LeadDetailsModal';
import { isNewLead, isInscribedLead, isAdmittedLead } from '../utils/leadUtils';
import { isAgentOnly } from '../utils/roleUtils';

interface LeadsProps {
    leads: StudentLead[];
    statuses: LeadStatus[];
    campaigns: import('../types').Campaign[];
    agents: Agent[];
    onRefresh?: () => Promise<void>;
    profile: import('../types').Profile | null;
    initialStatusFilter?: string;
    onFilterChange?: (status: string) => void;
    initialCampaignFilter?: string;
    onCampaignChange?: (campaignId: string) => void;
    programs: import('../types').Program[];
    classifications: import('../types').ProspectClassification[];
    sources: import('../types').ProspectSource[];
    messageTemplates: import('../types').MessageTemplate[];
}

const Leads: React.FC<LeadsProps> = ({
    leads,
    statuses,
    campaigns,
    agents,
    onRefresh,
    profile,
    initialStatusFilter,
    onFilterChange,
    initialCampaignFilter,
    onCampaignChange,
    programs,
    classifications,
    sources,
    messageTemplates
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'all');
    const [campaignFilter, setCampaignFilter] = useState(initialCampaignFilter || 'all');
    const [agentFilter, setAgentFilter] = useState('all');
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
    const myLeads = !isAgentOnly(profile?.role) ? leads : leads.filter(l => l.agentId === profile?.id);

    const filteredLeads = myLeads.filter(l => {
        const matchesSearch =
            `${l.firstName} ${l.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (l.email && l.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (l.phone && l.phone.includes(searchTerm));

        let matchesStatus = statusFilter === 'all';
        if (!matchesStatus) {
            if (statusFilter === 'nouveau') matchesStatus = isNewLead(l);
            else if (statusFilter === 'inscrit') matchesStatus = isInscribedLead(l);
            else if (statusFilter === 'admis') matchesStatus = isAdmittedLead(l);
            else matchesStatus = l.statusId === statusFilter;
        }

        const matchesCampaign = campaignFilter === 'all' || String(l.campaignId) === String(campaignFilter);

        let matchesAgent = agentFilter === 'all';
        if (!matchesAgent) {
            if (agentFilter === 'unassigned') matchesAgent = !l.agentId;
            else matchesAgent = String(l.agentId) === String(agentFilter);
        }

        return matchesSearch && matchesStatus && matchesCampaign && matchesAgent;
    });

    return (
        <div className="animate-fade">
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 950, letterSpacing: '-0.04em' }}>Gestion des Prospects</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem' }}>Visualisez et gérez l'ensemble de votre base de prospects ESCEN.</p>
            </div>

            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                <div className="leads-filters" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '160px', position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Rechercher par nom, email, téléphone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.875rem 1.25rem 0.875rem 3.25rem',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid var(--border)',
                                borderRadius: '16px',
                                color: 'white',
                                fontSize: '0.925rem',
                                transition: 'all 0.2s'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: '1 1 auto' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 140px' }}>
                            <Target size={16} style={{ position: 'absolute', left: '1rem', zIndex: 1, color: 'var(--text-muted)' }} />
                            <select
                                value={campaignFilter}
                                onChange={(e) => handleCampaignFilterChange(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem 1rem 0.8rem 2.75rem',
                                    borderRadius: '14px',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    minWidth: '140px'
                                }}
                            >
                                <option value="all">Toutes les Campagnes</option>
                                {(() => {
                                    const opts = isAdmin ? campaigns : campaigns.filter(c => leads.some(l => l.campaignId === c.id && l.agentId === profile?.id));
                                    return opts?.map(c => <option key={c.id} value={c.id}>{c.name}</option>);
                                })()}
                            </select>
                        </div>

                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 140px' }}>
                            <Filter size={16} style={{ position: 'absolute', left: '1rem', zIndex: 1, color: 'var(--text-muted)' }} />
                            <select
                                value={statusFilter}
                                onChange={(e) => handleStatusFilterChange(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem 1rem 0.8rem 2.75rem',
                                    borderRadius: '14px',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    minWidth: '140px'
                                }}
                            >
                                <option value="all">Tous les Statuts</option>
                                <option value="nouveau">Nouveau</option>
                                <option value="inscrit">Inscrit</option>
                                <option value="admis">Admis</option>
                                <optgroup label="Détail complet">
                                    {statuses.map(s => (
                                        <option key={s.id} value={s.id}>{s.label}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

                        {!isAgentOnly(profile?.role) && (
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 140px' }}>
                                <User size={16} style={{ position: 'absolute', left: '1rem', zIndex: 1, color: 'var(--text-muted)' }} />
                                <select
                                    value={agentFilter}
                                    onChange={(e) => setAgentFilter(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem 0.8rem 2.75rem',
                                        borderRadius: '14px',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        minWidth: '140px'
                                    }}
                                >
                                    <option value="all">Tous les Conseillers</option>
                                    <option value="unassigned">Non Assignés</option>
                                    {agents.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                    </div>
                </div>
            </div>


            <div className="table-container card" style={{ padding: 0, overflowX: 'auto' }}>
                <table style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '250px' }}>Prospect</th>
                            <th style={{ width: '180px' }}>Contact</th>
                            <th style={{ width: '200px' }}>État du Dossier</th>
                            <th style={{ width: '220px' }}>Historique</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLeads.map((lead) => (
                            <tr key={lead.id} onClick={() => setSelectedLead(lead)} style={{
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}>
                                <td style={{ maxWidth: '300px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)', display: 'grid', placeItems: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                                            {lead.firstName[0]}{lead.lastName[0]}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.firstName} {lead.lastName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--text-muted)', fontSize: '0.875rem', overflow: 'hidden' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                            <Phone size={14} color="#10b981" />
                                        </div>
                                        <span style={{ color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.phone || 'Non renseigné'}</span>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            background: `${lead.status?.color || '#333'}15`,
                                            color: lead.status?.color || '#999',
                                            border: `1px solid ${lead.status?.color || '#333'}30`,
                                            display: 'inline-block',
                                            maxWidth: '100%',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {lead.status?.label || 'Inconnu'}
                                        </span>
                                    </div>
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

            {
                selectedLead && (
                    <LeadDetailsModal
                        lead={selectedLead}
                        isOpen={!!selectedLead}
                        onClose={() => setSelectedLead(null)}
                        statuses={statuses}
                        agents={agents}
                        profile={profile}
                        programs={programs}
                        classifications={classifications}
                        sources={sources}
                        messageTemplates={messageTemplates}
                        campaigns={campaigns}
                        onUpdate={async () => {
                            if (onRefresh) await onRefresh();
                        }}
                    />
                )
            }
        </div >
    );
};

export default Leads;
