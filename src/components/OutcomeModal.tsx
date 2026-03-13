import React from 'react';
import { Target, CheckCircle2, XCircle, Clock, Trash2, Mail, Users, AlertCircle, TrendingUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';

export type DispositionType = 
    | 'intéressé' | 'rappel_demande' | 'refus_temporaire' | 'refus_definitif' 
    | 'inscrit_ailleurs' | 'injoignable' | 'repondeur' | 'faux_numero' | 'hors_cible'
    | 'rendez_vous_pris' | 'infos_envoyees' | 'whatsapp_envoye' | 'visite_campus'
    | 'dossier_demande' | 'dossier_envoye' | 'dossier_recu' | 'frais_payes';

interface OutcomeModalProps {
    isOpen: boolean;
    lead: any;
    onClose: () => void;
    onUpdate: (leadId: string, updates: any) => void;
}

const OutcomeModal: React.FC<OutcomeModalProps> = ({ isOpen, lead, onClose, onUpdate }) => {
    const { addToast } = useToast();

    if (!isOpen || !lead) return null;

    const handleDisposition = async (disposition: DispositionType) => {
        let newStatusId = lead.statusId;
        let scoreIncrement = 0;
        let dispositionLabel = "";

        // Scoring & Status Logic (Intelligent Transitions)
        const isCurrentlyPositive = ['interesse', 'rdv_planifie', 'infos_envoyees', 'whatsapp_envoye', 'visite_campus', 'dossier_demande', 'dossier_recu', 'frais_payes', 'admis', 'inscrit'].includes(lead.statusId);
        
        switch(disposition) {
            case 'intéressé':
                newStatusId = 'interesse';
                scoreIncrement = 10;
                dispositionLabel = "Intéressé";
                break;
            case 'rendez_vous_pris':
                newStatusId = 'rdv_planifie';
                scoreIncrement = 40;
                dispositionLabel = "Rendez-vous planifié";
                break;
            case 'rappel_demande':
                newStatusId = 'rappel_demande';
                scoreIncrement = 5;
                dispositionLabel = "Rappel demandé";
                break;
            case 'infos_envoyees':
                newStatusId = 'infos_envoyees';
                scoreIncrement = 20;
                dispositionLabel = "Informations envoyées";
                break;
            case 'whatsapp_envoye':
                newStatusId = 'whatsapp_envoye';
                scoreIncrement = 15;
                dispositionLabel = "WhatsApp envoyé";
                break;
            case 'visite_campus':
                newStatusId = 'visite_campus';
                scoreIncrement = 45;
                dispositionLabel = "Visite campus prévue";
                break;
            case 'dossier_demande':
                newStatusId = 'dossier_demande';
                scoreIncrement = 50;
                dispositionLabel = "Dossier demandé";
                break;
            case 'dossier_recu':
                newStatusId = 'dossier_recu';
                scoreIncrement = 100;
                dispositionLabel = "Dossier reçu (complet)";
                break;
            case 'frais_payes':
                newStatusId = 'frais_payes';
                scoreIncrement = 150;
                dispositionLabel = "Frais de dossier payés";
                break;
            case 'refus_definitif':
                newStatusId = 'refus_definitif';
                dispositionLabel = "Refus définitif";
                break;
            case 'inscrit_ailleurs':
                newStatusId = 'inscrit_ailleurs';
                dispositionLabel = "Inscrit ailleurs";
                break;
            case 'hors_cible':
                newStatusId = 'hors_cible';
                dispositionLabel = "Hors cible";
                break;
            case 'injoignable':
                // REGLE CRUCIALE : Si on a déjà parlé au prospect (statut positif), 
                // on ne le remet pas en "Injoignable" s'il ne répond pas à un rappel.
                newStatusId = isCurrentlyPositive ? lead.statusId : 'injoignable';
                dispositionLabel = "Injoignable";
                break;
            case 'repondeur':
                newStatusId = isCurrentlyPositive ? lead.statusId : 'injoignable';
                dispositionLabel = "Répondeur";
                break;
            case 'faux_numero':
                newStatusId = 'faux_numero';
                dispositionLabel = "Faux numéro";
                break;
        }

        const isFailedContact = ['injoignable', 'repondeur', 'faux_numero'].includes(disposition);
        const newScore = (lead.score || 0) + scoreIncrement;
        const newMetadata = { 
            ...(lead.metadata || {}), 
            everReached: lead.metadata?.everReached || !isFailedContact 
        };

        try {
            const { error: updateError } = await supabase
                .from('leads')
                .update({ 
                    status_id: newStatusId,
                    score: newScore,
                    metadata: newMetadata
                })
                .eq('id', lead.id);

            if (updateError) throw updateError;

            await supabase.from('lead_interactions').insert({
                lead_id: lead.id,
                agent_id: lead.agentId,
                type: 'note',
                content: `Résultat de l'appel : ${dispositionLabel}. Score +${scoreIncrement}`
            });

            onUpdate(lead.id, { statusId: newStatusId, score: newScore, metadata: newMetadata });
            addToast(`Disposition "${dispositionLabel}" enregistrée (+${scoreIncrement} pts)`, "success");
            onClose();
        } catch (error: any) {
            addToast(error.message, "error");
        }
    };

    const sections = [
        {
            title: 'POSITIF',
            color: 'var(--success)',
            items: [
                { id: 'intéressé', label: 'Intéressé', icon: <Target size={16} /> },
                { id: 'rendez_vous_pris', label: 'Rendez-vous', icon: <CheckCircle2 size={16} /> },
                { id: 'infos_envoyees', label: 'Infos envoyées', icon: <Mail size={16} /> },
                { id: 'whatsapp_envoye', label: 'WhatsApp envoyé', icon: <Mail size={16} /> },
                { id: 'visite_campus', label: 'Visite campus', icon: <Users size={16} /> },
                { id: 'dossier_demande', label: 'Dossier demandé', icon: <TrendingUp size={16} /> },
                { id: 'dossier_recu', label: 'Dossier reçu', icon: <CheckCircle2 size={16} /> },
                { id: 'frais_payes', label: 'Frais payés', icon: <CheckCircle2 size={16} /> },
            ]
        },
        {
            title: 'NÉGATIF',
            color: 'var(--danger)',
            items: [
                { id: 'refus_definitif', label: 'Refus définitif', icon: <XCircle size={16} /> },
                { id: 'inscrit_ailleurs', label: 'Inscrit ailleurs', icon: <Users size={16} /> },
                { id: 'hors_cible', label: 'Hors cible', icon: <AlertCircle size={16} /> },
            ]
        },
        {
            title: 'TECHNIQUE',
            color: 'var(--text-muted)',
            items: [
                { id: 'injoignable', label: 'Injoignable', icon: <Clock size={16} /> },
                { id: 'repondeur', label: 'Répondeur', icon: <Mail size={16} /> },
                { id: 'faux_numero', label: 'Faux numéro', icon: <Trash2 size={16} /> },
            ]
        }
    ];

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', zIndex: 1100, padding: '2rem'
        }} onClick={onClose}>
            <div className="card glassmorphism" style={{ width: '100%', maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Qualifier l'appel</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Quel est le résultat de votre échange avec {lead.firstName} ?</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {sections.map((section) => (
                        <div key={section.title}>
                            <div style={{ 
                                fontSize: '0.7rem', 
                                fontWeight: 800, 
                                color: section.color, 
                                letterSpacing: '0.1em', 
                                marginBottom: '0.75rem',
                                borderBottom: `1px solid ${section.color}22`,
                                paddingBottom: '4px'
                            }}>
                                {section.title}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                {section.items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleDisposition(item.id as DispositionType)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '0.75rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            color: 'white',
                                            fontSize: '0.8125rem',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseOver={e => {
                                            e.currentTarget.style.background = `${section.color}11`;
                                            e.currentTarget.style.borderColor = section.color;
                                        }}
                                        onMouseOut={e => {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                            e.currentTarget.style.borderColor = 'var(--border)';
                                        }}
                                    >
                                        <div style={{ color: section.color }}>{item.icon}</div>
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <button 
                    onClick={onClose}
                    className="btn" 
                    style={{ width: '100%', marginTop: '2rem', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                >
                    Passer cette étape
                </button>
            </div>
        </div>
    );
};

export default OutcomeModal;
