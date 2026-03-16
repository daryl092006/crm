import React from 'react';
import { Target, CheckCircle2, XCircle, Clock, Trash2, Mail, Users, AlertCircle, TrendingUp, Award, Sparkles, PhoneOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';

export type DispositionType = 
    | 'intéressé' | 'rappel' | 'reflexion' | 'rendez_vous_pris' | 'dossier_recu' 
    | 'admis' | 'inscription_attente' | 'inscrit' | 'reorientation'
    | 'pas_interesse' | 'refus_categorique' | 'inscrit_ailleurs' | 'pas_moyens' 
    | 'annee_prochaine' | 'pas_disponible' | 'hors_cible' | 'refus_repondre'
    | 'injoignable' | 'repondeur' | 'faux_numero';

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

        // Scoring & Status Logic
        const isCurrentlyPositive = ['interesse', 'rappel', 'rdv_planifie', 'dossier_recu', 'admis', 'inscription_attente', 'inscrit'].includes(lead.statusId);
        
        switch(disposition) {
            case 'intéressé':
                newStatusId = 'interesse';
                scoreIncrement = 20;
                dispositionLabel = "Intéressé";
                break;
            case 'rappel':
                newStatusId = 'rappel';
                scoreIncrement = 5;
                dispositionLabel = "Rappel ou en cours";
                break;
            case 'reflexion':
                newStatusId = 'reflexion';
                scoreIncrement = 10;
                dispositionLabel = "Réflexion et nous faire un retour";
                break;
            case 'rendez_vous_pris':
                newStatusId = 'rdv_planifie';
                scoreIncrement = 50;
                dispositionLabel = "Rendez-vous planifié";
                break;
            case 'dossier_recu':
                newStatusId = 'dossier_recu';
                scoreIncrement = 80;
                dispositionLabel = "Dossiers reçus";
                break;
            case 'admis':
                newStatusId = 'admis';
                scoreIncrement = 120;
                dispositionLabel = "Admis";
                break;
            case 'inscription_attente':
                newStatusId = 'inscription_attente';
                scoreIncrement = 150;
                dispositionLabel = "Inscription en attente";
                break;
            case 'inscrit':
                newStatusId = 'inscrit';
                scoreIncrement = 250;
                dispositionLabel = "Inscrit";
                break;
            case 'reorientation':
                newStatusId = 'reorientation';
                scoreIncrement = 15;
                dispositionLabel = "Réorientation";
                break;
            case 'pas_interesse':
                newStatusId = 'pas_interesse';
                scoreIncrement = -10;
                dispositionLabel = "Pas intéressé";
                break;
            case 'refus_categorique':
                newStatusId = 'refus_categorique';
                scoreIncrement = -50;
                dispositionLabel = "Refus catégorique";
                break;
            case 'inscrit_ailleurs':
                newStatusId = 'inscrit_ailleurs';
                scoreIncrement = -30;
                dispositionLabel = "Déjà inscrit ailleurs";
                break;
            case 'pas_moyens':
                newStatusId = 'pas_moyens';
                scoreIncrement = -20;
                dispositionLabel = "Pas les moyens";
                break;
            case 'annee_prochaine':
                newStatusId = 'annee_prochaine';
                scoreIncrement = 5;
                dispositionLabel = "S’inscrire l’année prochaine";
                break;
            case 'pas_disponible':
                newStatusId = 'pas_disponible';
                scoreIncrement = -5;
                dispositionLabel = "Pas disponible / contrainte de temps";
                break;
            case 'hors_cible':
                newStatusId = 'hors_cible';
                scoreIncrement = -100;
                dispositionLabel = "Hors-cible";
                break;
            case 'refus_repondre':
                newStatusId = 'refus_repondre';
                scoreIncrement = -40;
                dispositionLabel = "Refus de répondre";
                break;
            case 'injoignable':
                newStatusId = isCurrentlyPositive ? lead.statusId : 'injoignable';
                dispositionLabel = "Injoignable / ne répond pas";
                break;
            case 'repondeur':
                newStatusId = isCurrentlyPositive ? lead.statusId : 'repondeur';
                dispositionLabel = "Répondeur";
                break;
            case 'faux_numero':
                newStatusId = 'faux_numero';
                scoreIncrement = -200;
                dispositionLabel = "Numéro incorrect / faux numéro";
                break;
        }

        const isFailedContact = ['injoignable', 'repondeur', 'faux_numero'].includes(disposition);
        const newScore = Math.max(0, (lead.score || 0) + scoreIncrement);
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
                content: `Qualif : ${dispositionLabel} (Score ${scoreIncrement > 0 ? '+' : ''}${scoreIncrement})`
            });

            onUpdate(lead.id, { statusId: newStatusId, score: newScore, metadata: newMetadata });
            addToast(`"${dispositionLabel}" enregistré`, "success");
            onClose();
        } catch (error: any) {
            addToast(error.message, "error");
        }
    };

    const sections = [
        {
            title: 'AVANCEMENT POSITIF',
            color: 'var(--success)',
            items: [
                { id: 'intéressé', label: 'Intéressé', icon: <Target size={16} /> },
                { id: 'rappel', label: 'Rappel ou en cours', icon: <Clock size={16} /> },
                { id: 'rendez_vous_pris', label: 'Rendez-vous planifié.', icon: <CheckCircle2 size={16} /> },
                { id: 'reflexion', label: 'Réflexion et nous faire un retour', icon: <AlertCircle size={16} /> },
                { id: 'reorientation', label: 'Réorientation', icon: <Users size={16} /> },
                { id: 'dossier_recu', label: 'Dossiers reçus', icon: <TrendingUp size={16} /> },
                { id: 'admis', label: 'Admis', icon: <Award size={16} /> },
                { id: 'inscription_attente', label: 'Inscription en attente', icon: <Clock size={16} /> },
                { id: 'inscrit', label: 'Inscrit', icon: <Sparkles size={16} /> },
            ]
        },
        {
            title: 'RÉSULTATS NÉGATIFS',
            color: 'var(--danger)',
            items: [
                { id: 'pas_interesse', label: 'Pas intéressé', icon: <XCircle size={16} /> },
                { id: 'refus_categorique', label: 'Refus catégorique', icon: <XCircle size={16} /> },
                { id: 'inscrit_ailleurs', label: 'Déjà inscrit ailleurs', icon: <Users size={16} /> },
                { id: 'pas_moyens', label: 'Pas les moyens', icon: <TrendingUp size={16} /> },
                { id: 'annee_prochaine', label: 'S’inscrire l’année prochaine', icon: <Clock size={16} /> },
                { id: 'pas_disponible', label: 'Pas disponible / contrainte de temps', icon: <Clock size={16} /> },
                { id: 'hors_cible', label: 'Hors-cible', icon: <AlertCircle size={16} /> },
                { id: 'refus_repondre', label: 'Refus de répondre', icon: <XCircle size={16} /> },
            ]
        },
        {
            title: 'ÉCHECS TECHNIQUES',
            color: 'var(--text-muted)',
            items: [
                { id: 'injoignable', label: 'Injoignable / ne répond pas', icon: <PhoneOff size={16} /> },
                { id: 'repondeur', label: 'Répondeur', icon: <Mail size={16} /> },
                { id: 'faux_numero', label: 'Numéro incorrect / faux numéro', icon: <Trash2 size={16} /> },
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
