import React, { useState } from 'react';
import { X, CheckCircle2, UserCheck, Activity, Users, PieChart, PhoneOff, Zap, Award, Sparkles, Search, Filter, CheckSquare, Square, UserPlus, ChevronDown, MessageSquare, TrendingUp, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import type { Agent } from '../types';
import { supabase } from '../supabaseClient';
import { smartParsePhone, sanitizeForPostgres, resolveCityToCountry, resolveGeographicTruth, COUNTRIES_DB } from '../utils/verificationService';
import { usePopup } from './Popup';
import * as XLSX from 'xlsx';
import { useToast } from './Toast';
import OutcomeModal from './OutcomeModal';
import LeadHistoryModal from './LeadHistoryModal';



interface AgentStatsModalProps {
    agent: Agent | null;
    leads: any[];
    setLeads: React.Dispatch<React.SetStateAction<any[]>>;
    statuses: any[];
    agents: Agent[];
    campaigns: any[];
    onClose: () => void;
    onRefresh?: () => Promise<void>;
}

// --- CONFIGURATION DE RÉFÉRENCE NATIONALE (Désormais centralisée dans verificationService) ---


const AgentStatsModal: React.FC<AgentStatsModalProps> = ({ agent, leads, setLeads, statuses, agents, campaigns, onClose, onRefresh }) => {
    const { addToast } = useToast();
    const { showConfirm } = usePopup();
    const [selectedLeadForOutcome, setSelectedLeadForOutcome] = useState<any | null>(null);
    const [selectedLeadForHistory, setSelectedLeadForHistory] = useState<any | null>(null);
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

    // --- LOGIQUE DE DONNÉES ET FILTRAGE STRATÉGIQUE ---
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
        const avgScore = total > 0 ? Math.round(filteredLeadsByCampaign.reduce((acc, curr) => acc + (curr.score || 0), 0) / total) : 0;

        const fieldCounts = filteredLeadsByCampaign.reduce((acc: any, curr) => {
            const field = curr.fieldOfInterest || 'Non spécifié';
            acc[field] = (acc[field] || 0) + 1;
            return acc;
        }, {});
        const topFields = Object.entries(fieldCounts).sort(([, a]: any, [, b]: any) => b - a).slice(0, 3);

        return { total, nonContacted, contacted, pasRepondu, reached, inscribed, conversion, contact, avgScore, topFields };
    }, [filteredLeadsByCampaign]);

    const { total: totalLeads, nonContacted: nonContactedCount, contacted: contactedLeadsCount, pasRepondu: pasReponduCount, inscribed: inscribedLeadsCount, conversion: conversionRate, contact: contactRate, avgScore, topFields } = stats;

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

    const formatIntelligentPhone = React.useCallback((phone: string, countryInfo: any) => {
        if (!phone || phone === 'N/A') return phone;
        let digits = phone.replace(/\D/g, '');
        if (digits.startsWith('00')) digits = digits.substring(2);
        const allPrefixes = COUNTRIES_DB.map(c => c.id).sort((a,b) => b.length - a.length);
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
        setLeads((prev: any[]) => prev.map(l => l.id === leadId ? { ...l, statusId: newStatusId, status: newStatus, metadata: newMetadata } : l));
        await supabase.from('leads').update({ status_id: newStatusId, metadata: newMetadata }).eq('id', leadId);
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
                return matchesSearch && matchesStatus && matchesCountry;
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
            'score': 'Score',
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

    const getPhaseLabel = (lead: any) => {
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

            setLeads((prev: any[]) => prev.map(l => selectedLeadIds.includes(l.id) ? { ...l, agentId: targetAgentId } : l));
            addToast(`${selectedLeadIds.length} prospects réattribués avec succès !`, "success");
            setSelectedLeadIds([]);
            setShowReassignDropdown(false);
        } catch (error) {
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
        } catch (error) {
            addToast("Erreur lors de la répartition IA.", "error");
        } finally {
            setIsReassigning(false);
        }
    };

    const handleSelectAll = (filteredLeads: any[]) => {
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

                const updates: any = {};
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
                        let phoneDigits = (updates.phone || lead.phone).replace(/\D/g, '');
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

                const cleanFirst = (lead.firstName || '').trim().split(' ').map((s: any) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
                const cleanLast = (lead.lastName || '').trim().toUpperCase();
                if (cleanFirst && cleanFirst !== lead.firstName) { updates.firstName = cleanFirst; hasChanges = true; }
                if (cleanLast && cleanLast !== lead.lastName) { updates.lastName = cleanLast; hasChanges = true; }

                const cleanEmail = (lead.email || '').trim().toLowerCase();
                if (cleanEmail && cleanEmail !== lead.email) { updates.email = cleanEmail; hasChanges = true; }

                // --- COLLECTE DES CHANGEMENTS RÉELS ---
                if (hasChanges) {
                    // On ne garde que les champs CRM purs pour l'update
                    const cleanUpdates: any = {};
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
                        console.error(`Erreur Lead ${item.id}:`, error.message);
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: window.innerWidth < 768 ? '0' : '1.5rem' }} onClick={onClose}>
            <div className="card" style={{ width: '100%', maxWidth: '100vw', height: window.innerWidth < 768 ? '100vh' : '96vh', maxHeight: '100vh', overflowY: 'auto', background: '#0a0b0d', borderRadius: window.innerWidth < 768 ? '0' : '32px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
                
                <div style={{ padding: window.innerWidth < 768 ? '1.5rem' : '2rem 3rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: window.innerWidth < 768 ? '0.75rem' : '2rem' }}>
                        <div style={{ width: window.innerWidth < 768 ? '40px' : '74px', height: window.innerWidth < 768 ? '40px' : '74px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'grid', placeItems: 'center', fontWeight: 900, color: 'white', fontSize: window.innerWidth < 768 ? '1rem' : '1.75rem' }}>{agent?.name ? agent.name.split(' ').map((n: any) => n[0]).join('') : '?'}</div>
                        <div>
                            <h2 style={{ fontSize: window.innerWidth < 768 ? '1.25rem' : '2.5rem', fontWeight: 950, letterSpacing: '-0.04em', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{window.innerWidth < 768 ? 'Performance' : `Centre de Performance : ${agent?.name || 'Inconnu'}`}</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: window.innerWidth < 768 ? '0.75rem' : '1.125rem' }}>Vue stratégique 360° • Temps réel</p>
                        </div>
                    </div>

                    <button onClick={onClose} style={{ width: window.innerWidth < 768 ? '40px' : '50px', height: window.innerWidth < 768 ? '40px' : '50px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={window.innerWidth < 768 ? 24 : 30} /></button>
                </div>

                <div style={{ padding: window.innerWidth < 768 ? '1rem' : '2.5rem 3rem' }}>

                    
                    {/* LES 5 INDICATEURS MAÎTRES */}
                    <div className="stat-grid" style={{ marginBottom: '3rem' }}>
                        {[
                            { label: 'Inscrits', color: 'var(--success)', icon: <CheckCircle2 size={24} />, count: inscribedLeadsCount, detail: 'Résultat final' },
                            { label: 'Pas Répondu', color: '#f59e0b', icon: <PhoneOff size={24} />, count: pasReponduCount, detail: 'Appels sans réponse' },
                            { label: 'Contactés', color: '#10b981', icon: <UserCheck size={24} />, count: contactedLeadsCount, detail: 'Statut ≠ Nouveau' },
                            { label: 'Non Contactés', color: '#ef4444', icon: <Zap size={24} />, count: nonContactedCount, detail: 'Statut = Non Contacté' },
                            { label: 'Total Dossiers', color: 'var(--primary)', icon: <Users size={24} />, count: totalLeads, detail: 'Portefeuille total' }
                        ].map((s, i) => (
                            <div key={i} style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', color: s.color, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>{s.icon} {s.label}</div>
                                <div style={{ fontSize: '3rem', fontWeight: 950, color: 'white', lineHeight: 1 }}>{s.count}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '10px', fontWeight: 500 }}>{s.detail}</div>
                            </div>
                        ))}
                    </div>

                    {/* ANALYTICS COMPLEXE */}
                    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3.5rem' }}>
                        
                        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '32px', padding: window.innerWidth < 768 ? '1.5rem' : '2.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                                <Activity size={24} color="var(--primary)" />
                                <h3 style={{ fontSize: window.innerWidth < 768 ? '1.25rem' : '1.75rem', fontWeight: 900 }}>Efficacité</h3>
                            </div>
                            <div className="stat-grid" style={{ gap: '2rem' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.75rem' }}>Taux de Conversion</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 950, color: 'var(--success)' }}>{conversionRate}<span style={{fontSize: '1rem'}}>%</span></div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>Inscrits / Réel parlé</div>
                                    <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '15px' }}>
                                        <div style={{ height: '100%', width: `${conversionRate}%`, background: 'var(--success)', borderRadius: '3px' }}></div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.75rem' }}>Taux de Contact</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 950, color: 'var(--accent)' }}>{contactRate}<span style={{fontSize: '1rem'}}>%</span></div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>Contactés / Total</div>
                                    <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '15px' }}>
                                        <div style={{ height: '100%', width: `${contactRate}%`, background: 'var(--accent)', borderRadius: '3px' }}></div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.75rem' }}>Score Moyen</div>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 950, color: 'var(--warning)' }}>{avgScore}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>Moyenne qualité</div>
                                    <Award size={16} color="var(--warning)" style={{ marginTop: '10px' }} />
                                </div>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '32px', padding: '2.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                                <PieChart size={24} color="var(--accent)" />
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Top Filières</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {topFields.map(([field, count]: any, i) => (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 800 }}>{field}</span>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{count}</span>
                                        </div>
                                        <div style={{ height: '10px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '5px' }}>
                                            <div style={{ height: '100%', width: `${totalLeads > 0 ? (count/totalLeads)*100 : 0}%`, background: i === 0 ? 'var(--primary)' : i === 1 ? 'var(--accent)' : 'var(--warning)', borderRadius: '5px' }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* IA ASSISTANT AUTOMATIQUE BANNER */}
                    {aiAlerts.length > 0 && (
                        <div style={{
                            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08))',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            borderRadius: '24px',
                            padding: '1.5rem',
                            marginBottom: '3rem',
                            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
                            animation: 'fadeIn 0.5s ease'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <div style={{ 
                                        width: '48px', 
                                        height: '48px', 
                                        borderRadius: '14px', 
                                        background: 'linear-gradient(135deg, var(--primary), var(--accent))', 
                                        display: 'grid', 
                                        placeItems: 'center',
                                        boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)'
                                    }}>
                                        <Sparkles size={24} color="white" />
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: 800, margin: 0, fontSize: '1rem', color: 'white' }}>Assistant IA Elite</h4>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                                            Détection : {aiAlerts.map(a => `${a.count} ${a.type === 'duplicate' ? 'doublons' : 'erreurs de format'}`).join(' et ')}.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    {aiAlerts.length > 0 && (
                                        <button 
                                            onClick={() => setShowAiDetails(!showAiDetails)}
                                            style={{ color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            {showAiDetails ? 'Masquer' : 'Voir les Détails'}
                                        </button>
                                    )}
                                    <button 
                                        onClick={handleMassHarmonize}
                                        disabled={isHarmonizing}
                                        className="btn btn-primary" 
                                        style={{ padding: '0.6rem 1.2rem', borderRadius: '12px', fontSize: '0.85rem' }}
                                    >
                                        {isHarmonizing ? 'Nettoyage...' : 'Tout Nettoyer'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ONGLETS DE CAMPAGNRE (Multi-campagnes detectées) */}
                    {(agentCampaigns.length > 1 || selectedCampaignTab !== 'all') && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', width: 'fit-content' }}>
                            <button 
                                onClick={() => setSelectedCampaignTab('all')}
                                style={{ 
                                    padding: '10px 20px', 
                                    borderRadius: '12px', 
                                    border: 'none', 
                                    background: selectedCampaignTab === 'all' ? 'var(--primary)' : 'transparent',
                                    color: selectedCampaignTab === 'all' ? 'white' : 'var(--text-muted)',
                                    fontWeight: 700,
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Toutes les Campagnes ({leads.length})
                            </button>
                            {agentCampaigns.map(c => {
                                const count = leads.filter(l => l.campaignId === c.id).length;
                                return (
                                    <button 
                                        key={c.id}
                                        onClick={() => setSelectedCampaignTab(c.id)}
                                        style={{ 
                                            padding: '10px 20px', 
                                            borderRadius: '12px', 
                                            border: 'none', 
                                            background: selectedCampaignTab === c.id ? 'var(--primary)' : 'transparent',
                                            color: selectedCampaignTab === c.id ? 'white' : 'var(--text-muted)',
                                            fontWeight: 700,
                                            fontSize: '0.875rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {c.name} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* POINT GLOBAL DES STATUTS (VERSION AGENT) */}
                    <div className="card" style={{ marginBottom: '3rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px' }}>
                                    <TrendingUp size={24} color="var(--primary)" />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Performance Statuts {selectedCampaignTab !== 'all' ? `(${agentCampaigns.find(c => c.id === selectedCampaignTab)?.name})` : ''}</h3>
                            </div>
                            <button 
                                onClick={() => setShowAllStatus(!showAllStatus)}
                                className="btn" 
                                style={{ background: 'rgba(255,255,255,0.05)', color: 'white', borderRadius: '12px', fontSize: '0.875rem' }}
                            >
                                {showAllStatus ? 'Réduire' : 'Voir les 21 statuts'}
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                            {[
                                { id: 'inscrit', label: 'Inscrit', color: 'var(--success)' },
                                { id: 'admis', label: 'Admis', color: 'var(--accent)' },
                                { id: 'nouveau', label: 'Nouveau (Non Contacté)', color: 'var(--primary)' },
                                { id: 'injoignable', label: 'Injoignable/ Ne répond pas', color: '#f59e0b' },
                                { id: 'whatsapp_indisponible', label: 'WhatsApp Indisponible', color: '#94a3b8' }
                            ].map(st => {
                                const count = filteredLeadsByCampaign.filter(l => {
                                    const sid = (l.statusId || '').toLowerCase();
                                    const slabel = (l.status?.label || '').toLowerCase();
                                    
                                    // Robust matching
                                    if (st.id === 'nouveau') {
                                        return sid === 'nouveau' || sid === '' || sid === 'non_contacte' || slabel.includes('nouveau') || slabel.includes('non contacté') || slabel.includes('pas contacté');
                                    }
                                    
                                    if (st.id === 'inscrit') return ['inscrit', 'confirme'].some(k => sid.includes(k) || slabel.includes(k));
                                    if (st.id === 'admis') return sid === 'admis' || slabel.includes('admis');

                                    // Match by ID or Label (case-insensitive and partial for WhatsApp)
                                    return sid === st.id || slabel === st.label.toLowerCase() || (st.id === 'whatsapp_indisponible' && (slabel.includes('whatsapp') || sid.includes('whatsapp')));
                                }).length;
                                return (
                                    <div key={st.id} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{st.label}</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 950, color: 'white' }}>{count}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {showAllStatus && (
                            <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '2rem', background: 'rgba(0,0,0,0.2)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', animation: 'slideDown 0.3s ease-out' }}>
                                {[...statuses].sort((a, b) => a.label.localeCompare(b.label)).map(s => {
                                    const count = leads.filter(l => 
                                        l.statusId === s.id && 
                                        (selectedCampaignTab === 'all' || l.campaignId === selectedCampaignTab)
                                    ).length;
                                    return (
                                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px' }}>{s.label}</span>
                                            <span style={{ fontWeight: 900, color: 'white', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* DÉTAIL DYNAMIQUE */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ padding: '14px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '18px' }}><Users size={28} color="var(--primary)" /></div>
                                <h3 style={{ fontSize: '2rem', fontWeight: 950 }}>Registre des Prospects</h3>
                            </div>
                            
                            {/* Filtres Intelligents */}
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input 
                                        type="text" 
                                        placeholder="Rechercher par nom, email, tél..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="input" 
                                        style={{ paddingLeft: '45px', width: '100%', borderRadius: '14px', height: '45px' }} 
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <select 
                                            value={filterStatus}
                                            onChange={(e) => setFilterStatus(e.target.value)}
                                            className="input" 
                                            style={{ paddingLeft: '35px', borderRadius: '14px', height: '45px', minWidth: '150px' }}
                                        >
                                            <option value="all">Tous les Statuts</option>
                                            {[...statuses].sort((a, b) => a.label.localeCompare(b.label)).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <select 
                                            value={filterCountry}
                                            onChange={(e) => setFilterCountry(e.target.value)}
                                            className="input" 
                                            style={{ paddingLeft: '35px', borderRadius: '14px', height: '45px', minWidth: '150px' }}
                                        >
                                            <option value="all">Tous les Pays</option>
                                            {Array.from(new Set(leads.map(l => l.country).filter(Boolean))).sort().map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem' }}>
                                    {leads.filter(l => {
                                        const matchesSearch = (l.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.phone || '').includes(searchQuery);
                                        const matchesStatus = filterStatus === 'all' || l.statusId === filterStatus;
                                        const matchesCountry = filterCountry === 'all' || l.country === filterCountry;
                                        return matchesSearch && matchesStatus && matchesCountry;
                                    }).length} prospects trouvés
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button 
                                    onClick={handleMassHarmonize} 
                                    disabled={isHarmonizing}
                                    className="btn" 
                                    style={{ 
                                        padding: '0.9rem 2rem', 
                                        borderRadius: '18px', 
                                        fontSize: '0.9rem', 
                                        fontWeight: 800, 
                                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
                                        color: '#a855f7',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        border: '1px solid rgba(168, 85, 247, 0.2)',
                                        boxShadow: '0 0 15px rgba(168, 85, 247, 0.1)'
                                    }}
                                >
                                    <Sparkles size={16} className={isHarmonizing ? 'animate-spin' : ''} />
                                    {isHarmonizing ? 'Analyse IA...' : 'Assistant IA'}
                                </button>
                                <button 
                                    onClick={() => handleExport(['firstName', 'lastName', 'email', 'phone', 'country', 'statusId', 'fieldOfInterest', 'score', 'notes'])} 
                                    className="btn btn-primary" 
                                    style={{ padding: '0.9rem 2.5rem', borderRadius: '18px', fontSize: '1rem', fontWeight: 900 }}
                                >
                                    Exporter XLS
                                </button>
                            </div>
                        </div>

                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '50px' }}>
                                            <button 
                                                onClick={() => {
                                                    const filteredItems = leads.filter(l => {
                                                        const matchesSearch = (l.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.phone || '').includes(searchQuery);
                                                        const matchesStatus = filterStatus === 'all' || l.statusId === filterStatus;
                                                        const matchesCountry = filterCountry === 'all' || l.country === filterCountry;
                                                        return matchesSearch && matchesStatus && matchesCountry;
                                                    });
                                                    handleSelectAll(filteredItems);
                                                }}
                                                style={{ background: 'transparent', border: 'none', color: selectedLeadIds.length > 0 ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                                            >
                                                {selectedLeadIds.length > 0 ? <CheckSquare size={22} /> : <Square size={22} />}
                                            </button>
                                        </th>
                                        <th style={{ padding: '1.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 800 }}>Prospect</th>
                                        <th style={{ padding: '1.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 800 }}>Contact & Pays</th>
                                        <th style={{ padding: '1.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 800 }}>Statut CRM</th>
                                        <th style={{ padding: '1.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 800 }}>Modification Statut</th>
                                        <th style={{ padding: '1.75rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>Score</th>
                                        <th style={{ padding: '1.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 800 }}>Dernière Note</th>
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
                                            const matchesCampaign = selectedCampaignTab === 'all' || l.campaignId === selectedCampaignTab;
                                            
                                            // ISOLATION IA
                                            if (filterOnlyProblems) {
                                                const currentAlert = aiAlerts.find(a => a.type === filterOnlyProblems) as any;
                                                if (!currentAlert?.leadIds?.includes(l.id)) return false;
                                            }

                                            return matchesSearch && matchesStatus && matchesCountry && matchesCampaign;
                                        }).sort((a,b) => (b.score || 0) - (a.score || 0));

                                        const startIndex = (currentPage - 1) * itemsPerPage;
                                        return filtered.slice(startIndex, startIndex + itemsPerPage);
                                    })()
                                        .map((lead: any) => {
                                        const phase = getPhaseLabel(lead);
                                        const countryInfo = findCountryInfo(lead.country, lead.phone);
                                        const intelligentPhone = formatIntelligentPhone(lead.phone, countryInfo);
                                        const sid = (lead.statusId || '').toLowerCase();
                                        const isFailed = (sid.includes('injoignable') || sid.includes('repondeur'));
                                        
                                        return (
                                            <tr key={lead.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'all 0.4s ease', background: highlightedLeadId === lead.id ? 'rgba(99, 102, 241, 0.15)' : selectedLeadIds.includes(lead.id) ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }} className={`hover-row ${highlightedLeadId === lead.id ? 'highlighted-row' : ''}`}>
                                                <td style={{ padding: '1.75rem', textAlign: 'center' }}>
                                                    <button 
                                                        onClick={() => toggleLeadSelection(lead.id)}
                                                        style={{ background: 'transparent', border: 'none', color: selectedLeadIds.includes(lead.id) ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                                                    >
                                                        {selectedLeadIds.includes(lead.id) ? <CheckSquare size={22} /> : <Square size={22} />}
                                                    </button>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                        <div style={{ fontWeight: 900, fontSize: '1.25rem' }}>{lead.firstName} {lead.lastName}</div>
                                                        {lead.metadata?.everReached && <div style={{ fontSize: '0.7rem', background: 'rgba(34, 197, 94, 0.15)', color: '#10b981', padding: '4px 12px', borderRadius: '12px', fontWeight: 900 }}>Contact OK</div>}
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '6px' }}>{lead.email}</div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'white' }}>{intelligentPhone}</span>
                                                    </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                           📍 {countryInfo ? countryInfo.name : (lead.country || 'Pays inconnu')}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: isFailed ? '#94a3b8' : 'var(--accent)', textTransform: 'uppercase', marginBottom: '6px' }}>{phase}</div>
                                                    <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>{lead.status?.label || lead.statusId}</div>
                                                </td>
                                                <td>
                                                    <select value={lead.statusId} onChange={(e) => handleUpdateStatus(lead.id, e.target.value)} className="input" style={{ borderRadius: '14px', width: '100%', maxWidth: '200px', fontWeight: 700 }}>
                                                        {[...statuses].sort((a, b) => a.label.localeCompare(b.label)).map((s: any) => (
                                                            <option key={s.id} value={s.id}>{s.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 950, color: lead.score > 50 ? 'var(--success)' : 'var(--text-muted)' }}>{lead.score || 0}</div>
                                                </td>
                                                <td>
                                                     <div 
                                                        onClick={() => setSelectedLeadForHistory(lead)} 
                                                        style={{ 
                                                            fontSize: '0.875rem', 
                                                            cursor: 'pointer', 
                                                            background: 'rgba(255,255,255,0.03)', 
                                                            padding: '12px', 
                                                            borderRadius: '15px', 
                                                            border: '1px solid rgba(255,255,255,0.1)', 
                                                            height: '60px', 
                                                            overflowY: 'hidden',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '4px',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                                        onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                                                     >
                                                         <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                             <MessageSquare size={10} /> VOIR HISTORIQUE
                                                         </div>
                                                         <div style={{ fontSize: '0.8rem', color: 'white', opacity: lead.notes ? 1 : 0.3 }}>
                                                            {lead.notes ? lead.notes.substring(0, 40) + (lead.notes.length > 40 ? "..." : "") : "Aucune note..."}
                                                         </div>
                                                     </div>
                                                 </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* PAGINATION ELITE */}
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
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>sur {filtered.length} prospects</span>
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
                    </div>
                </div>

                <div style={{ padding: '2.5rem 3.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)' }}>
                    <button className="btn btn-primary" style={{ padding: '1.25rem 4rem', borderRadius: '20px', fontWeight: 950, fontSize: '1.125rem' }} onClick={onClose}>Fermer le Management</button>
                    
                    {/* BARRE D'ACTION BULK (FLOTTANTE ET FIXE POUR VISIBILITÉ) */}
                    {selectedLeadIds.length > 0 && (
                        <div style={{ 
                            position: 'fixed', 
                            bottom: '40px', 
                            left: '50%', 
                            transform: 'translateX(-50%)', 
                            background: 'var(--primary)', 
                            padding: '16px 32px', 
                            borderRadius: '24px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '24px', 
                            boxShadow: '0 20px 60px rgba(99, 102, 241, 0.6)', 
                            zIndex: 2000, 
                            border: '1px solid rgba(255,255,255,0.3)',
                            animation: 'slideUp 0.3s ease-out'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'white', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontWeight: 950, fontSize: '1rem' }}>{selectedLeadIds.length}</div>
                                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white' }}>Sélectionné(s)</span>
                            </div>
                            
                            <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>
                            
                            <div style={{ position: 'relative' }}>
                                <button 
                                    onClick={() => setShowReassignDropdown(!showReassignDropdown)}
                                    className="btn" 
                                    disabled={isReassigning}
                                    style={{ 
                                        background: 'white', 
                                        color: 'black', 
                                        borderRadius: '16px', 
                                        padding: '12px 24px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '12px', 
                                        fontWeight: 900, 
                                        fontSize: '1rem',
                                        boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {isReassigning ? <Activity className="animate-spin" size={20} /> : <UserPlus size={20} />}
                                    {isReassigning ? 'Transfert...' : 'Lancer le transfert'} <ChevronDown size={14} />
                                </button>
                                
                                {showReassignDropdown && (
                                    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '20px', width: '300px', background: '#1a1b1e', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
                                        <div style={{ padding: '14px 20px', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Choisir le destinataire</div>
                                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            {agents.filter(a => a.id !== agent?.id).map(a => (
                                                <button 
                                                    key={a.id} 
                                                    onClick={() => handleBulkAssign(a.id)}
                                                    style={{ width: '100%', padding: '16px 20px', background: 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '15px' }}
                                                    className="reassign-option"
                                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                                >
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', fontSize: '1rem', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{a.name[0]}</div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 750, fontSize: '1rem' }}>{a.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.leadsAssigned} prospects en cours</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        <div style={{ padding: '15px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                            <button 
                                                style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #a855f7, #6366f1)', border: 'none', borderRadius: '15px', color: 'white', fontWeight: 950, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(168, 85, 247, 0.4)' }}
                                                onClick={handleSmartAutoBalance}
                                            >
                                                <Sparkles size={18} /> Lancement IA Auto-Balance
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <button onClick={() => setSelectedLeadIds([])} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'grid', placeItems: 'center', transition: 'all 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}><X size={20} /></button>
                        </div>
                    )}
                </div>

                <OutcomeModal isOpen={!!selectedLeadForOutcome} lead={selectedLeadForOutcome} onClose={() => setSelectedLeadForOutcome(null)} onUpdate={(id, up) => setLeads(prev => prev.map(l => l.id === id ? { ...l, ...up } : l))} />
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
                            
                            setLeads((prev: any[]) => prev.map(l => 
                                l.id === selectedLeadForHistory.id 
                                ? { ...l, interactions: [newInteraction, ...(l.interactions || [])] } 
                                : l
                            ));
                            
                            // Update the local reference for the modal as well
                            setSelectedLeadForHistory((prev: any) => ({
                                ...prev,
                                interactions: [newInteraction, ...(prev.interactions || [])]
                            }));
                            
                            addToast("Note enregistrée avec succès", "success");
                        }
                    }}
                />

                {/* ELITE AI DIAGNOSTIC SIDE PANEL */}
                <div className={`ai-side-panel ${showAiDetails ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                    <div className="ai-side-panel-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ padding: '10px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', borderRadius: '12px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
                                <Sparkles size={20} color="white" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>Elite Resolution</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Diagnostic Intelligence</p>
                            </div>
                        </div>
                        <button onClick={() => setShowAiDetails(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className="ai-side-panel-content">
                        {aiAlerts.map((alert, aIdx) => (
                            <div key={aIdx} style={{ marginBottom: '2.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h5 style={{ fontSize: '0.85rem', fontWeight: 900, color: alert.type === 'duplicate' ? 'var(--warning)' : alert.type === 'format' ? 'var(--accent)' : '#10b981', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {alert.type === 'duplicate' ? <Users size={16} /> : alert.type === 'format' ? <Zap size={16} /> : <Globe size={16} />}
                                        {alert.type === 'duplicate' ? 'DOUBLONS DÉTECTÉS' : alert.type === 'format' ? 'ERREURS DE FORMAT' : 'UNIFORMISATION PAYS'}
                                    </h5>
                                    <div className={`ai-badge ${alert.type === 'duplicate' ? 'ai-badge-duplicate' : alert.type === 'format' ? 'ai-badge-format' : 'ai-badge-country'}`}>
                                        {alert.count} cas
                                    </div>
                                </div>

                                {alert.details?.map((detail: string, idx: number) => {
                                    const nameMatch = detail.split('(')[0].trim();
                                    return (
                                        <div key={idx} className="diagnostic-card" onClick={() => {
                                            const leadId = alert.leadIds[idx];
                                            setHighlightedLeadId(leadId);
                                            setTimeout(() => setHighlightedLeadId(null), 3000);

                                            // On filtre le tableau pour montrer ce prospect précis si pas déjà filtré
                                            if (!filterOnlyProblems) {
                                                setSearchQuery(nameMatch);
                                            }
                                            
                                            const tableElement = document.querySelector('.table-container');
                                            if (tableElement) tableElement.scrollIntoView({ behavior: 'smooth' });
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>{nameMatch}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                                                        {detail.includes('➔') ? detail.split('(')[1].replace(')', '') : detail}
                                                    </div>
                                                </div>
                                                <button style={{ background: 'rgba(99, 102, 241, 0.1)', border: 'none', color: 'var(--primary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800 }}>
                                                    VOIR
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                <button 
                                    onClick={() => setFilterOnlyProblems(filterOnlyProblems === alert.type ? null : alert.type)}
                                    style={{ 
                                        marginTop: '1rem',
                                        width: '100%',
                                        padding: '14px',
                                        background: filterOnlyProblems === alert.type ? 'var(--primary)' : 'rgba(99, 102, 241, 0.1)',
                                        border: '1px solid ' + (filterOnlyProblems === alert.type ? 'var(--primary)' : 'rgba(99, 102, 241, 0.2)'),
                                        borderRadius: '15px',
                                        color: filterOnlyProblems === alert.type ? 'white' : 'var(--primary)',
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <Filter size={16} />
                                    {filterOnlyProblems === alert.type ? 'DÉSACTIVER FOCUS' : `ACTIVER FOCUS SUR LES ${alert.count} CAS`}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="ai-side-panel-footer">
                        <button 
                            onClick={handleMassHarmonize}
                            disabled={isHarmonizing}
                            style={{ 
                                width: '100%', 
                                padding: '1.25rem', 
                                borderRadius: '18px', 
                                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                                border: 'none',
                                color: 'white',
                                fontWeight: 900,
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                boxShadow: '0 10px 25px rgba(99, 102, 241, 0.3)',
                                cursor: 'pointer'
                            }}
                        >
                            {isHarmonizing ? <Activity size={20} className="animate-spin" /> : <Sparkles size={20} />}
                            {isHarmonizing ? 'HARMONISATION...' : 'TOUT NETTOYER MAINTENANT'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentStatsModal;
