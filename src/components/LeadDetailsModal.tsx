import React, { useState, useEffect, useCallback } from 'react';
import { X, Mail, Phone, MapPin, CheckCircle2, Calendar, Video, Map } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import type { StudentLead, LeadStatus, Agent, Profile } from '../types';
import { canAssignLeads } from '../utils/roleUtils';
import { logAction } from '../utils/auditLogger';

interface LeadDetailsModalProps {
    lead: StudentLead;
    isOpen: boolean;
    onClose: () => void;
    statuses: LeadStatus[];
    agents: Agent[];
    profile: Profile | null;
    onUpdate: () => Promise<void>;
    programs: import('../types').Program[];
    classifications: import('../types').ProspectClassification[];
    sources: import('../types').ProspectSource[];
    messageTemplates: import('../types').MessageTemplate[];
    campaigns: import('../types').Campaign[];
}


const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({ lead, isOpen, onClose, statuses, agents, profile, onUpdate, programs, classifications, sources, messageTemplates, campaigns }) => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [statusId, setStatusId] = useState(lead.statusId);
    const [agentId, setAgentId] = useState(lead.agentId || '');
    const [selectedField, setSelectedField] = useState<string>(lead.fieldOfInterest || '');
    const [selectedLevel, setSelectedLevel] = useState<string>(lead.level || '');
    const [programId, setProgramId] = useState<string>(lead.programId || '');
    const [classificationId, setClassificationId] = useState<string>(lead.classificationId || '');
    const [sourceId, setSourceId] = useState<string>(lead.sourceId || '');
    const [note, setNote] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentType, setAppointmentType] = useState('En Ligne');
    // Relances states
    const [followUpDate, setFollowUpDate] = useState('');
    const [followUpType, setFollowUpType] = useState('call');
    const [followUpPriority, setFollowUpPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
    const [followUpNote, setFollowUpNote] = useState('');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [history, setHistory] = useState<any[]>([]);

    // State pour l'envoi de messages via Templates
    const [activeChannelModal, setActiveChannelModal] = useState<'whatsapp' | 'email' | null>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [generatedSubject, setGeneratedSubject] = useState<string>('');
    const [generatedBody, setGeneratedBody] = useState<string>('');




    const LEVELS = ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2"];


    const fetchHistory = useCallback(async () => {
        const { data } = await supabase
            .from('lead_interactions')
            .select('*')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false });
        if (data) setHistory(data);
    }, [lead.id]);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
            setStatusId(lead.statusId);
            setAgentId(lead.agentId || '');
            setSelectedField(lead.fieldOfInterest || '');
            setSelectedLevel(lead.level || '');
            setProgramId(lead.programId || '');
            setClassificationId(lead.classificationId || '');
            setSourceId(lead.sourceId || '');
            setAppointmentDate('');
            setAppointmentType('En Ligne');
            setFollowUpDate('');
            setFollowUpType('call');
            setFollowUpPriority('normal');
            setFollowUpNote('');
        }
    }, [isOpen, lead, fetchHistory]);

    const compileTemplate = useCallback((templateBody: string, templateSubject?: string | null) => {
        const agentName = profile?.full_name || 'Votre conseiller';
        const programName = lead.fieldOfInterest || 'le programme d\'intérêt';
        const campaignName = campaigns.find(c => c.id === lead.campaignId)?.name || 'notre campagne';

        const vars: Record<string, string> = {
            '{{first_name}}': lead.firstName || '',
            '{{last_name}}': lead.lastName || '',
            '{{full_name}}': `${lead.firstName} ${lead.lastName || ''}`.trim(),
            '{{phone}}': lead.phone || '',
            '{{email}}': lead.email || '',
            '{{program_name}}': programName,
            '{{campaign_name}}': campaignName,
            '{{agent_name}}': agentName,
            '{{school_name}}': 'ESCEN',
            '{{city}}': lead.city || '',
            '{{source}}': lead.source || ''
        };

        let compiledBody = templateBody;
        let compiledSubject = templateSubject || '';

        Object.entries(vars).forEach(([key, val]) => {
            compiledBody = compiledBody.replace(new RegExp(key, 'g'), val);
            compiledSubject = compiledSubject.replace(new RegExp(key, 'g'), val);
        });

        return { body: compiledBody, subject: compiledSubject };
    }, [lead, profile]);

    const handleQuickAction = async (type: 'whatsapp' | 'call' | 'email') => {
        if (type === 'call') {
            const content = `📞 Appel : Appel téléphonique lancé vers le prospect.`;
            window.location.href = `tel:${lead.phone}`;
            try {
                await supabase.from('lead_interactions').insert({
                    lead_id: lead.id,
                    agent_id: profile?.id || lead.agentId || null,
                    type: 'call',
                    content: content,
                    direction: 'outbound',
                    created_by: profile?.id || null
                });
                addToast("Appel téléphonique lancé et enregistré !", "success");
                fetchHistory();
            } catch (err: any) {
                console.error(err);
            }
        } else {
            // Ouvrir l'éditeur de message via template
            const filteredTemplates = messageTemplates.filter(t => t.category === type && t.is_active);
            const defaultTemplate = filteredTemplates.find(t => t.is_default) || filteredTemplates[0];
            
            setActiveChannelModal(type);
            if (defaultTemplate) {
                setSelectedTemplateId(defaultTemplate.id);
                const compiled = compileTemplate(defaultTemplate.content, defaultTemplate.subject);
                setGeneratedBody(compiled.body);
                setGeneratedSubject(compiled.subject);
            } else {
                setSelectedTemplateId('custom');
                setGeneratedBody('');
                setGeneratedSubject('');
            }
        }
    };

    const handleSelectTemplate = (templateId: string) => {
        setSelectedTemplateId(templateId);
        if (templateId === 'custom') {
            setGeneratedBody('');
            setGeneratedSubject('');
            return;
        }

        const template = messageTemplates.find(t => t.id === templateId);
        if (template) {
            const compiled = compileTemplate(template.content, template.subject);
            setGeneratedBody(compiled.body);
            setGeneratedSubject(compiled.subject);
        }
    };

    const handleSendTemplateMessage = async () => {
        if (!generatedBody) {
            addToast("Le contenu du message ne peut pas être vide.", "error");
            return;
        }

        const templateName = selectedTemplateId === 'custom' 
            ? 'Message personnalisé' 
            : messageTemplates.find(t => t.id === selectedTemplateId)?.title || 'Modèle de message';

        try {
            if (activeChannelModal === 'whatsapp') {
                const encodedMsg = encodeURIComponent(generatedBody);
                const cleanedPhone = lead.phone.replace(/[^0-9]/g, '');
                window.open(`https://wa.me/${cleanedPhone}?text=${encodedMsg}`, '_blank');
            } else {
                const encodedSubject = encodeURIComponent(generatedSubject || 'Information ESCEN');
                const encodedBody = encodeURIComponent(generatedBody);
                window.location.href = `mailto:${lead.email}?subject=${encodedSubject}&body=${encodedBody}`;
            }

            // Enregistrer l'interaction
            await supabase.from('lead_interactions').insert({
                lead_id: lead.id,
                agent_id: profile?.id || lead.agentId || null,
                type: activeChannelModal as any,
                content: `${activeChannelModal === 'whatsapp' ? '💬 WhatsApp' : '✉️ Email'} envoyé via modèle : "${templateName}".\nContenu :\n${generatedBody}`,
                direction: 'outbound',
                created_by: profile?.id || null,
                metadata: {
                    template_id: selectedTemplateId !== 'custom' ? selectedTemplateId : null,
                    template_name: templateName,
                    generated_message: generatedBody,
                    channel: activeChannelModal
                }
            });

            addToast("Message envoyé et consigné dans l'historique !", "success");
            setActiveChannelModal(null);
            fetchHistory();
        } catch (err: any) {
            addToast("Erreur lors de l'enregistrement de l'action : " + err.message, "error");
        }
    };
    const handleUpdate = async () => {
        setLoading(true);
        try {
            // 1. Mettre à jour le prospect
            const { error: updateError } = await supabase
                .from('leads')
                .update({
                    status_id: statusId,
                    agent_id: agentId || null,
                    field_of_interest: selectedField,
                    level: selectedLevel,
                    program_id: programId || null,
                    classification_id: classificationId || null,
                    source_id: sourceId || null,
                    last_interaction_at: new Date().toISOString()
                })
                .eq('id', lead.id);
            if (updateError) throw updateError;

            // 1.a Planifier une relance si demandée
            if (followUpDate) {
                const { error: followUpError } = await supabase
                    .from('lead_follow_ups')
                    .insert({
                        lead_id: lead.id,
                        campaign_id: lead.campaignId,
                        assigned_to: agentId || profile?.id || null,
                        created_by: profile?.id || null,
                        due_at: new Date(followUpDate).toISOString(),
                        follow_up_type: followUpType,
                        priority: followUpPriority,
                        note: followUpNote || null,
                        status: 'pending'
                    });

                if (followUpError) throw followUpError;

                // Logguer dans l'historique
                await supabase.from('lead_interactions').insert({
                    lead_id: lead.id,
                    agent_id: profile?.id || lead.agentId || null,
                    type: 'follow_up',
                    content: `⏰ RELANCE PROGRAMMÉE : Relance (${followUpType === 'call' ? 'Appel' : followUpType}) de priorité ${followUpPriority} prévue le ${new Date(followUpDate).toLocaleString()}`,
                    created_by: profile?.id || null
                });
            }

            // 1.b Ajouter une interaction si le conseiller assigné a changé
            if (agentId !== lead.agentId) {
                const oldAgentName = agents.find(a => a.id === lead.agentId)?.name || 'Non assigné';
                const newAgentName = agents.find(a => a.id === agentId)?.name || 'Non assigné';
                
                await supabase.from('lead_interactions').insert({
                    lead_id: lead.id,
                    agent_id: profile?.id || lead.agentId,
                    type: 'note',
                    content: `👤 RÉASSIGNATION : Dossier transféré de ${oldAgentName} à ${newAgentName} par ${profile?.full_name || 'un Administrateur'}.`
                });
            }

            // 2. Ajouter les détails du rendez-vous / rappel si concerné
            if ((statusId.toLowerCase().includes('rendez-vous') || statusId.toLowerCase().includes('rappel') || statusId.toLowerCase().includes('cours'))) {
                if (!appointmentDate) {
                    addToast("Veuillez choisir une date pour le rappel/rendez-vous.", "warning");
                    setLoading(false);
                    return;
                }

                const isAppointment = statusId.toLowerCase().includes('rendez-vous');

                // Insertion dans l'historique (interactions)
                const { error: interactionError } = await supabase
                    .from('lead_interactions')
                    .insert({
                        lead_id: lead.id,
                        agent_id: lead.agentId,
                        type: isAppointment ? 'appointment' : 'reminder',
                        content: isAppointment
                            ? `🗓️ RDV PLANIFIÉ : ${new Date(appointmentDate).toLocaleString()} - Format : ${appointmentType}`
                            : `☎️ RAPPEL PLANIFIÉ : ${new Date(appointmentDate).toLocaleString()}`
                    });
                if (interactionError) throw interactionError;

                // Insertion dans la table technique des rendez-vous (pour les notifications/scanner)
                const { error: appointmentError } = await supabase
                    .from('appointments')
                    .insert({
                        lead_id: lead.id,
                        agent_id: lead.agentId,
                        title: isAppointment ? `RDV : ${lead.firstName} ${lead.lastName}` : `Rappel : ${lead.firstName} ${lead.lastName}`,
                        scheduled_at: new Date(appointmentDate).toISOString(),
                        status: 'scheduled'
                    });
                if (appointmentError) throw appointmentError;
            }

            // 3. Ajouter la note si présente
            if (note.trim()) {
                const { error: noteError } = await supabase
                    .from('lead_interactions')
                    .insert({
                        lead_id: lead.id,
                        agent_id: lead.agentId,
                        type: 'note',
                        content: note
                    });
                if (noteError) throw noteError;
            }

            // 4. Ajouter une interaction de changement de statut si le statut a changé
            if (statusId !== lead.statusId) {
                const newStatus = statuses.find(s => s.id === statusId)?.label || statusId;
                const { error: statusInteractionError } = await supabase.from('lead_interactions').insert({
                    lead_id: lead.id,
                    agent_id: lead.agentId,
                    type: 'status_change',
                    content: `Statut modifié en : ${newStatus}`
                });
                if (statusInteractionError) throw statusInteractionError;

                // Journaliser le changement de statut
                logAction('status_change', 'lead', {
                    entityId: lead.id,
                    campaignId: lead.campaignId,
                    oldValues: { status_id: lead.statusId },
                    newValues: { status_id: statusId }
                });
            }

            // 5. Journaliser la réaffectation
            if (agentId !== lead.agentId) {
                logAction('reassign', 'lead', {
                    entityId: lead.id,
                    campaignId: lead.campaignId,
                    oldValues: { agent_id: lead.agentId },
                    newValues: { agent_id: agentId }
                });
            }

            // 6. Journaliser la mise à jour globale
            logAction('update', 'lead', {
                entityId: lead.id,
                campaignId: lead.campaignId,
                oldValues: {
                    status_id: lead.statusId,
                    agent_id: lead.agentId,
                    level: lead.level,
                    field_of_interest: lead.fieldOfInterest
                },
                newValues: {
                    status_id: statusId,
                    agent_id: agentId || null,
                    level: selectedLevel,
                    field_of_interest: selectedField
                }
            });

            addToast("Fiche mise à jour avec succès !", "success");
            setNote('');
            await onUpdate();
            onClose();
        } catch (error: unknown) {
            addToast((error as Error).message, "error");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center',
            zIndex: 2000, padding: '1rem'
        }} onClick={onClose}>
            <div className="card" style={{
                width: '95%', maxWidth: '1100px', maxHeight: '90vh',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                background: '#0a0a0a', border: '1px solid var(--border)'
            }} onClick={e => e.stopPropagation()}>

                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary)', display: 'grid', placeItems: 'center', fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>
                            {lead.firstName[0]}{lead.lastName[0]}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{lead.firstName} {lead.lastName}</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Dossier prospect #{lead.id.slice(0, 8)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="grid-responsive-2" style={{ flex: 1, overflowY: 'auto', gap: '2rem', padding: '2rem' }}>

                    {/* Colonne GAUCHE : INFOS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Coordonnées & Actions Rapides</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'white' }}>
                                    <Mail size={18} color="var(--primary)" /> {lead.email}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'white' }}>
                                    <Phone size={18} color="var(--primary)" /> {lead.phone}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'white' }}>
                                    <MapPin size={18} color="var(--primary)" /> {lead.city}, {lead.country}
                                </div>
                            </div>
                            
                            {/* Boutons d'actions rapides WhatsApp / Appel / Email */}
                            <div className="grid-responsive-3" style={{ gap: '0.5rem' }}>
                                <button
                                    onClick={() => handleQuickAction('whatsapp')}
                                    className="btn"
                                    style={{ background: 'rgba(34, 197, 94, 0.08)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '0.5rem', fontSize: '0.8rem', justifyContent: 'center' }}
                                >
                                    🟢 WhatsApp
                                </button>
                                <button
                                    onClick={() => handleQuickAction('call')}
                                    className="btn"
                                    style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.5rem', fontSize: '0.8rem', justifyContent: 'center' }}
                                >
                                    📞 Appeler
                                </button>
                                <button
                                    onClick={() => handleQuickAction('email')}
                                    className="btn"
                                    style={{ background: 'rgba(168, 85, 247, 0.08)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '0.5rem', fontSize: '0.8rem', justifyContent: 'center' }}
                                >
                                    ✉️ Email
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Filière & Niveau</label>
                            <p style={{ fontWeight: 600 }}>{lead.fieldOfInterest}</p>
                            <p style={{ color: 'var(--text-muted)' }}>{lead.level}</p>
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Conseiller Assigné</label>
                            {canAssignLeads(profile?.role) ? (
                                <select
                                    value={agentId}
                                    onChange={e => setAgentId(e.target.value)}
                                    style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                                >
                                    <option value="">Non assigné (Libre)</option>
                                    {agents.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div style={{ padding: '0.875rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white', fontWeight: 600 }}>
                                    {agents.find(a => a.id === agentId)?.name || 'Non assigné'}
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Statut du dossier</label>
                            <select
                                value={statusId}
                                onChange={e => setStatusId(e.target.value)}
                                style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                            >
                                {statuses.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Filière & Programme</label>
                            <select
                                value={programId}
                                onChange={e => {
                                    const pId = e.target.value;
                                    setProgramId(pId);
                                    const matchedProg = programs.find(p => p.id === pId);
                                    if (matchedProg) setSelectedField(matchedProg.name);
                                }}
                                style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                            >
                                <option value="">Sélectionner un programme...</option>
                                {programs.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Classement dynamique</label>
                            <select
                                value={classificationId}
                                onChange={e => setClassificationId(e.target.value)}
                                style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                            >
                                <option value="">Aucun classement</option>
                                {classifications.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Source d'acquisition</label>
                            <select
                                value={sourceId}
                                onChange={e => setSourceId(e.target.value)}
                                style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                            >
                                <option value="">Aucune source configurée</option>
                                {sources.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {(statusId.toLowerCase().includes('inscrit') || statusId.toLowerCase().includes('confirme') || statusId.toLowerCase().includes('orientation')) && (
                            <div className="animate-fade" style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.1)', marginTop: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--success)', marginBottom: '1.25rem' }}>
                                    <CheckCircle2 size={18} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                        {statusId.toLowerCase().includes('orientation') ? 'Détails de la Réorientation' : 'Détails de l\'Inscription'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Niveau d'entrée</label>
                                        <select
                                            value={selectedLevel}
                                            onChange={e => setSelectedLevel(e.target.value)}
                                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: 'white' }}
                                        >
                                            <option value="">Sélectionner le niveau...</option>
                                            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Filière (Texte Libre)</label>
                                        <input
                                            type="text"
                                            value={selectedField}
                                            onChange={e => setSelectedField(e.target.value)}
                                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: 'white' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        {(statusId.toLowerCase().includes('rendez-vous') || statusId.toLowerCase().includes('rappel') || statusId.toLowerCase().includes('cours')) && (
                            <div className="animate-fade" style={{ padding: '1.5rem', background: statusId.toLowerCase().includes('rendez-vous') ? 'rgba(99, 102, 241, 0.05)' : 'rgba(245, 158, 11, 0.05)', borderRadius: '16px', border: statusId.toLowerCase().includes('rendez-vous') ? '1px solid rgba(99, 102, 241, 0.1)' : '1px solid rgba(245, 158, 11, 0.1)', marginTop: '0.8rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: statusId.toLowerCase().includes('rendez-vous') ? 'var(--primary)' : 'var(--warning)', marginBottom: '1.25rem' }}>
                                    {statusId.toLowerCase().includes('rendez-vous') ? <Calendar size={18} /> : <Phone size={18} />}
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                        {statusId.toLowerCase().includes('rendez-vous') ? 'Planification du Rendez-vous' : 'Planification du Rappel'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Prévu le : (Date et Heure)</label>
                                        <input
                                            type="datetime-local"
                                            value={appointmentDate}
                                            onChange={e => setAppointmentDate(e.target.value)}
                                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: statusId.toLowerCase().includes('rendez-vous') ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', color: 'white' }}
                                        />
                                    </div>
                                    {statusId.toLowerCase().includes('rendez-vous') && (
                                        <div className="grid-responsive-2" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <button
                                                onClick={() => setAppointmentType('En Ligne')}
                                                style={{
                                                    padding: '0.625rem',
                                                    borderRadius: '10px',
                                                    border: '1px solid ' + (appointmentType === 'En Ligne' ? 'var(--primary)' : 'var(--border)'),
                                                    background: appointmentType === 'En Ligne' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Video size={14} /> En Ligne
                                            </button>
                                            <button
                                                onClick={() => setAppointmentType('Présentiel')}
                                                style={{
                                                    padding: '0.625rem',
                                                    borderRadius: '10px',
                                                    border: '1px solid ' + (appointmentType === 'Présentiel' ? 'var(--primary)' : 'var(--border)'),
                                                    background: appointmentType === 'Présentiel' ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Map size={14} /> Campus
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Planifier une relance prospect */}
                        <div className="form-group" style={{ padding: '1.25rem', background: 'rgba(99, 102, 241, 0.03)', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.1)', marginTop: '0.5rem' }}>
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 800, marginBottom: '0.75rem', display: 'block' }}>Programmer une relance</label>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div className="grid-responsive-2" style={{ gap: '0.5rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Prévu le :</label>
                                        <input
                                            type="datetime-local"
                                            value={followUpDate}
                                            onChange={e => setFollowUpDate(e.target.value)}
                                            style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.8rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Canal :</label>
                                        <select
                                            value={followUpType}
                                            onChange={e => setFollowUpType(e.target.value)}
                                            style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.8rem' }}
                                        >
                                            <option value="call" style={{background: '#1a1b1e'}}>Appel</option>
                                            <option value="whatsapp" style={{background: '#1a1b1e'}}>WhatsApp</option>
                                            <option value="email" style={{background: '#1a1b1e'}}>Email</option>
                                            <option value="meeting" style={{background: '#1a1b1e'}}>Rendez-vous</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Priorité :</label>
                                        <select
                                            value={followUpPriority}
                                            onChange={e => setFollowUpPriority(e.target.value as any)}
                                            style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.8rem' }}
                                        >
                                            <option value="low" style={{background: '#1a1b1e'}}>Basse</option>
                                            <option value="normal" style={{background: '#1a1b1e'}}>Normale</option>
                                            <option value="high" style={{background: '#1a1b1e'}}>Haute</option>
                                            <option value="urgent" style={{background: '#1a1b1e'}}>Urgente</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Notes / Consignes :</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Demander relevé de notes..."
                                        value={followUpNote}
                                        onChange={e => setFollowUpNote(e.target.value)}
                                        style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.8rem' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Colonne DROITE : ACTIONS & HISTORIQUE */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Ajouter une note de suivi</label>
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Compte-rendu de l'appel, questions posées..."
                                style={{ width: '100%', minHeight: '120px', padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', color: 'white', resize: 'none' }}
                            />
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block' }}>Historique des activités</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {history.length === 0 ? (
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Aucun historique pour ce prospect.</p>
                                ) : (
                                    history.map((h) => (
                                        <div key={h.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                                {new Date(h.created_at).toLocaleString()}
                                            </div>
                                            <div style={{ fontSize: '0.875rem' }}>{h.content}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                    <button onClick={onClose} className="btn" style={{ background: 'transparent', color: 'white' }}>Annuler</button>
                    <button
                        onClick={handleUpdate}
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem 2rem', fontWeight: 700 }}
                    >
                        {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                </div>
            </div>

            {/* MODAL ENVOI DE MESSAGE VIA TEMPLATE */}
            {activeChannelModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                    display: 'grid', placeItems: 'center', zIndex: 3000, backdropFilter: 'blur(8px)', padding: '1rem'
                }} onClick={() => setActiveChannelModal(null)}>
                    <div className="card animate-fade" style={{ width: '100%', maxWidth: '600px', background: '#0a0a0a', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                                {activeChannelModal === 'whatsapp' ? '💬 Envoyer via WhatsApp' : '✉️ Envoyer un Email'}
                            </h3>
                            <button onClick={() => setActiveChannelModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Choix du modèle */}
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Modèle de message</label>
                                <select
                                    value={selectedTemplateId}
                                    onChange={e => handleSelectTemplate(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                                >
                                    <option value="custom" style={{background: '#1a1b1e'}}>✍️ Saisie libre (Message personnalisé)</option>
                                    {messageTemplates
                                        .filter(t => t.category === activeChannelModal && t.is_active)
                                        .map(t => (
                                            <option key={t.id} value={t.id} style={{background: '#1a1b1e'}}>{t.title}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            {/* Sujet (Email uniquement) */}
                            {activeChannelModal === 'email' && (
                                <div className="form-group">
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Sujet du mail</label>
                                    <input
                                        type="text"
                                        value={generatedSubject}
                                        onChange={e => setGeneratedSubject(e.target.value)}
                                        placeholder="Objet de l'email..."
                                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                                    />
                                </div>
                            )}

                            {/* Corps du message */}
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Message à envoyer</label>
                                <textarea
                                    value={generatedBody}
                                    onChange={e => setGeneratedBody(e.target.value)}
                                    placeholder="Rédigez votre message ici..."
                                    style={{ width: '100%', minHeight: '180px', padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', color: 'white', resize: 'vertical' }}
                                />
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    💡 Les variables (ex: <code style={{ color: 'var(--primary)' }}>{"{{first_name}}"}</code>, <code style={{ color: 'var(--primary)' }}>{"{{program_name}}"}</code>) sont automatiquement résolues à partir des coordonnées du prospect.
                                </p>
                            </div>
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                            <button onClick={() => setActiveChannelModal(null)} className="btn" style={{ background: 'transparent', color: 'white' }}>Annuler</button>
                            <button
                                onClick={handleSendTemplateMessage}
                                className="btn btn-primary"
                                style={{ padding: '0.75rem 1.5rem', fontWeight: 700 }}
                            >
                                {activeChannelModal === 'whatsapp' ? '💬 Ouvrir WhatsApp' : '✉️ Envoyer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeadDetailsModal;
