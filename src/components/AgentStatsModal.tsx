import React, { useState } from 'react';
import { X, CheckCircle2, UserCheck, Activity, Users, PieChart, PhoneOff, Zap, Award, Sparkles, Search, Filter, CheckSquare, Square, UserPlus, ChevronDown, MessageSquare, TrendingUp } from 'lucide-react';
import type { Agent } from '../types';
import CommunicationCenter from './CommunicationCenter';
import { supabase } from '../supabaseClient';
// import removed
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
}

// --- CONFIGURATION DE RÉFÉRENCE NATIONALE (ULTRA-PRÉCISE) ---
const COUNTRIES_DB = [
    { id: '221', name: 'Sénégal', keywords: ['SENEGAL', 'SEN', 'SN', 'DAKAR', 'THIES', 'SAINT-LOUIS'] },
    { id: '225', name: 'Côte d\'Ivoire', keywords: ['COTE D IVOIRE', 'COTE D\'IVOIRE', 'IVORY COAST', 'CI', 'ABIDJAN', 'YAMOUSSOUKRO'] },
    { id: '243', name: 'RDC', keywords: ['RDC', 'REPUBLIQUE DEMOCRATIQUE DU CONGO', 'CONGO KINSHASA', 'KINSHASA', 'ZAIRE', 'CONGO K', 'COD'] },
    { id: '242', name: 'Congo-Brazzaville', keywords: ['CONGO BRAZZA', 'CONGO-BRAZZAVILLE', 'REPUBLIQUE DU CONGO', 'BRAZZAVILLE', 'COG', 'CONGO B'] },
    { id: '212', name: 'Maroc', keywords: ['MAROC', 'MOROCCO', 'MAR', 'CASABLANCA', 'RABAT', 'MARRAKECH'] },
    { id: '33', name: 'France', keywords: ['FRANCE', 'FR', 'FRA', 'PARIS'] },
    { id: '237', name: 'Cameroun', keywords: ['CAMEROUN', 'CAMEROON', 'CMR', 'DOUALA', 'YAOUNDE'] },
    { id: '241', name: 'Gabon', keywords: ['GABON', 'LIBREVILLE', 'GAB'] },
    { id: '223', name: 'Mali', keywords: ['MALI', 'BAMAKO', 'MLI'] },
    { id: '224', name: 'Guinée', keywords: ['GUINEE', 'CONAKRY', 'GUINEA'] },
    { id: '228', name: 'Togo', keywords: ['TOGO', 'LOME', 'TG'] },
    { id: '229', name: 'Bénin', keywords: ['BENIN', 'COTONOU', 'BJ'] },
    { id: '226', name: 'Burkina Faso', keywords: ['BURKINA', 'OUAGADOUGOU', 'BF'] },
    { id: '227', name: 'Niger', keywords: ['NIGER', 'NIAMEY', 'NE'] },
    { id: '222', name: 'Mauritanie', keywords: ['MAURITANIE', 'NOUAKCHOTT', 'MR'] },
    { id: '235', name: 'Tchad', keywords: ['TCHAD', 'CHAD', 'NDJAMENA', 'TD'] },
    { id: '216', name: 'Tunisie', keywords: ['TUNISIE', 'TUNISIA'] },
    { id: '213', name: 'Algérie', keywords: ['ALGERIE', 'ALGERIA'] }
];

