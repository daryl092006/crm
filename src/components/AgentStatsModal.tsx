import React, { useState } from 'react';
import { X, CheckCircle2, UserCheck, Activity, Users, PieChart, PhoneOff, Zap, Award, Sparkles, Search, Filter, CheckSquare, Square, UserPlus, ChevronDown, MessageSquare, TrendingUp, ChevronLeft, ChevronRight, Globe, Pencil, Check, Download, Target } from 'lucide-react';
import type { Agent, StudentLead, LeadStatus, Campaign } from '../types';
import { supabase } from '../supabaseClient';
import { smartParsePhone, sanitizeForPostgres, resolveCityToCountry, resolveGeographicTruth, COUNTRIES_DB } from '../utils/verificationService';
import { usePopup } from './Popup';
import * as XLSX from 'xlsx';
import { useToast } from './Toast';
import OutcomeModal from './OutcomeModal';
import LeadHistoryModal from './LeadHistoryModal';
import LeadDetailsModal from './LeadDetailsModal';



interface AgentStatsModalProps {
    agent: Agent | null;
    leads: StudentLead[];
    setLeads: React.Dispatch<React.SetStateAction<StudentLead[]>>;
    statuses: LeadStatus[];
    agents: Agent[];
    campaigns: Campaign[];
    onClose: () => void;
    onRefresh?: () => Promise<void>;
    profile: import('../types').Profile | null;
}

// --- CONFIGURATION DE RÉFÉRENCE NATIONALE (Désormais centralisée dans verificationService) ---


