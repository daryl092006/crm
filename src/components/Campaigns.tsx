import { Target, ArrowLeft, Upload, Download, Database, Trash2, Repeat, Edit2 } from 'lucide-react';
import type { StudentLead, Campaign, Agent } from '../types';
import { getBestAgentForLead } from '../utils/assignmentService';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { usePopup } from './Popup';
import { useState } from 'react';
import AddCampaignModal from './AddCampaignModal';
import LeadExportModal from './LeadExportModal';



const AVAILABLE_FIELDS = [
    { value: 'firstName', label: 'Prénom' },
    { value: 'lastName', label: 'Nom' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Téléphone' },
    { value: 'country', label: 'Pays' },
    { value: 'city', label: 'Ville' },
    { value: 'fieldOfInterest', label: 'Filière' },
    { value: 'level', label: 'Niveau' },
    { value: 'notes', label: 'Notes' },
];

interface CampaignsProps {
    profile: any;
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



    const handleSelectCampaign = (id: string | null) => {
        setSelectedCampaignId(id);
        if (id) localStorage.setItem('crm_selected_campaign_id', id);
        else localStorage.removeItem('crm_selected_campaign_id');
    };

    const validateCSV = (rows: string[][], campaign: Campaign): { valid: boolean; errors: string[]; leads: any[] } => {
        const errors: string[] = [];
        const importedLeads: any[] = [];
        const normalize = (s: any) => s ? s.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
        const headers = (rows[0] || []).map(h => normalize(h));

        // Use custom mappings if available, otherwise fallback to default
        const mappings = campaign.column_mappings || [
            { field: 'firstName', label: 'Prénom' },
            { field: 'lastName', label: 'Nom' },
            { field: 'email', label: 'Email' },
            { field: 'phone', label: 'Téléphone' }
        ];


        const required = mappings.map(m => normalize(m.label));
        const missing = required.filter((r, idx) => {
            // Only strictly require prenom, nom, email if they are in mappings
            const field = mappings[idx].field;
            if (['firstName', 'lastName', 'email'].includes(field)) {
                return !headers.includes(r);
            }
            return false;
        });

        if (missing.length > 0) {
            return { valid: false, errors: [`Colonnes obligatoires manquantes : ${missing.join(', ')}`], leads: [] };
        }

        const fieldToIdx: Record<string, number> = {};
        mappings.forEach(m => {
            let idx = headers.indexOf(normalize(m.label));
            if (idx === -1) {
                // Intelligent fallback mapping for common header variations
                const finder = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));
                if (m.field === 'firstName') idx = finder(['prenom', 'first name', 'first']);
                else if (m.field === 'lastName') idx = finder(['nom', 'last name', 'last', 'family']);
                else if (m.field === 'email') idx = finder(['mail', 'e-mail', 'courriel']);
                else if (m.field === 'phone') idx = finder(['tel', 'phone', 'numero', 'contact']);
                else if (m.field === 'country') idx = finder(['pays', 'country']);
            }
            fieldToIdx[m.field] = idx;
        });

        let currentLeadsForAssignment = [...leads];

        rows.slice(1).forEach((rawCols, index) => {
            if (!rawCols || rawCols.length === 0) return;

            // Map the row values based on header indices to handle sparse or short rows
            const getVal = (field: string) => {
                const idx = fieldToIdx[field];
                if (idx === undefined || idx === -1 || idx >= rawCols.length) return "";
                const val = rawCols[idx];
                return val === null || val === undefined ? "" : String(val).trim();
            };

            const email = getVal('email');
            const phone = getVal('phone');
            const lineNum = index + 2;

            if (!email || !email.includes('@')) {
                const hasAnyData = rawCols.some(c => c !== null && c !== undefined && String(c).trim() !== "");
                if (hasAnyData) {
                    errors.push(`Ligne ${lineNum}: Email invalide (${email || 'vide'})`);
                }
                return;
            }

            const firstName = getVal('firstName');
            const lastName = getVal('lastName');
            const country = getVal('country');
            const city = getVal('city');
            const field = getVal('fieldOfInterest');
            const level = getVal('level');
            const status = getVal('statusId');
            const note = getVal('notes');

            // Handle custom fields (metadata)
            const metadata: Record<string, any> = {};
            mappings.forEach(m => {
                const standardFields = ['firstName', 'lastName', 'email', 'phone', 'country', 'city', 'fieldOfInterest', 'level', 'notes', 'statusId', 'score'];
                if (!standardFields.includes(m.field)) {
                    metadata[m.field] = getVal(m.field);
                }
            });

            const assignedAgent = getBestAgentForLead(agents, currentLeadsForAssignment);

            const newLead: any = {
                first_name: firstName || '',
                last_name: lastName || '',
                email: email,
                phone: phone || "00000000",
                country: country || 'Sénégal',
                city: city || '',
                field_of_interest: field || 'Autre',
                study_level: level || '',
                status_id: status.toLowerCase() || 'non_contacte',
                notes: note || '',
                metadata: metadata,
                campaign_id: campaign.id,
                agent_id: assignedAgent?.id,
                organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
            };

            importedLeads.push(newLead);
            
            // Critical for load balancing: update temporary state so next iteration 
            // of the loop knows this agent already got a new lead.
            currentLeadsForAssignment.push({
                id: `tmp-${index}`,
                firstName: newLead.first_name,
                lastName: newLead.last_name,
                email: newLead.email,
                phone: newLead.phone,
                country: newLead.country,
                city: newLead.city,
                level: newLead.study_level,
                statusId: newLead.status_id,
                agentId: newLead.agent_id,
                campaignId: newLead.campaign_id,
                organizationId: newLead.organization_id,
                createdAt: new Date().toISOString()
            } as any);
        });


        return { valid: errors.length === 0, errors, leads: importedLeads };
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>, campaignId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as string[][];

            const campaign = campaigns.find(c => c.id === campaignId);
            if (!campaign) return;

            const result = validateCSV(rows, campaign);

            if (!result.valid) {
                addToast(`Erreur de format : ${result.errors.join(', ')}`, "error");
                console.error("Validation errors:", result.errors);
            } else if (result.leads.length === 0) {
                addToast("Le fichier semble vide ou ne contient aucun prospect valide.", "error");
            } else {
                const { error } = await supabase.from('leads').insert(result.leads);
                if (error) {
                    addToast("Erreur lors de l'insertion en base : " + error.message, "error");
                } else {
                    addToast(`${result.leads.length} prospects importés avec succès !`, "success");
                    // Refresh data without full page reload
                    if (onRefresh) await onRefresh();
                }
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const handleAddCampaign = async (campaignData: { name: string; source: string; column_mappings: any[] }) => {
        if (!agents || agents.length === 0) {
            addToast("Attention : Vous devez d'abord ajouter au moins un agent pour pouvoir créer une campagne.", "error");
            return;
        }

        const selectedA = getBestAgentForLead(agents, leads);
        if (!selectedA) {
            addToast("Erreur lors du calcul de l'agent disponible.", "error");
            return;
        }

        const { data, error } = await supabase
            .from('campaigns')
            .insert({
                name: campaignData.name,
                source: campaignData.source,
                column_mappings: campaignData.column_mappings,
                agent_id: selectedA.id,
                start_date: new Date().toISOString(),
                organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
            })
            .select().single();

        if (error) {
            // Si la colonne column_mappings n'existe pas encore en base, on l'ignore pour l'instant mais on prévient l'utilisateur
            if (error.code === '42703') {
                const { data: dataAlt, error: errorAlt } = await supabase
                    .from('campaigns')
                    .insert({
                        name: campaignData.name,
                        source: campaignData.source,
                        start_date: new Date().toISOString(),
                        organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
                    }).select().single();

                if (errorAlt) addToast("Erreur : " + errorAlt.message, "error");
                else if (dataAlt) addToast(`Campagne "${dataAlt.name}" créée (Configuration colonnes ignorée car la table n'est pas à jour).`, "warning");
            } else {
                addToast("Erreur : " + error.message, "error");
            }
        }
        else if (data) {
            addToast(`Campagne "${data.name}" créée et assignée automatiquement à ${selectedA.name}.`, "success");
            if (onRefresh) await onRefresh();
        }
    };


    const handleEditCampaign = async (campaignId: string, currentName: string) => {
        const newName = await showPrompt("Modifier le nom", "Nouveau nom de la campagne :", currentName);
        if (newName && newName !== currentName) {
            const { error } = await supabase
                .from('campaigns')
                .update({ name: newName })
                .eq('id', campaignId);

            if (error) {
                addToast("Erreur lors de la modification : " + error.message, "error");
            } else {
                addToast("Nom de la campagne mis à jour.", "success");
                setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, name: newName } : c));
                if (onRefresh) onRefresh();
            }
        }
    };

    const handleDeleteCampaign = async (campaignId: string) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        const confirmed = await showConfirm(
            "Supprimer la campagne",
            `Êtes-vous sûr de vouloir supprimer la campagne "${campaign.name}" ? Tous les prospects associés seront également supprimés.`,
            "error"
        );

        if (confirmed) {
            // First delete all leads associated with this campaign
            const { error: leadsError } = await supabase.from('leads').delete().eq('campaign_id', campaignId);
            if (leadsError) {
                addToast("Erreur lors de la suppression des prospects : " + leadsError.message, "error");
                return;
            }

            const { error: campaignError } = await supabase.from('campaigns').delete().eq('id', campaignId);
            if (campaignError) {
                addToast("Erreur lors de la suppression de la campagne : " + campaignError.message, "error");
            } else {
                addToast("Campagne et prospects associés supprimés.", "info");
                setCampaigns(prev => prev.filter(c => c.id !== campaignId));
                setLeads(prev => prev.filter(l => l.campaignId !== campaignId));
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
            addToast("Erreur lors de la migration : " + error.message, "error");
        } else {
            addToast(`Prospects migrés vers "${target.name}" avec succès.`, "success");
            if (onRefresh) onRefresh();
        }
    };

    const handleDeleteLead = async (id: string) => {
        const confirmed = await showConfirm("Supprimer le prospect", "Êtes-vous sûr de vouloir supprimer ce prospect ? Cette action est irréversible.", "error");
        if (confirmed) {
            setLeads(prev => prev.filter(l => l.id !== id));
            supabase.from('leads').delete().eq('id', id).then(() => addToast("Prospect supprimé.", "info"));
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
        const campaignLeads = leads.filter(l => l.campaignId === campaign.id);
        const mappings = campaign.column_mappings || [
            { field: 'firstName', label: 'Prénom' },
            { field: 'lastName', label: 'Nom' },
            { field: 'email', label: 'Email' },
            { field: 'phone', label: 'Téléphone' },
            { field: 'statusId', label: 'Statut' }
        ];


        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button onClick={() => handleSelectCampaign(null)} className="btn" style={{ color: 'var(--text-muted)' }}>
                        <ArrowLeft size={16} /> Retour
                    </button>
                </div>

                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>{campaign.name}</h1>
                            <button 
                                onClick={() => handleEditCampaign(campaign.id, campaign.name)}
                                className="btn" 
                                style={{ 
                                    padding: '4px', 
                                    minWidth: 'auto', 
                                    background: 'transparent', 
                                    color: 'var(--text-muted)',
                                    opacity: 0.6
                                }}
                                title="Modifier le nom"
                            >
                                <Edit2 size={16} />
                            </button>
                        </div>
                        <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Source: {campaign.source}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <button onClick={() => handleMigrateCampaign(campaign.id)} className="btn" title="Migrer les prospects" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white' }}>
                                <Repeat size={18} />
                            </button>
                            <button onClick={() => handleDeleteCampaign(campaign.id)} className="btn" title="Supprimer la campagne" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                <Trash2 size={18} />
                            </button>
                            <button onClick={downloadTemplate} className="btn" title="Modèle d'importation" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white' }}>
                                <Download size={18} />
                            </button>
                            <button onClick={() => setIsExportModalOpen(true)} className="btn" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Download size={18} /> Exporter
                            </button>

                            <div style={{ position: 'relative' }}>
                                <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => handleImport(e, campaign.id)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Upload size={18} /> Importer Prospects</button>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'rgba(99, 102, 241, 0.03)', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Database size={14} /> Structure du fichier (Headers exacts)
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                                    {mappings.map(m => (
                                        <div key={m.field} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <code style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.875rem', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 600 }}>
                                                {m.label}
                                            </code>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                                {AVAILABLE_FIELDS.find(f => f.value === m.field)?.label || m.field}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', fontStyle: 'italic' }}>
                                    Note: Votre fichier Excel doit utiliser exactement ces noms de colonnes pour être importé correctement.
                                </p>
                            </div>

                        </div>
                    </div>
                </div>

                <div className="card" style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: mappings.length > 5 ? `${mappings.length * 150}px` : '1000px' }}>
                        <thead>
                            <tr>
                                {mappings.map((m, i) => (
                                    <th key={i}>{m.label}</th>
                                ))}
                                <th style={{ width: '80px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaignLeads.map((lead) => (
                                <tr key={lead.id}>
                                    {mappings.map((m, i) => {
                                        let value: any = '';
                                        const standardFields = ['firstName', 'lastName', 'email', 'phone', 'country', 'city', 'fieldOfInterest', 'level', 'notes', 'statusId', 'score'];
                                        
                                        if (standardFields.includes(m.field)) {
                                            if (m.field === 'statusId') {
                                                return (
                                                    <td key={i}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            color: lead.status?.color || 'white',
                                                            background: `${lead.status?.color}22`
                                                        }}>
                                                            {lead.status?.label || lead.statusId}
                                                        </span>
                                                    </td>
                                                );
                                            }
                                            if (m.field === 'notes') {
                                                return <td key={i}>{lead.notes || ''}</td>;
                                            }
                                            value = (lead as any)[m.field];
                                        } else {
                                            value = lead.metadata?.[m.field] || '';
                                        }

                                        return <td key={i}>{value}</td>;
                                    })}
                                    <td>
                                        <button onClick={() => handleDeleteLead(lead.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {campaignLeads.length === 0 && (
                                <tr>
                                    <td colSpan={mappings.length + 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        Aucun prospect dans cette campagne.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Campagnes Marketing</h1>
                <button onClick={() => setIsAddCampaignModalOpen(true)} className="btn btn-primary"><Target size={18} /> Créer</button>
            </div>

            <AddCampaignModal 
                isOpen={isAddCampaignModalOpen}
                onClose={() => setIsAddCampaignModalOpen(false)}
                onSave={handleAddCampaign}
            />


            <div className="stat-grid">
                <div className="card">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Efficacité Globale (Inscrits)</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{leads.length > 0 ? (leads.filter(l => l.statusId === 'inscrit').length / leads.length * 100).toFixed(1) : 0}%</h3>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {campaigns.map((campaign) => (
                    <div key={campaign.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{campaign.name}</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Source: {campaign.source}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => handleDeleteCampaign(campaign.id)} className="btn" style={{ color: '#ef4444', padding: '8px' }}>
                                <Trash2 size={16} />
                            </button>
                            <button onClick={() => handleSelectCampaign(campaign.id)} className="btn">Détails</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Campaigns;
