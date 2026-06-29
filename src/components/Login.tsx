import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import {
    Lock,
    Mail,
    ArrowRight,
    Eye,
    EyeOff,
    Shield
} from 'lucide-react';
import { useToast } from './Toast';

export const Login: React.FC = () => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isForgotPassword) {
                const { error } = await (supabase.auth as any).resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/`,
                });
                if (error) throw error;
                addToast('Email envoyé.', 'success');
                setIsForgotPassword(false);
            } else {
                const { error } = await (supabase.auth as any).signInWithPassword({
                    email: email.trim(),
                    password
                });
                if (error) throw error;
            }
        } catch (error: any) {
            addToast(error.message || 'Erreur', 'error');
        } finally {
            setLoading(false);
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
                animation: 'slideUp 0.5s ease'
            }}>
                <style>{`
                    @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                    .f-label { font-size: 12px; font-weight: 700; color: #666; margin-bottom: 8px; display: block; letter-spacing: 0.02em; }
                    .i-field { 
                        width: 100%; background: #1a1a1a; border: 1px solid #333; border-radius: 12px; 
                        padding: 12px 14px; padding-right: 40px; color: white; font-size: 14px; transition: all 0.2s;
                    }
                    .i-field:focus { outline: none; border-color: var(--primary); background: #222; }
                    .b-submit { 
                        width: 100%; background: var(--primary); color: white; border: none; padding: 12px; 
                        border-radius: 12px; font-weight: 700; font-size: 15px; display: flex; 
                        align-items: center; justify-content: center; gap: 8px; cursor: pointer; margin-top: 1.5rem; transition: 0.2s;
                    }
                    .b-submit:hover { filter: brightness(1.1); transform: translateY(-1px); }
                    .p-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 0; color: #444; cursor: pointer; }
                `}</style>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '14px', marginBottom: '1rem' }}>
                        <Shield size={24} color="var(--primary)" />
                    </div>
                    <h1 style={{ fontSize: '20px', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>ESCEN CRM</h1>
                    <p style={{ color: '#666', fontSize: '14px', marginTop: '4px' }}>Portail d'Accès Sécurisé</p>
                </div>

                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label className="f-label">ADRESSE E-MAIL</label>
                        <input
                            required type="email" className="i-field"
                            placeholder="nom@entreprise.com"
                            value={email} onChange={e => setEmail(e.target.value)}
                        />
                    </div>

                    {!isForgotPassword && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <label className="f-label">MOT DE PASSE</label>
                                <button type="button" onClick={() => setIsForgotPassword(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 800 }}>OUBLIÉ ?</button>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <input
                                    required type={showPassword ? 'text' : 'password'} className="i-field"
                                    placeholder="••••••••"
                                    value={password} onChange={e => setPassword(e.target.value)}
                                />
                                <button type="button" className="p-toggle" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="b-submit">
                        {loading ? 'Connexion en cours...' : (isForgotPassword ? 'Envoyer le lien' : 'Se connecter')}
                        {!loading && <ArrowRight size={18} />}
                    </button>
                </form>

                {isForgotPassword && (
                    <button onClick={() => setIsForgotPassword(false)} style={{ width: '100%', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '12px', marginTop: '1.5rem', fontWeight: 600 }}>Annuler et revenir</button>
                )}
            </div>
        </div>
    );
};
