import React, { useState } from 'react';
import {
    Target,
    Trash2,
    Plus,
    ArrowRight,
    ArrowLeft,
    Facebook,
    Search,
    Linkedin,
    Instagram,
    TrendingUp,
    Database,
    Upload,
    Download,
    Edit2,
    Repeat,
    ChevronLeft,
    ChevronRight
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
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // FILTRE DE SÉCURITÉ : Les agents ne voient que LEURS campagnes 🎓
    const isAdmin = profile?.role === 'admin';
    const displayedCampaigns = isAdmin ? campaigns : campaigns.filter(c => leads.some(l => l.campaignId === c.id && l.agentId === profile.id));

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
    const validateCSV = (rows: any[][], campaign: Campaign, worksheet?: XLSX.WorkSheet): { valid: boolean; errors: string[]; leads: any[] } => {
        const errors: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const importedLeads: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalize = (s: any) => s ? s.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

        // --- AMÉLIORATION : Détection intelligente de la ligne d'en-tête ---
        let headerRowIdx = 0;
        // On cherche la première ligne qui a au moins 2 colonnes remplies (pour éviter les lignes de titre vides)
        while (headerRowIdx < rows.length && (!rows[headerRowIdx] || rows[headerRowIdx].filter(c => c !== null && c !== undefined && String(c).trim() !== "").length < 2)) {
            headerRowIdx++;
        }

        const headers = (rows[headerRowIdx] || []).map(h => normalize(h));

        // Use custom mappings if available, otherwise fallback to default
        const mappings = campaign.column_mappings || [
            { field: 'firstName', label: 'Prénom' },
            { field: 'lastName', label: 'Nom' },
            { field: 'email', label: 'Email' },
            { field: 'phone', label: 'Téléphone' }
        ];

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

        const currentLeadsForAssignment = [...leads];

        rows.slice(headerRowIdx + 1).forEach((rawCols, rowIndex) => {
            if (!rawCols || rawCols.length === 0) return;

            const getVal = (field: string) => {
                const idx = fieldToIdx[field];
                if (idx === undefined || idx === -1 || idx >= rawCols.length) return "";

                let val = rawCols[idx];

                // --- RÉCUPÉRATION DE SAUVETAGE SI ERREUR ---
                // Si la valeur est une erreur Excel (#ERROR!), on tente de lire la formule brute
                if (val === '#ERROR!' && worksheet) {
                    // rowIndex here is relative to the sliced array, so we need to add headerRowIdx + 1
                    const absoluteRowIndex = headerRowIdx + 1 + rowIndex;
                    const address = XLSX.utils.encode_cell({ r: absoluteRowIndex, c: idx });
                    const cell = worksheet[address];
                    if (cell && cell.f) {
                        // Si c'est une formule type ="771234567", on extrait le contenu
                        val = cell.f.replace(/^[\s=]+/, '').replace(/^"(.*)"$/, '$1');
                    }
                }

                if (val === null || val === undefined) return "";

                let strVal = String(val).trim();
                // Nettoyage agressif des résidus de calcul Excel
                if (strVal.startsWith('=') || strVal.startsWith('+=')) {
                    strVal = strVal.replace(/^[+=]+/, '').trim();
                }
                return strVal;
            };

            let email = getVal('email');
            const normEmail = normalize(email);

            // --- AMÉLIORATION : Skip les lignes qui sont des répétitions d'en-têtes ---
            if (normEmail === 'email' || normEmail === 'adresse e-mail' || normEmail === 'mail') return;

            // On vérifie si la ligne est vraiment vide avant de crier à l'erreur
            const hasAnySignificantData = rawCols.some(c => c !== null && c !== undefined && String(c).trim().length > 1);
            if (!hasAnySignificantData) return;

            const phoneRaw = getVal('phone') || "";

            // --- AMÉLIORATION : Email optionnel (Placeholder si vide) ---
            if (!email || !email.includes('@')) {
                const hasName = getVal('firstName') || getVal('lastName');
                if (hasName || phoneRaw) {
                    const phoneId = phoneRaw.replace(/\D/g, '') || Math.random().toString(36).substring(7);
                    email = `prospect-${phoneId}@elite-placeholder.com`;
                } else {
                    return;
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const metadata: Record<string, any> = {};
            mappings.forEach(m => {
                const standardFields = ['firstName', 'lastName', 'email', 'phone', 'country', 'city', 'fieldOfInterest', 'level', 'notes', 'statusId', 'score'];
                if (!standardFields.includes(m.field)) {
                    metadata[m.field] = getVal(m.field);
                }
            });

            const assignedAgent = getBestAgentForLead(agents, currentLeadsForAssignment);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newLead: any = {
                first_name: getVal('firstName') || '',
                last_name: getVal('lastName') || '',
                email: email,
                phone: getVal('phone') || '',
                country: getVal('country') || '',
                city: getVal('city') || '',
                field_of_interest: getVal('fieldOfInterest') || '',
                study_level: getVal('level') || '',
                status_id: (getVal('statusId') || 'nouveau').toLowerCase(),
                notes: getVal('notes') || '',
                metadata: metadata,
                campaign_id: campaign.id,
                agent_id: assignedAgent?.id,
                organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
            };

            importedLeads.push(newLead);
            currentLeadsForAssignment.push({
                id: `tmp-${rowIndex}`,
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            const workbook = XLSX.read(data, {
                type: 'array',
                cellFormula: true, // IMPORTANT: Lire les formules pour pouvoir les analyser en cas d'erreur
                cellText: true
            });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                raw: true, // Lire la valeur réelle (v)
                defval: ''
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any[][];

            const campaign = campaigns.find(c => c.id === campaignId);
            if (!campaign) return;

            const result = validateCSV(rows, campaign, worksheet);

            if (!result.valid) {
                addToast(`Erreur de format : ${result.errors.join(', ')}`, "error");
                console.error("Validation errors:", result.errors);
            } else if (result.leads.length === 0) {
                addToast("Le fichier semble vide ou ne contient aucun prospect valide.", "error");
            } else {
                let sanitizedLeads = sanitizeForPostgres(result.leads);

                // --- DÉDUPLICATION LOCALE (Évite l'erreur 'cannot affect row a second time') ---
                // Si le fichier contient plusieurs fois le même email, on ne garde que le dernier
                const uniqueLeadsMap = new Map();
                sanitizedLeads.forEach(l => uniqueLeadsMap.set(l.email, l));
                sanitizedLeads = Array.from(uniqueLeadsMap.values());

                // --- STRATÉGIE DE SAUVETAGE (UPSERT MANUEL) ---
                // On récupère les emails existants pour savoir quoi mettre à jour vs quoi insérer
                const { data: existingLeads } = await supabase
                    .from('leads')
                    .select('id, email')
                    .in('email', sanitizedLeads.map(l => l.email));

                const existingEmailsMap = new Map(existingLeads?.map(l => [l.email, l.id]));

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const toInsert: any[] = [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const toUpdate: any[] = [];

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                sanitizedLeads.forEach((lead: any) => {
                    const existingId = existingEmailsMap.get(lead.email);
                    if (existingId) {
                        toUpdate.push({ ...lead, id: existingId });
                    } else {
                        toInsert.push(lead);
                    }
                });

                let globalError = null;

                // 1. Insertion des nouveaux
                if (toInsert.length > 0) {
                    const { error } = await supabase.from('leads').insert(toInsert);
                    if (error) globalError = error;
                }

                // 2. Mise à jour des existants (Upsert par ID, qui est toujours une contrainte unique)
                if (toUpdate.length > 0) {
                    const { error } = await supabase.from('leads').upsert(toUpdate);
                    if (error) globalError = error;
                }

                if (globalError) {
                    addToast("Erreur lors de l'importation : " + globalError.message, "error");
                } else {
                    addToast(`${sanitizedLeads.length} prospects traités (${toInsert.length} nouveaux, ${toUpdate.length} mis à jour) !`, "success");
                    if (onRefresh) await onRefresh();
                }
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            .insert(sanitizeForPostgres({
                name: campaignData.name,
                source: campaignData.source,
                column_mappings: campaignData.column_mappings,
                agent_id: selectedA.id,
                start_date: new Date().toISOString(),
                organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
            }))
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
                addToast("Erreur : " + (error as Error).message, "error");
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
                addToast("Erreur lors de la modification : " + (error as Error).message, "error");
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
        const campaignLeads = isAdmin
            ? leads.filter(l => l.campaignId === campaign.id)
            : leads.filter(l => l.campaignId === campaign.id && l.agentId === profile.id);
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>{campaign.name}</h1>
                            {isAdmin && (
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
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                            <div style={{
                                padding: '4px 12px',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}> SOURCE : {campaign.source.toUpperCase()} </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 800 }}>
                                {campaignLeads.length} PROSPECTS AU TOTAL
                            </div>
                        </div>
                    </div>
                    {isAdmin && (
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <button onClick={() => handleMigrateCampaign(campaign.id)} className="btn" title="Migrer les prospects" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white', padding: '10px' }}>
                                <Repeat size={18} />
                            </button>
                            <button onClick={() => handleClearCampaignLeads(campaign.id)} className="btn" title="Vider tous les prospects" style={{ background: 'rgba(239, 68, 68, 0.05)', color: '#f87171', padding: '10px 15px' }}>
                                <Trash2 size={18} />
                                <span style={{ marginLeft: '6px', fontSize: '0.85rem', fontWeight: 800 }}>Vider</span>
                            </button>
                            <button onClick={() => handleDeleteCampaign(campaign.id)} className="btn" title="Supprimer la campagne" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px' }}>
                                <Trash2 size={18} />
                            </button>
                            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)', margin: '0 5px' }}></div>
                        </div>
                    )}
                    <button onClick={() => setIsExportModalOpen(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }}>
                        <Download size={18} /> Exporter
                    </button>
                </div>

                <div className="card" style={{ marginBottom: '2rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                Colonnes mappées : <span style={{ color: 'white' }}>{mappings.length}</span>
                            </div>
                            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }}></div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 800 }}>
                                {campaignLeads.filter(l => {
                                    const sid = (l.statusId || '').toLowerCase();
                                    const slabel = (l.status?.label || '').toLowerCase();
                                    return ['admis', 'inscrit', 'confirme'].some(k => sid.includes(k) || slabel.includes(k));
                                }).length} Inscrits
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            {isAdmin && (
                                <div style={{ position: 'relative' }}>
                                    <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => handleImport(e, campaign.id)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                                    <button className="btn" style={{ background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px' }}><Upload size={16} /> Importer Prospects</button>
                                </div>
                            )}
                            <button onClick={downloadTemplate} className="btn" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '8px 16px', borderRadius: '10px' }}>
                                <Download size={16} /> Télécharger Modèle
                            </button>
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                {mappings.map((m, i) => (
                                    <th key={i}>{m.label}</th>
                                ))}
                                <th style={{ width: '80px' }}>Actions</th>
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
                                                const truncatedNotes = lead.notes ? (lead.notes.length > 30 ? lead.notes.substring(0, 30) + "..." : lead.notes) : "";
                                                return <td key={i} title={lead.notes}>{truncatedNotes}</td>;
                                            }
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            value = (lead as any)[m.field];
                                        } else {
                                            value = lead.metadata?.[m.field] || '';
                                        }

                                        return <td key={i}>{value}</td>;
                                    })}
                                    <td>
                                        {isAdmin && (
                                            <button onClick={() => handleDeleteLead(lead.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        )}
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

                {/* PAGINATION ELITE */}
                {(() => {
                    const totalPages = Math.ceil(campaignLeads.length / itemsPerPage);
                    return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', padding: '0 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Afficher</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    className="input"
                                    style={{ padding: '0 10px', borderRadius: '12px', height: '40px', minWidth: '120px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)' }}
                                >
                                    {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v} par page</option>)}
                                </select>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>sur {campaignLeads.length} prospects</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                    style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === 1 ? 'rgba(255,255,255,0.1)' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center', transition: 'all 0.2s' }}
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.1rem' }}>{currentPage}</span>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>/</span>
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{totalPages || 1}</span>
                                </div>

                                <button
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: (currentPage === totalPages || totalPages === 0) ? 'rgba(255,255,255,0.1)' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center', transition: 'all 0.2s' }}
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    );
                })()}

                <LeadExportModal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    onExport={handleExport}
                />
            </div>

        );
    }

    return (
        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* HERO SECTION - STRATEGY CENTER */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(34, 211, 238, 0.1))',
                borderRadius: '32px',
                padding: window.innerWidth < 768 ? '1.5rem' : '3rem',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '2rem'
            }}>
                <div style={{ flex: '1 1 300px' }}>
                    <h1 style={{ fontSize: window.innerWidth < 768 ? '2rem' : '3.5rem', fontWeight: 950, letterSpacing: '-0.05em', marginBottom: '0.5rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Centre Stratégique <br /> des Campagnes
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem', maxWidth: '500px' }}>
                        Pilotez vos sources d'acquisition et analysez le ROI de chaque canal en temps réel.
                    </p>
                </div>

                <div className="stat-grid" style={{ flex: '1 1 400px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        <div style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}><Target size={24} /></div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900 }}>{displayedCampaigns.length}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>{isAdmin ? 'Total Sources' : 'Mes Sources'}</div>
                    </div>
                    <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        <div style={{ color: 'var(--success)', marginBottom: '0.5rem' }}><TrendingUp size={24} /></div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900 }}>
                            {(() => {
                                const relevantLeads = isAdmin ? leads : leads.filter(l => l.agentId === profile?.id);
                                return relevantLeads.length > 0 ? Math.round((relevantLeads.filter(l => ['inscrit', 'inscription_confirmee', 'inscription_attente', 'admis'].some(k => (l.statusId || '').toLowerCase() === k)).length / relevantLeads.length * 100)) : 0;
                            })()}%
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Taux Conversion</div>
                    </div>
                    <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                        <div style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}><Database size={24} /></div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900 }}>{isAdmin ? leads.length : leads.filter(l => l.agentId === profile?.id).length}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>{isAdmin ? 'Lead Total' : 'Mes Prospects'}</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 850, letterSpacing: '-0.03em' }}>{isAdmin ? 'Toutes les Sources' : 'Mes Campagnes Assignées'}</h2>
                {isAdmin && (
                    <button
                        onClick={() => setIsAddCampaignModalOpen(true)}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem 2rem', borderRadius: '16px', fontWeight: 800, fontSize: '1rem' }}
                    >
                        <Plus size={20} /> Nouvelle Campagne
                    </button>
                )}
            </div>

            <AddCampaignModal
                isOpen={isAddCampaignModalOpen}
                onClose={() => setIsAddCampaignModalOpen(false)}
                onSave={handleAddCampaign}
            />

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' }}>
                {displayedCampaigns.map((campaign) => {
                    const cLeads = isAdmin
                        ? leads.filter(l => l.campaignId === campaign.id)
                        : leads.filter(l => l.campaignId === campaign.id && l.agentId === profile?.id);
                    const totalLeads = cLeads.length;
                    const inscribedKeywords = ['inscrit', 'inscription_confirmee', 'inscription_attente', 'admis'];
                    const inscritLeads = cLeads.filter(l => inscribedKeywords.some(k => (l.statusId || '').toLowerCase() === k)).length;
                    const cRate = totalLeads > 0 ? Math.round((inscritLeads / totalLeads) * 100) : 0;

                    // Phase Calculation for "Classification" visual
                    const getCount = (keys: string[]) => cLeads.filter(l => keys.some(k => (l.statusId || '').toLowerCase() === k)).length;
                    const qCount = getCount(['nouveau', 'injoignable', 'repondeur', 'faux_numero', 'hors_cible', 'refus_categorique', 'refus_repondre', 'pas_interesse', 'inscrit_ailleurs', 'pas_moyens', 'annee_prochaine', 'pas_disponible']);
                    const iCount = getCount(['interesse', 'rappel', 'reflexion', 'reorientation']);
                    const canCount = getCount(['rdv_planifie', 'dossier_recu']);
                    const admCount = getCount(['admis', 'inscription_attente', 'inscrit', 'inscription_confirmee']);

                    // Logic to detect source icon
                    const src = (campaign.source || '').toLowerCase();
                    let SourceIcon = Target;
                    let iconColor = 'var(--primary)';
                    if (src.includes('facebook') || src.includes('meta')) { SourceIcon = Facebook; iconColor = '#1877F2'; }
                    else if (src.includes('google')) { SourceIcon = Search; iconColor = '#4285F4'; }
                    else if (src.includes('linkedin')) { SourceIcon = Linkedin; iconColor = '#0A66C2'; }
                    else if (src.includes('instagram')) { SourceIcon = Instagram; iconColor = '#E4405F'; }

                    return (
                        <div key={campaign.id} className="card" style={{
                            position: 'relative',
                            padding: '2rem',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: 'pointer',
                        }} onClick={() => handleSelectCampaign(campaign.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div style={{
                                    width: '52px',
                                    height: '52px',
                                    borderRadius: '16px',
                                    background: `${iconColor}15`,
                                    border: `1px solid ${iconColor}30`,
                                    display: 'grid',
                                    placeItems: 'center'
                                }}>
                                    <SourceIcon size={26} color={iconColor} />
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 950 }}>{cLeads.length}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Prospects</div>
                                </div>
                            </div>

                            <h3 style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>{campaign.name}</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontWeight: 500 }}>Source: <span style={{ color: 'white', fontWeight: 700 }}>{campaign.source}</span></p>

                            <div style={{ marginTop: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.6rem', fontWeight: 750 }}>
                                    <span>Taux de conversion</span>
                                    <span style={{ color: 'var(--success)' }}>{cRate}%</span>
                                </div>
                                <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${cRate}%`,
                                        background: `linear-gradient(to right, ${iconColor}, var(--success))`,
                                        borderRadius: '10px',
                                        transition: 'width 1s ease-out'
                                    }}></div>
                                </div>
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
                                {isAdmin && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(campaign.id); }}
                                        className="btn"
                                        style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '0.5rem', flex: 0 }}
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
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{isAdmin ? 'Commencez par créer votre première source d\'acquisition de prospects.' : 'Aucune campagne ne vous est assignée pour le moment.'}</p>
                    {isAdmin && (
                        <button onClick={() => setIsAddCampaignModalOpen(true)} className="btn btn-primary" style={{ padding: '0.8rem 2.5rem', borderRadius: '16px' }}>+ Nouvelle Campagne</button>
                    )}
                </div>
            )}
        </div>
    );
};

export default Campaigns;
