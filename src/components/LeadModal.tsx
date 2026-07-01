import React, { useState } from 'react';
import type { StudentLead, Campaign, Agent, StudyField } from '../types';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { sanitizeForPostgres } from '../utils/verificationService';
import { getBestAgentForLead } from '../utils/assignmentService';
import { logAction } from '../utils/auditLogger';
import { notifyAgentLeads } from '../utils/emailNotificationService';

interface LeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (lead: StudentLead) => void;
    campaigns: Campaign[];
    agents: Agent[];
    leads: StudentLead[];
    profile: import('../types').Profile | null;
    initialStatusId?: string;
    showConfirm: (title: string, message: string) => Promise<boolean>;
    statuses: import('../types').LeadStatus[];
    programs: import('../types').Program[];
    classifications: import('../types').ProspectClassification[];
    sources: import('../types').ProspectSource[];
}
const LeadModal: React.FC<LeadModalProps> = ({ isOpen, onClose, onSave, campaigns, agents, leads, profile, initialStatusId = 'nouveau', showConfirm, statuses, programs, classifications, sources }) => {
    const { addToast } = useToast();
    const [newLead, setNewLead] = useState<Partial<StudentLead>>({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        country: '',
        city: '',
        fieldOfInterest: '' as StudyField,
        level: '',
        statusId: initialStatusId,
        campaignId: '',
        notes: '',
        programId: null,
        classificationId: null,
        sourceId: null,
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Assignation automatique
        const selectedA = getBestAgentForLead(agents, leads);
        if (!selectedA) {
            addToast("Aucun agent disponible pour l'assignation.", "error");
            return;
        }

        // Raw Data Policy
        const finalCountry = newLead.country || '';
        const finalCity = newLead.city || '';
        const finalPhone = newLead.phone?.trim() || '';
        const finalEmail = newLead.email?.toLowerCase().trim() || '';

        // Au moins un moyen de contact obligatoire
        if (!finalEmail && !finalPhone) {
            addToast("Veuillez fournir au moins un email ou un numéro de téléphone.", "error");
            return;
        }

        // Vérification des doublons locaux/distants (uniquement sur champs non-vides)
        const orFilters = [];
        if (finalEmail) orFilters.push(`email.eq.${finalEmail}`);
        if (finalPhone) orFilters.push(`phone.eq.${finalPhone}`);

        const { data: existing } = orFilters.length > 0 ? await supabase
            .from('leads')
            .select('id, first_name, last_name, email, phone')
            .or(orFilters.join(','))
            .limit(1) : { data: [] };

        if (existing && existing.length > 0) {
            const confirmed = await showConfirm(
                "Doublon Détecté",
                `Un prospect avec cet email ou ce numéro existe déjà (${existing[0].first_name} ${existing[0].last_name}). Voulez-vous mettre à jour sa fiche plutôt qu'en créer une nouvelle ?`
            );
            if (!confirmed) return;
        }

        if (existing && existing.length > 0) {
            // Mode Mise à jour (Auto-Harmonize)
            const { data: updated, error } = await supabase
                .from('leads')
                .update(sanitizeForPostgres({
                    first_name: newLead.firstName,
                    last_name: newLead.lastName,
                    email: finalEmail,
                    phone: finalPhone,
                    country: finalCountry,
                    city: finalCity,
                    field_of_interest: newLead.fieldOfInterest,
                    study_level: newLead.level,
                    status_id: newLead.statusId || 'nouveau',
                    campaign_id: newLead.campaignId,
                    organization_id: profile?.organization_id,
                    program_id: newLead.programId || null,
                    classification_id: newLead.classificationId || null,
                    source_id: newLead.sourceId || null,
                    metadata: newLead.metadata || {}
                }))
                .eq('id', existing[0].id)
                .select()
                .single();

            if (error) {
                addToast("Erreur lors de la mise à jour : " + (error as Error).message, "error");
                return;
            }
            
            addToast("Fiche mise à jour automatiquement !", "success");
            if (updated) {
                onSave({
                    id: updated.id,
                    organizationId: updated.organization_id,
                    campaignId: updated.campaign_id,
                    agentId: updated.agent_id,
                    statusId: updated.status_id,
                    firstName: updated.first_name,
                    lastName: updated.last_name,
                    email: updated.email,
                    phone: updated.phone,
                    country: updated.country,
                    city: updated.city,
                    fieldOfInterest: updated.field_of_interest,
                    level: updated.study_level,
                    lastInteractionAt: updated.last_interaction_at,
                    createdAt: updated.created_at,
                    programId: updated.program_id,
                    classificationId: updated.classification_id,
                    sourceId: updated.source_id,
                    score: updated.score || 0,
                    source: updated.source || null,
                    whatsapp: updated.whatsapp || null,
                    metadata: updated.metadata || {}
                });
            }
            onClose();
            return;
        }

        const { data, error } = await supabase
            .from('leads')
            .insert(sanitizeForPostgres({
                first_name: newLead.firstName,
                last_name: newLead.lastName,
                email: finalEmail,
                phone: finalPhone,
                country: finalCountry,
                city: finalCity,
                field_of_interest: newLead.fieldOfInterest,
                study_level: newLead.level,
                status_id: newLead.statusId || 'nouveau',
                campaign_id: newLead.campaignId,
                agent_id: selectedA.id,
                organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000',
                program_id: newLead.programId || null,
                classification_id: newLead.classificationId || null,
                source_id: newLead.sourceId || null,
                metadata: newLead.metadata || {}
            }))
            .select()
            .single();

        if (error) {
            addToast("Erreur lors de la création : " + (error as Error).message, "error");
        } else if (data) {
            // Journaliser la création dans l'audit log
            logAction('create', 'lead', {
                entityId: data.id,
                campaignId: data.campaign_id,
                newValues: data
            });

            if (newLead.notes) {
                await supabase.from('lead_interactions').insert({
                    lead_id: data.id,
                    agent_id: data.agent_id,
                    type: 'note',
                    content: newLead.notes
                });
            }
            onSave({
                id: data.id,
                organizationId: data.organization_id,
                campaignId: data.campaign_id,
                agentId: data.agent_id,
                statusId: data.status_id,
                firstName: data.first_name,
                lastName: data.last_name,
                email: data.email,
                phone: data.phone,
                country: data.country,
                city: data.city,
                fieldOfInterest: data.field_of_interest,
                level: data.study_level,
                lastInteractionAt: data.last_interaction_at,
                createdAt: data.created_at,
                programId: data.program_id,
                classificationId: data.classification_id,
                sourceId: data.source_id,
                score: data.score || 0,
                source: data.source || null,
                whatsapp: data.whatsapp || null,
                metadata: data.metadata || {}
            });
            // Déclencher la notification mail
            if (data.agent_id && selectedA) {
                const campaignName = campaigns.find(c => c.id === data.campaign_id)?.name || 'Attribution Directe';
                if (selectedA.email) {
                    notifyAgentLeads(
                        selectedA.email,
                        selectedA.name,
                        campaignName,
                        1
                    ).catch(err => console.error("Notification single agent error:", err));
                }
            }

            addToast(`Prospect ajouté et assigné à ${selectedA.name} !`, "success");
            onClose();
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'grid',
            placeItems: 'center', padding: '2rem'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Nouveau Prospect</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <input type="text" placeholder="Prénom" required value={newLead.firstName} onChange={e => setNewLead({ ...newLead, firstName: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }} />
                    <input type="text" placeholder="Nom" required value={newLead.lastName} onChange={e => setNewLead({ ...newLead, lastName: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }} />
                    <input type="email" placeholder="Email (optionnel si tél. fourni)" value={newLead.email} onChange={e => setNewLead({ ...newLead, email: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input type="tel" placeholder="Téléphone (optionnel si email fourni)" value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', width: '100%' }} />
                    </div>
                    <input type="text" placeholder="Pays" required value={newLead.country} onChange={e => setNewLead({ ...newLead, country: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }} />
                    <input type="text" placeholder="Ville" required value={newLead.city} onChange={e => setNewLead({ ...newLead, city: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }} />

                    <select
                        value={newLead.programId || ''}
                        onChange={e => {
                            const progId = e.target.value;
                            const prog = programs.find(p => p.id === progId);
                            setNewLead({ 
                                ...newLead, 
                                programId: progId || null, 
                                fieldOfInterest: prog ? prog.name as any : '' 
                            });
                        }}
                        style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                    >
                        <option value="">Sélectionner une Filière *</option>
                        {programs.map(p => (
                            <option key={p.id} value={p.id} style={{background: '#1a1b1e'}}>{p.name}</option>
                        ))}
                    </select>

                    <select
                        required
                        value={newLead.campaignId}
                        onChange={e => setNewLead({ ...newLead, campaignId: e.target.value })}
                        style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                    >
                        <option value="">Campagne (Obligatoire)</option>
                        {campaigns.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    <select
                        value={newLead.statusId}
                        onChange={e => setNewLead({ ...newLead, statusId: e.target.value })}
                        style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                    >
                        {[...statuses].sort((a,b) => a.label.localeCompare(b.label)).map(s => (
                            <option key={s.id} value={s.id} style={{background: '#1a1b1e'}}>{s.label}</option>
                        ))}
                    </select>

                    {/* Sélection Classement Dynamique */}
                    <select
                        value={newLead.classificationId || ''}
                        onChange={e => setNewLead({ ...newLead, classificationId: e.target.value || null })}
                        style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                    >
                        <option value="">Sélectionner un Classement</option>
                        {classifications.map(c => (
                            <option key={c.id} value={c.id} style={{background: '#1a1b1e'}}>{c.name}</option>
                        ))}
                    </select>

                    {/* Sélection Source Dynamique */}
                    <select
                        value={newLead.sourceId || ''}
                        onChange={e => {
                            const srcId = e.target.value;
                            const src = sources.find(s => s.id === srcId);
                            setNewLead({ 
                                ...newLead, 
                                sourceId: srcId || null, 
                                source: src ? src.name : '' 
                            });
                        }}
                        style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                    >
                        <option value="">Sélectionner une Source</option>
                        {sources.map(s => (
                            <option key={s.id} value={s.id} style={{background: '#1a1b1e'}}>{s.name}</option>
                        ))}
                    </select>

                    {/* Sélection Niveau d'étude Dynamique par rapport au Programme */}
                    {(() => {
                        const selectedProg = programs.find(p => p.id === newLead.programId);
                        let availableLevels: string[] = [];

                        if (selectedProg && selectedProg.level) {
                            try {
                                if (selectedProg.level.startsWith('[') && selectedProg.level.endsWith(']')) {
                                    availableLevels = JSON.parse(selectedProg.level);
                                } else {
                                    availableLevels = [selectedProg.level];
                                }
                            } catch {
                                availableLevels = [selectedProg.level];
                            }
                        }

                        return (
                            <select
                                required
                                value={newLead.level || ''}
                                onChange={e => setNewLead({ ...newLead, level: e.target.value })}
                                style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', gridColumn: 'span 2' }}
                            >
                                <option value="">Sélectionner un Niveau d'études *</option>
                                {availableLevels.length > 0 ? (
                                    availableLevels.map(lvl => (
                                        <option key={lvl} value={lvl} style={{background: '#1a1b1e'}}>{lvl}</option>
                                    ))
                                ) : (
                                    <>
                                        <option value="Licence 1" style={{background: '#1a1b1e'}}>Licence 1</option>
                                        <option value="Licence 2" style={{background: '#1a1b1e'}}>Licence 2</option>
                                        <option value="Licence 3" style={{background: '#1a1b1e'}}>Licence 3</option>
                                        <option value="Master 1" style={{background: '#1a1b1e'}}>Master 1</option>
                                        <option value="Master 2" style={{background: '#1a1b1e'}}>Master 2</option>
                                    </>
                                )}
                            </select>
                        );
                    })()}
                    {(() => {
                        const selectedCampaign = campaigns.find(c => c.id === newLead.campaignId);
                        if (!selectedCampaign || !selectedCampaign.column_mappings) return null;

                        const standardFields = ['firstName', 'lastName', 'email', 'phone', 'whatsapp', 'city', 'country', 'fieldOfInterest', 'level', 'statusId', 'campaignId', 'notes', 'programId', 'classificationId', 'sourceId'];
                        const customMappings = selectedCampaign.column_mappings.filter(m => !standardFields.includes(m.field));

                        if (customMappings.length === 0) return null;

                        return customMappings.map(m => {
                            const val = (newLead.metadata as any)?.[m.field] || '';
                            return (
                                <div key={m.field} style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 650 }}>{m.label}</label>
                                    <input
                                        type="text"
                                        placeholder={`Saisir ${m.label.toLowerCase()}...`}
                                        value={val}
                                        onChange={e => {
                                            const updatedMetadata = { ...((newLead.metadata || {}) as any), [m.field]: e.target.value };
                                            setNewLead({ ...newLead, metadata: updatedMetadata });
                                        }}
                                        style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', width: '100%' }}
                                    />
                                </div>
                            );
                        });
                    })()}

                    <textarea
                        placeholder="Note / Commentaire sur le prospect..."
                        value={newLead.notes}
                        onChange={e => setNewLead({ ...newLead, notes: e.target.value })}
                        style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', gridColumn: 'span 2', minHeight: '100px', resize: 'vertical' }}
                    />

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', gridColumn: 'span 2' }}>
                        <button type="button" onClick={onClose} className="btn" style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', color: 'white' }}>Annuler</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Ajouter</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LeadModal;
