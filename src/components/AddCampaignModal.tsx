
import React, { useState } from 'react';
import { X, Plus, Trash2, Info } from 'lucide-react';



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
    onSave: (campaignData: { 
        name: string; 
        source: string; 
        description?: string;
        status: string;
        start_date?: string;
        end_date?: string;
        objective?: number;
        column_mappings: ColumnMapping[] 
    }) => Promise<void>;
}


const AddCampaignModal: React.FC<AddCampaignModalProps> = ({ isOpen, onClose, onSave }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [source, setSource] = useState('Facebook');
    const [status, setStatus] = useState('active');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [objective, setObjective] = useState<number>(0);
    const [mappings, setMappings] = useState<ColumnMapping[]>([
        { field: 'firstName', label: 'Prénom' },
        { field: 'lastName', label: 'Nom' },
        { field: 'email', label: 'Email' },
        { field: 'phone', label: 'Téléphone' },
    ]);
    const [loading, setLoading] = useState(false);


    if (!isOpen) return null;

    const handleNext = () => setStep(2);
    const handleBack = () => setStep(1);

    const handleSubmit = async () => {
        if (!name || mappings.length === 0) return;

        // Vérification : pas de labels en double
        const labels = mappings.map(m => m.label.trim().toLowerCase());
        const duplicates = labels.filter((l, i) => labels.indexOf(l) !== i);
        if (duplicates.length > 0) {
            alert(`Colonnes en double détectées : "${duplicates.join('", "')}". Chaque colonne doit avoir un nom unique.`);
            return;
        }

        // Vérification : pas de champs CRM en double (sauf custom)
        const fields = mappings.map(m => m.field).filter(f => f !== 'unnamed_field' && !f.startsWith('custom'));
        const dupFields = fields.filter((f, i) => fields.indexOf(f) !== i);
        if (dupFields.length > 0) {
            alert(`La même donnée CRM est mappée plusieurs fois. Vérifiez vos colonnes.`);
            return;
        }

        setLoading(true);
        try {
            await onSave({ 
                name, 
                source, 
                description,
                status,
                start_date: startDate ? new Date(startDate).toISOString() : undefined,
                end_date: endDate ? new Date(endDate).toISOString() : undefined,
                objective: objective || 0,
                column_mappings: mappings 
            });
            setName('');
            setDescription('');
            setSource('Facebook');
            setStatus('active');
            setStartDate(new Date().toISOString().split('T')[0]);
            setEndDate('');
            setObjective(0);
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




    return (
        <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'grid', placeItems: 'center', zIndex: 1100, backdropFilter: 'blur(10px)'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                            {step === 1 ? 'Nouvelle Campagne' : 'Configuration Immatriculation'}
                        </h2>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <div style={{ width: '20px', height: '4px', borderRadius: '2px', background: step === 1 ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }}></div>
                            <div style={{ width: '20px', height: '4px', borderRadius: '2px', background: step === 2 ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }}></div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                    {step === 1 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Nom de la Campagne *</label>
                                <input 
                                    type="text" 
                                    className="input-field" 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="ex: Campagne Sénégal Printemps 2024"
                                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Description</label>
                                <textarea 
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Description des filières ciblées ou notes de campagne..."
                                    style={{ width: '100%', minHeight: '80px', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white', resize: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Source Marketing</label>
                                    <select 
                                        value={source} 
                                        onChange={(e) => setSource(e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                                    >
                                        {['Facebook', 'TikTok', 'Instagram', 'Salon', 'Google', 'Autre'].map(s => <option key={s} value={s} style={{background: '#1a1b1e'}}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Statut Initial</label>
                                    <select 
                                        value={status} 
                                        onChange={(e) => setStatus(e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                                    >
                                        <option value="active" style={{background: '#1a1b1e'}}>Actif (En cours)</option>
                                        <option value="draft" style={{background: '#1a1b1e'}}>Brouillon</option>
                                        <option value="paused" style={{background: '#1a1b1e'}}>Suspendu</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Date de Début</label>
                                    <input 
                                        type="date" 
                                        value={startDate} 
                                        onChange={(e) => setStartDate(e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Date de Fin</label>
                                    <input 
                                        type="date" 
                                        value={endDate} 
                                        onChange={(e) => setEndDate(e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>Objectif (Nb prospects cibles)</label>
                                <input 
                                    type="number" 
                                    value={objective || ''} 
                                    onChange={(e) => setObjective(parseInt(e.target.value) || 0)}
                                    placeholder="ex: 150"
                                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', color: 'white' }}
                                />
                            </div>
                        </div>

                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '1rem', display: 'flex', gap: '12px' }}>
                                <Info size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                                    Pour chaque colonne de votre fichier Excel, indiquez à quelle donnée du CRM elle correspond et quel est son nom exacte dans l'entête du fichier.
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1fr) 50px', gap: '1rem', padding: '0 0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Donnée CRM</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Header Exact (Excel)</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Id Interne (CRM)</span>
                            </div>


                            {mappings.map((m, index) => (
                                <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1fr) 50px', gap: '1rem', alignItems: 'center' }}>
                                    <select 
                                        value={AVAILABLE_FIELDS.some(f => f.value === m.field) ? m.field : 'custom'} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'custom') {
                                                updateColumn(index, { field: 'unnamed_field' });
                                            } else {
                                                updateColumn(index, { field: val });
                                            }
                                        }}
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', padding: '0.6rem', borderRadius: '8px', fontSize: '0.875rem' }}
                                    >
                                        {AVAILABLE_FIELDS.map(f => <option key={f.value} value={f.value} style={{background: '#1a1b1e'}}>{f.label}</option>)}
                                    </select>
                                    <input 
                                        value={m.label} 
                                        onChange={(e) => updateColumn(index, { label: e.target.value })}
                                        placeholder="Titre dans l'Excel"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', padding: '0.6rem', borderRadius: '8px', fontSize: '0.875rem' }}
                                    />
                                    <div style={{ position: 'relative', visibility: AVAILABLE_FIELDS.some(f => f.value === m.field && f.value !== 'custom') ? 'hidden' : 'visible' }}>
                                        <input 
                                            value={AVAILABLE_FIELDS.some(f => f.value === m.field && f.value !== 'custom') ? '' : m.field}
                                            onChange={(e) => updateColumn(index, { field: e.target.value })}
                                            placeholder="Nom du champ"
                                            style={{ width: '100%', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', color: 'white', padding: '0.6rem', borderRadius: '8px', fontSize: '0.8125rem' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button onClick={() => removeColumn(index)} style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}


                            <button 
                                onClick={addColumn}
                                style={{ marginTop: '1rem', padding: '0.75rem', border: '1px dashed var(--border)', borderRadius: '10px', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.875rem' }}
                            >
                                <Plus size={16} /> Ajouter une colonne
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1rem' }}>
                    {step === 1 ? (
                        <>
                            <button onClick={onClose} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white' }}>Annuler</button>
                            <button onClick={handleNext} disabled={!name} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Suivant</button>
                        </>
                    ) : (
                        <>
                            <button onClick={handleBack} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white' }}>Retour</button>
                            <button onClick={handleSubmit} disabled={loading || mappings.length === 0} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                                {loading ? 'Création...' : 'Créer la Campagne'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddCampaignModal;
