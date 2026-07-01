import React, { useState } from 'react';
import {
    Target,
    Trash2,
    Plus,
    ArrowRight,
    ArrowLeft,
    TrendingUp,
    Database,
    Upload,
    Download,
    Repeat,
    ChevronLeft,
    ChevronRight,
    Users,
    Clock,
    Pencil
} from 'lucide-react';
import type { StudentLead, Campaign, Agent } from '../types';
import { getBestAgentForLead } from '../utils/assignmentService';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { usePopup } from './Popup';
import AddCampaignModal from './AddCampaignModal';
import LeadExportModal from './LeadExportModal';
import { sanitizeForPostgres } from '../utils/verificationService';
import { ImportLeadsModal } from './ImportLeadsModal';
import { canManageCampaigns } from '../utils/roleUtils';
import { logAction } from '../utils/auditLogger';





interface CampaignsProps {
    profile: import('../types').Profile | null;
    campaigns: Campaign[];
    setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
    leads: StudentLead[];
    setLeads: React.Dispatch<React.SetStateAction<StudentLead[]>>;
    agents: Agent[];
    onRefresh?: () => Promise<void>;
}

const Campaigns: React.FC<CampaignsProps> = ({ profile, campaigns, setCampaigns, leads, setLeads, agents, onRefresh }) => {
    const { addToast } = useToast();
    const { showConfirm, showPrompt } = usePopup();
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(localStorage.getItem('crm_selected_campaign_id'));
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isAddCampaignModalOpen, setIsAddCampaignModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [campaignStatusFilter, setCampaignStatusFilter] = useState<'all' | 'draft' | 'active' | 'paused' | 'completed' | 'archived'>('active');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // FILTRE DE SÉCURITÉ : Les agents ne voient que LEURS campagnes 🎓
    const isAdmin = profile?.role === 'admin';
    const isManager = canManageCampaigns(profile?.role);
    const displayedCampaigns = (isManager ? campaigns : campaigns.filter(c => leads.some(l => l.campaignId === c.id && l.agentId === profile?.id)))
        .filter(c => campaignStatusFilter === 'all' || (c.status || 'active') === campaignStatusFilter);

    // Reset pagination when campaign changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [selectedCampaignId]);



    const handleSelectCampaign = (id: string | null) => {
        setSelectedCampaignId(id);
        if (id) localStorage.setItem('crm_selected_campaign_id', id);
        else localStorage.removeItem('crm_selected_campaign_id');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAddCampaign = async (campaignData: { 
        name: string; 
        source: string; 
        description?: string;
        status: string;
        start_date?: string;
        end_date?: string;
        objective?: number;
        column_mappings: any[] 
    }) => {

        const { data, error } = await supabase
            .from('campaigns')
            .insert(sanitizeForPostgres({
                name: campaignData.name,
                source: campaignData.source,
                description: campaignData.description || null,
                status: campaignData.status || 'draft',
                start_date: campaignData.start_date || new Date().toISOString(),
                end_date: campaignData.end_date || null,
                objective: campaignData.objective || 0,
                column_mappings: campaignData.column_mappings,
                organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
            }))
            .select().single();

        if (error) {
            addToast("Erreur : " + (error as Error).message, "error");
        }
        else if (data) {
            // Journaliser la création dans l'audit log
            logAction('create', 'campaign', {
                entityId: data.id,
                newValues: data
            });

            addToast(`Campagne "${data.name}" créée avec succès.`, "success");
            if (onRefresh) await onRefresh();
        }
    };


    const handleEditCampaign = async (campaignId: string, currentName: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        const newName = await showPrompt("Modifier le nom", "Nouveau nom de la campagne :", currentName);
        if (!newName) return;

        const newStatus = await showPrompt(
            "Modifier le statut", 
            "Nouveau statut (draft, active, paused, completed, archived) :", 
            campaign.status || 'active'
        );

        const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];
        if (newStatus && !validStatuses.includes(newStatus.toLowerCase().trim())) {
            addToast("Statut invalide. Choisissez parmi: draft, active, paused, completed, archived", "error");
            return;
        }

        const { error } = await supabase
            .from('campaigns')
            .update({ 
                name: newName,
                status: newStatus ? newStatus.toLowerCase().trim() : campaign.status
            })
            .eq('id', campaignId);

        if (error) {
            addToast("Erreur lors de la modification : " + (error as Error).message, "error");
        } else {
            // Journaliser la modification dans l'audit log
            logAction('update', 'campaign', {
                entityId: campaignId,
                oldValues: { name: campaign.name, status: campaign.status },
                newValues: { name: newName, status: newStatus ? newStatus.toLowerCase().trim() : campaign.status }
            });

            addToast("Campagne mise à jour avec succès !", "success");
            if (onRefresh) onRefresh();
        }
    };


    const handleDeleteCampaign = async (campaignId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        const confirmed = await showConfirm(
            "Archiver la campagne",
            `Êtes-vous sûr de vouloir archiver la campagne "${campaign.name}" ? Elle ne sera plus affichée dans la liste principale, mais toutes ses données seront conservées.`,
            "warning"
        );

        if (confirmed) {
            const { error: campaignError } = await supabase
                .from('campaigns')
                .update({ 
                    status: 'archived',
                    archived_at: new Date().toISOString()
                })
                .eq('id', campaignId);

            if (campaignError) {
                addToast("Erreur lors de l'archivage de la campagne : " + campaignError.message, "error");
            } else {
                addToast("Campagne archivée avec succès.", "info");
                if (selectedCampaignId === campaignId) handleSelectCampaign(null);
                if (onRefresh) onRefresh();
            }
        }
    };


    const handleMigrateCampaign = async (sourceId: string) => {
        const otherCampaigns = campaigns.filter(c => c.id !== sourceId);
        if (otherCampaigns.length === 0) {
            addToast("Aucune autre campagne vers laquelle migrer les prospects.", "info");
            return;
        }

        const source = campaigns.find(c => c.id === sourceId);
        const options = otherCampaigns.map(c => c.name).join(', ');
        const targetName = await showPrompt(
            "Migration de prospects",
            `Vers quelle campagne migrer les prospects de "${source?.name}" ?\nOptions : ${options}`
        );

        const target = otherCampaigns.find(c => c.name.toLowerCase() === targetName?.toLowerCase());
        if (!target) {
            if (targetName) addToast("Campagne cible introuvable.", "error");
            return;
        }

        const { error } = await supabase
            .from('leads')
            .update({ campaign_id: target.id })
            .eq('campaign_id', sourceId);

        if (error) {
            addToast("Erreur lors de la migration : " + (error as Error).message, "error");
        } else {
            addToast(`Prospects migrés vers "${target.name}" avec succès.`, "success");
            if (onRefresh) onRefresh();
        }
    };

    const handleDeleteLead = async (id: string) => {
        const confirmed = await showConfirm("Supprimer le prospect", "Êtes-vous sûr de vouloir supprimer ce prospect ? Cette action est irréversible.", "error");
        if (confirmed) {
            try {
                const { error } = await supabase.from('leads').delete().eq('id', id);
                if (error) throw error;

                setLeads(prev => prev.filter(l => l.id !== id));
                addToast("Prospect supprimé.", "info");
                if (onRefresh) await onRefresh();
            } catch (error: unknown) {
                addToast("Erreur lors de la suppression : " + (error as Error).message, "error");
            }
        }
    };

    const handleClearCampaignLeads = async (campaignId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        const confirmed = await showConfirm(
            "Vider la campagne",
            `Êtes-vous sûr de vouloir supprimer TOUS les prospects de la campagne "${campaign.name}" ? Cette action est irréversible.`,
            "error"
        );

        if (confirmed) {
            try {
                const { error } = await supabase.from('leads').delete().eq('campaign_id', campaignId);
                if (error) throw error;

                setLeads(prev => prev.filter(l => l.campaignId !== campaignId));
                addToast("Tous les prospects ont été supprimés de cette campagne.", "success");
                if (onRefresh) await onRefresh();
            } catch (error: unknown) {
                addToast("Erreur lors du vidage : " + (error as Error).message, "error");
            }
        }
    };

    const downloadTemplate = () => {
        const campaign = selectedCampaignId ? campaigns.find(c => c.id === selectedCampaignId) : null;
        const mappings = campaign?.column_mappings || [
            { field: 'firstName', label: 'Prénom' },
            { field: 'lastName', label: 'Nom' },
            { field: 'email', label: 'Email' },
            { field: 'phone', label: 'Téléphone' },
            { field: 'country', label: 'Pays' },
            { field: 'city', label: 'Ville' },
            { field: 'fieldOfInterest', label: 'Filière' },
            { field: 'level', label: 'Niveau' },
            { field: 'statusId', label: 'Statut' },
            { field: 'notes', label: 'Notes' }
        ];


        const headers = [mappings.map(m => m.label)];
        const worksheet = XLSX.utils.aoa_to_sheet(headers);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Template Import");
        XLSX.writeFile(workbook, `template_import_${campaign?.name || 'prospects'}.xlsx`);
        addToast("Modèle d'importation téléchargé selon votre configuration.", "info");
    };


    const handleExport = (selectedColumns: string[]) => {
        if (!selectedCampaignId) return;
        const campaign = campaigns.find(c => c.id === selectedCampaignId);
        const campaignLeads = leads.filter(l => l.campaignId === selectedCampaignId);

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

        const dataToExport = campaignLeads.map(l => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const row: Record<string, any> = {};
            selectedColumns.forEach(colId => {
                // Determine the label: prefer the custom mapping label from the campaign configuration
                const mapping = campaign?.column_mappings?.find(m => m.field === colId);
                const label = mapping ? mapping.label : (columnMap[colId] || colId);

                if (colId === 'statusId') {
                    row[label] = l.status?.label || l.statusId;
                } else if (colId === 'createdAt') {
                    row[label] = new Date(l.createdAt).toLocaleDateString();
                } else {
                    // Check standard fields first, then metadata
                    const standardFields = ['firstName', 'lastName', 'email', 'phone', 'country', 'city', 'fieldOfInterest', 'level', 'notes', 'statusId', 'score'];
                    if (standardFields.includes(colId)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        row[label] = (l as any)[colId];
                    } else {
                        row[label] = l.metadata?.[colId] || '';
                    }
                }
            });

            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Prospects");
        XLSX.writeFile(workbook, `prospects_${campaign?.name || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`);
        addToast("Prospects exportés avec succès !", "success");
        setIsExportModalOpen(false);
    };



    const campaign = selectedCampaignId ? campaigns.find(c => c.id === selectedCampaignId) : null;

    if (selectedCampaignId && campaign) {
        const campaignLeads = isManager
            ? leads.filter(l => l.campaignId === campaign.id)
            : leads.filter(l => l.campaignId === campaign.id && l.agentId === profile?.id);
        const mappings = campaign.column_mappings || [
            { field: 'firstName', label: 'Prénom' },
            { field: 'lastName', label: 'Nom' },
            { field: 'email', label: 'Email' },
            { field: 'phone', label: 'Téléphone' },
            { field: 'statusId', label: 'Statut' }
        ];

        const totalLeadsCount = campaignLeads.length;
        const conversionCount = campaignLeads.filter(l => ['inscrit', 'admis'].some(k => (l.statusId || '').toLowerCase().includes(k))).length;
        const convRate = totalLeadsCount > 0 ? Math.round((conversionCount / totalLeadsCount) * 100) : 0;

        return (
            <div className="animate-fade">
                <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button onClick={() => handleSelectCampaign(null)} className="btn btn-ghost" style={{ width: 'fit-content', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', color: 'white', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <ArrowLeft size={16} /> Retour
                        </button>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.04em', marginTop: '0.5rem' }}>{campaign.name}</h1>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>SOURCE : {campaign.source}</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>{totalLeadsCount} Prospects</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            {isManager && (
                                <button onClick={() => handleEditCampaign(campaign.id, campaign.name)} className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }} title="Modifier la campagne">
                                    <Pencil size={18} />
                                </button>
                            )}
                            {isManager && (
                                <button onClick={() => handleMigrateCampaign(campaign.id)} className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }} title="Migrer vers une autre campagne">
                                    <Repeat size={18} />
                                </button>
                            )}
                            {isAdmin && (
                                <button onClick={() => handleClearCampaignLeads(campaign.id)} className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }} title="Vider la campagne">
                                    <Trash2 size={18} /> Vider
                                </button>
                            )}
                        </div>
                        <button onClick={() => setIsExportModalOpen(true)} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '14px' }}>
                            <Download size={18} /> Exporter
                        </button>
                    </div>
                </div>

                <div className="stat-grid" style={{ marginBottom: '3rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}><Users size={24} /></div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{totalLeadsCount}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Total Prospects</div>
                    </div>
                    <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ color: 'var(--success)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}><TrendingUp size={24} /></div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{convRate}%</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Taux Conversion</div>
                    </div>
                    <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ color: 'var(--accent)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}><Plus size={24} /></div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{conversionCount}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Admis / Inscrits</div>
                    </div>
                    <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ color: 'var(--warning)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}><Clock size={24} /></div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{campaignLeads.filter(l => (l.statusId || '').toLowerCase() === 'nouveau').length}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Nouveaux Leads</div>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: '2rem', padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ padding: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px' }}>
                                <Database size={20} color="var(--primary)" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Données de Campagne</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mappage: {mappings.length} colonnes configurées.</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {canManageCampaigns(profile?.role) && (
                                <div>
                                    <button onClick={() => setIsImportModalOpen(true)} className="btn" style={{ background: 'var(--primary)', color: 'white' }}>
                                        <Upload size={16} /> Importer
                                    </button>
                                </div>
                            )}
                            <button onClick={downloadTemplate} className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}>
                                <Download size={16} /> Modèle
                            </button>
                        </div>

                    </div>
                </div>

                <div className="table-container card" style={{ padding: '0', borderRadius: '24px', overflow: 'hidden' }}>
                    <table className="table-fixed">
                        <thead>
                            <tr>
                                {mappings.map((m, i) => (
                                    <th key={i}>{m.label}</th>
                                ))}
                                <th style={{ width: '100px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const startIndex = (currentPage - 1) * itemsPerPage;
                                return campaignLeads.slice(startIndex, startIndex + itemsPerPage);
                            })().map((lead) => (
                                <tr key={lead.id}>
                                    {mappings.map((m, i) => {
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        let value: any = '';
                                        const standardFields = ['firstName', 'lastName', 'email', 'phone', 'country', 'city', 'fieldOfInterest', 'level', 'notes', 'statusId', 'score'];

                                        if (standardFields.includes(m.field)) {
                                            if (m.field === 'statusId') {
                                                return (
                                                    <td key={i}>
                                                        <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, color: lead.status?.color || 'white', background: `${lead.status?.color}15`, border: `1px solid ${lead.status?.color}30` }}>
                                                            {lead.status?.label || lead.statusId}
                                                        </span>
                                                    </td>
                                                );
                                            }
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            value = (lead as any)[m.field];
                                        } else {
                                            value = lead.metadata?.[m.field] || '';
                                        }
                                        return <td key={i} title={String(value)} className="text-ellipsis">{value}</td>;
                                    })}
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {isAdmin && (
                                                <button onClick={() => handleDeleteLead(lead.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.5rem' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Vue :</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="input"
                            style={{ padding: '4px 10px', borderRadius: '10px', height: '36px', minWidth: '100px', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                        >
                            {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Prospects 1-{Math.min(itemsPerPage * currentPage, totalLeadsCount)} sur {totalLeadsCount}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', padding: '0 10px', height: '40px', opacity: currentPage === 1 ? 0.3 : 1 }}><ChevronLeft size={20} /></button>
                        <div style={{ padding: '0 1rem', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{currentPage} / {Math.ceil(totalLeadsCount / itemsPerPage) || 1}</div>
                        <button disabled={currentPage >= Math.ceil(totalLeadsCount / itemsPerPage)} onClick={() => setCurrentPage(p => p + 1)} className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white', padding: '0 10px', height: '40px', opacity: currentPage >= Math.ceil(totalLeadsCount / itemsPerPage) ? 0.3 : 1 }}><ChevronRight size={20} /></button>
                    </div>
                </div>

                <LeadExportModal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    onExport={handleExport}
                />
            </div>
        );
    }

    return (
        <div className="animate-fade">
            <div style={{ marginBottom: '4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
                <div style={{ flex: '1 1 400px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div style={{ padding: '0.75rem', background: 'var(--accent)', borderRadius: '16px', display: 'grid', placeItems: 'center', boxShadow: '0 8px 16px rgba(34, 211, 238, 0.3)' }}>
                            <Target size={24} color="white" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.04em', lineHeight: 1 }}>Centre Stratégique</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, marginTop: '6px' }}>Orchestration des canaux d'acquisition university.</p>
                        </div>
                    </div>
                </div>
                {canManageCampaigns(profile?.role) && (
                    <button onClick={() => setIsAddCampaignModalOpen(true)} className="btn btn-primary" style={{ padding: '1rem 2rem', borderRadius: '16px', fontSize: '1rem', boxShadow: '0 10px 20px var(--primary-glow)' }}>
                        <Plus size={20} /> Nouvelle Campagne
                    </button>
                )}
            </div>

            <div className="stat-grid" style={{ marginBottom: '3rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                <div className="card" style={{ padding: '2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), transparent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <Target size={24} color="var(--primary)" />
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>MÉTRIQUE CLÉ</span>
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 950 }}>{displayedCampaigns.length}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sources Actives</div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>
                    {isManager ? 'Toutes les Campagnes' : 'Mes Campagnes Assignées'}
                </h2>
                
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filtrer par statut :</span>
                    <select
                        value={campaignStatusFilter}
                        onChange={e => setCampaignStatusFilter(e.target.value as any)}
                        style={{ padding: '0.625rem 1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', fontWeight: 600 }}
                    >
                        <option value="active">Actives</option>
                        <option value="draft">Brouillons</option>
                        <option value="paused">Suspendues</option>
                        <option value="completed">Terminées</option>
                        <option value="archived">Archivées</option>
                        <option value="all">Toutes</option>
                    </select>
                </div>
            </div>


            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '2rem' }}>
                {displayedCampaigns.map((campaign) => {
                    const cLeads = isManager ? leads.filter(l => l.campaignId === campaign.id) : leads.filter(l => l.campaignId === campaign.id && l.agentId === profile?.id);
                    const totalLeads = cLeads.length;
                    const conv = cLeads.filter(l => ['inscrit', 'admis'].some(k => (l.statusId || '').toLowerCase().includes(k))).length;
                    const rate = totalLeads > 0 ? Math.round((conv / totalLeads) * 100) : 0;

                    // Compteurs basés sur le statut réel du prospect (Mini pipeline)
                    const qCount = cLeads.filter(l => { const s = (l.statusId || '').toLowerCase(); return s.includes('qualif'); }).length;
                    const iCount = cLeads.filter(l => { const s = (l.statusId || '').toLowerCase(); return s.includes('info') || s.includes('orient'); }).length;
                    const canCount = cLeads.filter(l => { const s = (l.statusId || '').toLowerCase(); return s.includes('cand') || s.includes('dossier'); }).length;
                    const admCount = cLeads.filter(l => { const s = (l.statusId || '').toLowerCase(); return s.includes('inscrit') || s.includes('admis') || s.includes('confirme'); }).length;

                    const statusLabels: Record<string, string> = {
                        draft: 'Brouillon',
                        active: 'Active',
                        paused: 'Suspendue',
                        completed: 'Terminée',
                        archived: 'Archivée'
                    };

                    const statusColors: Record<string, string> = {
                        draft: '#94a3b8',
                        active: '#22c55e',
                        paused: '#f59e0b',
                        completed: '#3b82f6',
                        archived: '#64748b'
                    };

                    return (
                        <div key={campaign.id} className="card" style={{
                            padding: '2.5rem',
                            position: 'relative',
                            overflow: 'hidden',
                            background: 'linear-gradient(145deg, var(--bg-card), rgba(255,255,255,0.01))',
                            border: '1px solid rgba(255,255,255,0.05)',
                            transition: 'all 0.3s cubic-bezier(0.19, 1, 0.22, 1)',
                            cursor: 'pointer'
                        }} onClick={() => handleSelectCampaign(campaign.id)}>
                            
                            {/* Titre et badge de statut */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div style={{ minWidth: 0 }}>
                                    <h3 style={{ fontSize: '1.35rem', fontWeight: 850, margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                        {campaign.name}
                                    </h3>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Source : {campaign.source}</span>
                                </div>
                                <span style={{
                                    padding: '4px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800,
                                    background: (statusColors[campaign.status] || '#ccc') + '15',
                                    color: statusColors[campaign.status] || '#ccc',
                                    border: `1px solid ${(statusColors[campaign.status] || '#ccc')}30`,
                                    textTransform: 'uppercase'
                                }}>
                                    {statusLabels[campaign.status] || campaign.status}
                                </span>
                            </div>

                            {/* Classification Breakdown (Mini Pipeline) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginTop: '1.25rem' }}>
                                {[
                                    { label: 'Qualif.', val: qCount, color: 'var(--warning)' },
                                    { label: 'Infos', val: iCount, color: 'var(--accent)' },
                                    { label: 'Cand.', val: canCount, color: 'var(--primary)' },
                                    { label: 'Admis', val: admCount, color: 'var(--success)' }
                                ].map((p, idx) => (
                                    <div key={idx} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 900, color: p.val > 0 ? 'white' : 'var(--text-muted)' }}>{p.val}</div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{p.label}</div>
                                        <div style={{ height: '3px', background: p.val > 0 ? p.color : 'rgba(255,255,255,0.05)', borderRadius: '4px', marginTop: '4px' }}></div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                {isManager && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEditCampaign(campaign.id, campaign.name); }}
                                        className="btn"
                                        style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white', padding: '0.5rem', flex: 0 }}
                                        title="Modifier la campagne"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                )}
                                {isAdmin && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(campaign.id); }}
                                        className="btn"
                                        style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '0.5rem', flex: 0 }}
                                        title="Archiver la campagne"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <button className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', fontWeight: 750 }}>
                                    Gérer les prospects <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {displayedCampaigns.length === 0 && (
                <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '32px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.03)', borderRadius: '24px', display: 'grid', placeItems: 'center', margin: '0 auto 1.5rem' }}>
                        <Target size={40} color="var(--text-muted)" />
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Aucune campagne pour le moment</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{isManager ? 'Commencez par créer votre première source d\'acquisition de prospects.' : 'Aucune campagne ne vous est assignée pour le moment.'}</p>
                    {isManager && (
                        <button onClick={() => setIsAddCampaignModalOpen(true)} className="btn btn-primary" style={{ padding: '0.8rem 2.5rem', borderRadius: '16px' }}>+ Nouvelle Campagne</button>
                    )}
                </div>
            )}

            <AddCampaignModal
                isOpen={isAddCampaignModalOpen}
                onClose={() => setIsAddCampaignModalOpen(false)}
                onSave={async (data) => {
                    await handleAddCampaign(data);
                    setIsAddCampaignModalOpen(false);
                }}
            />

            <ImportLeadsModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                campaigns={campaigns}
                agents={agents}
                leads={leads}
                profile={profile}
                onSuccess={async () => {
                    if (onRefresh) await onRefresh();
                }}
            />
        </div>
    );
};

export default Campaigns;
