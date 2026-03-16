import React, { useState } from 'react';
import type { StudentLead, Campaign, Agent, StudyField } from '../types';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { getBestAgentForLead } from '../utils/assignmentService';

interface LeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (lead: StudentLead) => void;
    campaigns: Campaign[];
    agents: Agent[];
    leads: StudentLead[];
    profile: any;
    initialStatusId?: string;
}
const LeadModal: React.FC<LeadModalProps> = ({ isOpen, onClose, onSave, campaigns, agents, leads, profile, initialStatusId = 'nouveau' }) => {
    const { addToast } = useToast();
    const [newLead, setNewLead] = useState<Partial<StudentLead>>({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        country: 'Sénégal',
        city: '',
        fieldOfInterest: 'Finance Digitale' as StudyField,
        level: 'Licence 1',
        statusId: initialStatusId,
        campaignId: '',
        notes: '',
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

        const dbLead = {
            first_name: newLead.firstName,
            last_name: newLead.lastName,
            email: newLead.email,
            phone: newLead.phone,
            country: newLead.country,
            city: newLead.city,
            field_of_interest: newLead.fieldOfInterest,
            study_level: newLead.level,
            status_id: newLead.statusId || 'nouveau',
            campaign_id: newLead.campaignId,
            agent_id: selectedA.id,
            organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
        };

        const { data, error } = await supabase.from('leads').insert(dbLead).select().single();

        if (error) {
            addToast("Erreur lors de la création : " + error.message, "error");
        } else if (data) {
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
                score: data.score || 0,
                lastInteractionAt: data.last_interaction_at,
                createdAt: data.created_at
            });
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
                    <input type="email" placeholder="Email" required value={newLead.email} onChange={e => setNewLead({ ...newLead, email: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }} />
                    <input type="tel" placeholder="Téléphone" required value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }} />
                    <input type="text" placeholder="Pays" required value={newLead.country} onChange={e => setNewLead({ ...newLead, country: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }} />
                    <input type="text" placeholder="Ville" required value={newLead.city} onChange={e => setNewLead({ ...newLead, city: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }} />

                    <select
                        value={newLead.fieldOfInterest}
                        onChange={e => setNewLead({ ...newLead, fieldOfInterest: e.target.value as any })}
                        style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                    >
                        <option value="Finance Digitale">Finance Digitale</option>
                        <option value="Marketing Digital & E-commerce">Marketing Digital & E-commerce</option>
                        <option value="Intelligence Artificielle & Génie Logiciel">Intelligence Artificielle & Génie Logiciel</option>
                        <option value="Management de Projet Numérique">Management de Projet Numérique</option>
                        <option value="Autre">Autre</option>
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

                    <input type="text" placeholder="Niveau d'étude" required value={newLead.level} onChange={e => setNewLead({ ...newLead, level: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', gridColumn: 'span 2' }} />
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
