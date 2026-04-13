import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { Lock, CheckCircle2, Loader2, UserCircle, X } from 'lucide-react';

const ActivateAccount: React.FC = () => {
    const { addToast } = useToast();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [invitation, setInvitation] = useState<any>(null);
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const t = urlParams.get('token');

        if (t) {
            checkInvitation(t);
        } else {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkInvitation = async (t: string) => {
        const { data, error } = await supabase
            .from('invitations')
            .select('*')
            .eq('token', t)
            .eq('status', 'pending')
            .single();

        if (error || !data) {
            addToast("Cette invitation est invalide ou a déjà été utilisée.", "error");
            setIsLoading(false);
        } else {
            setInvitation(data);
            if (data.full_name) setFullName(data.full_name);
            setIsLoading(false);
        }
    };

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fullName.trim()) {
            addToast("Veuillez entrer votre nom complet.", "error");
            return;
        }

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
            // 1. CRÉATION DU COMPTE AUTH
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: invitation.email,
                password: password,
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Erreur de création de compte.");

            // 2. CRÉATION DU PROFIL PROFESSIONNEL
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    id: authData.user.id,
                    organization_id: invitation.organization_id,
                    full_name: fullName,
                    email: invitation.email,
                    role: invitation.role,
                    is_active: true,
                    must_change_password: false
                }]);

            if (profileError) {
                console.error("Profile error:", profileError.message);
            }

            // 3. MARQUER L'INVITATION COMME UTILISÉE
            await supabase
                .from('invitations')
                .update({ status: 'accepted' })
                .eq('id', invitation.id);

            setIsSuccess(true);
            addToast("Votre compte est activé ! Prêt pour le recrutement.", "success");
        } catch (error: unknown) {
            addToast((error as Error).message || "Erreur lors de l'activation.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return (
        <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
            <Loader2 className="spin" size={48} color="var(--primary)" />
        </div>
    );

    if (!invitation && !isSuccess) return (
        <div style={{ height: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '20px' }}>
            <div>
                <X size={64} color="#ef4444" style={{ marginBottom: '20px', opacity: 0.2 }} />
                <h2>Oups ! Invitation introuvable.</h2>
                <p style={{ color: 'var(--text-muted)' }}>Veuillez contacter votre administrateur pour recevoir une nouvelle clé d'accès.</p>
                <button onClick={() => window.location.href = '/'} className="btn btn-primary" style={{ marginTop: '20px' }}>Retour à l'accueil</button>
            </div>
        </div>
    );

    return (
        <div className="auth-container">
            <div className="auth-card glassmorphism animate-fade">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div className="logo" style={{ marginBottom: '1rem' }}>Elite<span>CRM</span> ESCEN</div>
                    <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(99,102,241,0.1)', borderRadius: '12px', marginBottom: '1rem' }}>
                        <UserCircle size={32} color="var(--primary)" />
                    </div>
                    <h2 className="auth-title">Activation de votre espace</h2>
                    <p className="auth-subtitle">Finalisez votre configuration conseiller.</p>
                </div>

                {isSuccess ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
                            <CheckCircle2 size={32} color="var(--success)" />
                        </div>
                        <h3 style={{ marginBottom: '10px' }}>Compte Activé !</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Vous pouvez maintenant vous connecter avec vos identifiants.</p>
                        <button onClick={() => window.location.href = '/'} className="btn btn-primary btn-auth">Se connecter maintenant</button>
                    </div>
                ) : (
                    <form onSubmit={handleActivate} className="input-group">
                        <div className="input-wrapper">
                            <UserCircle size={18} className="input-icon" />
                            <input type="text" placeholder="Votre nom complet" value={fullName} onChange={e => setFullName(e.target.value)} required />
                        </div>
                        <div className="input-wrapper">
                            <Lock size={18} className="input-icon" />
                            <input type="password" placeholder="Choisir un mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
                        </div>
                        <div className="input-wrapper">
                            <CheckCircle2 size={18} className="input-icon" />
                            <input type="password" placeholder="Confirmer le mot de passe" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                            📧 Connecté en tant que : <b>{invitation?.email}</b>
                        </div>

                        <button disabled={isSaving} className="btn btn-primary btn-auth" style={{ marginTop: '1rem' }}>
                            {isSaving ? <Loader2 className="spin" /> : 'Finaliser mon installation'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ActivateAccount;
