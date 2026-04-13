import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Building2, Users, Lock, Plus, Trash, CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from './Toast';

interface Commercial {
    name: string;
    email: string;
}

const Provisioner: React.FC = () => {
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Form states
    const [orgName, setOrgName] = useState('');
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [commercials, setCommercials] = useState<Commercial[]>([{ name: '', email: '' }]);

    const addCommercial = () => {
        setCommercials([...commercials, { name: '', email: '' }]);
    };

    const removeCommercial = (index: number) => {
        setCommercials(commercials.filter((_, i) => i !== index));
    };

    const updateCommercial = (index: number, field: keyof Commercial, value: string) => {
        const newCommercials = [...commercials];
        newCommercials[index][field] = value;
        setCommercials(newCommercials);
    };

    const handleProvision = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // 1. Create Organization
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({ name: orgName })
                .select()
                .single();

            if (orgError) throw orgError;
            console.log('Organization created:', org.id);

            // 2. Create Admin Auth Account (this will fail if email already exists in Auth)
            // Note: In client-side, we use signUp.
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email: adminEmail,
                password: adminPassword,
                options: {
                    data: {
                        full_name: adminName,
                        organization_id: org.id,
                        role: 'admin'
                    }
                }
            });

            if (signUpError) throw signUpError;
            const adminId = authData.user?.id;
            if (!adminId) throw new Error("Erreur de création de l'administrateur");

            // 3. Create Admin Profile in Public Schema
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: adminId,
                    organization_id: org.id,
                    full_name: adminName,
                    role: 'admin',
                    email: adminEmail,
                    is_active: true
                });

            if (profileError) throw profileError;

            // 4. Initialize Statuses for the Organization
            const { error: statusError } = await supabase.from('lead_statuses').insert([
                { id: 'nouveau', label: 'Nouveau', color: '#6366f1', is_default: true, sort_order: 1, organization_id: org.id },
                { id: 'contacte', label: 'Contacté', color: '#10b981', is_default: false, sort_order: 2, organization_id: org.id },
                { id: 'interesse', label: 'Intéressé', color: '#8b5cf6', is_default: false, sort_order: 3, organization_id: org.id },
                { id: 'inscrit', label: 'Inscrit', color: '#22c55e', is_default: false, sort_order: 4, organization_id: org.id },
                { id: 'perdu', label: 'Perdu', color: '#ef4444', is_default: false, sort_order: 5, organization_id: org.id }
            ]);

            if (statusError) throw statusError;

            // 5. Create Commercial Invitations or Profiles
            const validCommercials = commercials.filter(c => c.name.trim() && c.email.trim());
            if (validCommercials.length > 0) {
                const invitations = validCommercials.map(c => ({
                    organization_id: org.id,
                    email: c.email.trim(),
                    role: 'agent',
                    token: Math.random().toString(36).substring(2) + Date.now().toString(36),
                    invited_by: adminId,
                    status: 'pending'
                }));

                const { error: inviteError } = await supabase.from('invitations').insert(invitations);
                if (inviteError) throw inviteError;

                // Also create basic profiles for them so they show up in the agents list
                const profiles = validCommercials.map(c => ({
                    organization_id: org.id,
                    full_name: c.name.trim(),
                    role: 'agent',
                    email: c.email.trim(),
                    is_active: true
                }));
                const { error: commProfileError } = await supabase.from('profiles').insert(profiles);
                if (commProfileError) throw commProfileError;
            }

            setIsSuccess(true);
            addToast(`Organisation "${orgName}" créée avec succès !`, 'success');
        } catch (err: unknown) {
            console.error(err);
            addToast((err as Error).message || "Erreur lors du provisionnement", "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="card" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', padding: '3rem' }}>
                <div style={{ display: 'grid', placeItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'grid', placeItems: 'center' }}>
                        <CheckCircle2 size={40} color="var(--success)" />
                    </div>
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>Configuration terminée !</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    L'organisation <strong>{orgName}</strong> et les comptes ont été créés.<br />
                    L'administrateur ({adminEmail}) peut maintenant se connecter.
                </p>
                <button
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                        setIsSuccess(false);
                        setOrgName('');
                        setAdminName('');
                        setAdminEmail('');
                        setAdminPassword('');
                        setCommercials([{ name: '', email: '' }]);
                    }}
                >
                    Créer une autre organisation
                </button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Sparkles className="text-secondary" /> Provisionnement Rapide
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>Configurez une organisation complète et ses commerciaux en une seule étape.</p>
            </div>

            <form onSubmit={handleProvision} style={{ display: 'grid', gap: '2rem' }}>
                {/* Section Organisation */}
                <div className="card glass">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <Building2 size={24} className="text-primary" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Informations de l'Organisation</h3>
                    </div>
                    <div className="form-group">
                        <label>Nom de l'Organisation</label>
                        <input
                            type="text"
                            required
                            placeholder="ex: École Polytechnique"
                            value={orgName}
                            onChange={e => setOrgName(e.target.value)}
                            style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }}
                        />
                    </div>
                </div>

                {/* Section Administrateur */}
                <div className="card glass">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <Lock size={24} className="text-warning" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Compte Administrateur</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Nom Complet</label>
                            <input
                                type="text"
                                required
                                placeholder="Prénom Nom"
                                value={adminName}
                                onChange={e => setAdminName(e.target.value)}
                                style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }}
                            />
                        </div>
                        <div className="form-group">
                            <label>Email Admin</label>
                            <input
                                type="email"
                                required
                                placeholder="admin@ecole.com"
                                value={adminEmail}
                                onChange={e => setAdminEmail(e.target.value)}
                                style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }}
                            />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label>Mot de passe temporaire</label>
                        <input
                            type="text"
                            required
                            placeholder="Min 6 caractères"
                            value={adminPassword}
                            onChange={e => setAdminPassword(e.target.value)}
                            style={{ width: '100%', padding: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }}
                        />
                    </div>
                </div>

                {/* Section Commerciaux */}
                <div className="card glass">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Users size={24} className="text-secondary" />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Équipe de Commerciaux</h3>
                        </div>
                        <button
                            type="button"
                            onClick={addCommercial}
                            className="btn"
                            style={{ padding: '0.5rem 1rem', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', border: 'none', borderRadius: '8px', display: 'flex', gap: '6px', fontSize: '0.875rem' }}
                        >
                            <Plus size={16} /> Ajouter
                        </button>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {commercials.map((comm, index) => (
                            <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '10px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nom Complet</label>
                                    <input
                                        type="text"
                                        placeholder="Nom du commercial"
                                        value={comm.name}
                                        onChange={e => updateCommercial(index, 'name', e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email</label>
                                    <input
                                        type="email"
                                        placeholder="email@commercial.com"
                                        value={comm.email}
                                        onChange={e => updateCommercial(index, 'email', e.target.value)}
                                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeCommercial(index)}
                                    style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                    <Trash size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', gap: '1rem', padding: '1.25rem' }}>
                    <AlertCircle className="text-warning" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        <strong>Note :</strong> L'administrateur pourra inviter officiellement les commerciaux pour qu'ils configurent leur mot de passe personnel. Les comptes commerciaux créés ici sont des pré-profils.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary"
                    style={{ width: '100%', height: '56px', fontSize: '1.125rem', fontWeight: 700, justifyContent: 'center' }}
                >
                    {isLoading ? <><Loader2 className="spin" size={24} /> Configuration en cours...</> : 'LANCER LE PROVISIONNEMENT'}
                </button>
            </form>
        </div>
    );
};

export default Provisioner;
