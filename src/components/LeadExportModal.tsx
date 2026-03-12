
import React, { useState } from 'react';
import { X, CheckSquare, Square, Download } from 'lucide-react';

interface Column {
    id: string;
    label: string;
}

const AVAILABLE_COLUMNS: Column[] = [
    { id: 'firstName', label: 'Prénom' },
    { id: 'lastName', label: 'Nom' },
    { id: 'email', label: 'Email' },
    { id: 'phone', label: 'Téléphone' },
    { id: 'country', label: 'Pays' },
    { id: 'city', label: 'Ville' },
    { id: 'fieldOfInterest', label: 'Filière' },
    { id: 'level', label: 'Niveau' },
    { id: 'statusId', label: 'Statut' },
    { id: 'notes', label: 'Notes' },
    { id: 'score', label: 'Score' },
    { id: 'createdAt', label: 'Date Ajout' },
];


interface LeadExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (selectedColumns: string[]) => void;
}

const LeadExportModal: React.FC<LeadExportModalProps> = ({ isOpen, onClose, onExport }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>(AVAILABLE_COLUMNS.map(c => c.id));

    if (!isOpen) return null;

    const toggleColumn = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (select: boolean) => {
        if (select) {
            setSelectedIds(AVAILABLE_COLUMNS.map(c => c.id));
        } else {
            setSelectedIds([]);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', position: 'relative', padding: '2rem' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    <X size={20} />
                </button>

                <div style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Exporter les Prospects</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Choisissez les colonnes que vous souhaitez inclure dans votre fichier Excel.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button 
                        onClick={() => handleSelectAll(true)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <CheckSquare size={16} /> Tout cocher
                    </button>
                    <button 
                        onClick={() => handleSelectAll(false)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <Square size={16} /> Tout décocher
                    </button>
                </div>

                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '1rem', 
                    marginBottom: '2rem',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    padding: '0.5rem'
                }}>
                    {AVAILABLE_COLUMNS.map(col => (
                        <div 
                            key={col.id}
                            onClick={() => toggleColumn(col.id)}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem', 
                                padding: '0.75rem',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                border: `1px solid ${selectedIds.includes(col.id) ? 'var(--primary)' : 'transparent'}`,
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {selectedIds.includes(col.id) ? (
                                <CheckSquare size={18} color="var(--primary)" />
                            ) : (
                                <Square size={18} color="var(--text-muted)" />
                            )}
                            <span style={{ fontSize: '0.9rem', color: selectedIds.includes(col.id) ? 'white' : 'var(--text-muted)' }}>
                                {col.label}
                            </span>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                        onClick={onClose}
                        className="btn" 
                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white' }}
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={() => onExport(selectedIds)}
                        disabled={selectedIds.length === 0}
                        className="btn btn-primary" 
                        style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        <Download size={18} /> Exporter (.xlsx)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LeadExportModal;
