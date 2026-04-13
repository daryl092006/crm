import React, { useState } from 'react';
import { X, Plus, Trash2, Clock, MessageSquare, Mail, Smartphone } from 'lucide-react';
import type { Sequence } from '../types';
import { supabase } from '../supabaseClient';

interface Step {
    id: string;
    type: 'whatsapp' | 'email' | 'sms';
    delay: string;
    content: string;
}

interface SequenceBuilderProps {
    sequence: Sequence | null;
    onClose: () => void;
}

const SequenceBuilder: React.FC<SequenceBuilderProps> = ({ sequence, onClose }) => {
    const [steps, setSteps] = useState<Step[]>([]);

    React.useEffect(() => {
        if (sequence) {
            supabase.from('sequence_steps')
                .select('*, messaging_templates(*)')
                .eq('sequence_id', sequence.id)
                .order('sort_order')
                .then(({ data }) => {
                    if (data) {
                        setSteps(data.map(s => ({
                            id: s.id,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            type: (s.messaging_templates?.category || 'whatsapp') as any,
                            delay: `${s.delay_days} jours`,
                            content: s.messaging_templates?.content || ''
                        })));
                    }
                });
        }
    }, [sequence]);

    if (!sequence) return null;

    const addStep = () => {
        const newStep: Step = {
            id: Date.now().toString(),
            type: 'whatsapp',
            delay: '2 jours',
            content: 'Nouveau message de relance'
        };
        setSteps([...steps, newStep]);
    };

    const removeStep = (id: string) => {
        setSteps(steps.filter(s => s.id !== id));
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: '2rem'
        }} onClick={onClose}>
            <div className="card" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Éditeur de Séquence</h2>
                        <p style={{ color: 'var(--text-muted)' }}>{sequence.name}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                    {steps.map((step: Step, index: number) => (
                        <div key={step.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <div style={{ position: 'absolute', left: '-12px', top: '24px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                {index + 1}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: '1rem' }}>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem', textTransform: 'capitalize' }}>
                                        {step.type === 'whatsapp' ? <MessageSquare size={16} /> : step.type === 'email' ? <Mail size={16} /> : <Smartphone size={16} />}
                                        {step.type}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        <Clock size={16} /> {step.delay}
                                    </div>
                                </div>
                                <button onClick={() => removeStep(step.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <textarea
                                value={step.content}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                    const newSteps = [...steps];
                                    newSteps[index].content = e.target.value;
                                    setSteps(newSteps);
                                }}
                                style={{
                                    width: '100%',
                                    minHeight: '80px',
                                    padding: '0.75rem',
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    resize: 'none',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    ))}

                    <button
                        onClick={addStep}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '1rem',
                            background: 'transparent',
                            border: '2px dashed var(--border)',
                            borderRadius: '16px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseOut={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                        <Plus size={20} /> Ajouter une étape de relance
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button className="btn" onClick={onClose} style={{ background: 'transparent', color: 'white' }}>Annuler</button>
                    <button className="btn btn-primary" onClick={onClose}>Enregistrer la Séquence</button>
                </div>
            </div>
        </div>
    );
};

export default SequenceBuilder;