const AgentStatsModal: React.FC<AgentStatsModalProps> = ({ agent, leads, setLeads, statuses, agents, campaigns, onClose, onRefresh, profile }) => {
    const { addToast } = useToast();
    const { showConfirm } = usePopup();
    const [selectedLeadForOutcome, setSelectedLeadForOutcome] = useState<StudentLead | null>(null);
    const [selectedLeadForHistory, setSelectedLeadForHistory] = useState<StudentLead | null>(null);
    const [isHarmonizing, setIsHarmonizing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCountry, setFilterCountry] = useState('all');
    const [selectedCampaignTab, setSelectedCampaignTab] = useState('all');
    const [showAllStatus, setShowAllStatus] = useState(false);
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [isReassigning, setIsReassigning] = useState(false);
    const [showReassignDropdown, setShowReassignDropdown] = useState(false);
    const [aiAlerts, setAiAlerts] = useState<{ type: 'duplicate' | 'format' | 'country'; count: number; details?: string[]; leadIds: string[] }[]>([]);
    const [showAiDetails, setShowAiDetails] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [filterOnlyProblems, setFilterOnlyProblems] = useState<'duplicate' | 'format' | 'country' | null>(null);
    const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [tempNoteValue, setTempNoteValue] = useState("");
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<StudentLead | null>(null);

    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'super_agent';
    const filteredLeadsByCampaign = React.useMemo(() => {
        return selectedCampaignTab === 'all'
            ? leads
            : leads.filter(l => String(l.campaignId) === String(selectedCampaignTab));
    }, [leads, selectedCampaignTab]);

    const stats = React.useMemo(() => {
        const total = filteredLeadsByCampaign.length;
        const nonContacted = filteredLeadsByCampaign.filter(l => {
            const sid = (l.statusId || '').toLowerCase();
            const slabel = (l.status?.label || '').toLowerCase();
            return sid === 'nouveau' || sid === '' || sid === 'non_contacte' || slabel.includes('nouveau') || slabel.includes('non contacté') || slabel.includes('pas contacté');
        }).length;
        const contacted = total - nonContacted;
        const pasRepondu = filteredLeadsByCampaign.filter(l => {
            const sid = (l.statusId || '').toLowerCase();
            return sid === 'injoignable' || sid === 'repondeur' || (l.status?.label || '').toLowerCase().includes('injoignable');
        }).length;
        const reached = contacted - pasRepondu;
        const inscribed = filteredLeadsByCampaign.filter(l => {
            const sid = (l.statusId || '').toLowerCase();
            const slabel = (l.status?.label || '').toLowerCase();
            return ['admis', 'inscrit', 'confirme'].some(k => sid.includes(k) || slabel.includes(k));
        }).length;
        const conversion = reached > 0 ? Math.round((inscribed / reached) * 100) : 0;
        const contact = total > 0 ? Math.round((contacted / total) * 100) : 0;


        const fieldCounts = filteredLeadsByCampaign.reduce((acc: any, curr) => {
            const field = curr.fieldOfInterest || 'Non spécifié';
            acc[field] = (acc[field] || 0) + 1;
            return acc;
        }, {});
        const topFields = Object.entries(fieldCounts).sort(([, a]: any, [, b]: any) => b - a).slice(0, 3);

        return { total, nonContacted, contacted, pasRepondu, reached, inscribed, conversion, contact, topFields };
    }, [filteredLeadsByCampaign]);

    const { total: totalLeads, nonContacted: nonContactedCount, contacted: contactedLeadsCount, pasRepondu: pasReponduCount, inscribed: inscribedLeadsCount, conversion: conversionRate, contact: contactRate, topFields } = stats;

    // Reset pagination when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterStatus, filterCountry, selectedCampaignTab]);

    // Get unique campaigns present in this agent's leads
    const agentCampaignIds = React.useMemo(() => Array.from(new Set(leads.map(l => l.campaignId))), [leads]);
    const agentCampaigns = React.useMemo(() => campaigns.filter(c => agentCampaignIds.includes(c.id)), [campaigns, agentCampaignIds]);

    // MOTEUR DE DÉTECTION SÉCURISÉ (ULTRA-PUISSANT)
    const findCountryInfo = React.useCallback((countryStr: string, phoneStr: string) => {
        let p = (phoneStr || '').replace(/\D/g, '');
        if (p.startsWith('00')) p = p.substring(2);
        const c = (countryStr || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const sortedCountries = [...COUNTRIES_DB].sort((a, b) => b.id.length - a.id.length);
        for (const country of sortedCountries) {
            if (p.startsWith(country.id)) return country;
        }
        for (const country of COUNTRIES_DB) {
            if (country.keywords.some(k => c === k || (c.length > 2 && c.includes(k)))) {
                return country;
            }
        }
        return null;
    }, []);

    const formatIntelligentPhone = React.useCallback((phone: string, countryInfo: { id: string, name: string, keywords: string[] } | null) => {
        if (!phone || phone === 'N/A') return phone;
        let digits = phone.replace(/\D/g, '');
        if (digits.startsWith('00')) digits = digits.substring(2);
        const allPrefixes = COUNTRIES_DB.map(c => c.id).sort((a, b) => b.length - a.length);
        if (digits.length > 13) {
            for (const p1 of allPrefixes) {
                if (digits.startsWith(p1)) {
                    const rest = digits.substring(p1.length);
                    for (const p2 of allPrefixes) {
                        if (rest.startsWith(p2)) {
                            digits = rest;
                            break;
                        }
                    }
                }
            }
        }
        if (countryInfo) {
            const prefix = countryInfo.id;
            if (digits.startsWith(prefix + prefix)) digits = digits.substring(prefix.length);
            if (digits.startsWith(prefix)) return '+' + digits;
            if (digits.startsWith('0')) return '+' + prefix + digits.substring(1);
            return '+' + prefix + digits;
        }
        return phone.startsWith('+') ? phone : '+' + digits;
    }, []);

    // --- SCAN IA AUTOMATIQUE (SILENCIEUX) ---
    React.useEffect(() => {
        if (!agent?.id) return;

        const scanLeads = () => {
            let dups = 0;
            let badFormats = 0;
            let badCountries = 0;
            const phones = new Map<string, string>();

            const duplicateNames: string[] = [];
            const duplicateIds: string[] = [];
            const formatErrorNames: string[] = [];
            const formatErrorIds: string[] = [];
            const countryErrorNames: string[] = [];
            const countryErrorIds: string[] = [];

            filteredLeadsByCampaign.forEach(l => {
                const smart = smartParsePhone(l.phone);

                // Detection Format
                if (smart.primary !== l.phone && smart.primary !== '') {
                    badFormats++;
                    formatErrorNames.push(`${l.firstName} ${l.lastName} (${l.phone} ➔ ${smart.primary})`);
                    formatErrorIds.push(l.id);
                }

                // Detection Pays (Système Elite Triangulation)
                const geo = resolveGeographicTruth(smart.detectedCountry, l.country, l.city, smart.isExplicit);

                if (geo.winner && geo.winner !== l.country) {
                    const currentC = (l.country || '').trim();
                    const isWeak = !currentC || ['SÉNÉGAL', 'SENEGAL', 'AUTRE', 'INCONNU', 'N/A', 'VIDE', 'NONE'].includes(currentC.toUpperCase());

                    if (isWeak || (geo.status === 'coherence')) {
                        badCountries++;
                        countryErrorNames.push(`${l.firstName} ${l.lastName} (${currentC || 'Vide'} ➔ ${geo.winner})`);
                        countryErrorIds.push(l.id);
                    }
                }

                // Detection Doublons
                const clean = smart.primary.replace(/\D/g, '');
                if (clean && clean.length > 5) {
                    if (phones.has(clean)) {
                        dups++;
                        duplicateNames.push(`${l.firstName} ${l.lastName} (Doublon de ${phones.get(clean)})`);
                        duplicateIds.push(l.id);
                    } else {
                        phones.set(clean, `${l.firstName} ${l.lastName}`);
                    }
                }
            });

            const alerts: any[] = [];
            if (dups > 0) alerts.push({ type: 'duplicate', count: dups, details: duplicateNames, leadIds: duplicateIds });
            if (badFormats > 0) alerts.push({ type: 'format', count: badFormats, details: formatErrorNames, leadIds: formatErrorIds });
            if (badCountries > 0) alerts.push({ type: 'country', count: badCountries, details: countryErrorNames, leadIds: countryErrorIds });
            setAiAlerts(alerts);
        };

        scanLeads();
    }, [filteredLeadsByCampaign, agent?.id]);

    if (!agent) return null;

    const handleUpdateStatus = async (leadId: string, newStatusId: string) => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;
        const sid = newStatusId.toLowerCase();
        const isDialogue = !['nouveau', 'injoignable', 'repondeur', 'faux_numero'].some(k => sid.includes(k));
        const newMetadata = sanitizeForPostgres({ ...(lead.metadata || {}), everReached: lead.metadata?.everReached || isDialogue });
        const newStatus = statuses.find(s => s.id === newStatusId);
        
        const isAdminChange = profile?.id !== lead?.agentId && isAdmin;
        const adminSuffix = isAdminChange ? ` (par Admin: ${profile?.full_name})` : '';

        await supabase.from('lead_interactions').insert({
            lead_id: leadId,
            agent_id: profile?.id || lead.agentId,
            type: 'status_change',
            content: `Gestion Agent : Statut modifié en : ${newStatus?.label || newStatusId}` + adminSuffix
        });

        setLeads((prev: StudentLead[]) => prev.map(l => l.id === leadId ? { ...l, statusId: newStatusId, status: newStatus, metadata: newMetadata } : l));
        await supabase.from('leads').update({ status_id: newStatusId, metadata: newMetadata }).eq('id', leadId);
    };

    const handleUpdateNote = async (leadId: string) => {
        if (isSavingNote) return;
        setIsSavingNote(true);
        try {
            const lead = leads.find(l => l.id === leadId);
            const { error } = await supabase
                .from('leads')
                .update({ notes: tempNoteValue })
                .eq('id', leadId);

            if (error) throw error;

            const isAdminChange = profile?.id !== lead?.agentId && isAdmin;
            const adminSuffix = isAdminChange ? ` (par Admin: ${profile?.full_name})` : '';

            await supabase.from('lead_interactions').insert({
                lead_id: leadId,
                agent_id: profile?.id || lead?.agentId,
                type: 'note',
                content: `Note mise à jour : ${tempNoteValue.substring(0, 50)}${tempNoteValue.length > 50 ? '...' : ''}` + adminSuffix
            });

            setLeads((prev: StudentLead[]) => prev.map(l => l.id === leadId ? { ...l, notes: tempNoteValue } : l));
            addToast("Note mise à jour !", "success");
            setEditingNoteId(null);
        } catch (error: any) {
            addToast((error as Error).message, "error");
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleExport = (selectedColumns: string[]) => {
        if (!agent) return;

        // LOGIQUE : Priorité à la sélection, sinon on prend le filtrage actuel
        let leadsToExport = [];

        if (selectedLeadIds.length > 0) {
            leadsToExport = leads.filter(l => selectedLeadIds.includes(l.id));
        } else {
            leadsToExport = leads.filter(l => {
                const matchesSearch = (l.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.phone || '').includes(searchQuery);
                const matchesStatus = filterStatus === 'all' || l.statusId === filterStatus;
                const matchesCountry = filterCountry === 'all' || l.country === filterCountry;
                const matchesCampaign = selectedCampaignTab === 'all' || String(l.campaignId) === String(selectedCampaignTab);
                return matchesSearch && matchesStatus && matchesCountry && matchesCampaign;
            });
        }

        const columnMap: Record<string, string> = {
            'firstName': 'Prénom',
            'lastName': 'Nom',
            'email': 'Email',
            'phone': 'Téléphone',
            'country': 'Pays',
            'statusId': 'Statut',
            'fieldOfInterest': 'Filière',
            'notes': 'Notes'
        };

        const data = leadsToExport.map(l => {
            const row: Record<string, any> = {};
            const countryInfo = findCountryInfo(l.country, l.phone);
            const intelligentPhone = formatIntelligentPhone(l.phone, countryInfo);

            selectedColumns.forEach(id => {
                let val = (l as any)[id];
                if (id === 'statusId') val = l.status?.label || l.statusId;
                if (id === 'phone') val = intelligentPhone;
                if (id === 'country') val = countryInfo ? countryInfo.name : l.country;
                row[columnMap[id] || id] = val;
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Prospects");
        XLSX.writeFile(wb, `Export_${agent.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString()}.xlsx`);
        addToast(`${leadsToExport.length} prospects exportés.`, "success");
    };

    const getPhaseLabel = (lead: StudentLead) => {
        const sid = (lead.statusId || '').toLowerCase();
        // ROADMAP: Décision (Clôture)
        if (['admis', 'inscription_attente', 'inscrit'].includes(sid)) return 'Décision';
        // ROADMAP: Candidature (Engagement fort)
        if (['rdv_planifie', 'dossier_recu'].includes(sid)) return 'Candidature';
        // ROADMAP: Information (Intérêt manifesté)
        if (['interesse', 'rappel', 'reflexion', 'reorientation'].includes(sid)) return 'Information';
        // ROADMAP: Qualification (Entrée/Echec)
        return 'Qualification';
    };

    const handleBulkAssign = async (targetAgentId: string) => {
        if (selectedLeadIds.length === 0) return;

        const confirmed = await showConfirm(
            "Réattribution de masse",
            `Voulez-vous vraiment réattribuer ${selectedLeadIds.length} prospects ?`
        );
        if (!confirmed) return;

        setIsReassigning(true);
        try {
            const { error } = await supabase
                .from('leads')
                .update({ agent_id: targetAgentId })
                .in('id', selectedLeadIds);

            if (error) throw error;

            setLeads((prev: StudentLead[]) => prev.map(l => selectedLeadIds.includes(l.id) ? { ...l, agentId: targetAgentId } : l));
            addToast(`${selectedLeadIds.length} prospects réattribués avec succès !`, "success");
            setSelectedLeadIds([]);
            setShowReassignDropdown(false);
        } catch {
            addToast("Erreur lors de la réattribution.", "error");
        } finally {
            setIsReassigning(false);
        }
    };

    const handleSmartAutoBalance = async () => {
        if (selectedLeadIds.length === 0) return;
        const availableAgents = agents.filter(a => a.id !== agent?.id);
        if (availableAgents.length === 0) return addToast("Aucun autre agent disponible.", "error");

        const confirmed = await showConfirm(
            "IA Smart Balance",
            `L'IA va répartir équitablement ${selectedLeadIds.length} prospects entre les ${availableAgents.length} autres agents. Continuer ?`
        );
        if (!confirmed) return;

        setIsReassigning(true);
        try {
            const leadsPerAgent = Math.ceil(selectedLeadIds.length / availableAgents.length);

            for (let i = 0; i < availableAgents.length; i++) {
                const targetAgent = availableAgents[i];
                const start = i * leadsPerAgent;
                const chunk = selectedLeadIds.slice(start, start + leadsPerAgent);
                if (chunk.length === 0) break;

                const { error } = await supabase
                    .from('leads')
                    .update({ agent_id: targetAgent.id })
                    .in('id', chunk);

                if (error) throw error;
            }

            addToast(`${selectedLeadIds.length} prospects répartis intelligemment !`, "success");
            if (onRefresh) await onRefresh();
            else if (onClose) onClose();
            setSelectedLeadIds([]);
            setShowReassignDropdown(false);
        } catch {
            addToast("Erreur lors de la répartition IA.", "error");
        } finally {
            setIsReassigning(false);
        }
    };

    const handleSelectAll = (filteredLeads: StudentLead[]) => {
        if (selectedLeadIds.length === filteredLeads.length) {
            setSelectedLeadIds([]);
        } else {
            setSelectedLeadIds(filteredLeads.map(l => l.id));
        }
    };

    const toggleLeadSelection = (leadId: string) => {
        setSelectedLeadIds(prev => prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]);
    };

    const handleMassHarmonize = async () => {
        const confirmed = await showConfirm(
            "Nettoyage IA & Fusion des Doublons",
            `L'Assistant IA va :\n1. SUPPRIMER définitivement les fiches en double (même numéro)\n2. Corriger les formats (Bénin +229, indicatifs, etc.)\n3. Uniformiser les identités (NOMS en majuscules, Prénoms propres)\n4. Nettoyer les pays et les caractères invisibles\n\nCette action est irréversible pour les doublons. Continuer ?`
        );

        if (!confirmed) return;

        setIsHarmonizing(true);
        let updatedCount = 0;
        let mergedCount = 0;
        const seenPhones = new Map<string, boolean>();
        const leadsToDelete: string[] = [];
        const allUpdates: any[] = [];

        try {
            const currentLeads = [...leads];

            for (const lead of currentLeads) {
                const smart = smartParsePhone(lead.phone);
                const formattedPhone = smart.primary;
                const cleanKey = formattedPhone.replace(/\D/g, '');

                const updates: Record<string, string | undefined> = {};
                let hasChanges = false;

                const emailKey = (lead.email || '').trim().toLowerCase();

                if ((cleanKey && cleanKey.length > 5) || (emailKey && emailKey.includes('@'))) {
                    const isDuplicate = (cleanKey && cleanKey.length > 5 && seenPhones.has(cleanKey)) ||
                        (emailKey && emailKey.includes('@') && seenPhones.has(emailKey));

                    if (isDuplicate) {
                        leadsToDelete.push(lead.id);
                        mergedCount++;
                        continue;
                    }
                    if (cleanKey && cleanKey.length > 5) seenPhones.set(cleanKey, true);
                    if (emailKey && emailKey.includes('@')) seenPhones.set(emailKey, true);
                }

                if (formattedPhone !== lead.phone && formattedPhone !== '') {
                    updates.phone = formattedPhone;
                    if (smart.note) {
                        updates.notes = (lead.notes || '') + (lead.notes ? ' | ' : '') + smart.note;
                    }
                    hasChanges = true;
                }

                const geo = resolveGeographicTruth(smart.detectedCountry, lead.country, lead.city, smart.isExplicit);

                if (geo.status === 'coherence' && geo.winner) {
                    if (geo.winner !== lead.country) {
                        updates.country = geo.winner;
                        hasChanges = true;
                    }

                    const cityInfo = resolveCityToCountry(lead.country || '');
                    if (cityInfo && !lead.city) {
                        updates.city = lead.country;
                        hasChanges = true;
                    }

                    const targetDb = COUNTRIES_DB.find(c => c.name === geo.winner);
                    const currentPhoneDb = COUNTRIES_DB.find(c => smart.detectedCountry && c.name === smart.detectedCountry);

                    if (targetDb) {
                        const phoneDigits = (updates.phone || lead.phone).replace(/\D/g, '');
                        if (currentPhoneDb && phoneDigits.startsWith(currentPhoneDb.id)) {
                            const newPhone = '+' + targetDb.id + phoneDigits.substring(currentPhoneDb.id.length);
                            if (newPhone !== (updates.phone || lead.phone)) { updates.phone = newPhone; hasChanges = true; }
                        } else if (!smart.isExplicit && !smart.detectedCountry && phoneDigits.length >= 6) {
                            // Nettoyage du 0 initial pour les numéros locaux (Ex: 097... -> +24397...)
                            // On exige au moins 6 chiffres pour éviter de transformer des erreurs (#ERROR!) en indicatifs seuls
                            const localNumber = phoneDigits.startsWith('0') ? phoneDigits.substring(1) : phoneDigits;
                            const newPhone = '+' + targetDb.id + localNumber;
                            if (newPhone !== (updates.phone || lead.phone)) { updates.phone = newPhone; hasChanges = true; }
                        }
                    }
                }

                const cleanFirst = (lead.firstName || '').trim().split(' ').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
                const cleanLast = (lead.lastName || '').trim().toUpperCase();
                if (cleanFirst && cleanFirst !== lead.firstName) { updates.firstName = cleanFirst; hasChanges = true; }
                if (cleanLast && cleanLast !== lead.lastName) { updates.lastName = cleanLast; hasChanges = true; }

                const cleanEmail = (lead.email || '').trim().toLowerCase();
                if (cleanEmail && cleanEmail !== lead.email) { updates.email = cleanEmail; hasChanges = true; }

                // --- COLLECTE DES CHANGEMENTS RÉELS ---
                if (hasChanges) {
                    // On ne garde que les champs CRM purs pour l'update
                    const cleanUpdates: Record<string, string> = {};
                    if (updates.firstName !== undefined) cleanUpdates.first_name = updates.firstName;
                    if (updates.lastName !== undefined) cleanUpdates.last_name = updates.lastName;
                    if (updates.email !== undefined) cleanUpdates.email = updates.email;
                    if (updates.phone !== undefined) cleanUpdates.phone = updates.phone;
                    if (updates.country !== undefined) cleanUpdates.country = updates.country;
                    if (updates.city !== undefined) cleanUpdates.city = updates.city;
                    if (updates.notes !== undefined) cleanUpdates.notes = updates.notes;

                    allUpdates.push({ id: lead.id, data: cleanUpdates });
                    updatedCount++;
                }
            }

            // EXÉCUTION DES SUPPRESSIONS (DOUBLONS)
            if (leadsToDelete.length > 0) {
                const { error: delError } = await supabase
                    .from('leads')
                    .delete()
                    .in('id', leadsToDelete);
                if (delError) throw delError;
            }

            // EXÉCUTION DES MISES À JOUR PAR LOTS DE 20
            const CHUNK_SIZE = 20;
            for (let i = 0; i < allUpdates.length; i += CHUNK_SIZE) {
                const chunk = allUpdates.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(async (item) => {
                    const payload = sanitizeForPostgres(item.data);
                    if (!payload || Object.keys(payload).length === 0) return;

                    const { error } = await supabase
                        .from('leads')
                        .update(payload)
                        .eq('id', item.id);

                    if (error) {
                        console.error(`Erreur Lead ${item.id}:`, (error as Error).message);
                        throw error;
                    }
                }));
            }

            addToast(`IA Terminée : ${updatedCount} fiches corrigées et ${mergedCount} doublons supprimés définitivement.`, "success");
            if (onRefresh) await onRefresh();
            else if (onClose) onClose();
        } catch (error: any) {
            console.error("Détail Erreur IA:", error);
            addToast(`Erreur : ${error?.message || "Échec du nettoyage IA"}`, "error");
        } finally {
            setIsHarmonizing(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
            <div className="card" style={{ width: '98vw', maxWidth: '1650px', height: '96vh', overflow: 'hidden', background: 'var(--bg-main)', borderRadius: '32px', border: '1px solid var(--border)', padding: 0, display: 'flex', flexDirection: 'column', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>

                {/* --- HEADER SECTION --- */}
                <div style={{ padding: '1.25rem 2.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '18px',
                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                            display: 'grid', placeItems: 'center', fontWeight: 950, color: 'white', fontSize: '1.5rem',
                            boxShadow: '0 8px 20px -5px var(--primary-glow)',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                            {agent?.name ? agent.name.split(' ').map(n => n[0]).join('').slice(0, 2) : '?'}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h2 style={{ fontSize: '2rem', fontWeight: 950, letterSpacing: '-0.04em', color: 'white' }}>
                                    {agent?.name || 'Agent'}
                                </h2>
                                <div style={{ background: 'var(--success)', color: 'black', fontSize: '0.65rem', fontWeight: 900, padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>Actif</div>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 600 }}>Command Center & Lead Management Intelligence</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Conversion</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 950, color: 'var(--success)' }}>{conversionRate}%</div>
                        </div>
                        <div style={{ width: '1px', height: '40px', background: 'var(--border)' }}></div>
                        <button onClick={onClose} className="btn btn-ghost" style={{ width: '48px', height: '48px', padding: 0, borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* --- TOP STICKY NAVIGATION & CAMPAIGN FILTER BAR (COULISSANT) --- */}
                <div style={{ 
                    padding: '0.5rem 2rem', 
                    background: 'rgba(255,255,255,0.02)', 
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Target size={14} color="var(--primary)" />
                            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Filtrage par Campagne : 
                                <span style={{ color: 'white', marginLeft: '6px', background: 'var(--primary)', padding: '2px 8px', borderRadius: '4px' }}>
                                    {selectedCampaignTab === 'all' ? 'Toutes les Campagnes' : campaigns.find(c => c.id === selectedCampaignTab)?.name || 'Sélectionnée'}
                                </span>
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {/* Navigation Arrows */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1, overflow: 'hidden', position: 'relative' }}>
                            <button 
                                onClick={() => {
                                    const el = document.getElementById('campaign-scroll-container');
                                    if (el) el.scrollBy({ left: -200, behavior: 'smooth' });
                                }}
                                className="btn btn-ghost" 
                                style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', zIndex: 2 }}
                            >
                                <ChevronLeft size={16} />
                            </button>

                            <div 
                                id="campaign-scroll-container"
                                className="campaign-nav"
                                style={{ 
                                    display: 'flex', 
                                    gap: '0.5rem', 
                                    overflowX: 'auto', 
                                    padding: '0.5rem 0',
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                    whiteSpace: 'nowrap',
                                    scrollBehavior: 'smooth',
                                    maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)'
                                }}
                            >
                                <style>{`
                                    .campaign-nav::-webkit-scrollbar { display: none; }
                                    .campaign-tab-active {
                                        background: var(--primary) !important;
                                        color: white !important;
                                        box-shadow: 0 4px 15px var(--primary-glow) !important;
                                        border-color: var(--primary) !important;
                                        transform: scale(1.05);
                                    }
                                `}</style>
                                <button
                                    onClick={() => setSelectedCampaignTab('all')}
                                    className={selectedCampaignTab === 'all' ? 'campaign-tab-active' : ''}
                                    style={{ 
                                        padding: '0.6rem 1.5rem', 
                                        fontSize: '0.85rem', 
                                        fontWeight: 800, 
                                        borderRadius: '12px', 
                                        border: '1px solid var(--border)',
                                        background: 'rgba(255,255,255,0.03)',
                                        color: 'var(--text-muted)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        cursor: 'pointer',
                                        flexShrink: 0
                                    }}
                                >
                                    🌍 Vue Globale ({leads.length})
                                </button>
                                {agentCampaigns.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedCampaignTab(c.id)}
                                        className={selectedCampaignTab === c.id ? 'campaign-tab-active' : ''}
                                        style={{ 
                                            padding: '0.6rem 1.5rem', 
                                            fontSize: '0.85rem', 
                                            fontWeight: 800, 
                                            borderRadius: '12px', 
                                            border: '1px solid var(--border)',
                                            background: 'rgba(255,255,255,0.03)',
                                            color: 'var(--text-muted)',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer',
                                            flexShrink: 0
                                        }}
                                    >
                                        🚀 {c.name} ({leads.filter(l => l.campaignId === c.id).length})
                                    </button>
                                ))}
                            </div>

                            <button 
                                onClick={() => {
                                    const el = document.getElementById('campaign-scroll-container');
                                    if (el) el.scrollBy({ left: 200, behavior: 'smooth' });
                                }}
                                className="btn btn-ghost" 
                                style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', zIndex: 2 }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        {/* Quick Filters in Top Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                            <div style={{ position: 'relative', width: '250px' }}>
                                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Rechercher un prospect..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="input"
                                    style={{ paddingLeft: '2.5rem', borderRadius: '12px', height: '40px', fontSize: '0.85rem' }}
                                />
                            </div>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="input"
                                style={{ width: '160px', height: '40px', borderRadius: '12px', fontSize: '0.85rem' }}
                            >
                                <option value="all">Tous les Statuts</option>
                                {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                            <select
                                value={filterCountry}
                                onChange={(e) => setFilterCountry(e.target.value)}
                                className="input"
                                style={{ width: '140px', height: '40px', borderRadius: '12px', fontSize: '0.85rem' }}
                            >
                                <option value="all">Tous les Pays</option>
                                {Array.from(new Set(leads.map(l => l.country))).filter(Boolean).sort().map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '2.5rem', flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                    {/* LES 5 INDICATEURS MAÎTRES */}
                    <div className="stat-grid" style={{ marginBottom: '2.5rem', gap: '1.5rem' }}>
                        {[
                            { label: 'Inscrits', color: 'var(--success)', icon: CheckCircle2, count: inscribedLeadsCount, detail: 'Conversion finale' },
                            { label: 'Pas Répondu', color: 'var(--warning)', icon: PhoneOff, count: pasReponduCount, detail: 'Injoignables' },
                            { label: 'Contactés', color: 'var(--accent)', icon: UserCheck, count: contactedLeadsCount, detail: 'Traités' },
                            { label: 'Nouveaux', color: 'var(--danger)', icon: Zap, count: nonContactedCount, detail: 'À traiter' },
                            { label: 'Total', color: 'var(--primary)', icon: Users, count: totalLeads, detail: 'Dossiers total' }
                        ].map((s, i) => (
                            <div key={i} className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                    <div style={{ padding: '10px', background: `${s.color}12`, borderRadius: '14px', border: `1px solid ${s.color}20` }}>
                                        <s.icon size={22} color={s.color} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
                                </div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 950, color: 'white', lineHeight: 1, letterSpacing: '-0.02em' }}>{s.count}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem', fontWeight: 600 }}>{s.detail}</div>
                            </div>
                        ))}
                    </div>

                    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
                        {/* Efficacité Chart Card */}
                        <div className="card" style={{ padding: '2rem', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                                <Activity size={24} color="var(--primary)" />
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>Efficacité Opérationnelle</h3>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '2.5rem' }}>
                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Taux de Conversion</div>
                                    <div style={{ fontSize: '2.75rem', fontWeight: 950, color: 'var(--success)', letterSpacing: '-0.02em' }}>{conversionRate}%</div>
                                    <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginTop: '1.5rem', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${conversionRate}%`, background: 'var(--success)', borderRadius: '10px', boxShadow: '0 0 15px rgba(34, 197, 94, 0.4)' }}></div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Taux de Contact</div>
                                    <div style={{ fontSize: '2.75rem', fontWeight: 950, color: 'var(--accent)', letterSpacing: '-0.02em' }}>{contactRate}%</div>
                                    <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginTop: '1.5rem', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${contactRate}%`, background: 'var(--accent)', borderRadius: '10px', boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Filières Card */}
                        <div className="card" style={{ padding: '2rem', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                                <PieChart size={24} color="var(--accent)" />
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>Distribution des Filières</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {topFields.map(([field, count]: any, i) => (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 800, color: 'white' }}>{field}</span>
                                            <span style={{ color: 'var(--primary)', fontWeight: 900 }}>{count} prospects</span>
                                        </div>
                                        <div style={{ height: '10px', width: '100%', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${totalLeads > 0 ? (count / totalLeads) * 100 : 0}%`, background: i === 0 ? 'var(--primary)' : i === 1 ? 'var(--accent)' : 'var(--warning)', borderRadius: '10px', boxShadow: '0 0 10px rgba(99, 102, 241, 0.3)' }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* IA Assistant Banner */}
                    {aiAlerts.length > 0 && (
                        <div className="card" style={{
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08))',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            padding: '1.5rem 2rem',
                            marginBottom: '3rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderRadius: '24px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <div style={{
                                    width: '52px', height: '52px', borderRadius: '16px',
                                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                                    display: 'grid', placeItems: 'center', boxShadow: '0 10px 20px -5px var(--primary-glow)'
                                }}>
                                    <Sparkles size={24} color="white" />
                                </div>
                                <div>
                                    <h4 style={{ fontWeight: 900, fontSize: '1.1rem', color: 'white', marginBottom: '4px' }}>Assistant Intelligence Artificielle</h4>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                        {aiAlerts.map(a => `${a.count} ${a.type === 'duplicate' ? 'doublons' : 'erreurs'}`).join(' et ')} détectés.
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={() => setShowAiDetails(!showAiDetails)}
                                    className="btn btn-ghost"
                                    style={{ fontSize: '0.85rem', fontWeight: 800, padding: '0.6rem 1.5rem', border: '1px solid var(--border)' }}
                                >
                                    {showAiDetails ? 'Masquer Diagnostic' : 'Voir Diagnostic'}
                                </button>
                                <button
                                    onClick={handleMassHarmonize}
                                    disabled={isHarmonizing}
                                    className="btn btn-primary"
                                    style={{ fontSize: '0.85rem', fontWeight: 900, padding: '0.6rem 2rem' }}
                                >
                                    {isHarmonizing ? 'Nettoyage IA en cours...' : 'Exécuter Nettoyage Global'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Status Performance Section */}
                    <div className="card" style={{ marginBottom: '4rem', padding: '2rem', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ width: '44px', height: '44px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', display: 'grid', placeItems: 'center', color: 'var(--primary)' }}>
                                    <TrendingUp size={24} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>Performance par Statuts</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Distribution granulaire du flux de travail</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAllStatus(!showAllStatus)} className="btn btn-ghost" style={{ border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                {showAllStatus ? 'Vue Simplifiée' : `Voir les ${statuses.length} statuts`}
                            </button>
                        </div>

                        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                            {[
                                { id: 'inscrit', label: 'Inscriptions', color: 'var(--success)' },
                                { id: 'admis', label: 'Admissions', color: 'var(--accent)' },
                                { id: 'nouveau', label: 'Nouveaux', color: 'var(--primary)' },
                                { id: 'injoignable', label: 'Injoignables', color: '#f59e0b' }
                            ].map(st => {
                                const count = filteredLeadsByCampaign.filter(l => {
                                    const sid = (l.statusId || '').toLowerCase();
                                    const slabel = (l.status?.label || '').toLowerCase();
                                    if (st.id === 'nouveau') return sid === 'nouveau' || sid === '' || sid === 'non_contacte' || slabel.includes('nouveau') || slabel.includes('non contacté');
                                    if (st.id === 'inscrit') return ['inscrit', 'confirme'].some(k => sid.includes(k) || slabel.includes(k));
                                    if (st.id === 'admis') return sid === 'admis' || slabel.includes('admis');
                                    return sid === st.id || slabel === st.label.toLowerCase();
                                }).length;
                                return (
                                    <div key={st.id} style={{ padding: '1.75rem', background: 'rgba(255,255,255,0.01)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>{st.label}</div>
                                        <div style={{ fontSize: '2.25rem', fontWeight: 950, color: 'white' }}>{count}</div>
                                        <div style={{ height: '4px', width: '40px', background: st.color, borderRadius: '4px', marginTop: '1rem' }}></div>
                                    </div>
                                );
                            })}
                        </div>

                        {showAllStatus && (
                            <div className="animate-fade" style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: '24px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    {[...statuses].sort((a, b) => a.label.localeCompare(b.label)).map(s => {
                                        const count = leads.filter(l => l.statusId === s.id && (selectedCampaignTab === 'all' || l.campaignId === selectedCampaignTab)).length;
                                        return (
                                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{s.label}</span>
                                                <span style={{ fontWeight: 900, color: 'white', fontSize: '0.9rem' }}>{count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Lead Register Section */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem', gap: '2rem' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                    <div style={{ width: '40px', height: '40px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', display: 'grid', placeItems: 'center', color: 'var(--primary)' }}>
                                        <Users size={22} />
                                    </div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>Registre des Prospects</h3>
                                </div>
                                <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Gestion détaillée et historique des interactions</p>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    onClick={() => handleExport(['firstName', 'lastName', 'email', 'phone', 'country', 'statusId', 'fieldOfInterest', 'notes'])}
                                    className="btn btn-ghost"
                                    style={{ border: '1px solid var(--border)', fontWeight: 800, fontSize: '0.85rem', padding: '0.6rem 1.25rem' }}
                                >
                                    <Download size={18} /> Exporter
                                </button>
                                {selectedLeadIds.length > 0 && (
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => setShowReassignDropdown(!showReassignDropdown)}
                                            className="btn btn-primary"
                                            style={{ fontWeight: 900, fontSize: '0.85rem', padding: '0.6rem 1.5rem' }}
                                        >
                                            <UserPlus size={18} /> Actions ({selectedLeadIds.length})
                                        </button>
                                        {showReassignDropdown && (
                                            <div className="card shadow-xl animate-fade" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem', width: '280px', zIndex: 100, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                                                <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Réattribuer à :</div>
                                                <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '0.5rem' }}>
                                                    {agents.filter(a => a.id !== agent.id).map(a => (
                                                        <button key={a.id} onClick={() => handleBulkAssign(a.id)} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
                                                            {a.name}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border)' }}>
                                                    <button onClick={handleSmartAutoBalance} className="btn btn-primary" style={{ width: '100%', fontSize: '0.8rem', fontWeight: 800 }}>
                                                        <Zap size={14} /> IA Smart Balance
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pagination & Results Count */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', padding: '0 0.5rem' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                Affichage de <span style={{ color: 'white' }}>{((currentPage - 1) * itemsPerPage) + 1}</span> à <span style={{ color: 'white' }}>{Math.min(currentPage * itemsPerPage, filteredLeadsByCampaign.length)}</span> sur <span style={{ color: 'white' }}>{filteredLeadsByCampaign.length}</span> résultats
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn btn-ghost" style={{ width: '36px', height: '36px', padding: 0 }}><ChevronLeft size={20} /></button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 800, color: 'white', padding: '0 0.75rem' }}>Page {currentPage}</div>
                                <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage * itemsPerPage >= filteredLeadsByCampaign.length} className="btn btn-ghost" style={{ width: '36px', height: '36px', padding: 0 }}><ChevronRight size={20} /></button>
                            </div>
                        </div>
                        <div className="table-container" style={{ borderRadius: '24px', border: '1px solid var(--border)', overflow: 'hidden', background: 'rgba(0,0,0,0.1)' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => {
                                                    const filteredItems = leads.filter(l => {
                                                        const matchesSearch = (l.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.phone || '').includes(searchQuery);
                                                        const matchesStatus = filterStatus === 'all' || l.statusId === filterStatus;
                                                        const matchesCountry = filterCountry === 'all' || l.country === filterCountry;
                                                        const matchesCampaign = selectedCampaignTab === 'all' || String(l.campaignId) === String(selectedCampaignTab);
                                                        return matchesSearch && matchesStatus && matchesCountry && matchesCampaign;
                                                    });
                                                    handleSelectAll(filteredItems);
                                                }}
                                                style={{ background: 'transparent', border: 'none', color: selectedLeadIds.length > 0 ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                                            >
                                                {selectedLeadIds.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                        </th>
                                        <th>Prospect</th>
                                        <th>Contact & Pays</th>
                                        <th>Statut</th>
                                        <th>Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const filtered = leads.filter(l => {
                                            const matchesSearch =
                                                (l.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                (l.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                (l.phone || '').includes(searchQuery);
                                            const matchesStatus = filterStatus === 'all' || l.statusId === filterStatus;
                                            const matchesCountry = filterCountry === 'all' || l.country === filterCountry;
                                            const matchesCampaign = selectedCampaignTab === 'all' || String(l.campaignId) === String(selectedCampaignTab);

                                            // ISOLATION IA
                                            if (filterOnlyProblems) {
                                                const currentAlert = aiAlerts.find(a => a.type === filterOnlyProblems) as any;
                                                if (!currentAlert?.leadIds?.includes(l.id)) return false;
                                            }

                                            return matchesSearch && matchesStatus && matchesCountry && matchesCampaign;
                                        }).sort((a, b) => new Date(b.lastInteractionAt || b.createdAt).getTime() - new Date(a.lastInteractionAt || a.createdAt).getTime());

                                        const startIndex = (currentPage - 1) * itemsPerPage;
                                        return filtered.slice(startIndex, startIndex + itemsPerPage);
                                    })()
                                        .map((lead: StudentLead) => {
                                            const phase = getPhaseLabel(lead);
                                            const countryInfo = findCountryInfo(lead.country, lead.phone);
                                            const intelligentPhone = formatIntelligentPhone(lead.phone, countryInfo);
                                            const sid = (lead.statusId || '').toLowerCase();
                                            const isFailed = (sid.includes('injoignable') || sid.includes('repondeur'));

                                            return (
                                                <tr key={lead.id} onClick={() => setSelectedLeadForDetail(lead)} className={`hover-row ${highlightedLeadId === lead.id ? 'highlighted-row' : ''}`} style={{ background: highlightedLeadId === lead.id ? 'rgba(99, 102, 241, 0.08)' : selectedLeadIds.includes(lead.id) ? 'rgba(99, 102, 241, 0.04)' : 'transparent' }}>
                                                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => toggleLeadSelection(lead.id)}
                                                            style={{ background: 'transparent', border: 'none', color: selectedLeadIds.includes(lead.id) ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                                                        >
                                                            {selectedLeadIds.includes(lead.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                        </button>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{lead.firstName} {lead.lastName}</div>
                                                            {lead.metadata?.everReached && <div style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>Joint</div>}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{lead.email}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{intelligentPhone}</div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {countryInfo ? countryInfo.name : (lead.country || 'Pays inconnu')}
                                                        </div>
                                                    </td>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <select
                                                            value={lead.statusId}
                                                            onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                                                            className="input"
                                                            style={{ borderRadius: '8px', height: '32px', fontSize: '0.8rem', fontWeight: 600, padding: '0 8px', width: '160px' }}
                                                        >
                                                            {[...statuses].sort((a, b) => a.label.localeCompare(b.label)).map((s: any) => (
                                                                <option key={s.id} value={s.id}>{s.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <div style={{ flex: 1, position: 'relative' }}>
                                                                {editingNoteId === lead.id ? (
                                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                        <input
                                                                            value={tempNoteValue}
                                                                            onChange={(e) => setTempNoteValue(e.target.value)}
                                                                            autoFocus
                                                                            className="input"
                                                                            style={{ height: '32px', fontSize: '0.8rem', flex: 1 }}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') handleUpdateNote(lead.id);
                                                                                if (e.key === 'Escape') setEditingNoteId(null);
                                                                            }}
                                                                        />
                                                                        <button onClick={() => handleUpdateNote(lead.id)} className="btn btn-primary" style={{ padding: '0 8px', height: '32px' }}><Check size={14} /></button>
                                                                    </div>
                                                                ) : (
                                                                    <div
                                                                        onClick={() => { setEditingNoteId(lead.id); setTempNoteValue(lead.notes || ""); }}
                                                                        style={{ fontSize: '0.8rem', color: lead.notes ? 'white' : 'var(--text-muted)', fontStyle: lead.notes ? 'normal' : 'italic', cursor: 'text', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                                    >
                                                                        {lead.notes || "Ajouter une note..."}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <button onClick={() => setSelectedLeadForHistory(lead)} className="btn btn-ghost" style={{ padding: '4px', borderRadius: '6px' }} title="Historique"><MessageSquare size={14} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Section */}
                        {(() => {
                            const filtered = leads.filter(l => {
                                const matchesSearch =
                                    (l.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (l.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (l.phone || '').includes(searchQuery);
                                const matchesStatus = filterStatus === 'all' || l.statusId === filterStatus;
                                const matchesCountry = filterCountry === 'all' || l.country === filterCountry;
                                const matchesCampaign = selectedCampaignTab === 'all' || l.campaignId === selectedCampaignTab;

                                if (filterOnlyProblems) {
                                    const currentAlert = aiAlerts.find(a => a.type === filterOnlyProblems) as any;
                                    if (!currentAlert?.leadIds?.includes(l.id)) return false;
                                }

                                return matchesSearch && matchesStatus && matchesCountry && matchesCampaign;
                            });
                            const totalPages = Math.ceil(filtered.length / itemsPerPage);

                            return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0 0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Afficher</span>
                                        <select
                                            value={itemsPerPage}
                                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                            className="input"
                                            style={{ height: '32px', padding: '0 8px', borderRadius: '8px', fontSize: '0.8rem', width: '100px' }}
                                        >
                                            {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v} / page</option>)}
                                        </select>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            Page <span style={{ color: 'white' }}>{currentPage}</span> sur {totalPages || 1}
                                        </span>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(p => p - 1)}
                                                className="btn btn-ghost"
                                                style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px' }}
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            <button
                                                disabled={currentPage === totalPages || totalPages === 0}
                                                onClick={() => setCurrentPage(p => p + 1)}
                                                className="btn btn-ghost"
                                                style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px' }}
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Footer Section */}
                <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.01)' }}>
                    <button className="btn btn-primary" style={{ padding: '0.75rem 2.5rem', borderRadius: '12px', fontWeight: 800 }} onClick={onClose}>
                        Fermer le Management
                    </button>
                </div>

                {/* Floating Bulk Action Bar */}
                {selectedLeadIds.length > 0 && (
                    <div style={{
                        position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                        background: 'var(--primary)', padding: '0.75rem 1.5rem', borderRadius: '16px',
                        display: 'flex', alignItems: 'center', gap: '1.5rem',
                        boxShadow: '0 12px 32px var(--primary-glow)', zIndex: 100,
                        border: '1px solid rgba(255,255,255,0.2)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'white', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                                {selectedLeadIds.length}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>Sélectionnés</span>
                        </div>

                        <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>

                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowReassignDropdown(!showReassignDropdown)}
                                className="btn"
                                style={{ background: 'white', color: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                {isReassigning ? <Activity className="animate-spin" size={16} /> : <UserPlus size={16} />}
                                Réassigner <ChevronDown size={14} />
                            </button>

                            {showReassignDropdown && (
                                <div className="card" style={{ position: 'absolute', bottom: 'calc(100% + 1rem)', left: '50%', transform: 'translateX(-50%)', width: '260px', padding: '0.5rem', border: '1px solid var(--border)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 110 }}>
                                    <div style={{ padding: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Agents disponibles</div>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {agents.filter(a => a.id !== agent?.id).map(a => (
                                            <button
                                                key={a.id}
                                                onClick={() => handleBulkAssign(a.id)}
                                                className="btn btn-ghost"
                                                style={{ width: '100%', justifyContent: 'flex-start', padding: '0.75rem', borderRadius: '10px', fontSize: '0.875rem' }}
                                            >
                                                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--primary)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '0.7rem', fontWeight: 800 }}>{a.name[0]}</div>
                                                <span style={{ marginLeft: '0.75rem' }}>{a.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                                        <button
                                            onClick={handleSmartAutoBalance}
                                            className="btn btn-primary"
                                            style={{ width: '100%', fontSize: '0.8rem', padding: '0.6rem' }}
                                        >
                                            <Sparkles size={14} /> Auto-Balance IA
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={() => setSelectedLeadIds([])} className="btn btn-ghost" style={{ padding: '0.25rem', color: 'white' }}>
                            <X size={18} />
                        </button>
                    </div>
                )}

                <OutcomeModal 
                    isOpen={!!selectedLeadForOutcome} 
                    lead={selectedLeadForOutcome} 
                    onClose={() => setSelectedLeadForOutcome(null)} 
                    onUpdate={(id, up) => setLeads(prev => prev.map(l => l.id === id ? { ...l, ...up } : l))} 
                    profile={profile} 
                    statuses={statuses}
                />
                {selectedLeadForDetail && (
                    <LeadDetailsModal
                        lead={selectedLeadForDetail}
                        isOpen={!!selectedLeadForDetail}
                        onClose={() => setSelectedLeadForDetail(null)}
                        statuses={statuses}
                        onUpdate={async () => {
                            if (onRefresh) await onRefresh();
                        }}
                        profile={profile}
                    />
                )}
                <LeadHistoryModal
                    isOpen={!!selectedLeadForHistory}
                    lead={selectedLeadForHistory}
                    onClose={() => setSelectedLeadForHistory(null)}
                    onAddNote={async (content) => {
                        if (!selectedLeadForHistory) return;
                        const { data: interactionData, error } = await supabase
                            .from('lead_interactions')
                            .insert(sanitizeForPostgres({
                                lead_id: selectedLeadForHistory.id,
                                agent_id: agent.id,
                                type: 'note',
                                content: content
                            }))
                            .select()
                            .single();

                        if (error) {
                            addToast("Erreur lors de l'ajout de la note", "error");
                            throw error;
                        }

                        if (interactionData) {
                            const newInteraction = {
                                id: interactionData.id,
                                type: 'note',
                                content: interactionData.content,
                                createdAt: interactionData.created_at
                            };

                             setLeads((prev: StudentLead[]) => prev.map((l: any) =>
                                l.id === selectedLeadForHistory?.id
                                    ? { ...l, interactions: [newInteraction, ...(l.interactions || [])] }
                                    : l
                            ));

                            // Update the local reference for the modal as well
                            setSelectedLeadForHistory((prev: any) => {
                                if (!prev) return null;
                                return {
                                    ...prev,
                                    interactions: [newInteraction, ...(prev.interactions || [])]
                                };
                            });

                            addToast("Note enregistrée avec succès", "success");
                        }
                    }}
                />

                {/* AI Resolution Side Panel */}
                <div className={`ai-side-panel ${showAiDetails ? 'open' : ''}`} style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                    <div className="ai-side-panel-header" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ padding: '10px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', borderRadius: '12px' }}>
                                <Sparkles size={20} color="white" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Elite Resolution</h3>
                                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Diagnostic Intelligence</p>
                            </div>
                        </div>
                        <button onClick={() => setShowAiDetails(false)} className="btn btn-ghost" style={{ width: '36px', height: '36px', padding: 0 }}>
                            <X size={18} />
                        </button>
                    </div>

                    <div className="ai-side-panel-content" style={{ padding: '1.5rem' }}>
                        {aiAlerts.map((alert, aIdx) => (
                            <div key={aIdx} style={{ marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h5 style={{ fontSize: '0.75rem', fontWeight: 800, color: alert.type === 'duplicate' ? 'var(--warning)' : 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {alert.type === 'duplicate' ? <Users size={14} /> : <Zap size={14} />}
                                        {alert.type === 'duplicate' ? 'DOUBLONS' : 'FORMATS'}
                                    </h5>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{alert.count} cas</span>
                                </div>

                                {alert.details?.map((detail: string, idx: number) => {
                                    const nameMatch = detail.split('(')[0].trim();
                                    return (
                                        <div key={idx} className="card" style={{ padding: '0.75rem', marginBottom: '0.5rem', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }} onClick={() => {
                                            const leadId = alert.leadIds[idx];
                                            setHighlightedLeadId(leadId);
                                            setTimeout(() => setHighlightedLeadId(null), 3000);
                                            setSearchQuery(nameMatch);
                                        }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{nameMatch}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                                                {detail.includes('➔') ? detail.split('(')[1].replace(')', '') : detail}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    <div className="ai-side-panel-footer" style={{ padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <button
                            onClick={handleMassHarmonize}
                            disabled={isHarmonizing}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '0.875rem', fontWeight: 800 }}
                        >
                            {isHarmonizing ? <Activity size={18} className="animate-spin" /> : <Sparkles size={18} />}
                            {isHarmonizing ? 'Harmonisation...' : 'Tout Nettoyer'}
                        </button>
                </div>
            </div>
        </div>
    );
};

export default AgentStatsModal;
