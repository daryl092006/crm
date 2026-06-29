import React, { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { getBestAgentForLead } from '../utils/assignmentService';
import { logAction } from '../utils/auditLogger';
import { notifyAgentLeads } from '../utils/emailNotificationService';
import type { Campaign, Agent, StudentLead } from '../types';

interface ImportLeadsModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaigns: Campaign[];
    agents: Agent[];
    leads: StudentLead[]; // Pour la déduplication locale et l'assignation
    profile: import('../types').Profile | null;
    onSuccess: () => void;
}

interface ColumnMapping {
    field: string;
    label: string;
    targetColumn: string; // La colonne du fichier associée
}

const CRM_FIELDS = [
    { field: 'firstName', label: 'Prénom *' },
    { field: 'lastName', label: 'Nom' },
    { field: 'email', label: 'Email' },
    { field: 'phone', label: 'Téléphone' },
    { field: 'whatsapp', label: 'WhatsApp' },
    { field: 'city', label: 'Ville' },
    { field: 'country', label: 'Pays' },
    { field: 'fieldOfInterest', label: 'Filière d\'intérêt' },
    { field: 'level', label: 'Niveau d\'études' },
];

export const ImportLeadsModal: React.FC<ImportLeadsModalProps> = ({
    isOpen,
    onClose,
    campaigns,
    agents,
    leads,
    profile,
    onSuccess,
}) => {
    const { addToast } = useToast();
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Mapping, 3: Preview/Report
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [source, setSource] = useState('Excel/CSV');
    const [file, setFile] = useState<File | null>(null);
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [mappings, setMappings] = useState<ColumnMapping[]>([]);
    const [loading, setLoading] = useState(false);

    // Rapport d'analyse avant insertion
    const [report, setReport] = useState<{
        total: number;
        valid: number;
        duplicatesInFile: number;
        duplicatesInDb: number;
        invalid: number;
        noContact: number;
        processedRows: any[];
    }>({ total: 0, valid: 0, duplicatesInFile: 0, duplicatesInDb: 0, invalid: 0, noContact: 0, processedRows: [] });

    const [dbPrograms, setDbPrograms] = useState<any[]>([]);
    const [dbSources, setDbSources] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setFile(null);
            setFileHeaders([]);
            setParsedData([]);
            setMappings([]);
            if (campaigns.length > 0) setSelectedCampaignId(campaigns[0].id);

            // Charger les référentiels programmes et sources
            const fetchReferentials = async () => {
                const { data: progs } = await supabase.from('programs').select('*').eq('is_active', true);
                if (progs) setDbPrograms(progs);
                const { data: srcs } = await supabase.from('prospect_sources').select('*').eq('is_active', true);
                if (srcs) setDbSources(srcs);
            };
            fetchReferentials();
        }
    }, [isOpen, campaigns]);

    if (!isOpen) return null;

    // Normalisation basique
    const normalizeString = (s: any) =>
        s ? s.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

    const cleanPhone = (p: any) => {
        if (!p) return "";
        let cleaned = p.toString().replace(/[^0-9+]/g, '');
        if (cleaned === 'N/A' || cleaned === 'na' || cleaned.length < 5) return "";
        return cleaned;
    };

    // Lecture du fichier Excel/CSV
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                if (rawRows.length === 0) {
                    addToast("Le fichier est vide.", "error");
                    return;
                }

                // Trouver la ligne d'en-tête (première ligne non vide)
                let headerIdx = 0;
                while (headerIdx < rawRows.length && (!rawRows[headerIdx] || rawRows[headerIdx].length < 2)) {
                    headerIdx++;
                }

                const headers = (rawRows[headerIdx] || []).map(h => String(h).trim());
                setFileHeaders(headers);

                // Convertir les lignes de données en objets clés/valeurs
                const dataRows = rawRows.slice(headerIdx + 1).map(row => {
                    const obj: any = {};
                    headers.forEach((h, i) => {
                        obj[h] = row[i] !== undefined ? row[i] : '';
                    });
                    return obj;
                }).filter(row => Object.values(row).some(v => String(v).trim() !== ''));

                setParsedData(dataRows);

                // Tenter un mapping automatique
                const autoMappings = CRM_FIELDS.map(fieldObj => {
                    const normField = normalizeString(fieldObj.label);
                    // Recherche de correspondance évidente
                    let match = headers.find(h => {
                        const normH = normalizeString(h);
                        return normH === normField ||
                            (fieldObj.field === 'firstName' && ['prenom', 'first name', 'first'].some(k => normH.includes(k))) ||
                            (fieldObj.field === 'lastName' && ['nom', 'last name', 'last', 'family'].some(k => normH.includes(k))) ||
                            (fieldObj.field === 'email' && ['mail', 'e-mail', 'courriel'].some(k => normH.includes(k))) ||
                            (fieldObj.field === 'phone' && ['tel', 'phone', 'telephone', 'mobile', 'contact'].some(k => normH.includes(k))) ||
                            (fieldObj.field === 'whatsapp' && ['whatsapp', 'whatapp', 'wsp'].some(k => normH.includes(k))) ||
                            (fieldObj.field === 'city' && ['ville', 'city'].some(k => normH.includes(k))) ||
                            (fieldObj.field === 'country' && ['pays', 'country'].some(k => normH.includes(k))) ||
                            (fieldObj.field === 'fieldOfInterest' && ['filiere', 'programme', 'souhait'].some(k => normH.includes(k))) ||
                            (fieldObj.field === 'level' && ['niveau', 'study level', 'etudes'].some(k => normH.includes(k)));
                    });

                    return {
                        field: fieldObj.field,
                        label: fieldObj.label,
                        targetColumn: match || ''
                    };
                });

                setMappings(autoMappings);
                setStep(2);
            } catch (err) {
                addToast("Erreur lors de la lecture du fichier.", "error");
                console.error(err);
            }
        };

        reader.readAsBinaryString(selectedFile);
    };

    const handleMappingChange = (field: string, columnName: string) => {
        setMappings(prev => prev.map(m => m.field === field ? { ...m, targetColumn: columnName } : m));
    };

    // Analyser et détecter les doublons/erreurs
    const handleAnalyze = async () => {
        if (!selectedCampaignId) {
            addToast("Veuillez sélectionner une campagne.", "warning");
            return;
        }

        setLoading(true);

        try {
            // Récupérer tous les leads existants pour cette campagne en DB pour comparer
            const { data: dbLeads } = await supabase
                .from('leads')
                .select('email, phone, whatsapp')
                .eq('campaign_id', selectedCampaignId);

            const dbEmails = new Set((dbLeads || []).map(l => normalizeString(l.email)).filter(Boolean));
            const dbPhones = new Set((dbLeads || []).map(l => cleanPhone(l.phone)).filter(Boolean));
            const dbWhatsapps = new Set((dbLeads || []).map(l => cleanPhone(l.whatsapp)).filter(Boolean));

            const processedRows: any[] = [];
            let valid = 0;
            let duplicatesInFile = 0;
            let duplicatesInDb = 0;
            let invalid = 0;
            let noContact = 0;

            const seenInFileEmails = new Set<string>();
            const seenInFilePhones = new Set<string>();

            parsedData.forEach((row) => {
                const getMappedVal = (field: string) => {
                    const col = mappings.find(m => m.field === field)?.targetColumn;
                    return col ? String(row[col] || '').trim() : '';
                };

                const firstName = getMappedVal('firstName');
                const lastName = getMappedVal('lastName');
                const email = getMappedVal('email');
                const phone = getMappedVal('phone');
                const whatsapp = getMappedVal('whatsapp');
                const city = getMappedVal('city');
                const country = getMappedVal('country') || 'Sénégal';
                const fieldOfInterest = getMappedVal('fieldOfInterest');
                const level = getMappedVal('level');

                const normEmail = normalizeString(email);
                const normPhone = cleanPhone(phone);
                const normWhatsapp = cleanPhone(whatsapp);

                let status: 'valid' | 'duplicate_file' | 'duplicate_db' | 'invalid' | 'no_contact' = 'valid';
                let reason = '';

                // Validation minimale
                if (!firstName) {
                    status = 'invalid';
                    reason = 'Prénom obligatoire';
                } else if (!normEmail && !normPhone && !normWhatsapp) {
                    status = 'no_contact';  // Pas de contact → on saute mais on liste
                    reason = 'Aucun moyen de contact';
                } else if (normEmail && !normEmail.includes('@')) {
                    status = 'invalid';
                    reason = 'Format d\'email invalide';
                }
                // Doublon interne au fichier
                else if ((normEmail && seenInFileEmails.has(normEmail)) || (normPhone && seenInFilePhones.has(normPhone))) {
                    status = 'duplicate_file';
                    reason = 'Doublon dans le fichier';
                    duplicatesInFile++;
                }
                // Doublon par rapport à la base de données
                else if (
                    (normEmail && dbEmails.has(normEmail)) ||
                    (normPhone && dbPhones.has(normPhone)) ||
                    (normWhatsapp && dbWhatsapps.has(normWhatsapp))
                ) {
                    status = 'duplicate_db';
                    reason = 'Déjà inscrit à cette campagne';
                    duplicatesInDb++;
                } else {
                    valid++;
                    if (normEmail) seenInFileEmails.add(normEmail);
                    if (normPhone) seenInFilePhones.add(normPhone);
                }

                if (status === 'invalid') invalid++;
                if (status === 'no_contact') noContact++;

                processedRows.push({
                    firstName,
                    lastName,
                    email,
                    phone,
                    whatsapp: whatsapp || phone, // fallback
                    city,
                    country,
                    fieldOfInterest,
                    level,
                    status,
                    reason
                });
            });

            setReport({
                total: parsedData.length,
                valid,
                duplicatesInFile,
                duplicatesInDb,
                invalid,
                noContact,
                processedRows
            });

            setStep(3);
        } catch (err) {
            addToast("Erreur lors de l'analyse des données.", "error");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Insertion effective dans la base de données
    const handleImport = async () => {
        setLoading(true);
        try {
            // 1. Créer le lot d'importation dans prospect_import_batches
            const { data: batch, error: batchError } = await supabase
                .from('prospect_import_batches')
                .insert({
                    campaign_id: selectedCampaignId,
                    imported_by: profile?.id || null,
                    file_name: file?.name || 'Fichier.xlsx',
                    source: source,
                    total_rows: report.total,
                    valid_rows: report.valid + report.duplicatesInFile + report.duplicatesInDb,
                    inserted_rows: report.valid,
                    duplicate_rows: report.duplicatesInFile + report.duplicatesInDb,
                    rejected_rows: report.invalid,
                    status: 'completed',
                    mapping: mappings,
                    report: {
                        summary: {
                            inserted: report.valid,
                            duplicates: report.duplicatesInFile + report.duplicatesInDb,
                            invalid: report.invalid
                        }
                    },
                    completed_at: new Date().toISOString()
                })
                .select()
                .single();

            if (batchError) throw batchError;

            // 2. Insérer les prospects valides
            const validRows = report.processedRows.filter(r => r.status === 'valid');
            // Les 'no_contact' sont intentionnellement exclus de l'import

            if (validRows.length > 0) {
                // Attribution intelligente de chaque lead à un agent disponible
                const leadsToInsert = validRows.map(row => {
                    const assignedAgent = getBestAgentForLead(agents, leads);
                    
                    // Résolution du program_id par rapport aux programmes configurés en base
                    const matchedProgram = dbPrograms.find(p => 
                        p.name.toLowerCase().trim() === (row.fieldOfInterest || '').toLowerCase().trim() ||
                        p.code.toLowerCase().trim() === (row.fieldOfInterest || '').toLowerCase().trim()
                    );

                    // Résolution du source_id par rapport aux sources configurées en base
                    const matchedSource = dbSources.find(s => 
                        s.name.toLowerCase().trim() === (source || '').toLowerCase().trim() ||
                        s.code.toLowerCase().trim() === (source || '').toLowerCase().trim()
                    );

                    return {
                        organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000',
                        campaign_id: selectedCampaignId,
                        agent_id: assignedAgent ? assignedAgent.id : null,
                        first_name: row.firstName,
                        last_name: row.lastName || null,
                        email: row.email || null,
                        phone: row.phone,
                        whatsapp: row.whatsapp || null,
                        city: row.city || null,
                        country: row.country,
                        field_of_interest: row.fieldOfInterest || null,
                        study_level: row.level || null,
                        status_id: 'nouveau',
                        source: source,
                        import_batch_id: batch.id,
                        program_id: matchedProgram ? matchedProgram.id : null,
                        source_id: matchedSource ? matchedSource.id : null
                    };
                });

                const { error: insertError } = await supabase
                    .from('leads')
                    .insert(leadsToInsert);

                if (insertError) throw insertError;

                // 2.b Regrouper les assignations par conseiller pour notifier par mail
                const agentAssignmentCounts = leadsToInsert.reduce((acc: Record<string, number>, lead) => {
                    if (lead.agent_id) {
                        acc[lead.agent_id] = (acc[lead.agent_id] || 0) + 1;
                    }
                    return acc;
                }, {});

                // Déclencher l'appel d'API asynchrone (non bloquant) pour notifier chaque agent
                Object.entries(agentAssignmentCounts).forEach(([agentId, count]) => {
                    const matchedAgent = agents.find(a => a.id === agentId);
                    const campaignName = campaigns.find(c => c.id === selectedCampaignId)?.name || 'Campagne d\'importation';
                    if (matchedAgent && matchedAgent.email) {
                        notifyAgentLeads(
                            matchedAgent.email,
                            matchedAgent.name,
                            campaignName,
                            count
                        ).catch(err => console.error("Notification agent error:", err));
                    }
                });
            }

            // Journaliser l'importation dans l'audit log
            logAction('import', 'import', {
                campaignId: selectedCampaignId,
                metadata: {
                    file_name: file?.name || 'Fichier.xlsx',
                    inserted_rows: report.valid,
                    duplicate_rows: report.duplicatesInFile + report.duplicatesInDb,
                    rejected_rows: report.invalid,
                    total_rows: report.total
                }
            });

            addToast(`Importation réussie : ${report.valid} prospects insérés !`, "success");
            onSuccess();
            onClose();
        } catch (err: unknown) {
            addToast("Erreur lors de l'importation : " + (err as Error).message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center',
            zIndex: 1550, padding: '1rem'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '750px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Importer des prospects</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Importez massivement vos leads par campagne.</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                    {/* Étape 1 : Choix campagne et Upload */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Campagne de rattachement</label>
                                <select
                                    value={selectedCampaignId}
                                    onChange={e => setSelectedCampaignId(e.target.value)}
                                    style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', color: 'white' }}
                                >
                                    <option value="">Sélectionner une campagne...</option>
                                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Source de l'import</label>
                                <input
                                    type="text"
                                    value={source}
                                    onChange={e => setSource(e.target.value)}
                                    placeholder="ex: Facebook Ads, Salon d'orientation..."
                                    style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', color: 'white' }}
                                />
                            </div>

                            <div style={{
                                border: '2px dashed var(--border)', borderRadius: '16px', padding: '3rem 2rem',
                                textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)',
                                transition: 'all 0.2s', position: 'relative'
                            }}>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileUpload}
                                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                />
                                <Upload size={40} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.8 }} />
                                <p style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.25rem' }}>Glissez-déposez votre fichier ici</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Formats acceptés : Excel (.xlsx, .xls) ou CSV</p>
                            </div>
                        </div>
                    )}

                    {/* Étape 2 : Mapping des colonnes */}
                    {step === 2 && (
                        <div>
                            <h3 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Associer les colonnes du fichier aux champs CRM</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {mappings.map(m => (
                                    <div key={m.field} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                        <div style={{ flex: 1, fontWeight: 600 }}>{m.label}</div>
                                        <div style={{ width: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>➔</div>
                                        <select
                                            value={m.targetColumn}
                                            onChange={e => handleMappingChange(m.field, e.target.value)}
                                            style={{ flex: 1.5, padding: '0.625rem', background: '#0a0a0a', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }}
                                        >
                                            <option value="">-- Ignorer ce champ --</option>
                                            {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Étape 3 : Preview & Rapport */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Summary Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{report.total}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lignes totales</div>
                                </div>
                                <div style={{ background: 'rgba(34, 197, 94, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.1)', textAlign: 'center', color: 'var(--success)' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{report.valid}</div>
                                    <div style={{ fontSize: '0.75rem' }}>Valides à insérer</div>
                                </div>
                                <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.1)', textAlign: 'center', color: 'var(--warning)' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{report.duplicatesInFile + report.duplicatesInDb}</div>
                                    <div style={{ fontSize: '0.75rem' }}>Doublons ignorés</div>
                                </div>
                                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)', textAlign: 'center', color: '#ef4444' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{report.invalid}</div>
                                    <div style={{ fontSize: '0.75rem' }}>Rejetés</div>
                                </div>
                            </div>

                            {/* Carte spéciale : Sans contact */}
                            {report.noContact > 0 && (
                                <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '14px', padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                        <div>
                                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>⚠️ {report.noContact} prospect(s) sans contact</span>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Ces personnes n'avaient ni email, ni téléphone, ni WhatsApp. Elles ont été sautées.</p>
                                        </div>
                                    </div>
                                    <div style={{ overflowX: 'auto', maxHeight: '200px', overflowY: 'auto' }}>
                                        <table style={{ width: '100%', fontSize: '0.8rem' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 700 }}>Nom</th>
                                                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 700 }}>Filière</th>
                                                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 700 }}>Pays</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {report.processedRows.filter(r => r.status === 'no_contact').map((row, idx) => (
                                                    <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                                        <td style={{ padding: '6px 8px' }}>{row.firstName} {row.lastName}</td>
                                                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{row.fieldOfInterest || '—'}</td>
                                                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{row.country || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Table Preview */}
                            <div>
                                <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '1rem' }}>Prévisualisation des 5 premières lignes</h3>
                                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                    <table style={{ minWidth: '600px', fontSize: '0.8125rem' }}>
                                        <thead>
                                            <tr>
                                                <th>Nom Complet</th>
                                                <th>Moyen de contact</th>
                                                <th>Filière d'intérêt</th>
                                                <th>Statut</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.processedRows.slice(0, 5).map((row, idx) => (
                                                <tr key={idx}>
                                                    <td>{row.firstName} {row.lastName}</td>
                                                    <td>{row.email || row.phone || row.whatsapp || <span style={{color:'var(--text-muted)'}}>—</span>}</td>
                                                    <td>{row.fieldOfInterest}</td>
                                                    <td>
                                                        <span style={{
                                                            padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600,
                                                            background: row.status === 'valid' ? 'rgba(34, 197, 94, 0.1)' : row.status === 'no_contact' ? 'rgba(99,102,241,0.1)' : row.status === 'invalid' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                            color: row.status === 'valid' ? 'var(--success)' : row.status === 'no_contact' ? 'var(--primary)' : row.status === 'invalid' ? '#ef4444' : 'var(--warning)'
                                                        }}>
                                                            {row.status === 'valid' ? 'Prêt' : row.status === 'no_contact' ? 'Sans contact' : row.status === 'invalid' ? 'Rejeté' : 'Doublon'}
                                                        </span>
                                                        {row.reason && <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem', marginTop: '2px' }}>({row.reason})</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                    <div>
                        {step > 1 && (
                            <button
                                onClick={() => setStep(prev => (prev - 1) as any)}
                                className="btn"
                                style={{ background: 'transparent', color: 'white' }}
                            >
                                Retour
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={onClose} className="btn" style={{ background: 'transparent', color: 'white' }}>Annuler</button>
                        
                        {step === 2 && (
                            <button
                                onClick={handleAnalyze}
                                disabled={loading}
                                className="btn btn-primary"
                                style={{ padding: '0.75rem 2rem', fontWeight: 700 }}
                            >
                                {loading ? 'Analyse...' : 'Analyser le fichier'}
                            </button>
                        )}

                        {step === 3 && (
                            <button
                                onClick={handleImport}
                                disabled={loading || report.valid === 0}
                                className="btn btn-primary"
                                style={{ padding: '0.75rem 2rem', fontWeight: 700 }}
                            >
                                {loading ? 'Importation...' : `Lancer l'importation (${report.valid})`}
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
