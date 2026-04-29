import React from 'react';
import { Target, CheckCircle2, XCircle, Clock, Trash2, Mail, Users, AlertCircle, TrendingUp, Award, Sparkles, PhoneOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';

export type DispositionType = 
    | 'intéressé' | 'rappel' | 'reflexion' | 'rendez_vous_pris' | 'dossier_recu' 
    | 'admis' | 'inscription_attente' | 'inscrit' | 'reorientation'
    | 'pas_interesse' | 'refus_categorique' | 'inscrit_ailleurs' | 'pas_moyens' 
    | 'annee_prochaine' | 'pas_disponible' | 'hors_cible' | 'refus_repondre'
    | 'injoignable' | 'repondeur' | 'faux_numero' | 'whatsapp_indisponible'
    | 'nouveau';

interface OutcomeModalProps {
    isOpen: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lead: any;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdate: (leadId: string, updates: any) => void;
    profile: import('../types').Profile | null;
    statuses: import('../types').LeadStatus[];
}

const OutcomeModal: React.FC<OutcomeModalProps> = ({ isOpen, lead, onClose, onUpdate, profile, statuses }) => {
    const { addToast } = useToast();

    if (!isOpen || !lead) return null;

    const handleDisposition = async (disposition: DispositionType) => {
        let newStatusId = lead.statusId;
        let dispositionLabel = "";

        // Status Logic
        const isCurrentlyPositive = ['interesse', 'rappel', 'rdv_planifie', 'dossier_recu', 'admis', 'inscription_attente', 'inscrit'].includes(lead.statusId);
        
        switch(disposition) {
            case 'intéressé':
                newStatusId = 'interesse';
                dispositionLabel = "Intéressé";
                break;
            case 'rappel':
                newStatusId = 'rappel';
                dispositionLabel = "Rappel ou en cours";
                break;
            case 'reflexion':
                newStatusId = 'reflexion';
                dispositionLabel = "Réflexion et nous faire un retour";
                break;
            case 'rendez_vous_pris':
                newStatusId = 'rdv_planifie';
                dispositionLabel = "Rendez-vous planifié";
                break;
            case 'dossier_recu':
                newStatusId = 'dossier_recu';
                dispositionLabel = "Dossier reçu";
                break;
            case 'admis':
                newStatusId = 'admis';
                dispositionLabel = "Admis";
                break;
            case 'inscription_attente':
                newStatusId = 'inscription_attente';
                dispositionLabel = "Inscription en attente";
                break;
            case 'inscrit':
                newStatusId = 'inscrit';
                dispositionLabel = "Inscrit";
                break;
            case 'reorientation':
                newStatusId = 'reorientation';
                dispositionLabel = "Réorientation";
                break;
            case 'pas_interesse':
                newStatusId = 'pas_interesse';
                dispositionLabel = "Pas intéressé";
                break;
            case 'refus_categorique':
                newStatusId = 'refus_categorique';
                dispositionLabel = "Refus catégorique";
                break;
            case 'inscrit_ailleurs':
                newStatusId = 'inscrit_ailleurs';
                dispositionLabel = "Inscrit ailleurs";
                break;
            case 'pas_moyens':
                newStatusId = 'pas_moyens';
                dispositionLabel = "Pas les moyens";
                break;
            case 'annee_prochaine':
                newStatusId = 'annee_prochaine';
                dispositionLabel = "S'inscrire l'année prochaine";
                break;
            case 'pas_disponible':
                newStatusId = 'pas_disponible';
                dispositionLabel = "Pas disponible / contrainte de temps";
                break;
            case 'hors_cible':
                newStatusId = 'hors_cible';
                dispositionLabel = "Hors cible";
                break;
            case 'refus_repondre':
                newStatusId = 'refus_repondre';
                dispositionLabel = "Refus de répondre";
                break;
            case 'injoignable':
                newStatusId = isCurrentlyPositive ? lead.statusId : 'injoignable';
                dispositionLabel = "Injoignable/ Ne répond pas";
                break;
            case 'whatsapp_indisponible':
                newStatusId = isCurrentlyPositive ? lead.statusId : 'whatsapp_indisponible';
                dispositionLabel = "Numéro non disponible sur WhatsApp.";
                break;
            case 'repondeur':
                newStatusId = isCurrentlyPositive ? lead.statusId : 'repondeur';
                dispositionLabel = "Répondeur";
                break;
            case 'faux_numero':
                newStatusId = 'faux_numero';
                dispositionLabel = "Faux Numéro";
                break;
            case 'nouveau':
                newStatusId = 'nouveau';
                dispositionLabel = "Non Contacté";
                break;
        }

        const isFailedContact = ['injoignable', 'repondeur', 'faux_numero'].includes(disposition);
        const newMetadata = { 
            ...(lead.metadata || {}), 
            everReached: lead.metadata?.everReached || !isFailedContact 
        };

        try {
            const { error: updateError } = await supabase
                .from('leads')
                .update({ 
                    status_id: newStatusId,
                    metadata: newMetadata
                })
                .eq('id', lead.id);

            if (updateError) throw updateError;

            const isAdmin = profile?.role === 'super_admin' || profile?.role === 'super_agent';
            const isAdminChange = profile?.id !== lead.agentId && isAdmin;
            const adminSuffix = isAdminChange ? ` (par Admin: ${profile?.full_name})` : '';

            await supabase.from('lead_interactions').insert({
                lead_id: lead.id,
                agent_id: profile?.id || lead.agentId,
                type: 'note',
                content: `Qualif : ${dispositionLabel}` + adminSuffix
            });

            onUpdate(lead.id, { statusId: newStatusId, metadata: newMetadata });
            addToast(`"${dispositionLabel}" enregistré`, "success");
            onClose();
        } catch (error: unknown) {
            addToast((error as Error).message, "error");
        }
    };

    const sections = [
        {
            title: 'AVANCEMENT POSITIF',
            color: 'var(--success)',
            items: [
                { id: 'intéressé', label: 'Intéressé', icon: <Target size={16} /> },
                { id: 'rappel', label: 'Rappel ou en cours', icon: <Clock size={16} /> },
                { id: 'rendez_vous_pris', label: 'Rendez-vous planifié', icon: <CheckCircle2 size={16} /> },
                { id: 'reflexion', label: 'Réflexion et nous faire un retour', icon: <AlertCircle size={16} /> },
                { id: 'reorientation', label: 'Réorientation', icon: <Users size={16} /> },
                { id: 'dossier_recu', label: 'Dossier reçu', icon: <TrendingUp size={16} /> },
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
                { id: 'inscrit_ailleurs', label: 'Inscrit ailleurs', icon: <Users size={16} /> },
                { id: 'pas_moyens', label: 'Pas les moyens', icon: <TrendingUp size={16} /> },
                { id: 'annee_prochaine', label: 'S’inscrire l’année prochaine', icon: <Clock size={16} /> },
                { id: 'pas_disponible', label: 'Pas disponible / contrainte de temps', icon: <Clock size={16} /> },
                { id: 'hors_cible', label: 'Hors cible', icon: <AlertCircle size={16} /> },
                { id: 'refus_repondre', label: 'Refus de répondre', icon: <XCircle size={16} /> },
            ]
        },
        {
            title: 'ÉCHECS TECHNIQUES',
            color: 'var(--text-muted)',
            items: [
                { id: 'injoignable', label: 'Injoignable/ Ne répond pas', icon: <PhoneOff size={16} /> },
                { id: 'repondeur', label: 'Répondeur', icon: <Mail size={16} /> },
                { id: 'faux_numero', label: 'Faux Numéro', icon: <Trash2 size={16} /> },
                { id: 'whatsapp_indisponible', label: 'Numéro non disponible sur WhatsApp.', icon: <XCircle size={16} /> },
            ]
        },
        {
            title: 'ADMINISTRATION / RESET',
            color: 'var(--primary)',
            items: [
                { id: 'nouveau', label: 'Non Contacté', icon: <Users size={16} /> },
            ]
        }
    ].map(section => ({
        ...section,
        items: section.title === 'ADMINISTRATION / RESET' ? section.items : [...section.items].sort((a, b) => a.label.localeCompare(b.label))
    }));

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: '1rem' }} onClick={onClose}>
            <div className="card" style={{ width: '100%', maxWidth: '480px', maxHeight: '94vh', overflowY: 'auto', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '28px', padding: '2rem' }} onClick={e => e.stopPropagation()}>
                
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(99, 102, 241, 0.1)', display: 'grid', placeItems: 'center', margin: '0 auto 1.25rem' }}>
                        <Target size={32} color="var(--primary)" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '0.5rem' }}>Qualification Directe</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Échange avec {lead.firstName} {lead.lastName}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {sections.map((section) => (
                        <div key={section.title}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: section.color, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ height: '1px', flex: 1, background: `${section.color}22` }} />
                                {section.title}
                                <div style={{ height: '1px', flex: 1, background: `${section.color}22` }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                {section.items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleDisposition(item.id as DispositionType)}
                                        disabled={profile?.role === 'observer'}
                                        className="btn btn-ghost"
                                        style={{
                                            padding: '0.75rem',
                                            borderRadius: '14px',
                                            justifyContent: 'flex-start',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            border: '1px solid var(--border)',
                                            background: 'rgba(255,255,255,0.01)',
                                            transition: 'all 0.2s',
                                            height: 'auto',
                                            opacity: profile?.role === 'observer' ? 0.4 : 1,
                                            cursor: profile?.role === 'observer' ? 'not-allowed' : 'pointer',
                                            minHeight: '44px'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = section.color;
                                            e.currentTarget.style.background = `${section.color}08`;
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = 'var(--border)';
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                                        }}
                                    >
                                        <span style={{ color: section.color }}>{item.icon}</span>
                                        <span style={{ marginLeft: '4px' }}>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <button onClick={onClose} className="btn btn-ghost" style={{ width: '100%', marginTop: '2.5rem', borderRadius: '14px', fontWeight: 700 }}>
                    Annuler la qualification
                </button>
            </div>
        </div>
    );
};

export default OutcomeModal;
