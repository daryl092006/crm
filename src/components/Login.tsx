import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { LogIn, Building2, ShieldCheck } from 'lucide-react';
import { useToast } from './Toast';

export const Login: React.FC = () => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [orgName, setOrgName] = useState('');
    const [isForgotPassword, setIsForgotPassword] = useState(false);

    const translateError = (msg: string) => {
        if (!msg) return 'Une erreur inconnue est survenue.';
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
        if (lowerMsg.includes('user already registered')) return 'Cet utilisateur existe déjà.';
        if (lowerMsg.includes('password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.';
        if (lowerMsg.includes('rate limit')) return 'Trop de tentatives, veuillez patienter avant de réessayer.';
        if (lowerMsg.includes('organizations_name_key') || lowerMsg.includes('duplicate key value')) return 'Ce nom d\'entreprise est déjà utilisé.';
        if (lowerMsg.includes('missing email')) return 'Veuillez renseigner un email valide.';
        return 'Une erreur est survenue : ' + msg;
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isForgotPassword) {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/`,
                });
                if (error) throw error;
                addToast('Si ce compte existe, un email de réinitialisation vous a été envoyé.', 'success');
                setIsForgotPassword(false);
            } else if (isRegister) {
                // 1. Créer l'organisation d'abord
                const { data: org, error: orgError } = await supabase
                    .from('organizations')
                    .insert({ name: orgName })
                    .select()
                    .single();

                if (orgError) throw orgError;

                // 2. Créer l'utilisateur avec organization_id et rôle ADMIN par défaut
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            organization_id: org.id,
                            role: 'admin', // C'est le créateur, il est admin par défaut
                            full_name: email.split('@')[0]
                        }
                    }
                });

                if (signUpError) throw signUpError;
                addToast('Espace entreprise créé avec succès ! Connectez-vous pour commencer.', 'success');
                setIsRegister(false); // Bascule sur la connexion
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password
                });
                if (error) throw error;
            }
        } catch (error: unknown) {
            console.error('Auth Error Details:', error);
            addToast(translateError((error as Error).message || JSON.stringify(error)), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'grid', placeItems: 'center', background: 'var(--bg-main)', position: 'fixed', top: 0, left: 0, zIndex: 9999 }}>
            <div className="card" style={{ width: '400px', padding: '2.5rem', position: 'relative', zIndex: 10000 }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '64px', height: '64px', background: 'var(--primary)',
                        borderRadius: '16px', display: 'grid', placeItems: 'center', margin: '0 auto 1rem'
                    }}>
                        <ShieldCheck size={32} color="white" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        {isForgotPassword ? 'Mot de passe oublié' : (isRegister ? 'Créer mon CRM' : 'Accès ESCEN CRM')}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {isForgotPassword ? 'Entrez votre email pour réinitialiser.' : (isRegister ? 'Configurez votre espace entreprise en 2 minutes.' : 'Connectez-vous pour gérer vos candidats.')}
                    </p>
                </div>

                <form
                    key={isRegister ? 'reg' : 'log'}
                    onSubmit={handleAuth}
                    style={{ display: 'grid', gap: '1rem' }}
                >
                    {!isForgotPassword && isRegister && (
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>NOM DE L'ENTREPRISE</label>
                            <div style={{ position: 'relative' }}>
                                <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                                <input
                                    name="organization"
                                    id="organization"
                                    type="text" required placeholder=""
                                    value={orgName} onChange={e => setOrgName(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>EMAIL PROFESSIONNEL</label>
                        <input
                            name="email"
                            id="email"
                            type="email" required placeholder=""
                            value={email} onChange={e => setEmail(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                        />
                    </div>

                    {!isForgotPassword && (
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>MOT DE PASSE</label>
                            <input
                                name="password"
                                id="password"
                                type="password" required placeholder=""
                                value={password} onChange={e => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white' }}
                            />
                        </div>
                    )}

                    {!isForgotPassword && !isRegister && (
                        <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsForgotPassword(true);
                                }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                            >
                                Mot de passe oublié ?
                            </button>
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', height: '45px', justifyContent: 'center' }}>
                        {loading ? 'Traitement...' : isForgotPassword ? 'Envoyer le lien' : (isRegister ? 'Créer mon compte' : 'Me connecter')}
                        {!loading && !isForgotPassword && (isRegister ? <Building2 size={18} /> : <LogIn size={18} />)}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <button
                        onClick={() => {
                            if (isForgotPassword) {
                                setIsForgotPassword(false);
                            } else {
                                setIsRegister(!isRegister);
                            }
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                    >
                        {isForgotPassword ? 'Retour à la connexion' : (isRegister ? 'Déjà un compte ? Connectez-vous' : "Pas encore de compte ? Créer l'espace Entreprise")}
                    </button>
                </div>
            </div>
        </div>
    );
};
