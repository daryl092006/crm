import React, { useState } from 'react';
import { Send, Calendar, Filter } from 'lucide-react';
import type { StudentLead, Agent, Template, Sequence } from '../types';
import { useToast } from './Toast';
import { usePopup } from './Popup';
import SequenceBuilder from './SequenceBuilder';
import { supabase } from '../supabaseClient';


interface MessagingProps {
    profile: import('../types').Profile | null;
    leads: StudentLead[];
    setLeads: React.Dispatch<React.SetStateAction<StudentLead[]>>;
    agents: Agent[];
    templates: Template[];
    sequences: Sequence[];
}

const Messaging: React.FC<MessagingProps> = ({ profile, leads, setLeads, templates, sequences }) => {

    const { addToast } = useToast();
    const { showPrompt } = usePopup();
    const [activeTab, setActiveTab] = useState<'send' | 'scheduled'>('send');
    const [message, setMessage] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);



    const handleSend = async () => {
        if (!message) return;

        try {
            const { data: { session: activeSession } } = await supabase.auth.getSession();
            const currentUserId = activeSession?.user?.id || profile?.id;

            if (!currentUserId) {
                addToast("Impossible d'identifier l'expéditeur.", "error");
                return;
            }

            // In a real scenarios, you would filter leads by criteria. 
            // Here we'll simulate sending to all leads currently loaded as an example.
            const newInteractions = leads.map(lead => ({
                lead_id: lead.id,
                agent_id: currentUserId,
                type: 'whatsapp',
                content: message.replace('{{firstName}}', lead.firstName),
                created_at: new Date().toISOString()
            }));

            const { error } = await supabase
                .from('lead_interactions')
                .insert(newInteractions);

            if (error) throw error;

            // Update local state by adding the interactions to each lead
            setLeads(prev => prev.map(lead => ({
                ...lead,
                interactions: [
                    {
                        id: `new-${Date.now()}`,
                        leadId: lead.id,
                        agentId: currentUserId,
                        type: 'whatsapp',
                        content: message.replace('{{firstName}}', lead.firstName),
                        createdAt: new Date().toISOString()
                    },
                    ...(lead.interactions || [])
                ]
            })));

            setMessage('');
            addToast('Messages envoyés et enregistrés en base de données !', 'success');
        } catch (error: unknown) {
            addToast((error as Error).message || "Erreur lors de l'envoi", "error");
        }
    };


    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Centre de Messagerie</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Gestion des templates et programmation des relances.</p>
                </div>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <button
                        onClick={() => setActiveTab('send')}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: activeTab === 'send' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'send' ? 'white' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        Envoi & Templates
                    </button>
                    <button
                        onClick={() => setActiveTab('scheduled')}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: activeTab === 'scheduled' ? 'var(--primary)' : 'transparent',
                            color: activeTab === 'scheduled' ? 'white' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        Relances Programmées
                    </button>
                </div>
            </div>

            {activeTab === 'send' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                    <div className="card">
                        <h3 style={{ fontSize: '1.125rem', marginBottom: '1.25rem' }}>Templates</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {templates.map(t => (
                                <div key={t.id}
                                    onClick={() => {
                                        setSelectedTemplate(t.id);
                                        setMessage(t.content);
                                    }}
                                    style={{
                                        padding: '1rem',
                                        borderRadius: '10px',
                                        border: selectedTemplate === t.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        cursor: 'pointer',
                                        background: 'rgba(255,255,255,0.01)'
                                    }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{t.category}</div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{t.title}</div>
                                </div>
                            ))}
                            <button
                                onClick={async () => {
                                    const title = await showPrompt("Nouveau Template", "Entrez le titre du nouveau template :");
                                    if (!title) return;
                                    const content = await showPrompt("Contenu du Template", "Entrez le message :");
                                    if (!content) return;

                                    const { error } = await supabase.from('messaging_templates').insert({
                                        title,
                                        content,
                                        category: 'Général',
                                        organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
                                    });

                                    if (error) addToast("Erreur lors de la création : " + (error as Error).message, "error");
                                    else addToast(`Template "${title}" enregistré avec succès.`, "success");
                                }}
                                className="btn" style={{ border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                + Nouveau Template
                            </button>
                        </div>
                    </div>

                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.125rem' }}>Composer un message</h3>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <select style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}>
                                <option>Choisir un groupe cible (ex: Prospects Nouveau)</option>
                                <option>Tous les prospects TikTok</option>
                                <option>Filière Informatique</option>
                            </select>
                            <button className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}>
                                <Filter size={18} /> Filtres
                            </button>
                        </div>

                        <textarea
                            placeholder="Écrivez votre message ici... Utilisez {{firstName}} pour personnaliser."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            style={{
                                flex: 1,
                                minHeight: '200px',
                                padding: '1rem',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.01)',
                                border: '1px solid var(--border)',
                                color: 'white',
                                fontFamily: 'inherit',
                                resize: 'none',
                                outline: 'none'
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn" style={{ background: 'rgba(37, 211, 102, 0.1)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.2)' }}>
                                    WhatsApp
                                </button>
                                <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                    Email
                                </button>
                            </div>
                            <button className="btn btn-primary" onClick={handleSend} style={{ padding: '0.75rem 2rem' }}>
                                <Send size={18} /> Envoyer Maintenant
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.125rem' }}>Séquences de Relances Automatisées</h3>
                        <button
                            onClick={async () => {
                                const name = await showPrompt("Nouvelle Séquence", "Entrez le nom de la séquence :");
                                if (!name) return;

                                const { error } = await supabase.from('sequences').insert({
                                    name,
                                    is_active: true,
                                    organization_id: profile?.organization_id || '00000000-0000-0000-0000-000000000000'
                                });

                                if (error) addToast("Erreur lors de la création : " + (error as Error).message, "error");
                                else addToast(`Séquence "${name}" activée.`, "success");
                            }}
                            className="btn btn-primary">+ Créer une Séquence</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {sequences.map((seq) => (
                            <div key={seq.id} style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ padding: '0.75rem', background: seq.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                                        <Calendar size={20} color={seq.isActive ? 'var(--success)' : 'var(--text-muted)'} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{seq.name}</h4>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{seq.stepsCount || 0} étapes • {seq.activeLeadsCount || 0} prospects actifs</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: seq.isActive ? 'var(--success)' : 'var(--text-muted)' }}></div>
                                        <span style={{ fontSize: '0.8125rem', color: seq.isActive ? 'var(--success)' : 'var(--text-muted)' }}>{seq.isActive ? 'Active' : 'Pause'}</span>
                                    </div>
                                    <button
                                        onClick={() => setEditingSequence(seq)}
                                        className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}>Éditer</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <SequenceBuilder
                sequence={editingSequence}
                onClose={() => setEditingSequence(null)}
            />
        </div>
    );
};

export default Messaging;
