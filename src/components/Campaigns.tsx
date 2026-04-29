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
    ChevronRight,
    Users,
    X,
    Settings
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
    const [assignmentMode, setAssignmentMode] = useState<'auto' | 'selected'>('auto');
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [showSheetsSetup, setShowSheetsSetup] = useState(false);
    const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);

    // FILTRE DE SÉCURITÉ : Les agents ne voient que LEURS campagnes 🎓
    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'super_agent';
    const isObserver = profile?.role === 'observer';
    const canSeeAll = isAdmin || isObserver;
    const displayedCampaigns = canSeeAll ? campaigns : campaigns.filter(c => leads.some(l => l.campaignId === c.id && l.agentId === profile?.id));

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
    const validateCSV = (rows: any[][], campaign: Campaign, worksheet?: XLSX.WorkSheet, assignConfig?: { mode: 'auto' | 'selected'; agentIds: string[] }): { valid: boolean; errors: string[]; leads: any[] } => {
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
                const standardFields = ['firstName', 'lastName', 'email', 'phone', 'country', 'city', 'fieldOfInterest', 'level', 'notes', 'statusId'];
                if (!standardFields.includes(m.field)) {
                    metadata[m.field] = getVal(m.field);
                }
            });

            // --- ASSIGNATION AVEC MODE CONFIGURABLE ---
            let assignedAgent;
            if (assignConfig?.mode === 'selected' && assignConfig.agentIds.length > 0) {
                // Round-robin parmi les agents sélectionnés
                const targetAgents = agents.filter(a => assignConfig.agentIds.includes(a.id));
                const idx = importedLeads.length % targetAgents.length;
                assignedAgent = targetAgents[idx];
            } else {
                // Auto-équilibrage par charge (comportement par défaut)
                assignedAgent = getBestAgentForLead(agents, currentLeadsForAssignment);
            }

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

            const result = validateCSV(rows, campaign, worksheet, { mode: assignmentMode, agentIds: selectedAgentIds });

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
    const handleAddCampaign = async (campaignData: { 
        name: string; 
        source: string; 
        column_mappings: any[];
        assignment_mode: 'auto' | 'fixed';
        assigned_agent_ids: string[];
    }) => {
        if (!agents || agents.length === 0) {
            addToast("Attention : Vous devez d'abord ajouter au moins un agent pour pouvoir créer une campagne.", "error");
            return;
        }

        const selectedA = getBestAgentForLead(agents, leads);
        
        const payload = sanitizeForPostgres({
            name: campaignData.name,
            source: campaignData.source,
            column_mappings: campaignData.column_mappings,
            assignment_mode: campaignData.assignment_mode,
            assigned_agent_ids: campaignData.assigned_agent_ids,
            agent_id: selectedA?.id || agents[0].id, // fallback agent par défaut
            start_date: new Date().toISOString(),
            organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
        });

        const { data, error } = await supabase
            .from('campaigns')
            .insert(payload)
            .select().single();

        if (error) {
            // Fallback si les colonnes n'existent pas encore
            if (error.code === '42703') {
                 const { data: retryData, error: retryError } = await supabase
                    .from('campaigns')
                    .insert(sanitizeForPostgres({
                        name: campaignData.name,
                        source: campaignData.source,
                        agent_id: selectedA?.id || agents[0].id,
                        start_date: new Date().toISOString(),
                        organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
                    }))
                    .select().single();

                if (retryError) {
                    addToast("Erreur lors de la création : " + retryError.message, "error");
                } else if (retryData) {
                    addToast("Campagne créée ! (Certaines options d'attribution n'ont pu être enregistrées)", "warning");
                    if (onRefresh) await onRefresh();
                    if (campaignData.source === 'Google Sheets') {
                        setCreatedCampaignId(retryData.id);
                        setShowSheetsSetup(true);
                    }
                }
            } else {
                addToast("Erreur : " + error.message, "error");
            }
        } else if (data) {
            addToast(`Campagne "${data.name}" créée avec succès.`, "success");
            if (onRefresh) await onRefresh();

            if (campaignData.source === 'Google Sheets') {
                setCreatedCampaignId(data.id);
                setShowSheetsSetup(true);
            }
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
                    const standardFields = ['firstName', 'lastName', 'email', 'phone', 'country', 'city', 'fieldOfInterest', 'level', 'notes', 'statusId'];
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
        const campaignLeads = canSeeAll
            ? leads.filter(l => l.campaignId === campaign.id)
            : leads.filter(l => l.campaignId === campaign.id && l.agentId === profile?.id);
        const mappings = campaign.column_mappings || [
            { field: 'firstName', label: 'Prénom' },
            { field: 'lastName', label: 'Nom' },
            { field: 'email', label: 'Email' },
            { field: 'phone', label: 'Téléphone' },
            { field: 'statusId', label: 'Statut' }
        ];

        return (
            <div className="animate-fade">
                {/* Navigation Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <button onClick={() => handleSelectCampaign(null)} className="btn btn-ghost" style={{ padding: '8px 12px', height: 'auto' }}>
                        <ArrowLeft size={16} /> Retour aux sources
                    </button>
                    <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Gestion de campagne</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', gap: '2rem' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', display: 'grid', placeItems: 'center', color: 'var(--primary)' }}>
                                <Target size={28} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.03em', color: 'white' }}>{campaign.name}</h1>
                                    {isAdmin && (
                                        <button onClick={() => handleEditCampaign(campaign.id, campaign.name)} className="btn btn-ghost" style={{ padding: '6px', height: 'auto', minWidth: 'auto', opacity: 0.5 }}>
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                                    <span className="badge badge-primary" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>{campaign.source}</span>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>{campaignLeads.length} prospects enregistrés</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {isAdmin && (
                            <>
                                <button onClick={() => handleMigrateCampaign(campaign.id)} className="btn btn-ghost" title="Transférer les prospects">
                                    <Repeat size={18} />
                                </button>
                                <button onClick={() => handleClearCampaignLeads(campaign.id)} className="btn btn-ghost" style={{ color: 'var(--danger)' }} title="Vider la base">
                                    <Trash2 size={18} />
                                </button>
                                <button onClick={() => handleDeleteCampaign(campaign.id)} className="btn btn-ghost" style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }} title="Supprimer la campagne">
                                    <Trash2 size={18} />
                                </button>
                                <div style={{ width: '1px', height: '40px', background: 'var(--border)', margin: '0 0.5rem' }} />
                            </>
                        )}
                        <button onClick={() => setIsExportModalOpen(true)} className="btn btn-primary" style={{ height: '44px', padding: '0 1.5rem' }}>
                            <Download size={18} /> Exporter
                        </button>
                    </div>
                </div>

                {/* Import & Info Bar */}
                <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem 2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
                            <div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '4px' }}>Colonnes</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700 }}>{mappings.length} mappées</div>
                            </div>
                            <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
                            <div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '4px' }}>Succès</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success)' }}>
                                    {campaignLeads.filter(l => {
                                        const sid = (l.statusId || '').toLowerCase();
                                        const slabel = (l.status?.label || '').toLowerCase();
                                        return ['admis', 'inscrit', 'confirme'].some(k => sid.includes(k) || slabel.includes(k));
                                    }).length} convertis
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {isAdmin && (
                                <button 
                                    onClick={() => setIsImportModalOpen(true)} 
                                    className="btn btn-primary" 
                                    style={{ background: 'var(--primary)', boxShadow: '0 4px 15px var(--primary-glow)' }}
                                >
                                    <Upload size={16} /> Importer Prospects
                                </button>
                            )}
                            <button onClick={downloadTemplate} className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}>
                                <Download size={16} /> Modèle Excel
                            </button>
                        </div>
                    </div>
                </div>

                {/* Lead Import Modal */}
                {isImportModalOpen && (
                    <div className="modal-overlay" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.85)', display: 'grid', placeItems: 'center',
                        zIndex: 1000, backdropFilter: 'blur(8px)'
                    }}>
                        <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '600px', padding: '2.5rem', position: 'relative', border: '1px solid var(--border)' }}>
                            <button onClick={() => setIsImportModalOpen(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>

                            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                                <div style={{ width: '64px', height: '64px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '20px', display: 'grid', placeItems: 'center', margin: '0 auto 1.5rem', color: 'var(--primary)' }}>
                                    <Upload size={32} />
                                </div>
                                <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem' }}>Importer des Prospects</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Configurez votre stratégie d'assignation avant de charger votre fichier.</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {/* Assignment Section */}
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '1rem' }}>
                                        1. Stratégie d'Assignation
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div 
                                            onClick={() => setAssignmentMode('auto')}
                                            style={{ 
                                                padding: '1.25rem', borderRadius: '16px', border: `1px solid ${assignmentMode === 'auto' ? 'var(--primary)' : 'var(--border)'}`,
                                                background: assignmentMode === 'auto' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255,255,255,0.02)',
                                                cursor: 'pointer', transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <div style={{ fontWeight: 800, color: assignmentMode === 'auto' ? 'white' : 'var(--text-muted)', marginBottom: '4px' }}>Auto-équilibrage IA</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Répartition basée sur la charge actuelle des agents.</div>
                                        </div>
                                        <div 
                                            onClick={() => { setAssignmentMode('selected'); if (selectedAgentIds.length === 0) setSelectedAgentIds(agents.map(a => a.id)); }}
                                            style={{ 
                                                padding: '1.25rem', borderRadius: '16px', border: `1px solid ${assignmentMode === 'selected' ? 'var(--primary)' : 'var(--border)'}`,
                                                background: assignmentMode === 'selected' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255,255,255,0.02)',
                                                cursor: 'pointer', transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <div style={{ fontWeight: 800, color: assignmentMode === 'selected' ? 'white' : 'var(--text-muted)', marginBottom: '4px' }}>Sélection Manuelle</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Round-robin entre les agents de votre choix.</div>
                                        </div>
                                    </div>

                                    {assignmentMode === 'selected' && (
                                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Agents Cibles ({selectedAgentIds.length})</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {agents.map(agent => {
                                                    const isSelected = selectedAgentIds.includes(agent.id);
                                                    return (
                                                        <button
                                                            key={agent.id}
                                                            onClick={() => setSelectedAgentIds(prev => isSelected ? prev.filter(id => id !== agent.id) : [...prev, agent.id])}
                                                            style={{
                                                                padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                                                                border: '1px solid ' + (isSelected ? 'var(--primary)' : 'var(--border)'),
                                                                background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                                                color: isSelected ? 'white' : 'var(--text-muted)',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {agent.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* File Selection Section */}
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '1rem' }}>
                                        2. Sélection du Fichier
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="file" 
                                            accept=".csv, .xlsx, .xls" 
                                            onChange={async (e) => {
                                                await handleImport(e, campaign.id);
                                                setIsImportModalOpen(false);
                                            }} 
                                            style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 2 }} 
                                        />
                                        <div className="btn btn-primary" style={{ width: '100%', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', borderRadius: '16px', fontSize: '1rem', fontWeight: 800 }}>
                                            <Upload size={20} /> Sélectionner & Lancer l'Import
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Accepte les fichiers .csv, .xlsx et .xls
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Leads Table */}
                <div className="table-container card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table>
                        <thead>
                            <tr>
                                {mappings.map((m, i) => <th key={i}>{m.label}</th>)}
                                <th style={{ width: '80px', textAlign: 'right', paddingRight: '2rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const startIndex = (currentPage - 1) * itemsPerPage;
                                return campaignLeads.slice(startIndex, startIndex + itemsPerPage);
                            })().map((lead) => (
                                <tr key={lead.id}>
                                    {mappings.map((m, i) => {
                                        const standardFields = ['firstName', 'lastName', 'email', 'phone', 'country', 'city', 'fieldOfInterest', 'level', 'notes', 'statusId'];
                                        if (standardFields.includes(m.field)) {
                                            if (m.field === 'statusId') {
                                                return (
                                                    <td key={i}>
                                                        <span style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: lead.status?.color || 'white', background: `${lead.status?.color}15`, border: `1px solid ${lead.status?.color}30` }}>
                                                            {lead.status?.label || lead.statusId}
                                                        </span>
                                                    </td>
                                                );
                                            }
                                            if (m.field === 'notes') {
                                                return <td key={i} title={lead.notes} style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{lead.notes}</td>;
                                            }
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            return <td key={i} style={{ fontWeight: 600 }}>{(lead as any)[m.field]}</td>;
                                        }
                                        return <td key={i} style={{ color: 'var(--text-muted)' }}>{lead.metadata?.[m.field] || ''}</td>;
                                    })}
                                    <td style={{ textAlign: 'right', paddingRight: '2rem' }}>
                                        {isAdmin && (
                                            <button onClick={() => handleDeleteLead(lead.id)} className="btn btn-ghost" style={{ padding: '8px', minWidth: 'auto', color: 'var(--danger)' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {campaignLeads.length === 0 && (
                                <tr>
                                    <td colSpan={mappings.length + 1} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                            <Database size={40} style={{ opacity: 0.2 }} />
                                            <p style={{ fontWeight: 600 }}>Aucun prospect n'a été trouvé pour cette campagne.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {campaignLeads.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', padding: '0 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Afficher</span>
                            <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="input" style={{ width: 'auto', height: '36px', padding: '0 2rem 0 1rem' }}>
                                {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v} par page</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{Math.min(currentPage * itemsPerPage, campaignLeads.length)} sur {campaignLeads.length} prospects</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="btn btn-ghost" style={{ width: '40px', padding: 0, border: '1px solid var(--border)' }}><ChevronLeft size={20} /></button>
                                <div className="card" style={{ padding: '0 1rem', display: 'grid', placeItems: 'center', height: '40px', fontWeight: 900, color: 'var(--primary)', border: '1px solid var(--primary-glow)' }}>{currentPage}</div>
                                <button disabled={currentPage >= Math.ceil(campaignLeads.length / itemsPerPage)} onClick={() => setCurrentPage(p => p + 1)} className="btn btn-ghost" style={{ width: '40px', padding: 0, border: '1px solid var(--border)' }}><ChevronRight size={20} /></button>
                            </div>
                        </div>
                    </div>
                )}

                <LeadExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExport={handleExport} />
            </div>
        );
    }

    return (
        <div className="animate-fade">
            {/* HERO SECTION */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))',
                borderRadius: '32px',
                padding: '3.5rem',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                marginBottom: '3rem',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '3rem' }}>
                    <div style={{ flex: '1 1 400px' }}>
                        <div style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '100px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
                            Centre de pilotage CRM
                        </div>
                        <h1 style={{ fontSize: '3.5rem', fontWeight: 950, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1.5rem' }}>
                            Gestion des <span style={{ color: 'var(--primary)' }}>Campagnes</span> & Sources
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem', maxWidth: '540px', lineHeight: 1.6 }}>
                            Contrôlez l'acquisition de vos prospects, configurez vos pipelines et analysez la performance de conversion par canal.
                        </p>
                    </div>

                    <div className="stat-grid" style={{ flex: '1 1 500px', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.5rem' }}>
                        <div className="card glassmorphism" style={{ textAlign: 'center', padding: '1.5rem', borderRadius: '24px' }}>
                            <div style={{ color: 'var(--primary)', marginBottom: '0.75rem', display: 'grid', placeItems: 'center' }}><Target size={24} /></div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '4px' }}>{displayedCampaigns.length}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em' }}>Sources Actives</div>
                        </div>
                        <div className="card glassmorphism" style={{ textAlign: 'center', padding: '1.5rem', borderRadius: '24px' }}>
                            <div style={{ color: 'var(--success)', marginBottom: '0.75rem', display: 'grid', placeItems: 'center' }}><TrendingUp size={24} /></div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '4px' }}>
                                {(() => {
                                    const relevantLeads = canSeeAll ? leads : leads.filter(l => l.agentId === profile?.id);
                                    return relevantLeads.length > 0 ? Math.round((relevantLeads.filter(l => ['inscrit', 'inscription_confirmee', 'inscription_attente', 'admis'].some(k => (l.statusId || '').toLowerCase() === k)).length / relevantLeads.length * 100)) : 0;
                                })()}%
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em' }}>Conversion Global</div>
                        </div>
                        <div className="card glassmorphism" style={{ textAlign: 'center', padding: '1.5rem', borderRadius: '24px' }}>
                            <div style={{ color: 'var(--accent)', marginBottom: '0.75rem', display: 'grid', placeItems: 'center' }}><Users size={24} /></div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '4px' }}>{isAdmin ? leads.length : leads.filter(l => l.agentId === profile?.id).length}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em' }}>Prospects Total</div>
                        </div>
                    </div>
                </div>
                {/* Background decorative elements */}
                <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '40%', height: '100%', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)', filter: 'blur(60px)' }} />
            </div>

            {/* Campaign Grid Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 850, letterSpacing: '-0.02em', color: 'white' }}>{canSeeAll ? 'Toutes les Campagnes' : 'Mes Campagnes Assignées'}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>{displayedCampaigns.length} sources d'acquisition configurées</p>
                </div>
                {isAdmin && (
                    <button onClick={() => setIsAddCampaignModalOpen(true)} className="btn btn-primary" style={{ height: '52px', padding: '0 2rem', borderRadius: '16px', fontWeight: 800, fontSize: '1rem', boxShadow: '0 8px 25px var(--primary-glow)' }}>
                        <Plus size={22} /> Nouvelle Campagne
                    </button>
                )}
            </div>

            <AddCampaignModal
                isOpen={isAddCampaignModalOpen}
                onClose={() => setIsAddCampaignModalOpen(false)}
                agents={agents}
                onSave={handleAddCampaign}
            />

            {/* Google Sheets Setup Modal */}
            {showSheetsSetup && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)', display: 'grid', placeItems: 'center', zIndex: 1200, padding: '1rem' }}>
                    <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '32px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {/* Header */}
                        <div style={{ padding: '2rem 3rem', borderBottom: '1px solid var(--border)', background: 'rgba(99, 102, 241, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem' }}>🚀 Automatisation Google Sheets</h2>
                                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>Votre campagne est prête. Connectons votre fichier en 30 secondes.</p>
                            </div>
                            <button onClick={() => setShowSheetsSetup(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '12px', borderRadius: '14px', cursor: 'pointer' }}><X size={20} /></button>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '2.5rem 3rem', flex: 1, overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
                                {/* Steps */}
                                <div>
                                    <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1.5rem' }}>Guide d'installation</h4>
                                    
                                    {[
                                        { t: "Ouvrez votre fichier Google Sheet", d: "Allez sur le fichier que vous souhaitez connecter." },
                                        { t: "Extensions > Apps Script", d: "Dans le menu du haut, ouvrez l'éditeur de script." },
                                        { t: "Collez le code à droite", d: "Effacez tout ce qu'il y a et remplacez par le code ci-contre." },
                                        { t: "Enregistrez & Testez", d: "Cliquez sur la disquette. Vos nouveaux prospects apparaîtront ici !" }
                                    ].map((step, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>{i+1}</div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '2px' }}>{step.t}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{step.d}</div>
                                            </div>
                                        </div>
                                    ))}

                                    <div style={{ padding: '1.25rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', marginTop: '2rem' }}>
                                        <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <TrendingUp size={16} /> Mode Intelligent Activé
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Le script détectera automatiquement vos colonnes (Nom, Email, Téléphone...). Vous n'avez rien à configurer.
                                        </p>
                                    </div>
                                </div>

                                {/* Code Block */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px' }}>Code du Script</h4>
                                        <button 
                                            onClick={() => {
                                                const currentMappings = campaigns.find(c => c.id === createdCampaignId)?.column_mappings || [];
                                                const code = `// --- CONFIGURATION CRM ---\nconst SUPABASE_URL = "https://ryzgxhfwuxpvnoxvscbk.supabase.co";\nconst SUPABASE_KEY = "SECRET_KEY";\nconst ORG_ID = "${profile?.organization_id}";\nconst CAMPAIGN_ID = "${createdCampaignId}";\n\nconst MAPPINGS = ${JSON.stringify(currentMappings, null, 2)};\n\nfunction onFormSubmit(e) { ... (voir code ci-dessous) }`;
                                                navigator.clipboard.writeText(code);
                                                addToast("Code copié !", "success");
                                            }}
                                            className="btn btn-ghost" 
                                            style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                                        >
                                            Copier le code
                                        </button>
                                    </div>
                                    <div style={{ background: '#0f1115', borderRadius: '16px', border: '1px solid var(--border)', padding: '1.25rem', height: '320px', overflowY: 'auto' }}>
                                        <pre style={{ margin: 0, fontSize: '0.75rem', color: '#a5b4fc', fontFamily: 'monospace', lineHeight: 1.6 }}>
{`// --- CONFIGURATION CRM ---
const SUPABASE_URL = "https://ryzgxhfwuxpvnoxvscbk.supabase.co";
const SUPABASE_KEY = "SECRET_KEY"; // À REMPLACER PAR VOTRE CLÉ SUPABASE (SERVICE ROLE OU ANON)
const ORG_ID = "${profile?.organization_id}";
const CAMPAIGN_ID = "${createdCampaignId}";

// --- VOS RÉGLAGES DE MAPPING ---
const MAPPINGS = ${JSON.stringify(campaigns.find(c => c.id === createdCampaignId)?.column_mappings || [
    { field: 'firstName', label: 'Prénom' },
    { field: 'lastName', label: 'Nom' },
    { field: 'email', label: 'Email' },
    { field: 'phone', label: 'Téléphone' }
], null, 2)};

/**
 * Script d'automatisation dynamique basé sur vos colonnes
 */
function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().toLowerCase().trim());
  const data = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const leadData = {
    campaign_id: CAMPAIGN_ID,
    organization_id: ORG_ID,
    status_id: 'nouveau'
  };
  
  // Application du mapping personnalisé
  MAPPINGS.forEach(m => {
    const headerIdx = headers.indexOf(m.label.toLowerCase().trim());
    if (headerIdx !== -1) {
      const val = data[headerIdx];
      // Attribution dynamique du champ (snake_case pour Supabase)
      if (m.field === 'firstName') leadData.first_name = val;
      else if (m.field === 'lastName') leadData.last_name = val;
      else if (m.field === 'email') leadData.email = val;
      else if (m.field === 'phone') leadData.phone = val;
      else if (m.field === 'country') leadData.country = val;
      else if (m.field === 'city') leadData.city = val;
      else if (m.field === 'fieldOfInterest') leadData.field_of_interest = val;
      else if (m.field === 'level') leadData.study_level = val;
      else if (m.field === 'notes') leadData.notes = val;
      else leadData[m.field] = val; // Pour les champs personnalisés
    }
  });

  UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/leads", {
    method: "post",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    payload: JSON.stringify(leadData)
  });
}`}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '1.5rem 3rem', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
                            <button onClick={() => setShowSheetsSetup(false)} className="btn btn-primary" style={{ padding: '1rem 4rem', fontSize: '1rem', fontWeight: 800 }}>J'ai terminé l'installation</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign Cards Grid */}
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '2rem' }}>
                {displayedCampaigns.map((campaign) => {
                    const cLeads = canSeeAll ? leads.filter(l => l.campaignId === campaign.id) : leads.filter(l => l.campaignId === campaign.id && l.agentId === profile?.id);
                    const totalLeads = cLeads.length;
                    const inscritLeads = cLeads.filter(l => ['inscrit', 'inscription_confirmee', 'inscription_attente', 'admis'].some(k => (l.statusId || '').toLowerCase() === k)).length;
                    const cRate = totalLeads > 0 ? Math.round((inscritLeads / totalLeads) * 100) : 0;

                    const getCount = (keys: string[]) => cLeads.filter(l => keys.some(k => (l.statusId || '').toLowerCase() === k)).length;
                    const qCount = getCount(['nouveau', 'injoignable', 'repondeur', 'faux_numero', 'hors_cible']);
                    const iCount = getCount(['interesse', 'rappel', 'reflexion']);
                    const canCount = getCount(['rdv_planifie', 'dossier_recu']);
                    const admCount = getCount(['admis', 'inscription_attente', 'inscrit']);

                    const src = (campaign.source || '').toLowerCase();
                    let SourceIcon = Target;
                    let iconColor = 'var(--primary)';
                    if (src.includes('facebook') || src.includes('meta')) { SourceIcon = Facebook; iconColor = '#1877F2'; }
                    else if (src.includes('google')) { SourceIcon = Search; iconColor = '#4285F4'; }
                    else if (src.includes('linkedin')) { SourceIcon = Linkedin; iconColor = '#0A66C2'; }
                    else if (src.includes('instagram')) { SourceIcon = Instagram; iconColor = '#E4405F'; }

                    return (
                        <div key={campaign.id} className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', transition: 'transform 0.3s ease, border-color 0.3s ease', cursor: 'pointer', border: '1px solid var(--border)' }} onClick={() => handleSelectCampaign(campaign.id)} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-4px)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: `${iconColor}15`, border: `1px solid ${iconColor}25`, display: 'grid', placeItems: 'center', color: iconColor }}>
                                    <SourceIcon size={28} />
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 950, color: 'white' }}>{totalLeads}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prospects</div>
                                </div>
                            </div>

                            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.02em', color: 'white' }}>{campaign.name}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Source:</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>{campaign.source}</span>
                            </div>

                            <div style={{ marginTop: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 700 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Taux de conversion</span>
                                    <span style={{ color: 'var(--success)' }}>{cRate}%</span>
                                </div>
                                <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                                    <div style={{ height: '100%', width: `${cRate}%`, background: `linear-gradient(90deg, ${iconColor}, var(--success))`, borderRadius: '10px' }} />
                                </div>

                                {/* Mini Pipeline Breakdown */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                    {[
                                        { label: 'Qualif.', val: qCount, color: 'var(--warning)' },
                                        { label: 'Infos', val: iCount, color: 'var(--accent)' },
                                        { label: 'Cand.', val: canCount, color: 'var(--primary)' },
                                        { label: 'Admis', val: admCount, color: 'var(--success)' }
                                    ].map((p, idx) => (
                                        <div key={idx} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: p.val > 0 ? 'white' : 'var(--text-muted)' }}>{p.val}</div>
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginTop: '2px' }}>{p.label}</div>
                                            <div style={{ height: '3px', background: p.val > 0 ? p.color : 'rgba(255,255,255,0.05)', borderRadius: '10px', marginTop: '6px' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                                <button className="btn btn-ghost" style={{ flex: 1, fontWeight: 800, color: 'white' }}>
                                    Détails & Import <ArrowRight size={16} style={{ marginLeft: '8px' }} />
                                </button>
                                
                                {campaign.source === 'Google Sheets' && (
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setCreatedCampaignId(campaign.id); 
                                            setShowSheetsSetup(true); 
                                        }} 
                                        className="btn btn-ghost" 
                                        style={{ padding: '0 12px', minWidth: 'auto', color: 'var(--accent)' }}
                                        title="Configurer l'automation Google Sheets"
                                    >
                                        <Settings size={18} />
                                    </button>
                                )}

                                {isAdmin && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(campaign.id); }} className="btn btn-ghost" style={{ padding: '0 12px', minWidth: 'auto', color: 'var(--danger)' }}>
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {displayedCampaigns.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '6rem 2rem', background: 'rgba(255,255,255,0.01)', border: '2px dashed var(--border)', borderRadius: '32px' }}>
                    <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.03)', borderRadius: '24px', display: 'grid', placeItems: 'center', margin: '0 auto 1.5rem' }}>
                        <Target size={40} color="var(--text-muted)" />
                    </div>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', color: 'white' }}>Aucune campagne active</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', maxWidth: '400px', margin: '0 auto 2.5rem' }}>{isAdmin ? 'Votre tableau de bord est prêt. Commencez par créer votre première campagne d\'acquisition.' : 'Aucune campagne ne vous est assignée pour le moment.'}</p>
                    {isAdmin && (
                        <button onClick={() => setIsAddCampaignModalOpen(true)} className="btn btn-primary" style={{ padding: '0.8rem 3rem', borderRadius: '16px', fontWeight: 800 }}>+ Créer ma première campagne</button>
                    )}
                </div>
            )}
        </div>
    );
};

export default Campaigns;
