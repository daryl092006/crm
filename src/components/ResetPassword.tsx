import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { Lock, CheckCircle2, Loader2 } from 'lucide-react';

interface ResetPasswordProps {
    onComplete: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onComplete }) => {
    const { addToast } = useToast();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            addToast("Les mots de passe ne correspondent pas.", "error");
            return;
        }

        if (password.length < 6) {
            addToast("Le mot de passe doit faire au moins 6 caractères.", "error");
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setIsSuccess(true);
            addToast("Votre nouveau mot de passe a été enregistré !", "success");
            
            // Auto sign-out after success so they log in cleanly, or proceed
            setTimeout(() => {
                supabase.auth.signOut();
                onComplete();
            }, 2000);
        } catch (error: any) {
            addToast(error.message || "Erreur lors de l'enregistrement.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{
            height: '100vh', width: '100vw', background: '#0a0a0a',
            display: 'grid', placeItems: 'center', position: 'fixed', inset: 0, zIndex: 9999,
            fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{
                width: '100%', maxWidth: '380px', padding: '2.5rem',
                background: '#111', border: '1px solid #222', borderRadius: '16px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div className="logo" style={{ marginBottom: '1rem', fontSize: '20px', fontWeight: 900, color: 'white' }}>ESCEN<span style={{color: 'var(--primary)'}}>CRM</span></div>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>Nouveau mot de passe</h2>
                    <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>Définissez votre clé d'accès sécurisée.</p>
                </div>

                {isSuccess ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
                            <CheckCircle2 size={32} color="var(--success)" />
                        </div>
                        <h3 style={{ marginBottom: '10px', color: 'white' }}>Enregistré !</h3>
                        <p style={{ color: '#666', marginBottom: '15px' }}>Redirection vers la page de connexion...</p>
                    </div>
                ) : (
                    <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#666', marginBottom: '8px', display: 'block' }}>NOUVEAU MOT DE PASSE</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    required
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    style={{
                                        width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px',
                                        padding: '12px 14px', color: 'white', fontSize: '14px'
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#666', marginBottom: '8px', display: 'block' }}>CONFIRMER LE MOT DE PASSE</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    required
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    style={{
                                        width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px',
                                        padding: '12px 14px', color: 'white', fontSize: '14px'
                                    }}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSaving} 
                            style={{ 
                                width: '100%', background: 'var(--primary)', color: 'white', border: 'none', padding: '12px', 
                                borderRadius: '12px', fontWeight: 700, fontSize: '15px', display: 'flex', 
                                alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginTop: '1rem'
                            }}
                        >
                            {isSaving ? <Loader2 className="spin" size={18} /> : 'Enregistrer le mot de passe'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
