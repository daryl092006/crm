
import React, { useState } from 'react';
import { X, Plus, Trash2, Info, TrendingUp, Settings } from 'lucide-react';

interface ColumnMapping {
    field: string;
    label: string;
}

const AVAILABLE_FIELDS = [
    { value: 'firstName', label: 'Prénom' },
    { value: 'lastName', label: 'Nom' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Téléphone' },
    { value: 'country', label: 'Pays' },
    { value: 'city', label: 'Ville' },
    { value: 'fieldOfInterest', label: 'Filière' },
    { value: 'level', label: 'Niveau' },
    { value: 'notes', label: 'Notes' },
    { value: 'custom', label: '+ Autre (Champ Personnalisé)' },
];

interface AddCampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    agents: any[];
    onSave: (campaignData: { 
        name: string; 
        source: string; 
        column_mappings: ColumnMapping[];
        assignment_mode: 'auto' | 'fixed';
        assigned_agent_ids: string[];
    }) => Promise<void>;
}

const AddCampaignModal: React.FC<AddCampaignModalProps> = ({ isOpen, onClose, agents, onSave }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [source, setSource] = useState('Facebook');
    const [mode, setMode] = useState<'excel' | 'sheets'>('excel');
    const [assignmentMode, setAssignmentMode] = useState<'auto' | 'fixed'>('auto');
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
    const [mappings, setMappings] = useState<ColumnMapping[]>([
        { field: 'firstName', label: 'Prénom' },
        { field: 'lastName', label: 'Nom' },
        { field: 'email', label: 'Email' },
        { field: 'phone', label: 'Téléphone' },
    ]);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    const handleSubmit = async () => {
        if (!name) return;
        setLoading(true);
        try {
            await onSave({ 
                name, 
                source: mode === 'sheets' ? 'Google Sheets' : source, 
                column_mappings: mappings,
                assignment_mode: assignmentMode,
                assigned_agent_ids: selectedAgentIds
            });
            setName('');
            setSource('Facebook');
            setMode('excel');
            setAssignmentMode('auto');
            setSelectedAgentIds([]);
            setMappings([
                { field: 'firstName', label: 'Prénom' },
                { field: 'lastName', label: 'Nom' },
                { field: 'email', label: 'Email' },
                { field: 'phone', label: 'Téléphone' },
            ]);
            setStep(1);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const addColumn = () => {
        setMappings([...mappings, { field: 'firstName', label: 'Nouvelle Colonne' }]);
    };

    const removeColumn = (index: number) => {
        setMappings(mappings.filter((_, i) => i !== index));
    };

    const updateColumn = (index: number, updates: Partial<ColumnMapping>) => {
        setMappings(mappings.map((m, i) => i === index ? { ...m, ...updates } : m));
    };

    const toggleAgent = (id: string) => {
        setSelectedAgentIds(prev => 
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const renderStepContent = () => {
        switch(step) {
            case 1:
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>1. Nom de la Campagne</label>
                            <input 
                                type="text" 
                                className="input-field" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)}
                                placeholder="ex: Campagne Sénégal Printemps 2024"
                                style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', color: 'white', fontSize: '1rem' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600 }}>2. Méthode d'acquisition</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div onClick={() => setMode('excel')} style={{ padding: '1.5rem', borderRadius: '16px', border: `2px solid ${mode === 'excel' ? 'var(--primary)' : 'var(--border)'}`, background: mode === 'excel' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: mode === 'excel' ? 'var(--primary)' : 'rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center', marginBottom: '1rem', color: mode === 'excel' ? 'white' : 'var(--text-muted)' }}>
                                        <Plus size={20} />
                                    </div>
                                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>Import Manuel</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>Fichiers Excel ou CSV.</div>
                                </div>

                                <div onClick={() => setMode('sheets')} style={{ padding: '1.5rem', borderRadius: '16px', border: `2px solid ${mode === 'sheets' ? 'var(--accent)' : 'var(--border)'}`, background: mode === 'sheets' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: mode === 'sheets' ? 'var(--accent)' : 'rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center', marginBottom: '1rem', color: mode === 'sheets' ? 'white' : 'var(--text-muted)' }}>
                                        <TrendingUp size={20} />
                                    </div>
                                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>Google Sheets</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>Synchro automatique en temps réel.</div>
                                </div>
                            </div>
                        </div>

                        {mode === 'excel' && (
                            <div className="form-group animate-fade-in">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Source Marketing</label>
                                <select className="input-field" value={source} onChange={(e) => setSource(e.target.value)} style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}>
                                    {['Facebook', 'TikTok', 'Instagram', 'Salon', 'Google', 'Autre'].map(s => <option key={s} value={s} style={{background: '#1a1b1e'}}>{s}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                );
            case 2:
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '1rem', display: 'flex', gap: '12px' }}>
                            <Info size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-main)', lineHeight: 1.4 }}>Indiquez à quelle donnée du CRM correspond chaque colonne de votre source.</p>
                        </div>
                        {mappings.map((m, index) => (
                            <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1fr) 50px', gap: '1rem', alignItems: 'center' }}>
                                <select value={AVAILABLE_FIELDS.some(f => f.value === m.field) ? m.field : 'custom'} onChange={(e) => updateColumn(index, { field: e.target.value })} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', padding: '0.6rem', borderRadius: '8px', fontSize: '0.875rem' }}>
                                    {AVAILABLE_FIELDS.map(f => <option key={f.value} value={f.value} style={{background: '#1a1b1e'}}>{f.label}</option>)}
                                </select>
                                <input value={m.label} onChange={(e) => updateColumn(index, { label: e.target.value })} placeholder="Entête du fichier" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', padding: '0.6rem', borderRadius: '8px', fontSize: '0.875rem' }} />
                                <div style={{ position: 'relative', visibility: AVAILABLE_FIELDS.some(f => f.value === m.field && f.value !== 'custom') ? 'hidden' : 'visible' }}>
                                    <input value={AVAILABLE_FIELDS.some(f => f.value === m.field && f.value !== 'custom') ? '' : m.field} onChange={(e) => updateColumn(index, { field: e.target.value })} placeholder="Nom du champ" style={{ width: '100%', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', color: 'white', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8125rem' }} />
                                </div>
                                <button onClick={() => removeColumn(index)} style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <button onClick={addColumn} style={{ marginTop: '1rem', padding: '0.75rem', border: '1px dashed var(--border)', borderRadius: '10px', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.875rem' }}><Plus size={16} /> Ajouter une colonne</button>
                    </div>
                );
            case 3:
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600 }}>Stratégie d'Attribution</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div onClick={() => setAssignmentMode('auto')} style={{ padding: '1.25rem', borderRadius: '12px', border: `2px solid ${assignmentMode === 'auto' ? 'var(--primary)' : 'var(--border)'}`, background: assignmentMode === 'auto' ? 'rgba(99, 102, 241, 0.05)' : 'transparent', cursor: 'pointer' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Automatique (Round Robin)</div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Distribution équitable à tous les conseillers actifs.</p>
                                </div>
                                <div onClick={() => setAssignmentMode('fixed')} style={{ padding: '1.25rem', borderRadius: '12px', border: `2px solid ${assignmentMode === 'fixed' ? 'var(--primary)' : 'var(--border)'}`, background: assignmentMode === 'fixed' ? 'rgba(99, 102, 241, 0.05)' : 'transparent', cursor: 'pointer' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Assignation Spécifique</div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Les leads vont uniquement aux conseillers sélectionnés.</p>
                                </div>
                            </div>
                        </div>

                        {assignmentMode === 'fixed' && (
                            <div className="animate-fade-in">
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>Sélectionnez les Conseillers</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '8px' }}>
                                    {agents.map(agent => (
                                        <div 
                                            key={agent.id} 
                                            onClick={() => toggleAgent(agent.id)}
                                            style={{ 
                                                padding: '0.75rem', borderRadius: '10px', border: `1px solid ${selectedAgentIds.includes(agent.id) ? 'var(--primary)' : 'var(--border)'}`, 
                                                background: selectedAgentIds.includes(agent.id) ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' 
                                            }}
                                        >
                                            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--primary)', display: 'grid', placeItems: 'center', color: 'white', fontSize: '0.6rem', fontWeight: 800 }}>
                                                {agent.name.charAt(0)}
                                            </div>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{agent.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'grid', placeItems: 'center', zIndex: 1100, backdropFilter: 'blur(10px)'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                            {step === 1 ? 'Nouvelle Campagne' : step === 2 ? 'Configuration Mapping' : 'Attribution des Leads'}
                        </h2>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <div style={{ width: '20px', height: '4px', borderRadius: '2px', background: step >= 1 ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }}></div>
                            <div style={{ width: '20px', height: '4px', borderRadius: '2px', background: step >= 2 ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }}></div>
                            <div style={{ width: '20px', height: '4px', borderRadius: '2px', background: step >= 3 ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }}></div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                    {renderStepContent()}
                </div>

                <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    {step < 3 ? (
                        <>
                            {step > 1 && <button onClick={handleBack} className="btn btn-ghost">Retour</button>}
                            <button 
                                onClick={handleNext} 
                                className="btn btn-primary" 
                                disabled={!name || loading}
                                style={{ padding: '0.8rem 2.5rem', borderRadius: '12px', fontWeight: 800 }}
                            >
                                Suivant
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={handleBack} className="btn btn-ghost">Retour</button>
                            <button 
                                onClick={handleSubmit} 
                                className="btn btn-primary" 
                                disabled={loading || (assignmentMode === 'fixed' && selectedAgentIds.length === 0)}
                                style={{ padding: '0.8rem 2.5rem', borderRadius: '12px', fontWeight: 800 }}
                            >
                                {loading ? 'Création...' : 'Lancer la Campagne'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddCampaignModal;
