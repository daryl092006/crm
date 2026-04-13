import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, Target, MessageSquare, LayoutDashboard, Settings } from 'lucide-react';

interface TourStep {
    targetId: string;
    title: string;
    content: string;
    icon: React.ReactNode;
    position: 'right' | 'left' | 'top' | 'bottom';
}

const OnboardingTour: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [spotlightStyles, setSpotlightStyles] = useState<React.CSSProperties>({});

    const steps: TourStep[] = [
        {
            targetId: '', // Neutral start
            title: "Bienvenue sur Élite CRM",
            content: "Laissez-moi vous montrer comment transformer vos prospects en étudiants inscrits en quelques clics.",
            icon: <Sparkles size={24} color="var(--primary)" />,
            position: 'bottom'
        },
        {
            targetId: 'tour-dashboard',
            title: "Tableau de Bord",
            content: "C'est ici que vous suivez vos performances globales et l'activité récente de votre équipe.",
            icon: <LayoutDashboard size={24} color="var(--primary)" />,
            position: 'right'
        },
        {
            targetId: 'tour-campaigns',
            title: "Gestion des Campagnes",
            content: "Ici, vous importez vos leads (Excel/CSV) et gérez vos sources de trafic (TikTok, FB, Salons).",
            icon: <Target size={24} color="var(--primary)" />,
            position: 'right'
        },
        {
            targetId: 'tour-messaging',
            title: "Centre de Messagerie",
            content: "Automatisez vos relances WhatsApp et envoyez des messages personnalisés à vos groupes de prospects.",
            icon: <MessageSquare size={24} color="var(--primary)" />,
            position: 'right'
        },
        {
            targetId: 'tour-settings',
            title: "Configuration du Workspace",
            content: "Personnalisez votre CRM, gérez vos conseillers et connectez vos outils externes.",
            icon: <Settings size={24} color="var(--primary)" />,
            position: 'right'
        }
    ];

    useEffect(() => {
        const hasSeenTour = localStorage.getItem('elite_crm_tour_seen');
        if (!hasSeenTour) {
            setTimeout(() => setIsVisible(true), 1500);
        }
    }, []);

    useEffect(() => {
        if (!isVisible || currentStepIndex === 0) {
            setSpotlightStyles({ opacity: 0, pointerEvents: 'none' });
            return;
        }

        const step = steps[currentStepIndex];
        const element = document.getElementById(step.targetId);

        if (element) {
            const rect = element.getBoundingClientRect();
            setSpotlightStyles({
                top: rect.top - 8,
                left: rect.left - 8,
                width: rect.width + 16,
                height: rect.height + 16,
                opacity: 1,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 15px var(--primary-glow)',
                borderRadius: '12px'
            });

            // Auto-scroll to element if needed
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStepIndex, isVisible]);

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
        } else {
            completeTour();
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(currentStepIndex - 1);
        }
    };

    const completeTour = () => {
        setIsVisible(false);
        localStorage.setItem('elite_crm_tour_seen', 'true');
    };

    if (!isVisible) return null;

    const currentStep = steps[currentStepIndex];

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
            {/* Backdrop Spotlight */}
            <div style={{
                position: 'absolute',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '2px solid var(--primary)',
                ...spotlightStyles
            }} />

            {/* Tooltip */}
            <div style={{
                position: 'absolute',
                pointerEvents: 'auto',
                top: currentStep.targetId ? (document.getElementById(currentStep.targetId)?.getBoundingClientRect().top || 50) : '50%',
                left: currentStep.targetId ? (document.getElementById(currentStep.targetId)?.getBoundingClientRect().right || 0) + 40 : '50%',
                transform: currentStep.targetId ? 'translateY(-50%)' : 'translate(-50%, -50%)',
                width: '320px',
                background: 'rgba(23, 23, 35, 0.9)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--border)',
                borderRadius: '20px',
                padding: '1.5rem',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
                <button
                    onClick={completeTour}
                    style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    <X size={18} />
                </button>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'rgba(99, 102, 241, 0.1)',
                        display: 'grid',
                        placeItems: 'center'
                    }}>
                        {currentStep.icon}
                    </div>
                    <div>
                        <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'white', marginBottom: '0.25rem' }}>{currentStep.title}</h4>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Étape {currentStepIndex + 1} sur {steps.length}</div>
                    </div>
                </div>

                <p style={{ fontSize: '0.925rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                    {currentStep.content}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                        onClick={handlePrev}
                        disabled={currentStepIndex === 0}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: currentStepIndex === 0 ? 'transparent' : 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.875rem'
                        }}
                    >
                        <ChevronLeft size={16} /> Précédent
                    </button>

                    <button
                        onClick={handleNext}
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
                    >
                        {currentStepIndex === steps.length - 1 ? "C'est parti !" : "Suivant"} <ChevronRight size={16} />
                    </button>
                </div>

                {/* Arrow Pointer */}
                {currentStep.targetId && (
                    <div style={{
                        position: 'absolute',
                        left: '-8px',
                        top: '50%',
                        transform: 'translateY(-50%) rotate(45deg)',
                        width: '16px',
                        height: '16px',
                        background: 'rgba(23, 23, 35, 0.9)',
                        borderLeft: '1px solid var(--border)',
                        borderBottom: '1px solid var(--border)'
                    }} />
                )}
            </div>
        </div>
    );
};

export default OnboardingTour;
