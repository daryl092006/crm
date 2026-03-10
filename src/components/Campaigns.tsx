import React, { useState } from 'react';
import { Target, Users, TrendingUp, Calendar, AlertCircle, ArrowLeft, Upload, Download, MoreHorizontal, Mail, Phone } from 'lucide-react';
import type { StudentLead, Campaign, LeadStatus, Agent } from '../types';
import CommunicationCenter from './CommunicationCenter';
import Pipeline from './Pipeline';
import { getBestAgentForLead } from '../utils/assignmentService';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';

interface CampaignsProps {
    campaigns: Campaign[];
    setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
    leads: StudentLead[];
    setLeads: React.Dispatch<React.SetStateAction<StudentLead[]>>;
    agents: Agent[];
}

const Campaigns: React.FC<CampaignsProps> = ({ campaigns, setCampaigns, leads, setLeads, agents }) => {
    const { addToast } = useToast();
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');

    const getStatusBadgeClass = (status: LeadStatus) => {
        switch (status) {
            case 'Nouveau': return 'badge-new';
            case 'Contacté': return 'badge-contacted';
            case 'Intéressé': return 'badge-contacted';
            case 'Inscrit': return 'badge-qualified';
            case 'Perdu': return 'badge-danger';
            case 'Faux Numéro': return 'badge-danger';
            default: return 'badge-new';
        }
    };

    const validateCSV = (rows: string[][], campaignId: string): { valid: boolean; errors: string[]; leads: StudentLead[] } => {
        const errors: string[] = [];
        const importedLeads: StudentLead[] = [];

        // Normaliser les en-têtes (minuscule, sans espaces, sans accents)
        const normalize = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const headers = rows[0].map(h => normalize(h));

        const required = ['prenom', 'nom', 'email', 'telephone'];
        const missing = required.filter(r => !headers.includes(r));

        if (missing.length > 0) {
            return { valid: false, errors: [`Colonnes manquantes : ${missing.join(', ')} (Attendu: Prénom, Nom, Email, Téléphone)`], leads: [] };
        }

        const emailIdx = headers.indexOf('email');
        const phoneIdx = headers.indexOf('telephone');
        const firstNameIdx = headers.indexOf('prenom');
        const lastNameIdx = headers.indexOf('nom');
        const countryIdx = headers.indexOf('pays'); // Optionnel
        const cityIdx = headers.indexOf('ville'); // Optionnel
        const fieldIdx = headers.indexOf('filiere'); // Optionnel
        const levelIdx = headers.indexOf('niveau'); // Optionnel

        // On garde une copie locale des leads pour l'assignation dynamique durant l'import
        let currentLeadsForAssignment = [...leads];

        rows.slice(1).forEach((cols, index) => {
            if (cols.length < 4) return;

            const lineNum = index + 2;
            const email = cols[emailIdx]?.trim();
            const phone = cols[phoneIdx]?.trim();

            if (!email || !email.includes('@')) {
                errors.push(`Ligne ${lineNum}: Email invalide (${email || 'vide'})`);
                return;
            }
            if (!phone || phone.length < 5) {
                errors.push(`Ligne ${lineNum}: Téléphone invalide (${phone || 'vide'})`);
                return;
            }

            const assignedAgent = getBestAgentForLead(agents, currentLeadsForAssignment);

            const newLead: StudentLead = {
                id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                firstName: cols[firstNameIdx] || 'Importé',
                lastName: cols[lastNameIdx] || 'Candidat',
                email: email,
                phone: phone,
                country: cols[countryIdx] || '',
                city: cols[cityIdx] || '',
                fieldOfInterest: (cols[fieldIdx] as any) || 'Autre',
                level: cols[levelIdx] || '',
                source: 'Importation',
                status: 'Nouveau',
                campaignId: campaignId,
                agentId: assignedAgent?.id,
                phoneVerification: 'Inconnu',
                notes: 'Importé via CSV dans la campagne',
                interactions: [],
                createdAt: new Date().toISOString()
            };

            importedLeads.push(newLead);
            currentLeadsForAssignment.push(newLead);
        });

        return {
            valid: errors.length === 0,
            errors,
            leads: importedLeads
        };
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>, campaignId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

            if (rows.length < 2) {
                alert("Le fichier est vide ou ne contient que des en-têtes.");
                return;
            }

            const result = validateCSV(rows, campaignId);

            if (!result.valid) {
                addToast(`Erreur d'importation : ${result.errors[0]}`, "error");
            } else {
                setLeads(prev => [...prev, ...result.leads]);
                addToast(`${result.leads.length} candidats importés avec succès !`, "success");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const handleAddCampaign = async () => {
        const name = prompt("Nom de la nouvelle campagne :");
        if (!name) return;
        const type = (prompt("Type (Social / Salon / General) :", "Social") || "Social") as any;

        const { data, error } = await supabase
            .from('campaigns')
            .insert({
                name,
                type,
                start_date: new Date().toISOString(),
                organization_id: campaigns[0]?.id ? undefined : 'placeholder' // This will be handled by RLS/Trigger usually
            })
            .select()
            .single();

        if (error) {
            addToast("Erreur lors de la création de la campagne : " + error.message, "error");
        } else if (data) {
            addToast(`Campagne "${data.name}" créée avec succès.`, "success");
            setCampaigns(prev => [...prev, {
                id: data.id,
                name: data.name,
                startDate: data.start_date,
                type: data.type
            }]);
        }
    };

    const handleDeleteLead = (id: string) => {
        if (confirm("Voulez-vous vraiment supprimer ce prospect ?")) {
            setLeads(prev => prev.filter(l => l.id !== id));
            supabase.from('leads').delete().eq('id', id).then(() => {
                addToast("Prospect supprimé définitvement.", "info");
            });
        }
    };

    const exportToExcel = (campaignId: string) => {
        const campaignLeads = leads.filter(l => l.campaignId === campaignId);

        const dataToExport = campaignLeads.map(l => ({
            'ID': l.id,
            'Prénom': l.firstName,
            'Nom': l.lastName,
            'Email': l.email,
            'Téléphone': l.phone,
            'Pays': l.country,
            'Ville': l.city,
            'Filière': l.fieldOfInterest,
            'Niveau': l.level,
            'Statut': l.status,
            'Date Import': new Date(l.createdAt).toLocaleDateString()
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Prospects");
        const camp = campaigns.find(c => c.id === campaignId);
        XLSX.writeFile(workbook, `prospects_${camp?.name || 'export'}.xlsx`);
        addToast("Exportation terminée !", "info");
    };

    if (selectedCampaignId) {
        const campaign = campaigns.find(c => c.id === selectedCampaignId);
        if (!campaign) return null;

        const campaignLeads = leads.filter(l => l.campaignId === campaign.id);

        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button onClick={() => setSelectedCampaignId(null)} className="btn" style={{ color: 'var(--text-muted)' }}>
                        <ArrowLeft size={16} /> Retour aux Campagnes
                    </button>
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`btn ${viewMode === 'list' ? 'btn-primary' : ''}`}
                            style={{ border: 'none', background: viewMode === 'list' ? 'var(--primary)' : 'transparent' }}
                        >
                            Liste
                        </button>
                        <button
                            onClick={() => setViewMode('pipeline')}
                            className={`btn ${viewMode === 'pipeline' ? 'btn-primary' : ''}`}
                            style={{ border: 'none', background: viewMode === 'pipeline' ? 'var(--primary)' : 'transparent' }}
                        >
                            Pipeline (Kanban)
                        </button>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>{campaign.name}</h1>
                                <span style={{ padding: '4px 8px', background: 'var(--primary)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>{campaign.type}</span>
                            </div>
                            <p style={{ color: 'var(--text-muted)' }}>Lancée le {new Date(campaign.startDate).toLocaleDateString()}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => handleImport(e, campaign.id)}
                                    style={{
                                        position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer'
                                    }}
                                />
                                <button className="btn" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white' }}>
                                    <Upload size={18} />
                                    Importer (Excel/CSV)
                                </button>
                            </div>
                            <button className="btn" onClick={() => exportToExcel(campaign.id)} style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'white' }}>
                                <Download size={18} />
                                Exporter .xlsx
                            </button>
                        </div>
                    </div>
                </div>

                {
                    viewMode === 'list' ? (
                        <>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Prospects de la Campagne ({campaignLeads.length})</h3>
                            <div className="card" style={{ overflowX: 'auto' }}>
                                <table style={{ minWidth: '1000px' }}>
                                    <thead>
                                        <tr>
                                            <th>Candidat</th>
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
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{lead.firstName} {lead.lastName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{lead.id.split('-')[1]}</div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Mail size={12} color="var(--text-muted)" /> {lead.email}
                                                        <CommunicationCenter
                                                            phone={lead.phone}
                                                            status={lead.phoneVerification}
                                                            onAction={(type) => {
                                                                if (type === 'Confirm') {
                                                                    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, phoneVerification: 'WhatsApp' } : l));
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                                                        <Phone size={12} color="var(--text-muted)" /> {lead.phone}
                                                    </div>
                                                </td>
                                                <td>{lead.city}, {lead.country}</td>
                                                <td>{lead.fieldOfInterest}</td>
                                                <td><span className={`badge ${getStatusBadgeClass(lead.status)}`}>{lead.status}</span></td>
                                                <td>
                                                    <button
                                                        onClick={() => handleDeleteLead(lead.id)}
                                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                                        title="Supprimer"
                                                    >
                                                        <MoreHorizontal size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {campaignLeads.length === 0 && (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                                    Aucun prospect dans cette campagne. Importez un fichier CSV pour commencer.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <Pipeline leads={campaignLeads} setLeads={setLeads} campaigns={campaigns} agents={agents} />
                    )
                }
            </div >
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Campagnes Marketing</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Suivez l'efficacité de vos canaux d'acquisition.</p>
                </div>
                <button onClick={handleAddCampaign} className="btn btn-primary">
                    <Target size={18} />
                    Créer une Campagne
                </button>
            </div>

            <div className="stat-grid">
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Prospects Générés</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>{leads.length}</h3>
                        </div>
                        <Users size={24} color="var(--primary)" />
                    </div>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Conversion Inscription</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
                                {leads.length > 0 ? (leads.filter(l => l.status === 'Inscrit').length / leads.length * 100).toFixed(1) : 0}%
                            </h3>
                        </div>
                        <TrendingUp size={24} color="var(--success)" />
                    </div>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Meilleur Statut</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
                                {leads.length > 0 ? [...leads].sort((a, b) => leads.filter(l => l.status === b.status).length - leads.filter(l => l.status === a.status).length)[0].status : 'N/A'}
                            </h3>
                        </div>
                        <Target size={24} color="var(--accent)" />
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {campaigns.map((campaign) => {
                    const leadCount = leads.filter(l => l.campaignId === campaign.id).length;
                    const inscripCount = leads.filter(l => l.campaignId === campaign.id && l.status === 'Inscrit').length;
                    const convRate = leadCount > 0 ? (inscripCount / leadCount * 100).toFixed(1) : 0;

                    return (
                        <div key={campaign.id} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', alignItems: 'center', gap: '2rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{campaign.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <Calendar size={12} /> Lancée le {new Date(campaign.startDate).toLocaleDateString()}
                                    <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>{campaign.type}</span>
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Prospects</p>
                                <p style={{ fontSize: '1.125rem', fontWeight: 700 }}>{leadCount}</p>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Taux de Conv.</p>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--success)' }}>{convRate}%</p>
                                </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                                <button
                                    onClick={() => setSelectedCampaignId(campaign.id)}
                                    style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 1rem', color: 'var(--text-main)', fontSize: '0.875rem', cursor: 'pointer' }}
                                >
                                    Voir Détails
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="card" style={{ marginTop: '2rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <AlertCircle size={20} color="var(--primary)" />
                    <p style={{ fontSize: '0.875rem' }}>
                        <strong>Astuce EliteCRM :</strong> La campagne "Master Data" sur TikTok génère le plus de volume, mais le "Salon de Paris" a un taux de conversion 2x plus élevé.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Campaigns;
