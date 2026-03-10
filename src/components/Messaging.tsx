import React, { useState } from 'react';
import { Send, Calendar, Filter } from 'lucide-react';
import type { StudentLead, Agent, Interaction } from '../types';
import { useToast } from './Toast';

interface MessagingProps {
    setLeads: React.Dispatch<React.SetStateAction<StudentLead[]>>;
    agents: Agent[];
}

const Messaging: React.FC<MessagingProps> = ({ setLeads, agents }) => {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'send' | 'scheduled'>('send');
    const [message, setMessage] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

    const templates = [
        { id: 1, title: 'Accueil Nouveau Prospect', category: 'WhatsApp', content: 'Bonjour {{firstName}}, bienvenue chez EliteCRM !' },
        { id: 2, title: 'Rappel Dossier Incomplet', category: 'Email', content: 'Cher(e) {{firstName}}, votre dossier est incomplet.' },
        { id: 3, title: 'Invitation Webinaire Filières', category: 'WhatsApp', content: 'Venez découvrir nos filières, {{firstName}} !' },
        { id: 4, title: 'Deadline Inscription', category: 'SMS', content: 'C\'est presque fini {{firstName}} !' },
    ];

    const handleSend = () => {
        if (!message) return;

        setLeads(prev => prev.map(lead => {
            const newInteraction: Interaction = {
                id: `int-${Date.now()}`,
                type: 'WhatsApp',
                content: message.replace('{{firstName}}', lead.firstName),
                date: new Date().toISOString(),
                agentName: agents[0]?.name || 'System'
            };
            return {
                ...lead,
                interactions: [newInteraction, ...lead.interactions]
            };
        }));

        setMessage('');
        addToast('Messages envoyés aux prospects ciblés !', 'success');
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
                                onClick={() => {
                                    const title = prompt("Titre du nouveau template :");
                                    if (title) addToast(`Template "${title}" enregistré avec succès.`, "success");
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
                            onClick={() => addToast("Séquence de relance automatique activée.", "success")}
                            className="btn btn-primary">+ Créer une Séquence</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                            { title: 'Séquence Bienvenue TikTok', steps: '3 étapes', active: true, leads: 145 },
                            { title: 'Relance Salon Paris', steps: '2 étapes', active: true, leads: 32 },
                            { title: 'Inscriptions Master Finance', steps: '4 étapes', active: false, leads: 0 },
                        ].map((seq, i) => (
                            <div key={i} style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ padding: '0.75rem', background: seq.active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                                        <Calendar size={20} color={seq.active ? 'var(--success)' : 'var(--text-muted)'} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{seq.title}</h4>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{seq.steps} • {seq.leads} prospects actifs</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: seq.active ? 'var(--success)' : 'var(--text-muted)' }}></div>
                                        <span style={{ fontSize: '0.8125rem', color: seq.active ? 'var(--success)' : 'var(--text-muted)' }}>{seq.active ? 'Active' : 'Pause'}</span>
                                    </div>
                                    <button
                                        onClick={() => addToast(`Édition de : ${seq.title}`, "info")}
                                        className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}>Éditer</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Messaging;
