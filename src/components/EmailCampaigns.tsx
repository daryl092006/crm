import React, { useState, useEffect, useRef } from 'react';
import {
    Mail,
    Plus,
    FileText,
    FileUp,
    Paperclip,
    Eye,
    CheckCircle,
    AlertTriangle,
    ArrowRight,
    ArrowLeft,
    Send,
    Play,
    Trash2,
    Search,
    ChevronLeft,
    ChevronRight,
    X
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { usePopup } from './Popup';
import * as XLSX from 'xlsx';
import type { 
    EmailCampaign, 
    EmailRecipient, 
    EmailAttachment, 
    EmailSendLog, 
    Campaign, 
    LeadStatus, 
    Program, 
    ProspectSource, 
    MessageTemplate 
} from '../types';

interface EmailCampaignsProps {
    profile: import('../types').Profile | null;
}

type StepType = 'details' | 'recipients' | 'mapping' | 'attachments' | 'preview' | 'confirm';

export const EmailCampaigns: React.FC<EmailCampaignsProps> = ({ profile }) => {
    const { addToast } = useToast();
    const { showConfirm } = usePopup();

    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
    const [campaignRecipients, setCampaignRecipients] = useState<EmailRecipient[]>([]);
    const [campaignAttachments, setCampaignAttachments] = useState<EmailAttachment[]>([]);
    const [campaignLogs, setCampaignLogs] = useState<EmailSendLog[]>([]);
    const [viewingStats, setViewingStats] = useState(false);

    // Modal creation state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState<StepType>('recipients');

    // Creation Form state
    const [campName, setCampName] = useState('');
    const [campDesc, setCampDesc] = useState('');
    const [campSubject, setCampSubject] = useState('');
    const [campBody, setCampBody] = useState('');
    const [campTemplateId, setCampTemplateId] = useState('');
    const [campCrmCampaignId, setCampCrmCampaignId] = useState('');
    const [campSenderName, setCampSenderName] = useState(profile?.full_name || 'EliteCRM Support');
    const [campSenderEmail, setCampSenderEmail] = useState('contact@escen.university');
    const [targetType, setTargetType] = useState<'crm_campaign' | 'crm_filter' | 'external_import'>('crm_filter');

    // CRM Filters state
    const [filterStatusId, setFilterStatusId] = useState('all');
    const [filterProgramId, setFilterProgramId] = useState('all');
    const [filterSourceId, setFilterSourceId] = useState('all');

    // External import state
    const [importedData, setImportedData] = useState<any[]>([]);
    const [importHeaders, setImportHeaders] = useState<string[]>([]);
    const [mappedColumns, setMappedColumns] = useState<Record<string, string>>({
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        program_name: '',
        source: ''
    });
    
    // File validation state
    const [parsedRecipients, setParsedRecipients] = useState<Partial<EmailRecipient>[]>([]);
    const [validationStats, setValidationStats] = useState({
        total: 0,
        valid: 0,
        invalid: 0,
        duplicates: 0
    });

    // Attachments uploaded locally before campaign creation
    const [uploadedFiles, setUploadedFiles] = useState<{ file: File; path: string; size: number; type: string }[]>([]);
    const [uploadingFile, setUploadingFile] = useState(false);

    // Textarea ref for cursor-aware variable insertion
    const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Insert a {{variable}} tag at the cursor position in the body textarea
    const insertVariable = (tag: string) => {
        const el = bodyTextareaRef.current;
        if (!el) {
            setCampBody(prev => prev + tag);
            return;
        }
        const start = el.selectionStart ?? campBody.length;
        const end = el.selectionEnd ?? campBody.length;
        const newValue = campBody.slice(0, start) + tag + campBody.slice(end);
        setCampBody(newValue);
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + tag.length, start + tag.length);
        });
    };

    // Available variable chips — dynamic based on recipient source
    const getAvailableVariables = (): { label: string; tag: string }[] => {
        if (targetType === 'external_import') {
            const fieldLabels: Record<string, string> = {
                email: 'Email',
                first_name: 'Prénom',
                last_name: 'Nom',
                phone: 'Téléphone',
                program_name: 'Filière',
                source: 'Source'
            };
            return Object.entries(mappedColumns)
                .filter(([, col]) => col !== '')
                .map(([field]) => ({ label: fieldLabels[field] || field, tag: `{{${field}}}` }));
        }
        return [
            { label: 'Prénom', tag: '{{first_name}}' },
            { label: 'Nom', tag: '{{last_name}}' },
            { label: 'Nom complet', tag: '{{full_name}}' },
            { label: 'Email', tag: '{{email}}' },
            { label: 'Téléphone', tag: '{{phone}}' },
            { label: 'Filière', tag: '{{program_name}}' },
            { label: 'Campagne', tag: '{{campaign_name}}' },
            { label: 'Source', tag: '{{source}}' },
        ];
    };

    // Reference parameters from CRM
    const [crmCampaigns, setCrmCampaigns] = useState<Campaign[]>([]);
    const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [sources, setSources] = useState<ProspectSource[]>([]);
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);

    // Search and pagination
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Preview personalization target
    const [previewRecipientIdx, setPreviewRecipientIdx] = useState(0);

    const isAdminOrSuperagent = ['admin', 'superagent', 'direction', 'superviseur'].includes(profile?.role || '');

    useEffect(() => {
        fetchCampaigns();
        fetchReferenceData();
    }, []);

    const fetchCampaigns = async () => {
        if (campaigns.length === 0) {
            setLoading(true);
        }
        try {
            const { data, error } = await supabase
                .from('email_campaigns')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCampaigns(data || []);
        } catch (err: any) {
            addToast("Erreur lors de la récupération des campagnes email: " + err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchReferenceData = async () => {
        try {
            // CRM Campaigns
            const { data: camps } = await supabase.from('campaigns').select('*').eq('status', 'active');
            if (camps) setCrmCampaigns(camps);

            // Lead Statuses
            const { data: stats } = await supabase.from('lead_statuses').select('*').order('sort_order');
            if (stats) setLeadStatuses(stats.map(s => ({ id: s.id, label: s.label, color: s.color, sortOrder: s.sort_order })));

            // Programs
            const { data: progs } = await supabase.from('programs').select('*').eq('is_active', true);
            if (progs) {
                setPrograms(progs.map(p => ({
                    id: p.id,
                    name: p.name,
                    code: p.code,
                    description: p.description,
                    level: p.level || '',
                    department: p.department || '',
                    isActive: p.is_active
                })));
            }

            // Sources
            const { data: srcs } = await supabase.from('sources').select('*').eq('is_active', true);
            if (srcs) {
                setSources(srcs.map(s => ({
                    id: s.id,
                    name: s.name,
                    code: s.code,
                    description: s.description,
                    isActive: s.is_active
                })));
            }

            // Templates (Email category)
            const { data: tmps } = await supabase.from('messaging_templates').select('*').eq('category', 'email').eq('is_active', true);
            if (tmps) setTemplates(tmps);
        } catch (err: any) {
            console.error("Error loading references:", err);
        }
    };

    // Load templates subject/body
    const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setCampTemplateId(id);
        const selected = templates.find(t => t.id === id);
        if (selected) {
            setCampSubject(selected.subject || '');
            setCampBody(selected.content || '');
        }
    };

    // Handle CSV/Excel import
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = event.target?.result;
            if (!data) return;

            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet);

            if (rows.length === 0) {
                addToast("Le fichier est vide", "error");
                return;
            }

            const headers = Object.keys(rows[0] as any);
            setImportedData(rows);
            setImportHeaders(headers);

            // Attempt auto mapping
            const newMap = { ...mappedColumns };
            headers.forEach(h => {
                const lower = h.toLowerCase().trim();
                if (lower.includes('email') || lower.includes('mail')) newMap.email = h;
                if (lower.includes('prenom') || lower.includes('prénom') || lower.includes('first')) newMap.first_name = h;
                if (lower.includes('nom') || lower.includes('last') || lower.includes('family')) newMap.last_name = h;
                if (lower.includes('tel') || lower.includes('phone') || lower.includes('portable')) newMap.phone = h;
                if (lower.includes('program') || lower.includes('filiere') || lower.includes('filière')) newMap.program_name = h;
                if (lower.includes('source') || lower.includes('origine')) newMap.source = h;
            });
            setMappedColumns(newMap);
            setCurrentStep('mapping');
        };
        reader.readAsBinaryString(file);
    };

    // Validate imported/selected recipients
    useEffect(() => {
        if (currentStep === 'mapping' && importedData.length > 0) {
            validateExternalData();
        }
    }, [mappedColumns, importedData, currentStep]);

    const validateExternalData = () => {
        const emailCol = mappedColumns.email;
        if (!emailCol) {
            setValidationStats({ total: 0, valid: 0, invalid: 0, duplicates: 0 });
            setParsedRecipients([]);
            return;
        }

        const validRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const parsed: Partial<EmailRecipient>[] = [];
        const seenEmails = new Set<string>();

        let validCount = 0;
        let invalidCount = 0;
        let dupCount = 0;

        importedData.forEach((row) => {
            const rawEmail = row[emailCol]?.toString().toLowerCase().trim();
            const fName = mappedColumns.first_name ? row[mappedColumns.first_name]?.toString().trim() : '';
            const lName = mappedColumns.last_name ? row[mappedColumns.last_name]?.toString().trim() : '';
            const phone = mappedColumns.phone ? row[mappedColumns.phone]?.toString().trim() : '';
            const prog = mappedColumns.program_name ? row[mappedColumns.program_name]?.toString().trim() : '';
            const src = mappedColumns.source ? row[mappedColumns.source]?.toString().trim() : '';

            let valStatus: 'valid' | 'invalid' | 'duplicate' | 'missing_email' = 'valid';
            let err = '';
            let isDup = false;

            if (!rawEmail) {
                valStatus = 'missing_email';
                err = "Email manquant";
                invalidCount++;
            } else if (!validRegex.test(rawEmail)) {
                valStatus = 'invalid';
                err = "Format email invalide";
                invalidCount++;
            } else if (seenEmails.has(rawEmail)) {
                valStatus = 'duplicate';
                err = "Doublon dans le fichier";
                isDup = true;
                dupCount++;
            } else {
                seenEmails.add(rawEmail);
                validCount++;
            }

            parsed.push({
                email: rawEmail || '',
                first_name: fName,
                last_name: lName,
                full_name: fName || lName ? `${fName} ${lName || ''}`.trim() : '',
                phone,
                program_name: prog,
                source: src,
                validation_status: valStatus,
                validation_error: err,
                is_duplicate: isDup,
                status: isDup || valStatus !== 'valid' ? 'skipped' : 'pending'
            });
        });

        setParsedRecipients(parsed);
        setValidationStats({
            total: importedData.length,
            valid: validCount,
            invalid: invalidCount,
            duplicates: dupCount
        });
    };

    // CRM Lead Selection Fetcher
    const fetchCrmTargets = async () => {
        try {
            let query = supabase.from('leads').select('*, campaigns(name), lead_statuses(label)');
            
            if (targetType === 'crm_campaign' && campCrmCampaignId) {
                query = query.eq('campaign_id', campCrmCampaignId);
            } else if (targetType === 'crm_filter') {
                if (filterStatusId !== 'all') query = query.eq('status_id', filterStatusId);
                if (filterProgramId !== 'all') query = query.eq('program_id', filterProgramId);
                if (filterSourceId !== 'all') query = query.eq('source_id', filterSourceId);
            } else {
                return;
            }

            const { data: leads, error } = await query;
            if (error) throw error;

            const seen = new Set<string>();
            const parsed: Partial<EmailRecipient>[] = [];
            let valid = 0, invalid = 0, duplicates = 0;

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            (leads || []).forEach(lead => {
                const email = lead.email?.toLowerCase().trim();
                let vStatus: 'valid' | 'invalid' | 'duplicate' | 'missing_email' = 'valid';
                let isDup = false;
                let errorMsg = '';

                if (!email) {
                    vStatus = 'missing_email';
                    errorMsg = "Email manquant dans CRM";
                    invalid++;
                } else if (!emailRegex.test(email)) {
                    vStatus = 'invalid';
                    errorMsg = "Format email CRM invalide";
                    invalid++;
                } else if (seen.has(email)) {
                    vStatus = 'duplicate';
                    isDup = true;
                    errorMsg = "Email doublon de prospect";
                    duplicates++;
                } else {
                    seen.add(email);
                    valid++;
                }

                parsed.push({
                    lead_id: lead.id,
                    email: email || '',
                    first_name: lead.first_name,
                    last_name: lead.last_name,
                    full_name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
                    phone: lead.phone,
                    program_name: lead.field_of_interest,
                    campaign_name: lead.campaigns?.name || '',
                    source: lead.source,
                    validation_status: vStatus,
                    validation_error: errorMsg,
                    is_duplicate: isDup,
                    status: isDup || vStatus !== 'valid' ? 'skipped' : 'pending'
                });
            });

            setParsedRecipients(parsed);
            setValidationStats({
                total: (leads || []).length,
                valid,
                invalid,
                duplicates
            });

        } catch (err: any) {
            addToast("Erreur lors de l'extraction des prospects : " + err.message, "error");
        }
    };

    const handleSelectRecipientsStep = async () => {
        if (targetType !== 'external_import') {
            await fetchCrmTargets();
            setCurrentStep('details');
        } else {
            addToast("Veuillez importer un fichier CSV ou Excel", "warning");
        }
    };

    // Attachment uploads
    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (uploadedFiles.length + files.length > 5) {
            addToast("Limite maximale de 5 pièces jointes dépassée.", "error");
            return;
        }

        setUploadingFile(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.size > 10 * 1024 * 1024) {
                    addToast(`Fichier ${file.name} trop volumineux (> 10 Mo).`, "error");
                    continue;
                }

                const ext = file.name.split('.').pop() || '';
                const path = `email_campaigns/${crypto.randomUUID()}.${ext}`;

                const { error } = await supabase.storage
                    .from('email-attachments')
                    .upload(path, file);

                if (error) throw error;

                setUploadedFiles(prev => [...prev, {
                    file,
                    path,
                    size: file.size,
                    type: file.type
                }]);
                addToast(`Fichier ${file.name} ajouté`, "success");
            }
        } catch (err: any) {
            addToast("Erreur lors de l'upload : " + err.message, "error");
        } finally {
            setUploadingFile(false);
        }
    };

    const removeUploadedFile = async (idx: number) => {
        const fileObj = uploadedFiles[idx];
        try {
            await supabase.storage.from('email-attachments').remove([fileObj.path]);
            setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
            addToast("Fichier supprimé", "info");
        } catch (err: any) {
            console.error(err);
        }
    };

    // Save Email Campaign to DB
    const handleSaveCampaign = async (status: 'draft' | 'ready') => {
        if (!campName.trim() || !campSubject.trim() || !campBody.trim()) {
            addToast("Nom, sujet et contenu requis", "error");
            return;
        }

        try {
            const total = validationStats.total;
            const valid = validationStats.valid;
            const invalid = validationStats.invalid;
            const duplicate = validationStats.duplicates;

            // 1. Insert Campaign Row
            const { data: campaign, error } = await supabase
                .from('email_campaigns')
                .insert({
                    name: campName,
                    description: campDesc,
                    subject: campSubject,
                    body: campBody,
                    template_id: campTemplateId || null,
                    crm_campaign_id: targetType === 'crm_campaign' ? campCrmCampaignId : null,
                    sender_name: campSenderName,
                    sender_email: campSenderEmail,
                    status,
                    target_type: targetType,
                    filters: targetType === 'crm_filter' ? {
                        status_id: filterStatusId,
                        program_id: filterProgramId,
                        source_id: filterSourceId
                    } : {},
                    total_recipients: total,
                    valid_recipients: valid,
                    invalid_recipients: invalid,
                    duplicate_recipients: duplicate,
                    created_by: profile?.id || null,
                    organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
                })
                .select()
                .single();

            if (error) throw error;

            // 2. Insert Recipients
            if (parsedRecipients.length > 0) {
                const recRows = parsedRecipients.map(r => ({
                    ...r,
                    email_campaign_id: campaign.id
                }));

                const { error: rError } = await supabase.from('email_recipients').insert(recRows);
                if (rError) throw rError;
            }

            // 3. Insert Attachments
            if (uploadedFiles.length > 0) {
                const attachRows = uploadedFiles.map(f => ({
                    email_campaign_id: campaign.id,
                    file_name: f.file.name,
                    file_path: f.path,
                    file_size: f.size,
                    mime_type: f.type,
                    uploaded_by: profile?.id || null
                }));

                const { error: aError } = await supabase.from('email_attachments').insert(attachRows);
                if (aError) throw aError;
            }

            // 4. Log Action
            await supabase.rpc('create_audit_log', {
                p_action: 'create_email_campaign',
                p_entity_type: 'email_campaigns',
                p_entity_id: campaign.id,
                p_metadata: { name: campName, status }
            });

            addToast("Campagne créée avec succès !", "success");
            resetForm();
            setIsCreateOpen(false);
            fetchCampaigns();

        } catch (err: any) {
            addToast("Erreur lors de la sauvegarde : " + err.message, "error");
        }
    };

    const resetForm = () => {
        setCampName('');
        setCampDesc('');
        setCampSubject('');
        setCampBody('');
        setCampTemplateId('');
        setCampCrmCampaignId('');
        setTargetType('crm_filter');
        setFilterStatusId('all');
        setFilterProgramId('all');
        setFilterSourceId('all');
        setImportedData([]);
        setImportHeaders([]);
        setParsedRecipients([]);
        setUploadedFiles([]);
        setCurrentStep('recipients');
    };

    // Trigger Campaign Send (invoking the Edge Function)
    const handleTriggerSend = async (campaignId: string) => {
        const confirmed = await showConfirm("Confirmation d'envoi", "Voulez-vous vraiment lancer l'envoi en masse pour cette campagne ?", "warning");
        if (!confirmed) return;
        try {
            // Instantly update UI status
            setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'queued' } : c));
            addToast("Envoi en cours de préparation...", "info");

            const { data: resData, error: fnError } = await (supabase.functions as any).invoke('send-bulk-email', {
                body: { campaignId }
            });

            if (fnError) {
                // Try to extract message from error
                const msg = fnError.message || fnError.context?.error || JSON.stringify(fnError);
                addToast("Erreur Edge Function : " + msg, "error");
                fetchCampaigns();
                return;
            }

            if (resData?.success) {
                addToast(`Envoi terminé : ${resData.sent_count} envoyés, ${resData.failed_count} échecs`, "success");
            } else {
                addToast("Erreur lors de l'envoi : " + (resData?.error || 'Erreur inconnue'), "error");
            }
            fetchCampaigns();
            if (selectedCampaign?.id === campaignId) {
                viewCampaignStats(selectedCampaign);
            }
        } catch (err: any) {
            addToast("Erreur inattendue : " + err.message, "error");
            fetchCampaigns();
        }
    };

    // View Campaign Stats details
    const viewCampaignStats = async (campaign: EmailCampaign) => {
        setSelectedCampaign(campaign);
        setViewingStats(true);
        try {
            // Load recipients
            const { data: recs } = await supabase.from('email_recipients').select('*').eq('email_campaign_id', campaign.id);
            setCampaignRecipients(recs || []);

            // Load attachments
            const { data: atts } = await supabase.from('email_attachments').select('*').eq('email_campaign_id', campaign.id);
            setCampaignAttachments(atts || []);

            // Load logs
            const { data: logs } = await supabase.from('email_send_logs').select('*').eq('email_campaign_id', campaign.id).order('created_at', { ascending: false });
            setCampaignLogs(logs || []);
        } catch (err: any) {
            console.error("Error loading stats : ", err);
        }
    };

    // Template Variable replacer for UI preview
    const renderPreviewHTML = (body: string, recipient: any) => {
        if (!body) return "";
        const personalized = body
            .replace(/\{\{first_name\}\}/g, recipient?.first_name || "Jean")
            .replace(/\{\{last_name\}\}/g, recipient?.last_name || "Dupont")
            .replace(/\{\{full_name\}\}/g, recipient?.full_name || "Jean Dupont")
            .replace(/\{\{email\}\}/g, recipient?.email || "jean.dupont@example.com")
            .replace(/\{\{phone\}\}/g, recipient?.phone || "+228 98 01 27 27")
            .replace(/\{\{program_name\}\}/g, recipient?.program_name || "Intelligence Artificielle")
            .replace(/\{\{campaign_name\}\}/g, recipient?.campaign_name || "Recrutement 2026")
            .replace(/\{\{source\}\}/g, recipient?.source || "Facebook");
        return personalized;
    };

    // Wraps personalized body in the official ESCEN email template (matches exactly what is sent)
    const buildPreviewHtml = (body: string, recipient: any) => {
        const personalized = renderPreviewHTML(body, recipient);
        return `
<div style="font-family: Arial, sans-serif; font-size:14px; color:#333; text-align:justify; max-width:600px; margin:auto; background:#fff; border-top:4px solid #202a51; border:1px solid #dbe7f0;">
  <div style="padding:20px 24px;">
    ${personalized}
  </div>
  <hr style="margin:0; border:none; border-top:1px solid #dbe7f0;">
  <div style="background-color:#202a51; padding:16px;">
    <p style="font-size:13px; color:#6cc6e2; text-align:center; margin:0 0 10px 0; letter-spacing:0.05em; text-transform:uppercase;">Suivez-nous</p>
    <p style="text-align:center; margin:0 0 12px 0;">
      <a href="https://www.facebook.com/escenofficiel" style="margin:0 8px; text-decoration:none;">
        <img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" width="24" alt="Facebook" style="vertical-align:middle;">
      </a>
      <a href="https://www.instagram.com/escenofficiel" style="margin:0 8px; text-decoration:none;">
        <img src="https://cdn-icons-png.flaticon.com/24/733/733558.png" width="24" alt="Instagram" style="vertical-align:middle;">
      </a>
      <a href="https://www.linkedin.com/company/escenofficiel/" style="margin:0 8px; text-decoration:none;">
        <img src="https://cdn-icons-png.flaticon.com/24/733/733561.png" width="24" alt="LinkedIn" style="vertical-align:middle;">
      </a>
      <a href="https://wa.me/22898012727" style="margin:0 8px; text-decoration:none;">
        <img src="https://cdn-icons-png.flaticon.com/24/733/733585.png" width="24" alt="WhatsApp" style="vertical-align:middle;">
      </a>
      <a href="http://tiktok.com/@escen_university" style="margin:0 8px; text-decoration:none;">
        <img src="https://cdn-icons-png.flaticon.com/24/3046/3046122.png" width="24" alt="TikTok" style="vertical-align:middle;">
      </a>
    </p>
    <p style="text-align:center; margin:0; font-size:11px; color:#6cc6e2;">© ESCEN — École Pionnière de l'Économie Numérique en Afrique francophone</p>
  </div>
</div>`;
    };

    // Search filter campaigns
    const filteredCampaigns = campaigns.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.subject.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Paginate campaigns
    const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);
    const paginatedCampaigns = filteredCampaigns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Helpers for status formatting
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'sent': return '#22c55e';
            case 'sending': return '#3b82f6';
            case 'queued': return '#f59e0b';
            case 'failed': return '#ef4444';
            case 'cancelled': return '#94a3b8';
            case 'paused': return '#64748b';
            default: return '#e2e8f0';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'sent': return 'Envoyée';
            case 'sending': return 'En cours';
            case 'queued': return 'En attente';
            case 'failed': return 'Échouée';
            case 'cancelled': return 'Annulée';
            case 'paused': return 'En pause';
            case 'ready': return 'Prête';
            default: return 'Brouillon';
        }
    };

    return (
        <div style={{ padding: '1.5rem', color: 'var(--text)', background: 'var(--background)', minHeight: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        ✉️ Messagerie de Masse
                    </h1>
                    <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                        Créez, ciblez et suivez vos campagnes d'envoi d'emails en masse avec Resend.
                    </p>
                </div>
                {isAdminOrSuperagent && !viewingStats && (
                    <button
                        onClick={() => { resetForm(); setIsCreateOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: 'white', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px var(--primary-glow)', transition: 'transform 0.2s' }}
                    >
                        <Plus size={18} /> Nouvelle Campagne
                    </button>
                )}
            </div>

            {/* Campaign List View */}
            {!viewingStats ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Search and Filters */}
                    <div style={{ display: 'flex', gap: '1rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
                            <Search size={16} style={{ color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Rechercher une campagne..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none', width: '100%', fontSize: '0.875rem' }}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        {paginatedCampaigns.length === 0 ? (
                            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <Mail size={48} style={{ opacity: 0.3 }} />
                                <div>Aucune campagne email enregistrée</div>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '1rem' }}>Campagne</th>
                                            <th style={{ padding: '1rem' }}>Objet</th>
                                            <th style={{ padding: '1rem' }}>Cible</th>
                                            <th style={{ padding: '1rem' }}>Statut</th>
                                            <th style={{ padding: '1rem', textAlign: 'center' }}>Destinataires</th>
                                            <th style={{ padding: '1rem', textAlign: 'center' }}>Envois</th>
                                            <th style={{ padding: '1rem' }}>Date de création</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedCampaigns.map((camp) => (
                                            <tr key={camp.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s', cursor: 'pointer' }} onClick={() => viewCampaignStats(camp)}>
                                                <td style={{ padding: '1rem', fontWeight: 600 }}>{camp.name}</td>
                                                <td style={{ padding: '1rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{camp.subject}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                                        {camp.target_type === 'crm_campaign' ? 'Campagne CRM' : camp.target_type === 'crm_filter' ? 'Filtres CRM' : 'Import Fichier'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusColor(camp.status) }}></div>
                                                        <span>{getStatusText(camp.status)}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 500 }}>{camp.valid_recipients}</td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    {camp.status === 'sending' || camp.status === 'sent' || camp.status === 'failed' ? (
                                                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{camp.sent_count}/{camp.valid_recipients}</span>
                                                            {camp.failed_count > 0 && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{camp.failed_count} échecs</span>}
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                                <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{new Date(camp.created_at).toLocaleDateString('fr-FR')}</td>
                                                <td style={{ padding: '1rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                        {isAdminOrSuperagent && (camp.status === 'draft' || camp.status === 'ready') && (
                                                            <button
                                                                onClick={() => handleTriggerSend(camp.id)}
                                                                style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
                                                            >
                                                                <Play size={14} /> Envoyer
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => viewCampaignStats(camp)}
                                                            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text)', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                        >
                                                            <Eye size={14} /> Suivre
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--border)' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Page {currentPage} sur {totalPages}</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.25rem 0.5rem', borderRadius: '6px', cursor: 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.25rem 0.5rem', borderRadius: '6px', cursor: 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Stats and Detail View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => { setViewingStats(false); setSelectedCampaign(null); }}
                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.5rem 1rem', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <ArrowLeft size={16} /> Retour
                        </button>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Détail de la campagne: {selectedCampaign?.name}</h2>
                    </div>

                    {/* Dashboard Panel */}
                    <div style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', display: 'grid', gap: '1rem' }}>
                        <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Statut</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getStatusColor(selectedCampaign?.status || '') }}></div>
                                {getStatusText(selectedCampaign?.status || '')}
                            </div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Destinataires</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>{selectedCampaign?.valid_recipients}</div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Envoyés avec succès</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#22c55e', marginTop: '0.25rem' }}>{selectedCampaign?.sent_count}</div>
                        </div>
                        <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Échecs</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444', marginTop: '0.25rem' }}>{selectedCampaign?.failed_count}</div>
                        </div>
                    </div>

                    {/* Campaign Details Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Paramètres d'envoi</h3>
                                <div style={{ fontSize: '0.875rem' }}>
                                    <div style={{ color: 'var(--text-muted)' }}>Expéditeur</div>
                                    <div style={{ fontWeight: 500 }}>{selectedCampaign?.sender_name} ({selectedCampaign?.sender_email})</div>
                                </div>
                                <div style={{ fontSize: '0.875rem' }}>
                                    <div style={{ color: 'var(--text-muted)' }}>Sujet de l'email</div>
                                    <div style={{ fontWeight: 500 }}>{selectedCampaign?.subject}</div>
                                </div>
                                {campaignAttachments.length > 0 && (
                                    <div style={{ fontSize: '0.875rem' }}>
                                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Pièces jointes</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            {campaignAttachments.map(att => (
                                                <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                                                    <Paperclip size={12} />
                                                    <span>{att.file_name} ({(att.file_size ? att.file_size / 1024 : 0).toFixed(0)} KB)</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Logs d'envoi</h3>
                                <div style={{ overflowY: 'auto', maxHeight: '200px' }}>
                                    {campaignLogs.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Aucun log d'envoi</div> : (
                                        campaignLogs.map(l => (
                                            <div key={l.id} style={{ fontSize: '0.75rem', padding: '0.35rem 0', borderBottom: '1px solid var(--border)', color: l.status === 'sent' ? '#22c55e' : '#ef4444' }}>
                                                [{new Date(l.created_at).toLocaleTimeString()}] {l.email}: {l.status === 'sent' ? 'Succès' : `Échec (${l.error_message || 'erreur'})`}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Recipients Table */}
                        <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Liste des destinataires</h3>
                            <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '0.5rem' }}>Email</th>
                                            <th style={{ padding: '0.5rem' }}>Nom</th>
                                            <th style={{ padding: '0.5rem' }}>Validation</th>
                                            <th style={{ padding: '0.5rem' }}>Statut envoi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {campaignRecipients.map(rec => (
                                            <tr key={rec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '0.5rem', fontWeight: 500 }}>{rec.email}</td>
                                                <td style={{ padding: '0.5rem' }}>{rec.full_name || '-'}</td>
                                                <td style={{ padding: '0.5rem' }}>
                                                    {rec.validation_status === 'valid' ? (
                                                        <span style={{ color: '#22c55e', fontSize: '0.75rem' }}>Valide</span>
                                                    ) : (
                                                        <span style={{ color: '#ef4444', fontSize: '0.75rem' }} title={rec.validation_error || ''}>
                                                            {rec.validation_status === 'duplicate' ? 'Doublon' : 'Invalide'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '0.5rem' }}>
                                                    <span style={{ 
                                                        fontSize: '0.75rem', 
                                                        padding: '0.15rem 0.4rem', 
                                                        borderRadius: '4px',
                                                        background: rec.status === 'sent' ? 'rgba(34,197,94,0.1)' : rec.status === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                                                        color: rec.status === 'sent' ? '#22c55e' : rec.status === 'failed' ? '#ef4444' : 'var(--text-muted)'
                                                    }}>
                                                        {rec.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign Creator Modal Flow */}
            {isCreateOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: '2rem' }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border)', width: '100%', maxWidth: '750px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
                        {/* Header */}
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Créer une campagne email</h2>
                            <button onClick={() => setIsCreateOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>

                        {/* Step Indicators */}
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 600 }}>
                            <div style={{ flex: 1, padding: '0.75rem', textAlign: 'center', borderBottom: currentStep === 'recipients' || currentStep === 'mapping' ? '2px solid var(--primary)' : 'none', color: currentStep === 'recipients' || currentStep === 'mapping' ? 'var(--primary)' : 'var(--text-muted)' }}>1. Destinataires</div>
                            <div style={{ flex: 1, padding: '0.75rem', textAlign: 'center', borderBottom: currentStep === 'details' ? '2px solid var(--primary)' : 'none', color: currentStep === 'details' ? 'var(--primary)' : 'var(--text-muted)' }}>2. Contenu</div>
                            <div style={{ flex: 1, padding: '0.75rem', textAlign: 'center', borderBottom: currentStep === 'attachments' ? '2px solid var(--primary)' : 'none', color: currentStep === 'attachments' ? 'var(--primary)' : 'var(--text-muted)' }}>3. Pièces Jointes</div>
                            <div style={{ flex: 1, padding: '0.75rem', textAlign: 'center', borderBottom: currentStep === 'preview' ? '2px solid var(--primary)' : 'none', color: currentStep === 'preview' ? 'var(--primary)' : 'var(--text-muted)' }}>4. Prévisualisation</div>
                            <div style={{ flex: 1, padding: '0.75rem', textAlign: 'center', borderBottom: currentStep === 'confirm' ? '2px solid var(--primary)' : 'none', color: currentStep === 'confirm' ? 'var(--primary)' : 'var(--text-muted)' }}>5. Lancement</div>
                        </div>

                        {/* Body / Content */}
                        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {currentStep === 'details' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group">
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Nom de la campagne</label>
                                            <input type="text" value={campName} onChange={e => setCampName(e.target.value)} placeholder="ex: Relance de rentrée ESCEN" style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--background)', color: 'var(--text)', outline: 'none' }} />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Sélectionner un modèle existant</label>
                                            <select value={campTemplateId} onChange={handleTemplateChange} style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--background)', color: 'var(--text)', outline: 'none' }}>
                                                <option value="">-- Utiliser un message libre --</option>
                                                {templates.map(t => (
                                                    <option key={t.id} value={t.id}>{t.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="form-group">
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Nom de l'expéditeur</label>
                                            <input type="text" value={campSenderName} onChange={e => setCampSenderName(e.target.value)} style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--background)', color: 'var(--text)', outline: 'none' }} />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Email de l'expéditeur</label>
                                            <input type="email" value={campSenderEmail} onChange={e => setCampSenderEmail(e.target.value)} style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--background)', color: 'var(--text)', outline: 'none' }} />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Objet de l'email</label>
                                        <input type="text" value={campSubject} onChange={e => setCampSubject(e.target.value)} placeholder="Objet du message..." style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--background)', color: 'var(--text)', outline: 'none' }} />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                            Contenu de l'email (Format HTML supporté)
                                        </label>

                                        {/* Variable chips — click to insert at cursor */}
                                        <div style={{ marginBottom: '0.5rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                                                Insérer une variable au curseur :
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                {getAvailableVariables().map(({ label, tag }) => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => insertVariable(tag)}
                                                        title={`Insérer ${tag}`}
                                                        style={{
                                                            padding: '0.2rem 0.55rem',
                                                            borderRadius: '20px',
                                                            border: '1px solid var(--primary)',
                                                            background: 'rgba(99,102,241,0.08)',
                                                            color: 'var(--primary)',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            fontFamily: 'monospace',
                                                            transition: 'background 0.15s',
                                                        }}
                                                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.2)'; }}
                                                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.08)'; }}
                                                    >
                                                        + {label}
                                                    </button>
                                                ))}
                                                {getAvailableVariables().length === 0 && (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                        Mappez d'abord vos colonnes à l'étape précédente
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <textarea
                                            ref={bodyTextareaRef}
                                            value={campBody}
                                            onChange={e => setCampBody(e.target.value)}
                                            rows={8}
                                            placeholder={`Bonjour {{first_name}},\n\nNous vous confirmons...`}
                                            style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--background)', color: 'var(--text)', outline: 'none', fontFamily: 'monospace', fontSize: '0.8125rem', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {currentStep === 'recipients' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Sélectionner la source des destinataires</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                            <button
                                                onClick={() => setTargetType('crm_filter')}
                                                style={{ padding: '1rem', borderRadius: '12px', border: targetType === 'crm_filter' ? '2px solid var(--primary)' : '1px solid var(--border)', background: targetType === 'crm_filter' ? 'rgba(99, 102, 241, 0.05)' : 'var(--background)', color: targetType === 'crm_filter' ? 'var(--primary)' : 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Filtres Leads CRM
                                            </button>
                                            <button
                                                onClick={() => setTargetType('crm_campaign')}
                                                style={{ padding: '1rem', borderRadius: '12px', border: targetType === 'crm_campaign' ? '2px solid var(--primary)' : '1px solid var(--border)', background: targetType === 'crm_campaign' ? 'rgba(99, 102, 241, 0.05)' : 'var(--background)', color: targetType === 'crm_campaign' ? 'var(--primary)' : 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Campagne CRM
                                            </button>
                                            <button
                                                onClick={() => setTargetType('external_import')}
                                                style={{ padding: '1rem', borderRadius: '12px', border: targetType === 'external_import' ? '2px solid var(--primary)' : '1px solid var(--border)', background: targetType === 'external_import' ? 'rgba(99, 102, 241, 0.05)' : 'var(--background)', color: targetType === 'external_import' ? 'var(--primary)' : 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Fichier Externe (CSV, XLSX)
                                            </button>
                                        </div>
                                    </div>

                                    {targetType === 'crm_filter' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Filtrer par Statut</label>
                                                <select value={filterStatusId} onChange={e => setFilterStatusId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)' }}>
                                                    <option value="all">Tous les statuts</option>
                                                    {leadStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Filtrer par Filière</label>
                                                <select value={filterProgramId} onChange={e => setFilterProgramId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)' }}>
                                                    <option value="all">Toutes les filières</option>
                                                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Filtrer par Source</label>
                                                <select value={filterSourceId} onChange={e => setFilterSourceId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)' }}>
                                                    <option value="all">Toutes les sources</option>
                                                    {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {targetType === 'crm_campaign' && (
                                        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Sélectionner la Campagne CRM</label>
                                            <select value={campCrmCampaignId} onChange={e => setCampCrmCampaignId(e.target.value)} style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', outline: 'none' }}>
                                                <option value="">-- Choisir une campagne --</option>
                                                {crmCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {targetType === 'external_import' && (
                                        <div style={{ display: 'grid', placeItems: 'center', border: '2px dashed var(--border)', borderRadius: '12px', padding: '3rem 1rem', background: 'rgba(255,255,255,0.01)', cursor: 'pointer' }}>
                                            <input type="file" accept=".csv,.xlsx,.xls" id="external-file-input" style={{ display: 'none' }} onChange={handleFileUpload} />
                                            <label htmlFor="external-file-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                                <FileUp size={36} style={{ color: 'var(--primary)' }} />
                                                <span style={{ fontWeight: 600 }}>Cliquer pour charger un fichier (CSV, Excel)</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Le fichier doit contenir au moins une colonne Email</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentStep === 'mapping' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>Correspondance des colonnes</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>Associez les colonnes de votre fichier aux champs correspondants dans EliteCRM.</p>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                        {Object.keys(mappedColumns).map(field => (
                                            <div key={field} className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                                    {field === 'email' ? 'Email (Requis) *' : field === 'first_name' ? 'Prénom' : field === 'last_name' ? 'Nom de famille' : field === 'phone' ? 'Téléphone' : field === 'program_name' ? 'Filière d\'intérêt' : 'Source'}
                                                </label>
                                                <select
                                                    value={mappedColumns[field]}
                                                    onChange={e => setMappedColumns(prev => ({ ...prev, [field]: e.target.value }))}
                                                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)' }}
                                                >
                                                    <option value="">-- Non mappé --</option>
                                                    {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>

                                    {validationStats.total > 0 && (
                                        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                                            <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>Rapport d'analyse de fichier :</h4>
                                            <div style={{ display: 'flex', gap: '2rem' }}>
                                                <div>Total lignes: <b>{validationStats.total}</b></div>
                                                <div style={{ color: '#22c55e' }}>Valides: <b>{validationStats.valid}</b></div>
                                                <div style={{ color: '#ef4444' }}>Invalides: <b>{validationStats.invalid}</b></div>
                                                <div style={{ color: '#f59e0b' }}>Doublons: <b>{validationStats.duplicates}</b></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentStep === 'attachments' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div style={{ display: 'grid', placeItems: 'center', border: '2px dashed var(--border)', borderRadius: '12px', padding: '3rem 1rem', background: 'rgba(255,255,255,0.01)', position: 'relative' }}>
                                        <input type="file" multiple id="attachment-file-input" style={{ display: 'none' }} onChange={handleAttachmentUpload} disabled={uploadingFile} />
                                        <label htmlFor="attachment-file-input" style={{ cursor: uploadingFile ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                            <Paperclip size={36} style={{ color: 'var(--primary)' }} />
                                            <span style={{ fontWeight: 600 }}>Cliquer pour ajouter des pièces jointes</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Format autorisés: PDF, Word, Excel, JPG, PNG (Max 10 Mo par fichier, 5 fichiers max)</span>
                                        </label>
                                    </div>

                                    {uploadedFiles.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: 600 }}>Fichiers ajoutés :</h4>
                                            {uploadedFiles.map((fileObj, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <FileText size={16} />
                                                        <span>{fileObj.file.name} ({(fileObj.size / (1024 * 1024)).toFixed(2)} MB)</span>
                                                    </div>
                                                    <button onClick={() => removeUploadedFile(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentStep === 'preview' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', height: '350px' }}>
                                    {/* Sidebar Recipient selector */}
                                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)', overflowY: 'auto', padding: '0.5rem' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Cible d'exemple</div>
                                        {parsedRecipients.slice(0, 15).map((rec, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setPreviewRecipientIdx(idx)}
                                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem', background: previewRecipientIdx === idx ? 'rgba(99,102,241,0.1)' : 'transparent', color: previewRecipientIdx === idx ? 'var(--primary)' : 'var(--text)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            >
                                                {rec.email}
                                            </button>
                                        ))}
                                        {parsedRecipients.length > 15 && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>+ {parsedRecipients.length - 15} autres destinataires</div>}
                                    </div>

                                    {/* Personalization Mail Card */}
                                    <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                                            <div><span style={{ color: 'var(--text-muted)' }}>De :</span> <b>{campSenderName}</b> &lt;{campSenderEmail}&gt;</div>
                                            <div><span style={{ color: 'var(--text-muted)' }}>À :</span> <b>{parsedRecipients[previewRecipientIdx]?.email}</b></div>
                                            <div><span style={{ color: 'var(--text-muted)' }}>Objet :</span> <b>{renderPreviewHTML(campSubject, parsedRecipients[previewRecipientIdx])}</b></div>
                                        </div>
                                        <div style={{ padding: '1rem', flex: 1, overflowY: 'auto', background: '#f9f9f9', fontSize: '0.8125rem', fontFamily: 'sans-serif' }}>
                                            <div dangerouslySetInnerHTML={{ __html: buildPreviewHtml(campBody, parsedRecipients[previewRecipientIdx]) }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep === 'confirm' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                        <CheckCircle size={48} style={{ color: '#22c55e', marginBottom: '0.75rem' }} />
                                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>Votre campagne est prête !</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>Veuillez passer en revue le résumé avant de sauvegarder.</p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                                        <div>
                                            <div style={{ color: 'var(--text-muted)' }}>Nom de la campagne</div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{campName}</div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-muted)' }}>Objet</div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{campSubject}</div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-muted)' }}>Cibles validées</div>
                                            <div style={{ fontWeight: 600, color: '#22c55e', fontSize: '0.9375rem' }}>{validationStats.valid} destinataires</div>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-muted)' }}>Pièces jointes</div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{uploadedFiles.length} fichiers</div>
                                        </div>
                                    </div>

                                    {(validationStats.duplicates > 0 || validationStats.invalid > 0) && (
                                        <div style={{ display: 'flex', gap: '0.75rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid #f59e0b', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.8125rem' }}>
                                            <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                            <div>
                                                <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 600, color: '#f59e0b' }}>Destinataires ignorés</h4>
                                                <span>Votre fichier contient <b>{validationStats.duplicates} doublons</b> et <b>{validationStats.invalid} emails invalides</b>. Ceux-ci seront automatiquement ignorés lors de l'envoi.</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer / Control Navigation Buttons */}
                        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                {currentStep !== 'recipients' && (
                                    <button
                                        onClick={() => {
                                            if (currentStep === 'mapping') setCurrentStep('recipients');
                                            else if (currentStep === 'details') setCurrentStep(targetType === 'external_import' ? 'mapping' : 'recipients');
                                            else if (currentStep === 'attachments') setCurrentStep('details');
                                            else if (currentStep === 'preview') setCurrentStep('attachments');
                                            else if (currentStep === 'confirm') setCurrentStep('preview');
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '0.875rem' }}
                                    >
                                        <ArrowLeft size={16} /> Précédent
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {currentStep !== 'confirm' ? (
                                    <button
                                        onClick={async () => {
                                            if (currentStep === 'recipients') {
                                                await handleSelectRecipientsStep();
                                            } else if (currentStep === 'mapping') {
                                                if (validationStats.valid === 0) {
                                                    addToast("Aucun destinataire valide à importer", "error");
                                                    return;
                                                }
                                                setCurrentStep('details');
                                            } else if (currentStep === 'details') {
                                                if (!campName.trim() || !campSubject.trim() || !campBody.trim()) {
                                                    addToast("Nom, sujet et contenu requis", "error");
                                                    return;
                                                }
                                                setCurrentStep('attachments');
                                            } else if (currentStep === 'attachments') {
                                                setCurrentStep('preview');
                                            } else if (currentStep === 'preview') {
                                                setCurrentStep('confirm');
                                            }
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
                                    >
                                        Suivant <ArrowRight size={16} />
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleSaveCampaign('draft')}
                                            style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
                                        >
                                            Sauvegarder Brouillon
                                        </button>
                                        <button
                                            onClick={() => handleSaveCampaign('ready')}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
                                        >
                                            <Send size={16} /> Prêt pour Envoi
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
