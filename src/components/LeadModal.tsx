import React, { useState } from 'react';
import type { StudentLead, LeadStatus, Campaign, Agent } from '../types';
import { getBestAgentForLead } from '../utils/assignmentService';

interface LeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (lead: StudentLead) => void;
    initialStatus?: LeadStatus;
    campaigns: Campaign[];
    agents: Agent[];
    allLeads: StudentLead[];
}

const LeadModal: React.FC<LeadModalProps> = ({ isOpen, onClose, onSave, campaigns, agents, allLeads, initialStatus = 'Nouveau' }) => {
    const [newLead, setNewLead] = useState<Partial<StudentLead>>({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        country: 'Sénégal',
        city: '',
        fieldOfInterest: 'Finance Digitale',
        level: 'Licence 1',
        source: 'Autre',
        status: initialStatus,
        campaignId: '',
        notes: ''
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // L'assignation se fait en fonction de la charge actuelle.
        const assignedAgent = getBestAgentForLead(agents, allLeads);

        const lead: StudentLead = {
            id: `lead-${Date.now()}`,
            firstName: newLead.firstName || '',
            lastName: newLead.lastName || '',
            email: newLead.email || '',
            phone: newLead.phone || '',
            country: newLead.country || '',
            city: newLead.city || '',
            fieldOfInterest: (newLead.fieldOfInterest as any) || 'Finance Digitale',
            level: newLead.level || '',
            source: (newLead.source as any) || 'Autre',
            status: (newLead.status as any) || 'Nouveau',
            campaignId: newLead.campaignId || campaigns[0]?.id || '',
            agentId: assignedAgent?.id,
            phoneVerification: 'Inconnu',
            notes: newLead.notes || '',
            interactions: [],
            createdAt: new Date().toISOString(),
        };

        onSave(lead);
        onClose();
        setNewLead({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            country: 'Sénégal',
            city: '',
            fieldOfInterest: 'Finance Digitale',
            level: 'Licence 1',
            source: 'Autre',
            status: initialStatus,
            campaignId: '',
            notes: ''
        });
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 2000,
            display: 'grid',
            placeItems: 'center',
            padding: '2rem'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Nouveau Candidat</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}>
                        ×
                    </button>
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
                        <optgroup label="Licence">
                            <option value="Finance Digitale">Finance Digitale</option>
                            <option value="Marketing Digital & E-commerce">Marketing Digital & E-commerce</option>
                            <option value="Intelligence Artificielle & Génie Logiciel">Intelligence Artificielle & Génie Logiciel</option>
                            <option value="Management de Projet Numérique">Management de Projet Numérique</option>
                        </optgroup>
                        <optgroup label="Master">
                            <option value="Management de Projet & Transformation Digitale">Management de Projet & Transformation Digitale</option>
                            <option value="Finance Digitale">Finance Digitale (Master)</option>
                            <option value="Marketing Digital">Marketing Digital (Master)</option>
                            <option value="Executive Master en Finance Digitale">Executive Master en Finance Digitale</option>
                        </optgroup>
                        <option value="Autre">Autre</option>
                    </select>
                    <select
                        required
                        value={newLead.campaignId}
                        onChange={e => setNewLead({ ...newLead, campaignId: e.target.value })}
                        style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                    >
                        <option value="">Sélectionner une Campagne (Obligatoire)</option>
                        {campaigns.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <input type="text" placeholder="Niveau (ex: Master 1)" required value={newLead.level} onChange={e => setNewLead({ ...newLead, level: e.target.value })} style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }} />
                    <div style={{ gridColumn: 'span 2' }}>
                        <textarea placeholder="Notes additionnelles" value={newLead.notes} onChange={e => setNewLead({ ...newLead, notes: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', minHeight: '100px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', gridColumn: 'span 2' }}>
                        <button type="button" onClick={onClose} className="btn" style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', color: 'white' }}>
                            Annuler
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                            Ajouter le candidat
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LeadModal;
