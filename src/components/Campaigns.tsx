import { Target, ArrowLeft, Upload, MoreHorizontal, Mail, Phone, Download, Database, Plus, Trash2, Repeat } from 'lucide-react';
import type { StudentLead, Campaign, Agent } from '../types';
import { getBestAgentForLead } from '../utils/assignmentService';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { usePopup } from './Popup';
import { useState } from 'react';

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

    const handleSelectCampaign = (id: string | null) => {
        setSelectedCampaignId(id);
        if (id) localStorage.setItem('crm_selected_campaign_id', id);
        else localStorage.removeItem('crm_selected_campaign_id');
    };

    const validateCSV = (rows: string[][], campaignId: string): { valid: boolean; errors: string[]; leads: any[] } => {
        const errors: string[] = [];
        const importedLeads: any[] = [];
        const normalize = (s: any) => s ? s.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
        const headers = (rows[0] || []).map(h => normalize(h));

        const required = ['prenom', 'nom', 'email', 'telephone'];
        const missing = required.filter(r => !headers.includes(r));

        if (missing.length > 0) {
            return { valid: false, errors: [`Colonnes manquantes : ${missing.join(', ')}`], leads: [] };
        }

        const emailIdx = headers.indexOf('email');
        const phoneIdx = headers.indexOf('telephone');
        const firstNameIdx = headers.indexOf('prenom');
        const lastNameIdx = headers.indexOf('nom');
        const countryIdx = headers.indexOf('pays');
        const cityIdx = headers.indexOf('ville');
        const fieldIdx = headers.indexOf('filiere');
        const levelIdx = headers.indexOf('niveau');
        const statusIdx = headers.indexOf('statut');
        const noteIdx = headers.indexOf('note');

        let currentLeadsForAssignment = [...leads];

        rows.slice(1).forEach((rawCols, index) => {
            if (!rawCols || rawCols.length === 0) return;

            // Map the row values based on header indices to handle sparse or short rows
            const getVal = (idx: number) => {
                if (idx === -1 || idx >= rawCols.length) return "";
                const val = rawCols[idx];
                return val === null || val === undefined ? "" : String(val).trim();
            };

            const email = getVal(emailIdx);
            const phone = getVal(phoneIdx);
            const lineNum = index + 2;

            if (!email || !email.includes('@')) {
                // Only log error if the row isn't completely empty
                const hasAnyData = rawCols.some(c => c !== null && c !== undefined && String(c).trim() !== "");
                if (hasAnyData) {
                    errors.push(`Ligne ${lineNum}: Email invalide (${email || 'vide'})`);
                }
                return;
            }

            const firstName = getVal(firstNameIdx);
            const lastName = getVal(lastNameIdx);
            const country = getVal(countryIdx);
            const city = getVal(cityIdx);
            const field = getVal(fieldIdx);
            const level = getVal(levelIdx);
            const status = getVal(statusIdx);
            const note = getVal(noteIdx);

            const assignedAgent = getBestAgentForLead(agents, currentLeadsForAssignment);

            const newLead = {
                first_name: firstName || 'Importé',
                last_name: lastName || 'Prospect',
                email: email,
                phone: phone || "00000000",
                country: country || 'Sénégal',
                city: city || '',
                field_of_interest: field || 'Autre',
                study_level: level || '',
                status_id: status.toLowerCase() || 'nouveau',
                notes: note || '',
                campaign_id: campaignId,
                agent_id: assignedAgent?.id,
                organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
            };

            importedLeads.push(newLead);
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

            const result = validateCSV(rows, campaignId);
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

    const handleAddCampaign = async () => {
        if (!agents || agents.length === 0) {
            addToast("Attention : Vous devez d'abord ajouter au moins un agent pour pouvoir créer une campagne et assigner des prospects.", "error");
            return;
        }

        const name = await showPrompt("Nouvelle Campagne", "Nom de la nouvelle campagne :");
        if (!name) return;
        const source = await showPrompt("Source Marketing", "Source (Facebook / TikTok / Salon) :", "Facebook");
        if (!source) return;

        // On affiche la liste des agents pour info dans le prompt
        const agentsList = agents.map(a => `- ${a.name}`).join('\n');
        const agentName = await showPrompt("Conseiller Responsable", `Choisissez un agent pour cette campagne :\n${agentsList}\n\nEntrez le nom exact de l'agent :`);
        if (!agentName) return;

        const selectedA = agents.find(a => a.name.toLowerCase() === agentName.toLowerCase());
        if (!selectedA) {
            addToast("Agent introuvable. Veuillez entrer le nom exact.", "error");
            return;
        }

        const { data, error } = await supabase
            .from('campaigns')
            .insert({
                name,
                source,
                agent_id: selectedA.id,
                start_date: new Date().toISOString(),
                organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
            })
            .select().single();

        if (error) {
            // Si la colonne agent_id n'existe pas encore en base, on retente sans
            if (error.code === '42703') {
                const { data: dataAlt, error: errorAlt } = await supabase
                    .from('campaigns')
                    .insert({
                        name,
                        source,
                        start_date: new Date().toISOString(),
                        organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
                    }).select().single();

                if (errorAlt) addToast("Erreur : " + errorAlt.message, "error");
                else if (dataAlt) addToast(`Campagne "${dataAlt.name}" créée (Attribution agent ignorée car colonne manquante).`, "success");
            } else {
                addToast("Erreur : " + error.message, "error");
            }
        }
        else if (data) {
            addToast(`Campagne "${data.name}" créée et assignée à ${selectedA.name}.`, "success");
            if (onRefresh) await onRefresh();
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
            const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
            if (error) {
                addToast("Erreur lors de la suppression : " + error.message, "error");
            } else {
                addToast("Campagne supprimée.", "info");
                setCampaigns(prev => prev.filter(c => c.id !== campaignId));
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
        const headers = [['prenom', 'nom', 'email', 'telephone', 'pays', 'ville', 'filiere', 'niveau', 'statut', 'note']];
        const worksheet = XLSX.utils.aoa_to_sheet(headers);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Template Import");
        XLSX.writeFile(workbook, "template_import_prospects.xlsx");
        addToast("Modèle d'importation téléchargé.", "info");
    };

    const campaign = selectedCampaignId ? campaigns.find(c => c.id === selectedCampaignId) : null;

    if (selectedCampaignId && campaign) {
        const campaignLeads = leads.filter(l => l.campaignId === campaign.id);

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
                            <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>{campaign.name}</h1>
                            <p style={{ color: 'var(--text-muted)' }}>Source: {campaign.source}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <button onClick={() => handleMigrateCampaign(campaign.id)} className="btn" title="Migrer les prospects" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white' }}>
                                <Repeat size={18} />
                            </button>
                            <button onClick={() => handleDeleteCampaign(campaign.id)} className="btn" title="Supprimer la campagne" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                <Trash2 size={18} />
                            </button>
                            <button onClick={downloadTemplate} className="btn" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Download size={18} /> Modèle
                            </button>
                            <div style={{ position: 'relative' }}>
                                <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => handleImport(e, campaign.id)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Upload size={18} /> Importer Prospects</button>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'rgba(99, 102, 241, 0.03)', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Database size={14} /> Obligatoire (Headers exacts)
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {['prenom', 'nom', 'email', 'telephone'].map(h => (
                                        <code key={h} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '0.8125rem', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>{h}</code>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                                    Le téléphone doit inclure l'indicatif (ex: +22177...).
                                </p>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Plus size={14} /> Facultatif
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {['pays', 'ville', 'filiere', 'niveau', 'statut', 'note'].map(h => (
                                        <code key={h} style={{ padding: '4px 8px', background: 'transparent', borderRadius: '6px', fontSize: '0.8125rem', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{h}</code>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                                    Statuts autorisés: nouveau, qualifie, inscrit, perdu, contacte.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '1000px' }}>
                        <thead>
                            <tr>
                                <th>Prospect</th>
                                <th>Contact</th>
                                <th>Localisation</th>
                                <th>Filière</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {campaignLeads.map((lead) => (
                                <tr key={lead.id}>
                                    <td><div style={{ fontWeight: 600 }}>{lead.firstName} {lead.lastName}</div></td>
                                    <td><div><Mail size={12} /> {lead.email}</div><div><Phone size={12} /> {lead.phone}</div></td>
                                    <td>{lead.city}, {lead.country}</td>
                                    <td>{lead.fieldOfInterest}</td>
                                    <td>
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
                                    <td><button onClick={() => handleDeleteLead(lead.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444' }}><MoreHorizontal /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Campagnes Marketing</h1>
                <button onClick={handleAddCampaign} className="btn btn-primary"><Target size={18} /> Créer</button>
            </div>

            <div className="stat-grid">
                <div className="card">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Prospects</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{leads.length}</h3>
                </div>
                <div className="card">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Efficacité (Inscrits)</p>
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