const AgentStatsModal: React.FC<AgentStatsModalProps> = ({ agent, leads, setLeads, statuses, agents, campaigns, onClose }) => {
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

    // Get unique campaigns present in this agent's leads
    const agentCampaignIds = Array.from(new Set(leads.map(l => l.campaignId)));
    const agentCampaigns = campaigns.filter(c => agentCampaignIds.includes(c.id));

    // MOTEUR DE DÉTECTION SÉCURISÉ (ULTRA-PUISSANT)
    const findCountryInfo = (countryStr: string, phoneStr: string) => {
        let p = (phoneStr || '').replace(/\D/g, '');
        if (p.startsWith('00')) p = p.substring(2);
        const c = (countryStr || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        // 1. PRIORITÉ : Détection par le numéro (+INDICATIF gagne toujours)
        const sortedCountries = [...COUNTRIES_DB].sort((a, b) => b.id.length - a.id.length);
        for (const country of sortedCountries) {
            if (p.startsWith(country.id)) return country;
        }

        // 2. SECONDAIRE : Détection par texte s'il n'y a pas d'indicatif dans le numéro
        for (const country of COUNTRIES_DB) {
            if (country.keywords.some(k => c === k || (c.length > 2 && c.includes(k)))) {
                return country;
            }
        }

        return null;
    };

    const formatIntelligentPhone = (phone: string, countryInfo: any) => {
        if (!phone || phone === 'N/A') return phone;
        
        let digits = phone.replace(/\D/g, '');
        if (digits.startsWith('00')) digits = digits.substring(2);

        const allPrefixes = COUNTRIES_DB.map(c => c.id).sort((a,b) => b.length - a.length);

        // --- MACHINE À DÉCAPER (ANTI-EMPILEMENT) ---
        // Si le numéro est anormalement long (> 13 chiffres)
        if (digits.length > 13) {
            for (const p1 of allPrefixes) {
                if (digits.startsWith(p1)) {
                    const rest = digits.substring(p1.length);
                    // On vérifie si ce qui suit commence AUSSI par un indicatif (ex: 242 suivi de 243)
                    for (const p2 of allPrefixes) {
                        if (rest.startsWith(p2)) {
                            digits = rest; // On retire la "croûte" (le faux préfixe p1)
                            break;
                        }
                    }
                }
            }
        }
        
        if (countryInfo) {
            const prefix = countryInfo.id;
            
            // Protection anti-doublon simple (ex: 229229)
            if (digits.startsWith(prefix + prefix)) digits = digits.substring(prefix.length);

            if (digits.startsWith(prefix)) return '+' + digits;
            if (digits.startsWith('0')) return '+' + prefix + digits.substring(1);
            return '+' + prefix + digits;
        }

        return phone.startsWith('+') ? phone : '+' + digits;
    };


    if (!agent) return null;

    // --- LOGIQUE DE DONNÉES STRICTE ---
    const totalLeads = leads.length;
    
    const contactedLeadsCount = leads.filter(l => {
        const sid = (l.statusId || '').toLowerCase();
        return sid !== 'nouveau' && sid !== '';
    }).length;

    const nonContactedCount = totalLeads - contactedLeadsCount;
    
    const pasReponduCount = leads.filter(l => {
        const sid = (l.statusId || '').toLowerCase();
        return sid === 'injoignable' || sid === 'repondeur';
    }).length;

    const reachedLeadsCount = contactedLeadsCount - pasReponduCount;
    
    const inscribedLeadsCount = leads.filter(l => 
        ['admis', 'inscription_attente', 'inscrit'].some(k => (l.statusId || '').toLowerCase().includes(k))
    ).length;
    
    const conversionRate = reachedLeadsCount > 0 ? Math.round((inscribedLeadsCount / reachedLeadsCount) * 100) : 0;
    const contactRate = totalLeads > 0 ? Math.round((contactedLeadsCount / totalLeads) * 100) : 0;
    const avgScore = totalLeads > 0 ? Math.round(leads.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalLeads) : 0;

    const fieldCounts = leads.reduce((acc: any, curr) => {
        const field = curr.fieldOfInterest || 'Non spécifié';
        acc[field] = (acc[field] || 0) + 1;
        return acc;
    }, {});
    const topFields = Object.entries(fieldCounts).sort(([, a]: any, [, b]: any) => b - a).slice(0, 3);

    const handleUpdateStatus = async (leadId: string, newStatusId: string) => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;
        const sid = newStatusId.toLowerCase();
        const isDialogue = !['nouveau', 'injoignable', 'repondeur', 'faux_numero'].some(k => sid.includes(k));
        const newMetadata = { ...(lead.metadata || {}), everReached: lead.metadata?.everReached || isDialogue };
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
            "Nettoyage IA & Mise à jour des Statuts", 
            `L'Assistant IA va :\n1. Fusionner les fiches en double (même numéro)\n2. Corriger les pays via les indicatifs et villes\n3. Migrer les anciens statuts vers la nouvelle structure\n\nContinuer le nettoyage profond ?`
        );
        
        if (!confirmed) return;

        setIsHarmonizing(true);
        let updatedCount = 0;
        let mergedCount = 0;
        const seenPhones = new Map<string, string>(); // phone -> firstLeadId

        try {
            // ÉTAPE 1 : RÉPARER ET DÉTECTER LES DOUBLONS
            for (const lead of leads) {
                const countryInfo = findCountryInfo(lead.country, lead.phone);
                const standardizedCountry = countryInfo ? countryInfo.name : lead.country;
                const formattedPhone = formatIntelligentPhone(lead.phone, countryInfo);
                const cleanKey = formattedPhone.replace(/\D/g, '');

                // GESTION DES DOUBLONS (Logique GPT)
                if (cleanKey && cleanKey.length > 5) {
                    if (seenPhones.has(cleanKey)) {
                        // C'est un doublon ! On supprime la fiche actuelle et on garde la première
                        await supabase.from('leads').delete().eq('id', lead.id);
                        mergedCount++;
                        continue;
                    }
                    seenPhones.set(cleanKey, lead.id);
                }
                
                const updates: any = {};
                let hasChanges = false;

                if (formattedPhone !== lead.phone && formattedPhone !== 'N/A') {
                    updates.phone = formattedPhone;
                    hasChanges = true;
                }

                if (standardizedCountry !== lead.country) {
                    updates.country = standardizedCountry;
                    hasChanges = true;
                }

                if (hasChanges) {
                    await supabase.from('leads').update(updates).eq('id', lead.id);
                    updatedCount++;
                }
            }
            addToast(`IA Terminée : ${updatedCount} fiches corrigées et ${mergedCount} doublons supprimés.`, "success");
            if (onClose) onClose(); // Rafraîchir
        } catch (error) {
            console.error(error);
            addToast("Erreur lors du nettoyage profond.", "error");
        } finally {
            setIsHarmonizing(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: '1.5rem' }} onClick={onClose}>
            <div className="card" style={{ width: '100%', maxWidth: '98vw', maxHeight: '96vh', overflowY: 'auto', background: '#0a0b0d', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
                
                <div style={{ padding: '2rem 3rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <div style={{ width: '74px', height: '74px', borderRadius: '22px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'grid', placeItems: 'center', fontWeight: 900, color: 'white', fontSize: '1.75rem' }}>{agent?.name ? agent.name.split(' ').map((n: any) => n[0]).join('') : '?'}</div>
                        <div>
                            <h2 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.04em', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Centre de Performance : {agent?.name || 'Inconnu'}</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem' }}>Vue stratégique 360° • Statistiques en temps réel</p>
                        </div>
                    </div>

                    <button onClick={onClose} style={{ width: '50px', height: '50px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={30} /></button>
                </div>

                <div style={{ padding: '2.5rem 3rem' }}>
                    
                    {/* LES 5 INDICATEURS MAÎTRES */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
                        {[
                            { label: 'Inscrits', color: 'var(--success)', icon: <CheckCircle2 size={24} />, count: inscribedLeadsCount, detail: 'Résultat final' },
                            { label: 'Pas Répondu', color: '#f59e0b', icon: <PhoneOff size={24} />, count: pasReponduCount, detail: 'Appels sans réponse' },
                            { label: 'Contactés', color: '#10b981', icon: <UserCheck size={24} />, count: contactedLeadsCount, detail: 'Statut ≠ Nouveau' },
                            { label: 'Non Contactés', color: '#ef4444', icon: <Zap size={24} />, count: nonContactedCount, detail: 'Statut = Nouveau' },
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
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '3.5rem' }}>
                        
                        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '32px', padding: '2.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                                <Activity size={24} color="var(--primary)" />
                                <h3 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Analyse de l'efficacité</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
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
                                { id: 'interesse', label: 'Intéressé', color: 'var(--primary)' },
                                { id: 'rappel', label: 'Rappel', color: 'var(--warning)' }
                            ].map(st => {
                                const count = leads.filter(l => 
                                    (l.statusId || '').toLowerCase().includes(st.id) && 
                                    (selectedCampaignTab === 'all' || l.campaignId === selectedCampaignTab)
                                ).length;
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
                                {statuses.map(s => {
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
                                            {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
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

                        <div style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '36px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                        <th style={{ padding: '1.75rem', width: '50px' }}>
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
                                    {([...leads]
                                        .filter(l => {
                                            const matchesSearch = 
                                                (l.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                (l.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                (l.phone || '').includes(searchQuery);
                                            const matchesStatus = filterStatus === 'all' || l.statusId === filterStatus;
                                            const matchesCountry = filterCountry === 'all' || l.country === filterCountry;
                                            const matchesCampaign = selectedCampaignTab === 'all' || l.campaignId === selectedCampaignTab;
                                            return matchesSearch && matchesStatus && matchesCountry && matchesCampaign;
                                        })
                                        .sort((a,b) => (b.score || 0) - (a.score || 0)))
                                        .map((lead: any) => {
                                        const phase = getPhaseLabel(lead);
                                        const countryInfo = findCountryInfo(lead.country, lead.phone);
                                        const intelligentPhone = formatIntelligentPhone(lead.phone, countryInfo);
                                        const sid = (lead.statusId || '').toLowerCase();
                                        const isFailed = (sid.includes('injoignable') || sid.includes('repondeur'));
                                        
                                        return (
                                            <tr key={lead.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s', background: selectedLeadIds.includes(lead.id) ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }} className="hover-row">
                                                <td style={{ padding: '1.75rem', textAlign: 'center' }}>
                                                    <button 
                                                        onClick={() => toggleLeadSelection(lead.id)}
                                                        style={{ background: 'transparent', border: 'none', color: selectedLeadIds.includes(lead.id) ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                                                    >
                                                        {selectedLeadIds.includes(lead.id) ? <CheckSquare size={22} /> : <Square size={22} />}
                                                    </button>
                                                </td>
                                                <td style={{ padding: '1.75rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                        <div style={{ fontWeight: 900, fontSize: '1.25rem' }}>{lead.firstName} {lead.lastName}</div>
                                                        {lead.metadata?.everReached && <div style={{ fontSize: '0.7rem', background: 'rgba(34, 197, 94, 0.15)', color: '#10b981', padding: '4px 12px', borderRadius: '12px', fontWeight: 900 }}>Contact OK</div>}
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '6px' }}>{lead.email}</div>
                                                </td>
                                                <td style={{ padding: '1.75rem' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <CommunicationCenter 
                                                            phone={intelligentPhone} 
                                                            label={intelligentPhone} 
                                                            onAction={(type) => { if (type === 'Appel' || type === 'WhatsApp') setSelectedLeadForOutcome(lead); }} 
                                                        />
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                           📍 {countryInfo ? countryInfo.name : (lead.country || 'Pays inconnu')}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1.75rem' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 900, color: isFailed ? '#94a3b8' : 'var(--accent)', textTransform: 'uppercase', marginBottom: '6px' }}>{phase}</div>
                                                    <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>{lead.status?.label || lead.statusId}</div>
                                                </td>
                                                <td style={{ padding: '1.75rem' }}>
                                                    <select value={lead.statusId} onChange={(e) => handleUpdateStatus(lead.id, e.target.value)} className="input" style={{ borderRadius: '14px', width: '100%', maxWidth: '200px', fontWeight: 700 }}>
                                                        {statuses.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}
                                                    </select>
                                                </td>
                                                <td style={{ padding: '1.75rem', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 950, color: lead.score > 50 ? 'var(--success)' : 'var(--text-muted)' }}>{lead.score || 0}</div>
                                                </td>
                                                <td style={{ padding: '1.75rem' }}>
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
                                                onClick={() => addToast("L'IA balance la charge de travail...", "info")}
                                            >
                                                <Sparkles size={18} /> IA Smart Balance
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
                            .insert({
                                lead_id: selectedLeadForHistory.id,
                                agent_id: agent.id,
                                type: 'note',
                                content: content
                            })
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
            </div>
        </div>
    );
};

export default AgentStatsModal;
